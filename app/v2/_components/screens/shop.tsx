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
const SORT_LABELS = ["추천순", "인기순", "낮은 가격순", "빠른제작"];

function ProductThumb({
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
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
    );
  }
  return <Tee color={fallbackColor} size={130} lining={fallbackColor !== "#FFFFFF"} />;
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
  const filtered =
    selectedCategory === "all"
      ? products
      : products.filter((p) => p.category === selectedCategory);

  return (
    <div
      style={{ background: "#fff", minHeight: "100%", position: "relative" }}
    >
      <AppBar
        title="상품"
        left={
          <Link href="/v2" style={{ color: "inherit" }}>
            <Icon name="arrow-l" />
          </Link>
        }
        right={
          <div style={{ display: "flex", gap: 14 }}>
            <Icon name="search" />
            <Link href="/v2/cart" style={{ color: "inherit" }}>
              <Icon name="cart" />
            </Link>
          </div>
        }
      />
      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          padding: "8px 16px 12px",
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
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "0 16px 12px",
          borderBottom: `1px solid ${MODOO.hairlineSoft}`,
        }}
      >
        {SORT_LABELS.map((s, i) => (
          <div
            key={s}
            style={{
              font: `${i === 0 ? 700 : 500} 12px/1 ${MODOO.fonts.sans}`,
              color: i === 0 ? MODOO.ink : MODOO.muted,
            }}
          >
            {s}
            {i < SORT_LABELS.length - 1 && (
              <span style={{ marginLeft: 8, color: MODOO.hairline }}>·</span>
            )}
          </div>
        ))}
      </div>
      <div
        style={{
          padding: 12,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        {filtered.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: "60px 20px",
              textAlign: "center",
              color: MODOO.muted,
              font: `500 13px/1.5 ${MODOO.fonts.sans}`,
            }}
          >
            표시할 상품이 없어요.
          </div>
        )}
        {filtered.map((p, i) => {
          const tag = p.isBest
            ? "BEST"
            : p.isHot
              ? "HOT"
              : p.isNew
                ? "신상"
                : null;
          const fallback = FALLBACK_COLORS[i % FALLBACK_COLORS.length];
          return (
            <Link
              key={p.id}
              href={`/v2/product/${p.id}`}
              style={{ textDecoration: "none", color: "inherit", position: "relative" }}
            >
              <div
                style={{
                  aspectRatio: "1/1.05",
                  borderRadius: 14,
                  overflow: "hidden",
                  background: MODOO.surfaceWarm,
                  border: `1px solid ${MODOO.hairlineSoft}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}
              >
                <ProductThumb src={p.thumbnail} fallbackColor={fallback} alt={p.title} />
                {tag && (
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
                <button
                  style={{
                    position: "absolute",
                    right: 8,
                    bottom: 8,
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    background: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                  }}
                >
                  <Icon name="heart" size={16} color={MODOO.muted} />
                </button>
              </div>
              <div style={{ padding: "10px 2px 0" }}>
                <div style={{ font: `600 13px/1.3 ${MODOO.fonts.sans}` }}>
                  {p.title}
                </div>
                <div
                  style={{
                    font: `500 11px/1.2 ${MODOO.fonts.sans}`,
                    color: MODOO.muted,
                    marginTop: 3,
                  }}
                >
                  {p.manufacturerName ?? ""}
                  {p.colorCount > 0 && (p.manufacturerName ? ` · ${p.colorCount}col` : `${p.colorCount}col`)}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 6,
                    marginTop: 6,
                  }}
                >
                  {p.originalPrice && (
                    <span
                      className="num"
                      style={{
                        font: `500 11px/1 ${MODOO.fonts.sans}`,
                        color: MODOO.faint,
                        textDecoration: "line-through",
                      }}
                    >
                      {p.originalPrice.toLocaleString()}
                    </span>
                  )}
                  <span
                    className="num"
                    style={{ font: `700 14px/1 ${MODOO.fonts.sans}` }}
                  >
                    ₩{p.price.toLocaleString()}
                  </span>
                  {p.reviewCount > 0 && (
                    <span
                      className="num"
                      style={{
                        font: `500 10px/1 ${MODOO.fonts.sans}`,
                        color: MODOO.faint,
                        marginLeft: "auto",
                      }}
                    >
                      리뷰 {p.reviewCount}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
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
