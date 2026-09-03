'use client';

/**
 * AI 디자이너 — PC용 상품 선택 (개편 전 레이아웃 유지).
 *
 * 2026-09-03 대표 의견: 모바일은 /v2/mall식 리스트(ProductPicker), PC는 이전 버전(카테고리 칩 +
 * 2열 썸네일 카드)이 더 낫다. 위저드가 md 이상에서만 이 컴포넌트를 보여준다.
 */

import React, { useMemo, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import type { AiCatalogCategory, AiCatalogProduct } from '@/lib/aiDesigner/catalogTypes';

const ETC_KEY = '__etc';

export default function ProductGrid({
  products,
  categories,
  selectedId,
  loadingId,
  onSelect,
}: {
  products: AiCatalogProduct[];
  categories: AiCatalogCategory[];
  selectedId: string | null;
  loadingId: string | null;
  onSelect: (p: AiCatalogProduct) => void;
}) {
  // 상품이 있는 카테고리만 칩으로(카테고리 목록은 catalog.ts가 레거시 키까지 채워 준다).
  // 카테고리가 비어 있는 상품만 '기타'로 묶는다.
  const chips = useMemo(() => {
    const known = categories.filter((c) => products.some((p) => p.category === c.key));
    const hasEtc = products.some((p) => !p.category || !categories.some((c) => c.key === p.category));
    return hasEtc ? [...known, { key: ETC_KEY, name: '기타', icon: null }] : known;
  }, [categories, products]);
  const [category, setCategory] = useState<string>(() => chips[0]?.key ?? ETC_KEY);

  const list = useMemo(
    () =>
      category === ETC_KEY
        ? products.filter((p) => !p.category || !categories.some((c) => c.key === p.category))
        : products.filter((p) => p.category === category),
    [products, categories, category]
  );

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto mt-4 pb-1 -mx-4 px-4">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCategory(c.key)}
            aria-pressed={category === c.key}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium border transition ${
              category === c.key ? 'bg-brand text-white border-brand' : 'bg-white text-gray-700 border-gray-200'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 mt-4" data-testid="ai-product-grid">
        {list.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            data-product-id={p.id}
            className={`text-left bg-white rounded-2xl border overflow-hidden transition ${
              selectedId === p.id ? 'border-brand ring-2 ring-brand/30' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="aspect-square bg-gray-50">
              {p.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.thumbnail} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <ImagePlus className="w-8 h-8" aria-hidden />
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="text-sm font-semibold text-gray-900 line-clamp-2">{p.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{p.base_price.toLocaleString()}원~</p>
            </div>
          </button>
        ))}
      </div>
      {loadingId && (
        <div className="flex items-center justify-center gap-2 mt-6 text-gray-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> 상품 정보를 불러오는 중…
        </div>
      )}
    </div>
  );
}
