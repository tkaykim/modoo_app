'use client';

import { useEffect } from 'react';

// Next.js global error boundary. Catches rendering errors that escape all other
// error.tsx boundaries (including the root layout). Reports to /api/log-error
// and shows a minimal fallback UI.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      const body = JSON.stringify({
        message: error.message || 'global error',
        stack: error.stack,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        source: 'global',
        context: { digest: error.digest },
      });
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/log-error', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/api/log-error', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
      }
    } catch {
      // swallow
    }
  }, [error]);

  return (
    <html lang="ko">
      <body style={{ fontFamily: "'Apple SD Gothic Neo','Malgun Gothic',sans-serif", margin: 0 }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#fafafa' }}>
          <div style={{ maxWidth: 480, textAlign: 'center' }}>
            <div style={{ fontSize: 48 }}>⚠️</div>
            <h1 style={{ fontSize: 20, margin: '12px 0 6px' }}>일시적인 오류가 발생했습니다</h1>
            <p style={{ color: '#666', fontSize: 14, marginTop: 0 }}>잠시 후 다시 시도해주세요. 운영팀에 자동으로 신고되었습니다.</p>
            <button
              onClick={() => reset()}
              style={{ marginTop: 16, padding: '10px 24px', background: '#0052cc', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer' }}
            >
              다시 시도
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
