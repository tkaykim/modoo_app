/**
 * Fetches customer-facing print pricing rows from `customer_print_method_pricing`.
 *
 * 가격표 SSOT (Single Source of Truth) — 관리자가 admin에서 수정하면 5분 TTL
 * 안에 손님 앱에도 반영. RLS 정책 "Anyone read active customer pricing"이
 * 비로그인 사용자도 활성 행 SELECT를 허용함을 확인 완료.
 *
 * Read-only. 절대 throw 하지 않는다 — fetch 실패해도 null/[] 반환해서
 * 호출자가 hardcoded fallback으로 자연스럽게 떨어지게.
 */
import { createClient } from '@/lib/supabase-client';
import type { CustomerPricingRow } from '@/lib/customerPricingMatcher';

const TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  fetchedAt: number;
  byPrintMethodId: Map<string, CustomerPricingRow[]>;
}

let _cache: CacheEntry | null = null;
let _inflight: Promise<CacheEntry> | null = null;

async function fetchAll(): Promise<CacheEntry> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('customer_print_method_pricing')
      .select('id, print_method_id, size, max_width_cm, max_height_cm, pricing_model, unit_price, base_price, base_quantity, additional_price_per_piece, is_active')
      .eq('is_active', true);

    if (error) {
      console.warn('[customerPricing] fetch failed, falling back to legacy', error);
      return { fetchedAt: Date.now(), byPrintMethodId: new Map() };
    }

    const byPrintMethodId = new Map<string, CustomerPricingRow[]>();
    for (const row of data ?? []) {
      const typed: CustomerPricingRow = {
        id: row.id as string,
        print_method_id: row.print_method_id as string,
        size: row.size as string,
        max_width_cm: row.max_width_cm !== null ? Number(row.max_width_cm) : null,
        max_height_cm: row.max_height_cm !== null ? Number(row.max_height_cm) : null,
        pricing_model: row.pricing_model as 'flat' | 'bulk',
        unit_price: row.unit_price !== null ? Number(row.unit_price) : null,
        base_price: row.base_price !== null ? Number(row.base_price) : null,
        base_quantity: row.base_quantity !== null ? Number(row.base_quantity) : null,
        additional_price_per_piece: row.additional_price_per_piece !== null ? Number(row.additional_price_per_piece) : null,
        is_active: row.is_active as boolean,
      };
      const list = byPrintMethodId.get(typed.print_method_id) ?? [];
      list.push(typed);
      byPrintMethodId.set(typed.print_method_id, list);
    }

    return { fetchedAt: Date.now(), byPrintMethodId };
  } catch (e) {
    console.warn('[customerPricing] fetch threw, falling back to legacy', e);
    return { fetchedAt: Date.now(), byPrintMethodId: new Map() };
  }
}

/**
 * 활성 단가 행을 print_method_id별 Map으로 반환. 5분 TTL 메모리 캐시.
 * 동시 호출은 _inflight로 1회만 실행.
 */
export async function getCustomerPricingByPrintMethod(): Promise<Map<string, CustomerPricingRow[]>> {
  const now = Date.now();
  if (_cache && now - _cache.fetchedAt < TTL_MS) {
    return _cache.byPrintMethodId;
  }

  if (_inflight) {
    const entry = await _inflight;
    return entry.byPrintMethodId;
  }

  _inflight = fetchAll();
  try {
    _cache = await _inflight;
    return _cache.byPrintMethodId;
  } finally {
    _inflight = null;
  }
}

/**
 * 특정 print_method (예: 'dtf')에 대응하는 행만 반환.
 * print_method.key → print_method.id 매핑이 필요하므로 호출자가
 * printMethodId를 알고 있어야 한다 (보통 product_print_methods로 페치된 값).
 */
export async function getCustomerPricingForPrintMethodId(
  printMethodId: string,
): Promise<CustomerPricingRow[]> {
  if (!printMethodId) return [];
  const map = await getCustomerPricingByPrintMethod();
  return map.get(printMethodId) ?? [];
}

/** admin에서 가격표 수정 후 즉시 반영 필요 시. 현재 admin → app 신호는 없으니 5분 기다림. */
export function invalidateCustomerPricingCache(): void {
  _cache = null;
}
