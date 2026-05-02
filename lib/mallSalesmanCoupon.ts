// 영업사원이 소유한 mall로부터 받은 자동 적용 쿠폰을 sessionStorage로 핸드오프
// → 고객이 mall에서 장바구니에 담은 후 checkout으로 이동했을 때 자동 적용

const KEY = 'mall_auto_salesman_coupon';

export interface MallAutoCoupon {
  code: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  source_mall_id: string;
  source_mall_name: string;
  applied_at: string; // ISO
}

export function setMallAutoCoupon(c: MallAutoCoupon): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(c));
  } catch (e) {
    console.warn('[mallSalesmanCoupon] sessionStorage write failed', e);
  }
}

export function getMallAutoCoupon(): MallAutoCoupon | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MallAutoCoupon;
  } catch {
    return null;
  }
}

export function clearMallAutoCoupon(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // noop
  }
}
