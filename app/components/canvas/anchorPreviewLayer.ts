/**
 * Adds/removes ghost dashed rectangles on the canvas to preview where each
 * anchor preset will place artwork. All preview objects are tagged so they
 * are excluded from save/restore/screenshot pipelines.
 */
import * as fabric from 'fabric';
import type { AnchorPreset } from '@/lib/anchorPresets';
import { resolveAnchorLabel } from '@/lib/anchorPresets';

const PREVIEW_TAG = 'anchor-preview' as const;

interface AnchorPreviewObject extends fabric.FabricObject {
  data?: { id?: string };
}

export function clearAnchorPreviews(canvas: fabric.Canvas | null | undefined): void {
  if (!canvas) return;
  const stale = canvas.getObjects().filter((obj) => {
    const o = obj as AnchorPreviewObject;
    return o.data?.id === PREVIEW_TAG;
  });
  stale.forEach((obj) => canvas.remove(obj));
  if (stale.length) canvas.requestRenderAll();
}

export function drawAnchorPreviews(
  canvas: fabric.Canvas | null | undefined,
  anchors: AnchorPreset[],
  opts: {
    canvasMmPerPx: number;
    mockupCanvasLeft?: number;
    mockupCanvasTop?: number;
  },
): void {
  if (!canvas) return;
  // Always clear existing previews first to avoid duplicates.
  clearAnchorPreviews(canvas);
  const { canvasMmPerPx, mockupCanvasLeft = 0, mockupCanvasTop = 0 } = opts;
  if (!Number.isFinite(canvasMmPerPx) || canvasMmPerPx <= 0) return;

  anchors.forEach((a) => {
    const widthPx = a.recommendedWidthMm / canvasMmPerPx;
    const heightPx = a.recommendedHeightMm / canvasMmPerPx;
    const centerX = a.xMm / canvasMmPerPx + mockupCanvasLeft;
    const centerY = a.yMm / canvasMmPerPx + mockupCanvasTop;
    if (!Number.isFinite(widthPx) || !Number.isFinite(heightPx)) return;

    const rect = new fabric.Rect({
      left: centerX - widthPx / 2,
      top: centerY - heightPx / 2,
      width: widthPx,
      height: heightPx,
      fill: 'transparent',
      stroke: '#2563eb',
      strokeWidth: 1.5,
      strokeDashArray: [6, 4],
      selectable: false,
      evented: false,
      excludeFromExport: true,
      hoverCursor: 'default',
    }) as AnchorPreviewObject;
    rect.data = { id: PREVIEW_TAG };
    canvas.add(rect);

    const text = new fabric.FabricText(resolveAnchorLabel(a), {
      left: centerX - widthPx / 2 + 4,
      top: centerY - heightPx / 2 + 2,
      fontSize: 11,
      fill: '#1d4ed8',
      backgroundColor: 'rgba(255,255,255,0.85)',
      selectable: false,
      evented: false,
      excludeFromExport: true,
      hoverCursor: 'default',
    }) as AnchorPreviewObject;
    text.data = { id: PREVIEW_TAG };
    canvas.add(text);
  });

  canvas.requestRenderAll();
}
