import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { createClient as createAuthedClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';
import { aiDesignerConfig, resolveProvider } from '@/lib/aiDesigner/providers';
import {
  buildArtworkPrompt,
  normalizeColorCount,
  validatePromptInput,
  type ArtworkPurpose,
} from '@/lib/aiDesigner/prompt';
import { analyzeArtwork, compactQuality, imageDims, rasterizeSvg } from '@/lib/aiDesigner/quality';
import {
  countRounds,
  getClientIp,
  getGeneration,
  hashIp,
  insertGeneration,
  type CandidateRecord,
} from '@/lib/aiDesigner/generationLedger';

export const runtime = 'nodejs';
export const maxDuration = 120;

const PURPOSES: ArtworkPurpose[] = ['emblem', 'mascot', 'wordmark'];
const BUCKET = 'user-designs';

/**
 * 고객 요청 → 구조화 프롬프트 → 후보 n장 생성 → 스토리지 업로드 + 상대 품질 검사 → 원장 기록.
 * - 글자는 AI가 그리지 않는다(엠블럼·마스코트 no-text 강제, 영문 레터링만 따옴표 문구, 한글 거부).
 * - 세션당·IP당 라운드 캡(429). 제공자 미설정이면 501(클라이언트는 업로드/촬영 경로로 안내).
 * - 변형 라운드: variationOf {generationId, index} 의 후보를 기준 이미지로 첨부.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : null;
  if (!sessionId) return NextResponse.json({ error: 'sessionId가 필요합니다.' }, { status: 400 });

  const purpose: ArtworkPurpose = PURPOSES.includes(body?.purpose) ? body.purpose : 'emblem';
  const provider = resolveProvider(purpose);
  if (!provider) {
    return NextResponse.json(
      { error: 'AI 이미지 생성이 아직 준비 중입니다. 이미지를 업로드하거나 촬영해 주세요.' },
      { status: 501 }
    );
  }

  const request = typeof body?.request === 'string' ? body.request.trim().slice(0, 400) : '';
  const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 60) : '';
  const colorCount = normalizeColorCount(body?.colorCount);
  const variationOf = body?.variationOf && typeof body.variationOf.generationId === 'string'
    ? { generationId: body.variationOf.generationId as string, index: Number(body.variationOf.index) }
    : null;

  const valid = validatePromptInput({ request, purpose, colorCount, text });
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 });

  const admin = createAdminClient();
  const { data: session } = await admin
    .from('ai_designer_requests')
    .select('id, user_id, status')
    .eq('id', sessionId)
    .single();
  if (!session) return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 });
  let userId: string | null = null;
  try {
    const authed = await createAuthedClient();
    userId = (await authed.auth.getUser()).data.user?.id ?? null;
  } catch { /* 비로그인 허용 */ }
  if (session.user_id && session.user_id !== userId) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }
  if (session.status === 'ordered') return NextResponse.json({ error: '이미 주문된 세션입니다.' }, { status: 409 });

  // 캡
  const cfg = aiDesignerConfig();
  const ipHash = hashIp(getClientIp(req));
  const rounds = await countRounds(admin, { sessionId, ipHash });
  if (rounds.session >= cfg.maxRoundsPerSession) {
    return NextResponse.json(
      { error: `이 주문에서 쓸 수 있는 AI 생성 ${cfg.maxRoundsPerSession}회를 모두 사용했습니다. 마음에 드는 후보를 쓰거나, 이미지를 올리거나, 디자이너에게 맡겨 주세요.`, roundsUsed: rounds.session, maxRounds: cfg.maxRoundsPerSession },
      { status: 429 }
    );
  }
  if (rounds.ipDay >= cfg.maxRoundsPerIpDay) {
    return NextResponse.json({ error: '오늘 AI 생성 한도에 도달했습니다. 내일 다시 시도하거나 이미지를 올려 주세요.' }, { status: 429 });
  }

  // 변형 기준 이미지
  let reference: { buffer: Buffer; mime: string } | undefined;
  if (variationOf) {
    const base = await getGeneration(admin, variationOf.generationId);
    const cand = base?.candidates?.find((c) => c.index === variationOf.index);
    if (!base || base.session_id !== sessionId || !cand) {
      return NextResponse.json({ error: '변형할 후보를 찾을 수 없습니다.' }, { status: 404 });
    }
    try {
      const res = await fetch(cand.url);
      if (res.ok) reference = { buffer: Buffer.from(await res.arrayBuffer()), mime: cand.mime || 'image/png' };
    } catch { /* 기준 이미지 없이 진행 */ }
  }

  const built = buildArtworkPrompt({ request, purpose, colorCount, text, variation: !!reference });
  const images = await provider.generate({
    prompt: built.prompt,
    negativePrompt: built.negativePrompt,
    n: cfg.candidates,
    purpose,
    reference,
  });

  if (images.length === 0) {
    await insertGeneration(admin, {
      kind: 'customer', session_id: sessionId, user_id: userId, ip_hash: ipHash, purpose,
      provider: provider.id, model: provider.model, request_text: request, prompt: built.prompt,
      negative_prompt: built.negativePrompt, candidate_count: 0, candidates: [], variation_of: variationOf?.generationId ?? null,
      cost_usd: 0, credits: null, status: 'failed',
    });
    return NextResponse.json({ error: '이미지 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 502 });
  }

  const genKey = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const dir = `ai-designer/generated/${sessionId}/${genKey}`;
  const candidates: CandidateRecord[] = [];
  let costUsd = 0;
  let credits = 0;
  let hasCredits = false;

  await Promise.all(
    images.map(async (img, i) => {
      try {
        let svg: string | null = null;
        let png: Buffer;
        if (img.mime === 'image/svg+xml') {
          svg = img.buffer.toString('utf8');
          png = await rasterizeSvg(svg, 1024);
        } else if (img.mime === 'image/png') {
          png = img.buffer;
        } else {
          png = await sharp(img.buffer).png().toBuffer();
        }
        const path = `${dir}/${i}.png`;
        const { error } = await admin.storage.from(BUCKET).upload(path, png, { contentType: 'image/png' });
        if (error) throw error;
        const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        let svgPath: string | null = null;
        let svgUrl: string | null = null;
        if (svg) {
          svgPath = `${dir}/${i}.svg`;
          const { error: svgErr } = await admin.storage.from(BUCKET).upload(svgPath, Buffer.from(svg), { contentType: 'image/svg+xml' });
          if (!svgErr) svgUrl = admin.storage.from(BUCKET).getPublicUrl(svgPath).data.publicUrl;
          else svgPath = null;
        }
        const dims = await imageDims(png);
        const quality = compactQuality(await analyzeArtwork(png));
        candidates.push({ index: i, path, url, width: dims.width, height: dims.height, mime: 'image/png', quality, svgPath, svgUrl });
        costUsd += img.costUsd;
        if (typeof img.credits === 'number') { credits += img.credits; hasCredits = true; }
      } catch (e) {
        console.error('[ai-designer/generate-logo] candidate failed', i, e);
      }
    })
  );
  candidates.sort((a, b) => a.index - b.index);
  if (candidates.length === 0) {
    return NextResponse.json({ error: '이미지 저장에 실패했습니다.' }, { status: 500 });
  }

  const generationId = await insertGeneration(admin, {
    kind: 'customer', session_id: sessionId, user_id: userId, ip_hash: ipHash, purpose,
    provider: provider.id, model: provider.model, request_text: request, prompt: built.prompt,
    negative_prompt: built.negativePrompt, candidate_count: candidates.length, candidates,
    variation_of: variationOf?.generationId ?? null, cost_usd: Math.round(costUsd * 10000) / 10000,
    credits: hasCredits ? credits : null, status: 'generated', meta: { summary: built.summary, colorCount, text: text || null },
  });

  return NextResponse.json({
    generationId,
    provider: provider.id,
    isMock: provider.id === 'mock',
    summary: built.summary,
    candidates: candidates.map((c) => ({
      index: c.index, url: c.url, path: c.path, width: c.width, height: c.height, svgUrl: c.svgUrl,
      quality: c.quality,
    })),
    roundsUsed: rounds.session + 1,
    maxRounds: cfg.maxRoundsPerSession,
  });
}
