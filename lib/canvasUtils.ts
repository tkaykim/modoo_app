import * as fabric from 'fabric';

/**
 * Canvas utility functions for real-world scale conversions
 */

/**
 * Converts canvas pixels to real-world millimeters
 *
 * @param pixelValue - The value in canvas pixels
 * @param canvasPrintAreaWidth - The width of the print area in canvas pixels
 * @param realWorldWidth - The real-world width in millimeters from product data (e.g., 250mm for t-shirt print area)
 * @returns The value in millimeters
 */
export function pixelsToMm(
  pixelValue: number,
  canvasPrintAreaWidth: number,
  realWorldWidth: number,
  mmPerPxOverride?: number | null
): number {
  if (mmPerPxOverride && Number.isFinite(mmPerPxOverride) && mmPerPxOverride > 0) {
    return pixelValue * mmPerPxOverride;
  }
  const mmPerPixel = realWorldWidth / canvasPrintAreaWidth;
  return pixelValue * mmPerPixel;
}

/**
 * Converts real-world millimeters to canvas pixels
 *
 * @param mmValue - The value in millimeters
 * @param canvasPrintAreaWidth - The width of the print area in canvas pixels
 * @param realWorldWidth - The real-world width in millimeters from product data (e.g., 250mm for t-shirt print area)
 * @returns The value in canvas pixels
 */
export function mmToPixels(
  mmValue: number,
  canvasPrintAreaWidth: number,
  realWorldWidth: number,
  mmPerPxOverride?: number | null
): number {
  if (mmPerPxOverride && Number.isFinite(mmPerPxOverride) && mmPerPxOverride > 0) {
    return mmValue / mmPerPxOverride;
  }
  const pixelsPerMm = canvasPrintAreaWidth / realWorldWidth;
  return mmValue * pixelsPerMm;
}

/**
 * Formats millimeter value for display
 *
 * @param mm - The value in millimeters
 * @param precision - Number of decimal places (default: 1)
 * @returns Formatted string with mm unit
 */
export function formatMm(mm: number, precision: number = 1): string {
  return `${mm.toFixed(precision)}mm`;
}

/**
 * Formats a millimeter value as centimeters (default 1 decimal place).
 * Used for the customer-facing size readout (cm, 1자리).
 */
export function formatCm(mm: number, precision: number = 1): string {
  return `${(mm / 10).toFixed(precision)}cm`;
}

/**
 * Formats millimeter value as a number (rounded to 1 decimal place)
 *
 * @param value - The value in millimeters
 * @returns Formatted number with 1 decimal place
 */
export function formatMmNumber(value: number): number {
  return Math.round(value * 10) / 10;
}

// ── 캔버스 경계 강제(containment) 유틸 ───────────────────────────────
// 고객이 개체를 "삭제" 대신 캔버스 밖으로 끌어내 숨기면, 화면·시안에는 안 보이는데
// 인쇄단가 bbox와 저장 디자인에는 남는 사고가 난다 (2026-08 ORD-…-H5MQ7P).
// 에디터는 이 유틸로 사용자 변형 시 개체를 캔버스 안으로 되밀고,
// 단가·bbox 계산은 캔버스 교차 영역만 집계한다.

export interface RectPx {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * 개체 bbox가 캔버스 사각형 [0, 0, boundsWidth, boundsHeight]를 벗어나지 않게
 * 하는 이동 보정치(px)를 계산한다.
 * - 개체가 캔버스보다 작으면: 캔버스 안에 전체가 들어오도록.
 * - 개체가 캔버스보다 크면: 개체가 캔버스를 빈틈없이 덮도록.
 * 경계 정보가 유효하지 않으면 보정하지 않는다(0,0).
 */
export function calculateContainmentDelta(
  rect: RectPx,
  boundsWidth: number,
  boundsHeight: number
): { dx: number; dy: number } {
  const clampAxis = (start: number, size: number, boundsSize: number): number => {
    if (!Number.isFinite(start) || !Number.isFinite(size) || !(boundsSize > 0)) {
      return 0;
    }
    if (size <= boundsSize) {
      if (start < 0) return -start;
      if (start + size > boundsSize) return boundsSize - (start + size);
      return 0;
    }
    // 개체가 경계보다 큰 축: 경계가 개체 안에 완전히 포함되게 유지
    if (start > 0) return -start;
    if (start + size < boundsSize) return boundsSize - (start + size);
    return 0;
  };

  return {
    dx: clampAxis(rect.left, rect.width, boundsWidth),
    dy: clampAxis(rect.top, rect.height, boundsHeight),
  };
}

/**
 * bbox와 캔버스 사각형 [0, 0, boundsWidth, boundsHeight]의 교차 영역.
 * 겹치는 면적이 없으면 null (완전히 캔버스 밖 = 인쇄 대상 아님).
 * 경계 정보가 유효하지 않으면 클립 없이 원본 rect를 돌려준다(fail-open —
 * 초기화 덜 된 캔버스에서 가격이 0으로 무너지지 않게).
 */
export function intersectRectWithBounds(
  rect: RectPx,
  boundsWidth: number,
  boundsHeight: number
): RectPx | null {
  if (!(boundsWidth > 0) || !(boundsHeight > 0)) {
    return rect;
  }
  const left = Math.max(rect.left, 0);
  const top = Math.max(rect.top, 0);
  const right = Math.min(rect.left + rect.width, boundsWidth);
  const bottom = Math.min(rect.top + rect.height, boundsHeight);
  if (right <= left || bottom <= top) {
    return null;
  }
  return { left, top, width: right - left, height: bottom - top };
}

// Object dimension calculation utilities

export interface ObjectDimensionsMm {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasDimensionParams {
  scaledImageWidth: number;
  scaledPrintLeft?: number;
  scaledPrintTop?: number;
  realWorldProductWidth?: number;
  /** When set, overrides legacy ratio. Already in canvas-px scale (mm per scaled px). */
  mmPerPxOverride?: number | null;
}

/**
 * Calculate pixel-to-mm ratio based on product dimensions.
 * If `mmPerPxOverride` is provided (calibration-derived), it is used directly.
 * Otherwise falls back to `realWorldProductWidth / scaledImageWidth` (legacy).
 */
export function calculatePixelToMmRatio(
  scaledImageWidth: number,
  realWorldProductWidth: number = 500, // Default to 500mm for t-shirts
  mmPerPxOverride?: number | null
): number {
  if (mmPerPxOverride && Number.isFinite(mmPerPxOverride) && mmPerPxOverride > 0) {
    return mmPerPxOverride;
  }
  // Guard: invalid/zero scaledImageWidth → 0 (avoids divide-by-zero Infinity).
  // Kept byte-identical to modoo_admin/lib/canvasUtils.calculatePixelToMmRatio
  // so customer & admin produce the same px→mm ratio.
  if (!scaledImageWidth || !Number.isFinite(scaledImageWidth) || scaledImageWidth <= 0) {
    return 0;
  }
  return realWorldProductWidth / scaledImageWidth;
}

/**
 * Calculate the physical dimensions (in mm) of a canvas object
 *
 * @param obj - Fabric.js object (can be any FabricObject or ActiveSelection)
 * @param params - Canvas dimension parameters
 * @returns Object dimensions in millimeters (x, y, width, height)
 */
export function calculateObjectDimensionsMm(
  obj: fabric.FabricObject | fabric.ActiveSelection,
  params: CanvasDimensionParams
): ObjectDimensionsMm {
  const {
    scaledImageWidth,
    scaledPrintLeft = 0,
    scaledPrintTop = 0,
    realWorldProductWidth = 500,
    mmPerPxOverride = null,
  } = params;

  // Calculate pixel-to-mm ratio. Calibration override wins; legacy fallback otherwise.
  const pixelToMmRatio = calculatePixelToMmRatio(scaledImageWidth, realWorldProductWidth, mmPerPxOverride);

  // Get object's bounding box dimensions (includes scale and rotation)
  const boundingRect = obj.getBoundingRect();
  const objWidth = boundingRect.width;
  const objHeight = boundingRect.height;

  // Calculate object position relative to print area origin
  const objX = boundingRect.left - scaledPrintLeft;
  const objY = boundingRect.top - scaledPrintTop;

  // Convert to mm using the product-based ratio
  return {
    x: objX * pixelToMmRatio,
    y: objY * pixelToMmRatio,
    width: objWidth * pixelToMmRatio,
    height: objHeight * pixelToMmRatio,
  };
}

/**
 * Update an object's data attribute with its dimensions in mm
 *
 * @param obj - Fabric.js object
 * @param scaledImageWidth - Width of the product image on canvas
 * @param realWorldProductWidth - Real-world width of the product in mm
 */
export function updateObjectDimensionsData(
  obj: fabric.FabricObject,
  scaledImageWidth: number,
  realWorldProductWidth: number = 500,
  mmPerPxOverride?: number | null
): void {
  // 다중 선택(ActiveSelection) 변형 시 자식 각각에 박제한다.
  // 선택 묶음 자체는 직렬화되지 않으며, 자식 getBoundingRect()는 그룹 변환이
  // 합성된 캔버스 좌표를 반환하므로 그대로 정확하다.
  if (obj instanceof fabric.ActiveSelection) {
    obj.getObjects().forEach((child) =>
      updateObjectDimensionsData(child, scaledImageWidth, realWorldProductWidth, mmPerPxOverride)
    );
    return;
  }
  const pixelToMmRatio = calculatePixelToMmRatio(scaledImageWidth, realWorldProductWidth, mmPerPxOverride);
  const boundingRect = obj.getBoundingRect();

  // Calculate dimensions in mm
  const widthMm = formatMmNumber(boundingRect.width * pixelToMmRatio);
  const heightMm = formatMmNumber(boundingRect.height * pixelToMmRatio);

  // Update the object's data attribute
  // @ts-expect-error - Custom data property
  if (!obj.data) {
    // @ts-expect-error - Adding data property
    obj.data = {};
  }

  // @ts-expect-error - Adding custom properties to data
  obj.data.widthMm = widthMm;
  // @ts-expect-error - Adding custom properties to data
  obj.data.heightMm = heightMm;
  // Mark these dimensions as measured against the alpha-tight bounding box
  // (uploads are alpha-trimmed before they reach the canvas, so getBoundingRect
  // already equals the visible "투명 영역 제외" box). Admin views trust the
  // stored W/H only when this marker is present; legacy objects without it fall
  // back to a live recompute. Keep the literal in sync with
  // `modoo_admin/lib/canvasUtils.ALPHA_SIZE_BASIS`.
  // @ts-expect-error - Adding custom properties to data
  obj.data.sizeBasis = 'alpha';
}

/**
 * Calculate the total bounding box for all user objects on a canvas
 * Excludes system objects (background, guides, snap lines)
 *
 * @param canvas - Fabric.js canvas
 * @param scaledImageWidth - Width of the product image on canvas
 * @param realWorldProductWidth - Real-world width of the product in mm
 * @returns Total bounding box dimensions in mm, or null if no user objects
 */
export function calculateTotalBoundingBoxMm(
  canvas: fabric.Canvas,
  scaledImageWidth: number,
  realWorldProductWidth: number = 500,
  mmPerPxOverride?: number | null
): { widthMm: number; heightMm: number } | null {
  const pixelToMmRatio = calculatePixelToMmRatio(scaledImageWidth, realWorldProductWidth, mmPerPxOverride);

  // Filter user-added objects only
  const userObjects = canvas.getObjects().filter(obj => {
    // Exclude guide boxes and snap lines
    if (obj.excludeFromExport) return false;

    // Exclude the background product image
    // @ts-expect-error - Checking custom data property
    if (obj.data?.id === 'background-product-image') return false;

    return true;
  });

  if (userObjects.length === 0) {
    return null;
  }

  // Calculate the bounding box that encompasses all objects.
  // 캔버스 밖 부분은 실제 인쇄물이 아니므로 캔버스 교차 영역만 집계한다.
  const boundsWidth = canvas.getWidth();
  const boundsHeight = canvas.getHeight();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  userObjects.forEach(obj => {
    const bound = intersectRectWithBounds(obj.getBoundingRect(), boundsWidth, boundsHeight);
    if (!bound) return;
    minX = Math.min(minX, bound.left);
    minY = Math.min(minY, bound.top);
    maxX = Math.max(maxX, bound.left + bound.width);
    maxY = Math.max(maxY, bound.top + bound.height);
  });

  // 모든 개체가 캔버스 완전 밖: 개체는 있지만 인쇄 가능한 영역이 없다.
  if (minX === Infinity) {
    return { widthMm: 0, heightMm: 0 };
  }

  const widthPixels = maxX - minX;
  const heightPixels = maxY - minY;

  return {
    widthMm: formatMmNumber(widthPixels * pixelToMmRatio),
    heightMm: formatMmNumber(heightPixels * pixelToMmRatio),
  };
}

/**
 * Calculate dimensions for all objects in a canvas state (for server-side use)
 * Filters out system objects (background, guides, snap lines)
 *
 * @param canvasState - Canvas state from Fabric.js toJSON()
 * @param scaledImageWidth - Width of the product image on canvas
 * @param realWorldProductWidth - Real-world width of the product in mm
 * @returns Array of object dimensions with metadata
 */
export function calculateAllObjectDimensionsMm(
  canvasState: Record<string, unknown>,
  scaledImageWidth: number,
  realWorldProductWidth: number = 500,
  mmPerPxOverride?: number | null
): Array<{
  objectId: string;
  type: string;
  widthMm: number;
  heightMm: number;
  xMm: number;
  yMm: number;
  printMethod?: string;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const objects = (canvasState.objects as any[]) || [];
  const pixelToMmRatio = calculatePixelToMmRatio(scaledImageWidth, realWorldProductWidth, mmPerPxOverride);

  // Filter user-added objects only
  const userObjects = objects.filter(obj => {
    // Exclude guide boxes and snap lines
    if (obj.excludeFromExport) return false;

    // Exclude the background product image
    if (obj.data?.id === 'background-product-image') return false;

    return true;
  });

  return userObjects.map(obj => {
    // Calculate bounding box dimensions
    const width = (obj.width || 0) * (obj.scaleX || 1);
    const height = (obj.height || 0) * (obj.scaleY || 1);
    const left = obj.left || 0;
    const top = obj.top || 0;

    return {
      objectId: obj.data?.objectId || obj.data?.id || 'unknown',
      type: obj.type || 'unknown',
      widthMm: formatMmNumber(width * pixelToMmRatio),
      heightMm: formatMmNumber(height * pixelToMmRatio),
      xMm: formatMmNumber(left * pixelToMmRatio),
      yMm: formatMmNumber(top * pixelToMmRatio),
      printMethod: obj.data?.printMethod,
    };
  });
}