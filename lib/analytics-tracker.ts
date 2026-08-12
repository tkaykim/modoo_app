/**
 * Supabase analytics_events 클라이언트 트래커.
 *
 * page_view 자동 + custom event 헬퍼. utm/referrer/세션ID 자동 파싱.
 * /api/analytics/track 으로 비동기 전송 (sendBeacon → fetch fallback).
 */

import {
  readNaverAdParams,
  shouldApplyNaverAttribution,
  type NaverAdParams,
} from './utm-attribution';

const SESSION_KEY = 'mu_session_id';
const UTM_KEY = 'mu_utm';
const SESSION_TTL_MS = 30 * 60 * 1000;

type StoredUtm = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  /** 네이버 검색광고 유입 상세 (검색어·순위·소재). utm 3종으로는 못 담는 정보. */
  naver?: NaverAdParams | null;
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
    // 네이버 검색광고는 utm 을 안 붙이므로, 자동추적 파라미터를 utm 3종으로 정규화한다.
    // 이걸 안 하면 유입은 오는데 utm_source 가 비어 집계·귀속이 통째로 불가능하다.
    // 단, 명시적 utm_source 가 있으면 그 채널이 진짜 유입원이라 섞지 않는다.
    const naver = shouldApplyNaverAttribution(sp) ? readNaverAdParams(sp) : null;
    const u = {
      utm_source: sp.get('utm_source') || (naver ? 'naver' : null),
      utm_medium: sp.get('utm_medium') || (naver ? 'cpc' : null),
      // 광고그룹 ID 원문을 그대로 둔다 — 네이버 API `/ncc/adgroups` 와 바로 조인된다.
      utm_campaign: sp.get('utm_campaign') || naver?.n_ad_group || null,
    };
    if (u.utm_source || u.utm_medium || u.utm_campaign) {
      const payload: StoredUtm = { ...u, naver, ts: Date.now() };
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
  const naver =
    (shouldApplyNaverAttribution(sp) ? readNaverAdParams(sp) : null) || stored.naver || null;
  // 검색어·순위·소재는 utm 컬럼에 자리가 없어 meta 로 넣는다.
  // 호출측 meta 를 덮지 않도록 병합하고, 키는 naver_ 로 접두해 충돌을 피한다.
  const naverMeta = naver
    ? {
        naver_query: naver.n_query ?? null,
        naver_rank: naver.n_rank ?? null,
        naver_ad_group: naver.n_ad_group ?? null,
        naver_ad: naver.n_ad ?? null,
        naver_match: naver.n_match ?? null,
        naver_media: naver.n_media ?? null,
      }
    : null;
  const mergedMeta = meta || naverMeta ? { ...(meta ?? {}), ...(naverMeta ?? {}) } : null;

  const body = {
    event_type,
    path: window.location.pathname + window.location.search,
    referrer: document.referrer || null,
    utm_source: sp.get('utm_source') || stored.utm_source || (naver ? 'naver' : null),
    utm_medium: sp.get('utm_medium') || stored.utm_medium || (naver ? 'cpc' : null),
    utm_campaign: sp.get('utm_campaign') || stored.utm_campaign || naver?.n_ad_group || null,
    device: detectDevice(),
    user_agent: navigator.userAgent || null,
    session_id: getOrCreateSessionId(),
    meta: mergedMeta,
  };
  sendPayload(body);
}

export function trackPageview(): void {
  track({ event_type: 'page_view' });
}
