import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE_URL = 'https://modoouniform.com';

// 문의에 연결된 주문(간이주문 등)을 "구매 카드" 데이터로 반환.
// 반환 필드는 고객에게 노출해도 되는 구매 안내용(제품·가격·결제링크·상태)뿐.
export async function GET(req: NextRequest) {
  const inquiryId = req.nextUrl.searchParams.get('inquiryId');
  if (!inquiryId) return NextResponse.json({ data: [] });

  const sb = createAdminClient();

  const { data: orders, error } = await sb
    .from('orders')
    .select('id, order_category, total_amount, payment_status, order_status, payment_link_token, created_at')
    .eq('inquiry_id', inquiryId)
    .order('created_at', { ascending: true });

  if (error || !orders || orders.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const orderIds = orders.map((o) => o.id);
  const { data: items } = await sb
    .from('order_items')
    .select('order_id, product_id, product_title, thumbnail_url, price_per_item, quantity, design_id')
    .in('order_id', orderIds);

  const productIds = [...new Set((items || []).map((i) => i.product_id).filter((x): x is string => !!x))];
  const { data: products } = productIds.length
    ? await sb.from('products').select('id, keywords').in('id', productIds)
    : { data: [] as { id: string; keywords: string[] | null }[] };
  const keywordsByProduct = new Map<string, string[]>(
    (products || []).map((p) => [p.id, ((p.keywords as string[] | null) || []).filter((k: string) => !!k)]),
  );

  const itemsByOrder = new Map<string, typeof items>();
  for (const it of items || []) {
    const arr = itemsByOrder.get(it.order_id) || [];
    arr.push(it);
    itemsByOrder.set(it.order_id, arr);
  }

  const data = orders.map((o) => ({
    orderId: o.id,
    orderCategory: o.order_category,
    paymentStatus: o.payment_status,           // 'pending' | 'completed' | ...
    orderStatus: o.order_status,
    totalAmount: Number(o.total_amount) || 0,
    payUrl: o.payment_link_token ? `${SITE_URL}/order/custom/${o.payment_link_token}` : null,
    items: (itemsByOrder.get(o.id) || []).map((it) => ({
      productTitle: it.product_title,
      thumbnailUrl: it.thumbnail_url,
      unitPrice: Number(it.price_per_item) || 0,
      quantity: it.quantity,
      keywords: it.product_id ? (keywordsByProduct.get(it.product_id) || []) : [],
    })),
  }));

  return NextResponse.json({ data });
}
