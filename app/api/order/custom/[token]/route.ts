import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: '유효하지 않은 링크입니다.' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select(`
        id,
        customer_name,
        customer_email,
        customer_phone,
        shipping_method,
        country_code,
        state,
        city,
        postal_code,
        address_line_1,
        address_line_2,
        delivery_fee,
        total_amount,
        original_amount,
        admin_discount,
        admin_surcharge,
        coupon_discount,
        pricing_note,
        payment_status,
        payment_method,
        order_status,
        payment_link_token
      `)
      .eq('payment_link_token', token)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (order.payment_status === 'completed') {
      return NextResponse.json({
        error: '이미 결제가 완료된 주문입니다.',
        data: { alreadyPaid: true, orderId: order.id },
      }, { status: 400 });
    }

    const { data: orderItems, error: itemsError } = await adminClient
      .from('order_items')
      .select(`
        id,
        product_id,
        design_id,
        product_title,
        quantity,
        price_per_item,
        item_options,
        thumbnail_url
      `)
      .eq('order_id', order.id);

    if (itemsError) {
      return NextResponse.json({ error: '주문 항목을 불러올 수 없습니다.' }, { status: 500 });
    }

    let designPreviewUrl: string | null = null;
    if (orderItems && orderItems.length > 0 && orderItems[0].design_id) {
      const { data: design } = await adminClient
        .from('saved_designs')
        .select('preview_url')
        .eq('id', orderItems[0].design_id)
        .single();
      designPreviewUrl = design?.preview_url || orderItems[0].thumbnail_url;
    }

    return NextResponse.json({
      data: {
        id: order.id,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone,
        shipping_method: order.shipping_method,
        country_code: order.country_code,
        state: order.state,
        city: order.city,
        postal_code: order.postal_code,
        address_line_1: order.address_line_1,
        address_line_2: order.address_line_2,
        delivery_fee: order.delivery_fee,
        total_amount: order.total_amount,
        original_amount: order.original_amount,
        admin_discount: order.admin_discount || 0,
        admin_surcharge: order.admin_surcharge || 0,
        coupon_discount: order.coupon_discount || 0,
        pricing_note: order.pricing_note,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        order_status: order.order_status,
        order_items: orderItems || [],
        product_title: orderItems?.[0]?.product_title || '',
        design_preview_url: designPreviewUrl,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '주문 조회에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: '유효하지 않은 링크입니다.' }, { status: 400 });
    }

    const payload = await request.json().catch(() => null);
    if (!payload) {
      return NextResponse.json({ error: '요청 데이터가 올바르지 않습니다.' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('id, payment_status')
      .eq('payment_link_token', token)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (order.payment_status === 'completed') {
      return NextResponse.json({ error: '이미 결제가 완료된 주문입니다.' }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (payload.customerName) updatePayload.customer_name = payload.customerName;
    if (payload.customerEmail) updatePayload.customer_email = payload.customerEmail;
    if (payload.customerPhone !== undefined) updatePayload.customer_phone = payload.customerPhone || null;
    if (payload.shippingMethod) updatePayload.shipping_method = payload.shippingMethod;
    if (payload.shippingMethod === 'domestic') {
      updatePayload.country_code = 'KR';
      if (payload.postalCode) updatePayload.postal_code = payload.postalCode;
      if (payload.state !== undefined) updatePayload.state = payload.state;
      if (payload.city !== undefined) updatePayload.city = payload.city;
      if (payload.addressLine1) updatePayload.address_line_1 = payload.addressLine1;
      if (payload.addressLine2 !== undefined) updatePayload.address_line_2 = payload.addressLine2 || null;
    }

    const { error: updateError } = await adminClient
      .from('orders')
      .update(updatePayload)
      .eq('id', order.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '주문 업데이트에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
