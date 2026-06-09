'use client';

// 신규회원 웰컴쿠폰 이벤트 랜딩(풀버전). 홈 팝업의 "혜택 자세히 보기" 목적지.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import WelcomeCouponArt from '@/app/components/welcome/WelcomeCouponArt';
import {
  WELCOME_COUPON_MIN_ORDER,
  WELCOME_COUPON_VALID_DAYS,
} from '@/lib/welcomeCoupon';

export default function WelcomeEventPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  const goSignup = () => {
    try {
      sessionStorage.setItem('login:returnTo', '/home');
    } catch {}
    router.push('/login?mode=signup');
  };

  return (
    <div
      className="min-h-screen w-full"
      style={{
        background:
          'radial-gradient(140% 70% at 50% 0%, #2a3a63 0%, #161d2e 50%, #0b0f18 100%)',
      }}
    >
      <div className="mx-auto max-w-[480px] px-6 pb-28 pt-6 text-center text-white">
        {/* 상단 바 */}
        <div className="flex items-center">
          <Link
            href="/"
            className="flex items-center gap-1 text-[13px] text-white/60 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />홈
          </Link>
        </div>

        {/* 히어로 */}
        <p className="mt-8 text-[14px] font-semibold tracking-wide text-amber-300">
          모두의 유니폼 신규 회원 혜택
        </p>
        <h1 className="mt-2 text-[34px] font-black leading-tight">
          신규회원
          <br />
          <span className="text-amber-300">1만원 쿠폰</span> 지급
        </h1>

        <WelcomeCouponArt className="mt-10 max-w-[340px]" />

        <p className="mt-10 text-[15px] leading-relaxed text-slate-300">
          회원가입만 하면 1만원 할인쿠폰을 즉시 드립니다.
          <br />
          지금 가입하고 첫 주문을 더 저렴하게 시작하세요!
        </p>

        {/* 혜택 상세 카드 */}
        <div className="mt-9 space-y-3 text-left">
          {[
            { t: '1만원 즉시 할인', d: '가입 직후 내 쿠폰함에 자동 지급' },
            {
              t: `${WELCOME_COUPON_MIN_ORDER.toLocaleString()}원 이상 주문 시 사용`,
              d: '단체복·커스텀 의류 주문에 그대로 적용',
            },
            {
              t: `발급일로부터 ${WELCOME_COUPON_VALID_DAYS}일 이내 사용`,
              d: '1인 1매 · 신규 가입 회원 한정',
            },
          ].map((b) => (
            <div
              key={b.t}
              className="flex items-start gap-3 rounded-2xl bg-white/[0.06] px-4 py-4 ring-1 ring-white/10"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-amber-950">
                <Check className="h-4 w-4" strokeWidth={3} />
              </span>
              <div>
                <p className="text-[15px] font-bold text-white">{b.t}</p>
                <p className="mt-0.5 text-[12.5px] text-slate-400">{b.d}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 사용 안내 */}
        <p className="mt-8 text-[11.5px] leading-relaxed text-slate-500">
          ※ 본 쿠폰은 신규 가입 회원에게 1인 1매 지급되며, 발급일로부터 {WELCOME_COUPON_VALID_DAYS}일간 유효합니다.
          <br />
          다른 일부 쿠폰과 중복 사용이 제한될 수 있습니다.
        </p>
      </div>

      {/* 하단 고정 CTA */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-white/10 bg-[#0b0f18]/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto max-w-[480px]">
          {isAuthenticated ? (
            <Link
              href="/home/my-page/coupons"
              className="block w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 py-3.5 text-center text-base font-bold text-amber-950 shadow-lg shadow-amber-500/25 transition active:scale-[0.98]"
            >
              내 쿠폰함 보기
            </Link>
          ) : (
            <button
              type="button"
              onClick={goSignup}
              className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 py-3.5 text-base font-bold text-amber-950 shadow-lg shadow-amber-500/25 transition active:scale-[0.98]"
            >
              회원가입하고 1만원 받기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
