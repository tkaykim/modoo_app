'use client'

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Plus, Minus, X } from 'lucide-react';
import { SizeOption, CartItem, ProductSide, DiscountTier } from '@/types/types';
import * as fabric from 'fabric';
import { calculateAllSidesPricing } from '@/app/utils/canvasPricing';

interface QuantitySelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (designName: string, selectedItems: CartItem[], purchaseType: 'direct' | 'cart') => Promise<void>;
  sizeOptions: SizeOption[];
  pricePerItem: number;
  isSaving?: boolean;
  defaultDesignName?: string;
  canvasMap?: Record<string, fabric.Canvas>;
  sides?: ProductSide[];
  basePrice?: number;
  discountRates?: DiscountTier[];
}

export default function QuantitySelectorModal({
  isOpen,
  onClose,
  onConfirm,
  sizeOptions,
  pricePerItem,
  isSaving = false,
  defaultDesignName = '',
  canvasMap,
  sides,
  basePrice,
  discountRates
}: QuantitySelectorModalProps) {
  const router = useRouter();
  const [designName, setDesignName] = useState(defaultDesignName);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPurchaseChoice, setShowPurchaseChoice] = useState(false);
  const [purchaseType, setPurchaseType] = useState<'direct' | 'cart' | null>(null);
  const [dynamicPricePerItem, setDynamicPricePerItem] = useState(pricePerItem);
  const [printingCostPerItem, setPrintingCostPerItem] = useState(0);
  const [hasBulkMethods, setHasBulkMethods] = useState(false);

  // Helper function to get total quantity
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

  const getTotalPrice = () => {
    const subtotal = getTotalQuantity() * dynamicPricePerItem;
    return subtotal * discountMultiplier;
  };

  const getOriginalTotalPrice = () => {
    return getTotalQuantity() * dynamicPricePerItem;
  };

  // Auto-generate design name when modal opens
  useEffect(() => {
    if (isOpen) {
      if (defaultDesignName) {
        setDesignName(defaultDesignName);
      } else if (!designName) {
        const now = new Date();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        setDesignName(`디자인 ${mm}.${dd} ${hh}:${min}`);
      }
    }
  }, [isOpen, defaultDesignName]);

  // Calculate pricing based on total quantity for bulk methods
  useEffect(() => {
    const calculateDynamicPricing = async () => {
      if (!canvasMap || !sides || !basePrice) {
        setDynamicPricePerItem(pricePerItem);
        setHasBulkMethods(false);
        return;
      }

      const totalQuantity = getTotalQuantity();
      if (totalQuantity === 0) {
        setDynamicPricePerItem(pricePerItem);
        setHasBulkMethods(false);
        return;
      }

      try {
        const result = await calculateAllSidesPricing(canvasMap, sides, totalQuantity);

        // Check if any objects use bulk methods
        const usesBulkMethods = result.sidePricing.some(sp =>
          sp.objects.some(obj =>
            obj.printMethod === 'screen_printing' ||
            obj.printMethod === 'embroidery' ||
            obj.printMethod === 'applique'
          )
        );

        setHasBulkMethods(usesBulkMethods);

        // For bulk methods, the printing cost is TOTAL for all items, not per-item
        // So we need to divide by quantity to get per-item price
        const perItemPrintCost = result.totalAdditionalPrice / totalQuantity;
        setPrintingCostPerItem(perItemPrintCost);
        setDynamicPricePerItem(basePrice + perItemPrintCost);
      } catch (error) {
        console.error('Error calculating dynamic pricing:', error);
        setDynamicPricePerItem(pricePerItem);
        setHasBulkMethods(false);
      }
    };

    calculateDynamicPricing();
  }, [canvasMap, sides, quantities, basePrice, pricePerItem]);

  if (!isOpen) return null;

  const handleQuantityChange = (sizeId: string, change: number) => {
    setQuantities(prev => {
      const current = prev[sizeId] || 0;
      const newValue = Math.max(0, current + change);

      if (newValue === 0) {
        const { [sizeId]: _, ...rest } = prev;
        return rest;
      }

      return { ...prev, [sizeId]: newValue };
    });
  };

  const handleManualQuantityChange = (sizeId: string, value: string) => {
    // Allow empty string for easier editing
    if (value === '') {
      setQuantities(prev => {
        const { [sizeId]: _, ...rest } = prev;
        return rest;
      });
      return;
    }

    // Parse the value and ensure it's a valid non-negative integer
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0) {
      return; // Ignore invalid input
    }

    if (numValue === 0) {
      setQuantities(prev => {
        const { [sizeId]: _, ...rest } = prev;
        return rest;
      });
    } else {
      setQuantities(prev => ({ ...prev, [sizeId]: numValue }));
    }
  };

  const handleShowPurchaseChoice = () => {
    if (getTotalQuantity() === 0) {
      alert('수량을 선택해주세요.');
      return;
    }
    if (!designName.trim()) {
      alert('디자인 이름을 입력해주세요.');
      return;
    }
    setShowPurchaseChoice(true);
  };

  const handlePurchaseChoice = async (type: 'direct' | 'cart') => {
    setShowPurchaseChoice(false);
    setPurchaseType(type);

    const selectedItems: CartItem[] = Object.entries(quantities).map(([size, quantity]) => ({
      size,
      quantity
    }));

    await onConfirm(designName, selectedItems, type);

    if (type === 'direct') {
      resetState();
      onClose();
      router.push('/checkout');
    } else {
      setShowSuccess(true);
    }
  };

  const resetState = () => {
    setShowSuccess(false);
    setShowPurchaseChoice(false);
    setPurchaseType(null);
    setDesignName('');
    setQuantities({});
  };

  const handleGoToCart = () => {
    router.push('/cart');
    resetState();
    onClose();
  };

  const handleGoToCheckout = () => {
    router.push('/checkout');
    resetState();
    onClose();
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={!isSaving ? handleClose : undefined}
      />

      {/* Modal Content - Slide up from bottom */}
      <div
        className={`relative bg-white rounded-t-2xl w-full max-h-[80vh] flex flex-col transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Handle bar */}
        <div className="sticky top-0 bg-white pt-3 pb-2 border-b border-gray-200 z-10">
          <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between px-4 pb-2">
            <h2 className="text-lg font-bold">
              {!showSuccess
                ? '옵션 선택'
                : purchaseType === 'direct'
                  ? '주문 준비 완료'
                  : '장바구니에 담겼습니다'}
            </h2>
            <button
              onClick={handleClose}
              disabled={isSaving}
              className="p-1 hover:bg-gray-100 rounded-full transition disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-4 pb-4 overflow-y-auto flex-1 min-h-0">
          {!showSuccess ? (
            <>
              {/* Design Name Input */}
              <div className="mt-4 mb-6">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  디자인 이름
                </label>
                <input
                  type="text"
                  value={designName}
                  onChange={(e) => setDesignName(e.target.value)}
                  placeholder="예: 나만의 티셔츠"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-black transition"
                  disabled={isSaving}
                />
              </div>

              {/* Size Options */}
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
                        className={`flex items-center px-3 py-2 justify-between border rounded-lg transition ${
                          quantity > 0
                            ? 'border-black bg-gray-50'
                            : 'border-gray-300 bg-white'
                        }`}
                      >
                        <span className="font-medium">{sizeLabel}</span>
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

            </>
          ) : (
            <>
              <div className="py-8 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-gray-600 mb-6">
                  {purchaseType === 'direct'
                    ? `${getTotalQuantity()}개의 상품이 주문 준비되었습니다`
                    : `${getTotalQuantity()}개의 상품이 장바구니에 담겼습니다`}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                {purchaseType === 'direct' ? (
                  <button
                    onClick={handleGoToCheckout}
                    className="w-full py-4 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition"
                  >
                    결제 페이지로 이동
                  </button>
                ) : (
                  <button
                    onClick={handleGoToCart}
                    className="w-full py-4 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition"
                  >
                    장바구니로 가기
                  </button>
                )}

                <button
                  onClick={handleClose}
                  className="w-full py-3 bg-gray-100 text-gray-800 rounded-lg font-medium hover:bg-gray-200 transition"
                >
                  닫기
                </button>
              </div>
            </>
          )}
        </div>

        {/* Fixed Bottom Bar - Price Summary & Confirm */}
        {!showSuccess && getTotalQuantity() > 0 && (
          <div className="border-t border-gray-200 bg-white px-4 py-3 shrink-0">
            <div className="p-3 bg-gray-50 rounded-lg mb-3">
              {/* Price Breakdown */}
              {basePrice && printingCostPerItem > 0 ? (
                <>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">기본 제품 가격</span>
                    <span className="font-medium">{Math.round(basePrice).toLocaleString('ko-KR')}원</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">인쇄 비용 (개당)</span>
                    <span className="font-medium">{Math.round(printingCostPerItem).toLocaleString('ko-KR')}원</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-1 pb-1 border-b border-gray-200">
                    <span className="text-gray-700 font-medium">개당 가격</span>
                    <span className="font-semibold">{Math.round(dynamicPricePerItem).toLocaleString('ko-KR')}원</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between text-sm mb-1 pb-1 border-b border-gray-200">
                  <span className="text-gray-600">개당 가격 (디자인 포함)</span>
                  <span className="font-medium">{Math.round(dynamicPricePerItem).toLocaleString('ko-KR')}원</span>
                </div>
              )}

              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600">총 수량</span>
                <span className="font-medium">{getTotalQuantity()}개</span>
              </div>

              {/* Discount Rate Display */}
              {discountRate > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">상품 금액</span>
                    <span className="font-medium line-through text-gray-400">{Math.round(getOriginalTotalPrice()).toLocaleString('ko-KR')}원</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-red-600 font-medium">대량 주문 할인 ({discountRate}%)</span>
                    <span className="font-medium text-red-600">-{Math.round(getOriginalTotalPrice() - getTotalPrice()).toLocaleString('ko-KR')}원</span>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                <span className="font-bold">총 금액</span>
                <span className="text-lg font-bold">{Math.round(getTotalPrice()).toLocaleString('ko-KR')}원</span>
              </div>

              {/* Discount Rate Tiers Info */}
              {discountRates && discountRates.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="flex items-start gap-2 text-xs text-blue-700 bg-blue-50 p-2 rounded">
                    <span className="shrink-0">🏷️</span>
                    <div className="flex-1">
                      <p className="font-semibold mb-1">대량 주문 할인 안내</p>
                      {[...discountRates]
                        .sort((a, b) => a.min_quantity - b.min_quantity)
                        .map((tier, index) => {
                          const isActive = currentDiscount?.min_quantity === tier.min_quantity;
                          return (
                            <p
                              key={index}
                              className={`${isActive ? 'text-blue-800 font-semibold' : 'text-blue-600'}`}
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

              {/* Bulk Pricing Info */}
              {hasBulkMethods && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 p-2 rounded">
                    <span className="shrink-0">💡</span>
                    <div className="flex-1">
                      <p className="font-semibold mb-1">대량 주문 할인 안내</p>
                      <p className="text-amber-600">
                        나염/자수/아플리케 방식이 포함되어 있습니다.
                      </p>
                      <p className="text-amber-600 mt-1">
                        • 100개까지: 기본 인쇄 가격
                      </p>
                      <p className="text-amber-600">
                        • 101개부터: 1개당 +600원씩 인쇄 가격 증가
                      </p>
                      <p className="text-amber-600 text-[10px] mt-1 italic">
                        (총 인쇄비가 더 많은 수량에 분산되어 개당 가격은 저렴해집니다)
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleShowPurchaseChoice}
              disabled={isSaving || !designName.trim()}
              className="w-full py-4 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSaving ? '처리 중...' : '구매하기'}
            </button>
          </div>
        )}
      </div>

      {/* Purchase Choice Modal Overlay */}
      {showPurchaseChoice && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setShowPurchaseChoice(false)}
          />
          <div className="relative bg-white rounded-2xl p-6 mx-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-center mb-6">구매 방식 선택</h3>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handlePurchaseChoice('direct')}
                disabled={isSaving}
                className="w-full py-4 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isSaving ? '처리 중...' : '바로 구매하기'}
              </button>
              <button
                onClick={() => handlePurchaseChoice('cart')}
                disabled={isSaving}
                className="w-full py-4 bg-white text-black border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                {isSaving ? '처리 중...' : '장바구니에 담기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
