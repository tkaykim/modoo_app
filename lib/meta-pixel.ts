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

/**
 * SaveDesign — 커스텀 전환 이벤트 (2026-08-05 신설)
 *
 * 왜 필요한가: 단체복은 "디자인 저장 → 며칠 검토 → 결제" 흐름이라, 표준 이벤트
 * (AddToCart/Purchase)로는 구매 의도를 거의 못 잡는다. 실측(2026-08-05):
 *   - 랜딩뷰 최적화 세트가 7일간 랜딩뷰 1,384건을 만들었지만 픽셀상 장바구니 0·구매 0
 *   - 같은 기간 DB의 saved_designs 는 하루 7.3건 → 23.8건으로 3.3배 증가, 실주문도 +27%
 *   → 픽셀이 못 보는 곳에서 전환이 일어나고 있었다. 메타는 "아무것도 안 하는 트래픽"으로 학습.
 *
 * 또한 회원 가입→주문 리드타임이 평균 6.7일이고 24%가 7일을 초과해, 메타 기본
 * 기여 창(7일 클릭)으로는 구조적으로 놓친다. 디자인 저장은 당일 발생하므로
 * 최적화 신호로 훨씬 적합하다.
 *
 * 하루 20~40건 발생 → 주 140~280건으로 메타 학습 기준(주 50건)을 넉넉히 충족한다.
 * 광고세트 최적화 목표를 이 이벤트로 바꾸면 예산 잠금(학습 미완료)도 해소된다.
 */
export const pixelSaveDesign = (p: {
  design_id: string;
  content_id: string;
  value?: number;
  currency?: string;
}): void => {
  try {
    if (!isPixelEnabled()) return;
    // 표준 이벤트가 아니므로 trackCustom. event_id = design_id 로 서버 CAPI 와 dedupe 가능.
    window.fbq!(
      'trackCustom',
      'SaveDesign',
      {
        design_id: p.design_id,
        content_ids: [p.content_id],
        content_type: 'product',
        value: p.value,
        currency: p.currency || 'KRW',
      },
      { eventID: p.design_id },
    );
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[meta-pixel] SaveDesign track failed', e);
    }
  }
};

export const pixelLead = (p?: { value?: number; currency?: string }): void => {
  safeTrack('Lead', {
    value: p?.value,
    currency: p?.currency || 'KRW',
  });
};
