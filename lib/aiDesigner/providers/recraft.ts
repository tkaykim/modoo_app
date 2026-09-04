/**
 * Recraft 어댑터 — 엠블럼·마스코트 벡터 도안용 1순위.
 * - 생성: POST https://external.api.recraft.ai/v1/images/generations
 *         { prompt, model, n(1~6), size, response_format: 'b64_json', controls: { colors, background_color } }
 *         모델명이 *_vector 이면 SVG가 온다(mime image/svg+xml).
 * - 변형: POST /v1/images/imageToImage (multipart image + prompt + strength + n + model)
 * - 벡터화: POST /v1/images/vectorize (multipart file) → image.url | image.b64_json (SVG)
 * 인증: Authorization: Bearer RECRAFT_API_KEY. 응답 credits 값은 원장에 기록.
 * ⚠ 키 발급 후 실호출 1회 검증 필요(2026-09-04 기준 문서 기준 구현, 미검증).
 */
import { priceOf } from './pricing.ts';
import {
  fetchBuffer,
  logProviderWarn,
  type GenerateArgs,
  type GeneratedImage,
  type ImageProvider,
  type VectorizeResult,
} from './types.ts';

const BASE = 'https://external.api.recraft.ai/v1';

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

async function toImage(item: { url?: string; b64_json?: string }, model: string, credits?: number): Promise<GeneratedImage | null> {
  const isVector = model.endsWith('_vector');
  if (item.b64_json) {
    return {
      buffer: Buffer.from(item.b64_json, 'base64'),
      mime: isVector ? 'image/svg+xml' : 'image/png',
      model,
      costUsd: priceOf(model),
      credits,
    };
  }
  if (item.url) {
    const r = await fetchBuffer(item.url);
    if (!r) return null;
    return { buffer: r.buffer, mime: isVector ? 'image/svg+xml' : r.mime, model, costUsd: priceOf(model), credits };
  }
  return null;
}

export function createRecraftProvider(): ImageProvider | null {
  const key = process.env.RECRAFT_API_KEY;
  if (!key) return null;
  const model = process.env.AI_DESIGNER_RECRAFT_MODEL || 'recraftv4_1';
  const headers = { Authorization: `Bearer ${key}` };

  return {
    id: 'recraft',
    model,
    async generate(args: GenerateArgs): Promise<GeneratedImage[]> {
      const n = Math.max(1, Math.min(6, args.n));
      try {
        let res: Response;
        if (args.reference) {
          const form = new FormData();
          form.append('image', new Blob([new Uint8Array(args.reference.buffer)], { type: args.reference.mime }), 'reference.png');
          form.append('prompt', args.prompt);
          form.append('strength', String(Number(process.env.AI_DESIGNER_RECRAFT_VARIATION_STRENGTH || 0.35)));
          form.append('n', String(n));
          form.append('model', model);
          form.append('response_format', 'b64_json');
          if (args.negativePrompt) form.append('negative_prompt', args.negativePrompt);
          res = await fetch(`${BASE}/images/imageToImage`, { method: 'POST', headers, body: form });
        } else {
          const controls: Record<string, unknown> = { background_color: { rgb: [255, 255, 255] } };
          const colors = (args.paletteHex ?? []).map(hexToRgb).filter((c): c is [number, number, number] => !!c);
          if (colors.length > 0) controls.colors = colors.map((rgb) => ({ rgb }));
          const body: Record<string, unknown> = {
            prompt: args.prompt,
            model,
            n,
            size: '1024x1024',
            response_format: 'b64_json',
            controls,
          };
          if (args.seed !== undefined) body.random_seed = args.seed;
          // negative_prompt는 V2/V3 전용 — V4 계열은 프롬프트에 녹인다(prompt.ts가 이미 금지 문구를 포함)
          if (args.negativePrompt && /^recraftv[23]/.test(model)) body.negative_prompt = args.negativePrompt;
          res = await fetch(`${BASE}/images/generations`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
        }
        if (!res.ok) {
          logProviderWarn('recraft', `status ${res.status}`, await res.text());
          return [];
        }
        const data = await res.json();
        const items: Array<{ url?: string; b64_json?: string }> = data?.data ?? [];
        const credits = typeof data?.credits === 'number' ? data.credits / Math.max(1, items.length) : undefined;
        const out: GeneratedImage[] = [];
        for (const it of items) {
          const img = await toImage(it, model, credits);
          if (img) out.push(img);
        }
        return out;
      } catch (e) {
        logProviderWarn('recraft', 'request failed', e instanceof Error ? e.message : e);
        return [];
      }
    },
    async vectorize(png: Buffer): Promise<VectorizeResult | null> {
      try {
        const form = new FormData();
        form.append('file', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'artwork.png');
        form.append('response_format', 'b64_json');
        const res = await fetch(`${BASE}/images/vectorize`, { method: 'POST', headers, body: form });
        if (!res.ok) {
          logProviderWarn('recraft', `vectorize status ${res.status}`, await res.text());
          return null;
        }
        const data = await res.json();
        const image = data?.image ?? {};
        let svg: string | null = null;
        if (image.b64_json) svg = Buffer.from(image.b64_json, 'base64').toString('utf8');
        else if (image.url) {
          const r = await fetchBuffer(image.url);
          if (r) svg = r.buffer.toString('utf8');
        }
        if (!svg || !svg.includes('<svg')) return null;
        return { svg, costUsd: priceOf('recraft-vectorize'), credits: typeof data?.credits === 'number' ? data.credits : undefined };
      } catch (e) {
        logProviderWarn('recraft', 'vectorize failed', e instanceof Error ? e.message : e);
        return null;
      }
    },
  };
}
