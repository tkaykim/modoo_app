/**
 * AI 디자이너 — 프롬프트 구조화 (클라·서버 공용, 의존성 없음).
 *
 * 품질 원칙:
 *  1) 글자는 AI가 그리지 않는다 — 엠블럼·마스코트 프롬프트는 "no text"를 강제하고,
 *     영문 레터링만 따옴표로 정확한 문구를 넘긴다. 한글 문구는 거부(디자이너가 서체로 넣는다).
 *  2) 자수·인쇄 제약을 프롬프트에 녹인다 — 플랫 벡터, 단색 2~4색, 그라데이션·사진풍·목업 금지, 굵은 선.
 *  3) 고객 요청 원문은 그대로 보존(원장 request_text)하고, 모델에는 구조화된 영문 프롬프트를 보낸다.
 */

export type ArtworkPurpose = 'emblem' | 'mascot' | 'wordmark';

export const PURPOSE_LABELS: Record<ArtworkPurpose, string> = {
  emblem: '엠블럼·로고',
  mascot: '마스코트·캐릭터',
  wordmark: '영문 레터링',
};

export const PURPOSE_HINTS: Record<ArtworkPurpose, string> = {
  emblem: '예: 파란 방패 안에 번개, 축구팀 느낌',
  mascot: '예: 안경 쓴 북극곰이 농구공을 든 모습',
  wordmark: '문구는 아래 칸에 영문으로 따로 적어 주세요',
};

export type ColorCount = 2 | 3 | 4;

export interface PromptInput {
  /** 고객 요청 원문(한국어 가능) */
  request: string;
  purpose: ArtworkPurpose;
  colorCount: ColorCount;
  /** 영문 레터링 문구(wordmark 전용) */
  text?: string;
  paletteHex?: string[];
  /** 변형 라운드 여부(기준 이미지 첨부) */
  variation?: boolean;
}

export interface BuiltPrompt {
  prompt: string;
  negativePrompt: string;
  /** 원장·UI용 짧은 요약(한국어) */
  summary: string;
}

export function hasKorean(s: string): boolean {
  return /[ㄱ-ㆎ가-힣]/.test(s);
}

/** 큰따옴표/작은따옴표/「」 안의 문구 추출 */
export function extractQuotedText(s: string): string | null {
  const m = /["“”'‘’「『]([^"“”'‘’」』]{1,40})["“”'‘’」』]/.exec(s);
  return m ? m[1].trim() : null;
}

const TEXT_WORDS = /(글자|글씨|문구|레터링|텍스트|이름|학번|숫자|영문|wordmark|lettering|typography|\btext\b|\bletters?\b)/i;
const MASCOT_WORDS = /(마스코트|캐릭터|동물|곰|호랑이|사자|독수리|강아지|고양이|용|늑대|여우|토끼|mascot|character|animal)/i;

export function classifyPurpose(request: string): ArtworkPurpose {
  if (TEXT_WORDS.test(request) && !MASCOT_WORDS.test(request)) return 'wordmark';
  if (MASCOT_WORDS.test(request)) return 'mascot';
  return 'emblem';
}

export function normalizeColorCount(v: unknown): ColorCount {
  const n = Number(v);
  return n === 2 || n === 4 ? n : 3;
}

export const WORDMARK_TEXT_MAX = 24;

export function validatePromptInput(input: PromptInput): { ok: true } | { ok: false; error: string } {
  const request = (input.request || '').trim();
  if (input.purpose === 'wordmark') {
    const text = (input.text || '').trim();
    if (!text) return { ok: false, error: '레터링 문구를 영문으로 입력해 주세요.' };
    if (hasKorean(text)) {
      return {
        ok: false,
        error: '한글 문구는 AI가 그리지 않습니다. 주문 요청사항에 적어 주시면 디자이너가 서체로 넣어 드립니다.',
      };
    }
    if (!/^[A-Za-z0-9 .&'\-]+$/.test(text)) {
      return { ok: false, error: '문구는 영문·숫자·공백·기호(. & \' -)만 사용할 수 있습니다.' };
    }
    if (text.length > WORDMARK_TEXT_MAX) return { ok: false, error: `문구는 ${WORDMARK_TEXT_MAX}자 이하로 입력해 주세요.` };
    return { ok: true };
  }
  if (!request) return { ok: false, error: '어떤 도안인지 한 줄로 설명해 주세요.' };
  if (request.length < 2) return { ok: false, error: '설명이 너무 짧습니다.' };
  return { ok: true };
}

/** 엠블럼·마스코트 요청에 글자 요구가 섞여 있으면 안내 문구(차단은 아님) */
export function textAdvisory(input: PromptInput): string | null {
  if (input.purpose === 'wordmark') return null;
  const quoted = extractQuotedText(input.request || '');
  if (quoted || TEXT_WORDS.test(input.request || '')) {
    return '글자·이름·학번은 AI 도안에 넣지 않습니다. 그림 요소만 설명해 주세요. 문구는 디자이너가 서체로 정확하게 넣어 드립니다.';
  }
  return null;
}

const PURPOSE_PHRASE: Record<ArtworkPurpose, string> = {
  emblem: 'a bold emblem / crest logo',
  mascot: 'a bold mascot character logo',
  wordmark: 'a varsity-style wordmark lettering logo',
};

export function buildArtworkPrompt(input: PromptInput): BuiltPrompt {
  const request = (input.request || '').trim().replace(/\s+/g, ' ').slice(0, 400);
  const colorCount = normalizeColorCount(input.colorCount);
  const palette = (input.paletteHex ?? []).filter((h) => /^#?[0-9a-f]{6}$/i.test(h)).slice(0, colorCount);
  const paletteHint = palette.length > 0 ? ` using only these colors: ${palette.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(', ')}` : '';

  const lines: string[] = [];
  if (input.variation) {
    lines.push('Create a new variation of the attached artwork: keep the same subject, style and color palette, change the composition and details slightly.');
  }
  lines.push(`Design ${PURPOSE_PHRASE[input.purpose]} for embroidery and garment printing.`);
  if (request) lines.push(`Subject: ${request}.`);
  lines.push(
    `Style: flat vector illustration, bold simplified shapes, thick clean outlines, solid fills only, exactly ${colorCount} colors or fewer${paletteHint}, high contrast, balanced symmetrical composition, every line at least 3% of the artwork width.`
  );
  lines.push('Output: one single centered artwork on a plain solid white background, no mockup, no shirt, no frame, no drop shadow, no watermark, no signature.');
  if (input.purpose === 'wordmark') {
    const text = (input.text || '').trim().slice(0, WORDMARK_TEXT_MAX);
    lines.push(`Text policy: the only text is "${text}" in bold block varsity lettering, spelled exactly as written, all uppercase, no other words or letters anywhere.`);
  } else {
    lines.push('Text policy: no text, no letters, no numbers, no typography of any kind.');
  }
  lines.push('Do not use gradients, shading, 3D effects, photorealism, textures, tiny details or thin hairlines.');

  const negativePrompt =
    'gradient, shading, 3d render, photorealistic, photograph, texture, blur, noise, watermark, signature, mockup, t-shirt, apparel, background scene, thin lines, tiny details, extra text, misspelled text, cropped';

  const summary = input.purpose === 'wordmark'
    ? `${PURPOSE_LABELS.wordmark} "${(input.text || '').trim()}"${request ? ` · ${request.slice(0, 40)}` : ''} · ${colorCount}색`
    : `${PURPOSE_LABELS[input.purpose]} · ${request.slice(0, 50)} · ${colorCount}색`;

  return { prompt: lines.join('\n'), negativePrompt, summary };
}
