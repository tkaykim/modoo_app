import type { FontMetadata } from './fontUtils';

const TEXT_TYPES = new Set(['i-text', 'itext', 'text', 'textbox', 'curvedtext']);
const FONT_FORMATS = new Set(['ttf', 'otf', 'woff', 'woff2']);

type CanvasObject = {
  type?: unknown;
  fontFamily?: unknown;
  data?: {
    fontUrl?: unknown;
    fontMetadata?: unknown;
    fontDisplayName?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type CanvasDocument = {
  objects?: CanvasObject[];
  [key: string]: unknown;
};

function isFontMetadata(value: unknown): value is FontMetadata {
  if (!value || typeof value !== 'object') return false;
  const font = value as Partial<FontMetadata>;
  return typeof font.fontFamily === 'string' && typeof font.url === 'string' && font.url.length > 0;
}

function formatFromUrl(url: string): FontMetadata['format'] {
  const extension = url.split('?')[0].split('.').pop()?.toLowerCase() || '';
  return FONT_FORMATS.has(extension)
    ? extension as FontMetadata['format']
    : 'ttf';
}

function pathFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const marker = '/user-fonts/';
    const index = parsed.pathname.indexOf(marker);
    return index >= 0
      ? decodeURIComponent(parsed.pathname.slice(index + marker.length))
      : decodeURIComponent(parsed.pathname.split('/').pop() || '');
  } catch {
    return url.split('?')[0].split('/').pop() || '';
  }
}

function metadataFromObject(object: CanvasObject): FontMetadata | null {
  if (!object.data) return null;
  if (isFontMetadata(object.data.fontMetadata)) {
    return object.data.fontMetadata;
  }
  const url = typeof object.data.fontUrl === 'string' ? object.data.fontUrl : '';
  const fontFamily = typeof object.fontFamily === 'string' ? object.fontFamily : '';
  if (!url || !fontFamily) return null;
  const path = pathFromUrl(url);

  return {
    fontFamily,
    displayName:
      typeof object.data.fontDisplayName === 'string'
        ? object.data.fontDisplayName
        : fontFamily,
    fileName: path.split('/').pop() || fontFamily,
    url,
    path,
    uploadedAt: '',
    format: formatFromUrl(url),
  };
}

function parseCanvasDocument(value: unknown): CanvasDocument | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed as CanvasDocument : null;
    } catch {
      return null;
    }
  }
  return typeof value === 'object' ? value as CanvasDocument : null;
}

export function mergeCustomFonts(
  ...fontLists: Array<Array<FontMetadata | null | undefined> | null | undefined>
): FontMetadata[] {
  const byIdentity = new Map<string, FontMetadata>();
  for (const fonts of fontLists) {
    for (const font of fonts || []) {
      if (!font?.fontFamily || !font.url) continue;
      // URL is the immutable identity.
      // Keeping it in the key allows two uploaded files with the same display
      // family to coexist without one silently replacing the other.
      byIdentity.set(`${font.fontFamily}\n${font.url}`, font);
    }
  }
  return Array.from(byIdentity.values());
}

export function extractCustomFontsFromCanvasState(
  canvasStateMap: Record<string, unknown> | null | undefined
): FontMetadata[] {
  const found: FontMetadata[] = [];
  for (const rawState of Object.values(canvasStateMap || {})) {
    const state = parseCanvasDocument(rawState);
    for (const object of state?.objects || []) {
      const type = typeof object.type === 'string' ? object.type.toLowerCase() : '';
      if (!TEXT_TYPES.has(type)) continue;
      const metadata = metadataFromObject(object);
      if (metadata) found.push(metadata);
    }
  }
  return mergeCustomFonts(found);
}

/**
 * Makes the font file reference self-contained inside every text object.
 * This protects guest checkout and future migrations from transient Zustand,
 * cart, or saved_design metadata loss.
 */
export function bindCustomFontsToCanvasState(
  canvasStateMap: Record<string, string>,
  customFonts: FontMetadata[] | null | undefined
): { canvasState: Record<string, string>; customFonts: FontMetadata[] } {
  const knownFonts = mergeCustomFonts(customFonts, extractCustomFontsFromCanvasState(canvasStateMap));
  const byFamily = new Map(knownFonts.map((font) => [font.fontFamily, font]));
  const nextState: Record<string, string> = {};

  for (const [sideId, rawState] of Object.entries(canvasStateMap)) {
    const state = parseCanvasDocument(rawState);
    if (!state) {
      nextState[sideId] = rawState;
      continue;
    }

    const objects = (state.objects || []).map((object) => {
      const type = typeof object.type === 'string' ? object.type.toLowerCase() : '';
      const family = typeof object.fontFamily === 'string' ? object.fontFamily : '';
      if (!TEXT_TYPES.has(type) || !family) return object;

      const embedded = metadataFromObject(object);
      const metadata = embedded || byFamily.get(family);
      if (!metadata) return object;

      return {
        ...object,
        data: {
          ...(object.data || {}),
          fontUrl: metadata.url,
          fontMetadata: metadata,
          fontDisplayName: metadata.displayName || metadata.fontFamily,
        },
      };
    });

    nextState[sideId] = JSON.stringify({ ...state, objects });
  }

  return {
    canvasState: nextState,
    customFonts: mergeCustomFonts(knownFonts, extractCustomFontsFromCanvasState(nextState)),
  };
}

