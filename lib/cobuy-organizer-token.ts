import { createHmac, timingSafeEqual } from 'crypto';

const ALG = 'sha256';

function getSecret(): string {
  const s = process.env.COBUY_ORGANIZER_LINK_SECRET;
  if (!s || s.length < 32) {
    throw new Error('COBUY_ORGANIZER_LINK_SECRET is required (min 32 characters)');
  }
  return s;
}

/** 서버 전용: 주최자 무로그인 링크용 토큰 생성 (기본 유효기간 1년) */
export function createOrganizerAccessToken(sessionId: string, ttlSeconds = 86400 * 365): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = JSON.stringify({ sid: sessionId, exp });
  const payloadB64 = Buffer.from(payload, 'utf8').toString('base64url');
  const sig = createHmac(ALG, getSecret()).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

/** 서버 전용: URL 토큰 검증 → 세션 UUID */
export function verifyOrganizerAccessToken(token: string): { sessionId: string } | null {
  try {
    const secret = process.env.COBUY_ORGANIZER_LINK_SECRET;
    if (!secret || secret.length < 32) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadB64, sig] = parts;
    const expectedSig = createHmac(ALG, secret).update(payloadB64).digest('base64url');
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      sid?: string;
      exp?: number;
    };
    if (typeof payload.sid !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { sessionId: payload.sid };
  } catch {
    return null;
  }
}
