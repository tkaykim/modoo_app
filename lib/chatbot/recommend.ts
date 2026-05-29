import { createClient } from '@/lib/supabase-client';
import { getCustomerPricingByPrintMethod } from '@/lib/customerPricingFetch';
import type { CustomerPricingRow } from '@/lib/customerPricingMatcher';
import { quoteMethod, bulkAdvantageThreshold } from '@/lib/printMethodPricing';
import type { PrintMethod } from '@/types/types';
import type {
  PrintMethodChoice,
  DesignType,
  ColorCount,
  PrintLocation,
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
  quantity?: QuantityOption;
  priorities?: Priority[];
  locations?: PrintLocation[];
  chosenMethod?: PrintMethodChoice;
}

// 인쇄 위치 → 가정 사이즈 버킷 (디자인이 클수록 큰 버킷)
function bucketForLocation(loc: PrintLocation, designType?: DesignType): SizeBucket {
  const isLarge = designType === '사진·실사' || designType === '일러스트·풀그래픽';
  if (loc === '등판') return isLarge ? 'A3' : 'A4';
  if (loc === '앞/가슴') return isLarge ? 'A4' : '10x10';
  if (loc === '좌측 소매' || loc === '우측 소매') return '10x10';
  return 'A4'; // 기타
}

// 디자인 제약상 가능한 인쇄방식. 사진·풀그래픽·그라데이션은 디지털(DTF/DTG)만.
export function eligibleMethodChoices(
  designType?: DesignType,
  colorCount?: ColorCount,
): PrintMethodChoice[] {
  const digitalOnly =
    designType === '사진·실사' ||
    designType === '일러스트·풀그래픽' ||
    colorCount === '그라데이션';
  if (digitalOnly) return ['DTF 전사', 'DTG 전사'];
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

// 한 방식의 (위치별 버킷 × 대표수량) 총 인쇄비. 위치 합산. 단가표 없으면 null.
function methodTotal(
  rows: CustomerPricingRow[],
  locations: PrintLocation[],
  qty: number,
  designType?: DesignType,
): number | null {
  if (!rows || rows.length === 0) return null;
  const locs = locations.length > 0 ? locations : (['앞/가슴'] as PrintLocation[]);
  let total = 0;
  for (const loc of locs) {
    const { w, h } = SIZE_CM[bucketForLocation(loc, designType)];
    const q = quoteMethod(rows, w, h, qty).total;
    if (q === null) return null;
    total += q;
  }
  return total;
}

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

// 4개 방식의 실가격 요약 (피커 칩용). eligible/최저가/분기점 포함.
export async function computeMethodQuotes(input: RecommendInput): Promise<MethodQuoteLite[]> {
  const { designType, colorCount, quantity, locations } = input;
  const rowsByKey = await loadRowsByKey();
  const qty = quantity ? REP_QTY[quantity] : 35;
  const locs = locations && locations.length > 0 ? locations : (['앞/가슴'] as PrintLocation[]);
  const eligibleSet = new Set(eligibleMethodChoices(designType, colorCount));

  // 분기점 계산용 대표 버킷 (가장 큰 면적 위치)
  const repBucket = locs
    .map((l) => bucketForLocation(l, designType))
    .sort((a, b) => SIZE_CM[b].w * SIZE_CM[b].h - SIZE_CM[a].w * SIZE_CM[a].h)[0] as SizeBucket;
  const repDim = SIZE_CM[repBucket];
  const dtfRows = rowsByKey['dtf'] ?? [];

  const quotes: MethodQuoteLite[] = ALL_CHOICES.map((choice) => {
    const key = METHOD_LABEL_TO_KEY[choice];
    const rows = rowsByKey[key] ?? [];
    const total = methodTotal(rows, locs, qty, designType);
    let thresholdNote: string | null = null;
    if (BULK_CHOICES.has(choice) && rows.length > 0 && dtfRows.length > 0) {
      const t = bulkAdvantageThreshold(rows, dtfRows, repDim.w, repDim.h);
      if (t != null) thresholdNote = `${t}벌 이상 유리`;
    }
    return {
      method: choice,
      unit: total !== null ? Math.round(total / qty) : null,
      total,
      eligible: eligibleSet.has(choice),
      cheapest: false,
      thresholdNote,
    };
  });

  // 최저가 (eligible + 산정가능 중 총액 최소)
  const priceable = quotes.filter((q) => q.eligible && q.total !== null);
  if (priceable.length > 0) {
    const min = priceable.reduce((a, b) => (a.total! <= b.total! ? a : b));
    min.cheapest = true;
  }
  return quotes;
}

// 휴리스틱 폴백 (실가격 로드 실패 시) — 제약 기반 단순 추천
export function recommendPrintMethodHeuristic(input: RecommendInput): PrintMethodChoice {
  const eligible = eligibleMethodChoices(input.designType, input.colorCount);
  if (input.priorities?.[0] === '퀄리티' && eligible.includes('자수')) return '자수';
  const isLargeQty = input.quantity === '50~100벌' || input.quantity === '100벌 이상';
  if (isLargeQty && eligible.includes('실크 나염')) return '실크 나염';
  return eligible.includes('DTF 전사') ? 'DTF 전사' : eligible[0];
}

// 실가격 기반 추천 방식 1개 (피커 뱃지용). 퀄리티 최우선이면 자수, 아니면 이 수량 최저가.
export async function recommendMethod(input: RecommendInput): Promise<PrintMethodChoice> {
  const eligible = eligibleMethodChoices(input.designType, input.colorCount);
  if (input.priorities?.[0] === '퀄리티' && eligible.includes('자수')) return '자수';
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
  const qty = input.quantity ? REP_QTY[input.quantity] : 35;
  const quotes = await computeMethodQuotes(input);
  const eligible = eligibleMethodChoices(input.designType, input.colorCount);

  const recommended =
    input.priorities?.[0] === '퀄리티' && eligible.includes('자수')
      ? '자수'
      : (quotes.find((q) => q.cheapest)?.method ?? recommendPrintMethodHeuristic(input));

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
