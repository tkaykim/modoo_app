import { createHash } from 'node:crypto';

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
