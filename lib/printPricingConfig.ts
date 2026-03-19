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

/**
 * Set pricing config from database print method records.
 * Call this when print methods are fetched from the server.
 */
export function setPrintPricingConfig(methods: PrintMethodRecord[]): void {
  const config = { ...DEFAULT_PRINT_PRICING };
  for (const m of methods) {
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
