import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from './supabase-admin';
import { getRemoteAreaSurcharge } from './remoteAreaShipping';

// 가격 위변조 방지를 위한 서버측 검증.
// 클라가 보낸 amount/total_amount를 그대로 신뢰하지 않고, DB의 권위 데이터와 교차 검증.

export interface PricingValidatorCartItem {
  product_id: string;
  saved_design_id?: string;
  quantity: number;
  price_per_item: number;
  partner_mall_id?: string | null;
}

export interface PricingValidatorOrderData {
  shipping_method: 'domestic' | 'international' | 'pickup';
  delivery_fee: number;
  total_amount: number;
  coupon_discount: number;
  salesman_discount_amount?: number | null;
  /** 국내배송 시 우편번호 — 제주·도서산간 추가 택배비 판정에 사용 */
  postal_code?: string | null;
}

export interface PricingValidationOk {
  ok: true;
  recomputed: {
    subtotal: number;
    deliveryFee: number;
    expectedTotal: number;
  };
}

export interface PricingValidationError {
  ok: false;
  code:
    | 'AMOUNT_MISMATCH'
    | 'TOTAL_MISMATCH'
    | 'DELIVERY_FEE_MISMATCH'
    | 'PRICE_BELOW_BASE'
    | 'PRICE_DIVERGES_FROM_DESIGN'
    | 'INVALID_QUANTITY'
    | 'INVALID_INPUT';
  message: string;
  details?: Record<string, unknown>;
}

export type PricingValidationResult = PricingValidationOk | PricingValidationError;

const BASE_DELIVERY_FEE: Record<PricingValidatorOrderData['shipping_method'], number> = {
  pickup: 0,
  domestic: 3000,
  international: 5000,
};

const PRICE_TOLERANCE_KRW = 1; // 원 단위 반올림 오차 흡수

function isFiniteNonNegative(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

/**
 * 주문 가격을 서버측에서 재계산·검증한다.
 *
 * 단계:
 *  1) 입력값(수량, price_per_item) 정상 범위 검증
 *  2) saved_designs.price_per_item과 일치 여부 (게스트 디자인 제외)
 *  3) products.base_price 하한 검증 (price_per_item >= base_price)
 *  4) shipping_method → delivery_fee 매핑 일치
 *  5) total = subtotal + delivery - coupon - salesman 일치
 *  6) Toss로 보낼 amount 인자가 있으면 amount === total_amount 일치
 *
 * 쿠폰 정합성(coupon_usages.used_at, coupon.value)은 별도 단계에서 확인. 이 함수는
 * 클라가 보낸 coupon_discount/salesman_discount_amount가 total과 산술적으로 일치하는지만 본다.
 */
export async function validateOrderPricing(args: {
  cartItems: PricingValidatorCartItem[];
  orderData: PricingValidatorOrderData;
  amount?: number; // Toss confirm 시 PG로 보낼 금액
  supabase?: SupabaseClient;
}): Promise<PricingValidationResult> {
  const { cartItems, orderData, amount } = args;

  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return { ok: false, code: 'INVALID_INPUT', message: '카트 항목이 비어 있습니다.' };
  }

  for (const item of cartItems) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      return {
        ok: false,
        code: 'INVALID_QUANTITY',
        message: '주문 수량이 올바르지 않습니다.',
        details: { product_id: item.product_id, quantity: item.quantity },
      };
    }
    if (!isFiniteNonNegative(item.price_per_item)) {
      return {
        ok: false,
        code: 'INVALID_INPUT',
        message: '단가가 올바르지 않습니다.',
        details: { product_id: item.product_id, price_per_item: item.price_per_item },
      };
    }
  }

  const admin = args.supabase ?? createAdminClient();

  // 1) saved_designs.price_per_item 검증 (게스트 디자인 제외)
  const designIds = Array.from(
    new Set(
      cartItems
        .map((c) => c.saved_design_id)
        .filter((id): id is string => !!id && !id.startsWith('guest-'))
    )
  );
  const designPriceMap = new Map<string, number>();
  if (designIds.length > 0) {
    const { data: designs, error } = await admin
      .from('saved_designs')
      .select('id, price_per_item')
      .in('id', designIds);
    if (error) {
      return {
        ok: false,
        code: 'INVALID_INPUT',
        message: '디자인 가격 조회에 실패했습니다.',
        details: { error: error.message },
      };
    }
    (designs ?? []).forEach((d) => {
      if (typeof d.price_per_item === 'number') {
        designPriceMap.set(d.id as string, d.price_per_item);
      }
    });
  }

  // 2) products.base_price 하한 검증
  const productIds = Array.from(new Set(cartItems.map((c) => c.product_id).filter(Boolean)));
  const basePriceMap = new Map<string, number>();
  if (productIds.length > 0) {
    const { data: products, error } = await admin
      .from('products')
      .select('id, base_price')
      .in('id', productIds);
    if (error) {
      return {
        ok: false,
        code: 'INVALID_INPUT',
        message: '제품 가격 조회에 실패했습니다.',
        details: { error: error.message },
      };
    }
    (products ?? []).forEach((p) => {
      if (typeof p.base_price === 'number') {
        basePriceMap.set(p.id as string, p.base_price);
      }
    });
  }

  let subtotal = 0;
  for (const item of cartItems) {
    const itemSubtotal = item.price_per_item * item.quantity;
    subtotal += itemSubtotal;

    if (item.saved_design_id && !item.saved_design_id.startsWith('guest-')) {
      const dbPrice = designPriceMap.get(item.saved_design_id);
      // 가격 변조 방지: client_price < db_price면 거부(인하 시도). 동일하거나 높은 건 허용
      // (스냅샷 이후 가격이 인상된 정상 케이스 보호).
      if (typeof dbPrice === 'number' && item.price_per_item + PRICE_TOLERANCE_KRW < dbPrice) {
        return {
          ok: false,
          code: 'PRICE_DIVERGES_FROM_DESIGN',
          message: '저장된 디자인의 단가보다 낮은 가격으로 주문할 수 없습니다.',
          details: {
            saved_design_id: item.saved_design_id,
            client_price: item.price_per_item,
            db_price: dbPrice,
          },
        };
      }
    }

    const basePrice = basePriceMap.get(item.product_id);
    if (typeof basePrice === 'number' && item.price_per_item + PRICE_TOLERANCE_KRW < basePrice) {
      // 단가는 base_price 미만일 수 없다(로고 추가요금/옵션은 항상 + 방향).
      return {
        ok: false,
        code: 'PRICE_BELOW_BASE',
        message: '단가가 제품 기본 가격보다 낮습니다.',
        details: {
          product_id: item.product_id,
          client_price: item.price_per_item,
          base_price: basePrice,
        },
      };
    }
  }

  // 3) delivery_fee 검증 (기본요금 + 제주·도서산간 추가요금)
  const baseDeliveryFee = BASE_DELIVERY_FEE[orderData.shipping_method];
  if (typeof baseDeliveryFee !== 'number') {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      message: '배송 방식이 올바르지 않습니다.',
      details: { shipping_method: orderData.shipping_method },
    };
  }
  const remoteSurcharge = getRemoteAreaSurcharge(orderData.postal_code, orderData.shipping_method);
  const expectedDeliveryFee = baseDeliveryFee + remoteSurcharge;
  if (Math.abs((orderData.delivery_fee ?? 0) - expectedDeliveryFee) > PRICE_TOLERANCE_KRW) {
    return {
      ok: false,
      code: 'DELIVERY_FEE_MISMATCH',
      message: '배송비가 일치하지 않습니다.',
      details: {
        shipping_method: orderData.shipping_method,
        client_delivery_fee: orderData.delivery_fee,
        expected: expectedDeliveryFee,
      },
    };
  }

  // 4) total 산술 일치
  const couponDiscount = Number(orderData.coupon_discount) || 0;
  const salesmanDiscount = Number(orderData.salesman_discount_amount) || 0;
  if (couponDiscount < 0 || salesmanDiscount < 0) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      message: '할인 금액이 음수일 수 없습니다.',
      details: { couponDiscount, salesmanDiscount },
    };
  }

  const expectedTotal = Math.max(0, subtotal + expectedDeliveryFee - couponDiscount - salesmanDiscount);
  if (Math.abs((orderData.total_amount ?? 0) - expectedTotal) > PRICE_TOLERANCE_KRW) {
    return {
      ok: false,
      code: 'TOTAL_MISMATCH',
      message: '주문 합계가 산술적으로 일치하지 않습니다.',
      details: {
        client_total: orderData.total_amount,
        recomputed_total: expectedTotal,
        subtotal,
        delivery_fee: expectedDeliveryFee,
        coupon_discount: couponDiscount,
        salesman_discount: salesmanDiscount,
      },
    };
  }

  // 5) PG amount === total_amount
  if (typeof amount === 'number') {
    if (Math.abs(amount - expectedTotal) > PRICE_TOLERANCE_KRW) {
      return {
        ok: false,
        code: 'AMOUNT_MISMATCH',
        message: '결제 금액이 주문 합계와 일치하지 않습니다.',
        details: { client_amount: amount, expected: expectedTotal },
      };
    }
  }

  return {
    ok: true,
    recomputed: {
      subtotal,
      deliveryFee: expectedDeliveryFee,
      expectedTotal,
    },
  };
}
