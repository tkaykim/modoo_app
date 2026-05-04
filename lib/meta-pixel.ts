/**
 * Meta(Facebook) Pixel 클라이언트 래퍼.
 *
 * NEXT_PUBLIC_META_PIXEL_ID가 비어있으면 즉시 noop.
 * fbq() 자체는 layout.tsx의 base script가 정의함.
 *
 * event_id를 함께 전달하면 서버 CAPI(lib/server-analytics.ts)에서 같은 ID로 보낸 이벤트와 dedupe됨.
 */

declare global {
  interface Window {
    fbq?: (
      command: 'track' | 'trackCustom' | 'init',
      eventName: string,
      params?: Record<string, unknown>,
      options?: { eventID?: string },
    ) => void;
  }
}

const isPixelEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (!process.env.NEXT_PUBLIC_META_PIXEL_ID) return false;
  return typeof window.fbq === 'function';
};

const safeTrack = (
  eventName: string,
  params?: Record<string, unknown>,
  eventId?: string,
): void => {
  try {
    if (!isPixelEnabled()) return;
    if (eventId) {
      window.fbq!('track', eventName, params, { eventID: eventId });
    } else {
      window.fbq!('track', eventName, params);
    }
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[meta-pixel] track failed', e);
    }
  }
};

export const pixelViewContent = (p: {
  content_id: string;
  content_name?: string;
  content_category?: string;
  value?: number;
  currency?: string;
}): void => {
  safeTrack('ViewContent', {
    content_ids: [p.content_id],
    content_name: p.content_name,
    content_category: p.content_category,
    content_type: 'product',
    value: p.value,
    currency: p.currency || 'KRW',
  });
};

export const pixelAddToCart = (p: {
  content_ids: string[];
  value: number;
  currency?: string;
  num_items?: number;
}): void => {
  safeTrack('AddToCart', {
    content_ids: p.content_ids,
    content_type: 'product',
    value: p.value,
    currency: p.currency || 'KRW',
    num_items: p.num_items,
  });
};

export const pixelInitiateCheckout = (p: {
  content_ids: string[];
  value: number;
  currency?: string;
  num_items?: number;
}): void => {
  safeTrack('InitiateCheckout', {
    content_ids: p.content_ids,
    content_type: 'product',
    value: p.value,
    currency: p.currency || 'KRW',
    num_items: p.num_items,
  });
};

export const pixelPurchase = (p: {
  transaction_id: string;
  content_ids: string[];
  value: number;
  currency?: string;
  num_items?: number;
}): void => {
  // event_id = transaction_id → 서버 CAPI Purchase와 dedupe
  safeTrack(
    'Purchase',
    {
      content_ids: p.content_ids,
      content_type: 'product',
      value: p.value,
      currency: p.currency || 'KRW',
      num_items: p.num_items,
      order_id: p.transaction_id,
    },
    p.transaction_id,
  );
};

export const pixelLead = (p?: { value?: number; currency?: string }): void => {
  safeTrack('Lead', {
    value: p?.value,
    currency: p?.currency || 'KRW',
  });
};
