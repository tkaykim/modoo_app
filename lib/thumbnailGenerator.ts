import * as fabric from 'fabric';

/**
 * Generates a thumbnail image from a fabric.js canvas
 * @param canvas - The fabric.js canvas instance
 * @param maxWidth - Maximum width of the thumbnail (default: 200)
 * @param maxHeight - Maximum height of the thumbnail (default: 200)
 * @returns Base64 encoded image data URL
 */
export function generateCanvasThumbnail(
  canvas: fabric.Canvas,
  maxWidth: number = 200,
  maxHeight: number = 200
): string {
  if (!canvas) {
    console.error('Canvas is null or undefined');
    return '';
  }

  try {
    // Calculate scaling factor to fit within max dimensions while maintaining aspect ratio
    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();
    const scale = Math.min(maxWidth / canvasWidth, maxHeight / canvasHeight);

    // Generate the data URL with scaling
    const dataURL = canvas.toDataURL({
      format: 'png',
      quality: 0.8,
      multiplier: scale, // Scale down for thumbnail
    });

    return dataURL;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    return '';
  }
}

/**
 * Counts user-added objects on a canvas, using the same filter the canvas store
 * uses when serializing (excludes the background product image, guides, and
 * snap lines). Never throws — a canvas that cannot be read counts as empty.
 */
function countUserObjects(canvas: fabric.Canvas): number {
  try {
    return canvas.getObjects().filter((obj) => {
      if (obj.excludeFromExport) return false;
      // @ts-expect-error - Checking custom data property
      if (obj.data?.id === 'background-product-image') return false;
      return true;
    }).length;
  } catch {
    return 0;
  }
}

/**
 * Generates a thumbnail showing the product side that actually carries the design.
 *
 * Prefers `primarySideId` (the front). But designs placed only on the back or a
 * sleeve leave the front empty, and capturing it produces a blank product mockup
 * — the customer's design is nowhere in their own thumbnail. So when the primary
 * side has no user objects, the first side that does is captured instead.
 *
 * Falls back to the primary side whenever that is not possible, so the result is
 * never worse than capturing the primary side alone.
 *
 * @param canvasMap - Record of all canvas instances by side ID
 * @param primarySideId - Preferred side to use for the thumbnail (default: 'front')
 * @param maxWidth - Maximum width of the thumbnail
 * @param maxHeight - Maximum height of the thumbnail
 * @returns Base64 encoded image data URL
 */
export function generateProductThumbnail(
  canvasMap: Record<string, fabric.Canvas>,
  primarySideId: string = 'front',
  maxWidth: number = 200,
  maxHeight: number = 200
): string {
  const primaryCanvas = canvasMap[primarySideId] || Object.values(canvasMap)[0];

  if (!primaryCanvas) {
    console.error('No canvas found for thumbnail generation');
    return '';
  }

  // Primary side carries the design — unchanged behaviour.
  if (countUserObjects(primaryCanvas) === 0) {
    // Side order follows canvas registration, which mirrors product.configuration.
    const designedCanvas = Object.values(canvasMap).find(
      (canvas) => canvas !== primaryCanvas && countUserObjects(canvas) > 0
    );

    if (designedCanvas) {
      const dataURL = generateCanvasThumbnail(designedCanvas, maxWidth, maxHeight);
      // Empty means the capture failed (e.g. tainted canvas) — fall back below.
      if (dataURL) return dataURL;
    }
  }

  return generateCanvasThumbnail(primaryCanvas, maxWidth, maxHeight);
}
