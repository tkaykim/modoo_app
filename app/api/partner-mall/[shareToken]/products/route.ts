import { createAnonClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  const { shareToken } = await params;

  if (!shareToken) {
    return NextResponse.json({ error: 'Share token is required' }, { status: 400 });
  }

  // Validate the partner mall exists and is active
  const supabase = createAnonClient();

  // Try slug first, then share_token
  let mall = null;
  const { data: slugResult } = await supabase
    .from('partner_malls')
    .select('id')
    .eq('slug', shareToken)
    .eq('is_active', true)
    .maybeSingle();

  if (slugResult) {
    mall = slugResult;
  } else {
    const { data: tokenResult } = await supabase
      .from('partner_malls')
      .select('id')
      .eq('share_token', shareToken)
      .eq('is_active', true)
      .maybeSingle();
    mall = tokenResult;
  }

  if (!mall) {
    return NextResponse.json({ error: '유효하지 않은 파트너몰입니다.' }, { status: 404 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload?.product_id) {
    return NextResponse.json({ error: '제품 ID가 필요합니다.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('partner_mall_products')
    .insert({
      partner_mall_id: mall.id,
      product_id: payload.product_id,
      logo_placements: payload.logo_placements ?? {},
      canvas_state: payload.canvas_state ?? {},
      preview_url: payload.preview_url ?? null,
      display_name: payload.display_name ?? null,
      manufacturer_color_id: payload.manufacturer_color_id ?? null,
      color_hex: payload.color_hex ?? null,
      color_name: payload.color_name ?? null,
      color_code: payload.color_code ?? null,
      price: null,
      created_at: now,
      updated_at: now,
    })
    .select(`
      id, partner_mall_id, product_id,
      display_name, color_hex, color_name, color_code,
      logo_placements, canvas_state, preview_url, price,
      product:products (
        id, title, base_price, configuration,
        size_options, discount_rates,
        thumbnail_image_link
      )
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  const { shareToken } = await params;

  if (!shareToken) {
    return NextResponse.json({ error: 'Share token is required' }, { status: 400 });
  }

  // Validate the partner mall exists and is active
  const supabase = createAnonClient();

  // Try slug first, then share_token
  let mall = null;
  const { data: slugResult } = await supabase
    .from('partner_malls')
    .select('id')
    .eq('slug', shareToken)
    .eq('is_active', true)
    .maybeSingle();

  if (slugResult) {
    mall = slugResult;
  } else {
    const { data: tokenResult } = await supabase
      .from('partner_malls')
      .select('id')
      .eq('share_token', shareToken)
      .eq('is_active', true)
      .maybeSingle();
    mall = tokenResult;
  }

  if (!mall) {
    return NextResponse.json({ error: '유효하지 않은 파트너몰입니다.' }, { status: 404 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload?.id) {
    return NextResponse.json({ error: '파트너몰 제품 ID가 필요합니다.' }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (payload.canvas_state !== undefined) updateData.canvas_state = payload.canvas_state;
  if (payload.preview_url !== undefined) updateData.preview_url = payload.preview_url;
  if (payload.logo_placements !== undefined) updateData.logo_placements = payload.logo_placements;
  if (payload.display_name !== undefined) updateData.display_name = payload.display_name;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('partner_mall_products')
    .update(updateData)
    .eq('id', payload.id)
    .eq('partner_mall_id', mall.id)
    .select(`
      id, partner_mall_id, product_id,
      display_name, color_hex, color_name, color_code,
      logo_placements, canvas_state, preview_url, price,
      product:products (
        id, title, base_price, configuration,
        size_options, discount_rates,
        thumbnail_image_link
      )
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
