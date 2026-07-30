import { SupabaseClient } from '@supabase/supabase-js';
import { uploadFileToStorage, deleteFileFromStorage, UploadResult } from './supabase-storage';
import { STORAGE_BUCKETS, STORAGE_FOLDERS } from './storage-config';
import { reportHandledError } from './reportHandledError';
import opentype from 'opentype.js';

export interface FontMetadata {
  /**
   * Unique CSS family alias used by Fabric/Canvas.
   * New uploads are fingerprinted so an uploaded file can never be confused
   * with an operating-system font that happens to have the same filename.
   */
  fontFamily: string;
  /** Human-readable family parsed from the font file. */
  displayName?: string;
  fontSubfamily?: string;
  postscriptName?: string;
  fingerprint?: string;
  intrinsicWeight?: number;
  intrinsicStyle?: 'normal' | 'italic';
  fileName: string; // Original file name
  url: string; // Public URL from Supabase
  path: string; // Storage path for deletion
  uploadedAt: string; // ISO timestamp
  format: 'ttf' | 'otf' | 'woff' | 'woff2'; // Font format
}

/**
 * Supported font file extensions
 */
const SUPPORTED_FONT_EXTENSIONS = ['ttf', 'otf', 'woff', 'woff2'] as const;

function getLocalizedFontName(
  value: Record<string, string> | string | undefined
): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value.trim() || undefined;
  return value.en || value.ko || Object.values(value).find(Boolean);
}

async function fingerprintFont(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function inspectFontFile(file: File): Promise<{
  displayName: string;
  fontSubfamily?: string;
  postscriptName?: string;
  intrinsicWeight?: number;
  intrinsicStyle?: 'normal' | 'italic';
  fingerprint: string;
}> {
  const fileBaseName = file.name.replace(/\.(ttf|otf|woff|woff2)$/i, '').trim();
  const fingerprint = await fingerprintFont(file);

  try {
    // opentype.js supports TTF/OTF/WOFF.
    // WOFF2 still receives a deterministic alias via the filename fallback.
    const font = opentype.parse(await file.arrayBuffer());
    const names = font.names as unknown as Record<string, Record<string, string> | string | undefined>;
    const displayName =
      getLocalizedFontName(names.preferredFamily) ||
      getLocalizedFontName(names.fontFamily) ||
      fileBaseName ||
      'Custom Font';
    const fontSubfamily =
      getLocalizedFontName(names.preferredSubfamily) ||
      getLocalizedFontName(names.fontSubfamily);
    const postscriptName = getLocalizedFontName(names.postScriptName);
    const tables = font.tables as unknown as {
      os2?: { usWeightClass?: number; fsSelection?: number };
      post?: { italicAngle?: number };
    };
    const italicBySelection = Boolean((tables.os2?.fsSelection ?? 0) & 0x01);
    const italicByAngle = Math.abs(tables.post?.italicAngle ?? 0) > 0.01;

    return {
      displayName,
      fontSubfamily,
      postscriptName,
      intrinsicWeight: tables.os2?.usWeightClass,
      intrinsicStyle: italicBySelection || italicByAngle ? 'italic' : 'normal',
      fingerprint,
    };
  } catch {
    return {
      displayName: fileBaseName || 'Custom Font',
      fingerprint,
    };
  }
}

/**
 * Check if a file is a valid font file
 */
export function isValidFontFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return SUPPORTED_FONT_EXTENSIONS.includes(
    ext as (typeof SUPPORTED_FONT_EXTENSIONS)[number]
  );
}

/**
 * Upload a font file to Supabase Storage
 * @param supabase - Supabase client instance
 * @param fontFile - The font file to upload
 * @param designId - Optional design ID to associate with the font
 * @returns Upload result with font metadata
 */
export async function uploadFont(
  supabase: SupabaseClient,
  fontFile: File,
  designId?: string
): Promise<{ success: boolean; fontMetadata?: FontMetadata; error?: string }> {
  try {
    // Validate font file
    if (!isValidFontFile(fontFile)) {
      return {
        success: false,
        error: 'Invalid font file. Supported formats: .ttf, .otf, .woff, .woff2',
      };
    }

    const inspected = await inspectFontFile(fontFile);
    const safeDisplayName = inspected.displayName.replace(/["']/g, '').trim() || 'Custom Font';
    const fontFamily = `Modoo Custom ${safeDisplayName} ${inspected.fingerprint.slice(0, 8)}`;
    const format = fontFile.name.split('.').pop()?.toLowerCase() as FontMetadata['format'];

    // The shared storage helper generates the collision-safe object path.
    void designId;

    // 브라우저는 폰트를 흔히 application/octet-stream 으로 올리는데, user-fonts
    // 버킷 allowed_mime_types 에 없어 업로드가 거부된다. 확장자 기반 폰트 MIME을
    // 명시해 항상 허용 목록과 일치시킨다.
    const FONT_MIME: Record<string, string> = {
      ttf: 'font/ttf',
      otf: 'font/otf',
      woff: 'font/woff',
      woff2: 'font/woff2',
    };

    // Upload to Supabase Storage
    const uploadResult: UploadResult = await uploadFileToStorage(
      supabase,
      fontFile,
      STORAGE_BUCKETS.FONTS,
      STORAGE_FOLDERS.FONTS,
      FONT_MIME[format] || 'font/ttf'
    );

    if (!uploadResult.success || !uploadResult.url || !uploadResult.path) {
      // 폰트 업로드 실패는 alert 로만 보이고 파이프라인엔 안 잡히던 사각지대 —
      // 명시적으로 보고해 우리가 알아챌 수 있게 한다.
      reportHandledError(`font upload failed: ${uploadResult.error ?? 'unknown'}`, {
        feature: 'font-upload',
        fileName: fontFile.name,
        fileType: fontFile.type,
        fileSize: fontFile.size,
        format,
      });
      return {
        success: false,
        error: uploadResult.error || 'Failed to upload font',
      };
    }

    // Create font metadata
    const fontMetadata: FontMetadata = {
      fontFamily,
      displayName: inspected.displayName,
      fontSubfamily: inspected.fontSubfamily,
      postscriptName: inspected.postscriptName,
      fingerprint: inspected.fingerprint,
      intrinsicWeight: inspected.intrinsicWeight,
      intrinsicStyle: inspected.intrinsicStyle,
      fileName: fontFile.name,
      url: uploadResult.url,
      path: uploadResult.path,
      uploadedAt: new Date().toISOString(),
      format,
    };

    return {
      success: true,
      fontMetadata,
    };
  } catch (error) {
    console.error('Error uploading font:', error);
    reportHandledError(
      `font upload exception: ${error instanceof Error ? error.message : String(error)}`,
      { feature: 'font-upload', fileName: fontFile.name, fileType: fontFile.type, fileSize: fontFile.size }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Load a custom font dynamically using FontFace API
 * @param fontMetadata - Font metadata with URL and family name
 * @returns Promise that resolves when font is loaded
 */
export async function loadCustomFont(fontMetadata: FontMetadata): Promise<void> {
  try {
    // Check if font is already loaded
    const existingFonts = document.fonts;
    const alreadyLoaded = Array.from(existingFonts).some(
      (font) => font.family === fontMetadata.fontFamily
    );

    if (alreadyLoaded) {
      console.log(`Font "${fontMetadata.fontFamily}" is already loaded`);
      return;
    }

    // Create and load FontFace
    const fontFace = new FontFace(fontMetadata.fontFamily, `url(${fontMetadata.url})`);
    const loadedFont = await fontFace.load();

    // Add to document fonts
    document.fonts.add(loadedFont);

    console.log(`Successfully loaded font: ${fontMetadata.fontFamily}`);
  } catch (error) {
    console.error(`Failed to load font "${fontMetadata.fontFamily}":`, error);
    throw error;
  }
}

/**
 * Load multiple custom fonts
 * @param fonts - Array of font metadata
 * @returns Promise that resolves when all fonts are loaded
 */
export async function loadCustomFonts(fonts: FontMetadata[]): Promise<void> {
  const loadPromises = fonts.map((font) => loadCustomFont(font));
  await Promise.all(loadPromises);
}

/**
 * Delete a font file from storage
 * @param supabase - Supabase client instance
 * @param fontPath - Storage path of the font file
 * @returns Success status
 */
export async function deleteFont(
  supabase: SupabaseClient,
  fontPath: string
): Promise<{ success: boolean; error?: string }> {
  return await deleteFileFromStorage(supabase, STORAGE_BUCKETS.FONTS, fontPath);
}

/**
 * Delete multiple font files from storage
 * @param supabase - Supabase client instance
 * @param fontPaths - Array of storage paths
 * @returns Success status
 */
export async function deleteFonts(
  supabase: SupabaseClient,
  fontPaths: string[]
): Promise<{ success: boolean; errors: string[] }> {
  const results = await Promise.all(
    fontPaths.map((path) => deleteFont(supabase, path))
  );

  const errors = results
    .filter((result) => !result.success)
    .map((result) => result.error || 'Unknown error');

  return {
    success: errors.length === 0,
    errors,
  };
}

/**
 * Get font format from font metadata
 */
export function getFontFormat(fontMetadata: FontMetadata): string {
  const formatMap: Record<FontMetadata['format'], string> = {
    ttf: 'truetype',
    otf: 'opentype',
    woff: 'woff',
    woff2: 'woff2',
  };
  return formatMap[fontMetadata.format] || 'truetype';
}

/**
 * Create a @font-face CSS rule for a custom font
 * @param fontMetadata - Font metadata
 * @returns CSS @font-face rule string
 */
export function createFontFaceCSS(fontMetadata: FontMetadata): string {
  const format = getFontFormat(fontMetadata);
  return `
@font-face {
  font-family: '${fontMetadata.fontFamily}';
  src: url('${fontMetadata.url}') format('${format}');
  font-display: swap;
}
  `.trim();
}
