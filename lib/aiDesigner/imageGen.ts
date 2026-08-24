/**
 * AI 디자이너 — 이미지 생성 어댑터 (서버 전용).
 *
 * env AI_DESIGNER_IMAGE_PROVIDER:
 *   - 'gemini' : GEMINI_API_KEY 필요 (이미지 모델은 유료 결제 프로젝트 키여야 함.
 *                무료 티어는 이미지 모델 쿼터 0 — 2026-08-24 실측)
 *   - 'openai' : OPENAI_API_KEY 필요 (gpt-image 계열)
 *   - 미설정/'none' : AI 생성 비활성 — 클라이언트 로컬 합성 미리보기만 사용.
 *
 * 절대 throw로 플로우를 죽이지 않는다 — 실패 시 null 반환, 호출자가 폴백.
 */

export type AiImageProvider = 'gemini' | 'openai' | 'none';

export function activeProvider(): AiImageProvider {
  const p = (process.env.AI_DESIGNER_IMAGE_PROVIDER || '').toLowerCase();
  if (p === 'gemini' && process.env.GEMINI_API_KEY) return 'gemini';
  if (p === 'openai' && process.env.OPENAI_API_KEY) return 'openai';
  return 'none';
}

const GEMINI_IMAGE_MODEL = process.env.AI_DESIGNER_GEMINI_MODEL || 'gemini-3-pro-image';

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

async function geminiGenerate(
  parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>
): Promise<Buffer | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseModalities: ['IMAGE'] },
        }),
      }
    );
    if (!res.ok) {
      console.warn('[aiDesigner/imageGen] gemini status', res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const data = await res.json();
    const outParts = data?.candidates?.[0]?.content?.parts ?? [];
    for (const p of outParts) {
      const inline = p.inlineData || p.inline_data;
      if (inline?.data) return Buffer.from(inline.data, 'base64');
    }
    return null;
  } catch (e) {
    console.warn('[aiDesigner/imageGen] gemini error', e);
    return null;
  }
}

/** 텍스트 프롬프트 → 로고/도안 이미지 1장 (PNG 버퍼). */
export async function generateLogoImage(prompt: string): Promise<Buffer | null> {
  if (activeProvider() !== 'gemini') return null;
  return geminiGenerate([
    {
      text:
        `Create a single standalone graphic suitable for garment printing. ` +
        `Transparent or plain white background, no mockup, no shirt, centered artwork only. ` +
        `Design request: ${prompt}`,
    },
  ]);
}

/**
 * 목업(색상 반영) + 로고들 + 배치 설명 → 착장 초안 1장 (해당 면).
 * mockupUrl: 해당 색상의 면 목업. logoUrls: 그 면에 배치된 원본 도안들.
 */
export async function composeSideDraft(args: {
  mockupUrl: string;
  logos: Array<{ url: string; description: string }>;
  garmentName: string;
  colorName: string;
  sideName: string;
}): Promise<Buffer | null> {
  if (activeProvider() !== 'gemini') return null;
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
  return geminiGenerate(parts);
}
