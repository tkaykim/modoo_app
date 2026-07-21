/**
 * Method + quantity aware customer pricing — Phase 2 logic.
 *
 * prod 가격 경로(canvasPricing.ts)는 여전히 DTF flat만 쓴다. 이 파일은 게이트된
 * 랩 UI(PricingLabSection / /lab/print-pricing)에서만 호출되어, 선택된 인쇄방식과
 * 수량에 따라 고객 결제가를 산정한다. 순수 함수 모음 — fetch·React 의존 없음.
 *
 * 단가표는 customer_print_method_pricing(고객가). 매칭/계산은
 * customerPricingMatcher의 회전 인식 매칭 + flat/bulk 공식을 그대로 재사용한다.
 */
import {
  type CustomerPricingRow,
  matchCustomerPricingByDimensions,
  calculatePricingAmount,
} from '@/lib/customerPricingMatcher';

export interface MethodQuote {
  /** 총액(quantity벌 합계). 단가표가 비었거나 산정 불가면 null. */
  total: number | null;
  /** total / quantity 반올림 — 화면 "장당" 표기용. */
  unitEffective: number | null;
  pricingModel: 'flat' | 'bulk' | null;
  matchedSize: string | null;
  matchType: 'exact' | 'fallback' | 'none';
}

const EMPTY_QUOTE: MethodQuote = {
  total: null,
  unitEffective: null,
  pricingModel: null,
  matchedSize: null,
  matchType: 'none',
};

/**
 * 나염(실크스크린) 고객 견적 마진 — 장당 1회 가산 (대표 확정 2026-07-21).
 * customer_print_method_pricing의 나염 base_price는 원가성이라, 고객 노출 견적엔
 * 반드시 이 마진을 더한다. flat(DTF/DTG)은 단가에 마진이 이미 포함돼 가산하지 않는다.
 * 워커 AI 답변초안(modoo-cs-triage) 프롬프트의 나염 마진 규칙과 같은 값이어야 한다.
 */
export const SCREEN_PRINT_MARGIN_PER_PIECE = 3000;

/**
 * 방식별 고객가 정책 보정 — 현재는 나염 장당 마진만.
 * quoteMethod(원가성 raw)를 고객 노출 견적으로 바꿀 때 반드시 통과시킨다.
 */
export function applyMethodPricingPolicy(
  methodKey: string,
  quote: MethodQuote,
  quantity: number,
): MethodQuote {
  if (methodKey !== 'screen_printing' || quote.total === null) return quote;
  const total = quote.total + SCREEN_PRINT_MARGIN_PER_PIECE * quantity;
  return { ...quote, total, unitEffective: Math.round(total / quantity) };
}

/**
 * 도안 크기에 맞는 단가 행을 고른다 (flat·bulk 공통).
 * 1) 회전 인식 매칭 → 가장 빠듯한 행
 * 2) 실패 시 'A3' 라벨 행 → 그래도 없으면 가장 큰 면적 행 (절대 차단 금지 정책)
 */
function pickRow(
  rows: CustomerPricingRow[],
  widthCm: number,
  heightCm: number,
): { row: CustomerPricingRow; matchType: 'exact' | 'fallback' } | null {
  const matched = matchCustomerPricingByDimensions(rows, widthCm, heightCm);
  if (matched) return { row: matched, matchType: 'exact' };

  const active = rows.filter((r) => r.is_active !== false);
  const a3 = active.find((r) => r.size === 'A3');
  if (a3) return { row: a3, matchType: 'fallback' };

  const biggest = active
    .filter((r) => r.max_width_cm !== null && r.max_height_cm !== null)
    .sort(
      (a, b) =>
        (b.max_width_cm! * b.max_height_cm!) - (a.max_width_cm! * a.max_height_cm!),
    )[0];
  if (biggest) return { row: biggest, matchType: 'fallback' };

  return null;
}

/**
 * 한 인쇄방식의 단가표(rows)로 (도안 크기 × 수량) 총액을 낸다.
 */
export function quoteMethod(
  rows: CustomerPricingRow[],
  widthCm: number,
  heightCm: number,
  quantity: number,
): MethodQuote {
  if (!rows || rows.length === 0) return EMPTY_QUOTE;
  if (!Number.isFinite(quantity) || quantity <= 0) return EMPTY_QUOTE;

  const picked = pickRow(rows, widthCm, heightCm);
  if (!picked) return EMPTY_QUOTE;

  const total = calculatePricingAmount(picked.row, quantity);
  if (total === null) return EMPTY_QUOTE;

  return {
    total,
    unitEffective: Math.round(total / quantity),
    pricingModel: picked.row.pricing_model,
    matchedSize: picked.row.size,
    matchType: picked.matchType,
  };
}

export interface RankedQuote extends MethodQuote {
  methodKey: string;
}

export interface MethodRanking {
  /** 총액 오름차순 (산정 불가 행은 뒤로). */
  quotes: RankedQuote[];
  cheapest: RankedQuote | null;
  /** 최저가가 DTF보다 얼마나 싼지(원). DTF가 없거나 최저가면 0. */
  savingsVsDtf: number;
}

/**
 * 여러 인쇄방식을 같은 도안·수량으로 비교해 최저가를 가린다 (정책 B: 수량 기반 추천).
 */
export function rankMethods(
  rowsByKey: Record<string, CustomerPricingRow[]>,
  methodKeys: string[],
  widthCm: number,
  heightCm: number,
  quantity: number,
): MethodRanking {
  const quotes: RankedQuote[] = methodKeys.map((methodKey) => ({
    methodKey,
    ...applyMethodPricingPolicy(
      methodKey,
      quoteMethod(rowsByKey[methodKey] ?? [], widthCm, heightCm, quantity),
      quantity,
    ),
  }));

  const priceable = quotes.filter((q): q is RankedQuote & { total: number } => q.total !== null);
  priceable.sort((a, b) => a.total - b.total);

  const cheapest = priceable[0] ?? null;
  const dtf = quotes.find((q) => q.methodKey === 'dtf');
  const savingsVsDtf =
    cheapest && dtf && dtf.total !== null && cheapest.total !== null
      ? Math.max(0, dtf.total - cheapest.total)
      : 0;

  // 산정 가능한 것 먼저(오름차순), 불가한 것 뒤로 — 입력 순서 보존하며 안정 정렬.
  const orderedKeys = [
    ...priceable.map((q) => q.methodKey),
    ...quotes.filter((q) => q.total === null).map((q) => q.methodKey),
  ];
  const ordered = orderedKeys
    .map((k) => quotes.find((q) => q.methodKey === k))
    .filter((q): q is RankedQuote => Boolean(q));

  return { quotes: ordered, cheapest, savingsVsDtf };
}

/**
 * bulk 방식이 DTF보다 싸지기 시작하는 최소 수량(분기점)을 찾는다.
 * 칩 문구 "N벌 이상 유리"에 쓰인다.
 *
 * bulkRows(예: 나염)와 dtfRows를 같은 도안으로 1..maxQuantity까지 비교해
 * 처음으로 bulk총액 ≤ dtf총액이 되는 수량을 반환. 끝까지 없으면 null.
 */
export function bulkAdvantageThreshold(
  bulkRows: CustomerPricingRow[],
  dtfRows: CustomerPricingRow[],
  widthCm: number,
  heightCm: number,
  maxQuantity = 1000,
  /** 묶음방식 장당 가산액(예: 나염 마진 SCREEN_PRINT_MARGIN_PER_PIECE). 비교 공정성 유지용. */
  bulkMarginPerPiece = 0,
): number | null {
  if (!bulkRows?.length || !dtfRows?.length) return null;

  for (let q = 1; q <= maxQuantity; q += 1) {
    const bulk = quoteMethod(bulkRows, widthCm, heightCm, q).total;
    const dtf = quoteMethod(dtfRows, widthCm, heightCm, q).total;
    if (bulk === null || dtf === null) continue;
    if (bulk + bulkMarginPerPiece * q <= dtf) return q;
  }
  return null;
}
