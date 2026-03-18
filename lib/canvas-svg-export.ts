import * as fabric from 'fabric';
import opentype from 'opentype.js';
import { uploadSVGToStorage, uploadDataUrlToStorage, UploadResult } from './supabase-storage';
import { STORAGE_BUCKETS, STORAGE_FOLDERS } from './storage-config';
import { SupabaseClient } from '@supabase/supabase-js';
import { CurvedText, isCurvedText } from './curvedText';

// Default DPI for high-resolution export (300 DPI for print quality)
const EXPORT_DPI = 300;
// Screen DPI (standard)
const SCREEN_DPI = 72;
// Scale factor for high-res export
const DPI_SCALE = EXPORT_DPI / SCREEN_DPI; // ~4.17x

// Font cache to avoid reloading (shared with curvedText.ts concept)
const fontCache: Map<string, opentype.Font> = new Map();

// System font URLs (using Google Fonts CDN) - fallbacks for common fonts
const systemFontUrls: Record<string, string> = {
  Arial: 'https://fonts.gstatic.com/s/arimo/v28/P5sfzZCDf9_T_3cV7NCUECyoxNk.ttf',
  'Times New Roman':
    'https://fonts.gstatic.com/s/tinos/v21/buE4poGnedXvwgX8dGVh8TI-.ttf',
  'Courier New':
    'https://fonts.gstatic.com/s/cousine/v27/d6lIkaiiRdih4SpPzSMlzTbtz9k.ttf',
  Georgia: 'https://fonts.gstatic.com/s/tinos/v24/buE4poGnedXvwgX8dGVh8TI-.ttf',
  Verdana: 'https://fonts.gstatic.com/s/arimo/v29/P5sfzZCDf9_T_3cV7NCUECyoxNk.ttf',
  Helvetica:
    'https://fonts.gstatic.com/s/arimo/v29/P5sfzZCDf9_T_3cV7NCUECyoxNk.ttf',
};

/**
 * Load a font using opentype.js
 * Returns cached font if already loaded
 */
async function loadFont(
  fontFamily: string,
  fontUrl?: string
): Promise<opentype.Font | null> {
  const fontKey = fontUrl || fontFamily;

  // Check cache first
  if (fontCache.has(fontKey)) {
    return fontCache.get(fontKey)!;
  }

  // Determine font URL
  let url = fontUrl;
  if (!url) {
    url = systemFontUrls[fontFamily] || systemFontUrls['Arial'];
  }

  try {
    const font = await opentype.load(url);
    fontCache.set(fontKey, font);
    return font;
  } catch (error) {
    console.error(
      `[SVG Export] Failed to load font "${fontFamily}" from ${url}:`,
      error
    );
    return null;
  }
}

/**
 * Convert regular text to SVG path data using opentype.js
 */
function textToPathData(
  text: string,
  font: opentype.Font,
  fontSize: number,
  charSpacing: number = 0
): string {
  const scale = fontSize / font.unitsPerEm;
  const spacing = (charSpacing / 1000) * fontSize;

  const pathCommands: string[] = [];
  let currentX = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const glyph = font.charToGlyph(char);
    const glyphPath = glyph.getPath(currentX, 0, fontSize);

    for (const cmd of glyphPath.commands) {
      if (cmd.type === 'M') {
        pathCommands.push(`M ${formatNum(cmd.x!)} ${formatNum(cmd.y!)}`);
      } else if (cmd.type === 'L') {
        pathCommands.push(`L ${formatNum(cmd.x!)} ${formatNum(cmd.y!)}`);
      } else if (cmd.type === 'C') {
        pathCommands.push(
          `C ${formatNum(cmd.x1!)} ${formatNum(cmd.y1!)} ${formatNum(cmd.x2!)} ${formatNum(cmd.y2!)} ${formatNum(cmd.x!)} ${formatNum(cmd.y!)}`
        );
      } else if (cmd.type === 'Q') {
        pathCommands.push(
          `Q ${formatNum(cmd.x1!)} ${formatNum(cmd.y1!)} ${formatNum(cmd.x!)} ${formatNum(cmd.y!)}`
        );
      } else if (cmd.type === 'Z') {
        pathCommands.push('Z');
      }
    }

    currentX += (glyph.advanceWidth || 0) * scale + spacing;
  }

  return pathCommands.join(' ');
}

/**
 * Format number for SVG (avoid scientific notation, limit decimals)
 */
function formatNum(n: number): string {
  return Number(n.toFixed(4)).toString();
}

/**
 * Calculate text metrics using opentype.js
 */
function getTextMetrics(
  text: string,
  font: opentype.Font,
  fontSize: number,
  charSpacing: number = 0
): { width: number; height: number; ascender: number; descender: number } {
  const scale = fontSize / font.unitsPerEm;
  const spacing = (charSpacing / 1000) * fontSize;

  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const glyph = font.charToGlyph(text[i]);
    width += (glyph.advanceWidth || 0) * scale;
    if (i < text.length - 1) {
      width += spacing;
    }
  }

  const ascender = font.ascender * scale;
  const descender = Math.abs(font.descender * scale);
  const height = ascender + descender;

  return { width, height, ascender, descender };
}

/**
 * Warp a point along a curve (same logic as CurvedText)
 */
function warpPoint(
  x: number,
  y: number,
  charOffset: number,
  totalWidth: number,
  radius: number,
  startAngle: number,
  arcAngle: number,
  offsetY: number,
  intensity: number,
  fontSize: number
): { x: number; y: number } {
  // Convert glyph y to distance from baseline
  const baselineOffset = fontSize * 0.75;
  const distFromBaseline = -(y - baselineOffset);

  // Position along the arc (0 to 1)
  const globalX = charOffset + x;
  const t = globalX / totalWidth;

  // Angle at this position
  const angle = startAngle + arcAngle * t;

  // Radius adjusted by vertical position
  const adjustedRadius =
    intensity < 0 ? radius + distFromBaseline : radius - distFromBaseline;

  // Calculate position on the curved path
  const newX = Math.cos(angle) * adjustedRadius;
  const newY = Math.sin(angle) * adjustedRadius + offsetY;

  return { x: newX, y: newY };
}

/**
 * Convert curved text to SVG path data using opentype.js
 */
function curvedTextToPathData(
  text: string,
  font: opentype.Font,
  fontSize: number,
  curveIntensity: number,
  charSpacing: number = 0
): string | null {
  if (!text || curveIntensity === 0) return null;

  const intensity = curveIntensity / 100;
  const absIntensity = Math.abs(intensity);
  const arcAngle = 2 * Math.PI * absIntensity;

  if (arcAngle < 0.01) return null;

  const scale = fontSize / font.unitsPerEm;
  const spacing = (charSpacing / 1000) * fontSize;

  // Calculate total text width
  let totalWidth = 0;
  for (let i = 0; i < text.length; i++) {
    const glyph = font.charToGlyph(text[i]);
    totalWidth += (glyph.advanceWidth || 0) * scale;
    if (i < text.length - 1) {
      totalWidth += spacing;
    }
  }

  const radius = totalWidth / arcAngle;
  const centerAngle = intensity < 0 ? -Math.PI / 2 : Math.PI / 2;
  const startAngle = centerAngle - arcAngle / 2;
  const sagitta = radius * (1 - Math.cos(arcAngle / 2));
  const offsetY = intensity < 0 ? radius - sagitta / 2 : -radius + sagitta / 2;

  // Build SVG path commands
  const pathCommands: string[] = [];
  let currentX = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const glyph = font.charToGlyph(char);
    const glyphPath = glyph.getPath(0, 0, fontSize);

    for (const cmd of glyphPath.commands) {
      if (cmd.type === 'M') {
        const p = warpPoint(
          cmd.x!,
          cmd.y!,
          currentX,
          totalWidth,
          radius,
          startAngle,
          arcAngle,
          offsetY,
          intensity,
          fontSize
        );
        pathCommands.push(`M ${formatNum(p.x)} ${formatNum(p.y)}`);
      } else if (cmd.type === 'L') {
        const p = warpPoint(
          cmd.x!,
          cmd.y!,
          currentX,
          totalWidth,
          radius,
          startAngle,
          arcAngle,
          offsetY,
          intensity,
          fontSize
        );
        pathCommands.push(`L ${formatNum(p.x)} ${formatNum(p.y)}`);
      } else if (cmd.type === 'C') {
        const p1 = warpPoint(
          cmd.x1!,
          cmd.y1!,
          currentX,
          totalWidth,
          radius,
          startAngle,
          arcAngle,
          offsetY,
          intensity,
          fontSize
        );
        const p2 = warpPoint(
          cmd.x2!,
          cmd.y2!,
          currentX,
          totalWidth,
          radius,
          startAngle,
          arcAngle,
          offsetY,
          intensity,
          fontSize
        );
        const p = warpPoint(
          cmd.x!,
          cmd.y!,
          currentX,
          totalWidth,
          radius,
          startAngle,
          arcAngle,
          offsetY,
          intensity,
          fontSize
        );
        pathCommands.push(
          `C ${formatNum(p1.x)} ${formatNum(p1.y)} ${formatNum(p2.x)} ${formatNum(p2.y)} ${formatNum(p.x)} ${formatNum(p.y)}`
        );
      } else if (cmd.type === 'Q') {
        const p1 = warpPoint(
          cmd.x1!,
          cmd.y1!,
          currentX,
          totalWidth,
          radius,
          startAngle,
          arcAngle,
          offsetY,
          intensity,
          fontSize
        );
        const p = warpPoint(
          cmd.x!,
          cmd.y!,
          currentX,
          totalWidth,
          radius,
          startAngle,
          arcAngle,
          offsetY,
          intensity,
          fontSize
        );
        pathCommands.push(
          `Q ${formatNum(p1.x)} ${formatNum(p1.y)} ${formatNum(p.x)} ${formatNum(p.y)}`
        );
      } else if (cmd.type === 'Z') {
        pathCommands.push('Z');
      }
    }

    currentX += (glyph.advanceWidth || 0) * scale + spacing;
  }

  return pathCommands.join(' ');
}

/**
 * Generate SVG path element for a CurvedText object
 */
async function generateCurvedTextPathSVG(
  curvedText: CurvedText,
  objectId: string,
  canvasObjectIndex: number,
  printMethod?: string | null
): Promise<{ svg: string; pathData: string | null }> {
  const text = curvedText.text || '';
  const fontFamily = curvedText.fontFamily || 'Arial';
  const fontSize = curvedText.fontSize || 16;
  const fill = curvedText.fill?.toString() || '#000000';
  const stroke = curvedText.stroke?.toString() || '';
  const strokeWidth = curvedText.strokeWidth || 0;
  const charSpacing = curvedText.charSpacing || 0;
  const curveIntensity = curvedText.curveIntensity || 0;
  const opacity = curvedText.opacity ?? 1;
  const left = curvedText.left || 0;
  const top = curvedText.top || 0;
  const angle = curvedText.angle || 0;
  const scaleX = curvedText.scaleX || 1;
  const scaleY = curvedText.scaleY || 1;
  // Load font (try system font URLs)
  const font = await loadFont(fontFamily);

  if (!font) {
    console.warn(
      `[SVG Export] Font loading failed for CurvedText "${fontFamily}", using fallback`
    );
    return {
      svg: curvedText.toSVG(),
      pathData: null,
    };
  }

  // For straight text (no curve), use regular path conversion
  if (curveIntensity === 0) {
    const pathData = textToPathData(text, font, fontSize, charSpacing);
    if (!pathData) {
      return { svg: curvedText.toSVG(), pathData: null };
    }

    const metrics = getTextMetrics(text, font, fontSize, charSpacing);
    const transforms: string[] = [];
    transforms.push(`translate(${left}, ${top})`);
    if (angle !== 0) transforms.push(`rotate(${angle})`);
    if (scaleX !== 1 || scaleY !== 1) transforms.push(`scale(${scaleX}, ${scaleY})`);
    // CurvedText is center-aligned
    transforms.push(`translate(${-metrics.width / 2}, ${-metrics.ascender})`);

    const strokeAttr =
      stroke && strokeWidth > 0
        ? ` stroke="${escapeXml(stroke)}" stroke-width="${strokeWidth}"`
        : '';

    const svg = `<g transform="${transforms.join(' ')}">
  <path d="${pathData}" fill="${escapeXml(fill)}" opacity="${opacity}"${strokeAttr} />
</g>`;

    return { svg, pathData };
  }

  // Generate curved path data
  const pathData = curvedTextToPathData(
    text,
    font,
    fontSize,
    curveIntensity,
    charSpacing
  );

  if (!pathData) {
    console.warn(
      `[SVG Export] Failed to generate curved path for "${text}"`
    );
    return { svg: curvedText.toSVG(), pathData: null };
  }

  // Build transform
  const transforms: string[] = [];
  transforms.push(`translate(${left}, ${top})`);
  if (angle !== 0) transforms.push(`rotate(${angle})`);
  if (scaleX !== 1 || scaleY !== 1) transforms.push(`scale(${scaleX}, ${scaleY})`);

  const strokeAttr =
    stroke && strokeWidth > 0
      ? ` stroke="${escapeXml(stroke)}" stroke-width="${strokeWidth}"`
      : '';

  const svg = `<g transform="${transforms.join(' ')}">
  <path d="${pathData}" fill="${escapeXml(fill)}" opacity="${opacity}"${strokeAttr} />
</g>`;

  console.log(`[SVG Export] CurvedText "${text}" converted to PATH with curve=${curveIntensity}`);
  return { svg, pathData };
}

/**
 * Render a fabric object to a high-DPI PNG with transparent background
 * @param obj - The fabric object to render
 * @param dpiScale - Scale factor for DPI (default: 300/72 ≈ 4.17)
 * @returns PNG data URL and dimensions
 */
async function renderObjectToPNG(
  obj: fabric.FabricObject,
  dpiScale: number = DPI_SCALE
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    // Get object bounding box
    obj.setCoords();
    const bbox = obj.getBoundingRect();

    if (bbox.width <= 0 || bbox.height <= 0) {
      console.warn('[PNG Export] Object has no dimensions');
      return null;
    }

    // Calculate high-res dimensions
    const highResWidth = Math.ceil(bbox.width * dpiScale);
    const highResHeight = Math.ceil(bbox.height * dpiScale);

    // Create an offscreen canvas for high-res rendering
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = highResWidth;
    offscreenCanvas.height = highResHeight;

    const ctx = offscreenCanvas.getContext('2d');
    if (!ctx) {
      console.error('[PNG Export] Failed to get canvas context');
      return null;
    }

    // Clear with transparent background
    ctx.clearRect(0, 0, highResWidth, highResHeight);

    // Scale and translate to render the object at high resolution
    ctx.scale(dpiScale, dpiScale);
    ctx.translate(-bbox.left, -bbox.top);

    // Render the object directly to the context
    obj.render(ctx);

    // Export as PNG with transparency
    const dataUrl = offscreenCanvas.toDataURL('image/png');

    console.log(
      `[PNG Export] Rendered object at ${highResWidth}x${highResHeight} (${EXPORT_DPI} DPI)`
    );

    return {
      dataUrl,
      width: highResWidth,
      height: highResHeight,
    };
  } catch (error) {
    console.error('[PNG Export] Failed to render object:', error);
    return null;
  }
}

/**
 * Generate SVG path element for a regular text object
 */
async function generateTextPathSVG(
  textObj: fabric.IText | fabric.Text,
  objectId: string,
  canvasObjectIndex: number,
  printMethod?: string | null
): Promise<{ svg: string; pathData: string | null }> {
  const text = textObj.text || '';
  const fontFamily = textObj.fontFamily || 'Arial';
  const fontSize = textObj.fontSize || 16;
  const fill = textObj.fill?.toString() || '#000000';
  const stroke = textObj.stroke?.toString() || '';
  const strokeWidth = textObj.strokeWidth || 0;
  const charSpacing = textObj.charSpacing || 0;
  const opacity = textObj.opacity ?? 1;
  const left = textObj.left || 0;
  const top = textObj.top || 0;
  const angle = textObj.angle || 0;
  const scaleX = textObj.scaleX || 1;
  const scaleY = textObj.scaleY || 1;
  const textAlign = textObj.textAlign || 'left';

  // Try to get custom font URL from object data
  // @ts-expect-error - Reading custom data property
  const fontUrl = textObj.data?.fontUrl || textObj.fontUrl || undefined;

  // Load font
  const font = await loadFont(fontFamily, fontUrl);

  if (!font) {
    // Fallback to text element if font loading fails
    console.warn(
      `[SVG Export] Font loading failed for "${fontFamily}", using text fallback`
    );
    return {
      svg: textObj.toSVG(),
      pathData: null,
    };
  }

  // Generate path data
  const pathData = textToPathData(text, font, fontSize, charSpacing);

  if (!pathData) {
    return {
      svg: textObj.toSVG(),
      pathData: null,
    };
  }

  // Calculate text metrics for positioning
  const metrics = getTextMetrics(text, font, fontSize, charSpacing);

  // Calculate offset based on text alignment
  let alignOffsetX = 0;
  if (textAlign === 'center') {
    alignOffsetX = -metrics.width / 2;
  } else if (textAlign === 'right') {
    alignOffsetX = -metrics.width;
  }

  // Build transform attribute
  const transforms: string[] = [];
  transforms.push(`translate(${left}, ${top})`);
  if (angle !== 0) {
    transforms.push(`rotate(${angle})`);
  }
  if (scaleX !== 1 || scaleY !== 1) {
    transforms.push(`scale(${scaleX}, ${scaleY})`);
  }
  // Adjust for baseline (opentype paths have baseline at y=0, descenders go positive)
  // Move up by ascender to position baseline correctly
  transforms.push(`translate(${alignOffsetX}, ${-metrics.ascender})`);

  const transformAttr = transforms.join(' ');

  // Build attributes
  const objectWrapperAttrs =
    ` id="${escapeXml(`text-${objectId}`)}"` +
    ` data-object-id="${escapeXml(objectId)}"` +
    ` data-canvas-index="${canvasObjectIndex}"` +
    ` data-converted-from="text"` +
    (printMethod ? ` data-print-method="${escapeXml(printMethod)}"` : '');

  const strokeAttr =
    stroke && strokeWidth > 0
      ? ` stroke="${escapeXml(stroke)}" stroke-width="${strokeWidth}"`
      : '';

  const svg = `<g${objectWrapperAttrs} transform="${transformAttr}">
  <path d="${pathData}"
    fill="${escapeXml(fill)}"
    opacity="${opacity}"${strokeAttr}
  />
</g>`;

  return { svg, pathData };
}

/**
 * Wait for all CurvedText objects in a canvas to have their fonts loaded
 * This ensures SVG path generation will work correctly
 */
async function waitForCurvedTextFonts(canvas: fabric.Canvas): Promise<void> {
  const objects = canvas.getObjects();
  const curvedTextObjects = objects.filter(isCurvedText) as CurvedText[];

  console.log(`[SVG Export] Found ${curvedTextObjects.length} CurvedText objects`);

  // Pre-load fonts for CurvedText objects
  await Promise.allSettled(
    curvedTextObjects.map(async (curvedText) => {
      try {
        console.log(`[SVG Export] CurvedText: text="${curvedText.text}", fontFamily="${curvedText.fontFamily}", curveIntensity=${curvedText.curveIntensity}`);
        // Pre-load font for SVG path conversion
        await loadFont(curvedText.fontFamily);
      } catch (error) {
        console.warn('[SVG Export] Font loading failed for CurvedText:', error);
      }
    })
  );
}

// Types for SVG/PNG exports stored in database
export type TextSvgObjectExports = Record<string, Record<string, string>>;
export interface TextSvgExports {
  __objects?: TextSvgObjectExports;
  __pngs?: TextSvgObjectExports; // 300 DPI PNG exports with transparent background
  [sideId: string]: string | TextSvgObjectExports | undefined;
}

// Canvas state interface for parsing serialized canvas JSON
interface CanvasStateObject {
  type?: string;
  data?: {
    id?: string;
    objectId?: string;
    supabaseUrl?: unknown;
    supabasePath?: unknown;
    uploadedAt?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface CanvasState {
  version?: string;
  objects?: CanvasStateObject[];
}

export interface TextObjectData {
  objectId?: string;
  canvasObjectIndex?: number;
  printMethod?: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  fill: string;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: string;
  left: number;
  top: number;
  angle?: number;
  scaleX?: number;
  scaleY?: number;
  // CurvedText specific properties
  curveIntensity?: number;
  isCurvedText?: boolean;
}

export interface TextObjectSVGExport {
  objectId: string;
  canvasObjectIndex: number;
  svg: string;
  svgDataUrl: string;
  // High-DPI PNG export (300 DPI, transparent background)
  pngDataUrl?: string;
  pngWidth?: number;
  pngHeight?: number;
  uploadResult?: UploadResult;
  pngUploadResult?: UploadResult;
  textObject: TextObjectData;
}

export interface SVGExportResult {
  svg: string;
  uploadResult?: UploadResult;
  textObjects: TextObjectData[];
  objectSvgs: TextObjectSVGExport[];
}

/**
 * Extract all text objects (i-text, text, textbox, curvedtext) from a canvas and convert to SVG
 * @param canvas - Fabric.js canvas instance
 * @returns SVG string containing all text objects
 */
export function extractTextObjectsToSVG(canvas: fabric.Canvas): SVGExportResult {
  const canvasObjects = canvas.getObjects();
  console.log('[SVG Export] Total canvas objects:', canvasObjects.length);
  console.log('[SVG Export] Object types:', canvasObjects.map(obj => obj.type));

  const textObjects = canvasObjects
    .map((obj, canvasObjectIndex) => ({ obj, canvasObjectIndex }))
    .filter(({ obj }) => {
      const type = obj.type?.toLowerCase();
      // Include standard text types and CurvedText
      const isText = type === 'i-text' || type === 'itext' || type === 'text' || type === 'textbox' || type === 'curvedtext' || isCurvedText(obj);
      console.log(`[SVG Export] Object type: ${type}, isText: ${isText}, isCurvedText: ${isCurvedText(obj)}`);
      return isText;
    })
    .map(({ obj, canvasObjectIndex }) => ({
      textObj: obj,
      canvasObjectIndex,
      isCurved: isCurvedText(obj),
    }));

  console.log('[SVG Export] Text objects found:', textObjects.length);

  if (textObjects.length === 0) {
    return {
      svg: '',
      textObjects: [],
      objectSvgs: [],
    };
  }

  // Extract data for each text object
  const textObjectsData: TextObjectData[] = [];
  const objectSvgs: TextObjectSVGExport[] = [];

  textObjects.forEach(({ textObj, canvasObjectIndex, isCurved }, textIndex) => {
    const objectId = getFabricObjectId(textObj) ?? `text-${textIndex}`;
    const printMethod = getFabricObjectPrintMethod(textObj);

    // Get text properties for data storage
    let text: string;
    let fontFamily: string;
    let fontSize: number;
    let fill: string;
    let fontWeight: string;
    let fontStyle: string;
    let textAlign: string;
    let curveIntensity: number | undefined;

    if (isCurved) {
      const curvedObj = textObj as CurvedText;
      text = curvedObj.text || '';
      fontFamily = curvedObj.fontFamily || 'Arial';
      fontSize = curvedObj.fontSize || 16;
      fill = curvedObj.fill?.toString() || '#000000';
      fontWeight = curvedObj.fontWeight?.toString() || 'normal';
      fontStyle = curvedObj.fontStyle || 'normal';
      textAlign = 'center'; // CurvedText is always centered
      curveIntensity = curvedObj.curveIntensity;
    } else {
      const regularTextObj = textObj as fabric.IText;
      text = regularTextObj.text || '';
      fontFamily = regularTextObj.fontFamily || 'Arial';
      fontSize = regularTextObj.fontSize || 16;
      fill = regularTextObj.fill?.toString() || '#000000';
      fontWeight = regularTextObj.fontWeight?.toString() || 'normal';
      fontStyle = regularTextObj.fontStyle || 'normal';
      textAlign = regularTextObj.textAlign || 'left';
    }

    const left = textObj.left || 0;
    const top = textObj.top || 0;
    const angle = textObj.angle || 0;
    const scaleX = textObj.scaleX || 1;
    const scaleY = textObj.scaleY || 1;

    // Store object data
    const textObjectData: TextObjectData = {
      objectId,
      canvasObjectIndex,
      printMethod: printMethod || undefined,
      text,
      fontFamily,
      fontSize,
      fill,
      fontWeight,
      fontStyle,
      textAlign,
      left,
      top,
      angle,
      scaleX,
      scaleY,
      curveIntensity,
      isCurvedText: isCurved,
    };
    textObjectsData.push(textObjectData);

    // Create individual object SVG tightly cropped to object bounds
    // Use toSVG() method for consistent rendering (CurvedText has its own implementation)
    const objectWrapperAttrs =
      ` id="${escapeXml(`text-${objectId}`)}"` +
      ` data-object-id="${escapeXml(objectId)}"` +
      ` data-canvas-index="${canvasObjectIndex}"` +
      (printMethod ? ` data-print-method="${escapeXml(printMethod)}"` : '') +
      (isCurved ? ` data-curved-text="true" data-curve-intensity="${curveIntensity}"` : '');

    const fabricObjectMarkup = textObj.toSVG();

    // Log what type of SVG was generated (path vs text)
    if (isCurved) {
      const hasPathData = fabricObjectMarkup.includes('<path');
      console.log(`[SVG Export] CurvedText SVG output: ${hasPathData ? 'PATH (outlined)' : 'TEXT (fallback)'}`);
      if (!hasPathData) {
        console.warn(`[SVG Export] CurvedText "${text}" could not be converted to paths - font may not be loaded`);
      }
    }
    const wrappedObjectMarkup = `    <g${objectWrapperAttrs}>\n${indentSvgMarkup(
      fabricObjectMarkup,
      '      '
    )}\n    </g>`;

    // Get object bounding box and create tightly-cropped SVG
    // Get the actual bounding box of the object including all transformations
    textObj.setCoords();
    const bbox = textObj.getBoundingRect();

    const bboxWidth = bbox.width > 0 ? bbox.width : fontSize;
    const bboxHeight = bbox.height > 0 ? bbox.height : fontSize;

    // Calculate offset to translate object to top-left of the cropped SVG
    const offsetX = -bbox.left;
    const offsetY = -bbox.top;

    // Create tightly-cropped SVG with object translated to (0,0)
    const perObjectSvg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${formatSvgNumber(bboxWidth)}"
     height="${formatSvgNumber(bboxHeight)}"
     viewBox="0 0 ${formatSvgNumber(bboxWidth)} ${formatSvgNumber(bboxHeight)}">
  <g transform="translate(${formatSvgNumber(offsetX)}, ${formatSvgNumber(offsetY)})">
${wrappedObjectMarkup}
  </g>
</svg>`;

    objectSvgs.push({
      objectId,
      canvasObjectIndex,
      svg: perObjectSvg,
      svgDataUrl: svgToDataUrl(perObjectSvg),
      textObject: textObjectData,
    });
  });

  return {
    svg: '', // No combined SVG needed - using individual object SVGs only
    textObjects: textObjectsData,
    objectSvgs,
  };
}

/**
 * Async version of extractTextObjectsToSVG that converts ALL text objects to paths
 * This ensures both regular text and curved text are exported as SVG paths (not text elements)
 * @param canvas - Fabric.js canvas instance
 * @returns SVG export result with all text converted to paths
 */
export async function extractTextObjectsToSVGAsync(
  canvas: fabric.Canvas
): Promise<SVGExportResult> {
  // Wait for all CurvedText fonts to load before extracting
  await waitForCurvedTextFonts(canvas);

  const canvasObjects = canvas.getObjects();
  console.log('[SVG Export] Total canvas objects:', canvasObjects.length);
  console.log(
    '[SVG Export] Object types:',
    canvasObjects.map((obj) => obj.type)
  );

  const textObjects = canvasObjects
    .map((obj, canvasObjectIndex) => ({ obj, canvasObjectIndex }))
    .filter(({ obj }) => {
      const type = obj.type?.toLowerCase();
      // Include standard text types and CurvedText
      const isText =
        type === 'i-text' ||
        type === 'itext' ||
        type === 'text' ||
        type === 'textbox' ||
        type === 'curvedtext' ||
        isCurvedText(obj);
      console.log(
        `[SVG Export] Object type: ${type}, isText: ${isText}, isCurvedText: ${isCurvedText(obj)}`
      );
      return isText;
    })
    .map(({ obj, canvasObjectIndex }) => ({
      textObj: obj,
      canvasObjectIndex,
      isCurved: isCurvedText(obj),
    }));

  console.log('[SVG Export] Text objects found:', textObjects.length);

  if (textObjects.length === 0) {
    return {
      svg: '',
      textObjects: [],
      objectSvgs: [],
    };
  }

  // Extract data for each text object
  const textObjectsData: TextObjectData[] = [];
  const objectSvgs: TextObjectSVGExport[] = [];

  for (let textIndex = 0; textIndex < textObjects.length; textIndex++) {
    const { textObj, canvasObjectIndex, isCurved } = textObjects[textIndex];
    const objectId = getFabricObjectId(textObj) ?? `text-${textIndex}`;
    const printMethod = getFabricObjectPrintMethod(textObj);

    // Get text properties for data storage
    let text: string;
    let fontFamily: string;
    let fontSize: number;
    let fill: string;
    let fontWeight: string;
    let fontStyle: string;
    let textAlign: string;
    let curveIntensity: number | undefined;

    if (isCurved) {
      const curvedObj = textObj as CurvedText;
      text = curvedObj.text || '';
      fontFamily = curvedObj.fontFamily || 'Arial';
      fontSize = curvedObj.fontSize || 16;
      fill = curvedObj.fill?.toString() || '#000000';
      fontWeight = curvedObj.fontWeight?.toString() || 'normal';
      fontStyle = curvedObj.fontStyle || 'normal';
      textAlign = 'center'; // CurvedText is always centered
      curveIntensity = curvedObj.curveIntensity;
    } else {
      const regularTextObj = textObj as fabric.IText;
      text = regularTextObj.text || '';
      fontFamily = regularTextObj.fontFamily || 'Arial';
      fontSize = regularTextObj.fontSize || 16;
      fill = regularTextObj.fill?.toString() || '#000000';
      fontWeight = regularTextObj.fontWeight?.toString() || 'normal';
      fontStyle = regularTextObj.fontStyle || 'normal';
      textAlign = regularTextObj.textAlign || 'left';
    }

    const left = textObj.left || 0;
    const top = textObj.top || 0;
    const angle = textObj.angle || 0;
    const scaleX = textObj.scaleX || 1;
    const scaleY = textObj.scaleY || 1;

    // Store object data
    const textObjectData: TextObjectData = {
      objectId,
      canvasObjectIndex,
      printMethod: printMethod || undefined,
      text,
      fontFamily,
      fontSize,
      fill,
      fontWeight,
      fontStyle,
      textAlign,
      left,
      top,
      angle,
      scaleX,
      scaleY,
      curveIntensity,
      isCurvedText: isCurved,
    };
    textObjectsData.push(textObjectData);

    // Generate SVG markup - convert ALL text to paths
    let fabricObjectMarkup: string;

    if (isCurved) {
      // For CurvedText, use our own path generation with font loading
      console.log(
        `[SVG Export] Converting CurvedText "${text}" to path (curve=${curveIntensity})...`
      );
      const pathResult = await generateCurvedTextPathSVG(
        textObj as CurvedText,
        objectId,
        canvasObjectIndex,
        printMethod
      );

      if (pathResult.pathData) {
        fabricObjectMarkup = pathResult.svg;
        console.log(`[SVG Export] CurvedText converted to PATH`);
      } else {
        // Fallback to CurvedText's toSVG if our conversion fails
        fabricObjectMarkup = textObj.toSVG();
        const hasPathData = fabricObjectMarkup.includes('<path');
        console.warn(
          `[SVG Export] CurvedText "${text}" fallback: ${hasPathData ? 'PATH' : 'TEXT'}`
        );
      }
    } else {
      // For regular text objects, convert to path using opentype.js
      console.log(
        `[SVG Export] Converting regular text "${text}" to path...`
      );
      const pathResult = await generateTextPathSVG(
        textObj as fabric.IText,
        objectId,
        canvasObjectIndex,
        printMethod
      );

      if (pathResult.pathData) {
        // Use the path-based SVG
        fabricObjectMarkup = pathResult.svg;
        console.log(`[SVG Export] Regular text converted to PATH`);
      } else {
        // Fallback to text element if path generation fails
        fabricObjectMarkup = textObj.toSVG();
        console.warn(
          `[SVG Export] Regular text "${text}" could not be converted to path - using text fallback`
        );
      }
    }

    // Build wrapper attributes
    const objectWrapperAttrs =
      ` id="${escapeXml(`text-${objectId}`)}"` +
      ` data-object-id="${escapeXml(objectId)}"` +
      ` data-canvas-index="${canvasObjectIndex}"` +
      (printMethod ? ` data-print-method="${escapeXml(printMethod)}"` : '') +
      (isCurved ? ` data-curved-text="true" data-curve-intensity="${curveIntensity}"` : ` data-converted-from="text"`);

    const wrappedObjectMarkup = `    <g${objectWrapperAttrs}>\n${indentSvgMarkup(
      fabricObjectMarkup,
      '      '
    )}\n    </g>`;

    // Get object bounding box and create tightly-cropped SVG
    textObj.setCoords();
    const bbox = textObj.getBoundingRect();

    const bboxWidth = bbox.width > 0 ? bbox.width : fontSize;
    const bboxHeight = bbox.height > 0 ? bbox.height : fontSize;

    // Calculate offset to translate object to top-left of the cropped SVG
    const offsetX = -bbox.left;
    const offsetY = -bbox.top;

    // Create tightly-cropped SVG with object translated to (0,0)
    const perObjectSvg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${formatSvgNumber(bboxWidth)}"
     height="${formatSvgNumber(bboxHeight)}"
     viewBox="0 0 ${formatSvgNumber(bboxWidth)} ${formatSvgNumber(bboxHeight)}">
  <g transform="translate(${formatSvgNumber(offsetX)}, ${formatSvgNumber(offsetY)})">
${wrappedObjectMarkup}
  </g>
</svg>`;

    // Generate high-DPI PNG (300 DPI) with transparent background
    const pngResult = await renderObjectToPNG(textObj);

    const exportData: TextObjectSVGExport = {
      objectId,
      canvasObjectIndex,
      svg: perObjectSvg,
      svgDataUrl: svgToDataUrl(perObjectSvg),
      textObject: textObjectData,
    };

    // Add PNG data if rendering succeeded
    if (pngResult) {
      exportData.pngDataUrl = pngResult.dataUrl;
      exportData.pngWidth = pngResult.width;
      exportData.pngHeight = pngResult.height;
      console.log(
        `[Export] Generated ${EXPORT_DPI} DPI PNG for "${text}" (${pngResult.width}x${pngResult.height})`
      );
    }

    objectSvgs.push(exportData);
  }

  return {
    svg: '', // No combined SVG needed - using individual object SVGs only
    textObjects: textObjectsData,
    objectSvgs,
  };
}

/**
 * Extract text objects from canvas and upload as SVG to Supabase
 * Waits for CurvedText fonts to load before exporting to ensure proper path generation
 * @param supabase - Supabase client instance
 * @param canvas - Fabric.js canvas instance
 * @param filename - Optional custom filename
 * @returns SVG export result with upload information
 */
export async function extractAndUploadTextSVG(
  supabase: SupabaseClient,
  canvas: fabric.Canvas,
  filename?: string
): Promise<SVGExportResult> {
  // Wait for fonts and extract SVG (curved text will be paths)
  const result = await extractTextObjectsToSVGAsync(canvas);

  if (!result.svg) {
    console.warn('No text objects found in canvas');
    return result;
  }

  // Upload to Supabase
  const uploadResult = await uploadSVGToStorage(
    supabase,
    result.svg,
    STORAGE_BUCKETS.TEXT_EXPORTS,
    STORAGE_FOLDERS.SVG,
    filename
  );

  return {
    ...result,
    uploadResult,
  };
}

/**
 * Extract text objects from all canvases and upload as separate SVG files
 * @param supabase - Supabase client instance
 * @param canvasMap - Map of canvas instances by side ID
 * @returns Map of SVG export results by side ID
 */
export async function extractAndUploadAllTextSVG(
  supabase: SupabaseClient,
  canvasMap: Record<string, fabric.Canvas>
): Promise<Record<string, SVGExportResult>> {
  const results: Record<string, SVGExportResult> = {};

  for (const [sideId, canvas] of Object.entries(canvasMap)) {
    const result = await extractAndUploadTextSVG(
      supabase,
      canvas,
      `text-${sideId}`
    );
    results[sideId] = result;
  }

  return results;
}

/**
 * Helper function to escape XML special characters
 */
function escapeXml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function svgToDataUrl(svgContent: string): string {
  const encoded = encodeURIComponent(svgContent)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

function getFabricObjectId(obj: fabric.FabricObject): string | null {
  // @ts-expect-error - Reading custom data property
  return obj.data?.objectId || obj.data?.id || null;
}

function getFabricObjectPrintMethod(obj: fabric.FabricObject): string | null {
  // @ts-expect-error - Reading custom data property
  return obj.data?.printMethod || null;
}

function indentSvgMarkup(markup: string, indent: string): string {
  return String(markup)
    .split('\n')
    .map(line => (line.length ? `${indent}${line}` : line))
    .join('\n');
}

function formatSvgNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 10000) / 10000;
  return String(rounded);
}

/**
 * Download SVG content as a file (for testing/debugging)
 */
export function downloadSVG(svgContent: string, filename: string = 'text-export.svg'): void {
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Extract uploaded image URLs from canvas state JSON
 * @param canvasStateMap - Map of side IDs to canvas states (JSON objects or strings)
 * @returns Map of side IDs to arrays of image metadata
 */
export function extractImageUrlsFromCanvasState(
  canvasStateMap: Record<string, CanvasState | string>
): Record<string, Array<{ url: string; path?: string; uploadedAt?: string }>> {
  const imageUrls: Record<string, Array<{ url: string; path?: string; uploadedAt?: string }>> = {};

  for (const [sideId, canvasStateRaw] of Object.entries(canvasStateMap)) {
    // Parse canvas state if it's a JSON string
    let canvasState: CanvasState;
    try {
      if (typeof canvasStateRaw === 'string') {
        canvasState = JSON.parse(canvasStateRaw);
      } else {
        canvasState = canvasStateRaw;
      }
    } catch (error) {
      console.error(`Failed to parse canvas state for ${sideId}:`, error);
      continue;
    }

    if (!canvasState || !canvasState.objects || canvasState.objects.length === 0) {
      continue;
    }

    // Filter for image objects with Supabase storage data (case-insensitive)
    const imageObjects = canvasState.objects.filter(obj => obj.type?.toLowerCase() === 'image');

    const sideImages: Array<{ url: string; path?: string; uploadedAt?: string }> = [];

    imageObjects.forEach(imgObj => {
      // Check if image has Supabase storage metadata
      const supabaseUrl = imgObj.data?.supabaseUrl;
      const supabasePath = imgObj.data?.supabasePath;
      const uploadedAt = imgObj.data?.uploadedAt;

      if (supabaseUrl) {
        sideImages.push({
          url: String(supabaseUrl),
          path: supabasePath ? String(supabasePath) : undefined,
          uploadedAt: uploadedAt ? String(uploadedAt) : undefined,
        });
      }
    });

    if (sideImages.length > 0) {
      imageUrls[sideId] = sideImages;
    }
  }

  return imageUrls;
}
