import * as fabric from 'fabric';
import type { Product, PartnerMallProductPublic, ProductSide } from '@/types/types';

export interface SidePreview {
  sideId: string;
  sideName: string;
  dataUrl: string;
}

interface CanvasStatePayload {
  version?: string;
  objects?: unknown[];
  layerColors?: Record<string, string>;
}

/**
 * partner_mall_products의 canvas_state(side별) + product.configuration의 sides를 받아
 * 각 side의 합성 미리보기 PNG dataURL을 생성해 돌려준다.
 *
 * - 색상은 partnerMallProduct.color_hex로 multiply 필터 적용
 * - canvas_state[sideId]가 있으면 fabric.loadFromJSON으로 객체를 위에 그림
 * - canvas_state가 없는 side도 제품 mockup은 표시 (디자인 미적용 상태)
 *
 * 클라이언트 전용. fabric.js는 SSR 불가.
 */
export async function renderPartnerMallSidePreviews(
  product: Product,
  partnerMallProduct: PartnerMallProductPublic,
): Promise<SidePreview[]> {
  const sides: ProductSide[] = product.configuration ?? [];
  if (sides.length === 0) return [];

  const colorHex = partnerMallProduct.color_hex || '#FFFFFF';
  const canvasStateMap =
    (partnerMallProduct.canvas_state as Record<string, string | CanvasStatePayload> | undefined) ?? {};

  const out: SidePreview[] = [];

  for (const side of sides) {
    try {
      const dataUrl = await renderSingleSide({
        side,
        colorHex,
        canvasStateRaw: canvasStateMap[side.id],
      });
      out.push({ sideId: side.id, sideName: side.name || side.id, dataUrl });
    } catch (e) {
      console.warn('[renderPartnerMallSidePreviews] side render failed:', side.id, e);
    }
  }

  return out;
}

async function renderSingleSide(opts: {
  side: ProductSide;
  colorHex: string;
  canvasStateRaw: string | CanvasStatePayload | undefined;
}): Promise<string> {
  const { side, colorHex, canvasStateRaw } = opts;

  const canvasW = 500;
  const canvasH = 500;

  const el = document.createElement('canvas');
  el.width = canvasW;
  el.height = canvasH;

  const fabricCanvas = new fabric.Canvas(el, {
    width: canvasW,
    height: canvasH,
    backgroundColor: '#FFFFFF',
    enableRetinaScaling: false,
  });

  try {
    const hasLayers = side.layers && side.layers.length > 0;
    const bgImageUrl = hasLayers ? side.layers![0]?.imageUrl : side.imageUrl;
    if (!bgImageUrl) {
      fabricCanvas.renderAll();
      return fabricCanvas.toDataURL({ format: 'png', quality: 0.85, multiplier: 1 });
    }

    const bgImg = await fabric.FabricImage.fromURL(bgImageUrl, { crossOrigin: 'anonymous' });
    const imgW = bgImg.width || 1;
    const imgH = bgImg.height || 1;
    const baseScale = Math.min(canvasW / imgW, canvasH / imgH);

    bgImg.set({
      scaleX: baseScale,
      scaleY: baseScale,
      originX: 'center',
      originY: 'center',
      left: canvasW / 2,
      top: canvasH / 2,
      selectable: false,
      evented: false,
    });
    bgImg.filters = [
      new fabric.filters.BlendColor({ color: colorHex, mode: 'multiply', alpha: 1 }),
    ];
    bgImg.applyFilters();
    fabricCanvas.add(bgImg);
    fabricCanvas.sendObjectToBack(bgImg);

    // canvas_state로 디자인 객체 추가
    const stateJson = parseCanvasStateRaw(canvasStateRaw);
    const objects = stateJson?.objects;
    if (Array.isArray(objects) && objects.length > 0) {
      // print area 좌표 계산
      const imgLeft = canvasW / 2 - (imgW * baseScale) / 2;
      const imgTop = canvasH / 2 - (imgH * baseScale) / 2;
      // 저장된 객체 좌표는 print area 기준이 아니라 canvas 절대 좌표인 경우가 있고
      // partner mall은 프린트 영역 내부 좌표로 저장하는 케이스도 있음.
      // 여기서는 fabric.util.enlivenObjects로 복원 후 그대로 add.

      const enlivened = await fabric.util.enlivenObjects(objects);
      for (const obj of enlivened as fabric.FabricObject[]) {
        // 저장 시 print area 기준 좌표였다면 canvas 좌표로 보정
        if ((obj as fabric.FabricObject & { left?: number; top?: number }).left !== undefined) {
          // 좌표 보정은 케이스마다 달라 단순 복원만 시도. 위치가 어긋나는 케이스는 추후 정합화.
        }
        obj.selectable = false;
        obj.evented = false;
        fabricCanvas.add(obj);

        // 좌표가 print area 기준 (0~printAreaW)으로 저장된 경우 보정
        const o = obj as fabric.FabricObject & { left?: number; top?: number; scaleX?: number; scaleY?: number };
        if (
          o.left !== undefined && o.top !== undefined &&
          o.left >= 0 && o.left <= side.printArea.width &&
          o.top >= 0 && o.top <= side.printArea.height
        ) {
          // print area 내부 상대 좌표로 보임 → canvas 절대 좌표로 변환
          o.left = imgLeft + side.printArea.x * baseScale + (o.left ?? 0) * baseScale;
          o.top = imgTop + side.printArea.y * baseScale + (o.top ?? 0) * baseScale;
          if (o.scaleX !== undefined) o.scaleX = (o.scaleX ?? 1) * baseScale;
          if (o.scaleY !== undefined) o.scaleY = (o.scaleY ?? 1) * baseScale;
          (obj as fabric.FabricObject).setCoords?.();
        }
      }
    }

    fabricCanvas.renderAll();
    return fabricCanvas.toDataURL({ format: 'png', quality: 0.9, multiplier: 1 });
  } finally {
    fabricCanvas.dispose();
  }
}

function parseCanvasStateRaw(raw: string | CanvasStatePayload | undefined): CanvasStatePayload | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as CanvasStatePayload;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') return raw;
  return null;
}
