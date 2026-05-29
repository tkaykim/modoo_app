'use client';

import { Sparkles, Printer, Wallet, ArrowRight, Headset, Upload } from 'lucide-react';
import { ProductPreview, RecommendationResult } from '@/lib/chatbot/types';
import ProductCard from './ProductCard';

interface RecommendationCardProps {
  recommendation: RecommendationResult;
  products: ProductPreview[];
  onProductClick: (productId: string) => void;
  onContinue: () => void;
  onConsult: () => void;
  disabled?: boolean;
}

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

export default function RecommendationCard({
  recommendation,
  products,
  onProductClick,
  onContinue,
  onConsult,
  disabled,
}: RecommendationCardProps) {
  const { method, methodReason, unitPrice, totalPrice, quantity, savingsNote, disclaimer } = recommendation;

  return (
    <div className="mt-3 rounded-xl border border-[#3B55A5]/30 bg-white overflow-hidden">
      <div className="bg-[#3B55A5]/5 px-3 py-2 flex items-center gap-1.5">
        <Sparkles className="w-4 h-4 text-[#3B55A5]" />
        <span className="text-sm font-semibold text-[#3B55A5]">맞춤 추천</span>
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

        {/* 예상 단가 */}
        <div className="flex items-start gap-2">
          <Wallet className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500">예상 인쇄비 ({quantity}벌 기준, 제품 단가 별도)</p>
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

        {/* 추천 제품 + 디자인 올리기 유도 */}
        {products.length > 0 && (
          <div>
            <div className="flex items-start gap-2 mb-1.5">
              <Upload className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-gray-600">
                마음에 드는 제품을 고르면 <b>바로 디자인을 올려보실 수 있어요!</b>
              </p>
            </div>
            <div className="space-y-1.5">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} onClick={() => onProductClick(p.id)} />
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="space-y-2 pt-1">
          <button
            onClick={() => !disabled && onContinue()}
            disabled={disabled}
            className="w-full py-2.5 bg-[#3B55A5] text-white text-sm font-medium rounded-lg hover:bg-[#2D4280] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            견적서·무료 시안 받기
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => !disabled && onConsult()}
            disabled={disabled}
            className="w-full py-2.5 bg-white text-[#3B55A5] text-sm font-medium rounded-lg border border-[#3B55A5] hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Headset className="w-4 h-4" />
            상담원과 통화할래요
          </button>
        </div>
      </div>
    </div>
  );
}
