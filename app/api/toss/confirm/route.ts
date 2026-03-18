import { createClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import {
  extractImageUrlsFromCanvasState,
  type TextSvgExports,
} from '@/lib/canvas-svg-export';
import { FontMetadata } from '@/lib/fontUtils';
import { sendOrderNotificationEmails } from '@/lib/notifications/order';

const widgetSecretKey = process.env.TOSS_SECRET_KEY;

// Type definitions for request body
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
  // Coupon data
  coupon_usage_id: string | null;
  coupon_discount: number;
  // Customer note & attachments
  customer_note: string | null;
  attachment_urls: string[] | null;
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
  // Guest checkout: inline design data (no saved_designs DB row)
  colorSelections?: Record<string, unknown>;
  textSvgExports?: TextSvgExports;
  customFonts?: FontMetadata[];
}

interface PaymentRequestBody {
  orderId: string;
  amount: number;
  paymentKey: string;
  orderData: OrderData;
  cartItems: CartItem[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as PaymentRequestBody;
    const { orderId, amount, paymentKey, orderData, cartItems } = body;

    // Validate required fields
    if (!orderId || !amount || !paymentKey) {
      return NextResponse.json(
        { success: false, error: '필수 결제 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    if (!orderData || !cartItems) {
      return NextResponse.json(
        { success: false, error: '주문 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // Confirm payment with Toss Payments API
    const tossResponse = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${widgetSecretKey}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId,
        amount,
        paymentKey,
      }),
    });

    const tossData = await tossResponse.json();

    if (!tossResponse.ok) {
      console.error('Toss payment confirmation failed:', tossData);
      return NextResponse.json(
        {
          success: false,
          error: tossData.message || '결제 확인에 실패했습니다.',
          code: tossData.code,
        },
        { status: tossResponse.status }
      );
    }

    // Create Supabase client
    const supabase = await createClient();

    // Get current user (optional - for guest checkout support)
    const { data: { user } } = await supabase.auth.getUser();

    // Insert order into database
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
        payment_method: 'toss',
        payment_key: paymentKey,
        payment_status: 'completed',
        order_status: 'payment_completed',
        // Coupon data
        coupon_usage_id: orderData.coupon_usage_id || null,
        coupon_discount: orderData.coupon_discount || 0,
        // Customer note & attachments
        customer_note: orderData.customer_note || null,
        attachment_urls: orderData.attachment_urls || [],
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order creation error:', orderError);
      // TODO: Handle payment refund if order creation fails
      return NextResponse.json(
        { success: false, error: '주문 생성에 실패했습니다.' },
        { status: 500 }
      );
    }

    // Mark coupon as used if a coupon was applied
    if (orderData.coupon_usage_id && user?.id) {
      try {
        // Update coupon usage record
        const { error: usageError } = await supabase
          .from('coupon_usages')
          .update({
            used_at: new Date().toISOString(),
            order_id: order.id,
            discount_applied: orderData.coupon_discount,
          })
          .eq('id', orderData.coupon_usage_id)
          .eq('user_id', user.id);

        if (usageError) {
          console.error('Error updating coupon usage:', usageError);
          // Don't fail the order, just log the error
        } else {
          // Increment coupon current_uses
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
        // Don't fail the order for coupon errors
      }
    }

    // Fetch all unique saved_designs for cart items that have design_id
    const uniqueDesignIds = [...new Set(cartItems
      .map(item => item.saved_design_id)
      .filter((id): id is string => id !== undefined && id !== null))];

    const savedDesignsMap = new Map<string, {
      title: string;
      color_selections: Record<string, unknown>;
      canvas_state: Record<string, unknown>;
      preview_url: string | null;
      image_urls: Record<string, unknown>;
      text_svg_exports?: TextSvgExports;
      custom_fonts?: FontMetadata[];
    }>();

    // Fetch saved designs from database if there are any
    if (uniqueDesignIds.length > 0) {
      const { data: savedDesigns, error: designsError } = await supabase
        .from('saved_designs')
        .select('id, title, color_selections, canvas_state, preview_url, image_urls, text_svg_exports, custom_fonts')
        .in('id', uniqueDesignIds);

      if (designsError) {
        console.error('Error fetching saved designs:', designsError);
      } else if (savedDesigns) {
        savedDesigns.forEach(design => {
          savedDesignsMap.set(design.id, {
            title: design.title || '',
            color_selections: design.color_selections || {},
            canvas_state: design.canvas_state || {},
            preview_url: design.preview_url || null,
            image_urls: design.image_urls || {},
            text_svg_exports: design.text_svg_exports as TextSvgExports | undefined,
            custom_fonts: (design.custom_fonts as FontMetadata[]) || [],
          });
        });
      }
    }

    // Group cart items by design_id to combine different options into single order items
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

    // Group items by design_id (or product_id if no design)
    for (const item of cartItems) {
      const groupKey = item.saved_design_id || `no-design-${item.product_id}`;

      if (groupedItems.has(groupKey)) {
        // Add variant to existing group
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
        // Get saved design data if available
        const savedDesign = item.saved_design_id ? savedDesignsMap.get(item.saved_design_id) : null;

        // Create new group
        groupedItems.set(groupKey, {
          product_id: item.product_id,
          product_title: item.product_title,
          design_id: item.saved_design_id || null,
          design_title: savedDesign?.title || null,
          canvas_state: savedDesign?.canvas_state || item.canvasState || {},
          color_selections: savedDesign?.color_selections || item.colorSelections || {},
          thumbnail_url: savedDesign?.preview_url || item.thumbnail_url || null,
          image_urls: savedDesign?.image_urls || {},
          text_svg_exports: savedDesign?.text_svg_exports || item.textSvgExports,
          custom_fonts: savedDesign?.custom_fonts || item.customFonts || [],
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

    // Convert grouped items to order items format
    const orderItems = Array.from(groupedItems.values()).map((group) => {
      // Calculate total quantity across all variants
      const totalQuantity = group.variants.reduce((sum, variant) => sum + variant.quantity, 0);

      return {
        order_id: order.id,
        product_id: group.product_id,
        product_title: group.product_title,
        quantity: totalQuantity,
        price_per_item: group.price_per_item,
        design_id: group.design_id,
        design_title: group.design_title,
        product_variant_id: null, // For future variant support
        canvas_state: group.canvas_state,
        color_selections: group.color_selections,
        item_options: {
          variants: group.variants,
        },
        thumbnail_url: group.thumbnail_url,
        image_urls: group.image_urls,
        custom_fonts: group.custom_fonts || [], // Include custom fonts in order
      };
    });

    const { data: insertedItems, error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)
      .select();

    if (itemsError) {
      console.error('Order items creation error:', itemsError);
      // Order was created but items failed - log for manual reconciliation
      return NextResponse.json(
        {
          success: false,
          error: '주문 상품 정보 저장에 실패했습니다.',
          orderId: order.id
        },
        { status: 500 }
      );
    }

    // Export text objects to SVG for each order item
    // This only happens at order creation, avoiding unnecessary uploads
    console.log('Starting SVG export for order items...');
    console.log('Total items to process:', insertedItems?.length || 0);

    for (const item of insertedItems || []) {
      try {
        console.log(`Processing item ${item.id}...`);

        // Check if item has canvas state with content
        if (item.canvas_state && typeof item.canvas_state === 'object') {
          // Canvas state is a map of side IDs to canvas state objects
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const canvasStateMap = item.canvas_state as Record<string, any>;

          console.log(`Canvas state sides for item ${item.id}:`, Object.keys(canvasStateMap));

          // Check if the design already has pre-generated SVG exports (from client-side)
          // Find the corresponding group to get text_svg_exports
          const correspondingGroup = Array.from(groupedItems.values()).find(
            group => group.design_id === item.design_id
          );

          // Use pre-generated SVGs from client-side export (generated during design save)
          let svgUrls: TextSvgExports = {};
          if (correspondingGroup?.text_svg_exports &&
            typeof correspondingGroup.text_svg_exports === 'object' &&
            Object.keys(correspondingGroup.text_svg_exports).length > 0) {
            console.log(`Using pre-generated client-side SVG exports for item ${item.id}`);
            svgUrls = correspondingGroup.text_svg_exports as TextSvgExports;
          } else {
            console.log(`No pre-generated SVGs found for item ${item.id}`);
          }

          console.log(`SVG URLs for item ${item.id}:`, svgUrls);

          // Extract image URLs from canvas state
          const imageUrls = extractImageUrlsFromCanvasState(canvasStateMap);

          console.log(`Image URLs extracted for item ${item.id}:`, imageUrls);

          // Update order item with both SVG URLs and image URLs
          const hasData = Object.keys(svgUrls).length > 0 || Object.keys(imageUrls).length > 0;

          if (hasData) {
            const updates: { text_svg_exports?: TextSvgExports; image_urls?: Record<string, unknown> } = {};

            if (Object.keys(svgUrls).length > 0) {
              updates.text_svg_exports = svgUrls;
            }

            if (Object.keys(imageUrls).length > 0) {
              updates.image_urls = imageUrls;
            }

            console.log(`Updating item ${item.id} with:`, JSON.stringify(updates, null, 2));

            const { data: updatedData, error: updateError } = await supabase
              .from('order_items')
              .update(updates)
              .eq('id', item.id)
              .select();

            if (updateError) {
              console.error(`Failed to update file URLs for item ${item.id}:`, updateError);
            } else {
              console.log(`Successfully updated item ${item.id}. Updated data:`, updatedData);
            }
          } else {
            console.log(`No files to export for item ${item.id}`);
          }
        } else {
          console.log(`Item ${item.id} has no canvas state`);
        }
      } catch (error) {
        // Log error but don't fail the order
        console.error(`Error exporting SVG for item ${item.id}:`, error);
        if (error instanceof Error) {
          console.error(`Error stack:`, error.stack);
        }
      }
    }

    // Send order notification emails (non-blocking)
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
      paymentData: tossData,
    });
  } catch (error) {
    console.error('Payment confirmation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '결제 처리 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}
