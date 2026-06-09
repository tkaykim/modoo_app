'use client';

// 신규회원 웰컴쿠폰 3D 비주얼 (CSS/SVG). 참고 크리에이티브(다크 네이비 + 골드)의
// 입체 쿠폰 티켓 느낌을 코드로 재현한다. 실제 3D 렌더 PNG로 교체하고 싶으면
// 이 컴포넌트만 <img src="/welcome-hero.png" /> 로 바꾸면 된다.

interface WelcomeCouponArtProps {
  className?: string;
}

export default function WelcomeCouponArt({ className = '' }: WelcomeCouponArtProps) {
  return (
    <div className={`relative mx-auto w-full max-w-[300px] aspect-[16/10] ${className}`}>
      {/* 바닥 광원 */}
      <div
        className="absolute inset-x-6 bottom-2 h-16 rounded-full blur-2xl"
        style={{ background: 'radial-gradient(closest-side, rgba(255,209,102,0.45), transparent)' }}
        aria-hidden
      />

      {/* 쿠폰 티켓 본체 */}
      <div className="welcome-coupon-float absolute inset-0">
        <div
          className="relative h-full w-full overflow-hidden rounded-2xl shadow-[0_24px_60px_-12px_rgba(0,0,0,0.65)]"
          style={{
            background: 'linear-gradient(135deg, #fbfdff 0%, #e9eef6 100%)',
          }}
        >
          {/* 왼쪽 메인 영역 */}
          <div className="flex h-full">
            <div className="flex flex-1 flex-col justify-center pl-6">
              <span className="text-[11px] font-bold tracking-[0.3em] text-slate-400">
                COUPON
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span
                  className="text-[44px] font-black leading-none"
                  style={{
                    background: 'linear-gradient(180deg, #1f2a44 0%, #2d3c63 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  1만원
                </span>
              </div>
              <span className="mt-1 text-[11px] font-semibold text-slate-400">
                신규회원 할인쿠폰
              </span>
            </div>

            {/* 골드 스텁 영역 */}
            <div
              className="relative w-[34%]"
              style={{
                background: 'linear-gradient(135deg, #ffe08a 0%, #f6b733 55%, #e69c1f 100%)',
              }}
            >
              {/* 광택 */}
              <div
                className="absolute inset-0 opacity-60"
                style={{
                  background:
                    'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.65) 48%, transparent 60%)',
                }}
                aria-hidden
              />
              <div className="relative flex h-full items-center justify-center">
                <span className="text-[10px] font-extrabold tracking-widest text-amber-900/80 [writing-mode:vertical-rl]">
                  WELCOME
                </span>
              </div>
            </div>
          </div>

          {/* 퍼포레이션(절취선) — 골드 영역 경계 */}
          <div className="pointer-events-none absolute inset-y-0 right-[34%] flex flex-col items-center justify-between py-2">
            <span className="block h-3 w-3 -translate-x-1/2 rounded-full bg-slate-900" />
            <div className="my-1 w-px flex-1 border-l border-dashed border-slate-400/70" />
            <span className="block h-3 w-3 -translate-x-1/2 rounded-full bg-slate-900" />
          </div>
        </div>
      </div>

      {/* 컨페티 */}
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className="welcome-confetti absolute block rounded-[1px]"
          style={{
            left: c.left,
            top: c.top,
            width: c.size,
            height: c.size,
            background: c.color,
            animationDelay: c.delay,
            transform: `rotate(${c.rot}deg)`,
          }}
          aria-hidden
        />
      ))}
    </div>
  );
}

const CONFETTI = [
  { left: '8%', top: '12%', size: '7px', color: '#f6b733', delay: '0s', rot: 20 },
  { left: '22%', top: '4%', size: '5px', color: '#9db4e6', delay: '0.4s', rot: 45 },
  { left: '70%', top: '8%', size: '6px', color: '#ffd166', delay: '0.8s', rot: 10 },
  { left: '86%', top: '18%', size: '5px', color: '#c7d3ef', delay: '0.2s', rot: 60 },
  { left: '14%', top: '70%', size: '6px', color: '#f6b733', delay: '1s', rot: 30 },
  { left: '90%', top: '60%', size: '7px', color: '#ffe08a', delay: '0.6s', rot: 50 },
];
