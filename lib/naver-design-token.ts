import { createHash } from 'node:crypto';

const NAVER_ASSET_REFERENCE = /naver-asset:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/gi;
const NAVER_ASSET_URL = /\/api\/naver-design\/[A-Za-z0-9_-]{32,128}\/assets\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/gi;

export function hashNaverDesignToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function safeFileExtension(name: string, contentType: string): string {
  const fromName = name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (fromName && fromName.length <= 8 && fromName !== name.toLowerCase()) return fromName;
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'application/postscript') return 'ai';
  return 'bin';
}

export function sanitizeNaverDesignCanvasState(state: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(state).map(([sideId, json]) => {
    if (typeof json !== 'string') throw new Error('canvas state values must be JSON strings');
    return [sideId, json.replace(NAVER_ASSET_URL, (_match, assetId: string) => `naver-asset:${assetId.toLowerCase()}`)];
  }));
}

export function hydrateNaverDesignCanvasState(state: Record<string, unknown>, token: string): Record<string, string> {
  const encodedToken = encodeURIComponent(token);
  return Object.fromEntries(Object.entries(state).map(([sideId, json]) => {
    if (typeof json !== 'string') return [sideId, ''];
    return [sideId, json.replace(NAVER_ASSET_REFERENCE, (_match, assetId: string) => `/api/naver-design/${encodedToken}/assets/${assetId.toLowerCase()}`)];
  }));
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function resolveNaverDesignSaveState(
  currentStatus: string,
  currentSubmittedAt: string | null,
  submit: boolean,
  now: string,
): { status: string; submittedAt: string | null } {
  if (submit) return { status: 'submitted', submittedAt: now };
  if (currentStatus === 'submitted' || currentStatus === 'reviewed') {
    return { status: currentStatus, submittedAt: currentSubmittedAt };
  }
  return {
    status: currentStatus === 'needs_mapping' ? 'needs_mapping' : 'in_progress',
    submittedAt: null,
  };
}
