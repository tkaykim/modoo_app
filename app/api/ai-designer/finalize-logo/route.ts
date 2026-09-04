import { NextResponse } from 'next/server';
import { createClient as createAuthedClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';
import { resolveVectorizer } from '@/lib/aiDesigner/providers';
import { analyzeArtwork, compactQuality, removeFlatBackground } from '@/lib/aiDesigner/quality';
import { getGeneration, updateGeneration, type FinalRecord } from '@/lib/aiDesigner/generationLedger';

export const runtime = 'nodejs';
export const maxDuration = 120;

const BUCKET = 'user-designs';

/**
 * 고른 후보 → 정제: 단색 배경 제거(플러드필, 외부 API 없음) → 벡터화(Recraft/mock, 있으면) → 인쇄 적합성 검사 → 최종 파일 저장.
 * 주문 canvas_state는 여기서 만든 PNG(투명)를 원본으로 쓰고, SVG가 있으면 디자이너용으로 함께 보존한다.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : null;
  const generationId = typeof body?.generationId === 'string' ? body.generationId : null;
  const index = Number(body?.index);
  const doRemoveBg = body?.removeBackground !== false;
  const doVectorize = body?.vectorize !== false;
  if (!sessionId || !generationId || !Number.isInteger(index)) {
    return NextResponse.json({ error: 'sessionId, generationId, index가 필요합니다.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const gen = await getGeneration(admin, generationId);
  if (!gen || gen.session_id !== sessionId) return NextResponse.json({ error: '생성 결과를 찾을 수 없습니다.' }, { status: 404 });
  const cand = gen.candidates.find((c) => c.index === index);
  if (!cand) return NextResponse.json({ error: '후보를 찾을 수 없습니다.' }, { status: 404 });

  const { data: session } = await admin.from('ai_designer_requests').select('id, user_id, status').eq('id', sessionId).single();
  if (!session) return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 });
  let userId: string | null = null;
  try {
    const authed = await createAuthedClient();
    userId = (await authed.auth.getUser()).data.user?.id ?? null;
  } catch { /* 비로그인 허용 */ }
  if (session.user_id && session.user_id !== userId) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });

  let source: Buffer;
  try {
    const res = await fetch(cand.url);
    if (!res.ok) throw new Error(`status ${res.status}`);
    source = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    console.error('[ai-designer/finalize-logo] fetch candidate failed', e);
    return NextResponse.json({ error: '후보 이미지를 불러오지 못했습니다.' }, { status: 502 });
  }

  // 1) 배경 제거 + 여백 정리
  let png = source;
  let removedBackground = false;
  let width = cand.width;
  let height = cand.height;
  if (doRemoveBg) {
    try {
      const r = await removeFlatBackground(source);
      png = r.png; removedBackground = r.removed; width = r.width; height = r.height;
    } catch (e) {
      console.warn('[ai-designer/finalize-logo] background removal failed, keeping original', e);
    }
  }

  // 2) 벡터화 (제공자 SVG가 이미 있으면 그대로 사용)
  let svg: string | null = null;
  let vectorized: FinalRecord['vectorized'] = null;
  let vectorCost = 0;
  if (cand.svgUrl) {
    try {
      const res = await fetch(cand.svgUrl);
      if (res.ok) { svg = await res.text(); vectorized = 'recraft'; }
    } catch { /* 없으면 아래에서 벡터화 */ }
  }
  if (!svg && doVectorize) {
    const vec = resolveVectorizer();
    if (vec) {
      const r = await vec.vectorize(png);
      if (r) { svg = r.svg; vectorized = vec.id; vectorCost = r.costUsd; }
    }
  }

  // 3) 인쇄 적합성 검사(상대 기준 — 배치 폭이 정해지면 주문 API가 mm 기준으로 다시 검사)
  const quality = compactQuality(await analyzeArtwork(png));

  // 4) 저장
  const dir = cand.path.replace(/\/[^/]+$/, '');
  const finalPath = `${dir}/final-${index}.png`;
  const { error: upErr } = await admin.storage.from(BUCKET).upload(finalPath, png, { contentType: 'image/png', upsert: true });
  if (upErr) {
    console.error('[ai-designer/finalize-logo] upload failed', upErr);
    return NextResponse.json({ error: '이미지 저장에 실패했습니다.' }, { status: 500 });
  }
  const finalUrl = admin.storage.from(BUCKET).getPublicUrl(finalPath).data.publicUrl;
  let svgPath: string | null = null;
  let svgUrl: string | null = null;
  if (svg) {
    svgPath = `${dir}/final-${index}.svg`;
    const { error: svgErr } = await admin.storage.from(BUCKET).upload(svgPath, Buffer.from(svg), { contentType: 'image/svg+xml', upsert: true });
    if (!svgErr) svgUrl = admin.storage.from(BUCKET).getPublicUrl(svgPath).data.publicUrl;
    else svgPath = null;
  }

  const final: FinalRecord = { path: finalPath, url: finalUrl, width, height, svgPath, svgUrl, removedBackground, vectorized, quality };
  await updateGeneration(admin, generationId, {
    selected_index: index,
    final,
    status: 'finalized',
    cost_usd: Math.round(((Number(gen.cost_usd) || 0) + vectorCost) * 10000) / 10000,
  });

  return NextResponse.json({
    url: finalUrl, path: finalPath, width, height, svgUrl, svgPath, removedBackground, vectorized, quality,
    generationId, index,
  });
}
