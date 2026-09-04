/**
 * Gemini 이미지 모델 어댑터 (generateContent, responseModalities IMAGE).
 * 유료 결제 프로젝트 키 필요 — 무료 티어는 이미지 모델 쿼터 0 (2026-08-24 실측).
 * 기본 모델은 env AI_DESIGNER_GEMINI_MODEL. 비용 계획상 Flash 계열 권장.
 */
import { priceOf } from './pricing.ts';
import { logProviderWarn, type GenerateArgs, type GeneratedImage, type ImageProvider } from './types.ts';

type Part = { text?: string; inlineData?: { mimeType: string; data: string } };

async function callGemini(model: string, key: string, parts: Part[]): Promise<{ buffer: Buffer; mime: string } | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
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
      logProviderWarn('gemini', `status ${res.status}`, await res.text());
      return null;
    }
    const data = await res.json();
    const outParts = data?.candidates?.[0]?.content?.parts ?? [];
    for (const p of outParts) {
      const inline = p.inlineData || p.inline_data;
      if (inline?.data) {
        return { buffer: Buffer.from(inline.data, 'base64'), mime: inline.mimeType || inline.mime_type || 'image/png' };
      }
    }
    return null;
  } catch (e) {
    logProviderWarn('gemini', 'request failed', e instanceof Error ? e.message : e);
    return null;
  }
}

export function createGeminiProvider(): ImageProvider | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.AI_DESIGNER_GEMINI_MODEL || 'gemini-3-pro-image';
  return {
    id: 'gemini',
    model,
    async generate(args: GenerateArgs): Promise<GeneratedImage[]> {
      const parts: Part[] = [];
      const text = args.negativePrompt
        ? `${args.prompt}\nAvoid: ${args.negativePrompt}.`
        : args.prompt;
      if (args.reference) {
        parts.push({ text: `${text}\nThe attached image is the reference artwork to vary.` });
        parts.push({ inlineData: { mimeType: args.reference.mime, data: args.reference.buffer.toString('base64') } });
      } else {
        parts.push({ text });
      }
      // Gemini는 요청당 1장 — n장은 병렬 호출
      const results = await Promise.all(
        Array.from({ length: Math.max(1, Math.min(6, args.n)) }, () => callGemini(model, key, parts))
      );
      return results
        .filter((r): r is { buffer: Buffer; mime: string } => !!r)
        .map((r) => ({ buffer: r.buffer, mime: r.mime, model, costUsd: priceOf(model) }));
    },
  };
}

/** 착장 초안 합성(레거시) — AI_DESIGNER_DRAFT_MODE=ai 일 때만 사용. 도안을 다시 그릴 위험이 있어 기본은 꺼짐. */
export async function geminiComposeDraft(parts: Part[]): Promise<Buffer | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.AI_DESIGNER_GEMINI_MODEL || 'gemini-3-pro-image';
  const r = await callGemini(model, key, parts);
  return r?.buffer ?? null;
}
