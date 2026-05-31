'use client'

import { useState } from 'react';
import { Plus, Minus, X, Tag } from 'lucide-react';
import { CartItemWithDesign } from '@/lib/cartService';
import { SizeOption, DiscountTier } from '@/types/types';

interface QuantityChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (updates: { itemId?: string; sizeId: string; quantity: number; currentQuantity?: number }[]) => Promise<void>;
  items: CartItemWithDesign[];
  sizeOptions: SizeOption[];
  productColorName: string;
  designName?: string;
  isSaving?: boolean;
  discountRates?: DiscountTier[];
}

export default function QuantityChangeModal({
  isOpen,
  onClose,
  onConfirm,
  items,
  sizeOptions,
  productColorName,
  designName,
  isSaving = false,
  discountRates
}: QuantityChangeModalProps) {
  // Initialize quantities from existing cart items (keyed by size)
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    items.forEach(item => {
      // size_id and size_name are the same now (both just the size string)
      const size = item.size_id || item.size_name;
      if (size) {
        initial[size] = item.quantity;
      }
    });
    return initial;
  });

  if (!isOpen) return null;

  const handleQuantityChange = (sizeId: string, change: number) => {
    setQuantities(prev => {
      const current = prev[sizeId] || 0;
      const newValue = Math.max(0, current + change);
      return { ...prev, [sizeId]: newValue };
    });
  };

  const handleManualQuantityChange = (sizeId: string, value: string) => {
    // Allow empty string for easier editing
    if (value === '') {
      setQuantities(prev => ({ ...prev, [sizeId]: 0 }));
      return;
    }

    // Parse the value and ensure it's a valid non-negative integer
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0) {
      return; // Ignore invalid input
    }

    setQuantities(prev => ({ ...prev, [sizeId]: numValue }));
  };

  const getTotalQuantity = () => {
    return Object.values(quantities).reduce((sum, qty) => sum + qty, 0);
  };

  // Get the applicable discount rate based on quantity
  const getApplicableDiscount = (quantity: number): DiscountTier | null => {
    if (!discountRates || discountRates.length === 0) return null;

    // Sort by min_quantity descending to find the highest applicable tier
    const sortedRates = [...discountRates].sort((a, b) => b.min_quantity - a.min_quantity);
    return sortedRates.find(tier => quantity >= tier.min_quantity) || null;
  };

  const currentDiscount = getApplicableDiscount(getTotalQuantity());
  const discountRate = currentDiscount?.discount_rate || 0;
  const discountMultiplier = 1 - (discountRate / 100);

  const getOriginalTotalPrice = () => {
    // Use the first item's price_per_item as reference (all items in a design group have same price)
    const pricePerItem = items[0]?.price_per_item || 0;
    return getTotalQuantity() * pricePerItem;
  };

  const getTotalPrice = () => {
    return getOriginalTotalPrice() * discountMultiplier;
  };

  const handleConfirm = async () => {
    const totalQuantity = getTotalQuantity();

    if (totalQuantity === 0) {
      alert('최소 1개 이상의 상품을 선택해주세요.');
      return;
    }

    // Create updates array for all size options
    // Handle both old string format and new object format
    const updates = sizeOptions.map(size => {
      const sizeLabel = typeof size === 'string' ? size : size.label;
      const existingItem = items.find(item => (item.size_id || item.size_name) === sizeLabel);
      const newQuantity = quantities[sizeLabel] || 0;
      const currentQuantity = existingItem?.quantity || 0;

      return {
        itemId: existingItem?.id,
        sizeId: sizeLabel,
        quantity: newQuantity,
        currentQuantity
      };
    }).filter(update => update.quantity !== update.currentQuantity); // Only include changed items

    await onConfirm(updates);
    onClose();
  };

  const handleClose = () => {
    // Reset quantities to original values
    const resetQuantities: Record<string, number> = {};
    items.forEach(item => {
      const size = item.size_id || item.size_name;
      if (size) {
        resetQuantities[size] = item.quantity;
      }
    });
    setQuantities(resetQuantities);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-100 flex items-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={!isSaving ? handleClose : undefined}
      />

      {/* Modal Content - Slide up from bottom */}
      <div
        className={`relative bg-white rounded-t-2xl w-full max-h-[80vh] overflow-y-auto transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Handle bar */}
        <div className="sticky top-0 bg-white pt-3 pb-2 border-b border-gray-200 z-10">
          <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between px-4 pb-2">
            <h2 className="text-lg font-bold">수량 변경</h2>
            <button
              onClick={handleClose}
              disabled={isSaving}
              className="p-1 hover:bg-gray-100 rounded-full transition disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-4 pb-6">
          {/* Design Name */}
          {designName && (
            <div className="mt-4 mb-4">
              <p className="text-sm text-gray-600 mb-1">디자인</p>
              <p className="font-medium">{designName}</p>
            </div>
          )}

          {/* Size Options List */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">사이즈 및 수량</h3>
            <div className="space-y-3">
              {sizeOptions.map((size) => {
                // Handle both old string format and new object format
                const sizeLabel = typeof size === 'string' ? size : size.label;
                const quantity = quantities[sizeLabel] || 0;
                return (
                  <div
                    key={sizeLabel}
                    className={`flex items-center justify-between p-4 border rounded-lg transition ${
                      quantity > 0
                        ? 'border-black bg-gray-50'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex-1">
                      <span className="font-medium">{sizeLabel}</span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {productColorName}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleQuantityChange(sizeLabel, -1)}
                        disabled={quantity === 0 || isSaving}
                        className="p-1 hover:bg-gray-200 rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={quantity}
                        onChange={(e) => handleManualQuantityChange(sizeLabel, e.target.value)}
                        disabled={isSaving}
                        className="min-w-12 w-12 text-center font-medium border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-black transition disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                      <button
                        onClick={() => handleQuantityChange(sizeLabel, 1)}
                        disabled={isSaving}
                        className="p-1 hover:bg-gray-200 rounded transition disabled:opacity-30"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Price Summary */}
          {getTotalQuantity() > 0 && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600">총 수량</span>
                <span className="font-medium">{getTotalQuantity()}개</span>
              </div>

              {/* Discount Rate Display */}
              {discountRate > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-600">상품 금액</span>
                    <span className="font-medium line-through text-gray-400">{Math.round(getOriginalTotalPrice()).toLocaleString('ko-KR')}원</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-red-600 font-medium">대량 주문 할인 ({discountRate}%)</span>
                    <span className="font-medium text-red-600">-{Math.round(getOriginalTotalPrice() - getTotalPrice()).toLocaleString('ko-KR')}원</span>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <span className="font-bold">총 금액</span>
                <span className="text-lg font-bold">{Math.round(getTotalPrice()).toLocaleString('ko-KR')}원</span>
              </div>

              {/* Discount Rate Tiers Info */}
              {discountRates && discountRates.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-start gap-2 text-xs text-blue-700 bg-blue-50 p-2 rounded">
                    <Tag className="size-3.5 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold mb-1">대량 주문 할인 안내</p>
                      {[...discountRates]
                        .sort((a, b) => a.min_quantity - b.min_quantity)
                        .map((tier, index) => {
                          const isActive = currentDiscount?.min_quantity === tier.min_quantity;
                          return (
                            <p
                              key={index}
                              className={`${isActive ? 'text-blue-800 font-semibold' : 'text-[#0052CC]'}`}
                            >
                              • {tier.min_quantity}개 이상: {tier.discount_rate}% 할인
                              {isActive && ' ✓'}
                            </p>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Confirm Button */}
          <button
            onClick={handleConfirm}
            disabled={isSaving || getTotalQuantity() === 0}
            className="w-full py-4 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSaving ? '처리 중...' : '수량 변경'}
          </button>
        </div>
      </div>
    </div>
  );
}
