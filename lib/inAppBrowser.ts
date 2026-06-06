// 인앱 브라우저(인스타/페북/카카오 등 웹뷰) 감지 + 외부 브라우저 탈출 헬퍼.
// 인앱 웹뷰에서는 구글 OAuth 차단(disallowed_useragent), 토스 결제 앱전환/리다이렉트 실패 등으로
// 결제 전환이 깨지는 일이 잦다. 이를 감지해 "외부 브라우저로 열기"를 유도하기 위함.

export type InAppPlatform = 'ios' | 'android' | 'other';

export type InAppInfo = {
  isInApp: boolean;
  app: string | null; // 'instagram' | 'facebook' | 'kakaotalk' | 'line' | 'naver' | 'threads' | 'webview'
  platform: InAppPlatform;
};

const NO_INAPP: InAppInfo = { isInApp: false, app: null, platform: 'other' };

export function detectInApp(ua?: string): InAppInfo {
  const agent = ua ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  if (!agent) return NO_INAPP;

  const platform: InAppPlatform = /iPhone|iPad|iPod/i.test(agent)
    ? 'ios'
    : /Android/i.test(agent)
      ? 'android'
      : 'other';

  let app: string | null = null;
  if (/Instagram/i.test(agent)) app = 'instagram';
  else if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(agent)) app = 'facebook';
  else if (/KAKAOTALK/i.test(agent)) app = 'kakaotalk';
  else if (/Line\//i.test(agent)) app = 'line';
  else if (/NAVER\(inapp|NAVER\//i.test(agent)) app = 'naver';
  else if (/Barcelona/i.test(agent)) app = 'threads';
  // 일반 안드로이드 WebView (Chrome 정식 브라우저 제외)
  else if (/; wv\)/i.test(agent)) app = 'webview';

  return { isInApp: app !== null, app, platform };
}

export function appLabel(app: string | null): string {
  switch (app) {
    case 'instagram': return '인스타그램';
    case 'facebook': return '페이스북';
    case 'kakaotalk': return '카카오톡';
    case 'line': return '라인';
    case 'naver': return '네이버';
    case 'threads': return '스레드';
    default: return '인앱';
  }
}

// 안드로이드: Chrome intent 로 외부 브라우저 강제 오픈. 실패 시 false.
export function openInExternalAndroid(href?: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const url = new URL(href ?? window.location.href);
    const intentUrl = `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=com.android.chrome;end`;
    window.location.href = intentUrl;
    return true;
  } catch {
    return false;
  }
}

export async function copyCurrentUrl(href?: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const url = href ?? window.location.href;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch {
    /* fall through to legacy */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
