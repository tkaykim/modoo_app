/**
 * Ideogram 어댑터 — 영문 워드마크·레터링용 1순위(글자 정확도).
 * - 4.0: POST https://api.ideogram.ai/v1/ideogram-v4/generate (multipart: text_prompt, resolution, rendering_speed)
 * - 3.0: POST https://api.ideogram.ai/v1/ideogram-v3/generate (multipart: prompt, num_images, rendering_speed,
 *        style_type, negative_prompt, resolution) / 변형: /v1/ideogram-v3/remix (image + prompt + image_weight)
 * 인증: Api-Key 헤더. 응답 data[].url → 다운로드.
 * env: AI_DESIGNER_IDEOGRAM_MODEL = v4 | v3 (기본 v4), AI_DESIGNER_IDEOGRAM_SPEED = TURBO | DEFAULT | QUALITY (기본 TURBO)
 * ⚠ 키 발급 후 실호출 1회 검증 필요(2026-09-04 기준 문서 기준 구현, 미검증). 4.0 변형은 기준 이미지 없이 재생성으로 대체.
 */
import { priceOf } from './pricing.ts';
import { fetchBuffer, logProviderWarn, type GenerateArgs, type GeneratedImage, type ImageProvider } from './types.ts';

const BASE = 'https://api.ideogram.ai/v1';

export function createIdeogramProvider(): ImageProvider | null {
  const key = process.env.IDEOGRAM_API_KEY;
  if (!key) return null;
  const version = (process.env.AI_DESIGNER_IDEOGRAM_MODEL || 'v4').toLowerCase() === 'v3' ? 'v3' : 'v4';
  const speed = (process.env.AI_DESIGNER_IDEOGRAM_SPEED || 'TURBO').toUpperCase();
  const model = `ideogram-${version}-${speed.toLowerCase()}`;
  const headers = { 'Api-Key': key };

  async function collect(res: Response): Promise<GeneratedImage[]> {
    if (!res.ok) {
      logProviderWarn('ideogram', `status ${res.status}`, await res.text());
      return [];
    }
    const data = await res.json();
    const items: Array<{ url?: string; seed?: number }> = data?.data ?? [];
    const out: GeneratedImage[] = [];
    for (const it of items) {
      if (!it.url) continue;
      const r = await fetchBuffer(it.url);
      if (r) out.push({ buffer: r.buffer, mime: r.mime, model, costUsd: priceOf(model), seed: it.seed });
    }
    return out;
  }

  async function generateOnce(args: GenerateArgs, n: number): Promise<GeneratedImage[]> {
    const form = new FormData();
    if (version === 'v4') {
      form.append('text_prompt', args.prompt);
      form.append('resolution', '1024x1024');
      form.append('rendering_speed', speed);
      form.append('num_images', String(n));
      return collect(await fetch(`${BASE}/ideogram-v4/generate`, { method: 'POST', headers, body: form }));
    }
    form.append('prompt', args.prompt);
    form.append('num_images', String(n));
    form.append('rendering_speed', speed);
    form.append('style_type', 'DESIGN');
    form.append('resolution', '1024x1024');
    if (args.negativePrompt) form.append('negative_prompt', args.negativePrompt);
    if (args.seed !== undefined) form.append('seed', String(args.seed));
    return collect(await fetch(`${BASE}/ideogram-v3/generate`, { method: 'POST', headers, body: form }));
  }

  return {
    id: 'ideogram',
    model,
    async generate(args: GenerateArgs): Promise<GeneratedImage[]> {
      const n = Math.max(1, Math.min(6, args.n));
      try {
        if (args.reference && version === 'v3') {
          const form = new FormData();
          form.append('image', new Blob([new Uint8Array(args.reference.buffer)], { type: args.reference.mime }), 'reference.png');
          form.append('prompt', args.prompt);
          form.append('image_weight', '60');
          form.append('num_images', String(n));
          form.append('rendering_speed', speed);
          form.append('style_type', 'DESIGN');
          return collect(await fetch(`${BASE}/ideogram-v3/remix`, { method: 'POST', headers, body: form }));
        }
        const first = await generateOnce(args, n);
        if (first.length > 0 || n === 1) return first;
        // num_images를 거부하는 경우 1장씩 재시도
        const singles = await Promise.all(Array.from({ length: n }, () => generateOnce(args, 1)));
        return singles.flat();
      } catch (e) {
        logProviderWarn('ideogram', 'request failed', e instanceof Error ? e.message : e);
        return [];
      }
    },
  };
}
