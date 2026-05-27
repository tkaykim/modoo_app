'use client'

import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Plus, Minus, X } from 'lucide-react';
import { SizeOption, CartItem } from '@/types/types';
import { trackQuantityModalDismiss } from '@/lib/gtm-events';

interface QuantitySelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * @param frozenPricePerItem 모달이 열린 시점에 사용자에게 보였던 단가. 부모는
   *   이 값으로 카트/주문에 저장해야 한다. 누락 시 부모의 라이브 값이 쓰임.
   */
  onConfirm: (designName: string, selectedItems: CartItem[], purchaseType: 'direct' | 'cart', frozenPricePerItem?: number) => Promise<void>;
  sizeOptions: SizeOption[];
  pricePerItem: number;
  isSaving?: boolean;
  defaultDesignName?: string;
  sizingChartImage?: string | null;
  productId?: string;
  /**
   * 제품 미리보기 영역에 임의 노드를 렌더 (없으면 기본은 빈 영역).
   * 예: 다중 side 캐러셀, ProductDesigner view mode 등.
   * - undefined면 caller가 별도 미리보기를 안 주는 흐름 (디자인 이름·사이즈만)
   */
  previewSlot?: ReactNode;
}

export default function QuantitySelectorModal({
  isOpen,
  onClose,
  onConfirm,
  sizeOptions,
  pricePerItem,
  isSaving = false,
  defaultDesignName = '',
  sizingChartImage,
  productId,
  previewSlot,
}: QuantitySelectorModalProps) {
  const router = useRouter();
  const [designName, setDesignName] = useState(defaultDesignName);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPurchaseChoice, setShowPurchaseChoice] = useState(false);
  const [purchaseType, setPurchaseType] = useState<'direct' | 'cart' | null>(null);
  const [showSizeChart, setShowSizeChart] = useState(false);
  // 디자인명 미입력 안내: input을 빨갛게 강조 + 흔들기. 사용자가 "구매하기"를
  // 눌렀는데 왜 안 되는지 모르고 rage click → 이탈하는 케이스 차단.
  const [designNameError, setDesignNameError] = useState(false);
  const designNameInputRef = useRef<HTMLInputElement>(null);

  // 모달 오픈 시점의 단가를 freeze. 모달이 열려 있는 동안 캔버스가 reflow되거나
  // pricePerItem prop이 변경되어도 사용자에게 보이는 가격과 실제 카트 저장 가격이
  // 일치하도록 보장. 모달이 닫힐 때 자동 갱신 (다음 오픈 시점 값으로).
  const [frozenPricePerItem, setFrozenPricePerItem] = useState<number>(pricePerItem);
  useEffect(() => {
    if (isOpen) {
      setFrozenPricePerItem(pricePerItem);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const getTotalQuantity = () => {
    return Object.values(quantities).reduce((sum, qty) => sum + qty, 0);
  };

  const getTotalPrice = () => {
    return getTotalQuantity() * frozenPricePerItem;
  };

  // 기존에 저장된 디자인을 다시 여는 경우에만 prefill.
  // 신규 디자인은 의도적으로 빈 칸으로 두어 사용자가 의미있는 이름을 짓도록 유도한다.
  // (timestamp fallback은 공장·관리자가 주문을 구분할 수 없게 만들어 제거됨)
  useEffect(() => {
    if (isOpen && defaultDesignName) {
      setDesignName(defaultDesignName);
    }
  }, [isOpen, defaultDesignName]);

  // 디자인명을 다시 입력하기 시작하면 에러 강조 즉시 해제.
  // ⚠️ Hook은 반드시 early return(`if (!isOpen) return null`) 이전에 호출되어야 한다.
  useEffect(() => {
    if (designName.trim() && designNameError) {
      setDesignNameError(false);
    }
  }, [designName, designNameError]);

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
    if (value === '') {
      setQuantities(prev => {
        const { [sizeId]: _, ...rest } = prev;
        return rest;
      });
      return;
    }

    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0) {
      return;
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
      // disabled로 막지 않고 시각적으로 즉시 안내한다.
      // 1) 빨간 강조 + 흔들기 (700ms)
      // 2) input으로 스크롤 + 포커스
      setDesignNameError(true);
      try {
        designNameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch { /* 구형 브라우저 fallback */ }
      // focus는 살짝 늦춰서 스크롤 애니메이션과 자연스럽게 겹치게
      setTimeout(() => designNameInputRef.current?.focus(), 200);
      setTimeout(() => setDesignNameError(false), 1800);
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

    await onConfirm(designName, selectedItems, type, frozenPricePerItem);

    if (type === 'direct') {
      const directIds = sessionStorage.getItem('directCheckoutItemIds');
      if (directIds) {
        sessionStorage.removeItem('directCheckoutItemIds');
      }
      resetState();
      onClose();
      router.push(directIds ? `/checkout?directItems=${encodeURIComponent(directIds)}` : '/checkout');
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
    // 확정(direct/cart 선택) 없이 닫는 경우만 dismiss로 추적. 이미 confirm된 후의 success 화면 닫기는 정상 흐름.
    if (!purchaseType) {
      try {
        trackQuantityModalDismiss({
          product_id: productId,
          total_quantity: getTotalQuantity(),
        });
      } catch {
        // 트래킹 실패는 무시
      }
    }
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
              {/* Optional preview slot (e.g. side carousel) */}
              {previewSlot && (
                <div className="mt-3 -mx-4 px-4">
                  {previewSlot}
                </div>
              )}

              {/* Design Name Input */}
              <div className="mt-4 mb-6">
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  디자인 이름 <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  공장·담당자가 한눈에 알 수 있는 이름으로 지어주세요. (사람 이름 대신 단체·이벤트·용도)
                </p>
                <input
                  ref={designNameInputRef}
                  type="text"
                  value={designName}
                  onChange={(e) => setDesignName(e.target.value)}
                  placeholder="예: 청담고 응원티, OO교회 단체티"
                  maxLength={40}
                  aria-invalid={designNameError || undefined}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none transition ${
                    designNameError
                      ? 'border-red-500 ring-2 ring-red-200 animate-[shake_0.5s_ease-in-out] bg-red-50'
                      : 'border-gray-300 focus:border-black'
                  }`}
                  disabled={isSaving}
                />
                {designNameError && (
                  <p className="text-xs text-red-600 mt-2 font-medium" role="alert">
                    👆 디자인 이름을 먼저 입력해주세요. (예: 청담고 응원티)
                  </p>
                )}
              </div>

              {/* Size Options */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-medium text-gray-700">사이즈 및 수량</h3>
                  {sizingChartImage && (
                    <button
                      onClick={() => setShowSizeChart(true)}
                      className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center text-xs text-gray-500 hover:bg-gray-100"
                    >
                      ?
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {sizeOptions.map((size) => {
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

        {/* Fixed Bottom Bar - 항상 표시. 수량 0→1로 늘어날 때 bar가 튀어오르면서
            +/- 버튼 위치가 점프하는 layout shift 차단 (사용자 rage 클릭 유발). */}
        {!showSuccess && (
          <div className="border-t border-gray-200 bg-white px-4 py-3 shrink-0">
            <div className="p-3 bg-gray-50 rounded-lg mb-3">
              <div className="flex items-center justify-between text-sm mb-1 pb-1 border-b border-gray-200">
                <span className="text-gray-600">개당 가격 (디자인 포함)</span>
                <span className="font-medium">{Math.round(frozenPricePerItem).toLocaleString('ko-KR')}원</span>
              </div>

              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600">총 수량</span>
                <span className={`font-medium ${getTotalQuantity() === 0 ? 'text-gray-400' : ''}`}>
                  {getTotalQuantity()}개
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                <span className="font-bold">총 금액</span>
                <span className={`text-lg font-bold ${getTotalQuantity() === 0 ? 'text-gray-400' : ''}`}>
                  {Math.round(getTotalPrice()).toLocaleString('ko-KR')}원
                </span>
              </div>
            </div>

            {/* 수량 0이어도, 디자인명 미입력이어도 클릭은 가능. 누르면 alert/시각 안내. */}
            <button
              onClick={handleShowPurchaseChoice}
              disabled={isSaving}
              className="w-full py-4 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
              aria-describedby={designNameError ? 'design-name-error' : undefined}
            >
              {isSaving ? '처리 중...' : '구매하기'}
            </button>
          </div>
        )}
      </div>

      {/* Size Chart Overlay */}
      {showSizeChart && sizingChartImage && (
        <div
          className="fixed inset-0 z-300 flex items-center justify-center bg-black/60"
          onClick={() => setShowSizeChart(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowSizeChart(false)}
              className="absolute -top-8 right-0 text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={sizingChartImage}
              alt="사이즈 차트"
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}

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
