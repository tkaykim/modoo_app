import type * as fabric from 'fabric';
import { createClient } from './supabase-client';
import {
  extractTextObjectsToSVGAsync,
  type TextSvgExports,
} from './canvas-svg-export';
import { uploadDataUrlToStorage, uploadSVGToStorage } from './supabase-storage';
import { STORAGE_BUCKETS, STORAGE_FOLDERS } from './storage-config';
import type { FontMetadata } from './fontUtils';
import { getTextSvgStorageMode } from './text-vector-style';

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
    try {
      const { objectSvgs } = await extractTextObjectsToSVGAsync(canvas, customFonts);
      if (objectSvgs.length === 0) continue;

      const sideObjectUrls: Record<string, string> = {};
      const sidePngUrls: Record<string, string> = {};

      for (const objectSvg of objectSvgs) {
        const objectId = safeSegment(objectSvg.objectId);
        const prefix = `${safeSegment(assetPrefix)}-${safeSegment(sideId)}-${objectId}`;
        const storageMode = getTextSvgStorageMode(objectSvg.svg);

        if (storageMode === 'invalid') {
          console.warn(
            `[checkout-text-export] ${sideId}/${objectSvg.objectId}: 유효한 SVG가 없어 캔버스 원본만 저장합니다.`
          );
        } else {
          if (storageMode === 'font') {
            console.warn(
              `[checkout-text-export] ${sideId}/${objectSvg.objectId}: path 변환 불가로 원본 폰트 <text> SVG를 저장합니다.`
            );
          }
          const svgResult = await uploadSVGToStorage(
            supabase,
            objectSvg.svg,
            STORAGE_BUCKETS.TEXT_EXPORTS,
            STORAGE_FOLDERS.SVG,
            `${prefix}.svg`
          );
          if (svgResult.success && svgResult.url) {
            sideObjectUrls[objectSvg.objectId] = svgResult.url;
          } else {
            console.warn(
              `[checkout-text-export] ${sideId}/${objectSvg.objectId}: SVG 업로드 실패로 캔버스 원본만 저장합니다.`,
              svgResult.error
            );
          }
        }

        if (!objectSvg.pngDataUrl) continue;
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

      if (Object.keys(sideObjectUrls).length > 0) {
        if (!exports.__objects) exports.__objects = {};
        exports.__objects[sideId] = sideObjectUrls;
      }
      if (Object.keys(sidePngUrls).length > 0) {
        if (!exports.__pngs) exports.__pngs = {};
        exports.__pngs[sideId] = sidePngUrls;
      }
    } catch (error) {
      // Vector assets are best-effort.
      // Canvas JSON + custom font references still preserve the customer design.
      console.warn(
        `[checkout-text-export] ${sideId}: 텍스트 자산 생성 실패로 캔버스 원본만 저장합니다.`,
        error
      );
    }
  }

  return exports;
}
