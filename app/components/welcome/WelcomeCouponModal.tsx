'use client';

// 홈 진입 시 비로그인 방문자에게 노출되는 웰컴쿠폰 팝업.
// - 데스크탑: 중앙 모달 / 모바일: 바텀시트
// - "오늘 하루 안 보기" / "닫기(X)" 분리
// - CTA → 회원가입(/login?mode=signup) / "자세히" → /event/welcome
//   (이동은 next/link <Link> 로 처리해 React 상태와 무관하게 항상 보장)
// - ?welcome=1 쿼리면 억제 플래그를 무시하고 강제 노출(QA용)
// 실제 발급은 가입 직후 WelcomeCouponClaimer 가 담당한다(이 팝업은 티저).

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { X } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import {
  shouldShowPopup,
  hidePopupForToday,
  dismissPopupForSession,
  WELCOME_COUPON_MIN_ORDER,
  WELCOME_COUPON_VALID_DAYS,
} from '@/lib/welcomeCoupon';
import WelcomeCouponArt from './WelcomeCouponArt';

// 팝업을 띄울 메인 진입 경로(홈 접속 시에만 노출).
const ENTRY_PATHS = ['/', '/home'];

function isForced(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('welcome') === '1';
  } catch {
    return false;
  }
}

export default function WelcomeCouponModal() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const forced = isForced();
    if (isLoading && !forced) return; // 세션 판정 전엔 보류(강제 노출 제외)
    if (isAuthenticated) return; // 비로그인만 노출
    if (!ENTRY_PATHS.includes(pathname ?? '')) return; // 홈 진입 시에만
    if (!forced && !shouldShowPopup()) return; // 억제 플래그(강제 노출이면 무시)

    // 진입 직후 살짝 늦게 띄워 첫 페인트를 방해하지 않는다.(강제 노출은 즉시)
    const t = setTimeout(() => setOpen(true), forced ? 0 : 900);
    return () => clearTimeout(t);
  }, [isAuthenticated, isLoading, pathname]);

  // 모달은 layout 에 상주하므로, 진입 경로를 벗어나거나 로그인되면 즉시 닫는다.
  // (CTA로 /login·/event 로 이동하면 pathname 변경 → 여기서 자동으로 닫힘)
  useEffect(() => {
    if (isAuthenticated || !ENTRY_PATHS.includes(pathname ?? '')) {
      setOpen(false);
      setClosing(false);
    }
  }, [pathname, isAuthenticated]);

  const close = (mode: 'session' | 'today') => {
    if (mode === 'today') hidePopupForToday();
    else dismissPopupForSession();
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 200);
  };

  // CTA 클릭 시 부수효과만 처리(이동은 <Link> 가 담당). 닫힘은 pathname 변경 effect 가 처리.
  const onSignupClick = () => {
    try {
      sessionStorage.setItem('login:returnTo', '/home');
    } catch {}
    dismissPopupForSession();
  };

  const onDetailClick = () => {
    dismissPopupForSession();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="신규회원 쿠폰 안내"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="닫기"
        onClick={() => close('session')}
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
          closing ? 'opacity-0' : 'opacity-100'
        }`}
      />

      {/* Panel */}
      <div
        className={`relative w-full sm:max-w-[380px] ${
          closing
            ? 'opacity-0 translate-y-2'
            : 'opacity-100 translate-y-0 animate-slide-up sm:animate-none'
        } transition-all duration-200`}
      >
        <div
          className="relative overflow-hidden rounded-t-3xl sm:rounded-3xl px-6 pb-7 pt-9 text-center shadow-2xl"
          style={{
            background:
              'radial-gradient(120% 80% at 50% -10%, #2a3a63 0%, #161d2e 55%, #0e131f 100%)',
          }}
        >
          {/* 닫기 버튼 */}
          <button
            type="button"
            onClick={() => close('session')}
            aria-label="닫기"
            className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>

          {/* 헤드라인 */}
          <p className="text-[13px] font-semibold tracking-wide text-amber-300">
            신규가입 시 특별 할인 쿠폰 지급!
          </p>
          <h2 className="mt-1 text-2xl font-black text-white">
            신규회원 <span className="text-amber-300">1만원</span> 쿠폰
          </h2>

          {/* 3D 쿠폰 */}
          <WelcomeCouponArt className="mt-5" />

          {/* 안내 문구 */}
          <p className="mt-5 text-[13px] leading-relaxed text-slate-300">
            지금 가입하면 즉시 1만원 할인쿠폰을 드려요.
            <br />
            {WELCOME_COUPON_MIN_ORDER.toLocaleString()}원 이상 주문 시 사용 · 발급일로부터 {WELCOME_COUPON_VALID_DAYS}일 이내
          </p>

          {/* CTA — 진짜 링크라 React 상태와 무관하게 항상 이동 */}
          <Link
            href="/login?mode=signup"
            onClick={onSignupClick}
            className="mt-5 block w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 py-3.5 text-center text-base font-bold text-amber-950 shadow-lg shadow-amber-500/25 transition active:scale-[0.98]"
          >
            가입하고 1만원 받기
          </Link>

          <Link
            href="/event/welcome"
            onClick={onDetailClick}
            className="mt-2.5 block w-full text-center text-[13px] font-medium text-slate-300 underline-offset-2 hover:underline"
          >
            혜택 자세히 보기
          </Link>
        </div>

        {/* 하단 바: 오늘 하루 안 보기 / 닫기 */}
        <div className="flex items-center justify-between bg-[#0e131f] px-6 py-3 text-[12px] text-slate-400 sm:rounded-b-3xl">
          <button
            type="button"
            onClick={() => close('today')}
            className="transition hover:text-slate-200"
          >
            오늘 하루 안 보기
          </button>
          <button
            type="button"
            onClick={() => close('session')}
            className="transition hover:text-slate-200"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
