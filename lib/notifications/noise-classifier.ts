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
];

const RULES: Rule[] = [
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
