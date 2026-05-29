'use client';

import { useSearchParams } from 'next/navigation';

/**
 * 실측 크기(mm/cm) 표시 여부 플래그.
 *
 * `?show-size=1` 쿼리가 붙은 경우에만 true. prod URL엔 안 붙으므로 고객에겐
 * 크기가 노출되지 않는다(실측 오차 컴플레인 방지). feature 프리뷰/테스트에서
 * printArea 기반 환산 정확도를 검증할 때만 켠다.
 *
 * 관련 플래그: `?layers-lab=1`(레이어 패널), `?print-picker=1`(인쇄방식 변경).
 */
export function useShowSize(): boolean {
  const searchParams = useSearchParams();
  return searchParams?.get('show-size') === '1';
}
