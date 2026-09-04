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
/**
 * 카테고리 키 → 표시 이름 폴백. product_categories 조회가 비거나(캐시된 빈 결과·일시 장애)
 * 테이블에 없는 레거시 키(outerwear 등)일 때 원문 키가 그대로 노출되지 않게 한다.
 * 순서 = 개편 전 위저드 칩 순서.
 */
const FALLBACK_CATEGORY_LABELS: Record<string, string> = {
  't-shirts': '티셔츠',
  hoodie: '후드티',
  sweater: '맨투맨',
  zipup: '후드집업',
  jacket: '자켓',
  outerwear: '아우터',
  etc: '기타',
};
const FALLBACK_CATEGORY_ORDER = Object.keys(FALLBACK_CATEGORY_LABELS);
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

/** 부위별 색상 레이어(sides[].layers)가 있는 활성 상품 id — 바시티 자켓류 = 상담 접수 대상 */
const getPartColorProductIds = unstable_cache(
  async (): Promise<string[]> => {
    const supabase = createAnonClient();
    const { data } = await supabase.from('products').select('id, configuration').eq('is_active', true);
    type Row = { id: string; configuration: unknown };
    return ((data ?? []) as Row[])
      .filter((p) =>
        Array.isArray(p.configuration) &&
        (p.configuration as Array<{ layers?: unknown }>).some((s) => Array.isArray(s?.layers) && s.layers.length > 0)
      )
      .map((p) => p.id);
  },
  ['ai-designer-part-color-products'],
  { revalidate: 300, tags: ['products'] }
);

export async function getAiDesignerCatalog(): Promise<{
  products: AiCatalogProduct[];
  categories: AiCatalogCategory[];
}> {
  const [v2Products, cachedCategories, digest, partColorIds] = await Promise.all([
    getV2CatalogProducts(),
    getV2Categories(),
    getReviewDigest(),
    getPartColorProductIds(),
  ]);
  const intakeSet = new Set(partColorIds);
  // 캐시된 카테고리가 비어 오면(일시 장애가 빈 결과로 캐시된 경우 등) 한 번 더 직접 조회한다.
  let v2Categories = cachedCategories;
  if (v2Categories.length === 0) {
    const { data, error } = await createAnonClient()
      .from('product_categories')
      .select('key, name, icon')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    console.warn('[aiDesigner/catalog] cached categories empty → direct fetch', {
      rows: data?.length ?? 0,
      error: error?.message ?? null,
    });
    v2Categories = (data ?? []) as AiCatalogCategory[];
  }

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
    intakeOnly: intakeSet.has(p.id),
  }));

  // 상품이 하나도 없는 카테고리 칩은 숨기고, product_categories에 없는 상품 카테고리
  // (예: 'outerwear' — 개편 전 위저드가 '아우터'로 표기하던 레거시 키)는 칩을 만들어 붙인다.
  // DB 카테고리가 비어 오면(일시 장애·빈 결과 캐시) 폴백 표에서 이름을 찾고, 폴백 순서로 정렬한다.
  const present = new Set(products.map((p) => p.category));
  const categories: AiCatalogCategory[] = v2Categories.filter((c) => present.has(c.key));
  const missing: AiCatalogCategory[] = [];
  for (const key of present) {
    if (!key || categories.some((c) => c.key === key)) continue;
    missing.push({ key, name: FALLBACK_CATEGORY_LABELS[key] ?? key, icon: null });
  }
  const orderOf = (key: string) => {
    const i = FALLBACK_CATEGORY_ORDER.indexOf(key);
    return i === -1 ? FALLBACK_CATEGORY_ORDER.length : i;
  };
  missing.sort((a, b) => orderOf(a.key) - orderOf(b.key) || a.key.localeCompare(b.key));

  return { products, categories: [...categories, ...missing] };
}
