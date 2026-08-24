import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { activeProvider, generateLogoImage } from '@/lib/aiDesigner/imageGen';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * 텍스트 프롬프트 → 도안 이미지 생성 → user-designs 버킷 업로드.
 * AI 제공자 미설정이면 501 — 클라이언트는 업로드/촬영 경로로 안내.
 */
export async function POST(req: Request) {
  if (activeProvider() === 'none') {
    return NextResponse.json(
      { error: 'AI 이미지 생성이 아직 준비 중입니다. 이미지를 업로드하거나 촬영해 주세요.' },
      { status: 501 }
    );
  }
  const body = await req.json().catch(() => null);
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim().slice(0, 1000) : '';
  if (!prompt) return NextResponse.json({ error: '프롬프트가 필요합니다.' }, { status: 400 });

  const buf = await generateLogoImage(prompt);
  if (!buf) {
    return NextResponse.json({ error: '이미지 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 502 });
  }

  const admin = createAdminClient();
  const path = `ai-designer/generated/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const { error } = await admin.storage
    .from('user-designs')
    .upload(path, buf, { contentType: 'image/png' });
  if (error) {
    console.error('[ai-designer/generate-logo] upload failed', error);
    return NextResponse.json({ error: '이미지 저장에 실패했습니다.' }, { status: 500 });
  }
  const { data: pub } = admin.storage.from('user-designs').getPublicUrl(path);
  return NextResponse.json({ url: pub.publicUrl, path, prompt });
}
