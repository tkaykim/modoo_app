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

    // Recommended-size box (dashed outline)
    const rect = new fabric.Rect({
      left: centerX - widthPx / 2,
      top: centerY - heightPx / 2,
      width: widthPx,
      height: heightPx,
      fill: 'rgba(37, 99, 235, 0.08)',
      stroke: '#1d4ed8',
      strokeWidth: 2,
      strokeDashArray: [8, 5],
      selectable: false,
      evented: false,
      excludeFromExport: true,
      hoverCursor: 'default',
    }) as AnchorPreviewObject;
    rect.data = { id: PREVIEW_TAG };
    canvas.add(rect);
    canvas.bringObjectToFront(rect);

    // Center marker — at the actual anchor coordinate (box center).
    // Test calibration page uses this same convention so users can clearly
    // see WHERE the anchor center is, distinct from where the box edges fall.
    const dotRadius = 5;
    const centerDot = new fabric.Circle({
      left: centerX - dotRadius,
      top: centerY - dotRadius,
      radius: dotRadius,
      fill: '#1d4ed8',
      stroke: '#ffffff',
      strokeWidth: 1.5,
      selectable: false,
      evented: false,
      excludeFromExport: true,
      hoverCursor: 'default',
    }) as AnchorPreviewObject;
    centerDot.data = { id: PREVIEW_TAG };
    canvas.add(centerDot);
    canvas.bringObjectToFront(centerDot);

    // Label sits NEXT TO the center dot (not at box corners). Matches test
    // calibration page (AnchorCanvas) so labels always appear near their own
    // anchor center, never colliding with neighbouring boxes.
    const text = new fabric.FabricText(resolveAnchorLabel(a), {
      left: centerX + 8,
      top: centerY - 18,
      fontSize: 12,
      fontWeight: 'bold',
      fill: '#1e3a8a',
      backgroundColor: 'rgba(255,255,255,0.92)',
      padding: 2,
      selectable: false,
      evented: false,
      excludeFromExport: true,
      hoverCursor: 'default',
    }) as AnchorPreviewObject;
    text.data = { id: PREVIEW_TAG };
    canvas.add(text);
    canvas.bringObjectToFront(text);
  });

  canvas.requestRenderAll();
}
