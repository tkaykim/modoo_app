/**
 * Shared font configuration — single source of truth for system fonts.
 * Used by both the UI (TextStylePanel) and SVG export (canvas-svg-export).
 *
 * Fonts WITH a localFontPath are converted to SVG <path> via opentype.js.
 * Fonts with null use the 300 DPI PNG fallback during export.
 *
 * 한글 처리: 시스템 영문 폰트(Arial 등)는 한글 글리프가 없어, 한글이 입력되면
 * 화면·인쇄 모두 한글 기본(폴백) 폰트인 Pretendard로 표시된다.
 * (글자별 폴백: 영문은 선택한 폰트, 한글은 Pretendard)
 */

export interface SystemFontConfig {
  fontFamily: string;
  /** Local TTF path in /public/fonts/ for opentype.js, or null for PNG-only. */
  localFontPath: string | null;
  /** 이 폰트가 한글 글리프를 포함하는지 여부. false면 한글은 폴백 폰트로 렌더링된다. */
  supportsKorean: boolean;
}

export const SYSTEM_FONTS: SystemFontConfig[] = [
  // 한글 지원 폰트 — 한글 기본/폴백 폰트로도 사용된다.
  { fontFamily: 'Pretendard', localFontPath: '/fonts/Pretendard-Regular.ttf', supportsKorean: true },
  // 영문 전용 폰트 — 한글 입력 시 Pretendard로 자동 폴백된다.
  { fontFamily: 'Freshman', localFontPath: '/fonts/Freshman.ttf', supportsKorean: false },
  { fontFamily: 'Arial', localFontPath: '/fonts/Arimo-Regular.ttf', supportsKorean: false },
  { fontFamily: 'Times New Roman', localFontPath: '/fonts/Tinos-Regular.ttf', supportsKorean: false },
  { fontFamily: 'Courier New', localFontPath: '/fonts/Cousine-Regular.ttf', supportsKorean: false },
  { fontFamily: 'Georgia', localFontPath: '/fonts/Tinos-Regular.ttf', supportsKorean: false },
  { fontFamily: 'Verdana', localFontPath: '/fonts/Arimo-Regular.ttf', supportsKorean: false },
  { fontFamily: 'Helvetica', localFontPath: '/fonts/Arimo-Regular.ttf', supportsKorean: false },
  { fontFamily: 'Comic Sans MS', localFontPath: null, supportsKorean: false },
  { fontFamily: 'Impact', localFontPath: null, supportsKorean: false },
  { fontFamily: 'Trebuchet MS', localFontPath: null, supportsKorean: false },
  { fontFamily: 'Palatino', localFontPath: null, supportsKorean: false },
];

/** Font family names for UI dropdowns */
export const SYSTEM_FONT_NAMES: string[] = SYSTEM_FONTS.map((f) => f.fontFamily);

/** fontFamily → local TTF path (or null). Used by canvas-svg-export loadFont(). */
export const SYSTEM_FONT_PATH_MAP: Record<string, string | null> =
  Object.fromEntries(SYSTEM_FONTS.map((f) => [f.fontFamily, f.localFontPath]));

/* ────────────────────────────────────────────────────────────────────────
 * 한글 기본(폴백) 폰트 — Pretendard
 * 영문 전용 폰트에 한글이 섞이면 화면 렌더링(Fabric.js canvas)과
 * 인쇄용 SVG path 추출(opentype.js) 모두 이 폰트로 한글 글리프를 채운다.
 * ──────────────────────────────────────────────────────────────────────── */
export const KOREAN_FALLBACK_FAMILY = 'Pretendard';
export const KOREAN_FALLBACK_FONT_PATH = '/fonts/Pretendard-Regular.ttf';
export const KOREAN_FALLBACK_FONT_PATH_BOLD = '/fonts/Pretendard-Bold.ttf';
/** Canvas ctx.font 에 덧붙이는 CSS 폴백 접미사 (글자별 폴백을 브라우저가 처리). */
export const KOREAN_FALLBACK_CSS = `"${KOREAN_FALLBACK_FAMILY}", sans-serif`;

const SUPPORTS_KOREAN_MAP: Record<string, boolean> = Object.fromEntries(
  SYSTEM_FONTS.map((f) => [f.fontFamily, f.supportsKorean])
);

/**
 * 해당 폰트가 한글 글리프를 지원하는지 여부.
 * 커스텀 업로드 폰트는 글리프 구성을 알 수 없으므로 true로 간주한다(불필요한 경고 방지).
 */
export function fontSupportsKorean(fontFamily: string | undefined | null): boolean {
  if (!fontFamily) return true;
  if (fontFamily in SUPPORTS_KOREAN_MAP) return SUPPORTS_KOREAN_MAP[fontFamily];
  return true; // custom/unknown 폰트 → 한글 지원으로 간주
}

/** 문자열에 한글(완성형 음절·자모)이 포함되어 있는지 검사. */
export function hasKoreanText(text: string | undefined | null): boolean {
  if (!text) return false;
  // 한글 자모(1100–11FF), 호환 자모(3130–318F), 자모 확장(A960–A97F),
  // 완성형 음절(AC00–D7A3), 음절 확장(D7B0–D7FF)
  return /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-힣ힰ-퟿]/.test(text);
}
