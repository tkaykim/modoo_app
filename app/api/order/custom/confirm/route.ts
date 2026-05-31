import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { trackServerPurchase, extractAttributionFromRequest } from '@/lib/server-analytics';

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

    if (!paymentKey || !orderId || amount == null || !token) {
      return NextResponse.json({ error: '필수 결제 정보가 누락되었습니다.' }, { status: 400 });
    }

    const isFreeOrder = paymentKey === 'FREE_ORDER' && amount === 0;

    const adminClient = createAdminClient();

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('id, total_amount, payment_status, payment_link_token, order_status, inquiry_id, parent_order_id')
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

    // Confirm payment with Toss (or skip for free orders)
    if (!isFreeOrder) {
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
    }

    // Update order with payment info and customer info
    const updatePayload: Record<string, unknown> = {
      payment_key: isFreeOrder ? null : paymentKey,
      payment_status: 'completed',
      payment_method: isFreeOrder ? 'free' : 'toss',
      updated_at: new Date().toISOString(),
    };

    if (order.order_status === 'payment_pending') {
      updatePayload.order_status = 'payment_completed';
    }

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

    // 간이주문/차액주문(문의 연결)이면 결제 완료를 문의 스레드에 기록 — fire-and-forget, 결제 결과에 영향 없음
    if (order.inquiry_id) {
      try {
        const noteContent = order.parent_order_id
          ? `✅ 차액(추가) 결제가 완료되었습니다.\n주문번호: ${order.id}\n원주문: ${order.parent_order_id}\n결제금액: ${Number(amount).toLocaleString('ko-KR')}원\n\n원주문 사양/수량 변경분에 대한 추가 결제입니다. 생산 사양 반영 후 공장 배정을 진행해 주세요.`
          : `✅ 결제가 완료되었습니다.\n주문번호: ${order.id}\n결제금액: ${Number(amount).toLocaleString('ko-KR')}원\n\n간이주문 결제분입니다. 디자이너 목업·면별 아트워크 작업 후 공장 배정을 진행해 주세요.`;
        await adminClient.from('inquiry_replies').insert({
          inquiry_id: order.inquiry_id,
          admin_id: null,
          is_admin: true,
          content: noteContent,
          file_urls: [],
        });
      } catch (noteErr) {
        console.error('[order/custom/confirm] inquiry note failed:', noteErr);
      }
    }

    // 서버사이드 purchase 이벤트 (custom order는 order_items를 별도 조회)
    try {
      const { data: items } = await adminClient
        .from('order_items')
        .select('product_id, product_title, price_per_item, quantity')
        .eq('order_id', order.id);
      const attribution = extractAttributionFromRequest(request);
      const nameParts = (payload.customerName || '').trim().split(/\s+/);
      void trackServerPurchase({
        transactionId: order.id,
        value: amount,
        currency: 'KRW',
        items: (items || []).map((it) => ({
          item_id: it.product_id,
          item_name: it.product_title,
          price: it.price_per_item,
          quantity: it.quantity,
        })),
        ...attribution,
        customer: {
          email: payload.customerEmail,
          phone: payload.customerPhone,
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(' ') || undefined,
          city: payload.city,
          postalCode: payload.postalCode,
          country: 'KR',
        },
      });
    } catch (analyticsErr) {
      console.error('[order/custom/confirm] analytics dispatch failed:', analyticsErr);
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
