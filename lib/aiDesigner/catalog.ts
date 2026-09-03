/**
 * AI 디자이너 — 상품 선택 목록 데이터 (서버 전용).
 *
 * /v2/mall 카탈로그 쿼리(getV2CatalogProducts·getV2Categories)를 그대로 재사용하고,
 * 여기에 리뷰 평균 평점과 대표 리뷰 한 줄만 덧붙인다.
 * 상품·카테고리 정의를 두 벌로 만들지 않기 위해 v2 쿼리를 단일 소스로 둔다.
 */
import 'server-only';
import { unstable_cache } from 'next/cache';
import { createAnonClient } from '@/lib/supabase';
import { getV2CatalogProducts, getV2Categories } from '@/app/v2/_lib/queries';
import type { AiCatalogCategory, AiCatalogProduct } from './catalogTypes';

interface ReviewRow {
  product_id: string;
  rating: number | null;
  content: string | null;
  is_best: boolean | null;
  helpful_count: number | null;
  created_at: string;
}

interface ReviewDigest {
  reviewCount: number;
  ratingAvg: number | null;
  snippet: string | null;
}

const SNIPPET_MAX = 60;
/** product_categories 테이블에 없는 products.category 값의 표시 이름(개편 전 위저드 표기와 동일) */
const LEGACY_CATEGORY_LABELS: Record<string, string> = {
  outerwear: '아우터',
  etc: '기타',
};
/** PostgREST 기본 응답 상한(1,000행)을 넘는 리뷰 테이블을 빠짐없이 읽기 위한 페이지 크기 */
const REVIEW_PAGE = 1000;

/** 줄바꿈·연속 공백을 정리하고 한 줄 길이로 자른다. */
function toSnippet(content: string | null): string | null {
  if (!content) return null;
  const flat = content.replace(/\s+/g, ' ').trim();
  if (!flat) return null;
  return flat.length > SNIPPET_MAX ? `${flat.slice(0, SNIPPET_MAX).trimEnd()}…` : flat;
}

/** 대표 리뷰 우선순위: 베스트 > 평점 > 도움돼요 수 > 최신 */
function isBetterSnippet(a: ReviewRow, b: ReviewRow | null): boolean {
  if (!b) return true;
  if (!!a.is_best !== !!b.is_best) return !!a.is_best;
  if ((a.rating ?? 0) !== (b.rating ?? 0)) return (a.rating ?? 0) > (b.rating ?? 0);
  if ((a.helpful_count ?? 0) !== (b.helpful_count ?? 0)) return (a.helpful_count ?? 0) > (b.helpful_count ?? 0);
  return a.created_at > b.created_at;
}

const getReviewDigest = unstable_cache(
  async (): Promise<Record<string, ReviewDigest>> => {
    const supabase = createAnonClient();
    // 리뷰는 1,000건을 넘으므로 range로 끝까지 읽는다(한 번에 읽으면 뒤쪽 상품 리뷰가 잘린다).
    const rows: ReviewRow[] = [];
    for (let from = 0; ; from += REVIEW_PAGE) {
      const { data, error } = await supabase
        .from('reviews')
        .select('product_id, rating, content, is_best, helpful_count, created_at')
        .order('created_at', { ascending: true })
        .range(from, from + REVIEW_PAGE - 1);
      if (error || !data || data.length === 0) break;
      rows.push(...(data as ReviewRow[]));
      if (data.length < REVIEW_PAGE) break;
    }
    const acc = new Map<string, { sum: number; rated: number; total: number; pick: ReviewRow | null }>();
    for (const r of rows) {
      const cur = acc.get(r.product_id) ?? { sum: 0, rated: 0, total: 0, pick: null };
      cur.total += 1;
      if (typeof r.rating === 'number') {
        cur.sum += r.rating;
        cur.rated += 1;
      }
      if (toSnippet(r.content) && isBetterSnippet(r, cur.pick)) cur.pick = r;
      acc.set(r.product_id, cur);
    }
    const out: Record<string, ReviewDigest> = {};
    for (const [pid, v] of acc) {
      out[pid] = {
        reviewCount: v.total,
        ratingAvg: v.rated > 0 ? Math.round((v.sum / v.rated) * 10) / 10 : null,
        snippet: v.pick ? toSnippet(v.pick.content) : null,
      };
    }
    return out;
  },
  ['ai-designer-review-digest'],
  { revalidate: 60, tags: ['reviews'] }
);

export async function getAiDesignerCatalog(): Promise<{
  products: AiCatalogProduct[];
  categories: AiCatalogCategory[];
}> {
  const [v2Products, v2Categories, digest] = await Promise.all([
    getV2CatalogProducts(),
    getV2Categories(),
    getReviewDigest(),
  ]);

  const products: AiCatalogProduct[] = v2Products.map((p) => ({
    id: p.id,
    title: p.title,
    category: p.category,
    base_price: p.originalPrice ?? p.price,
    price: p.price,
    originalPrice: p.originalPrice,
    thumbnail: p.thumbnail,
    gallery: p.gallery && p.gallery.length > 0 ? p.gallery : p.thumbnail ? [p.thumbnail] : [],
    keywords: p.keywords ?? [],
    manufacturerName: p.manufacturerName,
    colorCount: p.colorCount,
    // v2 카탈로그의 reviewCount는 1,000행 상한에 걸려 일부 상품이 적게 잡힌다 → 전량 집계값을 우선한다.
    reviewCount: digest[p.id]?.reviewCount ?? p.reviewCount,
    ratingAvg: digest[p.id]?.ratingAvg ?? null,
    reviewSnippet: digest[p.id]?.snippet ?? null,
    isBest: p.isBest,
    isNew: p.isNew,
    isHot: p.isHot,
  }));

  // 상품이 하나도 없는 카테고리 칩은 숨기고, product_categories에 없는 상품 카테고리
  // (예: 'outerwear' — 개편 전 위저드가 '아우터'로 표기하던 레거시 키)는 칩을 만들어 붙인다.
  const present = new Set(products.map((p) => p.category));
  const categories: AiCatalogCategory[] = v2Categories.filter((c) => present.has(c.key));
  for (const key of present) {
    if (!key || categories.some((c) => c.key === key)) continue;
    categories.push({ key, name: LEGACY_CATEGORY_LABELS[key] ?? key, icon: null });
  }

  return { products, categories };
}
