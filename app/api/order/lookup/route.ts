import { createClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { orderId, email } = await request.json();

    if (!orderId || !email) {
      return NextResponse.json(
        { success: false, error: '주문번호와 이메일을 입력해주세요.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Look up order by ID and customer email
    const { data: order, error: orderError } = await supabase
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
        payment_method,
        payment_status,
        order_status,
        coupon_discount,
        created_at,
        updated_at,
        order_items (
          id,
          product_id,
          product_title,
          quantity,
          price_per_item,
          design_title,
          thumbnail_url,
          item_options,
          color_selections,
          created_at
        )
      `)
      .eq('id', orderId)
      .eq('customer_email', email.toLowerCase().trim())
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다. 주문번호와 이메일을 확인해주세요.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error('Order lookup error:', error);
    return NextResponse.json(
      { success: false, error: '주문 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
