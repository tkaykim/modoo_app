/**
 * 제공자 선택(용도별) + 운영 설정 읽기. 서버 전용.
 *
 * env
 *   AI_DESIGNER_IMAGE_PROVIDER      기본 제공자: gemini | openai | recraft | ideogram | mock | none
 *   AI_DESIGNER_EMBLEM_PROVIDER     엠블럼·마스코트 제공자(선택, 기본은 위 값)
 *   AI_DESIGNER_WORDMARK_PROVIDER   영문 레터링 제공자(선택, 기본은 위 값)
 *   AI_DESIGNER_VECTORIZE_PROVIDER  벡터화: recraft | mock | none | (미설정=자동)
 *   AI_DESIGNER_DRAFT_MODE          실착 초안: local(기본, 캔버스 합성만) | ai(레거시 Gemini 재합성)
 *   AI_DESIGNER_CANDIDATES          후보 수(기본 4, 1~6)
 *   AI_DESIGNER_MAX_ROUNDS_PER_SESSION  세션당 생성 라운드 캡(기본 3)
 *   AI_DESIGNER_MAX_ROUNDS_PER_IP_DAY   IP당 하루 라운드 캡(기본 30)
 *   AI_DESIGNER_ALLOW_MOCK          운영 빌드에서 mock 허용(1) — Vercel preview 테스트용
 * 키: GEMINI_API_KEY / OPENAI_API_KEY / RECRAFT_API_KEY / IDEOGRAM_API_KEY
 */
import { createGeminiProvider } from './gemini.ts';
import { createIdeogramProvider } from './ideogram.ts';
import { createMockProvider, mockAllowed } from './mock.ts';
import { createOpenAiProvider } from './openai.ts';
import { createRecraftProvider } from './recraft.ts';
import type { ArtworkPurpose, ImageProvider, ImageProviderId, VectorizeResult } from './types.ts';

export type { ArtworkPurpose, GenerateArgs, GeneratedImage, ImageProvider, ImageProviderId, VectorizeResult } from './types.ts';

export type ProviderSetting = ImageProviderId | 'none';

const KNOWN: ImageProviderId[] = ['gemini', 'openai', 'recraft', 'ideogram', 'mock'];

function normalize(v: string | undefined): ProviderSetting {
  const p = (v || '').trim().toLowerCase();
  return (KNOWN as string[]).includes(p) ? (p as ImageProviderId) : 'none';
}

export function createProviderById(id: ProviderSetting): ImageProvider | null {
  switch (id) {
    case 'gemini': return createGeminiProvider();
    case 'openai': return createOpenAiProvider();
    case 'recraft': return createRecraftProvider();
    case 'ideogram': return createIdeogramProvider();
    case 'mock': return mockAllowed() ? createMockProvider() : null;
    default: return null;
  }
}

/** 용도별 제공자. 전용 설정 → 기본 설정 순으로 첫 번째 활성 제공자. */
export function resolveProvider(purpose: ArtworkPurpose): ImageProvider | null {
  const specific = purpose === 'wordmark'
    ? process.env.AI_DESIGNER_WORDMARK_PROVIDER
    : process.env.AI_DESIGNER_EMBLEM_PROVIDER;
  const candidates: ProviderSetting[] = [normalize(specific), normalize(process.env.AI_DESIGNER_IMAGE_PROVIDER)];
  for (const id of candidates) {
    if (id === 'none') continue;
    const p = createProviderById(id);
    if (p) return p;
  }
  return null;
}

/** 기본(엠블럼) 제공자 id — 세션 API의 aiEnabled 판정 등 기존 호환용. */
export function activeProvider(): ProviderSetting {
  return resolveProvider('emblem')?.id ?? 'none';
}

export interface Vectorizer {
  id: 'recraft' | 'mock';
  vectorize(png: Buffer): Promise<VectorizeResult | null>;
}

export function resolveVectorizer(): Vectorizer | null {
  const setting = (process.env.AI_DESIGNER_VECTORIZE_PROVIDER || '').trim().toLowerCase();
  const wrap = (p: ImageProvider | null): Vectorizer | null =>
    p && p.vectorize && (p.id === 'recraft' || p.id === 'mock')
      ? { id: p.id, vectorize: (png) => p.vectorize!(png) }
      : null;
  if (setting === 'none') return null;
  if (setting === 'recraft') return wrap(createRecraftProvider());
  if (setting === 'mock') return wrap(createProviderById('mock'));
  // 자동: Recraft 키가 있으면 Recraft, 기본 제공자가 mock이면 mock
  const recraft = wrap(createRecraftProvider());
  if (recraft) return recraft;
  if (activeProvider() === 'mock') return wrap(createProviderById('mock'));
  return null;
}

export function draftMode(): 'local' | 'ai' {
  return (process.env.AI_DESIGNER_DRAFT_MODE || 'local').toLowerCase() === 'ai' ? 'ai' : 'local';
}

function intEnv(name: string, def: number, min: number, max: number): number {
  const v = Number(process.env[name]);
  if (!Number.isFinite(v)) return def;
  return Math.max(min, Math.min(max, Math.floor(v)));
}

export function aiDesignerConfig() {
  return {
    candidates: intEnv('AI_DESIGNER_CANDIDATES', 4, 1, 6),
    maxRoundsPerSession: intEnv('AI_DESIGNER_MAX_ROUNDS_PER_SESSION', 3, 1, 50),
    maxRoundsPerIpDay: intEnv('AI_DESIGNER_MAX_ROUNDS_PER_IP_DAY', 30, 1, 10000),
    draftMode: draftMode(),
    vectorizer: resolveVectorizer()?.id ?? null,
  };
}

/** 클라이언트에 내려주는 활성 상태(키 값은 절대 포함하지 않음). */
export function aiPublicStatus() {
  const emblem = resolveProvider('emblem');
  const wordmark = resolveProvider('wordmark');
  const cfg = aiDesignerConfig();
  return {
    aiEnabled: !!emblem,
    aiWordmarkEnabled: !!wordmark,
    aiDraftEnabled: cfg.draftMode === 'ai' && activeProvider() === 'gemini',
    aiProvider: emblem?.id ?? null,
    aiIsMock: emblem?.id === 'mock',
    aiCandidates: cfg.candidates,
    aiMaxRounds: cfg.maxRoundsPerSession,
    aiVectorize: !!cfg.vectorizer,
  };
}

/** 파일럿 화면용: 지금 키가 있어 호출 가능한 제공자 목록(모델명 포함). */
export function availableProviders(): Array<{ id: ImageProviderId; model: string }> {
  return KNOWN
    .map((id) => createProviderById(id))
    .filter((p): p is ImageProvider => !!p)
    .map((p) => ({ id: p.id, model: p.model }));
}
