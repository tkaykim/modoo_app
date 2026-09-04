/**
 * 목업 색 입히기 (클라이언트 전용).
 *
 * 에디터 SingleSideCanvas가 배경 목업에 거는 fabric BlendColor({ mode: 'multiply', alpha: 1 })와
 * 같은 결과를 캔버스 2D 합성으로 만든다: 목업 × 색(multiply) 후 목업의 알파로 잘라낸다(destination-in).
 * 흰 원단 목업이 선택 색으로 물들고 주름·음영은 그대로 남는다. 색상별 실사 목업(side_mockups)이 있으면 호출측이 이 함수를 건너뛴다.
 */

const tintCache = new Map<string, HTMLCanvasElement>();
const MAX_CACHE = 24;
const MAX_DIM = 2048;

export function normalizeHex(hex: string | null | undefined): string {
  const v = (hex || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(v)) return `#${v}`.toUpperCase();
  if (/^rgb/i.test(v)) return v;
  return '#FFFFFF';
}

/** multiply 결과가 원본과 같은 흰색이면 합성을 건너뛴다. */
export function isWhite(hex: string | null | undefined): boolean {
  return normalizeHex(hex) === '#FFFFFF';
}

export function tintImage(img: HTMLImageElement, hex: string, cacheKey?: string): HTMLCanvasElement | HTMLImageElement {
  if (isWhite(hex)) return img;
  const key = cacheKey ?? `${img.src}|${normalizeHex(hex)}`;
  const hit = tintCache.get(key);
  if (hit) return hit;

  const scale = Math.min(1, MAX_DIM / Math.max(1, img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img;
  ctx.drawImage(img, 0, 0, w, h);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = normalizeHex(hex);
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(img, 0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';

  if (tintCache.size >= MAX_CACHE) {
    const first = tintCache.keys().next().value;
    if (first) tintCache.delete(first);
  }
  tintCache.set(key, canvas);
  return canvas;
}
