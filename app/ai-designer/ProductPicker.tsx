'use client';

/**
 * AI 디자이너 — 상품 선택 목록.
 *
 * /v2/mall 카탈로그와 같은 구성(검색 → 카테고리 칩 → 개수·정렬 → 사진 레일 + 이름·제조사·
 * 색상 수·평점·가격·해시태그)을 위저드 안에 그대로 가져와, 배달앱 매장 목록처럼
 * 어떤 옷인지 한눈에 비교하고 바로 고를 수 있게 한다.
 * 데이터는 lib/aiDesigner/catalog.ts(v2 카탈로그 쿼리 재사용)에서 온다.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, ImagePlus, Loader2, Search, Star, X } from 'lucide-react';
import type { AiCatalogCategory, AiCatalogProduct } from '@/lib/aiDesigner/catalogTypes';

type SortKey = 'default' | 'reviews' | 'rating' | 'price_low' | 'price_high';
const SORT_LABELS: Record<SortKey, string> = {
  default: '기본',
  reviews: '리뷰 많은순',
  rating: '평점 높은순',
  price_low: '낮은 가격순',
  price_high: '높은 가격순',
};
const MAX_HASHTAGS = 5;
const HIDE_SCROLLBAR = '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

function badgeOf(p: AiCatalogProduct): 'BEST' | 'HOT' | '신상' | null {
  if (p.isBest) return 'BEST';
  if (p.isHot) return 'HOT';
  if (p.isNew) return '신상';
  return null;
}

function ProductRow({
  product: p,
  selected,
  loading,
  onSelect,
}: {
  product: AiCatalogProduct;
  selected: boolean;
  loading: boolean;
  onSelect: (p: AiCatalogProduct) => void;
}) {
  const badge = badgeOf(p);
  const hashtags = p.keywords.slice(0, MAX_HASHTAGS);
  const meta: React.ReactNode[] = [];
  if (p.manufacturerName) meta.push(<span key="m">{p.manufacturerName}</span>);
  if (p.colorCount > 0) meta.push(<span key="c">{p.colorCount}색상</span>);
  if (p.reviewCount > 0) {
    meta.push(
      <span key="r" className="inline-flex items-center gap-0.5">
        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" aria-hidden />
        {p.ratingAvg !== null && (
          <span className="font-semibold text-gray-800 tabular-nums">{p.ratingAvg.toFixed(1)}</span>
        )}
        <span>리뷰 {p.reviewCount.toLocaleString()}</span>
      </span>
    );
  }

  const cover = p.gallery[0] ?? null;
  const extraPhotos = Math.max(0, p.gallery.length - 1);

  return (
    <div
      data-testid="ai-product-row"
      data-product-id={p.id}
      onClick={() => !loading && onSelect(p)}
      className={`px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors ${
        selected ? 'bg-brand-softer' : 'bg-white active:bg-gray-50'
      }`}
    >
      {/* 압축 카드: 왼쪽 썸네일 + 오른쪽 정보 (한 화면에 더 많은 상품이 보이도록 높이 최소화) */}
      <div className="flex gap-3">
        <div className="relative shrink-0 w-[104px] h-[104px] rounded-xl overflow-hidden bg-[#fafaf7] border border-gray-100">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt={p.title} loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <ImagePlus className="w-7 h-7" aria-hidden />
            </div>
          )}
          {badge && (
            <span
              className={`absolute top-1.5 left-1.5 px-1.5 py-[2px] rounded text-[9px] font-bold tracking-wider text-white ${
                badge === 'BEST' ? 'bg-brand' : badge === 'HOT' ? 'bg-red-500' : 'bg-gray-900'
              }`}
            >
              {badge}
            </span>
          )}
          {extraPhotos > 0 && (
            <span className="absolute bottom-1.5 right-1.5 px-1.5 py-[2px] rounded bg-black/55 text-white text-[10px] font-semibold tabular-nums">
              +{extraPhotos}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-start gap-2">
            <p className="flex-1 min-w-0 text-[15px] font-bold text-gray-900 leading-snug tracking-tight line-clamp-2">
              {p.title}
            </p>
            <a
              href={`/product/${p.id}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 mt-0.5 text-[11px] font-semibold text-gray-500 underline underline-offset-2"
              aria-label={`${p.title} 상세 보기 (새 창)`}
            >
              상세
            </a>
          </div>
          {meta.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-medium text-gray-500">
              {meta.map((node, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="text-gray-300">·</span>}
                  {node}
                </React.Fragment>
              ))}
            </div>
          )}
          {p.intakeOnly && (
            <span className="mt-1 self-start px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold">
              디자이너 상담 접수
            </span>
          )}
          <div className="mt-auto pt-1 flex items-baseline gap-1">
            <span className="text-[17px] font-extrabold tracking-tight text-gray-900 tabular-nums">
              ₩{p.base_price.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-gray-500">부터</span>
            <span className="text-[10px] text-gray-400">/ 장 · 인쇄 별도</span>
            {p.originalPrice !== null && (
              <span className="text-[10px] font-semibold text-brand">수량 할인</span>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(p);
              }}
              className={`ml-auto shrink-0 self-center h-7 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                selected ? 'bg-brand text-white' : 'bg-gray-900 text-white active:bg-gray-800'
              } disabled:opacity-70`}
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : selected ? '선택됨' : p.intakeOnly ? '상담 접수' : '선택'}
            </button>
          </div>
        </div>
      </div>

      {/* 해시태그 한 줄 + 대표 리뷰 한 줄 */}
      {(hashtags.length > 0 || p.reviewSnippet) && (
        <div className="mt-2 space-y-1">
          {hashtags.length > 0 && (
            <div className="flex gap-1.5 overflow-hidden whitespace-nowrap">
              {hashtags.map((h) => (
                <span key={h} className="shrink-0 px-2 py-0.5 rounded-full bg-brand-softer text-brand text-[10px] font-semibold">
                  #{h}
                </span>
              ))}
            </div>
          )}
          {p.reviewSnippet && (
            <p className="text-[11px] text-gray-600 truncate">
              <span className="text-yellow-400 mr-1" aria-hidden>★</span>
              “{p.reviewSnippet}”
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProductPicker({
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
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<SortKey>('default');
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sortOpen) return;
    const onDown = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [sortOpen]);

  const chips = useMemo(() => [{ key: 'all', name: '전체', icon: null }, ...categories], [categories]);

  const filtered = useMemo(() => {
    let list = category === 'all' ? products : products.filter((p) => p.category === category);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.manufacturerName ?? '').toLowerCase().includes(q) ||
          p.keywords.some((k) => k.toLowerCase().includes(q))
      );
    }
    if (sort === 'reviews') list = [...list].sort((a, b) => b.reviewCount - a.reviewCount);
    else if (sort === 'rating')
      list = [...list].sort(
        (a, b) => (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0) || b.reviewCount - a.reviewCount
      );
    else if (sort === 'price_low') list = [...list].sort((a, b) => a.base_price - b.base_price);
    else if (sort === 'price_high') list = [...list].sort((a, b) => b.base_price - a.base_price);
    return list;
  }, [products, category, query, sort]);

  return (
    <div>
      {/* 검색 */}
      <div className="relative mt-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="상품명, 제조사, 특징으로 검색"
          aria-label="상품 검색"
          className="w-full h-12 pl-10 pr-10 rounded-xl border border-gray-200 bg-white text-[15px] font-medium text-gray-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="검색어 지우기"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* 카테고리 칩 */}
      <div className={`flex gap-2 overflow-x-auto mt-3 pb-1 -mx-4 px-4 ${HIDE_SCROLLBAR}`}>
        {chips.map((c) => {
          const active = category === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              aria-pressed={active}
              className={`shrink-0 h-8 px-3 rounded-full text-[13px] font-semibold whitespace-nowrap border transition ${
                active ? 'bg-brand text-white border-brand' : 'bg-white text-gray-800 border-gray-200'
              }`}
            >
              {c.name}
            </button>
          );
        })}
      </div>

      {/* 개수 + 정렬 */}
      <div className="mt-2 -mx-4 px-4 py-2.5 flex items-center justify-between border-y border-gray-100 bg-white">
        <span className="text-xs font-medium text-gray-500">
          {filtered.length}개의 상품
          {query.trim() && ` · "${query.trim()}" 검색`}
        </span>
        <div ref={sortRef} className="relative">
          <button
            type="button"
            onClick={() => setSortOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={sortOpen}
            className="flex items-center gap-1 text-xs font-semibold text-gray-800"
          >
            <ArrowUpDown className="w-3.5 h-3.5" aria-hidden />
            {SORT_LABELS[sort]}
          </button>
          {sortOpen && (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[132px] p-1 rounded-xl border border-gray-200 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.10)]"
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setSort(k);
                    setSortOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs ${
                    sort === k ? 'font-bold text-brand bg-brand-softer' : 'font-medium text-gray-800'
                  }`}
                >
                  {SORT_LABELS[k]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Search className="w-12 h-12 mx-auto text-gray-200" aria-hidden />
          <p className="mt-3 text-[15px] font-bold text-gray-800">검색 결과가 없어요</p>
          <p className="mt-1 text-[13px] text-gray-500">다른 검색어나 카테고리를 시도해 보세요</p>
        </div>
      ) : (
        <div className="-mx-4 border-t border-gray-100">
          {filtered.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              selected={selectedId === p.id}
              loading={loadingId === p.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
