import { createClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';
import { verifyOrganizerTokenForSession } from '@/lib/cobuy-organizer-request';
import { NextRequest, NextResponse } from 'next/server';
import {
  extractImageUrlsFromCanvasState,
  type TextSvgExports,
} from '@/lib/canvas-svg-export';
import { FontMetadata } from '@/lib/fontUtils';
import { sendOrderNotificationEmails } from '@/lib/notifications/order';

interface OrderData {
  id: string;
  name: string;
  email: string;
  phone_num: string;
  address_line_1: string | null;
  address_line_2: string | null;
  shipping_method: 'domestic' | 'international' | 'pickup';
  country_code: string | null;
  state: string | null;
  city: string | null;
  postal_code: string | null;
  delivery_fee: number;
  total_amount: number;
}

interface Variant {
  size: string;
  quantity: number;
}

interface CreateCoBuyOrderRequest {
  sessionId: string;
  orderData: OrderData;
  variants: Variant[];
}

/**
 * API route to create a single bulk order for a CoBuy session
 *
 * This endpoint:
 * 1. Validates the CoBuy session exists and belongs to the authenticated user
 * 2. Creates a single order with the creator's information
 * 3. Aggregates participant selections into order item variants
 * 4. Marks the order with order_category = 'cobuy'
 * 5. Links the order to the CoBuy session via bulk_order_id
 * 6. Updates the session status to 'order_complete'
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CreateCoBuyOrderRequest & { organizerToken?: string };
    const { sessionId, orderData, variants, organizerToken } = body;

    if (!sessionId || !orderData || !variants) {
      return NextResponse.json(
        { success: false, error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const tokenOk =
      typeof organizerToken === 'string' &&
      verifyOrganizerTokenForSession(organizerToken, sessionId);

    const supabaseAuth = await createClient();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    const db = tokenOk ? createAdminClient() : supabaseAuth;

    if (!tokenOk && (authError || !user)) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // Fetch CoBuy session with design data
    const { data: session, error: sessionError } = await db
      .from('cobuy_sessions')
      .select(`
        id,
        user_id,
        title,
        status,
        saved_design_screenshot_id,
        saved_design_screenshots (
          id,
          product_id,
          title,
          canvas_state,
          color_selections,
          price_per_item,
          preview_url,
          image_urls,
          text_svg_exports,
          custom_fonts
        )
      `)
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { success: false, error: '공동구매 세션을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Verify the session belongs to the authenticated user (또는 주최자 비밀 링크 토큰)
    if (!tokenOk && session.user_id !== user?.id) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    const orderUserId = session.user_id;

    // Check if session has already had an order created
    const orderCreatedStates = ['order_complete', 'manufacturing', 'manufacture_complete', 'delivering', 'delivery_complete'];
    if (orderCreatedStates.includes(session.status)) {
      return NextResponse.json(
        { success: false, error: '이미 주문이 생성된 세션입니다.' },
        { status: 400 }
      );
    }

    const designSnapshot = session.saved_design_screenshots as unknown as {
      id: string;
      product_id: string;
      title: string;
      canvas_state: Record<string, unknown>;
      color_selections: Record<string, unknown>;
      price_per_item: number;
      preview_url: string | null;
      image_urls: Record<string, unknown>;
      text_svg_exports?: TextSvgExports;
      custom_fonts?: FontMetadata[];
    };

    if (!designSnapshot) {
      return NextResponse.json(
        { success: false, error: '디자인 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Fetch product information
    const { data: product, error: productError } = await db
      .from('products')
      .select('id, title')
      .eq('id', designSnapshot.product_id)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { success: false, error: '상품 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Calculate total product amount from participants' orders
    const { data: participantPayments, error: paymentsError } = await db
      .from('cobuy_participants')
      .select('payment_amount')
      .eq('cobuy_session_id', sessionId)
      .eq('payment_status', 'completed');

    if (paymentsError) {
      console.error('Error fetching participant payments:', paymentsError);
    }

    const totalProductAmount = participantPayments?.reduce(
      (sum, p) => sum + (p.payment_amount || 0),
      0
    ) || 0;

    // Total amount = product amount (already paid by participants) + delivery fee (paid by creator)
    const fullOrderAmount = totalProductAmount + orderData.delivery_fee;

    // Create the bulk order
    const { data: order, error: orderError } = await db
      .from('orders')
      .insert({
        id: orderData.id,
        user_id: orderUserId, // Order belongs to the CoBuy creator
        customer_name: orderData.name,
        customer_email: orderData.email,
        customer_phone: orderData.phone_num,
        shipping_method: orderData.shipping_method,
        country_code: orderData.country_code,
        state: orderData.state,
        city: orderData.city,
        postal_code: orderData.postal_code,
        address_line_1: orderData.address_line_1,
        address_line_2: orderData.address_line_2,
        delivery_fee: orderData.delivery_fee,
        total_amount: fullOrderAmount, // Full order value for record-keeping
        payment_method: 'toss',
        payment_key: null, // Will be set by payment confirmation
        payment_status: 'complete',
        order_status: 'payment_completed',
        order_category: 'cobuy', // Mark as CoBuy order
        cobuy_session_id: sessionId, // Bidirectional relationship with cobuy_sessions
      })
      .select()
      .single();

    if (orderError) {
      return NextResponse.json(
        {
          success: false,
          error: '주문 생성에 실패했습니다.',
          details: orderError.message,
        },
        { status: 500 }
      );
    }

    // Calculate total quantity
    const totalQuantity = variants.reduce((sum, v) => sum + v.quantity, 0);

    // Create order item with aggregated variants
    const { data: orderItem, error: orderItemError } = await db
      .from('order_items')
      .insert({
        order_id: order.id,
        product_id: product.id,
        product_title: product.title,
        design_title: designSnapshot.title,
        quantity: totalQuantity,
        price_per_item: designSnapshot.price_per_item,
        canvas_state: designSnapshot.canvas_state,
        color_selections: designSnapshot.color_selections,
        thumbnail_url: designSnapshot.preview_url,
        image_urls: designSnapshot.image_urls,
        custom_fonts: designSnapshot.custom_fonts || [], // Include custom fonts in order
        item_options: {
          variants: variants.map(v => ({
            size_id: v.size,
            size_name: v.size,
            color_id: 'default',
            color_name: '기본',
            color_hex: '#FFFFFF',
            quantity: v.quantity,
          })),
          cobuy_session_id: sessionId, // Reference to CoBuy session
        },
      })
      .select()
      .single();

    if (orderItemError) {
      // Attempt to delete the orphaned order
      await db.from('orders').delete().eq('id', order.id);
      return NextResponse.json(
        {
          success: false,
          error: '주문 상품 정보 저장에 실패했습니다.',
          details: orderItemError.message,
        },
        { status: 500 }
      );
    }

    // Export text to SVG and extract image URLs
    try {
      if (orderItem.canvas_state && typeof orderItem.canvas_state === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const canvasStateMap = orderItem.canvas_state as Record<string, any>;

        // Use pre-generated SVGs from client-side export (generated during design save)
        let svgUrls: TextSvgExports = {};
        if (designSnapshot.text_svg_exports &&
          typeof designSnapshot.text_svg_exports === 'object' &&
          Object.keys(designSnapshot.text_svg_exports).length > 0) {
          console.log('Using pre-generated client-side SVG exports');
          svgUrls = designSnapshot.text_svg_exports as TextSvgExports;
        } else {
          console.log('No pre-generated SVGs found');
        }

        const imageUrls = extractImageUrlsFromCanvasState(canvasStateMap);

        const hasData = Object.keys(svgUrls).length > 0 || Object.keys(imageUrls).length > 0;

        if (hasData) {
          const updates: { text_svg_exports?: TextSvgExports; image_urls?: Record<string, unknown> } = {};

          if (Object.keys(svgUrls).length > 0) {
            updates.text_svg_exports = svgUrls;
          }

          if (Object.keys(imageUrls).length > 0) {
            updates.image_urls = imageUrls;
          }

          await db
            .from('order_items')
            .update(updates)
            .eq('id', orderItem.id);
        }
      }
    } catch (exportError) {
      // Log error but don't fail the order
      console.error(`Failed to export SVG for order ${order.id}:`, exportError);
    }

    // Update session with bulk_order_id and set status to order_complete
    const { error: sessionUpdateError } = await db
      .from('cobuy_sessions')
      .update({
        bulk_order_id: order.id,
        status: 'order_complete',
      })
      .eq('id', sessionId);

    if (sessionUpdateError) {
      console.error('Failed to update session:', sessionUpdateError);
      // Don't fail the request - order was created successfully
    }

    // Send order notification emails (non-blocking)
    try {
      await sendOrderNotificationEmails({
        orderId: order.id,
        customerName: orderData.name,
        customerEmail: orderData.email,
        customerPhone: orderData.phone_num,
        totalAmount: fullOrderAmount,
        deliveryFee: orderData.delivery_fee,
        shippingMethod: orderData.shipping_method,
        orderCategory: 'cobuy',
        items: [{
          product_title: product.title,
          quantity: totalQuantity,
          price_per_item: designSnapshot.price_per_item,
        }],
      });
    } catch (emailError) {
      console.error('CoBuy order notification email error:', emailError);
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      message: '주문이 성공적으로 생성되었습니다.',
    });

  } catch (error) {
    console.error('Error creating CoBuy order:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '주문 생성 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
