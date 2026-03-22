import type { FontMetadata } from '@/lib/fontUtils';

export type GuestDesign = {
  version: 1;
  productId: string;
  savedAt: string;
  productColor: string;
  canvasState: Record<string, string>;
  customFonts?: FontMetadata[];
};

const STORAGE_PREFIX = 'guest-design:';

function getStorageKey(productId: string) {
  return `${STORAGE_PREFIX}${productId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidGuestDesign(value: unknown): value is GuestDesign {
  if (!isRecord(value)) return false;
  if (value.version !== 1) return false;
  if (typeof value.productId !== 'string') return false;
  if (typeof value.savedAt !== 'string') return false;
  if (typeof value.productColor !== 'string') return false;
  if (!isRecord(value.canvasState)) return false;

  for (const canvasJson of Object.values(value.canvasState)) {
    if (typeof canvasJson !== 'string') return false;
  }

  return true;
}

export function saveGuestDesign(design: Omit<GuestDesign, 'version' | 'savedAt'>) {
  if (typeof window === 'undefined') return false;

  try {
    const payload: GuestDesign = {
      version: 1,
      savedAt: new Date().toISOString(),
      ...design,
    };
    window.localStorage.setItem(getStorageKey(design.productId), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function getGuestDesign(productId: string): GuestDesign | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(getStorageKey(productId));
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isValidGuestDesign(parsed)) return null;

    if (parsed.productId !== productId) return null;

    return parsed;
  } catch {
    return null;
  }
}

export function removeGuestDesign(productId: string) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(getStorageKey(productId));
  } catch {
    // ignore
  }
}

