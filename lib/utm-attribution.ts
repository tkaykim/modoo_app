/**
 * 유입 귀속 공용 유틸 — 순수 함수만 둔다.
 *
 * analytics-tracker(클라이언트 이벤트)와 gtm(쿠키·dataLayer) 두 경로가 같은 판정을
 * 써야 하는데, 한쪽이 다른 쪽을 import 하면 클라이언트 전용 모듈이 SSR 안전한 모듈로
 * 딸려 들어가 번들 경계가 흐려진다. 그래서 공통 판정만 여기로 뺐다.
 * window/localStorage 등 브라우저 API를 절대 참조하지 않는다.
 */

/**
 * 네이버 검색광고 자동추적(trackingMode=AUTO_TRACKING_MODE)이 랜딩 URL에 붙이는 파라미터.
 * 광고 소재를 수정하지 않아도 유입 시점에 이미 따라온다 — 실측 확인(2026-08-12).
 * 예: /?n_media=27758&n_query=자주티셔츠제작&n_rank=1&n_ad_group=grp-...&n_ad=nad-...&n_match=2
 */
export type NaverAdParams = {
  /** 매체 코드 (27758=PC 검색, 8753=모바일 검색 등) */
  n_media?: string | null;
  /** 실제 검색어 — 검색어 리포트를 이걸로 만든다 */
  n_query?: string | null;
  /** 노출 순위 */
  n_rank?: string | null;
  /** 광고그룹 ID — 네이버 API `/ncc/adgroups` 와 조인 가능 */
  n_ad_group?: string | null;
  /** 소재 ID */
  n_ad?: string | null;
  /** 매칭 유형 (확장검색 여부 판별용) */
  n_match?: string | null;
};

const NAVER_PARAM_KEYS = [
  'n_media',
  'n_query',
  'n_rank',
  'n_ad_group',
  'n_ad',
  'n_match',
] as const;

/**
 * URL에 네이버 광고 파라미터가 있으면 뽑아낸다. 없으면 null.
 *
 * ⚠ `n_ad_group`을 필수로 요구한다. `search.naver.com` referrer 나 `n_query` 만으로
 * 판정하면 자연검색을 광고로 오귀속한다 (실측: 3일 referrer 130건 중 광고는 7건뿐).
 */
export function readNaverAdParams(sp: URLSearchParams): NaverAdParams | null {
  const found: NaverAdParams = {};
  let hit = false;
  for (const key of NAVER_PARAM_KEYS) {
    const value = sp.get(key);
    if (value) {
      found[key] = value;
      hit = true;
    }
  }
  return hit && found.n_ad_group ? found : null;
}

/**
 * 네이버 광고 파라미터를 적용해도 되는지 판정.
 *
 * URL에 명시적 `utm_source`가 이미 있으면 그 채널이 진짜 유입원이므로 건드리지 않는다.
 * 이걸 안 막으면 `utm_source=fb&n_ad_group=...` 같은 URL이
 * "source=fb / medium=cpc / campaign=<네이버 광고그룹>" 처럼 섞여 저장돼
 * Meta 리포트에 네이버 광고그룹이 나타난다.
 */
export function shouldApplyNaverAttribution(sp: URLSearchParams): boolean {
  return !sp.get('utm_source');
}
