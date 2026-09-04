/**
 * OpenAI gpt-image 계열 어댑터.
 * - 생성: POST /v1/images/generations (background: transparent 지원 — 배경 제거 단계가 사실상 불필요)
 * - 변형: POST /v1/images/edits (multipart, 기준 이미지 + 프롬프트)
 * 모델은 env AI_DESIGNER_OPENAI_MODEL (기본 gpt-image-1.5). 품질은 AI_DESIGNER_OPENAI_QUALITY (low|medium|high).
 * ⚠ 키 발급 후 실호출 1회 검증 필요(2026-09-04 기준 미검증).
 */
import { priceOf } from './pricing.ts';
import { logProviderWarn, type GenerateArgs, type GeneratedImage, type ImageProvider } from './types.ts';

export function createOpenAiProvider(): ImageProvider | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const model = process.env.AI_DESIGNER_OPENAI_MODEL || 'gpt-image-1.5';
  const quality = process.env.AI_DESIGNER_OPENAI_QUALITY || 'medium';

  return {
    id: 'openai',
    model,
    async generate(args: GenerateArgs): Promise<GeneratedImage[]> {
      const n = Math.max(1, Math.min(6, args.n));
      const prompt = args.negativePrompt ? `${args.prompt}\nAvoid: ${args.negativePrompt}.` : args.prompt;
      try {
        let res: Response;
        if (args.reference) {
          const form = new FormData();
          form.append('model', model);
          form.append('prompt', prompt);
          form.append('n', String(n));
          form.append('size', '1024x1024');
          form.append('quality', quality);
          form.append('background', 'transparent');
          form.append('image', new Blob([new Uint8Array(args.reference.buffer)], { type: args.reference.mime }), 'reference.png');
          res = await fetch('https://api.openai.com/v1/images/edits', {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}` },
            body: form,
          });
        } else {
          res = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              prompt,
              n,
              size: '1024x1024',
              quality,
              background: 'transparent',
              output_format: 'png',
            }),
          });
        }
        if (!res.ok) {
          logProviderWarn('openai', `status ${res.status}`, await res.text());
          return [];
        }
        const data = await res.json();
        const items: Array<{ b64_json?: string; url?: string }> = data?.data ?? [];
        const out: GeneratedImage[] = [];
        for (const it of items) {
          if (it.b64_json) {
            out.push({ buffer: Buffer.from(it.b64_json, 'base64'), mime: 'image/png', model, costUsd: priceOf(model) });
          } else if (it.url) {
            const r = await fetch(it.url);
            if (r.ok) out.push({ buffer: Buffer.from(await r.arrayBuffer()), mime: 'image/png', model, costUsd: priceOf(model) });
          }
        }
        return out;
      } catch (e) {
        logProviderWarn('openai', 'request failed', e instanceof Error ? e.message : e);
        return [];
      }
    },
  };
}
