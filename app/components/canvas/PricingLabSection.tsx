'use client';

/**
 * PricingLabSection — Phase 2 실험 UI (방식+수량 인식 고객가).
 *
 * prod 영향 0: 이 컴포넌트는 (1) /lab/print-pricing 독립 페이지, (2) 메인 에디터
 * ?pricing-lab=1 게이트 뒤에서만 마운트된다. 기존 PricingInfo(=DTF 전용 prod 경로)는
 * 손대지 않는다.
 *
 * 기능:
 *  - 5종 인쇄방식 카드 (랩에선 전부 선택 가능)
 *  - 인라인 수량 스테퍼 → 실시간 총액
 *  - 수량 기반 최저가 방식 추천 배너 (정책 B)
 *  - bulk 방식에 "N벌 이상 유리" 칩 (DTF 대비 실제 분기점 계산, 배민 스타일)
 */

import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Check, Minus, Plus, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { getCustomerPricingByPrintMethod } from '@/lib/customerPricingFetch';
import type { CustomerPricingRow } from '@/lib/customerPricingMatcher';
import {
  quoteMethod,
  rankMethods,
  bulkAdvantageThreshold,
} from '@/lib/printMethodPricing';
import { PRINT_METHOD_META } from '@/lib/printPricingConfig';
import type { PrintMethod } from '@/types/types';

const METHOD_ORDER: PrintMethod[] = ['dtf', 'dtg', 'screen_printing', 'embroidery', 'applique'];
const BULK_KEYS = new Set<PrintMethod>(['screen_printing', 'embroidery', 'applique']);

interface PricingLabSectionProps {
  artworkWidthCm: number;
  artworkHeightCm: number;
  defaultQuantity?: number;
  className?: string;
}

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

export default function PricingLabSection({
  artworkWidthCm,
  artworkHeightCm,
  defaultQuantity = 30,
  className = '',
}: PricingLabSectionProps) {
  const [rowsByKey, setRowsByKey] = useState<Record<string, CustomerPricingRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PrintMethod>('dtf');
  const [quantity, setQuantity] = useState<number>(Math.max(1, defaultQuantity));

  // print_methods(key↔id) + customer_print_method_pricing 동시 로드 → key별 단가표 맵 구성.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const supabase = createClient();
        const [{ data: methods, error: mErr }, pricingMap] = await Promise.all([
          supabase.from('print_methods').select('id, key'),
          getCustomerPricingByPrintMethod(),
        ]);
        if (mErr) throw mErr;

        const byKey: Record<string, CustomerPricingRow[]> = {};
        for (const m of methods ?? []) {
          const key = m.key as string;
          const id = m.id as string;
          if (key && id) byKey[key] = pricingMap.get(id) ?? [];
        }
        if (!cancelled) setRowsByKey(byKey);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '단가표 로드 실패');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ranking = useMemo(
    () => rankMethods(rowsByKey, METHOD_ORDER, artworkWidthCm, artworkHeightCm, quantity),
    [rowsByKey, artworkWidthCm, artworkHeightCm, quantity],
  );

  const selectedQuote = useMemo(
    () => quoteMethod(rowsByKey[selected] ?? [], artworkWidthCm, artworkHeightCm, quantity),
    [rowsByKey, selected, artworkWidthCm, artworkHeightCm, quantity],
  );

  // bulk 방식별 "N벌 이상 유리" 분기점 (DTF 대비). 도안·단가표 바뀔 때만 재계산.
  const thresholds = useMemo(() => {
    const dtfRows = rowsByKey['dtf'] ?? [];
    const out: Partial<Record<PrintMethod, number | null>> = {};
    for (const key of METHOD_ORDER) {
      if (!BULK_KEYS.has(key)) continue;
      out[key] = bulkAdvantageThreshold(rowsByKey[key] ?? [], dtfRows, artworkWidthCm, artworkHeightCm);
    }
    return out;
  }, [rowsByKey, artworkWidthCm, artworkHeightCm]);

  const cheapestKey = ranking.cheapest?.methodKey ?? null;

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-10 ${className}`}>
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <div className={`text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 ${className}`}>
        {error}
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-gray-900">인쇄방식별 가격</p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            도안 {artworkWidthCm.toFixed(0)}×{artworkHeightCm.toFixed(0)}cm 기준 · 실험(prod 미반영)
          </p>
        </div>
        {/* Quantity stepper */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 mr-1">수량</span>
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 10))}
            className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded-md hover:bg-gray-50"
            aria-label="수량 10 감소"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => {
              const v = Number(e.target.value);
              setQuantity(Number.isFinite(v) && v >= 1 ? Math.floor(v) : 1);
            }}
            className="w-16 text-center px-1 py-1 border border-gray-300 rounded-md text-sm"
          />
          <button
            onClick={() => setQuantity((q) => q + 10)}
            className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded-md hover:bg-gray-50"
            aria-label="수량 10 증가"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-gray-500 ml-0.5">벌</span>
        </div>
      </div>

      {/* Recommendation banner */}
      {ranking.cheapest && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-2.5 mb-3">
          <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-900 leading-relaxed">
            <b>{quantity}벌</b> 기준{' '}
            <b>{PRINT_METHOD_META[ranking.cheapest.methodKey as PrintMethod]?.label}</b>이 가장 저렴해요
            {ranking.savingsVsDtf > 0 && cheapestKey !== 'dtf' && (
              <> · DTF보다 <b>{won(ranking.savingsVsDtf)}</b> 절약</>
            )}
          </p>
        </div>
      )}

      {/* Method cards */}
      <div className="space-y-2">
        {METHOD_ORDER.map((key) => {
          const meta = PRINT_METHOD_META[key];
          const quote = ranking.quotes.find((q) => q.methodKey === key);
          const isSelected = selected === key;
          const isCheapest = cheapestKey === key;
          const isBulk = BULK_KEYS.has(key);
          const threshold = thresholds[key];
          const notLiveInProd = !meta.active; // prod 비활성 안내용

          return (
            <button
              key={key}
              onClick={() => setSelected(key)}
              className={`w-full text-left rounded-xl border p-3 transition relative ${
                isSelected ? 'border-black border-2 bg-gray-50' : 'border-gray-200 hover:border-gray-400 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className="text-sm font-bold text-gray-900">{meta.label}</span>
                    <span className="text-[10px] font-medium text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded">
                      {isBulk ? '묶음가' : '장당 단가'}
                    </span>
                    {isSelected && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-white bg-black px-1.5 py-0.5 rounded">
                        <Check className="w-3 h-3" /> 선택
                      </span>
                    )}
                    {notLiveInProd && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                        <Lock className="w-3 h-3" /> prod 준비중
                      </span>
                    )}
                  </div>

                  {/* Chips (배민 스타일 알약) */}
                  <div className="flex flex-wrap gap-1">
                    {isCheapest && (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                        이 수량 최저가
                      </span>
                    )}
                    {isBulk ? (
                      <>
                        {threshold != null && (
                          <span className="text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
                            {threshold}벌 이상 유리
                          </span>
                        )}
                        <span className="text-[10px] font-medium text-gray-600 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded-full">
                          단체 추천
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] font-medium text-gray-600 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded-full">
                        수량 무관 · 소량 OK
                      </span>
                    )}
                  </div>
                </div>

                {/* Price */}
                <div className="text-right shrink-0">
                  {quote && quote.total !== null ? (
                    <>
                      <div className="text-sm font-bold text-gray-900">{won(quote.total)}</div>
                      <div className="text-[10px] text-gray-500">
                        장당 {won(quote.unitEffective ?? 0)}
                        {quote.matchType === 'fallback' && ' · 최대크기'}
                      </div>
                    </>
                  ) : (
                    <div className="text-[11px] text-gray-400">단가 미설정</div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected total */}
      <div className="border-t border-gray-200 mt-3 pt-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">
          {PRINT_METHOD_META[selected]?.label} · {quantity}벌 인쇄비
        </span>
        <span className="text-lg font-bold text-black">
          {selectedQuote.total !== null ? won(selectedQuote.total) : '—'}
        </span>
      </div>
    </div>
  );
}
