// 로컬 try/catch 로 삼켜져 window.onerror 가 안 잡는 "처리된 오류"를 에러
// 파이프라인(/api/log-error)에 명시적으로 보고한다. 사용자에겐 alert 로만 보이고
// 우리는 알아채지 못하던 실패(예: 폰트 업로드 거부)를 잡기 위한 공용 유틸.
// 절대 예외를 던지지 않는다(보고 실패가 원래 흐름을 깨면 안 됨).
export function reportHandledError(
  message: string,
  context?: Record<string, unknown>
): void {
  try {
    if (typeof window === 'undefined') return;
    const body = JSON.stringify({
      message,
      source: 'client',
      context,
      url: window.location.href,
      userAgent: navigator.userAgent,
    });
    const blob = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon && navigator.sendBeacon('/api/log-error', blob)) return;
    fetch('/api/log-error', {
      method: 'POST',
      body,
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {});
  } catch {
    // never throw from the reporter
  }
}
