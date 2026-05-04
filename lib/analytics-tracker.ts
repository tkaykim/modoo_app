/**
 * Supabase analytics_events 클라이언트 트래커.
 *
 * page_view 자동 + custom event 헬퍼. utm/referrer/세션ID 자동 파싱.
 * /api/analytics/track 으로 비동기 전송 (sendBeacon → fetch fallback).
 */

const SESSION_KEY = 'mu_session_id';
const UTM_KEY = 'mu_utm';
const SESSION_TTL_MS = 30 * 60 * 1000;

type StoredUtm = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  ts: number;
};

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return '';
  }
}

function captureUtmFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const sp = new URL(window.location.href).searchParams;
    const u = {
      utm_source: sp.get('utm_source'),
      utm_medium: sp.get('utm_medium'),
      utm_campaign: sp.get('utm_campaign'),
    };
    if (u.utm_source || u.utm_medium || u.utm_campaign) {
      const payload: StoredUtm = { ...u, ts: Date.now() };
      localStorage.setItem(UTM_KEY, JSON.stringify(payload));
    }
  } catch {
    /* noop */
  }
}

function readStoredUtm(): Partial<StoredUtm> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(UTM_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredUtm;
    if (Date.now() - parsed.ts > SESSION_TTL_MS) return {};
    return parsed;
  } catch {
    return {};
  }
}

function detectDevice(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return 'mobile';
  if (/Tablet/i.test(ua)) return 'tablet';
  return 'desktop';
}

type TrackPayload = {
  event_type: string;
  meta?: Record<string, unknown>;
};

function sendPayload(body: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    const url = '/api/analytics/track';
    const json = JSON.stringify(body);
    if (navigator.sendBeacon) {
      const blob = new Blob([json], { type: 'application/json' });
      const ok = navigator.sendBeacon(url, blob);
      if (ok) return;
    }
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: json,
      keepalive: true,
    }).catch(() => {
      /* swallow */
    });
  } catch {
    /* swallow */
  }
}

export function track({ event_type, meta }: TrackPayload): void {
  if (typeof window === 'undefined') return;
  captureUtmFromUrl();
  const stored = readStoredUtm();
  const sp = new URL(window.location.href).searchParams;
  const body = {
    event_type,
    path: window.location.pathname + window.location.search,
    referrer: document.referrer || null,
    utm_source: sp.get('utm_source') || stored.utm_source || null,
    utm_medium: sp.get('utm_medium') || stored.utm_medium || null,
    utm_campaign: sp.get('utm_campaign') || stored.utm_campaign || null,
    device: detectDevice(),
    user_agent: navigator.userAgent || null,
    session_id: getOrCreateSessionId(),
    meta: meta || null,
  };
  sendPayload(body);
}

export function trackPageview(): void {
  track({ event_type: 'page_view' });
}
