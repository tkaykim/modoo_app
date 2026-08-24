import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { loadProductSides } from '@/lib/aiDesigner/serverGeometry';

export const runtime = 'nodejs';

/**
 * 위저드용 상품 상세: 면 지오메트리(목업·인쇄영역·mm환산·앵커) + 색상 + 사이즈.
 * 클라이언트 합성 미리보기와 서버 canvas_state 빌드가 같은 수치를 쓰게 하는 단일 소스.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const productId = url.searchParams.get('productId');
  if (!productId) return NextResponse.json({ error: 'productId가 필요합니다.' }, { status: 400 });

  const admin = createAdminClient();
  const loaded = await loadProductSides(admin, productId);
  if (!loaded) return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 });

  const { data: colors } = await admin
    .from('product_colors')
    .select('id, side_mockups, sort_order, manufacturer_colors(name, hex, color_code)')
    .eq('product_id', productId)
    .eq('is_active', true)
    .order('sort_order');

  return NextResponse.json({
    product: loaded.product,
    sides: loaded.sides.map((s) => ({
      sideId: s.geometry.sideId,
      name: s.name,
      mockupUrl: s.mockupUrl,
      geometry: s.geometry,
      anchors: s.anchors,
    })),
    colors: (colors ?? []).map((c) => {
      const mc = c.manufacturer_colors as unknown as { name: string; hex: string; color_code: string } | null;
      return {
        id: c.id,
        name: mc?.name ?? '',
        hex: mc?.hex ?? '#FFFFFF',
        code: mc?.color_code ?? '',
        side_mockups: c.side_mockups ?? null,
      };
    }),
  });
}
