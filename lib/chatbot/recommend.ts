import { createClient } from '@/lib/supabase-client';
import { getCustomerPricingByPrintMethod } from '@/lib/customerPricingFetch';
import type { CustomerPricingRow } from '@/lib/customerPricingMatcher';
import { quoteMethod } from '@/lib/printMethodPricing';
import type { PrintMethod } from '@/types/types';
import type {
  PrintMethodChoice,
  DesignType,
  ColorCount,
  DesignSizeCounts,
  QuantityOption,
  Priority,
  RecommendationResult,
  MethodQuoteLite,
} from './types';

// 고객 노출용 인쇄방식 라벨 ↔ 내부 pricing key 매핑
export const METHOD_LABEL_TO_KEY: Record<PrintMethodChoice, PrintMethod> = {
  '실크 나염': 'screen_printing',
  'DTF 전사': 'dtf',
  'DTG 전사': 'dtg',
  '자수': 'embroidery',
};
export const METHOD_KEY_TO_LABEL: Partial<Record<PrintMethod, PrintMethodChoice>> = {
  screen_printing: '실크 나염',
  dtf: 'DTF 전사',
  dtg: 'DTG 전사',
  embroidery: '자수',
};

const ALL_CHOICES: PrintMethodChoice[] = ['실크 나염', 'DTF 전사', 'DTG 전사', '자수'];
const BULK_CHOICES = new Set<PrintMethodChoice>(['실크 나염', '자수']);

type SizeBucket = '10x10' | 'A4' | 'A3';
const SIZE_CM: Record<SizeBucket, { w: number; h: number }> = {
  '10x10': { w: 10, h: 10 },
  A4: { w: 21, h: 29.7 },
  A3: { w: 29.7, h: 42 },
};

// 수량 구간 → 견적 대표 수량
const REP_QTY: Record<QuantityOption, number> = {
  '1~20벌': 15,
  '21~50벌': 35,
  '50~100벌': 75,
  '100벌 이상': 100,
};

export interface RecommendInput {
  designType?: DesignType;
  colorCount?: ColorCount;
  quantity?: QuantityOption;     // (구버전) 구간 — 폴백용
  quantityExact?: number;        // 직접 입력 수량 (있으면 견적에 이 값 사용)
  priorities?: Priority[];
  designSizes?: DesignSizeCounts;   // 크기별 디자인 개수 (견적 산정)
  chosenMethod?: PrintMethodChoice;
}

const SIZE_BUCKETS: SizeBucket[] = ['10x10', 'A4', 'A3'];

// 디자인 제약상 가능한 인쇄방식.
// 사진·풀그래픽·그라데이션은 풀컬러라 나염(도수 한계)은 제외하지만,
// 자수는 풀컬러 일러스트도 표현 가능한 경우가 있어 항상 선택지로 남긴다(DTF/DTG/자수).
export function eligibleMethodChoices(
  designType?: DesignType,
  colorCount?: ColorCount,
): PrintMethodChoice[] {
  const digitalOnly =
    designType === '사진·그래픽' ||
    colorCount === '그라데이션';
  if (digitalOnly) return ['DTF 전사', 'DTG 전사', '자수'];
  return ['실크 나염', 'DTF 전사', 'DTG 전사', '자수'];
}

// 고객앱 실가격 단가표를 key별로 로드 (print_methods key↔id + customer_print_method_pricing). 모듈 캐시.
let _rowsByKeyPromise: Promise<Record<string, CustomerPricingRow[]>> | null = null;
export async function loadRowsByKey(): Promise<Record<string, CustomerPricingRow[]>> {
  if (_rowsByKeyPromise) return _rowsByKeyPromise;
  _rowsByKeyPromise = (async () => {
    try {
      const supabase = createClient();
      const [{ data: methods, error }, pricingMap] = await Promise.all([
        supabase.from('print_methods').select('id, key'),
        getCustomerPricingByPrintMethod(),
      ]);
      if (error) throw error;
      const byKey: Record<string, CustomerPricingRow[]> = {};
      for (const m of methods ?? []) {
        const key = m.key as string;
        const id = m.id as string;
        if (key && id) byKey[key] = pricingMap.get(id) ?? [];
      }
      return byKey;
    } catch {
      return {};
    }
  })();
  return _rowsByKeyPromise;
}

// 색상 도수 배수 (bulk 방식만 적용). 1색=1배, 2색=2배... 4색 이상=4배.
function colorMultiplier(colorCount?: ColorCount): number {
  switch (colorCount) {
    case '2색': return 2;
    case '3색': return 3;
    case '4색 이상': return 4;
    default: return 1; // 1색 / 그라데이션 / 미지정
  }
}

// 한 방식의 (크기별 개수 × 대표수량) 총 인쇄비. 크기 버킷 합산. 단가표 없으면 null.
// bulk(나염/자수/아플리케)은 색상 도수만큼 배수, flat(DTF/DTG)은 색 무관.
function methodTotal(
  rows: CustomerPricingRow[],
  sizes: DesignSizeCounts | undefined,
  qty: number,
  colorMult: number,
): number | null {
  if (!rows || rows.length === 0) return null;
  let total = 0;
  let any = false;
  for (const bucket of SIZE_BUCKETS) {
    const count = sizes?.[bucket] ?? 0;
    if (count <= 0) continue;
    const { w, h } = SIZE_CM[bucket];
    const q = quoteMethod(rows, w, h, qty);
    if (q.total === null) return null;
    const factor = q.pricingModel === 'bulk' ? colorMult : 1;
    total += q.total * factor * count;
    any = true;
  }
  return any ? total : null;
}

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

// 4개 방식의 실가격 요약 (피커 칩용). eligible/최저가/분기점 포함.
export async function computeMethodQuotes(input: RecommendInput): Promise<MethodQuoteLite[]> {
  const { designType, colorCount, quantity, quantityExact, designSizes } = input;
  const rowsByKey = await loadRowsByKey();
  const qty = quantityExact && quantityExact > 0 ? quantityExact : (quantity ? REP_QTY[quantity] : 35);
  const colorMult = colorMultiplier(colorCount);
  const eligibleSet = new Set(eligibleMethodChoices(designType, colorCount));

  // 분기점 계산용 대표 버킷 (입력된 것 중 가장 큰 면적)
  const repBucket: SizeBucket =
    (['A3', 'A4', '10x10'] as SizeBucket[]).find((b) => (designSizes?.[b] ?? 0) > 0) ?? 'A4';
  const repDim = SIZE_CM[repBucket];
  const dtfRows = rowsByKey['dtf'] ?? [];
  // 현재 수량 기준 DTF 총액 (소량 묶음방식 비교용)
  const dtfTotalAtQty = methodTotal(dtfRows, designSizes, qty, colorMult);

  const quotes: MethodQuoteLite[] = ALL_CHOICES.map((choice) => {
    const key = METHOD_LABEL_TO_KEY[choice];
    const rows = rowsByKey[key] ?? [];
    const total = methodTotal(rows, designSizes, qty, colorMult);
    let thresholdNote: string | null = null;
    let smallBulkNote = false;
    if (BULK_CHOICES.has(choice) && rows.length > 0 && dtfRows.length > 0) {
      // 색상 도수 배수를 반영한 "N벌 이상 유리" 분기점 (bulk×도수 ≤ DTF)
      let t: number | null = null;
      for (let q = 1; q <= 1000; q += 1) {
        const bulk = quoteMethod(rows, repDim.w, repDim.h, q).total;
        const dtf = quoteMethod(dtfRows, repDim.w, repDim.h, q).total;
        if (bulk == null || dtf == null) continue;
        if (bulk * colorMult <= dtf) { t = q; break; }
      }
      if (t != null) thresholdNote = `${t}벌 이상 유리`;
      // 이 수량에선 묶음방식이 DTF보다 비쌈 → 소량 안내
      if (total != null && dtfTotalAtQty != null && total > dtfTotalAtQty) {
        smallBulkNote = true;
      }
    }
    return {
      method: choice,
      unit: total !== null ? Math.round(total / qty) : null,
      total,
      eligible: eligibleSet.has(choice),
      cheapest: false,
      thresholdNote,
      smallBulkNote,
    };
  });

  // 최저가 (eligible + 산정가능 중 총액 최소).
  // - 자수는 프리미엄/특수라 사용자가 직접 고르지 않는 한 자동 추천하지 않음(항상 제외).
  // - 나염 등 bulk는 30벌 미만이면 base_price 부담이 커서 추천 제외.
  const priceable = quotes.filter((q) => q.eligible && q.total !== null);
  const BULK_MIN_QTY = 30;
  const recommendable = priceable.filter((q) =>
    q.method !== '자수' && (qty >= BULK_MIN_QTY || !BULK_CHOICES.has(q.method)),
  );
  // 자수만 남는 극단적 경우엔 자수 제외한 산정가능분으로 폴백(그래도 없으면 전체).
  const pool =
    recommendable.length > 0
      ? recommendable
      : priceable.filter((q) => q.method !== '자수').length > 0
        ? priceable.filter((q) => q.method !== '자수')
        : priceable;
  if (pool.length > 0) {
    // 동률이면 먼저 나온 방식(배열 순서: 나염 < DTF < DTG < 자수) 유지 — <= 로 앞쪽 우선.
    const min = pool.reduce((a, b) => (a.total! <= b.total! ? a : b));
    min.cheapest = true;
  }
  return quotes;
}

// 휴리스틱 폴백 (실가격 로드 실패 시) — 제약 기반 단순 추천
export function recommendPrintMethodHeuristic(input: RecommendInput): PrintMethodChoice {
  const eligible = eligibleMethodChoices(input.designType, input.colorCount);
  // 자수는 자동 추천하지 않음(사용자 선택 전용).
  const isLargeQty = input.quantity === '50~100벌' || input.quantity === '100벌 이상';
  if (isLargeQty && eligible.includes('실크 나염')) return '실크 나염';
  return eligible.includes('DTF 전사') ? 'DTF 전사' : (eligible.find((m) => m !== '자수') ?? eligible[0]);
}

// 실가격 기반 추천 방식 1개 (피커 뱃지용). 퀄리티 최우선이면 자수, 아니면 이 수량 최저가.
export async function recommendMethod(input: RecommendInput): Promise<PrintMethodChoice> {
  // 자수는 자동 추천하지 않음 — computeMethodQuotes의 cheapest가 자수를 배제함.
  const quotes = await computeMethodQuotes(input);
  const cheapest = quotes.find((q) => q.cheapest);
  if (cheapest) return cheapest.method;
  return recommendPrintMethodHeuristic(input);
}

/**
 * 추천 카드용 결과 조립. 고객이 직접 고른 방식(chosenMethod)이 있으면 그 방식으로 견적,
 * 없으면 추천 방식. 실가격(getCustomerPricingByPrintMethod) 기반 총액/장당/절약액.
 */
export async function buildRecommendation(input: RecommendInput): Promise<RecommendationResult> {
  const qty = input.quantityExact && input.quantityExact > 0 ? input.quantityExact : (input.quantity ? REP_QTY[input.quantity] : 35);
  const quotes = await computeMethodQuotes(input);
  const eligible = eligibleMethodChoices(input.designType, input.colorCount);

  // 자수는 자동 추천하지 않음(cheapest가 이미 자수 배제). 사용자가 직접 고른 경우만 자수.
  const recommended = quotes.find((q) => q.cheapest)?.method ?? recommendPrintMethodHeuristic(input);

  const method = input.chosenMethod ?? recommended;
  const chosenQuote = quotes.find((q) => q.method === method) ?? null;
  const overrode = input.chosenMethod && input.chosenMethod !== recommended;

  // DTF 대비 절약 (선택 방식이 DTF가 아니고 더 쌀 때)
  const dtfQuote = quotes.find((q) => q.method === 'DTF 전사');
  let savingsNote: string | null = null;
  if (
    chosenQuote?.total != null &&
    dtfQuote?.total != null &&
    method !== 'DTF 전사' &&
    chosenQuote.total < dtfQuote.total
  ) {
    savingsNote = `${qty}벌 기준 DTF보다 ${won(dtfQuote.total - chosenQuote.total)} 절약`;
  }

  let methodReason: string;
  if (overrode) {
    methodReason = `${method}으로 진행해 드릴게요!`;
  } else if (method === '자수') {
    methodReason = '퀄리티를 가장 중요하게 보셔서 고급스러운 자수를 추천드려요.';
  } else if (chosenQuote?.cheapest) {
    methodReason = `${qty}벌 기준 가장 합리적인 방식이에요.`;
  } else {
    methodReason = '조건에 맞춰 추천드린 방식이에요.';
  }

  return {
    method,
    methodReason,
    unitPrice: chosenQuote?.unit ?? null,
    totalPrice: chosenQuote?.total ?? null,
    quantity: qty,
    savingsNote,
    disclaimer:
      chosenQuote?.total == null
        ? '정확한 단가는 담당자가 안내드려요.'
        : '도안 크기 가정 기준 예상 인쇄비예요. 제품 단가는 별도이며, 정확한 견적은 담당자가 안내드려요.',
  };
}
