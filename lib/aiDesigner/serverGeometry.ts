/**
 * AI 디자이너 — 서버측 면 지오메트리 로더.
 * products.configuration(sides) + product_calibrations(mm 실측) + 목업 원본 px.
 * SingleSideCanvas의 환산 우선순위를 미러링한다:
 *   nativeMmPerPx = 캘리브 printAreaRealMm 실측 → 상품설정 printAreaWidthMm → 캘리브 선분 → 짝면/아무면 차용 → 0
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchImageDims } from './imageDims';
import type { SideGeometry } from './placement';

interface RawSide {
  id: string;
  name?: string;
  imageUrl?: string;
  zoomScale?: number;
  printArea?: { x: number; y: number; width: number; height: number };
  realLifeDimensions?: { printAreaWidthMm?: number };
  layers?: Array<{ id: string; imageUrl?: string; zIndex?: number }>;
}

interface CalEntry {
  lineMmPerPx: number;
  printAreaWidthMm: number | null;
  anchors: Array<{ id: string; label?: string; xMm: number; yMm: number; recommendedWidthMm: number; recommendedHeightMm: number }>;
}

const SIDE_PARTNER: Record<string, string> = {
  front: 'back', back: 'front',
  left: 'right', right: 'left',
  'sleeve-left': 'sleeve-right', 'sleeve-right': 'sleeve-left',
  'side-left': 'side-right', 'side-right': 'side-left',
};

function calFromPayload(payload: Record<string, unknown> | null): CalEntry {
  const out: CalEntry = { lineMmPerPx: 0, printAreaWidthMm: null, anchors: [] };
  if (!payload) return out;
  const pa = payload.printAreaRealMm as { widthMm?: number | null } | undefined;
  if (pa?.widthMm && pa.widthMm > 0) out.printAreaWidthMm = pa.widthMm;
  const mockup = payload.mockup as { lines?: Array<{ measuredMm: number; active?: boolean; p1: { xPx: number; yPx: number }; p2: { xPx: number; yPx: number } }> } | undefined;
  const lines = mockup?.lines ?? [];
  const line = lines.find((l) => l.active) ?? lines[0];
  if (line && line.measuredMm > 0) {
    const dx = line.p2.xPx - line.p1.xPx;
    const dy = line.p2.yPx - line.p1.yPx;
    const px = Math.sqrt(dx * dx + dy * dy);
    if (px > 0) out.lineMmPerPx = line.measuredMm / px;
  }
  const anchors = payload.registeredAnchors as CalEntry['anchors'] | undefined;
  if (Array.isArray(anchors)) out.anchors = anchors;
  return out;
}

export interface LoadedSide {
  geometry: SideGeometry;
  name: string;
  mockupUrl: string;
  anchors: CalEntry['anchors'];
}

export async function loadProductSides(
  admin: SupabaseClient,
  productId: string
): Promise<{ sides: LoadedSide[]; product: { id: string; title: string; base_price: number; size_options: unknown } } | null> {
  const { data: product } = await admin
    .from('products')
    .select('id, title, base_price, configuration, size_options')
    .eq('id', productId)
    .single();
  if (!product) return null;

  const rawSides = (Array.isArray(product.configuration) ? product.configuration : []) as RawSide[];
  const { data: calRows } = await admin
    .from('product_calibrations')
    .select('side_id, payload')
    .eq('product_id', productId);
  const calMap = new Map<string, CalEntry>();
  for (const row of calRows ?? []) {
    calMap.set(row.side_id as string, calFromPayload(row.payload as Record<string, unknown> | null));
  }

  const sides: LoadedSide[] = [];
  for (const side of rawSides) {
    // 목업 URL: 레거시 imageUrl 또는 첫 레이어
    const layerUrl = side.layers?.slice().sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))[0]?.imageUrl;
    const mockupUrl = side.imageUrl || layerUrl;
    if (!mockupUrl || !side.printArea || side.printArea.width <= 0) continue;
    const dims = await fetchImageDims(mockupUrl);
    if (!dims) continue;

    // 환산 계수 결정 (SingleSideCanvas와 동일 우선순위 + 짝면 차용)
    let cal = calMap.get(side.id);
    const partnerCal = calMap.get(SIDE_PARTNER[side.id] ?? '');
    const anyCal = calMap.values().next().value as CalEntry | undefined;
    const borrowed = cal?.lineMmPerPx || cal?.printAreaWidthMm ? cal : partnerCal ?? anyCal;
    if (!cal) cal = borrowed;

    const paWidthPx = side.printArea.width;
    const paFromCal = cal?.printAreaWidthMm && paWidthPx > 0 ? cal.printAreaWidthMm / paWidthPx : 0;
    const paFromConfig =
      side.realLifeDimensions?.printAreaWidthMm && paWidthPx > 0
        ? side.realLifeDimensions.printAreaWidthMm / paWidthPx
        : 0;
    const nativeMmPerPx =
      paFromCal > 0 ? paFromCal : paFromConfig > 0 ? paFromConfig : cal?.lineMmPerPx || borrowed?.lineMmPerPx || 0;

    sides.push({
      geometry: {
        sideId: side.id,
        imgW: dims.w,
        imgH: dims.h,
        zoomScale: side.zoomScale || 1,
        printArea: side.printArea,
        nativeMmPerPx,
      },
      name: side.name || side.id,
      mockupUrl,
      anchors: calMap.get(side.id)?.anchors ?? [],
    });
  }
  return {
    sides,
    product: {
      id: product.id as string,
      title: product.title as string,
      base_price: Number(product.base_price) || 0,
      size_options: product.size_options,
    },
  };
}
