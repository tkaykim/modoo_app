'use client';

import { useEffect } from 'react';

// Route-level error boundary. Catches errors thrown within a route segment.
// Unlike global-error, the root layout (header/footer/etc.) is preserved here.
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      const body = JSON.stringify({
        message: error.message || 'route error',
        stack: error.stack,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        source: 'client',
        context: { digest: error.digest, boundary: 'route' },
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
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, textAlign: 'center', fontFamily: "'Apple SD Gothic Neo','Malgun Gothic',sans-serif" }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <h2 style={{ fontSize: 18, margin: '10px 0 6px' }}>페이지를 불러오지 못했습니다</h2>
        <p style={{ color: '#666', fontSize: 13, marginTop: 0 }}>잠시 후 다시 시도해주세요. 운영팀에 자동으로 신고되었습니다.</p>
        <button
          onClick={() => reset()}
          style={{ marginTop: 14, padding: '8px 20px', background: '#0052cc', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
