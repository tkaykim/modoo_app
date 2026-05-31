/**
 * 브랜드 키컬러 — 단일 출처(single source of truth).
 *
 * Tailwind className에서는 globals.css의 @theme 토큰 유틸을 사용한다:
 *   bg-brand / text-brand / border-brand / ring-brand / from-brand / to-brand
 *   (+ -deep / -soft / -softer / -ink 변형, /opacity 지원)
 *
 * 이 상수는 className을 쓸 수 없는 곳 전용이다:
 *   - 이메일/서버에서 렌더하는 HTML 문자열 (lib/notifications/*, API 라우트)
 *   - inline style={{ color: BRAND.base }}
 *   - SVG color prop 등
 *
 * 값을 바꿔야 하면 여기 + globals.css @theme 두 곳만 고치면 된다.
 */
export const BRAND = {
  base: '#0052cc',
  deep: '#003d99',
  soft: '#e6eefb',
  softer: '#f2f6fc',
  ink: '#001f5c',
} as const;

export type BrandColor = (typeof BRAND)[keyof typeof BRAND];
