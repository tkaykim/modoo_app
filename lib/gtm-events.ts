/**
 * GTM 이벤트별 타입 강제 헬퍼.
 *
 * 모든 함수는 lib/gtm.ts의 pushDataLayer 위에서 동작한다.
 *  - throw하지 않음
 *  - undefined/null/빈 값은 sanitize에서 제거됨
 *  - PII(이름, 연락처, 카카오ID, 단체명, 텍스트 원문, 파일명)는 절대 받지 않음
 *
 * 호출자는 이 모듈만 import하면 된다.
 */

import {
  pushDataLayer,
  normalizePagePath,
  captureUtmFromLocation,
  getOrCreatePseudoId,
  type EcommerceItem,
} from './gtm';

export type DesignActionType =
  | 'text_add'
  | 'image_upload'
  | 'template_apply'
  | 'color_change'
  | 'face_change'
  | 'layer_move'
  | 'reset'
  | 'object_delete';

export type DesignFace = 'front' | 'back' | 'left' | 'right';

const buildPagePayload = () => {
  if (typeof window === 'undefined') return {};
  return {
    page_location: window.location.href,
    page_path: window.location.pathname,
    page_path_normalized: normalizePagePath(window.location.pathname),
    page_title: typeof document !== 'undefined' ? document.title : undefined,
  };
};

// ─── 인프라 ────────────────────────────────────────────────────────────────

export const trackSpaPageView = (): void => {
  pushDataLayer({
    event: 'spa_page_view',
    ...buildPagePayload(),
  });
};

export const trackUserProperties = (): void => {
  const utm = captureUtmFromLocation();
  const pseudoId = getOrCreatePseudoId();
  pushDataLayer({
    event: 'set_user_properties',
    user_pseudo_id: pseudoId ?? undefined,
    ...(utm ?? {}),
  });
};

// ─── 상품/탐색 ────────────────────────────────────────────────────────────

export const trackViewItem = (p: {
  product_id: string;
  product_name: string;
  brand?: string;
  category?: string;
  base_price: number;
}): void => {
  const item: EcommerceItem = {
    item_id: p.product_id,
    item_name: p.product_name,
    item_brand: p.brand,
    item_category: p.category,
    price: p.base_price,
    quantity: 1,
  };
  pushDataLayer({
    event: 'view_item',
    ecommerce: {
      currency: 'KRW',
      value: p.base_price,
      items: [item],
    },
  });
};

export const trackViewItemList = (p: {
  list_id?: string;
  list_name?: string;
  items: EcommerceItem[];
}): void => {
  pushDataLayer({
    event: 'view_item_list',
    ecommerce: {
      item_list_id: p.list_id,
      item_list_name: p.list_name,
      items: p.items,
    },
  });
};

export const trackSelectItem = (p: {
  product_id: string;
  product_name: string;
  brand?: string;
  category?: string;
  price?: number;
  list_name?: string;
}): void => {
  const item: EcommerceItem = {
    item_id: p.product_id,
    item_name: p.product_name,
    item_brand: p.brand,
    item_category: p.category,
    price: p.price,
  };
  pushDataLayer({
    event: 'select_item',
    ecommerce: {
      item_list_name: p.list_name,
      items: [item],
    },
  });
};

export const trackAddToWishlist = (p: {
  product_id: string;
  product_name?: string;
  action: 'add' | 'remove';
}): void => {
  pushDataLayer({
    event: 'add_to_wishlist',
    wishlist_action: p.action,
    ecommerce: {
      items: [
        {
          item_id: p.product_id,
          item_name: p.product_name ?? '',
        },
      ],
    },
  });
};

// ─── 에디터 퍼널 ──────────────────────────────────────────────────────────

export const trackDesignStart = (p: {
  product_id: string;
  product_name?: string;
  brand?: string;
  category?: string;
}): void => {
  pushDataLayer({
    event: 'design_start',
    product_id: p.product_id,
    product_name: p.product_name,
    brand: p.brand,
    category: p.category,
  });
};

export const trackEditorOpen = (p: {
  product_id: string;
  design_id?: string;
}): void => {
  pushDataLayer({
    event: 'editor_open',
    product_id: p.product_id,
    design_id: p.design_id,
  });
};

export const trackDesignAction = (p: {
  action_type: DesignActionType;
  product_id?: string;
  design_id?: string;
  side_id?: string;
  face?: DesignFace;
  color?: string;
}): void => {
  pushDataLayer({
    event: 'design_action',
    action_type: p.action_type,
    product_id: p.product_id,
    design_id: p.design_id,
    side_id: p.side_id,
    face: p.face,
    color: p.color,
  });
};

export const trackDesignResume = (p: { product_id: string }): void => {
  pushDataLayer({
    event: 'design_resume',
    product_id: p.product_id,
  });
};

export const trackDesignDiscard = (p: { product_id: string }): void => {
  pushDataLayer({
    event: 'design_discard',
    product_id: p.product_id,
  });
};

export const trackDesignComplete = (p: {
  product_id: string;
  design_id?: string;
  faces_used: DesignFace[];
  text_count: number;
  image_count: number;
  template_used: boolean;
  retouch_requested: boolean;
  color: string;
  base_price: number;
  design_fee: number;
}): void => {
  pushDataLayer({
    event: 'design_complete',
    product_id: p.product_id,
    design_id: p.design_id,
    faces_used: p.faces_used,
    text_count: p.text_count,
    image_count: p.image_count,
    template_used: p.template_used,
    retouch_requested: p.retouch_requested,
    color: p.color,
    base_price: p.base_price,
    design_fee: p.design_fee,
  });
};

export const trackOptionQuantityChange = (p: {
  product_id: string;
  size: string;
  quantity: number;
  total_quantity: number;
}): void => {
  pushDataLayer({
    event: 'option_quantity_change',
    product_id: p.product_id,
    size: p.size,
    quantity: p.quantity,
    total_quantity: p.total_quantity,
  });
};

export const trackCheckoutIntent = (p: {
  product_id: string;
  design_id?: string;
  total_quantity: number;
  value: number;
}): void => {
  pushDataLayer({
    event: 'checkout_intent',
    product_id: p.product_id,
    design_id: p.design_id,
    total_quantity: p.total_quantity,
    value: p.value,
  });
};

// ─── 장바구니/결제 ────────────────────────────────────────────────────────

export const trackAddToCart = (p: {
  value: number;
  items: EcommerceItem[];
  design_id?: string;
}): void => {
  pushDataLayer({
    event: 'add_to_cart',
    ecommerce: {
      currency: 'KRW',
      value: p.value,
      items: p.items,
    },
    design_id: p.design_id,
  });
};

export const trackViewCart = (p: {
  value?: number;
  items?: EcommerceItem[];
}): void => {
  pushDataLayer({
    event: 'view_cart',
    ecommerce: {
      currency: 'KRW',
      value: p.value,
      items: p.items,
    },
  });
};

export const trackBeginCheckout = (p: {
  value: number;
  items: EcommerceItem[];
  design_id?: string;
}): void => {
  pushDataLayer({
    event: 'begin_checkout',
    ecommerce: {
      currency: 'KRW',
      value: p.value,
      items: p.items,
    },
    design_id: p.design_id,
  });
};

export const trackPurchase = (p: {
  transaction_id: string;
  value: number;
  items: EcommerceItem[];
}): void => {
  pushDataLayer({
    event: 'purchase',
    ecommerce: {
      transaction_id: p.transaction_id,
      currency: 'KRW',
      value: p.value,
      items: p.items,
    },
  });
};

// ─── 리드 ─────────────────────────────────────────────────────────────────

export const trackGenerateLead = (p: {
  form_type: 'quote' | 'cobuy';
  quantity_range?: string;
  desired_date?: string;
  product_count?: number;
  value?: number;
}): void => {
  pushDataLayer({
    event: 'generate_lead',
    form_type: p.form_type,
    quantity_range: p.quantity_range,
    desired_date: p.desired_date,
    product_count: p.product_count,
    value: p.value,
    currency: 'KRW',
  });
};

export const trackGenerateLeadFail = (p: {
  form_type: 'quote' | 'cobuy';
  reason?: string;
}): void => {
  pushDataLayer({
    event: 'generate_lead_fail',
    form_type: p.form_type,
    reason: p.reason,
  });
};

// ─── 공동구매 ─────────────────────────────────────────────────────────────

export const trackCobuyStepView = (p: {
  step_number: number;
  step_name: string;
}): void => {
  pushDataLayer({
    event: 'cobuy_step_view',
    step_number: p.step_number,
    step_name: p.step_name,
  });
};

export const trackCobuyStepComplete = (p: {
  step_number: number;
  step_name: string;
}): void => {
  pushDataLayer({
    event: 'cobuy_step_complete',
    step_number: p.step_number,
    step_name: p.step_name,
  });
};

export const trackCobuyDesignChoice = (p: { choice: string }): void => {
  pushDataLayer({
    event: 'cobuy_design_choice',
    choice: p.choice,
  });
};

// ─── 검색/콘텐츠/커뮤니케이션 ─────────────────────────────────────────────

export const trackSearch = (p: {
  search_term: string;
  results_count?: number;
}): void => {
  pushDataLayer({
    event: 'search',
    search_term: p.search_term,
    results_count: p.results_count,
  });
};

export const trackContentView = (p: {
  content_id: string;
  content_type: 'guide' | 'notice';
  content_category?: string;
}): void => {
  pushDataLayer({
    event: 'content_view',
    content_id: p.content_id,
    content_type: p.content_type,
    content_category: p.content_category,
  });
};

export const trackClickToCall = (p?: { phone?: string }): void => {
  pushDataLayer({
    event: 'click_to_call',
    phone: p?.phone,
  });
};

export const trackKakaoChatClick = (): void => {
  pushDataLayer({ event: 'kakao_chat_click' });
};

export const trackChatbotOpen = (p?: { source?: string }): void => {
  pushDataLayer({
    event: 'chatbot_open',
    source: p?.source,
  });
};
