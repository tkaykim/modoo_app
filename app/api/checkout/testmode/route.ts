import { createClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import {
  extractImageUrlsFromCanvasState,
  type TextSvgExports,
} from '@/lib/canvas-svg-export';
import { FontMetadata } from '@/lib/fontUtils';

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
  // Customer note & attachments
  customer_note?: string | null;
  attachment_urls?: string[] | null;
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
}

interface TestModeRequestBody {
  orderData: OrderData;
  cartItems: CartItem[];
}

export async function POST(request: NextRequest) {
  try {
    // Check if test mode is enabled (server-side check)
    const isTestMode = process.env.TESTMODE === 'true';
    if (!isTestMode) {
      return NextResponse.json(
        { success: false, error: 'Test mode is not enabled.' },
        { status: 403 }
      );
    }

    const body = await request.json() as TestModeRequestBody;
    const { orderData, cartItems } = body;

    // Validate required fields
    if (!orderData || !cartItems) {
      return NextResponse.json(
        { success: false, error: '주문 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = await createClient();

    // Get current user (optional - for guest checkout support)
    const { data: { user } } = await supabase.auth.getUser();

    // Insert order into database with dummy payment data
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
        payment_method: 'toss', // Use 'toss' to pass DB constraint (test mode uses dummy payment_key)
        payment_key: `TESTMODE-${Date.now()}`, // Prefix with TESTMODE to identify test orders
        payment_status: 'completed',
        order_status: 'payment_completed',
        // Customer note & attachments
        customer_note: orderData.customer_note || null,
        attachment_urls: orderData.attachment_urls || [],
      })
      .select()
      .single();

    if (orderError) {
      return NextResponse.json(
        {
          success: false,
          error: '주문 생성에 실패했습니다.',
          details: orderError.message || String(orderError),
          code: orderError.code
        },
        { status: 500 }
      );
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
          color_selections: savedDesign?.color_selections || {},
          thumbnail_url: savedDesign?.preview_url || item.thumbnail_url || null,
          image_urls: savedDesign?.image_urls || {},
          text_svg_exports: savedDesign?.text_svg_exports,
          custom_fonts: savedDesign?.custom_fonts || [],
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
      // Order was created but items failed - log for manual reconciliation
      return NextResponse.json(
        {
          success: false,
          error: '주문 상품 정보 저장에 실패했습니다.',
          details: itemsError.message || String(itemsError),
          code: itemsError.code,
          orderId: order.id
        },
        { status: 500 }
      );
    }

    // Export text objects to SVG for each order item
    // This only happens at order creation, avoiding unnecessary uploads
    for (const item of insertedItems || []) {
      try {
        // Check if item has canvas state with content
        if (item.canvas_state && typeof item.canvas_state === 'object') {
          // Canvas state is a map of side IDs to canvas state objects
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const canvasStateMap = item.canvas_state as Record<string, any>;

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

          // Extract image URLs from canvas state
          const imageUrls = extractImageUrlsFromCanvasState(canvasStateMap);

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

            await supabase
              .from('order_items')
              .update(updates)
              .eq('id', item.id)
              .select();
          }
        }
      } catch (error) {
        // Log error but don't fail the order
        console.error(`Error exporting SVG for item ${item.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      testMode: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '주문 처리 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.stack : String(error)
      },
      { status: 500 }
    );
  }
}
