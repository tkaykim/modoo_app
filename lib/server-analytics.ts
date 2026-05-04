/**
 * Server-side analytics for purchase events.
 *
 * 다양한 결제 완료 경로(/api/toss/confirm, /api/cobuy/payment/confirm, /api/order/custom/confirm 등)에서
 * 단일 진입점 trackServerPurchase()를 호출하면 GA4 Measurement Protocol과 Meta Conversions API에
 * Purchase 이벤트를 동시 전송한다.
 *
 * 설계 원칙:
 *  - 환경변수가 비어있으면 해당 채널만 조용히 no-op (다른 채널은 정상 동작)
 *  - 절대 throw하지 않음, await하더라도 결제 응답을 막지 않음 (Promise.allSettled)
 *  - event_id = transaction_id 로 클라이언트 pixel과 dedupe 가능
 */

import crypto from 'crypto';

type PurchaseItem = {
  item_id: string;
  item_name?: string;
  item_brand?: string;
  item_category?: string;
  item_variant?: string;
  price?: number;
  quantity?: number;
};

export type Utm = {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
};

export type ServerPurchaseInput = {
  transactionId: string;
  value: number;
  currency?: string;
  items: PurchaseItem[];
  // Attribution
  clientId?: string;
  userId?: string;
  utm?: Utm;
  fbp?: string;
  fbc?: string;
  // PII for CAPI (hashed before send)
  customer?: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    country?: string;
    city?: string;
    postalCode?: string;
  };
  // Network
  clientIp?: string;
  userAgent?: string;
  eventSourceUrl?: string;
};

const sha256 = (s: string) =>
  crypto.createHash('sha256').update(s.trim().toLowerCase()).digest('hex');

async function sendGA4MeasurementProtocol(input: ServerPurchaseInput): Promise<void> {
  const measurementId =
    process.env.GA4_MEASUREMENT_ID || process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) return;

  const clientId = input.clientId || crypto.randomUUID();
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(
    measurementId,
  )}&api_secret=${encodeURIComponent(apiSecret)}`;

  const body: Record<string, unknown> = {
    client_id: clientId,
    timestamp_micros: Date.now() * 1000,
    non_personalized_ads: false,
    events: [
      {
        name: 'purchase',
        params: {
          transaction_id: input.transactionId,
          value: input.value,
          currency: input.currency || 'KRW',
          items: input.items.map((i) => ({
            item_id: i.item_id,
            item_name: i.item_name,
            item_brand: i.item_brand,
            item_category: i.item_category,
            item_variant: i.item_variant,
            price: i.price,
            quantity: i.quantity,
          })),
          ...(input.utm?.source && { campaign_source: input.utm.source }),
          ...(input.utm?.medium && { campaign_medium: input.utm.medium }),
          ...(input.utm?.campaign && { campaign_name: input.utm.campaign }),
          ...(input.utm?.term && { campaign_term: input.utm.term }),
          ...(input.utm?.content && { campaign_content: input.utm.content }),
          engagement_time_msec: 1,
        },
      },
    ],
  };
  if (input.userId) (body as Record<string, unknown>).user_id = input.userId;

  try {
    const res = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[server-analytics] GA4 MP non-2xx:', res.status, text.slice(0, 300));
    }
  } catch (e) {
    console.error('[server-analytics] GA4 MP failed:', e);
  }
}

async function sendMetaCAPI(input: ServerPurchaseInput): Promise<void> {
  const pixelId = process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  const apiVersion = process.env.META_GRAPH_API_VERSION || 'v21.0';
  if (!pixelId || !accessToken) return;

  const userData: Record<string, unknown> = {};
  if (input.customer?.email) userData.em = [sha256(input.customer.email)];
  if (input.customer?.phone) userData.ph = [sha256(input.customer.phone.replace(/[^0-9]/g, ''))];
  if (input.customer?.firstName) userData.fn = [sha256(input.customer.firstName)];
  if (input.customer?.lastName) userData.ln = [sha256(input.customer.lastName)];
  if (input.customer?.country) userData.country = [sha256(input.customer.country)];
  if (input.customer?.city) userData.ct = [sha256(input.customer.city)];
  if (input.customer?.postalCode) userData.zp = [sha256(input.customer.postalCode)];
  if (input.userId) userData.external_id = [sha256(input.userId)];
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;
  if (input.clientIp) userData.client_ip_address = input.clientIp;
  if (input.userAgent) userData.client_user_agent = input.userAgent;

  const body = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.transactionId,
        action_source: 'website',
        event_source_url: input.eventSourceUrl,
        user_data: userData,
        custom_data: {
          currency: input.currency || 'KRW',
          value: input.value,
          content_type: 'product',
          contents: input.items.map((i) => ({
            id: i.item_id,
            quantity: i.quantity,
            item_price: i.price,
          })),
          num_items: input.items.reduce((s, i) => s + (i.quantity || 0), 0),
          order_id: input.transactionId,
        },
      },
    ],
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${apiVersion}/${pixelId}/events?access_token=${encodeURIComponent(
        accessToken,
      )}`,
      {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[server-analytics] Meta CAPI non-2xx:', res.status, text.slice(0, 300));
    }
  } catch (e) {
    console.error('[server-analytics] Meta CAPI failed:', e);
  }
}

/**
 * Fire and forget. Never throws. 결제 응답을 막지 않도록 Promise.allSettled 사용.
 */
export async function trackServerPurchase(input: ServerPurchaseInput): Promise<void> {
  await Promise.allSettled([sendGA4MeasurementProtocol(input), sendMetaCAPI(input)]);
}

/**
 * NextRequest 헤더/쿠키에서 어트리뷰션 정보를 추출.
 * - _ga 쿠키 → GA4 client_id (last-click 어트리뷰션 보존)
 * - modoo_utm 쿠키 → UTM (lib/gtm.ts의 captureUtmFromLocation이 30일 저장)
 * - _fbp / _fbc 쿠키 → Meta Pixel browser/click ID
 */
export function extractAttributionFromRequest(request: Request): {
  clientId?: string;
  fbp?: string;
  fbc?: string;
  utm?: Utm;
  clientIp?: string;
  userAgent?: string;
  eventSourceUrl?: string;
} {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) {
      try {
        cookies[k] = decodeURIComponent(v);
      } catch {
        cookies[k] = v;
      }
    }
  }

  let clientId: string | undefined;
  const ga = cookies['_ga'];
  if (ga) {
    const parts = ga.split('.');
    if (parts.length >= 4) clientId = `${parts[2]}.${parts[3]}`;
  }

  let utm: Utm | undefined;
  try {
    const m = cookies['modoo_utm'];
    if (m) utm = JSON.parse(m) as Utm;
  } catch {
    // ignore
  }

  const xff = request.headers.get('x-forwarded-for');
  const clientIp = xff ? xff.split(',')[0]?.trim() : undefined;
  const userAgent = request.headers.get('user-agent') || undefined;
  const referer = request.headers.get('referer') || undefined;

  return {
    clientId,
    fbp: cookies['_fbp'],
    fbc: cookies['_fbc'],
    utm,
    clientIp,
    userAgent,
    eventSourceUrl: referer,
  };
}
