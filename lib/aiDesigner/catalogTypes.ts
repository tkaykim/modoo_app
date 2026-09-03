/**
 * AI 디자이너 — 상품 선택 목록(카탈로그) 타입.
 * 클라이언트·서버 양쪽에서 import 가능(런타임 의존성 없음).
 */

export interface AiCatalogProduct {
  id: string;
  title: string;
  category: string | null;
  /** 정상가(products.base_price). 위저드 기존 필드명을 유지한다. */
  base_price: number;
  /** 최소 수량 할인 적용가. 할인 티어가 없으면 base_price와 같다. */
  price: number;
  /** 할인 티어가 있을 때만 정상가, 없으면 null (v2 카탈로그와 동일 의미). */
  originalPrice: number | null;
  thumbnail: string | null;
  /** 제품 사진 갤러리(대표 포함). 비어 있으면 썸네일 없음. */
  gallery: string[];
  /** admin 지정 키워드(해시태그) = products.keywords */
  keywords: string[];
  manufacturerName: string | null;
  colorCount: number;
  reviewCount: number;
  /** 평균 평점(소수 1자리). 리뷰가 없으면 null. */
  ratingAvg: number | null;
  /** 대표 리뷰 한 줄(베스트 리뷰 우선). 없으면 null. */
  reviewSnippet: string | null;
  isBest: boolean;
  isNew: boolean;
  isHot: boolean;
}

export interface AiCatalogCategory {
  key: string;
  name: string;
  icon: string | null;
}
