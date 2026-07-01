import { createHash } from 'crypto';

/**
 * 주문 생성 시 order_items 그룹핑 키.
 *
 * 문제: 같은 의류 + 같은 디자인(아트워크)인데 색상/사이즈만 다른 주문이,
 * 에디터를 여러 번 거치며 서로 다른 saved_design_id 로 중복 저장되면
 * checkout 에서 saved_design_id 로만 묶던 탓에 주문상품이 분리되어 보였다.
 * (예: ORD-20260627-HBQ8NN — 동일 캔버스의 디자인이 2개로 복제되어 XL/L 이 분리)
 *
 * 해결: 그룹 키를 (product_id + 아트워크 시그니처 + 의류색) 로 한다.
 * 아트워크 시그니처는 의류 바탕색(productColor)을 제외한 canvas_state 해시라,
 * 같은 디자인의 중복 saved_design(서로 다른 design_id)은 하나로 합쳐진다.
 *
 * ⚠️ 의류색(productColor)은 반드시 키에 포함한다(2026-06-30 수정).
 * order_item 하나는 캔버스·목업·색상이 단일(variants 는 사이즈 차원)이라,
 * 색을 키에서 빼면 서로 다른 색(블랙/화이트/버건디)이 한 상품으로 과병합되고
 * 시안수정 저장 시 전 variant 색이 한 색으로 뭉개진다(ORD-20260630-S3H58R 사고).
 * 따라서 "같은 제품+같은 아트워크+같은 색" 만 병합하고, 색이 다르면 분리한다.
 */

/** canvas_state 의 각 side 에서 의류 바탕색(productColor)을 하나 추출(폴백용). */
export function extractProductColor(canvasState: unknown): string {
  if (!canvasState || typeof canvasState !== 'object') return '';
  for (const side of Object.values(canvasState as Record<string, unknown>)) {
    const s = typeof side === 'string'
      ? (() => { try { return JSON.parse(side); } catch { return null; } })()
      : side;
    const pc = s && typeof s === 'object' ? (s as Record<string, unknown>).productColor : undefined;
    if (typeof pc === 'string' && pc) return pc;
  }
  return '';
}

function stripProductColor(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripProductColor);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // productColor(의류 바탕색)는 variant 차원이므로 시그니처에서 제외
      if (k === 'productColor') continue;
      out[k] = stripProductColor(v);
    }
    return out;
  }
  return value;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k])).join(',') + '}';
  }
  return JSON.stringify(value ?? null);
}

/** 의류 바탕색을 제외한 canvas_state 의 안정적 해시(아트워크 시그니처). */
export function artworkSignature(canvasState: unknown): string {
  try {
    const sig = stableStringify(stripProductColor(canvasState ?? {}));
    if (!sig || sig === '{}' || sig === 'null') return '';
    return createHash('md5').update(sig).digest('hex');
  } catch {
    return '';
  }
}

/**
 * order_items 그룹 키.
 * 아트워크 시그니처가 있으면 (product_id + 시그니처)로 묶고,
 * 빈 캔버스/실패 시엔 기존 동작(saved_design_id 또는 product)으로 폴백한다.
 */
export function orderItemGroupKey(
  productId: string,
  canvasState: unknown,
  fallbackDesignId?: string | null,
  productColor?: string | null
): string {
  const sig = artworkSignature(canvasState);
  // 의류색은 항상 키에 포함(색 다르면 별도 order_item). 명시값 우선, 없으면 canvas_state 에서 추출.
  const color = String(productColor || extractProductColor(canvasState) || '').toLowerCase();
  const base = sig
    ? `art::${productId}::${sig}`
    : (fallbackDesignId ? `id::${fallbackDesignId}` : `no-design-${productId}`);
  return `${base}::c=${color}`;
}
