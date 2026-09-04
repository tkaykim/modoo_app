/**
 * AI 디자이너 — 이미지 생성 진입점 (서버 전용). 호환 레이어.
 *
 * 제공자 선택·설정은 lib/aiDesigner/providers/index.ts 가 정본이다.
 *   AI_DESIGNER_IMAGE_PROVIDER = gemini | openai | recraft | ideogram | mock | none
 *   (mock 은 개발 환경 또는 AI_DESIGNER_ALLOW_MOCK=1 에서만 활성 — 키 없이 전체 파이프라인 테스트)
 *
 * 절대 throw로 플로우를 죽이지 않는다 — 실패 시 null 반환, 호출자가 폴백.
 */
import { geminiComposeDraft } from './providers/gemini.ts';
import { activeProvider, draftMode, resolveProvider } from './providers/index.ts';

export { activeProvider, aiPublicStatus, draftMode, resolveProvider, resolveVectorizer } from './providers/index.ts';
export type AiImageProvider = 'gemini' | 'openai' | 'recraft' | 'ideogram' | 'mock' | 'none';

interface InlineImage {
  mimeType: string;
  dataBase64: string;
}

async function fetchAsInline(url: string): Promise<InlineImage | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mime = res.headers.get('content-type')?.split(';')[0] || 'image/png';
    const buf = Buffer.from(await res.arrayBuffer());
    // 안전상 8MB 초과 원본은 AI 입력에서 제외(원본 보존과 무관 — 스토리지엔 이미 있음)
    if (buf.length > 8 * 1024 * 1024) return null;
    return { mimeType: mime, dataBase64: buf.toString('base64') };
  } catch {
    return null;
  }
}

/** 텍스트 프롬프트 → 도안 이미지 1장 (PNG 버퍼). 단순 호환용 — 위저드는 generate-logo 라우트의 후보 흐름을 쓴다. */
export async function generateLogoImage(prompt: string): Promise<Buffer | null> {
  const provider = resolveProvider('emblem');
  if (!provider) return null;
  const [img] = await provider.generate({ prompt, n: 1, purpose: 'emblem' });
  return img?.buffer ?? null;
}

/**
 * 목업(색상 반영) + 로고들 + 배치 설명 → 착장 초안 1장 (해당 면). 레거시.
 * AI_DESIGNER_DRAFT_MODE=ai 이고 Gemini 키가 있을 때만 동작한다.
 * 기본(local)에서는 null — 도안을 다시 그리거나 색을 바꾸는 위험 때문에 캔버스 결정적 합성을 정본으로 쓴다.
 */
export async function composeSideDraft(args: {
  mockupUrl: string;
  logos: Array<{ url: string; description: string }>;
  garmentName: string;
  colorName: string;
  sideName: string;
}): Promise<Buffer | null> {
  if (draftMode() !== 'ai' || activeProvider() !== 'gemini') return null;
  const mockup = await fetchAsInline(args.mockupUrl);
  if (!mockup) return null;
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
    {
      text:
        `You are a garment mockup compositor. The FIRST image is the base product photo ` +
        `(${args.garmentName}, color: ${args.colorName}, view: ${args.sideName}). ` +
        `Composite the following artwork image(s) onto the garment realistically ` +
        `(follow fabric folds and lighting, keep artwork colors and proportions EXACTLY as given, ` +
        `do not redraw or restyle the artwork). Keep the garment and background unchanged. ` +
        args.logos.map((l, i) => `Artwork ${i + 1}: ${l.description}.`).join(' '),
    },
    { inlineData: { mimeType: mockup.mimeType, data: mockup.dataBase64 } },
  ];
  for (const logo of args.logos) {
    const inline = await fetchAsInline(logo.url);
    if (inline) parts.push({ inlineData: { mimeType: inline.mimeType, data: inline.dataBase64 } });
  }
  return geminiComposeDraft(parts);
}
