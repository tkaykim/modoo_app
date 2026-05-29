'use client';

import { useState } from 'react';
import { ThumbsUp, HelpCircle, Check, ArrowRight } from 'lucide-react';
import { PrintMethodChoice, DesignType, ColorCount, MethodQuoteLite } from '@/lib/chatbot/types';
import { PRINT_METHOD_CHOICES } from '@/lib/chatbot/config';
import { METHOD_LABEL_TO_KEY, eligibleMethodChoices } from '@/lib/chatbot/recommend';
import { PRINT_METHOD_META } from '@/lib/printPricingConfig';

interface PrintMethodBubbleProps {
  recommendedMethod?: PrintMethodChoice;
  methodQuotes?: MethodQuoteLite[];
  designType?: DesignType;
  colorCount?: ColorCount;
  onSelect: (method: PrintMethodChoice) => void;
  disabled?: boolean;
}

export default function PrintMethodBubble({
  recommendedMethod,
  designType,
  colorCount,
  onSelect,
  disabled,
}: PrintMethodBubbleProps) {
  const [showGuide, setShowGuide] = useState(false);

  const digitalRequired =
    designType === '사진·그래픽' ||
    colorCount === '그라데이션';

  // 디자인 제약상 가능한 방식만 노출 (부적합 방식은 가격조차 보여주지 않음 — 오해 방지)
  const eligible = eligibleMethodChoices(designType, colorCount);
  const visible = PRINT_METHOD_CHOICES.filter((m) => eligible.includes(m));

  // 선택 상태: 기본은 추천 방식(가능할 때), 아니면 첫 번째 가능 방식
  const initial =
    recommendedMethod && visible.includes(recommendedMethod) ? recommendedMethod : visible[0];
  const [selected, setSelected] = useState<PrintMethodChoice>(initial);

  return (
    <div className="mt-3">
      {digitalRequired && (
        <p className="text-xs text-amber-600 mb-2">
          사진·풀컬러·그라데이션은 디지털 인쇄(DTF/DTG)만 가능해서 해당 방식만 보여드려요.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 mb-2">
        {visible.map((method) => {
          const isRecommended = method === recommendedMethod;
          const isSelected = method === selected;
          return (
            <button
              key={method}
              onClick={() => !disabled && setSelected(method)}
              disabled={disabled}
              className={`relative px-2.5 py-3 rounded-lg transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                isSelected
                  ? 'bg-[#3B55A5] text-white ring-2 ring-[#3B55A5] ring-offset-1'
                  : 'bg-white text-gray-700 border border-gray-300 hover:border-[#3B55A5]'
              }`}
            >
              {isRecommended && (
                <span className="absolute -top-2 -right-2 px-1.5 h-5 bg-amber-400 text-white text-[10px] font-semibold rounded-full flex items-center gap-0.5">
                  <ThumbsUp className="w-3 h-3" /> 추천
                </span>
              )}
              <span className="text-sm font-medium flex items-center gap-1">
                {isSelected && <Check className="w-3.5 h-3.5" />}
                {method}
              </span>
            </button>
          );
        })}
      </div>

      {/* 다음 — 선택 확정 후에만 진행 (자동 진행 X) */}
      <button
        onClick={() => !disabled && selected && onSelect(selected)}
        disabled={disabled || !selected}
        className="w-full py-2.5 mb-2 bg-[#3B55A5] text-white text-sm font-medium rounded-lg hover:bg-[#2D4280] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {selected ? `${selected}으로 진행` : '인쇄방식을 선택해주세요'}
        <ArrowRight className="w-4 h-4" />
      </button>

      <button
        onClick={() => setShowGuide((v) => !v)}
        className="w-full py-2 text-sm font-medium text-[#3B55A5] bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5"
      >
        <HelpCircle className="w-4 h-4" />
        {showGuide ? '설명 접기' : '잘 모르겠어요 — 방식별 설명 보기'}
      </button>

      {showGuide && (
        <div className="mt-2 space-y-2">
          {PRINT_METHOD_CHOICES.map((method) => {
            const meta = PRINT_METHOD_META[METHOD_LABEL_TO_KEY[method]];
            if (!meta) return null;
            const isEligible = eligible.includes(method);
            return (
              <div
                key={method}
                className={`p-2.5 bg-white border rounded-lg ${isEligible ? 'border-gray-200' : 'border-dashed border-gray-200 opacity-60'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-900">{meta.label}</span>
                  <span className="text-[11px] text-[#3B55A5] bg-blue-50 px-1.5 py-0.5 rounded">
                    추천: {meta.best}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mb-1">{meta.description}</p>
                <div className="flex flex-wrap gap-1">
                  {meta.pros.map((p) => (
                    <span key={p} className="text-[11px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                      + {p}
                    </span>
                  ))}
                  {meta.cons.map((c) => (
                    <span key={c} className="text-[11px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                      − {c}
                    </span>
                  ))}
                  {!isEligible && (
                    <span className="text-[11px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                      이 디자인엔 부적합
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
