'use client';

import { useEffect, useState } from 'react';
import { X, Check, Lock } from 'lucide-react';
import type { PrintMethod } from '@/types/types';
import { PRINT_METHOD_META } from '@/lib/printPricingConfig';

interface PrintMethodPickerSheetProps {
  isOpen: boolean;
  /** 현재 객체가 사용 중인 인쇄방식. null이면 dtf로 간주. */
  currentMethod: PrintMethod | null;
  onSelect: (method: PrintMethod) => void;
  onClose: () => void;
  /** 객체 식별용 — 안내 텍스트에 노출 (예: "로고.png 인쇄 방식"). 없으면 일반 문구. */
  objectLabel?: string;
}

// 카드 표시 순서. Phase 1엔 DTF만 active. 나머지는 자리만.
const METHOD_ORDER: PrintMethod[] = ['dtf', 'dtg', 'screen_printing', 'embroidery', 'applique'];

/**
 * 객체별 인쇄방식 선택 시트 (모바일 하단 슬라이드업).
 *
 * Phase 1: DTF만 클릭 가능. 비활성 카드 클릭 시 "준비 중" toast 노출.
 * - prod 손님에겐 노출 안 됨 (ObjectPreviewPanel의 ?print-picker=1 쿼리 게이트 뒤에 마운트)
 * - Vercel preview에서 시각 검증 + 데이터 모델 점검 용도
 *
 * Phase 2부터 PRINT_METHOD_META의 active 플래그를 true로 토글하면 자연스럽게 활성.
 */
export default function PrintMethodPickerSheet({
  isOpen,
  currentMethod,
  onSelect,
  onClose,
  objectLabel,
}: PrintMethodPickerSheetProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 2000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  if (!isOpen) return null;

  const handleCardClick = (method: PrintMethod) => {
    const meta = PRINT_METHOD_META[method];
    if (!meta.active) {
      setToastMessage(`${meta.label}은 곧 추가될 예정입니다.`);
      return;
    }
    onSelect(method);
  };

  const effectiveCurrent = currentMethod ?? 'dtf';

  return (
    <div className="fixed inset-0 z-[120] flex items-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative bg-white rounded-t-2xl w-full max-h-[85vh] flex flex-col transform transition-transform duration-300 ease-out translate-y-0">
        {/* Handle */}
        <div className="sticky top-0 bg-white pt-3 pb-2 border-b border-gray-200 z-10">
          <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between px-4 pb-2">
            <div>
              <h2 className="text-lg font-bold">인쇄 방식 선택</h2>
              {objectLabel && (
                <p className="text-xs text-gray-500 mt-0.5">{objectLabel}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full transition"
              aria-label="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cards */}
        <div className="px-4 py-4 overflow-y-auto flex-1 min-h-0 space-y-3">
          <p className="text-xs text-gray-500 leading-relaxed">
            현재는 DTF 전사 방식만 운영 중입니다. 다른 방식은 단가 정책이 준비되는 대로 차례로 열립니다.
          </p>

          {METHOD_ORDER.map((method) => {
            const meta = PRINT_METHOD_META[method];
            const isSelected = effectiveCurrent === method;
            const isDisabled = !meta.active;

            return (
              <button
                key={method}
                onClick={() => handleCardClick(method)}
                aria-disabled={isDisabled}
                className={`w-full text-left rounded-2xl border p-4 transition relative ${
                  isSelected
                    ? 'border-black border-2 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-400 bg-white'
                } ${isDisabled ? 'opacity-60' : ''}`}
              >
                {/* Top row: label + sub */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-base font-bold text-gray-900">{meta.label}</span>
                      {isDisabled && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                          <Lock className="w-3 h-3" />
                          준비 중
                        </span>
                      )}
                      {isSelected && !isDisabled && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-white bg-black px-1.5 py-0.5 rounded">
                          <Check className="w-3 h-3" />
                          선택됨
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{meta.subLabel}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">추천</div>
                    <div className="text-xs text-gray-700 font-medium">{meta.best}</div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-gray-600 leading-relaxed mb-2">{meta.description}</p>

                {/* Pros / Cons */}
                <div className="flex flex-wrap gap-1">
                  {meta.pros.map((p) => (
                    <span
                      key={`p-${p}`}
                      className="text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded"
                    >
                      + {p}
                    </span>
                  ))}
                  {meta.cons.map((c) => (
                    <span
                      key={`c-${c}`}
                      className="text-[10px] font-medium text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded"
                    >
                      − {c}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {/* Toast */}
        {toastMessage && (
          <div
            className="absolute left-1/2 -translate-x-1/2 bottom-6 bg-gray-900 text-white text-sm px-4 py-2 rounded-full shadow-lg z-20"
            role="status"
            aria-live="polite"
          >
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
}
