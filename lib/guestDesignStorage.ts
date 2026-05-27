import type { FontMetadata } from '@/lib/fontUtils';

export type GuestDesign = {
  version: 1;
  productId: string;
  savedAt: string;
  productColor: string;
  canvasState: Record<string, string>;
  customFonts?: FontMetadata[];
};

const STORAGE_PREFIX = 'guest-design:';

function getStorageKey(productId: string) {
  return `${STORAGE_PREFIX}${productId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidGuestDesign(value: unknown): value is GuestDesign {
  if (!isRecord(value)) return false;
  if (value.version !== 1) return false;
  if (typeof value.productId !== 'string') return false;
  if (typeof value.savedAt !== 'string') return false;
  if (typeof value.productColor !== 'string') return false;
  if (!isRecord(value.canvasState)) return false;

  for (const canvasJson of Object.values(value.canvasState)) {
    if (typeof canvasJson !== 'string') return false;
  }

  return true;
}

export function saveGuestDesign(design: Omit<GuestDesign, 'version' | 'savedAt'>) {
  if (typeof window === 'undefined') return false;

  try {
    const payload: GuestDesign = {
      version: 1,
      savedAt: new Date().toISOString(),
      ...design,
    };
    window.localStorage.setItem(getStorageKey(design.productId), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function getGuestDesign(productId: string): GuestDesign | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(getStorageKey(productId));
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isValidGuestDesign(parsed)) return null;

    if (parsed.productId !== productId) return null;

    return parsed;
  } catch {
    return null;
  }
}

export function removeGuestDesign(productId: string) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(getStorageKey(productId));
  } catch {
    // ignore
  }
}

/**
 * Debounced autosave 컨트롤러.
 *
 * 사용 흐름:
 *   const controller = createGuestDesignAutosaver();
 *   controller.schedule(() => ({ productId, productColor, canvasState, customFonts }));
 *   // ... 페이지 이탈 직전:
 *   controller.flush();   // debounce 대기 중인 작업 즉시 실행
 *   controller.cancel();  // unmount 시
 *
 * `payloadFactory`는 호출 시점의 최신 캔버스 상태를 캡처하기 위해 매번 호출된다
 * (저장 시점 데이터가 schedule 시점보다 최신이어야 디자인 중간 변경이 안전).
 */
export interface GuestDesignAutosaver {
  /** payloadFactory를 한 번 등록한 뒤 일정 시간 후 saveGuestDesign 호출. 다시 호출되면 타이머 리셋. */
  schedule: (payloadFactory: () => Omit<GuestDesign, 'version' | 'savedAt'> | null) => void;
  /** debounce 대기 중인 저장을 즉시 실행. payloadFactory가 null 반환하면 skip. */
  flush: () => void;
  /** 진행 중인 debounce 타이머 취소 (저장 X). 비로그인→로그인 전환 등 더 이상 자동저장 불필요한 케이스에. */
  cancel: () => void;
}

export function createGuestDesignAutosaver(debounceMs = 1000): GuestDesignAutosaver {
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let pendingFactory: (() => Omit<GuestDesign, 'version' | 'savedAt'> | null) | null = null;

  const runNow = () => {
    if (!pendingFactory) return;
    const factory = pendingFactory;
    pendingFactory = null;
    try {
      const payload = factory();
      if (payload) saveGuestDesign(payload);
    } catch {
      // 저장 실패는 silent. localStorage 쿼터 초과 등 — 사용자에게 알릴 가치 없음.
    }
  };

  return {
    schedule(payloadFactory) {
      pendingFactory = payloadFactory;
      if (timerId) clearTimeout(timerId);
      timerId = setTimeout(() => {
        timerId = null;
        runNow();
      }, debounceMs);
    },
    flush() {
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      runNow();
    },
    cancel() {
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      pendingFactory = null;
    },
  };
}

