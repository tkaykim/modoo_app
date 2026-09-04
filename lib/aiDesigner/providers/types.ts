/**
 * AI 디자이너 — 이미지 생성 제공자 공통 인터페이스 (서버 전용).
 *
 * 제공자별 API 형식(Gemini / OpenAI / Recraft / Ideogram / mock)을 이 형태로 감싼다.
 * 라우트·파일럿 러너는 이 인터페이스만 본다.
 * 어떤 제공자도 throw로 플로우를 죽이지 않는다 — 실패는 빈 배열 / null.
 */

export type ImageProviderId = 'gemini' | 'openai' | 'recraft' | 'ideogram' | 'mock';

/** 도안 용도 — 프롬프트 템플릿과 제공자 선택에 쓰인다. */
export type ArtworkPurpose = 'emblem' | 'mascot' | 'wordmark';

export interface GenerateArgs {
  /** 구조화된 최종 프롬프트(영문). lib/aiDesigner/prompt.ts가 만든다. */
  prompt: string;
  negativePrompt?: string;
  /** 후보 수 1~6 */
  n: number;
  purpose: ArtworkPurpose;
  /** 변형 기준 이미지(선택). 있으면 image-to-image 계열 API를 쓴다. */
  reference?: { buffer: Buffer; mime: string };
  seed?: number;
  /** 색 힌트(hex). 지원 제공자만 사용. */
  paletteHex?: string[];
}

export interface GeneratedImage {
  /** PNG/JPEG/WEBP/SVG 바이트 */
  buffer: Buffer;
  mime: string;
  model: string;
  /** 가격표 기준 추정 단가(USD). 실제 과금은 제공자 대시보드가 정본. */
  costUsd: number;
  seed?: number;
  /** 제공자가 크레딧을 알려주면 기록(Recraft) */
  credits?: number;
}

export interface VectorizeResult {
  svg: string;
  costUsd: number;
  credits?: number;
}

export interface ImageProvider {
  id: ImageProviderId;
  model: string;
  /** 후보 n장 생성. 실패 시 빈 배열(throw 금지). */
  generate(args: GenerateArgs): Promise<GeneratedImage[]>;
  /** 래스터 → SVG. 지원 제공자만 구현. 실패 시 null. */
  vectorize?(png: Buffer): Promise<VectorizeResult | null>;
}

/** 공통 유틸: 원격 이미지 URL → Buffer (실패 시 null) */
export async function fetchBuffer(url: string, maxBytes = 12 * 1024 * 1024): Promise<{ buffer: Buffer; mime: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mime = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png';
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > maxBytes) return null;
    return { buffer: buf, mime };
  } catch {
    return null;
  }
}

export function logProviderWarn(provider: string, msg: string, detail?: unknown) {
  const d = typeof detail === 'string' ? detail.slice(0, 400) : detail;
  console.warn(`[aiDesigner/providers/${provider}] ${msg}`, d ?? '');
}
