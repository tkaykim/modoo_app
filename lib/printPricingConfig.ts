import { PrintPricingConfig, PrintMethodRecord, TransferPricing, BulkPricing } from '@/types/types';

/**
 * Default print pricing configuration
 * Admin can modify these values through the admin panel
 */
export const DEFAULT_PRINT_PRICING: PrintPricingConfig = {
  dtf: {
    method: 'dtf',
    sizes: {
      '10x10': 4000, // 4,000원 for 10cm x 10cm
      A4: 5000,      // 5,000원 for A4 size
      A3: 7000       // 7,000원 for A3 size
    }
  },
  dtg: {
    method: 'dtg',
    sizes: {
      '10x10': 6000, // 6,000원 for 10cm x 10cm
      A4: 7000,      // 7,000원 for A4 size
      A3: 9000       // 9,000원 for A3 size
    }
  },
  screen_printing: {
    method: 'screen_printing',
    sizes: {
      '10x10': {
        basePrice: 60000,              // 60,000원 for first 100 pieces
        baseQuantity: 100,              // Base quantity
        additionalPricePerPiece: 600    // +600원 per additional piece
      },
      A4: {
        basePrice: 80000,              // 80,000원 for first 100 pieces
        baseQuantity: 100,
        additionalPricePerPiece: 800    // +800원 per additional piece
      },
      A3: {
        basePrice: 100000,             // 100,000원 for first 100 pieces
        baseQuantity: 100,
        additionalPricePerPiece: 1000   // +1,000원 per additional piece
      }
    }
  },
  embroidery: {
    method: 'embroidery',
    sizes: {
      '10x10': {
        basePrice: 60000,
        baseQuantity: 100,
        additionalPricePerPiece: 600
      },
      A4: {
        basePrice: 80000,
        baseQuantity: 100,
        additionalPricePerPiece: 800
      },
      A3: {
        basePrice: 100000,
        baseQuantity: 100,
        additionalPricePerPiece: 1000
      }
    }
  },
  applique: {
    method: 'applique',
    sizes: {
      '10x10': {
        basePrice: 60000,
        baseQuantity: 100,
        additionalPricePerPiece: 600
      },
      A4: {
        basePrice: 80000,
        baseQuantity: 100,
        additionalPricePerPiece: 800
      },
      A3: {
        basePrice: 100000,
        baseQuantity: 100,
        additionalPricePerPiece: 1000
      }
    }
  }
};

let _cachedConfig: PrintPricingConfig | null = null;
// print_methods.key → print_methods.id 매핑. customer_print_method_pricing 룩업에 필요.
const _idByKey = new Map<string, string>();

/**
 * Set pricing config from database print method records.
 * Call this when print methods are fetched from the server.
 */
export function setPrintPricingConfig(methods: PrintMethodRecord[]): void {
  const config = { ...DEFAULT_PRINT_PRICING };
  _idByKey.clear();
  for (const m of methods) {
    if (m.key && m.id) {
      _idByKey.set(m.key, m.id);
    }
    if (!m.pricing || !m.key) continue;
    if (m.key === 'dtf' || m.key === 'dtg') {
      config[m.key] = { method: m.key, sizes: m.pricing as unknown as TransferPricing['sizes'] };
    } else if (m.key in config) {
      const key = m.key as 'screen_printing' | 'embroidery' | 'applique';
      config[key] = { method: key, sizes: m.pricing as unknown as BulkPricing['sizes'] };
    }
  }
  _cachedConfig = config;
}

/**
 * print_method key (예: 'dtf') 로 DB id 조회. setPrintPricingConfig가
 * 이미 호출됐어야 한다. 등록되지 않은 key는 null.
 */
export function getPrintMethodIdByKey(key: string): string | null {
  return _idByKey.get(key) ?? null;
}

/**
 * Get the current pricing configuration.
 * Returns cached DB config if available, otherwise falls back to defaults.
 */
export function getPrintPricingConfig(): PrintPricingConfig {
  return _cachedConfig ?? DEFAULT_PRINT_PRICING;
}

/**
 * Recommend print method — always DTF
 */
export function recommendPrintMethod(): {
  recommended: 'dtf';
  reason: string;
} {
  return {
    recommended: 'dtf',
    reason: 'DTF 전사 방식이 적용됩니다'
  };
}

/**
 * 인쇄방식별 사용자 노출용 메타데이터.
 * PrintMethodPickerSheet, ObjectPreviewPanel 라벨 등 UI에서 공통으로 참조.
 *
 * Phase 1: DTF만 `active: true`. 나머지는 데이터 모델·UI 카드 자리만 마련하고
 *          가격 계산 로직(특히 bulk 모델)이 활성화되는 Phase 2부터 active로 전환.
 */
export interface PrintMethodMeta {
  label: string;
  subLabel: string;
  /** 추천 케이스 한 줄 ('소량·다색' 등) */
  best: string;
  /** prod에 가격 계산까지 풀 활성화되어 사용자 선택 가능한지 */
  active: boolean;
  description: string;
  pros: string[];
  cons: string[];
}

import type { PrintMethod } from '@/types/types';

export const PRINT_METHOD_META: Record<PrintMethod, PrintMethodMeta> = {
  dtf: {
    label: 'DTF 전사',
    subLabel: '신축성 · 풀컬러',
    best: '대부분의 의류 · 풀컬러',
    active: true,
    description: '신축성 좋고 풀컬러 가능. 폴리·면 모두 호환되어 거의 모든 디자인에 잘 맞음.',
    pros: ['풀컬러', '신축성', '범용성'],
    cons: ['약간 두꺼운 질감'],
  },
  dtg: {
    label: 'DTG 전사',
    subLabel: '잉크젯 · 풀컬러',
    best: '소량 · 사진',
    active: false,
    description: '잉크젯으로 직접 인쇄 후 열압착. 사진·그라데이션에 가장 강함.',
    pros: ['풀컬러', '소량부터 OK', '부드러운 표면'],
    cons: ['짙은 색 원단 제약'],
  },
  screen_printing: {
    label: '실크 나염',
    subLabel: '인쇄판 · 단색~3색',
    best: '50장 이상 대량',
    active: false,
    description: '잉크를 두껍게 입혀 색상이 선명하고 내구성이 강함. 대량일수록 저렴.',
    pros: ['선명·진한색', '내구성', '대량 시 가장 저렴'],
    cons: ['색상수 추가비'],
  },
  embroidery: {
    label: '자수',
    subLabel: '실 자수 · 입체감',
    best: '폴로 · 유니폼 로고',
    active: false,
    description: '실로 한 땀 한 땀 박아 고급스러움. 작은 로고/와펜에 추천.',
    pros: ['고급스러움', '내구성 최고', '입체감'],
    cons: ['세밀 그래픽 불가'],
  },
  applique: {
    label: '아플리케',
    subLabel: '원단 부착 · 입체',
    best: '학교 마크 · 큰 로고',
    active: false,
    description: '천 조각을 잘라 박아 입체적인 마감. 큰 단색 로고에 어울림.',
    pros: ['입체감', '대담한 표현'],
    cons: ['세밀 그래픽 불가'],
  },
};

/**
 * UI 라벨만 빠르게 꺼낼 때 쓰는 헬퍼. method가 unknown이면 'DTF 전사' 폴백.
 * (기존 카트/주문에 printMethod가 박혀있지 않은 객체 호환)
 */
export function getPrintMethodLabel(method: string | null | undefined): string {
  if (!method) return PRINT_METHOD_META.dtf.label;
  const meta = (PRINT_METHOD_META as Record<string, PrintMethodMeta | undefined>)[method];
  return meta?.label ?? PRINT_METHOD_META.dtf.label;
}
