export interface PricingInfo {
  unitPrice: number;
  discountedUnitPrice: number;
  totalPrice: number;
  discountedTotalPrice: number;
  note?: string;
}

const DISCOUNT_RATE = 0.10;

function withDiscount(unitPrice: number, qty: number, note?: string): PricingInfo {
  const discountedUnitPrice = Math.round(unitPrice * (1 - DISCOUNT_RATE));
  return {
    unitPrice,
    discountedUnitPrice,
    totalPrice: qty * unitPrice,
    discountedTotalPrice: qty * discountedUnitPrice,
    note,
  };
}

export function getPricingInfo(qty: number): PricingInfo | null {
  if (qty < 10) return null;
  if (qty <= 30) {
    const fixedTotal = 1800000;
    const unitPrice = Math.round(fixedTotal / qty);
    const discountedUnitPrice = Math.round(unitPrice * (1 - DISCOUNT_RATE));
    return {
      unitPrice,
      discountedUnitPrice,
      totalPrice: fixedTotal,
      discountedTotalPrice: qty * discountedUnitPrice,
      note: '(고정가)',
    };
  }
  if (qty <= 50) return withDiscount(58000, qty);
  if (qty <= 70) return withDiscount(56000, qty);
  if (qty <= 80) return withDiscount(55000, qty);
  if (qty <= 90) return withDiscount(54000, qty);
  if (qty <= 100) return withDiscount(53000, qty);
  if (qty <= 120) return withDiscount(52000, qty);
  if (qty <= 150) return withDiscount(51000, qty);
  if (qty <= 180) return withDiscount(50000, qty);
  return withDiscount(48000, qty);
}
