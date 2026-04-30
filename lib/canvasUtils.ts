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
 * Formats millimeter value as a number (rounded to 1 decimal place)
 *
 * @param value - The value in millimeters
 * @returns Formatted number with 1 decimal place
 */
export function formatMmNumber(value: number): number {
  return Math.round(value * 10) / 10;
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

  // Calculate the bounding box that encompasses all objects
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  userObjects.forEach(obj => {
    const bound = obj.getBoundingRect();
    minX = Math.min(minX, bound.left);
    minY = Math.min(minY, bound.top);
    maxX = Math.max(maxX, bound.left + bound.width);
    maxY = Math.max(maxY, bound.top + bound.height);
  });

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