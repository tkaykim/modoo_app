import type * as fabric from 'fabric';
import { createClient } from './supabase-client';
import {
  extractTextObjectsToSVGAsync,
  type TextSvgExports,
} from './canvas-svg-export';
import { uploadDataUrlToStorage, uploadSVGToStorage } from './supabase-storage';
import { STORAGE_BUCKETS, STORAGE_FOLDERS } from './storage-config';
import type { FontMetadata } from './fontUtils';
import { isPathOnlyTextSvg } from './text-vector-style';

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
}

/**
 * Freeze live customer text objects into immutable production assets.
 * Guest orders do not have a saved_designs row, so this must run before the
 * editor canvas is cleared and the cart proceeds to checkout.
 */
export async function exportTextAssetsForCheckout(
  canvasMap: Record<string, fabric.Canvas>,
  customFonts: FontMetadata[],
  assetPrefix: string
): Promise<TextSvgExports> {
  const supabase = createClient();
  const exports: TextSvgExports = {};

  for (const [sideId, canvas] of Object.entries(canvasMap)) {
    const { objectSvgs } = await extractTextObjectsToSVGAsync(canvas, customFonts);
    if (objectSvgs.length === 0) continue;

    const sideObjectUrls: Record<string, string> = {};
    const sidePngUrls: Record<string, string> = {};

    for (const objectSvg of objectSvgs) {
      if (!isPathOnlyTextSvg(objectSvg.svg)) {
        throw new Error(
          `텍스트를 벡터 경로로 확정할 수 없습니다: ${sideId}/${objectSvg.objectId}`
        );
      }
      const objectId = safeSegment(objectSvg.objectId);
      const prefix = `${safeSegment(assetPrefix)}-${safeSegment(sideId)}-${objectId}`;
      const svgResult = await uploadSVGToStorage(
        supabase,
        objectSvg.svg,
        STORAGE_BUCKETS.TEXT_EXPORTS,
        STORAGE_FOLDERS.SVG,
        `${prefix}.svg`
      );
      if (!svgResult.success || !svgResult.url) {
        throw new Error(`텍스트 SVG 저장 실패: ${sideId}/${objectSvg.objectId}`);
      }
      sideObjectUrls[objectSvg.objectId] = svgResult.url;

      if (objectSvg.pngDataUrl) {
        const pngResult = await uploadDataUrlToStorage(
          supabase,
          objectSvg.pngDataUrl,
          STORAGE_BUCKETS.TEXT_EXPORTS,
          STORAGE_FOLDERS.SVG,
          `${prefix}.png`
        );
        if (pngResult.success && pngResult.url) {
          sidePngUrls[objectSvg.objectId] = pngResult.url;
        }
      }
    }

    if (!exports.__objects) exports.__objects = {};
    exports.__objects[sideId] = sideObjectUrls;
    if (Object.keys(sidePngUrls).length > 0) {
      if (!exports.__pngs) exports.__pngs = {};
      exports.__pngs[sideId] = sidePngUrls;
    }
  }

  return exports;
}
