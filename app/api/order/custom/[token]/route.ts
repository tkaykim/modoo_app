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
        payment_link_token,
        customer_editable_fields
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

    // Fetch design preview URLs for all items that have design_id
    const designIds = (orderItems || [])
      .map(item => item.design_id)
      .filter((id): id is string => !!id);
    const uniqueDesignIds = [...new Set(designIds)];

    const designPreviewMap = new Map<string, string>();
    if (uniqueDesignIds.length > 0) {
      const { data: designs } = await adminClient
        .from('saved_designs')
        .select('id, preview_url')
        .in('id', uniqueDesignIds);
      designs?.forEach(d => {
        if (d.preview_url) designPreviewMap.set(d.id, d.preview_url);
      });
    }

    const itemsWithPreview = (orderItems || []).map(item => ({
      ...item,
      design_preview_url: (item.design_id && designPreviewMap.get(item.design_id)) || item.thumbnail_url || null,
    }));

    // Build order name for Toss widget
    const firstTitle = orderItems?.[0]?.product_title || '주문';
    const orderName = (orderItems && orderItems.length > 1)
      ? `${firstTitle} 외 ${orderItems.length - 1}건`
      : firstTitle;

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
        order_items: itemsWithPreview,
        order_name: orderName,
        product_title: firstTitle,
        design_preview_url: itemsWithPreview[0]?.design_preview_url || null,
        customer_editable_fields: order.customer_editable_fields || null,
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
      .select('id, payment_status, order_status, customer_editable_fields, coupon_discount, admin_discount, admin_surcharge')
      .eq('payment_link_token', token)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (order.payment_status === 'completed') {
      return NextResponse.json({ error: '이미 결제가 완료된 주문입니다.' }, { status: 400 });
    }

    const ceFields = order.customer_editable_fields as Record<string, boolean> | null;

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (payload.confirmBankTransfer) {
      updatePayload.payment_method = 'bank_transfer';
      updatePayload.payment_status = 'pending';
      updatePayload.order_status = 'payment_pending';
    }

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

    // Handle customer quantity updates
    let newTotalAmount: number | null = null;
    if (ceFields?.quantities && Array.isArray(payload.items)) {
      const { data: existingItems, error: itemsFetchErr } = await adminClient
        .from('order_items')
        .select('id, price_per_item, item_options')
        .eq('order_id', order.id);

      if (itemsFetchErr || !existingItems) {
        return NextResponse.json({ error: '주문 항목을 불러올 수 없습니다.' }, { status: 500 });
      }

      let newOriginalAmount = 0;

      for (const inputItem of payload.items as Array<{ id: string; variants: Array<{ sizeCode: string; quantity: number }> }>) {
        const dbItem = existingItems.find(ei => ei.id === inputItem.id);
        if (!dbItem) continue;

        const totalQty = inputItem.variants.reduce((s: number, v: { quantity: number }) => s + (v.quantity || 0), 0);
        const itemSubtotal = dbItem.price_per_item * totalQty;
        newOriginalAmount += itemSubtotal;

        const existingOptions = (dbItem.item_options || {}) as Record<string, unknown>;
        const existingVariants = (existingOptions.variants || []) as Array<Record<string, unknown>>;

        const updatedVariants = existingVariants.map((ev: Record<string, unknown>) => {
          const match = inputItem.variants.find(iv => iv.sizeCode === ev.size_id);
          return match ? { ...ev, quantity: match.quantity } : ev;
        });

        const updatedOptions: Record<string, unknown> = { ...existingOptions, variants: updatedVariants };
        const nonZeroVariants = updatedVariants.filter((v: Record<string, unknown>) => (v.quantity as number) > 0);
        if (nonZeroVariants.length === 1) {
          const [single] = nonZeroVariants;
          updatedOptions.size_id = single.size_id;
          updatedOptions.size_name = single.size_name;
        }

        await adminClient
          .from('order_items')
          .update({ quantity: totalQty, item_options: updatedOptions })
          .eq('id', dbItem.id);
      }

      const couponDiscount = Number(order.coupon_discount) || 0;
      const adminDiscount = Number(order.admin_discount) || 0;
      const adminSurcharge = Number(order.admin_surcharge) || 0;
      newTotalAmount = Math.max(0, newOriginalAmount - couponDiscount - adminDiscount + adminSurcharge);

      updatePayload.original_amount = newOriginalAmount;
      updatePayload.total_amount = newTotalAmount;
    }

    const { error: updateError } = await adminClient
      .from('orders')
      .update(updatePayload)
      .eq('id', order.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ data: { success: true, ...(newTotalAmount !== null && { totalAmount: newTotalAmount }) } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '주문 업데이트에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
