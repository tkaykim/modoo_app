import { createClient } from './supabase-client';
import { Coupon, CouponUsage, CouponValidationResult } from '@/types/types';

/**
 * Register a coupon by code for the current user
 */
export async function registerCoupon(code: string): Promise<CouponValidationResult> {
  const supabase = createClient();

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return { valid: false, error: '로그인이 필요합니다.' };
    }

    // Find coupon by code
    const { data: coupon, error: couponError } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code.toUpperCase().trim())
      .eq('is_active', true)
      .single();

    if (couponError || !coupon) {
      return { valid: false, error: '유효하지 않은 쿠폰 코드입니다.' };
    }

    // Check if coupon is expired
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return { valid: false, error: '만료된 쿠폰입니다.' };
    }

    // Check max uses
    if (coupon.max_uses !== null && coupon.current_uses >= coupon.max_uses) {
      return { valid: false, error: '쿠폰 사용 한도가 초과되었습니다.' };
    }

    // Check if already registered
    const { data: existingUsage } = await supabase
      .from('coupon_usages')
      .select('id')
      .eq('coupon_id', coupon.id)
      .eq('user_id', user.id)
      .single();

    if (existingUsage) {
      return { valid: false, error: '이미 등록된 쿠폰입니다.' };
    }

    // Calculate expiry date for this user
    let userExpiresAt: string | null = null;
    if (coupon.valid_days_after_registration) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + coupon.valid_days_after_registration);
      userExpiresAt = expiryDate.toISOString();
    } else if (coupon.expires_at) {
      userExpiresAt = coupon.expires_at;
    }

    // Register coupon for user
    const { data: usage, error: insertError } = await supabase
      .from('coupon_usages')
      .insert({
        coupon_id: coupon.id,
        user_id: user.id,
        registered_at: new Date().toISOString(),
        expires_at: userExpiresAt,
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Error registering coupon:', insertError);
      return { valid: false, error: '쿠폰 등록에 실패했습니다.' };
    }

    return {
      valid: true,
      coupon: coupon as Coupon,
      couponUsage: { ...usage, coupon: coupon } as CouponUsage,
    };
  } catch (error) {
    console.error('Error in registerCoupon:', error);
    return { valid: false, error: '쿠폰 등록 중 오류가 발생했습니다.' };
  }
}

/**
 * Get all coupons registered by the current user
 */
export async function getUserCoupons(): Promise<CouponUsage[]> {
  const supabase = createClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('User not authenticated');
      return [];
    }

    const { data: usages, error } = await supabase
      .from('coupon_usages')
      .select(`
        *,
        coupon:coupons(*)
      `)
      .eq('user_id', user.id)
      .order('registered_at', { ascending: false });

    if (error) {
      console.error('Error fetching user coupons:', error);
      return [];
    }

    return (usages || []) as CouponUsage[];
  } catch (error) {
    console.error('Error in getUserCoupons:', error);
    return [];
  }
}

/**
 * Get available (unused and non-expired) coupons for the current user
 */
export async function getAvailableCoupons(): Promise<CouponUsage[]> {
  const supabase = createClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('User not authenticated');
      return [];
    }

    const { data: usages, error } = await supabase
      .from('coupon_usages')
      .select(`
        *,
        coupon:coupons(*)
      `)
      .eq('user_id', user.id)
      .is('used_at', null)
      .order('registered_at', { ascending: false });

    if (error) {
      console.error('Error fetching available coupons:', error);
      return [];
    }

    // Filter out expired coupons
    const now = new Date();
    const availableCoupons = (usages || []).filter((usage: CouponUsage) => {
      if (usage.expires_at && new Date(usage.expires_at) < now) {
        return false;
      }
      return true;
    });

    return availableCoupons as CouponUsage[];
  } catch (error) {
    console.error('Error in getAvailableCoupons:', error);
    return [];
  }
}

/**
 * Calculate discount amount for a coupon
 */
export function calculateCouponDiscount(couponUsage: CouponUsage, orderTotal: number): number {
  const coupon = couponUsage.coupon;
  if (!coupon) return 0;

  let discountAmount = 0;

  if (coupon.discount_type === 'percentage') {
    discountAmount = Math.floor(orderTotal * (coupon.discount_value / 100));
    // Apply max discount cap if set
    if (coupon.max_discount_amount !== null) {
      discountAmount = Math.min(discountAmount, coupon.max_discount_amount);
    }
  } else {
    // Fixed amount
    discountAmount = coupon.discount_value;
  }

  // Discount cannot exceed order total
  discountAmount = Math.min(discountAmount, orderTotal);

  return discountAmount;
}

/**
 * Validate a coupon for use in an order
 */
export function validateCouponForOrder(
  couponUsage: CouponUsage,
  orderTotal: number
): CouponValidationResult {
  const coupon = couponUsage.coupon;

  if (!coupon) {
    return { valid: false, error: '쿠폰 정보를 찾을 수 없습니다.' };
  }

  // Check if already used
  if (couponUsage.used_at) {
    return { valid: false, error: '이미 사용된 쿠폰입니다.' };
  }

  // Check user-specific expiry
  if (couponUsage.expires_at && new Date(couponUsage.expires_at) < new Date()) {
    return { valid: false, error: '만료된 쿠폰입니다.' };
  }

  // Check min order amount
  if (orderTotal < coupon.min_order_amount) {
    return {
      valid: false,
      error: `최소 주문금액 ${coupon.min_order_amount.toLocaleString()}원 이상 주문 시 사용 가능합니다.`,
    };
  }

  // Calculate discount
  const discountAmount = calculateCouponDiscount(couponUsage, orderTotal);

  return {
    valid: true,
    coupon,
    couponUsage,
    discountAmount,
    finalTotal: orderTotal - discountAmount,
  };
}

/**
 * Apply coupon to an order (mark as used)
 */
export async function applyCouponToOrder(
  couponUsageId: string,
  orderId: string,
  discountApplied: number
): Promise<boolean> {
  const supabase = createClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('User not authenticated');
      return false;
    }

    // Update coupon usage
    const { error: usageError } = await supabase
      .from('coupon_usages')
      .update({
        used_at: new Date().toISOString(),
        order_id: orderId,
        discount_applied: discountApplied,
      })
      .eq('id', couponUsageId)
      .eq('user_id', user.id);

    if (usageError) {
      console.error('Error updating coupon usage:', usageError);
      return false;
    }

    // Increment coupon current_uses
    // Note: This should ideally be done in a transaction, but Supabase RLS makes this tricky
    // For now, we'll do a simple increment
    const { data: usage } = await supabase
      .from('coupon_usages')
      .select('coupon_id')
      .eq('id', couponUsageId)
      .single();

    if (usage?.coupon_id) {
      const { data: coupon } = await supabase
        .from('coupons')
        .select('current_uses')
        .eq('id', usage.coupon_id)
        .single();

      if (coupon) {
        await supabase
          .from('coupons')
          .update({ current_uses: (coupon.current_uses || 0) + 1 })
          .eq('id', usage.coupon_id);
      }
    }

    return true;
  } catch (error) {
    console.error('Error in applyCouponToOrder:', error);
    return false;
  }
}

/**
 * Get coupon display info for UI
 */
export function getCouponDisplayInfo(coupon: Coupon): {
  discountText: string;
  expiryText: string;
  minOrderText: string | null;
} {
  // Discount text
  let discountText: string;
  if (coupon.discount_type === 'percentage') {
    discountText = `${coupon.discount_value}% 할인`;
    if (coupon.max_discount_amount) {
      discountText += ` (최대 ${coupon.max_discount_amount.toLocaleString()}원)`;
    }
  } else {
    discountText = `${coupon.discount_value.toLocaleString()}원 할인`;
  }

  // Expiry text
  let expiryText: string;
  if (coupon.valid_days_after_registration) {
    expiryText = `등록 후 ${coupon.valid_days_after_registration}일간 유효`;
  } else if (coupon.expires_at) {
    const expiryDate = new Date(coupon.expires_at);
    expiryText = `${expiryDate.getFullYear()}.${expiryDate.getMonth() + 1}.${expiryDate.getDate()}까지`;
  } else {
    expiryText = '무기한';
  }

  // Min order text
  const minOrderText = coupon.min_order_amount > 0
    ? `${coupon.min_order_amount.toLocaleString()}원 이상 주문 시`
    : null;

  return { discountText, expiryText, minOrderText };
}
