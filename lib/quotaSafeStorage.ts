import type { StateStorage } from 'zustand/middleware';

/**
 * localStorage 쓰기 실패(주로 iOS Safari `QuotaExceededError: The quota has been
 * exceeded.`)가 주문 흐름을 막지 않게 하는 zustand persist 어댑터.
 *
 * 장바구니의 localStorage 백업은 "새로고침해도 카트가 남는" 편의 기능이다.
 * 그런데 저장이 실패하면 예외가 addItem 호출부까지 올라가, 파트너몰에서
 * 사이즈별 수량을 고르고 주문을 누른 고객이 결제로 넘어가지 못했다.
 * 편의 기능의 실패가 매출 경로를 끊어선 안 된다.
 *
 * 실패 시 항목을 **통째로** 버려 가며 재시도한다. 필드를 골라내면(캔버스 데이터
 * 제거 등) 디자인 없는 반쪽 카트가 복원돼 더 나쁜 주문이 만들어질 수 있다.
 * 남기는 항목은 항상 온전한 항목이어야 한다.
 */

type PersistedShape = { state?: { items?: Array<{ addedAt?: number }> } };

/**
 * 마지막 장바구니 백업이 온전하지 못했는지(실패했거나 항목이 잘렸거나).
 *
 * 백업이 실패하면 **전체 페이지 리로드로 이동할 수 없다** — 리로드 순간 메모리
 * 상태가 날아가는데 복원할 백업이 없어 빈 장바구니가 되고, checkout 이 홈으로
 * 되돌려보낸다(비회원 한정. 회원은 장바구니가 DB 에 있어 무관).
 * 이 값이 true 면 호출부는 SPA 이동으로 갈아타 메모리 상태를 살려야 한다.
 */
let lastWriteFailed = false;
export function didCartBackupFail(): boolean {
  return lastWriteFailed;
}

/** 최근 항목 우선으로 n개만 남긴 직렬화 문자열. 파싱 불가면 null. */
function withNewestItems(value: string, keep: number): string | null {
  try {
    const parsed = JSON.parse(value) as PersistedShape;
    const items = parsed?.state?.items;
    if (!Array.isArray(items) || items.length <= keep) return null;

    const newest = [...items]
      .sort((a, b) => (b?.addedAt ?? 0) - (a?.addedAt ?? 0))
      .slice(0, keep);

    return JSON.stringify({ ...parsed, state: { ...parsed.state, items: newest } });
  } catch {
    return null;
  }
}

export const quotaSafeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },

  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
      lastWriteFailed = false;
      return;
    } catch {
      // 용량 초과. 최근 항목만 남기며 절반씩 줄여 다시 시도한다.
    }

    let keep = 8;
    while (keep >= 1) {
      const shrunk = withNewestItems(value, keep);
      if (shrunk) {
        try {
          localStorage.setItem(name, shrunk);
          // 저장은 됐지만 항목이 잘렸다. 리로드하면 방금 담은 상품이 빠질 수
          // 있으므로 "온전한 백업"으로 치지 않는다.
          lastWriteFailed = true;
          return;
        } catch {
          // 더 줄여서 재시도
        }
      }
      keep = Math.floor(keep / 2);
    }

    lastWriteFailed = true;

    // 백업을 포기한다. 메모리 상태는 그대로라 이번 주문은 정상 진행된다.
    // 남아 있던 옛 백업이 새 상태와 어긋나지 않도록 지운다.
    try {
      localStorage.removeItem(name);
    } catch {
      /* 스토리지 자체를 못 쓰는 환경 — 무시하고 진행 */
    }
  },

  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* noop */
    }
  },
};

/**
 * sessionStorage 쓰기 — 실패해도 호출부를 멈추지 않는다.
 * 저장 성공 여부를 boolean 으로 돌려주니, 값이 꼭 필요한 곳은 확인 후 분기하면 된다.
 *
 * 없어도 흐름이 진행되는 값(예: `directCheckoutItemIds` — 없으면 전체 장바구니
 * 결제로 폴백)에 쓴다. 결제 필수 데이터에는 쓰지 말 것.
 */
/**
 * 브라우저 저장공간 초과 에러면 고객이 이해할 수 있는 안내로 바꿔준다.
 * 아니면 null — 호출부가 원래 메시지를 쓰면 된다.
 *
 * iOS Safari 는 "The quota has been exceeded.", 크롬 계열은
 * "Failed to execute 'setItem' on 'Storage': ... exceeded the quota." 를 던진다.
 * 이 원문이 파트너몰 주문 화면에 그대로 노출돼 고객이 무엇을 해야 할지 몰랐다.
 */
export function describeStorageError(error: unknown): string | null {
  const raw = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '');
  const isQuota = /quota|QuotaExceeded|exceeded the quota/i.test(raw);
  if (!isQuota) return null;
  return '브라우저 저장공간이 부족합니다.\n브라우저 설정에서 사이트 데이터를 삭제하거나 다른 브라우저로 시도해주세요.';
}

export function trySessionSet(key: string, value: string): boolean {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
