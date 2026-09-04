/**
 * 과잠(바시티 자켓) 슬롯형 패키지 가격 — 2026-09-04 대표 확정.
 *
 * 장당가 = 기본가(30~49장, 원단·봉제·기본 자수 2곳 포함)
 *        + 수량 구간 가산/할인
 *        + 켠 슬롯의 추가금(등판 대형 레터링·등판 대형 엠블럼)
 *        + 보풀(쉐닐) 자수 업그레이드 × 슬롯 수
 *        + 개인별 다른 학번이면 장당 가산
 *
 * 숫자는 products.configuration.varsityPricing 으로 상품별 덮어쓸 수 있다(resolveVarsityPricing).
 * 클라이언트 견적 패널과 서버 주문 경로가 같은 함수를 쓴다.
 */

export type VarsitySurchargeKey = 'backLettering' | 'backEmblem';

export interface VarsityQuantityTier {
  min: number;
  max: number | null;
  delta: number;
  label: string;
}

export interface VarsityPricingRule {
  /** 30~49장 기준 장당 기본가 */
  basePrice: number;
  /** 최소 주문 수량 */
  moq: number;
  tiers: VarsityQuantityTier[];
  slotSurcharges: Record<VarsitySurchargeKey, number>;
  /** 보풀(쉐닐) 자수 업그레이드, 슬롯당 */
  chenilleSurcharge: number;
  /** 개인별 다른 학번, 장당 */
  individualNumberSurcharge: number;
  leadTime: { normalWeeks: number; peakWeeks: number; peakMonths: number[] };
  includedNote: string;
}

export const DEFAULT_VARSITY_PRICING: VarsityPricingRule = {
  basePrice: 54000,
  moq: 10,
  tiers: [
    { min: 1, max: 9, delta: 5000, label: '10장 미만' },
    { min: 10, max: 19, delta: 5000, label: '10~19장' },
    { min: 20, max: 29, delta: 2000, label: '20~29장' },
    { min: 30, max: 49, delta: 0, label: '30~49장' },
    { min: 50, max: null, delta: -2000, label: '50장 이상' },
  ],
  slotSurcharges: { backLettering: 6000, backEmblem: 6000 },
  chenilleSurcharge: 2000,
  individualNumberSurcharge: 3000,
  leadTime: { normalWeeks: 3, peakWeeks: 4, peakMonths: [2, 3, 4, 5, 6, 9, 10, 11, 12] },
  includedNote: '원단·봉제와 기본 자수 2곳(가슴 로고·이니셜, 소매 이니셜·학번 1종) 포함',
};

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** products.configuration.varsityPricing(JSON) 덮어쓰기 병합. 잘못된 값은 무시한다. */
export function resolveVarsityPricing(override?: unknown): VarsityPricingRule {
  const base = DEFAULT_VARSITY_PRICING;
  if (!override || typeof override !== 'object') return base;
  const o = override as Record<string, unknown>;
  const surch = (o.slotSurcharges && typeof o.slotSurcharges === 'object' ? o.slotSurcharges : {}) as Record<string, unknown>;
  const tiers = Array.isArray(o.tiers)
    ? (o.tiers as unknown[])
        .map((t) => {
          const r = t as Record<string, unknown>;
          const min = num(r.min);
          const delta = num(r.delta);
          if (min === null || delta === null) return null;
          const max = r.max === null ? null : num(r.max);
          return { min, max, delta, label: typeof r.label === 'string' ? r.label : `${min}장~` };
        })
        .filter((t): t is VarsityQuantityTier => !!t)
    : null;
  return {
    basePrice: num(o.basePrice) ?? base.basePrice,
    moq: num(o.moq) ?? base.moq,
    tiers: tiers && tiers.length > 0 ? tiers : base.tiers,
    slotSurcharges: {
      backLettering: num(surch.backLettering) ?? base.slotSurcharges.backLettering,
      backEmblem: num(surch.backEmblem) ?? base.slotSurcharges.backEmblem,
    },
    chenilleSurcharge: num(o.chenilleSurcharge) ?? base.chenilleSurcharge,
    individualNumberSurcharge: num(o.individualNumberSurcharge) ?? base.individualNumberSurcharge,
    leadTime: base.leadTime,
    includedNote: typeof o.includedNote === 'string' ? o.includedNote : base.includedNote,
  };
}

export interface VarsityQuoteInput {
  quantity: number;
  surchargeKeys: VarsitySurchargeKey[];
  chenilleCount: number;
  individualNumbers: boolean;
}

export interface VarsityQuoteLine {
  kind: 'base' | 'tier' | 'slot' | 'upgrade' | 'personalization';
  label: string;
  amount: number;
}

export interface VarsityQuote {
  quantity: number;
  unitPrice: number;
  total: number;
  lines: VarsityQuoteLine[];
  tier: VarsityQuantityTier;
  belowMoq: boolean;
  /** 다음 구간까지 몇 장 더 모으면 장당 얼마가 되는지 */
  nextTier: { quantity: number; unitPrice: number; label: string } | null;
  leadTimeWeeks: number;
}

export function findTier(rule: VarsityPricingRule, quantity: number): VarsityQuantityTier {
  const q = Math.max(0, quantity);
  return (
    rule.tiers.find((t) => q >= t.min && (t.max === null || q <= t.max)) ??
    rule.tiers[rule.tiers.length - 1]
  );
}

export function isPeakMonth(rule: VarsityPricingRule, date: Date = new Date()): boolean {
  return rule.leadTime.peakMonths.includes(date.getMonth() + 1);
}

const SURCHARGE_LABELS: Record<VarsitySurchargeKey, string> = {
  backLettering: '등판 대형 레터링',
  backEmblem: '등판 대형 엠블럼',
};

export function quoteVarsity(
  rule: VarsityPricingRule,
  input: VarsityQuoteInput,
  now: Date = new Date()
): VarsityQuote {
  const quantity = Math.max(0, Math.floor(input.quantity || 0));
  const tier = findTier(rule, quantity);
  const lines: VarsityQuoteLine[] = [{ kind: 'base', label: '기본가(기본 자수 2곳 포함)', amount: rule.basePrice }];
  if (tier.delta !== 0) lines.push({ kind: 'tier', label: `수량 ${tier.label}`, amount: tier.delta });
  for (const key of Array.from(new Set(input.surchargeKeys))) {
    lines.push({ kind: 'slot', label: SURCHARGE_LABELS[key], amount: rule.slotSurcharges[key] });
  }
  if (input.chenilleCount > 0) {
    lines.push({
      kind: 'upgrade',
      label: `보풀(쉐닐) 자수 × ${input.chenilleCount}`,
      amount: rule.chenilleSurcharge * input.chenilleCount,
    });
  }
  if (input.individualNumbers) {
    lines.push({ kind: 'personalization', label: '개인별 학번 자수', amount: rule.individualNumberSurcharge });
  }
  const unitPrice = lines.reduce((s, l) => s + l.amount, 0);

  const idx = rule.tiers.indexOf(tier);
  const next = idx >= 0 && idx < rule.tiers.length - 1 ? rule.tiers[idx + 1] : null;
  const nextTier = next
    ? { quantity: next.min, unitPrice: unitPrice - tier.delta + next.delta, label: next.label }
    : null;

  return {
    quantity,
    unitPrice,
    total: unitPrice * quantity,
    lines,
    tier,
    belowMoq: quantity > 0 && quantity < rule.moq,
    nextTier,
    leadTimeWeeks: isPeakMonth(rule, now) ? rule.leadTime.peakWeeks : rule.leadTime.normalWeeks,
  };
}
