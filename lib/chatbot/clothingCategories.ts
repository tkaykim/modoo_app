/**
 * 챗봇 의류 카테고리 로더.
 *
 * 상점(v2)의 카테고리 내비게이션과 동일한 출처인 product_categories 테이블에서
 * is_active=true 행만 가져온다 → 상점에서 숨긴 카테고리(is_active=false, 예: "테스트")는
 * 챗봇에서도 자동으로 빠진다. (app/v2/_lib/queries.ts getV2Categories와 같은 쿼리)
 *
 * "전체"(all)는 의류 종류가 아니므로 제외. DB 조회 실패/빈 결과 시 정적 폴백(config)을 쓴다.
 */
import { createClient } from '@/lib/supabase-client';
import { CLOTHING_CATEGORIES } from './config';

export interface ChatClothingCategory {
  name: string;
  key: string;
}

// 정적 폴백 = lib/categories.ts 기반 (config.CLOTHING_CATEGORIES, "전체" 이미 제외)
const FALLBACK: ChatClothingCategory[] = CLOTHING_CATEGORIES.map((c) => ({ name: c.name, key: c.key }));

let _cache: ChatClothingCategory[] | null = null;

export async function fetchClothingCategories(): Promise<ChatClothingCategory[]> {
  if (_cache) return _cache;
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('product_categories')
      .select('key, name, is_active, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error || !data || data.length === 0) return FALLBACK;
    const items: ChatClothingCategory[] = data
      .map((r: { key: string; name: string }) => ({ name: String(r.name), key: String(r.key) }))
      .filter((c) => c.key !== 'all' && c.name !== '전체');
    if (items.length === 0) return FALLBACK;
    _cache = items;
    return items;
  } catch {
    return FALLBACK;
  }
}
