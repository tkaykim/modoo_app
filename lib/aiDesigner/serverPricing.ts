/**
 * AI 디자이너 — 서버측 DTF 가격 산정.
 *
 * 프로덕션 가격 경로(app/utils/canvasPricing.ts)를 서버에서 미러링한다:
 *   면별 도안 combined bbox(mm) → customer_print_method_pricing(DTF) 회전 인식
 *   매칭 → unit_price. 매칭 실패/페치 실패 시 DEFAULT_PRINT_PRICING dtf 폴백.
 * price_per_item = products.base_price + Σ(면별 도안 가격)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type CustomerPricingRow,
  pickUnitPriceForArtwork,
} from '@/lib/customerPricingMatcher';
import { DEFAULT_PRINT_PRICING } from '@/lib/printPricingConfig';

function fallbackDtfPrice(widthMm: number, heightMm: number): number {
  const sizes = DEFAULT_PRINT_PRICING.dtf.sizes as Record<string, number>;
  if (widthMm <= 100 && heightMm <= 100) return sizes['10x10'];
  if (widthMm <= 210 && heightMm <= 297) return sizes['A4'];
  return sizes['A3'];
}

async function fetchDtfRows(admin: SupabaseClient): Promise<CustomerPricingRow[]> {
  const { data: methods } = await admin
    .from('print_methods')
    .select('id, key')
    .eq('key', 'dtf')
    .limit(1);
  const dtfId = methods?.[0]?.id as string | undefined;
  if (!dtfId) return [];
  const { data } = await admin
    .from('customer_print_method_pricing')
    .select(
      'id, print_method_id, size, max_width_cm, max_height_cm, pricing_model, unit_price, base_price, base_quantity, additional_price_per_piece, is_active'
    )
    .eq('print_method_id', dtfId)
    .eq('is_active', true);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    print_method_id: row.print_method_id as string,
    size: row.size as string,
    max_width_cm: row.max_width_cm !== null ? Number(row.max_width_cm) : null,
    max_height_cm: row.max_height_cm !== null ? Number(row.max_height_cm) : null,
    pricing_model: row.pricing_model as 'flat' | 'bulk',
    unit_price: row.unit_price !== null ? Number(row.unit_price) : null,
    base_price: row.base_price !== null ? Number(row.base_price) : null,
    base_quantity: row.base_quantity !== null ? Number(row.base_quantity) : null,
    additional_price_per_piece:
      row.additional_price_per_piece !== null ? Number(row.additional_price_per_piece) : null,
    is_active: row.is_active as boolean,
  }));
}

/** 면별 combined bbox 목록(mm) → 장당 추가 인쇄비 합. */
export async function computePrintSurcharge(
  admin: SupabaseClient,
  sideBoxes: Array<{ widthMm: number; heightMm: number }>
): Promise<number> {
  if (sideBoxes.length === 0) return 0;
  let rows: CustomerPricingRow[] = [];
  try {
    rows = await fetchDtfRows(admin);
  } catch {
    rows = [];
  }
  let total = 0;
  for (const box of sideBoxes) {
    let price = 0;
    if (rows.length > 0) {
      const picked = pickUnitPriceForArtwork(rows, box.widthMm / 10, box.heightMm / 10);
      if (picked) price = picked.unitPrice;
    }
    if (price <= 0) price = fallbackDtfPrice(box.widthMm, box.heightMm);
    total += price;
  }
  return total;
}
