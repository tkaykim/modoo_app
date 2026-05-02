import { createAnonClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  const { shareToken } = await params;

  if (!shareToken) {
    return NextResponse.json({ error: 'Share token is required' }, { status: 400 });
  }

  const supabase = createAnonClient();

  const selectQuery = `
      id, name, logo_url, is_active, slug, owner_salesman_id,
      partner_mall_products (
        id, partner_mall_id, product_id,
        display_name, color_hex, color_name, color_code,
        logo_placements, canvas_state, preview_url, price,
        product:products (
          id, title, base_price, configuration,
          size_options, discount_rates,
          thumbnail_image_link
        )
      )
    `;

  // Try slug first, then share_token
  let mall = null;
  let error = null;

  const { data: slugResult, error: slugError } = await supabase
    .from('partner_malls')
    .select(selectQuery)
    .eq('slug', shareToken)
    .eq('is_active', true)
    .maybeSingle();

  if (slugResult) {
    mall = slugResult;
  } else {
    const { data: tokenResult, error: tokenError } = await supabase
      .from('partner_malls')
      .select(selectQuery)
      .eq('share_token', shareToken)
      .eq('is_active', true)
      .maybeSingle();

    mall = tokenResult;
    error = tokenError;
  }

  if (error || !mall) {
    return NextResponse.json({ error: '찾을 수 없는 페이지입니다.' }, { status: 404 });
  }

  // 영업사원이 소유한 mall인 경우, 그 영업사원의 활성 할인코드를 함께 내려줌
  // → 고객이 mall에 진입하면 자동으로 코드가 적용됨 (UX/attribution 동시 처리)
  let salesman_coupon: {
    id: string;
    code: string;
    discount_type: 'percentage' | 'fixed_amount';
    discount_value: number;
    min_order_amount: number;
    max_discount_amount: number | null;
    salesman_profile_id: string;
  } | null = null;

  const ownerSalesmanId = (mall as { owner_salesman_id?: string | null }).owner_salesman_id;
  if (ownerSalesmanId) {
    const { data: coupon } = await supabase
      .from('coupons')
      .select('id, code, discount_type, discount_value, min_order_amount, max_discount_amount, salesman_profile_id, is_active, expires_at')
      .eq('salesman_profile_id', ownerSalesmanId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (coupon && (!coupon.expires_at || new Date(coupon.expires_at) > new Date())) {
      salesman_coupon = {
        id: coupon.id,
        code: coupon.code,
        discount_type: coupon.discount_type as 'percentage' | 'fixed_amount',
        discount_value: Number(coupon.discount_value),
        min_order_amount: Number(coupon.min_order_amount ?? 0),
        max_discount_amount: coupon.max_discount_amount != null ? Number(coupon.max_discount_amount) : null,
        salesman_profile_id: coupon.salesman_profile_id as string,
      };
    }
  }

  return NextResponse.json({ data: { ...mall, salesman_coupon } });
}
