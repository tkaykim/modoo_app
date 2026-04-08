import { createClient } from '@/lib/supabase';
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
        customer_note: customerNoteWithBankInfo,
        attachment_urls: orderData.attachment_urls || [],
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

    // Mark coupon as used
    if (orderData.coupon_usage_id && user?.id) {
      try {
        const { error: usageError } = await supabase
          .from('coupon_usages')
          .update({
            used_at: new Date().toISOString(),
            order_id: order.id,
            discount_applied: orderData.coupon_discount,
          })
          .eq('id', orderData.coupon_usage_id)
          .eq('user_id', user.id);

        if (!usageError) {
          const { data: usage } = await supabase
            .from('coupon_usages')
            .select('coupon_id')
            .eq('id', orderData.coupon_usage_id)
            .single();

          if (usage?.coupon_id) {
            const { data: coupon } = await supabase
              .from('coupons')
              .select('current_uses')
              .eq('id', usage.coupon_id)
              .single();

            if (coupon) {
              await supabase
                .from('coupons')
                .update({ current_uses: (coupon.current_uses || 0) + 1 })
                .eq('id', usage.coupon_id);
            }
          }
        }
      } catch (couponError) {
        console.error('Error processing coupon usage:', couponError);
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
