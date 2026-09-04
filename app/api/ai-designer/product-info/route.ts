import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { loadProductSides } from '@/lib/aiDesigner/serverGeometry';
import { DEFAULT_VARSITY_PRICING } from '@/lib/aiDesigner/varsityPricing';

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

  // 부위별 색상 레이어(바시티 자켓류): 위저드 대신 디자이너 상담 접수로 보내기 위한 정보
  const { data: productRow } = await admin.from('products').select('configuration').eq('id', productId).single();
  type RawLayer = { id: string; name?: string; imageUrl?: string; zIndex?: number; colorOptions?: Array<{ name?: string; hex?: string; colorCode?: string }> };
  type RawSide = { id: string; name?: string; layers?: RawLayer[] };
  const rawSides = (Array.isArray(productRow?.configuration) ? productRow.configuration : []) as RawSide[];
  const partLayers = rawSides
    .filter((s) => Array.isArray(s.layers) && s.layers.length > 0)
    .map((s) => {
      const geo = loaded.sides.find((ls) => ls.geometry.sideId === s.id)?.geometry;
      return {
        sideId: s.id,
        sideName: s.name || s.id,
        imgW: geo?.imgW ?? 0,
        imgH: geo?.imgH ?? 0,
        layers: [...(s.layers ?? [])]
          .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
          .map((l) => ({
            id: l.id,
            name: l.name || l.id,
            imageUrl: l.imageUrl ?? null,
            zIndex: l.zIndex ?? 0,
            colorOptions: (l.colorOptions ?? [])
              .filter((c) => typeof c.hex === 'string' && c.hex)
              .map((c) => ({ name: c.name ?? c.colorCode ?? '', hex: c.hex as string, colorCode: c.colorCode ?? '' })),
          })),
      };
    });
  const intakeOnly = partLayers.length > 0;
  let presetLayerColors: Record<string, Record<string, string>> | null = null;
  if (intakeOnly) {
    const { data: preset } = await admin
      .from('design_templates')
      .select('layer_colors')
      .eq('product_id', productId)
      .eq('type', 'cobuy_preset')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    presetLayerColors = (preset?.layer_colors as Record<string, Record<string, string>> | null) ?? null;
  }

  return NextResponse.json({
    product: loaded.product,
    intakeOnly,
    partLayers,
    presetLayerColors,
    // 과잠 빌더 견적 규칙(슬롯형 패키지가). 클라 견적 패널과 서버 주문 경로가 같은 표를 쓴다.
    pricing: intakeOnly ? DEFAULT_VARSITY_PRICING : null,
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
