import {
  isPartnerMallCapabilityToken,
  isPartnerMallPreviewRequest,
} from '@/lib/partnerMallAccess';
import { createAnonClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

const selectQuery = `
  id, name, logo_url, is_active, slug, salesman_id,
  partner_mall_products (
    id, partner_mall_id, product_id,
    display_name, color_hex, color_name, color_code,
    logo_placements, canvas_state, preview_url, price,
    created_by_role,
    product:products (
      id, title, base_price, configuration,
      size_options, discount_rates,
      thumbnail_image_link, sizing_chart_image, sizing_data
    )
  ),
  partner_mall_assets (
    id, partner_mall_id, asset_type, url, name,
    is_primary, sort_order, created_by_role, created_at
  ),
  attributed_salesman:salesman_profiles!salesman_id (
    id, display_name, salesman_code
  )
`;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ shareToken: string }> },
) {
  const { shareToken } = await params;

  if (!shareToken) {
    return NextResponse.json({ error: 'Share token is required' }, { status: 400 });
  }

  const isPreview = isPartnerMallPreviewRequest(request);
  if (isPreview && !isPartnerMallCapabilityToken(shareToken)) {
    return NextResponse.json({ error: '찾을 수 없는 페이지입니다.' }, { status: 404 });
  }

  const supabase = isPreview ? createAdminClient() : createAnonClient();
  let mall = null;
  let error = null;

  if (isPreview) {
    const result = await supabase
      .from('partner_malls')
      .select(selectQuery)
      .eq('share_token', shareToken)
      .maybeSingle();
    mall = result.data;
    error = result.error;
  } else {
    const slugResult = await supabase
      .from('partner_malls')
      .select(selectQuery)
      .eq('slug', shareToken)
      .eq('is_active', true)
      .maybeSingle();

    if (slugResult.data) {
      mall = slugResult.data;
      error = slugResult.error;
    } else if (isPartnerMallCapabilityToken(shareToken)) {
      const tokenResult = await supabase
        .from('partner_malls')
        .select(selectQuery)
        .eq('share_token', shareToken)
        .eq('is_active', true)
        .maybeSingle();
      mall = tokenResult.data;
      error = tokenResult.error;
    }
  }

  if (error || !mall) {
    return NextResponse.json({ error: '찾을 수 없는 페이지입니다.' }, { status: 404 });
  }

  let salesmanCoupon: {
    id: string;
    code: string;
    discount_type: 'percentage' | 'fixed_amount';
    discount_value: number;
    min_order_amount: number;
    max_discount_amount: number | null;
    salesman_profile_id: string;
  } | null = null;

  const ownerSalesmanId = (mall as { salesman_id?: string | null }).salesman_id;
  if (ownerSalesmanId && !isPreview) {
    const { data: coupon } = await supabase
      .from('coupons')
      .select('id, code, discount_type, discount_value, min_order_amount, max_discount_amount, salesman_profile_id, is_active, expires_at')
      .eq('salesman_profile_id', ownerSalesmanId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (coupon && (!coupon.expires_at || new Date(coupon.expires_at) > new Date())) {
      salesmanCoupon = {
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

  const response = NextResponse.json({
    data: {
      ...mall,
      is_preview: isPreview,
      salesman_coupon: salesmanCoupon,
    },
  });

  if (isPreview) {
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }

  return response;
}
