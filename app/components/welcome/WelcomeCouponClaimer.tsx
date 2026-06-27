'use client';

// 가입 직후 웰컴쿠폰을 자동 발급하고, 고객이 "지급받았다"는 사실을 인지하도록
// 지급완료 모달을 1회 노출한다.
// 트리거: 로그인 상태 + welcome:pending 플래그(가입 경로에서 set) + 신규 계정.
// registerCoupon 은 멱등이라 중복 실행되어도 안전하다.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useWelcomeOverlayStore } from '@/store/useWelcomeOverlayStore';
import {
  isWelcomePending,
  clearWelcomePending,
  claimWelcomeCoupon,
  isNewAccount,
  WELCOME_COUPON_MIN_ORDER,
  WELCOME_COUPON_VALID_DAYS,
} from '@/lib/welcomeCoupon';
import WelcomeCouponArt from './WelcomeCouponArt';

export default function WelcomeCouponClaimer() {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const setOverlayOpen = useWelcomeOverlayStore((s) => s.setOpen);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showSuccess, setShowSuccess] = useState(false);
  const inFlight = useRef(false);

  const getFieldSalesReturnPath = useCallback(() => {
    const candidates: Array<string | null> = [searchParams.get('redirect')];
    try {
      candidates.push(sessionStorage.getItem('login:returnTo'));
      candidates.push(localStorage.getItem('login:returnTo'));
    } catch {}

    const path = candidates.find((value) =>
      Boolean(value && value.startsWith('/mall/') && !value.startsWith('//'))
    );
    return path ?? null;
  }, [searchParams]);

  // 지급완료 모달이 떠 있는 동안 챗봇 버블을 숨기도록 신호 공유.
  useEffect(() => {
    setOverlayOpen(showSuccess);
    return () => setOverlayOpen(false);
  }, [showSuccess, setOverlayOpen]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !user) return;
    if (!isWelcomePending()) return;
    if (inFlight.current) return;

    // 가입 경로가 "이미 가입된 계정"으로 흘러간 경우(기존 회원) 발급 차단.
    if (!isNewAccount(user.created_at)) {
      clearWelcomePending();
      return;
    }

    inFlight.current = true;
    (async () => {
      const result = await claimWelcomeCoupon();
      if (result.granted) {
        clearWelcomePending();
        const returnPath = getFieldSalesReturnPath();
        if (returnPath) {
          try {
            sessionStorage.removeItem('login:returnTo');
            localStorage.removeItem('login:returnTo');
          } catch {}
          router.replace(returnPath);
          return;
        }
        setShowSuccess(true);
      } else if (result.ok) {
        // 발급은 못 했지만 정상 응답(예: 쿠폰 비활성) → 무한 재시도 방지 위해 정리.
        clearWelcomePending();
      }
      // result.ok === false (네트워크 오류 등) 면 플래그 유지 → 다음 진입 때 재시도.
      inFlight.current = false;
    })();
  }, [getFieldSalesReturnPath, isAuthenticated, isLoading, router, user]);

  if (!showSuccess) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="쿠폰 지급 완료"
    >
      <button
        type="button"
        aria-label="닫기"
        onClick={() => setShowSuccess(false)}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <div className="relative w-full sm:max-w-[380px] animate-slide-up sm:animate-none">
        <div
          className="relative overflow-hidden rounded-t-3xl sm:rounded-3xl px-6 pb-7 pt-9 text-center shadow-2xl"
          style={{
            background:
              'radial-gradient(120% 80% at 50% -10%, #2a3a63 0%, #161d2e 55%, #0e131f 100%)',
          }}
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
            <CheckCircle2 className="h-7 w-7 text-emerald-400" />
          </div>
          <h2 className="mt-3 text-2xl font-black text-white">쿠폰이 지급되었어요! 🎉</h2>
          <p className="mt-1 text-[13px] text-slate-300">
            신규회원 1만원 할인쿠폰이 내 쿠폰함에 담겼어요.
          </p>

          <WelcomeCouponArt className="mt-5" />

          <div className="mt-5 rounded-xl bg-white/5 px-4 py-3 text-left text-[12.5px] text-slate-300">
            <div className="flex justify-between py-0.5">
              <span className="text-slate-400">할인 금액</span>
              <span className="font-semibold text-white">10,000원</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-400">사용 조건</span>
              <span className="font-semibold text-white">
                {WELCOME_COUPON_MIN_ORDER.toLocaleString()}원 이상 주문
              </span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-400">유효 기간</span>
              <span className="font-semibold text-white">발급일로부터 {WELCOME_COUPON_VALID_DAYS}일</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowSuccess(false);
              router.push('/home/my-page/coupons');
            }}
            className="mt-5 w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 py-3.5 text-base font-bold text-amber-950 shadow-lg shadow-amber-500/25 transition active:scale-[0.98]"
          >
            쿠폰함에서 확인하기
          </button>
          <button
            type="button"
            onClick={() => setShowSuccess(false)}
            className="mt-2.5 w-full text-[13px] font-medium text-slate-300 hover:underline"
          >
            나중에 보기
          </button>
        </div>
      </div>
    </div>
  );
}
