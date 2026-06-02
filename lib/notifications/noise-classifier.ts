import type { ErrorReport } from './error-mail';

// ===========================================================================
// Classifies error reports as "noise" — errors that originate outside our
// own code and cannot be fixed by us. Common case: Instagram / Facebook
// in-app browser injects its own postMessage scripts, and those scripts
// crash when the WebView is torn down. We still store them (so we can see
// volume and detect new IAB patterns) but skip email alerts.
// ===========================================================================

export interface NoiseVerdict {
  isNoise: boolean;
  reason?: string;
}

interface Rule {
  reason: string;
  test: (r: ErrorReport) => boolean;
}

const IAB_UA_PATTERNS = [
  /Instagram\s/i,
  /\bFBAN\//i,
  /\bFBAV\//i,
  /\bFB_IAB\//i,
  /\bFBIOS\b/i,
  /\bLine\//i,
  /\bKAKAOTALK\b/i,
  /\bNAVER\(inapp/i,
  /\bDaumApps\b/i,
  // 네이트 앱 인앱브라우저. UA 끝에 `;ref:nate_app;appver:5.8.9;...` 꼴로 붙는다.
  // 이 웹뷰는 스크립트/모듈 응답을 중간에 끊어 받아 "Unexpected end of input" 류
  // SyntaxError 를 무더기로 발생시키는데, 우리 번들 문제가 아니라 웹뷰 환경 문제다.
  /\bref:nate_app\b/i,
];

// Hosts that are NOT real production traffic: local dev servers and Vercel
// preview deployments. Errors from these are almost always work-in-progress
// bugs the developer is actively iterating on (e.g. a half-finished refactor),
// so emailing them as "치명적 오류" just spams the inbox. We still STORE them
// (visible in the digest / dashboard) — we only skip the email alert.
function isNonProductionOrigin(url?: string): boolean {
  if (!url) return false;
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (!host) return false;
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '[::1]' ||
    host.endsWith('.local')
  ) {
    return true;
  }
  // Vercel preview deployments (e.g. modooapp-git-<branch>-<team>.vercel.app).
  // The production domain (modoouniform.com) is intentionally NOT matched.
  if (host.endsWith('.vercel.app')) return true;
  return false;
}

const RULES: Rule[] = [
  {
    reason: 'non_production_origin',
    test: (r) => isNonProductionOrigin(r.url),
  },
  {
    reason: 'meta_iab_injected_script',
    test: (r) => /iabjs:\/\//i.test(r.stack ?? '') || /iabjs:\/\//i.test(r.message),
  },
  {
    reason: 'native_bridge_unavailable',
    test: (r) => {
      const hay = `${r.message} ${r.stack ?? ''}`;
      return (
        /Java object is gone/i.test(hay) ||
        /webkit\.messageHandlers/i.test(hay) ||
        /window\.webkit/i.test(hay) ||
        /postMessage.*Java object/i.test(hay)
      );
    },
  },
  {
    reason: 'iab_browser',
    test: (r) => {
      const ua = r.userAgent ?? '';
      if (!ua) return false;
      return IAB_UA_PATTERNS.some((p) => p.test(ua));
    },
  },
  {
    reason: 'browser_extension',
    test: (r) => {
      const stack = r.stack ?? '';
      return (
        /chrome-extension:\/\//i.test(stack) ||
        /moz-extension:\/\//i.test(stack) ||
        /safari-extension:\/\//i.test(stack) ||
        // iOS Safari masks injected scripts (password managers, content
        // scripts, etc.) as `@webkit-masked-url://hidden/`. The original
        // source is hidden by design, so we can't fix it — treat as noise.
        /webkit-masked-url:\/\//i.test(stack)
      );
    },
  },
  {
    reason: 'resizeobserver_loop',
    test: (r) =>
      /ResizeObserver loop (limit exceeded|completed with undelivered notifications)/i.test(
        r.message,
      ),
  },
  {
    reason: 'script_error_opaque',
    test: (r) => r.message.trim() === 'Script error.',
  },
  {
    // 배포 직후 구버전 번들을 띄워둔 클라이언트가 해시 바뀐 청크를 못 받는 일시적 오류.
    // 새 배포로 청크 해시가 바뀌면 옛 페이지의 청크 요청이 404 가 되는데, 새로고침하면
    // 곧바로 사라진다. 우리가 고칠 버그가 아니라 배포 타이밍 이슈이므로 메일은 보내지 않는다.
    reason: 'chunk_load_failed',
    test: (r) => {
      const hay = `${r.message} ${r.stack ?? ''}`;
      return (
        /Failed to load chunk/i.test(hay) ||
        /Loading chunk\s+[\w-]+\s+failed/i.test(hay) ||
        /ChunkLoadError/i.test(hay) ||
        /error loading dynamically imported module/i.test(hay) ||
        /Importing a module script failed/i.test(hay)
      );
    },
  },
  {
    // Supabase auth 토큰의 Navigator LockManager 락 타임아웃.
    // 근본 원인(탭 간 락 경합)은 lib/supabase-client.ts 에서 processLock 으로 전환해
    // 이미 해소했고, 남는 발생은 구버전 캐시 번들을 물고 있는 클라이언트의 잔여분이다.
    // 10초 후 재시도로 복구되는 무해·일시적 오류라 저장만 하고 메일은 보내지 않는다.
    reason: 'auth_lock_timeout',
    test: (r) => {
      const hay = `${r.message} ${r.stack ?? ''}`;
      return (
        /Navigator LockManager lock/i.test(hay) ||
        /Acquiring an exclusive Navigator LockManager/i.test(hay) ||
        /navigator\.locks/i.test(hay)
      );
    },
  },
];

export function classifyNoise(report: ErrorReport): NoiseVerdict {
  for (const rule of RULES) {
    try {
      if (rule.test(report)) return { isNoise: true, reason: rule.reason };
    } catch {
      // A buggy rule must never break error reporting itself.
    }
  }
  return { isNoise: false };
}
