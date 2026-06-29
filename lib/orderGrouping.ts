import { createHash } from 'crypto';

/**
 * 주문 생성 시 order_items 그룹핑 키.
 *
 * 문제: 같은 의류 + 같은 디자인(아트워크)인데 색상/사이즈만 다른 주문이,
 * 에디터를 여러 번 거치며 서로 다른 saved_design_id 로 중복 저장되면
 * checkout 에서 saved_design_id 로만 묶던 탓에 주문상품이 분리되어 보였다.
 * (예: ORD-20260627-HBQ8NN — 동일 캔버스의 디자인이 2개로 복제되어 XL/L 이 분리)
 *
 * 해결: 그룹 키를 (product_id + 아트워크 시그니처) 로 바꾼다.
 * 아트워크 시그니처는 의류 바탕색(productColor)을 제외한 canvas_state 해시 →
 * 같은 디자인을 색상/사이즈만 바꿔 담으면 하나의 order_item(variants 배열)로 합쳐진다.
 *
 * 정상 다색상 주문(하나의 saved_design 을 여러 색/사이즈 cart 라인이 참조)은
 * 이미 같은 canvas_state 를 공유하므로 동작이 바뀌지 않는다 — 중복 디자인 케이스만 추가로 병합된다.
 */

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
  fallbackDesignId?: string | null
): string {
  const sig = artworkSignature(canvasState);
  if (sig) return `art::${productId}::${sig}`;
  return fallbackDesignId ? `id::${fallbackDesignId}` : `no-design-${productId}`;
}
