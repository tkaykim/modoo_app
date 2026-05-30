"use client";

import * as React from "react";
import Link from "next/link";
import { MODOO, Icon, Tee, TabBar, AppBar, Chip } from "../tokens";
import type {
  V2CatalogProduct,
  V2Category,
  V2ProductDetail,
} from "../../_lib/types";

interface BrandProp {
  brand?: string;
}

const FALLBACK_COLORS = ["#0E1116", "#FFE7B0", "#0052CC", "#5C6573", "#FFFFFF", "#16331F"];

type SortOption = "default" | "review_count" | "price_low" | "price_high";
const SORT_LABELS: Record<SortOption, string> = {
  default: "기본",
  review_count: "리뷰 많은순",
  price_low: "낮은 가격순",
  price_high: "높은 가격순",
};
const PAGE_SIZE = 12;

/** admin에서 지정한 키워드(products.keywords)만 노출. 비어 있으면 표시 안 함. */
function productHashtags(p: V2CatalogProduct): string[] {
  return (p.keywords ?? []).slice(0, 5);
}

const RAIL_H = 144;

function RailImg({
  src,
  fallbackColor,
  alt,
}: {
  src: string | null;
  fallbackColor: string;
  alt: string;
}) {
  if (src) {
    /* eslint-disable @next/next/no-img-element */
    return (
      <img
        src={src}
        alt={alt}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    );
  }
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: MODOO.surfaceWarm,
      }}
    >
      <Tee color={fallbackColor} size={108} lining={fallbackColor !== "#FFFFFF"} />
    </div>
  );
}

interface CatalogProps extends BrandProp {
  products: V2CatalogProduct[];
  categories: V2Category[];
  selectedCategory?: string;
}

export const Catalog: React.FC<CatalogProps> = ({
  brand = MODOO.brand,
  products,
  categories,
  selectedCategory = "all",
}) => {
  const cats = [{ key: "all", name: "전체" }, ...categories];

  const [searchQuery, setSearchQuery] = React.useState("");
  const [showFilters, setShowFilters] = React.useState(false);
  const [selectedManufacturer, setSelectedManufacturer] = React.useState("all");
  const [sortBy, setSortBy] = React.useState<SortOption>("default");
  const [showSortMenu, setShowSortMenu] = React.useState(false);
  const [displayCount, setDisplayCount] = React.useState(PAGE_SIZE);
  const sortRef = React.useRef<HTMLDivElement>(null);
  const loadMoreRef = React.useRef<HTMLDivElement>(null);

  // 제조사 목록
  const manufacturers = React.useMemo(
    () =>
      Array.from(
        new Set(
          products.map((p) => p.manufacturerName).filter((m): m is string => !!m)
        )
      ).sort(),
    [products]
  );

  // 가격 범위(천원 단위 반올림)
  const priceBounds = React.useMemo<[number, number]>(() => {
    if (!products.length) return [0, 0];
    const prices = products.map((p) => p.price);
    return [
      Math.floor(Math.min(...prices) / 1000) * 1000,
      Math.ceil(Math.max(...prices) / 1000) * 1000,
    ];
  }, [products]);
  const [priceMin, setPriceMin] = React.useState(priceBounds[0]);
  const [priceMax, setPriceMax] = React.useState(priceBounds[1]);
  React.useEffect(() => {
    setPriceMin(priceBounds[0]);
    setPriceMax(priceBounds[1]);
  }, [priceBounds]);

  const priceActive =
    priceBounds[1] > 0 &&
    (priceMin !== priceBounds[0] || priceMax !== priceBounds[1]);
  const hasActiveFilter = selectedManufacturer !== "all" || priceActive;

  // 정렬 메뉴 외부 클릭 닫기
  React.useEffect(() => {
    if (!showSortMenu) return;
    const onDown = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node))
        setShowSortMenu(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showSortMenu]);

  // 필터/정렬 결과
  const filtered = React.useMemo(() => {
    let result =
      selectedCategory === "all"
        ? products
        : products.filter((p) => p.category === selectedCategory);

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q) ||
          p.manufacturerName?.toLowerCase().includes(q) ||
          (p.keywords ?? []).some((k) => k.toLowerCase().includes(q))
      );
    }
    if (selectedManufacturer !== "all")
      result = result.filter((p) => p.manufacturerName === selectedManufacturer);
    if (priceBounds[1] > 0)
      result = result.filter((p) => p.price >= priceMin && p.price <= priceMax);

    if (sortBy === "review_count")
      result = [...result].sort((a, b) => b.reviewCount - a.reviewCount);
    else if (sortBy === "price_low")
      result = [...result].sort((a, b) => a.price - b.price);
    else if (sortBy === "price_high")
      result = [...result].sort((a, b) => b.price - a.price);

    return result;
  }, [
    products,
    selectedCategory,
    searchQuery,
    selectedManufacturer,
    priceMin,
    priceMax,
    priceBounds,
    sortBy,
  ]);

  React.useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [filtered]);

  const visible = filtered.slice(0, displayCount);
  const hasMore = displayCount < filtered.length;

  React.useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setDisplayCount((n) => n + PAGE_SIZE);
      },
      { rootMargin: "300px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore]);

  const resetFilters = () => {
    setSelectedManufacturer("all");
    setPriceMin(priceBounds[0]);
    setPriceMax(priceBounds[1]);
  };

  const span = priceBounds[1] - priceBounds[0] || 1;

  return (
    <div style={{ background: "#fff", minHeight: "100%", position: "relative" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "#fff" }}>
        <AppBar
          title="상품"
          left={
            <Link href="/v2" style={{ color: "inherit" }}>
              <Icon name="arrow-l" />
            </Link>
          }
          right={
            <Link href="/v2/cart" style={{ color: "inherit" }}>
              <Icon name="cart" />
            </Link>
          }
        />

        {/* 검색 바 + 필터 토글 */}
        <div style={{ padding: "4px 16px 10px" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <span style={{ position: "absolute", left: 12, display: "flex", color: MODOO.faint }}>
              <Icon name="search" size={19} />
            </span>
            <input
              type="text"
              placeholder="상품 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                height: 44,
                padding: "0 84px 0 38px",
                borderRadius: 12,
                border: `1px solid ${MODOO.hairline}`,
                background: MODOO.surfaceAlt,
                font: `500 14px/1 ${MODOO.fonts.sans}`,
                outline: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                right: 8,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  aria-label="검색어 지우기"
                  style={{ display: "flex", color: MODOO.faint, padding: 4 }}
                >
                  <Icon name="close" size={18} />
                </button>
              )}
              <button
                onClick={() => setShowFilters((v) => !v)}
                aria-label="필터"
                style={{
                  position: "relative",
                  display: "flex",
                  padding: 6,
                  borderRadius: 9,
                  background: showFilters || hasActiveFilter ? MODOO.brandSoft : "transparent",
                  color: showFilters || hasActiveFilter ? brand : MODOO.faint,
                }}
              >
                <Icon name="filter" size={19} />
                {hasActiveFilter && (
                  <span
                    style={{
                      position: "absolute",
                      top: 2,
                      right: 2,
                      width: 7,
                      height: 7,
                      borderRadius: 4,
                      background: brand,
                    }}
                  />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 카테고리 칩 (v2 현행 유지) */}
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            padding: "0 16px 12px",
          }}
        >
          {cats.map((c) => (
            <Link
              key={c.key}
              href={c.key === "all" ? "/v2/mall" : `/v2/mall?category=${c.key}`}
              style={{ textDecoration: "none" }}
            >
              <Chip active={selectedCategory === c.key}>{c.name}</Chip>
            </Link>
          ))}
        </div>

        {/* 필터 패널 */}
        {showFilters && (
          <div
            style={{
              padding: "14px 16px 16px",
              borderTop: `1px solid ${MODOO.hairlineSoft}`,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {hasActiveFilter && (
              <button
                onClick={resetFilters}
                style={{
                  alignSelf: "flex-start",
                  font: `500 12px/1 ${MODOO.fonts.sans}`,
                  color: MODOO.muted,
                  textDecoration: "underline",
                }}
              >
                필터 초기화
              </button>
            )}
            {manufacturers.length > 0 && (
              <div>
                <div style={{ font: `700 13px/1 ${MODOO.fonts.sans}`, marginBottom: 10 }}>
                  제조사
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {["all", ...manufacturers].map((name) => {
                    const active = selectedManufacturer === name;
                    return (
                      <button
                        key={name}
                        onClick={() => setSelectedManufacturer(name)}
                        style={{
                          padding: "7px 12px",
                          borderRadius: 999,
                          background: active ? brand : MODOO.surfaceAlt,
                          color: active ? "#fff" : MODOO.body,
                          border: active ? "none" : `1px solid ${MODOO.hairline}`,
                          font: `600 12px/1 ${MODOO.fonts.sans}`,
                        }}
                      >
                        {name === "all" ? "전체" : name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {priceBounds[1] > 0 && (
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: 10,
                  }}
                >
                  <span style={{ font: `700 13px/1 ${MODOO.fonts.sans}` }}>가격 범위</span>
                  <span className="num" style={{ font: `500 12px/1 ${MODOO.fonts.sans}`, color: MODOO.muted }}>
                    {priceMin.toLocaleString()}원 ~ {priceMax.toLocaleString()}원
                  </span>
                </div>
                <div style={{ position: "relative", height: 20, display: "flex", alignItems: "center" }}>
                  <div
                    style={{
                      position: "absolute",
                      width: "100%",
                      height: 4,
                      borderRadius: 2,
                      background: MODOO.hairline,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      height: 4,
                      borderRadius: 2,
                      background: brand,
                      left: `${((priceMin - priceBounds[0]) / span) * 100}%`,
                      right: `${100 - ((priceMax - priceBounds[0]) / span) * 100}%`,
                    }}
                  />
                  <input
                    className="v2-range"
                    type="range"
                    min={priceBounds[0]}
                    max={priceBounds[1]}
                    step={1000}
                    value={priceMin}
                    onChange={(e) => setPriceMin(Math.min(Number(e.target.value), priceMax))}
                    style={{ position: "absolute", width: "100%", pointerEvents: "none" }}
                  />
                  <input
                    className="v2-range"
                    type="range"
                    min={priceBounds[0]}
                    max={priceBounds[1]}
                    step={1000}
                    value={priceMax}
                    onChange={(e) => setPriceMax(Math.max(Number(e.target.value), priceMin))}
                    style={{ position: "absolute", width: "100%", pointerEvents: "none" }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 결과 수 + 정렬 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 16px 10px",
            borderTop: `1px solid ${MODOO.hairlineSoft}`,
            borderBottom: `1px solid ${MODOO.hairlineSoft}`,
          }}
        >
          <span style={{ font: `500 12px/1 ${MODOO.fonts.sans}`, color: MODOO.muted }}>
            {filtered.length}개의 상품
            {searchQuery && ` · "${searchQuery}" 검색`}
          </span>
          <div ref={sortRef} style={{ position: "relative" }}>
            <button
              onClick={() => setShowSortMenu((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                font: `600 12px/1 ${MODOO.fonts.sans}`,
                color: MODOO.body,
              }}
            >
              <Icon name="sort" size={15} />
              {SORT_LABELS[sortBy]}
            </button>
            {showSortMenu && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 6px)",
                  background: "#fff",
                  border: `1px solid ${MODOO.hairline}`,
                  borderRadius: 12,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
                  padding: 4,
                  zIndex: 30,
                  minWidth: 128,
                }}
              >
                {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      setSortBy(opt);
                      setShowSortMenu(false);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      borderRadius: 8,
                      font: `${sortBy === opt ? 700 : 500} 12px/1 ${MODOO.fonts.sans}`,
                      color: sortBy === opt ? brand : MODOO.body,
                      background: sortBy === opt ? MODOO.brandSofter : "transparent",
                    }}
                  >
                    {SORT_LABELS[opt]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {filtered.length === 0 && (
        <div
          style={{
            padding: "72px 20px",
            textAlign: "center",
            color: MODOO.muted,
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12, color: MODOO.hairline }}>
            <Icon name="search" size={48} />
          </div>
          <div style={{ font: `700 15px/1.4 ${MODOO.fonts.sans}`, color: MODOO.body }}>
            검색 결과가 없어요
          </div>
          <div style={{ font: `500 13px/1.5 ${MODOO.fonts.sans}`, marginTop: 4 }}>
            다른 검색어나 필터를 시도해 보세요
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column" }}>
        {visible.map((p, i) => {
          const tag = p.isBest
            ? "BEST"
            : p.isHot
              ? "HOT"
              : p.isNew
                ? "신상"
                : null;
          const fallback = FALLBACK_COLORS[i % FALLBACK_COLORS.length];
          const gallery =
            p.gallery && p.gallery.length
              ? p.gallery
              : p.thumbnail
                ? [p.thumbnail]
                : [];
          const hashtags = productHashtags(p);

          return (
            <Link
              key={p.id}
              href={`/v2/product/${p.id}`}
              style={{
                textDecoration: "none",
                color: "inherit",
                padding: "16px 16px 18px",
                borderBottom: `1px solid ${MODOO.hairlineSoft}`,
              }}
            >
              {/* 사진 레일: 썸네일 갤러리 (1장이면 1장, 여러 장이면 가로 스크롤) */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  overflowX: "auto",
                  scrollbarWidth: "none",
                  margin: "0 -16px",
                  padding: "0 16px 2px",
                }}
              >
                {gallery.map((src, gi) => (
                  <div
                    key={`g${gi}`}
                    style={{
                      position: "relative",
                      flex: "0 0 auto",
                      width: RAIL_H,
                      height: RAIL_H,
                      borderRadius: 14,
                      overflow: "hidden",
                      background: MODOO.surfaceWarm,
                      border: `1px solid ${MODOO.hairlineSoft}`,
                    }}
                  >
                    <RailImg src={src} fallbackColor={fallback} alt={p.title} />
                    {gi === 0 && tag && (
                      <div
                        style={{
                          position: "absolute",
                          top: 8,
                          left: 8,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background:
                            tag === "BEST"
                              ? brand
                              : tag === "HOT"
                                ? MODOO.err
                                : MODOO.ink,
                          color: "#fff",
                          font: `700 10px/1.2 ${MODOO.fonts.mono}`,
                          letterSpacing: "0.06em",
                        }}
                      >
                        {tag}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 본문 */}
              <div style={{ marginTop: 12, display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: `700 16px/1.3 ${MODOO.fonts.sans}`, letterSpacing: "-0.01em" }}>
                    {p.title}
                  </div>
                  <div
                    style={{
                      font: `500 12px/1.2 ${MODOO.fonts.sans}`,
                      color: MODOO.muted,
                      marginTop: 4,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {p.manufacturerName && <span>{p.manufacturerName}</span>}
                    {p.colorCount > 0 && (
                      <>
                        {p.manufacturerName && <span style={{ color: MODOO.hairline }}>·</span>}
                        <span>{p.colorCount}색상</span>
                      </>
                    )}
                    {p.reviewCount > 0 && (
                      <>
                        <span style={{ color: MODOO.hairline }}>·</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                          <Icon name="star-fill" size={11} color={MODOO.yolk} />
                          리뷰 {p.reviewCount}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  style={{
                    flex: "0 0 auto",
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    background: "#fff",
                    border: `1px solid ${MODOO.hairline}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="heart" size={17} color={MODOO.muted} />
                </button>
              </div>

              {/* 가격: 얼마부터 시작 */}
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  alignItems: "baseline",
                  gap: 6,
                }}
              >
                {p.originalPrice && (
                  <span
                    className="num"
                    style={{
                      font: `500 12px/1 ${MODOO.fonts.sans}`,
                      color: MODOO.faint,
                      textDecoration: "line-through",
                    }}
                  >
                    {p.originalPrice.toLocaleString()}
                  </span>
                )}
                <span style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                  <span className="num" style={{ font: `800 19px/1 ${MODOO.fonts.sans}`, letterSpacing: "-0.02em" }}>
                    ₩{p.price.toLocaleString()}
                  </span>
                  <span style={{ font: `600 13px/1 ${MODOO.fonts.sans}`, color: MODOO.muted }}>
                    부터
                  </span>
                </span>
                <span style={{ font: `500 11px/1 ${MODOO.fonts.sans}`, color: MODOO.faint }}>
                  / 장 · 인쇄 별도
                </span>
              </div>

              {/* 해시태그 (admin 키워드가 있을 때만) */}
              {hashtags.length > 0 && (
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                {hashtags.map((h) => (
                  <span
                    key={h}
                    style={{
                      padding: "4px 9px",
                      borderRadius: 999,
                      background: MODOO.brandSofter,
                      color: MODOO.brand,
                      font: `600 11px/1 ${MODOO.fonts.sans}`,
                    }}
                  >
                    #{h}
                  </span>
                ))}
              </div>
              )}
            </Link>
          );
        })}
      </div>
      {hasMore && (
        <div
          ref={loadMoreRef}
          style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              border: `2px solid ${MODOO.hairline}`,
              borderTopColor: brand,
              animation: "modoo-spin 0.7s linear infinite",
            }}
          />
        </div>
      )}
      <div style={{ height: 110 }} />
      <TabBar active="shop" brand={brand} />
    </div>
  );
};

interface ProductDetailProps extends BrandProp {
  product: V2ProductDetail;
}

export const ProductDetail: React.FC<ProductDetailProps> = ({
  brand = MODOO.brand,
  product,
}) => {
  const minTier = product.discountTiers[0];
  const discounted = minTier && minTier.discount_rate > 0
    ? Math.round(product.basePrice * (1 - minTier.discount_rate / 100))
    : null;
  const finalPrice = discounted ?? product.basePrice;
  const ratingRounded = product.rating ?? 0;
  const colors = product.colors.length
    ? product.colors
    : [
        { id: "fb-1", name: "기본", hex: "#0E1116" },
      ];
  const sizes = product.sizes.length
    ? product.sizes
    : [
        { label: "S", size_code: "S" },
        { label: "M", size_code: "M" },
        { label: "L", size_code: "L" },
        { label: "XL", size_code: "XL" },
      ];

  return (
    <div
      style={{ background: "#fff", minHeight: "100%", position: "relative" }}
    >
      <div
        style={{
          height: 380,
          background: "#F2F0EA",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            top: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {product.primaryImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.primaryImage}
              alt={product.title}
              style={{ maxWidth: "85%", maxHeight: "85%", objectFit: "contain" }}
            />
          ) : (
            <Tee color={colors[0].hex} size={300} />
          )}
        </div>
        <div
          style={{
            position: "absolute",
            right: 14,
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            alignItems: "center",
          }}
        >
          {product.thumbnails.slice(0, 4).map((src, i) => (
            <div
              key={i}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: i === 0 ? "#fff" : "rgba(255,255,255,0.6)",
                border: i === 0 ? `1.5px solid ${MODOO.ink}` : "none",
                padding: 4,
                overflow: "hidden",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            top: 6,
            left: 0,
            right: 0,
            padding: "6px 12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Link
            href="/v2/mall"
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              background: "rgba(255,255,255,0.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: MODOO.ink,
            }}
          >
            <Icon name="arrow-l" size={20} />
          </Link>
          <div style={{ display: "flex", gap: 8 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                background: "rgba(255,255,255,0.9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="share" size={18} />
            </div>
            <Link
              href="/v2/cart"
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                background: "rgba(255,255,255,0.9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: MODOO.ink,
              }}
            >
              <Icon name="cart" size={18} />
            </Link>
          </div>
        </div>
      </div>
      <div style={{ padding: "18px 20px 0" }}>
        {product.reviewCount >= 100 && (
          <div
            style={{
              display: "inline-block",
              padding: "3px 8px",
              borderRadius: 5,
              background: brand + "14",
              color: brand,
              font: `700 10px/1 ${MODOO.fonts.mono}`,
              letterSpacing: "0.08em",
            }}
          >
            BEST · 누적 리뷰 {product.reviewCount.toLocaleString()}
          </div>
        )}
        <div
          style={{
            font: `700 22px/1.25 ${MODOO.fonts.sans}`,
            marginTop: 10,
            letterSpacing: "-0.02em",
          }}
        >
          {product.title}
        </div>
        <div
          style={{
            font: `500 13px/1.4 ${MODOO.fonts.sans}`,
            color: MODOO.muted,
            marginTop: 4,
          }}
        >
          {[product.manufacturerName, product.productCode].filter(Boolean).join(" · ")}
        </div>
        {product.reviewCount > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Icon
                  key={i}
                  name="star-fill"
                  size={14}
                  color={i <= Math.round(ratingRounded) ? MODOO.yolk : MODOO.hairline}
                />
              ))}
            </div>
            <span
              className="num"
              style={{ font: `700 13px/1 ${MODOO.fonts.sans}` }}
            >
              {ratingRounded.toFixed(2)}
            </span>
            <span
              style={{
                font: `500 12px/1 ${MODOO.fonts.sans}`,
                color: MODOO.muted,
              }}
            >
              · 리뷰 {product.reviewCount.toLocaleString()}
            </span>
          </div>
        )}
        <div
          style={{
            marginTop: 18,
            padding: "14px 16px",
            background: MODOO.surfaceAlt,
            borderRadius: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            {discounted && (
              <>
                <span
                  style={{
                    font: `700 13px/1 ${MODOO.fonts.sans}`,
                    color: MODOO.err,
                  }}
                >
                  {minTier!.discount_rate}%
                </span>
                <span
                  className="num"
                  style={{
                    font: `500 13px/1 ${MODOO.fonts.sans}`,
                    color: MODOO.faint,
                    textDecoration: "line-through",
                  }}
                >
                  ₩{product.basePrice.toLocaleString()}
                </span>
              </>
            )}
            <span
              className="num"
              style={{
                font: `800 22px/1 ${MODOO.fonts.sans}`,
                marginLeft: "auto",
                letterSpacing: "-0.02em",
              }}
            >
              ₩{finalPrice.toLocaleString()}
            </span>
          </div>
          {product.discountTiers.length > 0 && (
            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              {product.discountTiers.slice(0, 4).map((t, i, arr) => (
                <React.Fragment key={t.min_quantity}>
                  <div
                    style={{
                      font: `600 11px/1 ${MODOO.fonts.sans}`,
                      color: i === arr.length - 1 ? brand : MODOO.muted,
                    }}
                  >
                    {t.min_quantity}장 ₩
                    {Math.round(
                      product.basePrice * (1 - t.discount_rate / 100)
                    ).toLocaleString()}
                  </div>
                  {i < arr.length - 1 && (
                    <span style={{ color: MODOO.hairline }}>·</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
        <div style={{ marginTop: 22 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <div style={{ font: `700 13px/1 ${MODOO.fonts.sans}` }}>색상</div>
            <div
              style={{
                font: `500 12px/1 ${MODOO.fonts.sans}`,
                color: MODOO.muted,
              }}
            >
              {colors[0]?.name}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 12,
              flexWrap: "wrap",
            }}
          >
            {colors.map((c, i) => (
              <div
                key={c.id}
                title={c.name}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  background: c.hex,
                  position: "relative",
                  border:
                    c.hex.toUpperCase() === "#FFFFFF"
                      ? `1px solid ${MODOO.hairline}`
                      : "none",
                  outline: i === 0 ? `2px solid ${MODOO.ink}` : "none",
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>
        </div>
        <div style={{ marginTop: 18 }}>
          <div style={{ font: `700 13px/1 ${MODOO.fonts.sans}` }}>사이즈</div>
          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 12,
              flexWrap: "wrap",
            }}
          >
            {sizes.map((s, i) => (
              <div
                key={s.size_code}
                style={{
                  minWidth: 44,
                  height: 36,
                  padding: "0 10px",
                  borderRadius: 8,
                  background: false ? MODOO.ink : "#fff",
                  color: false ? "#fff" : MODOO.body,
                  border:
                    false
                      ? "none"
                      : `1px solid ${MODOO.hairline}`,
                  font: `${false ? 700 : 500} 13px/1 ${MODOO.fonts.sans}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {s.label}
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 10,
              font: `500 11px/1.4 ${MODOO.fonts.sans}`,
              color: MODOO.muted,
            }}
          >
            주문 후 사이즈별 수량은 결제 후 입력 가능 · 사이즈표 보기 →
          </div>
        </div>
        <div style={{ height: 28 }} />
        <Link
          href={`/v2/editor/${product.id}`}
          style={{
            background: brand,
            color: "#fff",
            borderRadius: 16,
            padding: 16,
            display: "flex",
            alignItems: "center",
            gap: 12,
            textDecoration: "none",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "rgba(255,255,255,0.16)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="sparkle" size={22} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ font: `700 14px/1.2 ${MODOO.fonts.sans}` }}>
              이 옷 위에 디자인 해보기
            </div>
            <div
              style={{
                font: `500 11px/1.3 ${MODOO.fonts.sans}`,
                opacity: 0.85,
                marginTop: 2,
              }}
            >
              1분이면 끝, 결제 전엔 무료
            </div>
          </div>
          <Icon name="arrow-r" size={20} color="#fff" />
        </Link>
      </div>
      <div style={{ height: 100 }} />
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 480,
          zIndex: 30,
          padding: "10px 16px 30px",
          background: "#fff",
          borderTop: `0.5px solid ${MODOO.hairline}`,
          display: "flex",
          gap: 10,
          alignItems: "center",
        }}
      >
        <button
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: "#fff",
            border: `1px solid ${MODOO.hairline}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="heart" size={22} />
        </button>
        <Link
          href="/v2/cart"
          style={{
            flex: 1,
            height: 52,
            borderRadius: 14,
            background: "#fff",
            border: `1.5px solid ${MODOO.ink}`,
            color: MODOO.ink,
            font: `700 15px/1 ${MODOO.fonts.sans}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
          }}
        >
          장바구니
        </Link>
        <Link
          href={`/v2/editor/${product.id}`}
          style={{
            flex: 1.3,
            height: 52,
            borderRadius: 14,
            background: brand,
            color: "#fff",
            font: `700 15px/1 ${MODOO.fonts.sans}`,
            boxShadow: `0 6px 16px ${brand}40`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
          }}
        >
          디자인하기
        </Link>
      </div>
    </div>
  );
};
