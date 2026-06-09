// 신규회원 웰컴쿠폰 — 노출 게이팅 / 발급 헬퍼.
// DB의 coupons.code = 'WELCOME10000' 와 1:1 대응한다.
// (fixed_amount 10000 · 1인 1매 · min_order 50000 · 발급일+30일 유효)

import { registerCoupon } from './couponService';

export const WELCOME_COUPON_CODE = 'WELCOME10000';
export const WELCOME_COUPON_AMOUNT = 10000;
export const WELCOME_COUPON_MIN_ORDER = 50000;
export const WELCOME_COUPON_VALID_DAYS = 30;

// 가입 직후 1회 발급을 시도하기 위한 의도(intent) 플래그.
// useAuthStore.signUp / signInWithOAuth(signup) 에서 set, 발급 성공 시 clear.
const PENDING_KEY = 'welcome:pending';
// 홈 진입 팝업 "오늘 하루 안 보기" — 자정까지 노출 억제 (localStorage, 영구).
const HIDE_UNTIL_KEY = 'welcome:popupHideUntil';
// 홈 진입 팝업 "닫기(X)" — 이번 세션에만 억제 (sessionStorage).
const SESSION_DISMISS_KEY = 'welcome:popupSessionDismiss';

// 가입 경로가 "이미 가입된 계정"으로 흘러갔을 때 기존 회원에게 발급되는 것을 막는
// 안전장치. 계정 생성 시각이 이 기간 이내일 때만 신규로 간주한다.
// (이메일 인증 지연을 고려해 넉넉히 7일)
const NEW_ACCOUNT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function safeLocal(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function safeSession(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

// ---- 발급 의도 플래그 ----

export function markWelcomePending(): void {
  safeLocal()?.setItem(PENDING_KEY, '1');
}

export function isWelcomePending(): boolean {
  return safeLocal()?.getItem(PENDING_KEY) === '1';
}

export function clearWelcomePending(): void {
  safeLocal()?.removeItem(PENDING_KEY);
}

// ---- 홈 팝업 노출 게이팅 ----

/** "오늘 하루 안 보기" — 다음 자정까지 억제. */
export function hidePopupForToday(): void {
  const ls = safeLocal();
  if (!ls) return;
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  ls.setItem(HIDE_UNTIL_KEY, String(end.getTime()));
}

/** "닫기(X)" — 이번 세션에만 억제(다음 방문 시 다시 노출). */
export function dismissPopupForSession(): void {
  safeSession()?.setItem(SESSION_DISMISS_KEY, '1');
}

/** 현재 홈 팝업을 노출해도 되는지(로그인 여부는 호출부에서 판단). */
export function shouldShowPopup(): boolean {
  if (safeSession()?.getItem(SESSION_DISMISS_KEY) === '1') return false;
  const until = safeLocal()?.getItem(HIDE_UNTIL_KEY);
  if (until && Number(until) > Date.now()) return false;
  return true;
}

// ---- 발급 ----

/** 계정 생성 시각이 신규 기준 내인지. createdAt 없으면(판단 불가) 신규로 간주. */
export function isNewAccount(createdAt?: string | null): boolean {
  if (!createdAt) return true;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return true;
  return Date.now() - t <= NEW_ACCOUNT_MAX_AGE_MS;
}

export interface WelcomeClaimResult {
  ok: boolean;
  /** 발급(또는 이미 보유) 성공 여부 */
  granted: boolean;
  error?: string;
}

/**
 * 웰컴쿠폰 발급 시도.
 * registerCoupon 은 멱등이라 중복 호출해도 안전하며,
 * 이미 보유 중이면 valid:true 로 돌아온다.
 */
export async function claimWelcomeCoupon(): Promise<WelcomeClaimResult> {
  try {
    const result = await registerCoupon(WELCOME_COUPON_CODE);
    if (result.valid) {
      return { ok: true, granted: true };
    }
    return { ok: true, granted: false, error: result.error };
  } catch (e) {
    return { ok: false, granted: false, error: (e as Error).message };
  }
}
