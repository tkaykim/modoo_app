'use client';

import { useState } from 'react';
import { Sparkles, Printer, Wallet, Headset, Palette, MousePointerClick } from 'lucide-react';
import { ProductPreview, RecommendationResult } from '@/lib/chatbot/types';
import ProductCard from './ProductCard';

interface RecommendationCardProps {
  recommendation: RecommendationResult;
  products: ProductPreview[];
  onProductClick: (productId: string) => void;
  onConsult: (productId?: string) => void;
  disabled?: boolean;
}

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

export default function RecommendationCard({
  recommendation,
  products,
  onProductClick,
  onConsult,
  disabled,
}: RecommendationCardProps) {
  const { method, methodReason, unitPrice, totalPrice, quantity, savingsNote, disclaimer } = recommendation;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = products.find((p) => p.id === selectedId) ?? null;

  // 제품 + 인쇄 합산 예상비용(장당/총액). 인쇄비 미정이면 제품가만.
  const comboUnit = selected ? selected.base_price + (unitPrice ?? 0) : null;
  const comboTotal = comboUnit != null ? comboUnit * quantity : null;

  return (
    <div className="mt-3 rounded-xl border border-[#0052CC]/30 bg-white overflow-hidden">
      <div className="bg-[#0052CC]/5 px-3 py-2 flex items-center gap-1.5">
        <Sparkles className="w-4 h-4 text-[#0052CC]" />
        <span className="text-sm font-semibold text-[#0052CC]">맞춤 추천</span>
      </div>

      <div className="p-3 space-y-3">
        {/* 인쇄방식 */}
        <div className="flex items-start gap-2">
          <Printer className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-900">{method}</p>
            <p className="text-xs text-gray-600">{methodReason}</p>
          </div>
        </div>

        {/* 예상 인쇄비 (제품 선택 전 참고용) */}
        <div className="flex items-start gap-2">
          <Wallet className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500">예상 인쇄비 ({quantity}벌 기준)</p>
            {totalPrice != null ? (
              <p className="text-sm font-semibold text-gray-900">
                총 약 {won(totalPrice)}
                {unitPrice != null && (
                  <span className="text-gray-500 font-normal"> · 장당 약 {won(unitPrice)}</span>
                )}
              </p>
            ) : (
              <p className="text-sm font-semibold text-gray-900">담당자가 안내드려요</p>
            )}
            {savingsNote && (
              <span className="inline-block mt-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                {savingsNote}
              </span>
            )}
            {disclaimer && <p className="text-[11px] text-gray-400 mt-1">※ {disclaimer}</p>}
          </div>
        </div>

        {/* 추천 제품 — 선택 */}
        {products.length > 0 && (
          <div>
            <div className="flex items-start gap-2 mb-1.5">
              <MousePointerClick className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-gray-600">
                마음에 드는 제품을 <b>선택</b>하시면 예상 비용과 다음 단계를 안내해드려요.
              </p>
            </div>
            <div className="space-y-1.5">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  selected={p.id === selectedId}
                  onClick={() => !disabled && setSelectedId(p.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 선택된 제품: 합산 예상비용 + 변동 안내 + 액션 2개 */}
        {selected && (
          <div className="rounded-lg border border-[#0052CC]/30 bg-[#0052CC]/5 p-3 space-y-2">
            <p className="text-xs text-gray-500">선택한 제품 · 제품 + 인쇄 예상비용</p>
            {comboUnit != null ? (
              <p className="text-sm font-bold text-gray-900">
                {quantity}벌 약 {won(comboTotal!)}
                <span className="text-gray-500 font-normal"> · 장당 약 {won(comboUnit)}</span>
              </p>
            ) : (
              <p className="text-sm font-bold text-gray-900">
                제품 {won(selected.base_price)}/장 · 인쇄비는 담당자가 안내드려요
              </p>
            )}
            <p className="text-[11px] text-gray-400">* 실제 디자인에 따라 소폭 변동될 수 있습니다.</p>

            <div className="grid grid-cols-1 gap-1.5 pt-1">
              <button
                onClick={() => !disabled && onProductClick(selected.id)}
                disabled={disabled}
                className="w-full py-2.5 bg-[#0052CC] text-white text-sm font-medium rounded-lg hover:bg-[#003D99] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Palette className="w-4 h-4" />
                이대로 직접 디자인 해보기
              </button>
              <button
                onClick={() => !disabled && onConsult(selected.id)}
                disabled={disabled}
                className="w-full py-2.5 bg-white text-[#0052CC] border border-[#0052CC] text-sm font-medium rounded-lg hover:bg-[#0052CC]/5 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Headset className="w-4 h-4" />
                상담사에게 연락 요청
              </button>
            </div>
          </div>
        )}

        {/* 제품 미선택 시: 일반 상담 연결 */}
        {!selected && (
          <button
            onClick={() => !disabled && onConsult()}
            disabled={disabled}
            className="w-full py-2.5 bg-white text-[#0052CC] border border-[#0052CC] text-sm font-medium rounded-lg hover:bg-[#0052CC]/5 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Headset className="w-4 h-4" />
            상담사에게 연락 요청
          </button>
        )}
      </div>
    </div>
  );
}
