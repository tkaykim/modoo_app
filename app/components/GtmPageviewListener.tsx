'use client';

/**
 * SPA pageview를 dataLayer에 푸시하는 전역 리스너.
 *
 * 안전 가드:
 *  - usePathname만 사용(useSearchParams 미사용으로 Suspense 의존성 회피).
 *  - 첫 마운트 시 user_properties 1회(UTM/pseudo-id) + page_view 1회.
 *  - pathname 변경마다 page_view 1회. Strict Mode 더블 마운트는 ref로 가드.
 *  - 모든 푸시는 lib/gtm.ts의 pushDataLayer를 통과하므로 throw 불가.
 *  - 기존 NavigationListener(캔버스 리셋)와 완전 분리. 부작용 없음.
 *  - 화면에 아무것도 렌더하지 않음(return null).
 */

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  trackSpaPageView,
  trackUserProperties,
} from '@/lib/gtm-events';

export default function GtmPageviewListener() {
  const pathname = usePathname();
  const lastPathnameRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      trackUserProperties();
    }

    if (lastPathnameRef.current === pathname) return;
    lastPathnameRef.current = pathname;
    trackSpaPageView();
  }, [pathname]);

  return null;
}
