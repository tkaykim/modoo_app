import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';
import { createHmac } from 'crypto';

// 시안은 디자이너가 수시로 갱신한다 — 항상 DB 최신본을 읽어 캐시 stale("최초저장본만 보임")을 방지.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function verifyDesignToken(token: string, orderId: string): boolean {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString());
    if (decoded.o !== orderId) return false;
    if (decoded.exp < Date.now()) return false;

    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback-secret';
    const payload = `design|${decoded.oi}|${decoded.o}|${decoded.exp}`;
    const expectedSig = createHmac('sha256', secret).update(payload).digest('base64url');
    return expectedSig === decoded.sig;
  } catch {
    return false;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    const supabase = await createClient();
    let authorized = false;

    if (token && verifyDesignToken(token, orderId)) {
      authorized = true;
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: order } = await supabase
          .from('orders')
          .select('id')
          .eq('id', orderId)
          .eq('user_id', user.id)
          .single();
        if (order) authorized = true;
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    // 인증(토큰 또는 세션 소유) 통과 후 service-role 로 읽는다.
    // order_items RLS 는 비로그인(anon) + 회원주문(user_id 있음)에 0건을 반환하므로,
    // 토큰이 권한 증명인 이 흐름에선 admin 클라이언트로 읽어야 시안이 보인다.
    const db = createAdminClient();

    const { data: items, error } = await db
      .from('order_items')
      .select('id, product_id, product_title, design_title, thumbnail_url, design_status, design_shared_at, design_confirmed_at, design_revision_note, canvas_state, color_selections, custom_fonts')
      .eq('order_id', orderId)
      .in('design_status', ['design_shared', 'revision_requested', 'confirmed', 'in_progress'])
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 제품 configuration → sides 를 붙여, 고객 시안 페이지가 평면 썸네일이 아니라
    // 에디터·공장과 100% 동일한 라이브 캔버스(전 면)로 렌더할 수 있게 한다.
    // products 는 공개 데이터이므로 service-role(admin)로 읽어 RLS 변수를 제거.
    const itemList = items || [];
    const productIds = [...new Set(itemList.map(i => i.product_id).filter(Boolean))] as string[];
    const sidesMap = new Map<string, unknown>();
    if (productIds.length > 0) {
      const { data: products } = await db
        .from('products')
        .select('id, configuration')
        .in('id', productIds);
      products?.forEach((p: { id: string; configuration: unknown }) => {
        if (!p.configuration) return;
        const config = typeof p.configuration === 'string' ? JSON.parse(p.configuration) : p.configuration;
        const sides = Array.isArray(config) ? config : (config as { sides?: unknown })?.sides;
        if (Array.isArray(sides) && sides.length > 0) sidesMap.set(p.id, sides);
      });
    }

    const itemsOut = itemList.map((i) => {
      const cs = (i.color_selections || {}) as { productColor?: string };
      return {
        id: i.id,
        product_id: i.product_id,
        product_title: i.product_title,
        design_title: i.design_title,
        thumbnail_url: i.thumbnail_url,
        design_status: i.design_status,
        design_shared_at: i.design_shared_at,
        design_confirmed_at: i.design_confirmed_at,
        design_revision_note: i.design_revision_note,
        // 라이브 정밀 렌더용 (에디터와 동일 경로)
        canvas_state: i.canvas_state ?? null,
        product_color: cs.productColor || '#FFFFFF',
        custom_fonts: i.custom_fonts ?? [],
        product_sides: (i.product_id && sidesMap.get(i.product_id)) || null,
      };
    });

    return NextResponse.json({ items: itemsOut });
  } catch (error) {
    console.error('Error fetching design items:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
