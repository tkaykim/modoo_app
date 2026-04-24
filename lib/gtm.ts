/**
 * GTM (Google Tag Manager) dataLayer 푸시 코어 유틸
 *
 * 설계 원칙:
 *  - 단방향 fire-and-forget. 절대 throw하지 않으며 비즈니스 로직을 차단하지 않는다.
 *  - SSR 안전(typeof window 가드). 서버 컴포넌트에서 import해도 부작용 없음.
 *  - NEXT_PUBLIC_GTM_ID가 비어 있으면 즉시 noop.
 *  - PII 화이트리스트 sanitize: 값에 포함된 객체/배열만 허용, 빈 문자열·undefined·null은 제외.
 *
 * 호출자는 항상 lib/gtm-events.ts의 trackXxx 헬퍼를 사용한다.
 */

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export type EcommerceItem = {
  item_id: string;
  item_name: string;
  item_brand?: string;
  item_category?: string;
  item_variant?: string;
  price?: number;
  quantity?: number;
  design_id?: string;
  design_fee?: number;
};

export type GtmEventName =
  | 'spa_page_view'
  | 'set_user_properties'
  | 'view_item'
  | 'view_item_list'
  | 'select_item'
  | 'design_start'
  | 'editor_open'
  | 'design_action'
  | 'design_resume'
  | 'design_discard'
  | 'design_complete'
  | 'option_quantity_change'
  | 'checkout_intent'
  | 'add_to_cart'
  | 'add_to_wishlist'
  | 'view_cart'
  | 'begin_checkout'
  | 'purchase'
  | 'generate_lead'
  | 'generate_lead_fail'
  | 'cobuy_step_view'
  | 'cobuy_step_complete'
  | 'cobuy_design_choice'
  | 'search'
  | 'content_view'
  | 'click_to_call'
  | 'kakao_chat_click'
  | 'chatbot_open';

export type GtmEvent = {
  event: GtmEventName;
  [key: string]: unknown;
};

const isEcommerceEventName = (name: GtmEventName): boolean =>
  name === 'view_item' ||
  name === 'view_item_list' ||
  name === 'select_item' ||
  name === 'add_to_cart' ||
  name === 'add_to_wishlist' ||
  name === 'view_cart' ||
  name === 'begin_checkout' ||
  name === 'purchase';

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * 빈 값 제거. PII 가드는 호출자(lib/gtm-events.ts)에서 1차로,
 * 여기서는 undefined/null/빈 문자열 정리만 수행한다.
 */
const sanitize = (input: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.length === 0) continue;
    if (Array.isArray(v)) {
      out[k] = v.map((item) =>
        isPlainObject(item) ? sanitize(item) : item,
      );
      continue;
    }
    if (isPlainObject(v)) {
      out[k] = sanitize(v);
      continue;
    }
    out[k] = v;
  }
  return out;
};

/**
 * 동적 경로(uuid/orderId/token 등)의 카디널리티 폭발을 막기 위한 정규화.
 * 브라우저 URL은 변경하지 않고, dataLayer 푸시용 별도 필드로만 사용한다.
 */
export const normalizePagePath = (pathname: string): string => {
  if (!pathname) return pathname;
  let p = pathname;
  // 토큰형 동적 라우트
  p = p.replace(/^\/editor\/[^/]+/, '/editor/:id');
  p = p.replace(/^\/order\/custom\/[^/]+/, '/order/custom/:token');
  p = p.replace(/^\/order\/(?!custom\b)[^/]+/, '/order/:id');
  p = p.replace(/^\/cobuy\/host\/[^/]+/, '/cobuy/host/:token');
  p = p.replace(/^\/cobuy\/request\/[^/]+/, '/cobuy/request/:token');
  p = p.replace(
    /^\/cobuy\/(?!(?:host|request|page|create)\b)[^/]+/,
    '/cobuy/:token',
  );
  p = p.replace(/^\/mall\/[^/]+/, '/mall/:token');
  p = p.replace(/^\/inquiries\/[^/]+/, (m) =>
    m === '/inquiries/new' ? m : '/inquiries/:id',
  );
  p = p.replace(/^\/support\/notices\/[^/]+/, '/support/notices/:id');
  p = p.replace(/^\/support\/guides\/[^/]+/, '/support/guides/:id');
  p = p.replace(
    /^\/home\/my-page\/cobuy\/[^/]+/,
    '/home/my-page/cobuy/:id',
  );
  p = p.replace(/^\/reviews\/(?!my\b)[^/]+/, '/reviews/:productId');
  p = p.replace(/^\/product\/[^/]+/, '/product/:id');
  p = p.replace(/^\/chat\/reply/, '/chat/reply');
  return p;
};

/**
 * 예상수량을 GA4 분석용 구간으로 매핑.
 */
export const getQuantityRange = (n: number): string => {
  if (!Number.isFinite(n) || n <= 0) return 'unknown';
  if (n <= 20) return '1-20';
  if (n <= 50) return '21-50';
  if (n <= 100) return '51-100';
  if (n <= 300) return '101-300';
  return '300+';
};

const PSEUDO_ID_KEY = 'modoo_pseudo_id';
const UTM_KEY = 'modoo_utm';
const COOKIE_DAYS = 30;

const safeReadCookie = (name: string): string | null => {
  try {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(
      new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&') + '=([^;]*)'),
    );
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
};

const safeWriteCookie = (
  name: string,
  value: string,
  days: number = COOKIE_DAYS,
): void => {
  try {
    if (typeof document === 'undefined') return;
    const exp = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    document.cookie =
      name +
      '=' +
      encodeURIComponent(value) +
      '; expires=' +
      exp.toUTCString() +
      '; path=/; SameSite=Lax';
  } catch {
    // noop
  }
};

const generatePseudoId = (): string => {
  try {
    const cryptoRef =
      typeof globalThis !== 'undefined'
        ? (globalThis as { crypto?: Crypto }).crypto
        : undefined;
    if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
      return cryptoRef.randomUUID();
    }
  } catch {
    // fallthrough
  }
  return (
    Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
  );
};

export const getOrCreatePseudoId = (): string | null => {
  if (typeof window === 'undefined') return null;
  let id = safeReadCookie(PSEUDO_ID_KEY);
  if (!id) {
    id = generatePseudoId();
    safeWriteCookie(PSEUDO_ID_KEY, id);
  }
  return id;
};

export type UtmParams = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
};

const UTM_KEYS: Array<keyof UtmParams> = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
];

export const captureUtmFromLocation = (): UtmParams | null => {
  try {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const fresh: UtmParams = {};
    for (const k of UTM_KEYS) {
      const v = params.get(k);
      if (v) fresh[k] = v;
    }
    if (Object.keys(fresh).length > 0) {
      safeWriteCookie(UTM_KEY, JSON.stringify(fresh));
      return fresh;
    }
    const stored = safeReadCookie(UTM_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as UtmParams;
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
};

const isGtmEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  // GTM 스니펫이 layout.tsx에서 환경변수 기반으로 삽입되므로,
  // 환경변수가 비어 있으면 dataLayer 자체가 없거나 의미 없음.
  if (!process.env.NEXT_PUBLIC_GTM_ID) return false;
  return true;
};

/**
 * 단일 진입점. 절대 throw하지 않는다.
 */
export const pushDataLayer = (payload: GtmEvent): void => {
  try {
    if (!isGtmEnabled()) return;
    const w = window;
    w.dataLayer = w.dataLayer || [];
    // GA4 권장: ecommerce 이벤트 직전에 ecommerce: null 푸시로 이전 데이터 머지 차단
    if (isEcommerceEventName(payload.event)) {
      w.dataLayer.push({ ecommerce: null });
    }
    w.dataLayer.push(sanitize(payload as unknown as Record<string, unknown>));
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[gtm] push failed', e);
    }
  }
};
