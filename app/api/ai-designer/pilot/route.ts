import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { createAdminClient } from '@/lib/supabase-admin';
import { aiDesignerConfig, availableProviders, createProviderById, type ProviderSetting } from '@/lib/aiDesigner/providers';
import { buildArtworkPrompt } from '@/lib/aiDesigner/prompt';
import { analyzeArtwork, compactQuality, imageDims, rasterizeSvg } from '@/lib/aiDesigner/quality';
import { GENERATIONS_TABLE, insertGeneration, updateGeneration, type CandidateRecord } from '@/lib/aiDesigner/generationLedger';
import { PILOT_PROMPTS, findPilotPrompt } from '@/lib/aiDesigner/pilotPrompts';

export const runtime = 'nodejs';
export const maxDuration = 120;

const BUCKET = 'user-designs';

/**
 * 품질 파일럿 API (개발·테스트 환경 전용).
 * 게이트: AI_DESIGNER_PILOT_ENABLED=1 + (AI_DESIGNER_PILOT_TOKEN 이 있으면 x-pilot-token 헤더 일치).
 * GET  ?run=            런 목록 / 런의 행들 + 사용 가능 제공자 + 프롬프트 30건
 * POST {run, promptId, provider}   프롬프트 1건 × 제공자 1개 후보 생성 → 원장(kind=pilot)
 * PATCH {id, ratings}              디자이너 3등급 평가 저장
 */
function pilotAllowed(req: Request): boolean {
  if (process.env.AI_DESIGNER_PILOT_ENABLED !== '1') return false;
  const token = process.env.AI_DESIGNER_PILOT_TOKEN;
  if (!token) return process.env.NODE_ENV === 'development';
  const given = req.headers.get('x-pilot-token') || new URL(req.url).searchParams.get('token');
  return given === token;
}

const ROW_COLUMNS = 'id, pilot_run, pilot_prompt_id, purpose, provider, model, request_text, prompt, candidate_count, candidates, cost_usd, credits, status, ratings, created_at';

export async function GET(req: Request) {
  if (!pilotAllowed(req)) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const run = new URL(req.url).searchParams.get('run');
  const admin = createAdminClient();
  let q = admin.from(GENERATIONS_TABLE).select(ROW_COLUMNS).eq('kind', 'pilot').order('created_at', { ascending: true }).limit(2000);
  if (run) q = q.eq('pilot_run', run);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = data ?? [];
  const runs = new Map<string, { run: string; rows: number; providers: Set<string>; createdAt: string }>();
  for (const r of rows as Array<{ pilot_run: string; provider: string; created_at: string }>) {
    const e = runs.get(r.pilot_run) ?? { run: r.pilot_run, rows: 0, providers: new Set<string>(), createdAt: r.created_at };
    e.rows++; e.providers.add(r.provider);
    runs.set(r.pilot_run, e);
  }
  return NextResponse.json({
    providers: availableProviders(),
    prompts: PILOT_PROMPTS,
    candidates: aiDesignerConfig().candidates,
    runs: Array.from(runs.values()).map((r) => ({ ...r, providers: Array.from(r.providers) })),
    rows: run ? rows : [],
  });
}

export async function POST(req: Request) {
  if (!pilotAllowed(req)) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const body = await req.json().catch(() => null);
  const run = typeof body?.run === 'string' ? body.run.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) : '';
  const promptId = typeof body?.promptId === 'string' ? body.promptId : '';
  const providerId = typeof body?.provider === 'string' ? (body.provider as ProviderSetting) : 'none';
  if (!run || !promptId) return NextResponse.json({ error: 'run, promptId가 필요합니다.' }, { status: 400 });
  const spec = findPilotPrompt(promptId);
  if (!spec) return NextResponse.json({ error: '프롬프트를 찾을 수 없습니다.' }, { status: 404 });
  const provider = createProviderById(providerId);
  if (!provider) return NextResponse.json({ error: `제공자를 사용할 수 없습니다: ${providerId} (키 미설정)` }, { status: 400 });

  const admin = createAdminClient();
  const cfg = aiDesignerConfig();
  const built = buildArtworkPrompt({ request: spec.request, purpose: spec.purpose, colorCount: spec.colorCount, text: spec.text });
  const images = await provider.generate({ prompt: built.prompt, negativePrompt: built.negativePrompt, n: cfg.candidates, purpose: spec.purpose });
  const candidates: CandidateRecord[] = [];
  let costUsd = 0;
  let credits = 0;
  let hasCredits = false;
  const dir = `ai-designer/pilot/${run}`;
  await Promise.all(images.map(async (img, i) => {
    try {
      let svg: string | null = null;
      let png: Buffer;
      if (img.mime === 'image/svg+xml') { svg = img.buffer.toString('utf8'); png = await rasterizeSvg(svg, 1024); }
      else if (img.mime === 'image/png') png = img.buffer;
      else png = await sharp(img.buffer).png().toBuffer();
      const path = `${dir}/${promptId}-${provider.id}-${Date.now()}-${i}.png`;
      const { error } = await admin.storage.from(BUCKET).upload(path, png, { contentType: 'image/png' });
      if (error) throw error;
      const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      let svgPath: string | null = null;
      let svgUrl: string | null = null;
      if (svg) {
        svgPath = path.replace(/\.png$/, '.svg');
        const { error: svgErr } = await admin.storage.from(BUCKET).upload(svgPath, Buffer.from(svg), { contentType: 'image/svg+xml' });
        if (!svgErr) svgUrl = admin.storage.from(BUCKET).getPublicUrl(svgPath).data.publicUrl; else svgPath = null;
      }
      const dims = await imageDims(png);
      const quality = compactQuality(await analyzeArtwork(png, { widthMm: 100 }));
      candidates.push({ index: i, path, url, width: dims.width, height: dims.height, mime: 'image/png', quality, svgPath, svgUrl });
      costUsd += img.costUsd;
      if (typeof img.credits === 'number') { credits += img.credits; hasCredits = true; }
    } catch (e) {
      console.error('[ai-designer/pilot] candidate failed', promptId, provider.id, i, e);
    }
  }));
  candidates.sort((a, b) => a.index - b.index);

  const id = await insertGeneration(admin, {
    kind: 'pilot', session_id: null, user_id: null, ip_hash: null, purpose: spec.purpose,
    provider: provider.id, model: provider.model, request_text: spec.text ? `${spec.text} · ${spec.request}` : spec.request,
    prompt: built.prompt, negative_prompt: built.negativePrompt, candidate_count: candidates.length, candidates,
    variation_of: null, cost_usd: Math.round(costUsd * 10000) / 10000, credits: hasCredits ? credits : null,
    status: candidates.length > 0 ? 'generated' : 'failed', pilot_run: run, pilot_prompt_id: promptId,
    meta: { summary: built.summary, colorCount: spec.colorCount },
  });
  if (!id) return NextResponse.json({ error: '원장 기록에 실패했습니다.' }, { status: 500 });
  const { data: row } = await admin.from(GENERATIONS_TABLE).select(ROW_COLUMNS).eq('id', id).single();
  return NextResponse.json({ row });
}

export async function PATCH(req: Request) {
  if (!pilotAllowed(req)) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const body = await req.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : null;
  const ratings = Array.isArray(body?.ratings) ? body.ratings : null;
  if (!id || !ratings) return NextResponse.json({ error: 'id, ratings가 필요합니다.' }, { status: 400 });
  const clean = ratings
    .filter((r: unknown) => r && typeof r === 'object')
    .map((r: Record<string, unknown>) => ({
      index: Number(r.index),
      grade: ['keep', 'fix', 'reject'].includes(String(r.grade)) ? String(r.grade) : null,
      minutes: Number.isFinite(Number(r.minutes)) ? Number(r.minutes) : null,
      note: typeof r.note === 'string' ? r.note.slice(0, 300) : null,
    }))
    .filter((r: { index: number }) => Number.isInteger(r.index));
  const admin = createAdminClient();
  await updateGeneration(admin, id, { ratings: clean });
  return NextResponse.json({ ok: true, ratings: clean });
}
