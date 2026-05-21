import { createClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import {
  extractImageUrlsFromCanvasState,
  type TextSvgExports,
} from '@/lib/canvas-svg-export';
import { FontMetadata } from '@/lib/fontUtils';
import { sendOrderNotificationEmails } from '@/lib/notifications/order';
import { validateOrderPricing } from '@/lib/orderPricingValidator';
import { insertDesignerRequestsForOrder } from '@/lib/designerRequest';
import { getOrderUtmAttribution } from '@/lib/server-analytics';

interface OrderData {
  id: string;
  name: string;
  email: string;
  phone_num: string;
  address: string | null;
  country_code: string | null;
  state: string | null;
  city: string | null;
  postal_code: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  shipping_method: 'domestic' | 'international' | 'pickup';
  delivery_fee: number;
  total_amount: number;
  coupon_usage_id: string | null;
  salesman_coupon_id?: string | null;
  salesman_coupon_usage_id?: string | null;
  salesman_discount_amount?: number | null;
  coupon_discount: number;
  customer_note: string | null;
  attachment_urls: string[] | null;
}

interface BankTransferData {
  invoice_requested: boolean;
  invoice_email: string | null;
  biz_registration_url: string | null;
}

interface CartItem {
  id: string;
  product_id: string;
  saved_design_id?: string;
  product_title: string;
  product_color: string;
  product_color_name: string;
  product_color_code?: string;
  size_id: string;
  size_name: string;
  quantity: number;
  price_per_item: number;
  thumbnail_url?: string;
  partner_mall_id?: string | null;
  canvasState?: Record<string, unknown>;
  colorSelections?: Record<string, unknown>;
  textSvgExports?: TextSvgExports;
  customFonts?: FontMetadata[];
  retouchRequested?: boolean;
}

interface BankTransferRequestBody {
  orderData: OrderData;
  cartItems: CartItem[];
  bankTransferData: BankTransferData;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as BankTransferRequestBody;
    const { orderData, cartItems, bankTransferData } = body;

    if (!orderData || !cartItems) {
      return NextResponse.json(
        { success: false, error: '주문 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 가격 위변조 방지: 무통장 입금 흐름도 동일한 서버 검증을 거친다.
    const pricingResult = await validateOrderPricing({
      cartItems: cartItems.map((it) => ({
        product_id: it.product_id,
        saved_design_id: it.saved_design_id,
        quantity: it.quantity,
        price_per_item: it.price_per_item,
        partner_mall_id: it.partner_mall_id ?? null,
      })),
      orderData: {
        shipping_method: orderData.shipping_method,
        delivery_fee: orderData.delivery_fee,
        total_amount: orderData.total_amount,
        coupon_discount: orderData.coupon_discount,
        salesman_discount_amount: orderData.salesman_discount_amount ?? 0,
      },
    });
    if (!pricingResult.ok) {
      console.error('[checkout/bank-transfer] price validation failed:', pricingResult);
      return NextResponse.json(
        { success: false, error: pricingResult.message, code: pricingResult.code },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Build notes JSON with bank transfer metadata
    const bankTransferNotes = JSON.stringify({
      invoice_requested: bankTransferData?.invoice_requested || false,
      invoice_email: bankTransferData?.invoice_email || null,
      biz_registration_url: bankTransferData?.biz_registration_url || null,
    });

    const customerNoteWithBankInfo = orderData.customer_note
      ? `${orderData.customer_note}\n---\n[계좌이체 정보] ${bankTransferNotes}`
      : `[계좌이체 정보] ${bankTransferNotes}`;

    // 카트에 담긴 첫 partner_mall_id를 주문에 귀속. 여러 mall이 섞여 있어도 차단/경고 없이 첫 row 사용.
    const cartFirstMallId =
      cartItems.find((it) => it.partner_mall_id)?.partner_mall_id ?? null;
    let mallSalesmanId: string | null = null;
    if (cartFirstMallId) {
      const tmpAdmin = createAdminClient();
      const { data: mallRow } = await tmpAdmin
        .from('partner_malls')
        .select('salesman_id, is_active')
        .eq('id', cartFirstMallId)
        .maybeSingle();
      if (mallRow && mallRow.is_active === false) {
        return NextResponse.json(
          { success: false, error: '비활성화된 파트너몰의 상품은 주문할 수 없습니다.' },
          { status: 400 }
        );
      }
      mallSalesmanId = (mallRow?.salesman_id as string | null) ?? null;
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        id: orderData.id,
        user_id: user?.id || null,
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
        total_amount: orderData.total_amount,
        payment_method: 'bank_transfer',
        payment_key: null,
        payment_status: 'pending',
        order_status: 'payment_pending',
        coupon_usage_id: orderData.coupon_usage_id || null,
        coupon_discount: orderData.coupon_discount || 0,
        salesman_coupon_id: orderData.salesman_coupon_id || null,
        salesman_discount_amount: orderData.salesman_discount_amount || 0,
        customer_note: customerNoteWithBankInfo,
        attachment_urls: orderData.attachment_urls || [],
        // 파트너몰 경유 시 mall + 영업사원 자동 귀속. 쿠폰 블록(아래 ~L203)이 있으면 salesman_id를 덮어씀(쿠폰 우선).
        partner_mall_id: cartFirstMallId,
        salesman_id: mallSalesmanId,
        // 광고 attribution (utm/fbclid) — 결제 시점 쿠키에서 캡처
        ...getOrderUtmAttribution(request),
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order creation error:', orderError);
      return NextResponse.json(
        { success: false, error: '주문 생성에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 일반 + 영업사원 쿠폰 사용 처리 (각각 독립적)
    const adminClient = createAdminClient();

    if (orderData.coupon_usage_id) {
      try {
        const { data: usage } = await adminClient
          .from('coupon_usages')
          .update({
            used_at: new Date().toISOString(),
            order_id: order.id,
            discount_applied: orderData.coupon_discount,
          })
          .eq('id', orderData.coupon_usage_id)
          .select('coupon_id')
          .single();
        if (usage?.coupon_id) {
          const { data: coupon } = await adminClient
            .from('coupons').select('current_uses').eq('id', usage.coupon_id).single();
          if (coupon) {
            await adminClient
              .from('coupons')
              .update({ current_uses: (coupon.current_uses || 0) + 1 })
              .eq('id', usage.coupon_id);
          }
          await adminClient
            .from('orders')
            .update({ applied_coupon_id: usage.coupon_id })
            .eq('id', order.id);
        }
      } catch (e) {
        console.error('[bank-transfer] general coupon processing failed:', e);
      }
    }

    if (orderData.salesman_coupon_usage_id) {
      try {
        const { data: usage } = await adminClient
          .from('coupon_usages')
          .update({
            used_at: new Date().toISOString(),
            order_id: order.id,
            discount_applied: orderData.salesman_discount_amount || 0,
          })
          .eq('id', orderData.salesman_coupon_usage_id)
          .select('coupon_id')
          .single();
        if (usage?.coupon_id) {
          const { data: coupon } = await adminClient
            .from('coupons')
            .select('current_uses, salesman_profile_id')
            .eq('id', usage.coupon_id)
            .single();
          if (coupon) {
            await adminClient
              .from('coupons')
              .update({ current_uses: (coupon.current_uses || 0) + 1 })
              .eq('id', usage.coupon_id);
            if (coupon.salesman_profile_id) {
              await adminClient
                .from('orders')
                .update({
                  salesman_id: coupon.salesman_profile_id,
                  salesman_coupon_id: usage.coupon_id,
                })
                .eq('id', order.id);
            }
          }
        }
      } catch (e) {
        console.error('[bank-transfer] salesman coupon processing failed:', e);
      }
    }

    // Fetch saved designs
    const uniqueDesignIds = [...new Set(cartItems
      .map(item => item.saved_design_id)
      .filter((id): id is string => id !== undefined && id !== null && !id.startsWith('guest-')))];

    const savedDesignsMap = new Map<string, {
      title: string;
      color_selections: Record<string, unknown>;
      canvas_state: Record<string, unknown>;
      preview_url: string | null;
      image_urls: Record<string, unknown>;
      text_svg_exports?: TextSvgExports;
      custom_fonts?: FontMetadata[];
      retouch_requested?: boolean;
    }>();

    if (uniqueDesignIds.length > 0) {
      const { data: savedDesigns } = await supabase
        .from('saved_designs')
        .select('id, title, color_selections, canvas_state, preview_url, image_urls, text_svg_exports, custom_fonts, retouch_requested')
        .in('id', uniqueDesignIds);

      savedDesigns?.forEach(design => {
        savedDesignsMap.set(design.id, {
          title: design.title || '',
          color_selections: design.color_selections || {},
          canvas_state: design.canvas_state || {},
          preview_url: design.preview_url || null,
          image_urls: design.image_urls || {},
          text_svg_exports: design.text_svg_exports as TextSvgExports | undefined,
          custom_fonts: (design.custom_fonts as FontMetadata[]) || [],
          retouch_requested: design.retouch_requested || false,
        });
      });
    }

    // Group cart items by design_id
    const groupedItems = new Map<string, {
      product_id: string;
      product_title: string;
      design_id: string | null;
      design_title: string | null;
      canvas_state: Record<string, unknown>;
      color_selections: Record<string, unknown>;
      thumbnail_url: string | null;
      price_per_item: number;
      image_urls: Record<string, unknown>;
      text_svg_exports?: TextSvgExports;
      custom_fonts?: FontMetadata[];
      retouch_requested: boolean;
      variants: Array<{
        size_id: string;
        size_name: string;
        color_id: string;
        color_name: string;
        color_hex: string;
        color_code?: string;
        quantity: number;
      }>;
    }>();

    for (const item of cartItems) {
      const groupKey = item.saved_design_id || `no-design-${item.product_id}`;

      if (groupedItems.has(groupKey)) {
        const group = groupedItems.get(groupKey)!;
        group.variants.push({
          size_id: item.size_id,
          size_name: item.size_name,
          color_id: item.product_color,
          color_name: item.product_color_name,
          color_hex: item.product_color,
          color_code: item.product_color_code,
          quantity: item.quantity,
        });
      } else {
        const isGuestDesignId = item.saved_design_id?.startsWith('guest-');
        const savedDesign = (item.saved_design_id && !isGuestDesignId) ? savedDesignsMap.get(item.saved_design_id) : null;

        groupedItems.set(groupKey, {
          product_id: item.product_id,
          product_title: item.product_title,
          design_id: (item.saved_design_id && !isGuestDesignId) ? item.saved_design_id : null,
          design_title: savedDesign?.title || null,
          canvas_state: savedDesign?.canvas_state || item.canvasState || {},
          color_selections: savedDesign?.color_selections || item.colorSelections || { productColor: item.product_color },
          thumbnail_url: savedDesign?.preview_url || item.thumbnail_url || null,
          image_urls: savedDesign?.image_urls || {},
          text_svg_exports: savedDesign?.text_svg_exports || item.textSvgExports,
          custom_fonts: savedDesign?.custom_fonts || item.customFonts || [],
          retouch_requested: savedDesign?.retouch_requested || item.retouchRequested || false,
          price_per_item: item.price_per_item,
          variants: [{
            size_id: item.size_id,
            size_name: item.size_name,
            color_id: item.product_color,
            color_name: item.product_color_name,
            color_hex: item.product_color,
            color_code: item.product_color_code,
            quantity: item.quantity,
          }],
        });
      }
    }

    const orderItems = Array.from(groupedItems.values()).map((group) => {
      const totalQuantity = group.variants.reduce((sum, variant) => sum + variant.quantity, 0);
      return {
        order_id: order.id,
        product_id: group.product_id,
        product_title: group.product_title,
        quantity: totalQuantity,
        price_per_item: group.price_per_item,
        design_id: group.design_id,
        design_title: group.design_title,
        product_variant_id: null,
        canvas_state: group.canvas_state,
        color_selections: group.color_selections,
        item_options: { variants: group.variants },
        thumbnail_url: group.thumbnail_url,
        image_urls: group.image_urls,
        custom_fonts: group.custom_fonts || [],
        retouch_requested: group.retouch_requested,
      };
    });

    const { data: insertedItems, error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)
      .select();

    if (itemsError) {
      console.error('Order items creation error:', itemsError);
      // 무통장은 결제가 PG로 빠지지 않은 상태이므로 보상 단순화: 빈 주문 행을 정리.
      try {
        await createAdminClient().from('orders').delete().eq('id', order.id);
      } catch (compErr) {
        console.error('[bank-transfer] orphan order cleanup failed:', compErr);
      }
      return NextResponse.json(
        { success: false, error: '주문 상품 정보 저장에 실패했습니다.', orderId: order.id },
        { status: 500 }
      );
    }

    // Process SVG exports for each order item
    for (const item of insertedItems || []) {
      try {
        if (item.canvas_state && typeof item.canvas_state === 'object') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const canvasStateMap = item.canvas_state as Record<string, any>;
          const correspondingGroup = Array.from(groupedItems.values()).find(
            group => group.design_id === item.design_id
          );

          let svgUrls: TextSvgExports = {};
          if (correspondingGroup?.text_svg_exports &&
            typeof correspondingGroup.text_svg_exports === 'object' &&
            Object.keys(correspondingGroup.text_svg_exports).length > 0) {
            svgUrls = correspondingGroup.text_svg_exports as TextSvgExports;
          }

          const imageUrls = extractImageUrlsFromCanvasState(canvasStateMap);
          const hasData = Object.keys(svgUrls).length > 0 || Object.keys(imageUrls).length > 0;

          if (hasData) {
            const updates: { text_svg_exports?: TextSvgExports; image_urls?: Record<string, unknown> } = {};
            if (Object.keys(svgUrls).length > 0) updates.text_svg_exports = svgUrls;
            if (Object.keys(imageUrls).length > 0) updates.image_urls = imageUrls;

            await supabase
              .from('order_items')
              .update(updates)
              .eq('id', item.id);
          }
        }
      } catch (error) {
        console.error(`Error exporting SVG for item ${item.id}:`, error);
      }
    }

    // Designer-pending placeholders → designer_requests row insert.
    try {
      await insertDesignerRequestsForOrder(supabase, {
        orderId: order.id,
        designId: null,
        requesterUserId: user?.id ?? null,
        requesterName: orderData.name,
        requesterContact: orderData.email || orderData.phone_num,
        requestNote: customerNoteWithBankInfo ?? null,
        orderItems: (insertedItems ?? []).map((it) => ({
          canvas_state: it.canvas_state as Record<string, unknown> | null | undefined,
        })),
      });
    } catch (designerErr) {
      console.error('[bank-transfer] designer_requests insert failed:', designerErr);
    }

    // Send notification emails (non-blocking)
    try {
      const notificationItems = Array.from(groupedItems.values()).map((group) => ({
        product_title: group.product_title,
        quantity: group.variants.reduce((sum, v) => sum + v.quantity, 0),
        price_per_item: group.price_per_item,
      }));

      await sendOrderNotificationEmails({
        orderId: order.id,
        customerName: orderData.name,
        customerEmail: orderData.email,
        customerPhone: orderData.phone_num,
        totalAmount: orderData.total_amount,
        deliveryFee: orderData.delivery_fee,
        couponDiscount: orderData.coupon_discount || 0,
        shippingMethod: orderData.shipping_method,
        orderCategory: 'regular',
        items: notificationItems,
      });
    } catch (emailError) {
      console.error('Order notification email error:', emailError);
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
    });
  } catch (error) {
    console.error('Bank transfer order error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '주문 처리 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}
