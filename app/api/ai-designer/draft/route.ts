import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { activeProvider, composeSideDraft } from '@/lib/aiDesigner/imageGen';
import { loadProductSides } from '@/lib/aiDesigner/serverGeometry';

export const runtime = 'nodejs';
export const maxDuration = 120;

interface DraftPlacement {
  side_id: string;
  image_index: number;
  anchor_label?: string;
  width_mm?: number;
}

/**
 * 세션의 배치 정보로 면별 AI 착장 초안을 생성해 세션에 저장.
 * AI 제공자 미설정이면 aiEnabled:false 반환 — 클라이언트는 로컬 합성 미리보기 유지.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : null;
  if (!sessionId) return NextResponse.json({ error: 'sessionId가 필요합니다.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: session } = await admin
    .from('ai_designer_requests')
    .select('*')
    .eq('id', sessionId)
    .single();
  if (!session) return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 });

  if (activeProvider() === 'none') {
    return NextResponse.json({ aiEnabled: false, drafts: {} });
  }

  const loaded = await loadProductSides(admin, session.product_id);
  if (!loaded) return NextResponse.json({ error: '상품 정보를 찾을 수 없습니다.' }, { status: 404 });

  const sourceImages = (session.source_images ?? []) as Array<{ url: string; name?: string; prompt?: string }>;
  const placements = (session.placements ?? []) as DraftPlacement[];
  const color = (session.product_color ?? {}) as { hex?: string; name?: string; side_mockups?: Record<string, string> };

  const bySide = new Map<string, DraftPlacement[]>();
  for (const p of placements) {
    if (!bySide.has(p.side_id)) bySide.set(p.side_id, []);
    bySide.get(p.side_id)!.push(p);
  }

  const drafts: Record<string, string> = {};
  await Promise.all(
    Array.from(bySide.entries()).map(async ([sideId, sidePlacements]) => {
      const side = loaded.sides.find((s) => s.geometry.sideId === sideId);
      if (!side) return;
      const mockupUrl = color.side_mockups?.[sideId] || side.mockupUrl;
      const logos = sidePlacements
        .map((p) => {
          const img = sourceImages[p.image_index];
          if (!img) return null;
          const pos = p.anchor_label || '지정 위치';
          const size = p.width_mm ? `${Math.round(p.width_mm / 10)}cm wide` : '';
          return { url: img.url, description: `place at "${pos}" ${size}`.trim() };
        })
        .filter((v): v is { url: string; description: string } => !!v);
      if (logos.length === 0) return;

      const buf = await composeSideDraft({
        mockupUrl,
        logos,
        garmentName: loaded.product.title,
        colorName: color.name || '',
        sideName: side.name,
      });
      if (!buf) return;
      const path = `ai-designer/drafts/${sessionId}-${sideId}-${Date.now()}.png`;
      const { error } = await admin.storage
        .from('user-designs')
        .upload(path, buf, { contentType: 'image/png', upsert: true });
      if (!error) {
        const { data: pub } = admin.storage.from('user-designs').getPublicUrl(path);
        drafts[sideId] = pub.publicUrl;
      }
    })
  );

  await admin
    .from('ai_designer_requests')
    .update({
      draft_images: { ...((session.draft_images as Record<string, string>) ?? {}), ...drafts },
      status: 'drafted',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  return NextResponse.json({ aiEnabled: true, drafts });
}
