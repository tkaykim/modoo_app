import * as fabric from 'fabric';
import {
  KOREAN_FALLBACK_CSS,
  KOREAN_FALLBACK_FAMILY,
} from './fontConfig';

/**
 * 한글 폴백 폰트 패치 (화면 렌더링용)
 *
 * 문제: 고객이 Arial 같은 영문 전용 폰트를 고르고 한글을 입력하면, Arial에는
 * 한글 글리프가 없어 브라우저/OS 기본 한글 폰트로 폴백된다. 기기마다 폰트가
 * 달라져 디자인이 들쭉날쭉해진다.
 *
 * 해법: Fabric.js의 폰트 선언 문자열(ctx.font)에 한글 기본 폰트(Pretendard)를
 * 폴백으로 덧붙인다. 캔버스 텍스트 렌더링/측정은 CSS font-family 폴백을
 * 글자 단위로 처리하므로, 영문은 선택 폰트로 한글은 Pretendard로 그려진다.
 *
 * Fabric 7의 FabricText.prototype._getFontDeclaration 는
 *   `${fontStyle} ${fontWeight} ${fontSize}px "Arial"`
 * 형태를 반환한다. 여기에 `, "Pretendard", sans-serif` 를 붙인다.
 * IText / Textbox / Text 가 모두 FabricText 를 상속하므로 한 번에 적용된다.
 * (CurvedText 는 FabricText 를 상속하지 않으므로 curvedText.ts 에서 별도 처리)
 */

let patched = false;

export function installKoreanFontFallback(): void {
  if (patched) return;
  const proto = (fabric as unknown as { FabricText?: { prototype: Record<string, unknown> } }).FabricText?.prototype;
  if (!proto || typeof proto._getFontDeclaration !== 'function') return;

  const original = proto._getFontDeclaration as (...args: unknown[]) => string;
  proto._getFontDeclaration = function patchedGetFontDeclaration(this: unknown, ...args: unknown[]): string {
    const decl = original.apply(this, args);
    if (typeof decl !== 'string' || decl.includes(KOREAN_FALLBACK_FAMILY)) return decl;
    return `${decl}, ${KOREAN_FALLBACK_CSS}`;
  };
  patched = true;
}

// 모듈 임포트 시점에 즉시 패치 적용 (클라이언트에서만 동작).
installKoreanFontFallback();

let loadPromise: Promise<void> | null = null;

/**
 * 한글 폴백 폰트(Pretendard 400/700)를 캔버스 렌더 전에 미리 로드한다.
 * @font-face 는 globals.css 에 선언돼 있고, 여기서는 document.fonts.load 로
 * 실제 페치를 트리거해 첫 렌더부터 한글이 Pretendard 로 그려지게 한다.
 */
export function ensureKoreanFallbackFontLoaded(): Promise<void> {
  if (loadPromise) return loadPromise;
  if (typeof document === 'undefined' || !('fonts' in document)) {
    return Promise.resolve();
  }
  const fontset = (document as Document & { fonts: FontFaceSet }).fonts;
  loadPromise = Promise.all([
    fontset.load(`400 16px ${KOREAN_FALLBACK_FAMILY}`, '가'),
    fontset.load(`700 16px ${KOREAN_FALLBACK_FAMILY}`, '가'),
  ])
    .then(() => undefined)
    .catch((e) => {
      console.warn('[KoreanFont] Pretendard 폴백 폰트 프리로드 실패:', e);
    });
  return loadPromise;
}
