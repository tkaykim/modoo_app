import { createClient } from '@/lib/supabase-client';
import { ProductPreview, Priority } from './types';

export interface ProductSearchOptions {
  maxPrice?: number;
  category?: string;
  limit?: number;
}

export async function fetchProductsForRecommendation(
  options?: ProductSearchOptions
): Promise<ProductPreview[]> {
  const supabase = createClient();

  let query = supabase
    .from('products')
    .select('id, title, base_price, thumbnail_image_link, category')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (options?.maxPrice) {
    query = query.lte('base_price', options.maxPrice);
  }

  if (options?.category) {
    // options.category는 이미 정식 category 키 (config.CATEGORY_MAPPING에서 변환됨)
    query = query.eq('category', options.category);
  }

  const limit = options?.limit || 6;
  query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching products for chatbot:', error);
    return [];
  }

  return (data || []) as ProductPreview[];
}

/**
 * 챗봇 맞춤 상품 추천. 카테고리(정식 키) 필터 + 선호 방향 랭킹 + 약간의 로테이션.
 *  - 가격: 저가순 / 퀄리티: 고가(프리미엄)순 / 밸런스(기본): 추천(is_featured)·sort_order 우선
 *  - 1순위(가장 관련)는 고정, 나머지는 상위 후보 풀에서 섞어 매번 다른 조합 노출.
 */
export async function recommendProducts(opts: {
  category?: string;
  preference?: Priority;
  limit?: number;
}): Promise<ProductPreview[]> {
  const supabase = createClient();
  let query = supabase
    .from('products')
    .select('id, title, base_price, thumbnail_image_link, category, keywords, is_featured, sort_order, popularity')
    .eq('is_active', true);
  if (opts.category) query = query.eq('category', opts.category);

  const { data, error } = await query.limit(40);
  if (error || !data || data.length === 0) {
    if (error) console.error('Error fetching products for recommendation:', error);
    return [];
  }

  type Row = ProductPreview & { is_featured?: boolean | null; sort_order?: number | null; popularity?: number | null };
  const pool = [...(data as Row[])];
  const price = (p: Row) => p.base_price ?? 0;
  const pop = (p: Row) => p.popularity ?? 0;

  if (opts.preference === '가격') {
    pool.sort((a, b) => price(a) - price(b));
  } else if (opts.preference === '퀄리티') {
    pool.sort((a, b) => price(b) - price(a));
  } else {
    // 밸런스/미지정: 인기(주문 많은)순 → 추천 상품 → MD 정렬 → 가격
    pool.sort(
      (a, b) =>
        (pop(b) - pop(a)) ||
        (Number(!!b.is_featured) - Number(!!a.is_featured)) ||
        ((a.sort_order ?? 9999) - (b.sort_order ?? 9999)) ||
        (price(a) - price(b)),
    );
  }

  const limit = opts.limit ?? 3;
  const toPreview = (p: Row): ProductPreview => ({
    id: p.id,
    title: p.title,
    base_price: p.base_price,
    thumbnail_image_link: p.thumbnail_image_link,
    category: p.category,
    keywords: p.keywords ?? null,
  });

  if (pool.length <= limit) return pool.map(toPreview);

  // 1순위(가장 관련) 고정 + 나머지는 상위 윈도우(최대 5개)에서 셔플
  // → 관련성·선호 방향 유지하면서 매번 다른 조합. 윈도우를 좁게 둬 가격/퀄리티 방향성이 흐려지지 않게.
  const head = pool[0];
  const window = pool.slice(1, 1 + Math.min(pool.length - 1, 5));
  for (let i = window.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [window[i], window[j]] = [window[j], window[i]];
  }
  return [head, ...window.slice(0, limit - 1)].map(toPreview);
}

export async function fetchPopularProducts(limit: number = 6): Promise<ProductPreview[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('products')
    .select('id, title, base_price, thumbnail_image_link, category')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching popular products:', error);
    return [];
  }

  return (data || []) as ProductPreview[];
}
