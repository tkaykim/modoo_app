import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

const widgetSecretKey = process.env.TOSS_SECRET_KEY;

interface ConfirmPayload {
  paymentKey: string;
  orderId: string;
  amount: number;
  token: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingMethod?: string;
  postalCode?: string;
  state?: string;
  city?: string;
  addressLine1?: string;
  addressLine2?: string;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null) as ConfirmPayload | null;

    if (!payload) {
      return NextResponse.json({ error: '요청 데이터가 올바르지 않습니다.' }, { status: 400 });
    }

    const { paymentKey, orderId, amount, token } = payload;

    if (!paymentKey || !orderId || !amount || !token) {
      return NextResponse.json({ error: '필수 결제 정보가 누락되었습니다.' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('id, total_amount, payment_status, payment_link_token')
      .eq('payment_link_token', token)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (order.payment_status === 'completed') {
      return NextResponse.json({ error: '이미 결제가 완료된 주문입니다.' }, { status: 400 });
    }

    if (order.id !== orderId) {
      return NextResponse.json({ error: '주문 ID가 일치하지 않습니다.' }, { status: 400 });
    }

    if (order.total_amount !== amount) {
      return NextResponse.json({ error: '결제 금액이 일치하지 않습니다.' }, { status: 400 });
    }

    // Confirm payment with Toss
    if (!widgetSecretKey) {
      return NextResponse.json({ error: '결제 설정 오류입니다.' }, { status: 500 });
    }

    const encryptedSecretKey = 'Basic ' + Buffer.from(widgetSecretKey + ':').toString('base64');

    const tossResponse = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: encryptedSecretKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    if (!tossResponse.ok) {
      const tossError = await tossResponse.json().catch(() => ({}));
      console.error('Toss payment confirmation failed:', tossError);
      return NextResponse.json({
        error: tossError.message || '결제 확인에 실패했습니다.',
      }, { status: 400 });
    }

    // Update order with payment info and customer info
    const updatePayload: Record<string, unknown> = {
      payment_key: paymentKey,
      payment_status: 'completed',
      payment_method: 'toss',
      updated_at: new Date().toISOString(),
    };

    if (payload.customerName) updatePayload.customer_name = payload.customerName;
    if (payload.customerEmail) updatePayload.customer_email = payload.customerEmail;
    if (payload.customerPhone !== undefined) updatePayload.customer_phone = payload.customerPhone || null;

    if (payload.shippingMethod) {
      updatePayload.shipping_method = payload.shippingMethod;
      if (payload.shippingMethod === 'domestic') {
        updatePayload.country_code = 'KR';
        if (payload.postalCode) updatePayload.postal_code = payload.postalCode;
        if (payload.state !== undefined) updatePayload.state = payload.state;
        if (payload.city !== undefined) updatePayload.city = payload.city;
        if (payload.addressLine1) updatePayload.address_line_1 = payload.addressLine1;
        if (payload.addressLine2 !== undefined) updatePayload.address_line_2 = payload.addressLine2 || null;
      }
    }

    const { error: updateError } = await adminClient
      .from('orders')
      .update(updatePayload)
      .eq('id', order.id);

    if (updateError) {
      console.error('Failed to update order after payment:', updateError);
      return NextResponse.json({ error: '결제는 완료되었으나 주문 정보 업데이트에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        orderId: order.id,
        paymentKey,
        amount,
        status: 'completed',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '결제 확인에 실패했습니다.';
    console.error('Custom order payment confirm error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
