import { createHmac } from 'crypto';

const EXPIRY_HOURS = 72;

function getSecret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback-secret';
}

export function generateChatReplyToken(orderItemId: string, orderId: string): string {
  const expiry = Date.now() + EXPIRY_HOURS * 60 * 60 * 1000;
  const payload = `${orderItemId}|${orderId}|${expiry}`;
  const sig = createHmac('sha256', getSecret()).update(payload).digest('base64url');
  return Buffer.from(JSON.stringify({ oi: orderItemId, o: orderId, exp: expiry, sig })).toString('base64url');
}

export function verifyChatReplyToken(token: string): { orderItemId: string; orderId: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString());
    const { oi, o, exp, sig } = decoded;

    if (!oi || !o || !exp || !sig) return null;
    if (Date.now() > exp) return null;

    const payload = `${oi}|${o}|${exp}`;
    const expected = createHmac('sha256', getSecret()).update(payload).digest('base64url');
    if (sig !== expected) return null;

    return { orderItemId: oi, orderId: o };
  } catch {
    return null;
  }
}

export function buildReplyUrl(orderItemId: string, orderId: string): string {
  const token = generateChatReplyToken(orderItemId, orderId);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://modoouniform.com';
  return `${baseUrl}/chat/reply?token=${token}`;
}

export function buildQuickReplyUrl(orderItemId: string, orderId: string, message: string): string {
  const token = generateChatReplyToken(orderItemId, orderId);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://modoouniform.com';
  return `${baseUrl}/api/chat/quick-reply?token=${token}&msg=${encodeURIComponent(message)}`;
}
