"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MODOO, Icon, Tee, AppBar, CTA, IconName } from "../tokens";
import { useCartStore } from "@/store/useCartStore";
import type { V2OrderSummary } from "../../_lib/types";
import {
  getOrderStatusLabel,
  getOrderStageIndex,
} from "../../_lib/types";

interface BrandProp {
  brand?: string;
}

export const Cart: React.FC<BrandProp> = ({ brand = MODOO.brand }) => {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const totalQty = useCartStore((s) => s.getTotalQuantity());
  const subtotal = useCartStore((s) => s.getTotalPrice());
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);
  // Show empty layout pre-hydration too (server renders default empty cart).
  const isEmpty = !hydrated || items.length === 0;
  return (
    <div
      style={{
        background: MODOO.surfaceWarm,
        minHeight: "100%",
        position: "relative",
      }}
    >
      <AppBar
        title="장바구니"
        left={
          <Link href="/v2" style={{ color: "inherit" }}>
            <Icon name="arrow-l" />
          </Link>
        }
        right={
          <span
            style={{
              font: `600 12px/1 ${MODOO.fonts.sans}`,
              color: MODOO.muted,
            }}
          >
            편집
          </span>
        }
      />
      {isEmpty ? (
        <div
          style={{
            padding: "80px 24px",
            textAlign: "center",
            color: MODOO.muted,
          }}
        >
          <Icon name="cart" size={48} color={MODOO.faint} />
          <div
            style={{
              font: `700 16px/1.3 ${MODOO.fonts.sans}`,
              marginTop: 16,
              color: MODOO.body,
            }}
          >
            장바구니가 비어있어요
          </div>
          <div
            style={{
              font: `500 13px/1.5 ${MODOO.fonts.sans}`,
              marginTop: 8,
            }}
          >
            마음에 드는 옷을 골라보세요
          </div>
          <Link
            href="/v2/mall"
            style={{
              display: "inline-block",
              marginTop: 24,
              padding: "12px 24px",
              borderRadius: 12,
              background: brand,
              color: "#fff",
              font: `700 14px/1 ${MODOO.fonts.sans}`,
              textDecoration: "none",
            }}
          >
            상품 둘러보기
          </Link>
        </div>
      ) : (
        <div
          style={{
            padding: "12px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {items.map((it) => (
            <div
              key={it.id}
              style={{
                background: "#fff",
                borderRadius: 16,
                padding: 14,
                border: `1px solid ${MODOO.hairline}`,
                display: "flex",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 10,
                  background: MODOO.surfaceAlt,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  overflow: "hidden",
                }}
              >
                {it.thumbnailUrl || it.previewImage ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={it.thumbnailUrl || it.previewImage!}
                    alt={it.productTitle}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <Tee
                    color={it.productColor || "#0E1116"}
                    size={70}
                    lining={false}
                    accent="#FFD25C"
                  />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <div style={{ font: `700 13px/1.3 ${MODOO.fonts.sans}`, minWidth: 0 }}>
                    {it.productTitle}
                    {it.productColorName ? ` · ${it.productColorName}` : ""}
                  </div>
                  <button
                    onClick={() => removeItem(it.id)}
                    aria-label="삭제"
                    style={{ flexShrink: 0 }}
                  >
                    <Icon name="close" size={16} color={MODOO.faint} />
                  </button>
                </div>
                <div
                  style={{
                    font: `500 11px/1.2 ${MODOO.fonts.sans}`,
                    color: MODOO.muted,
                    marginTop: 4,
                  }}
                >
                  {it.designName || it.size}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      border: `1px solid ${MODOO.hairline}`,
                      borderRadius: 8,
                      height: 30,
                    }}
                  >
                    <button
                      onClick={() => updateQuantity(it.id, it.quantity - 1)}
                      style={{
                        width: 30,
                        height: 30,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon name="minus" size={14} />
                    </button>
                    <div
                      className="num"
                      style={{
                        width: 30,
                        textAlign: "center",
                        font: `700 13px/1 ${MODOO.fonts.sans}`,
                      }}
                    >
                      {it.quantity}
                    </div>
                    <button
                      onClick={() => updateQuantity(it.id, it.quantity + 1)}
                      style={{
                        width: 30,
                        height: 30,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon name="plus" size={14} />
                    </button>
                  </div>
                  <div
                    className="num"
                    style={{ font: `700 14px/1 ${MODOO.fonts.sans}` }}
                  >
                    ₩{(it.pricePerItem * it.quantity).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: 12,
              display: "flex",
              alignItems: "center",
              gap: 10,
              border: `1px dashed ${brand}55`,
            }}
          >
            <Icon name="tag" size={18} color={brand} />
            <input
              placeholder="쿠폰 코드 입력"
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                background: "transparent",
                font: `500 12px/1 ${MODOO.fonts.sans}`,
              }}
            />
            <span
              style={{
                font: `700 12px/1 ${MODOO.fonts.sans}`,
                color: brand,
              }}
            >
              적용
            </span>
          </div>
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: 14,
              border: `1px solid ${MODOO.hairline}`,
            }}
          >
            {[
              { l: "상품 합계", v: `₩${subtotal.toLocaleString()}` },
              { l: "수량", v: `${totalQty}장` },
              { l: "배송비", v: "무료" },
            ].map((r, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "7px 0",
                }}
              >
                <span
                  style={{
                    font: `500 12px/1 ${MODOO.fonts.sans}`,
                    color: MODOO.muted,
                  }}
                >
                  {r.l}
                </span>
                <span
                  className="num"
                  style={{
                    font: `600 12px/1 ${MODOO.fonts.sans}`,
                    color: MODOO.body,
                  }}
                >
                  {r.v}
                </span>
              </div>
            ))}
            <div
              style={{
                height: 1,
                background: MODOO.hairlineSoft,
                margin: "8px 0",
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ font: `700 14px/1 ${MODOO.fonts.sans}` }}>
                총 결제금액
              </span>
              <span
                className="num"
                style={{
                  font: `800 20px/1 ${MODOO.fonts.sans}`,
                  letterSpacing: "-0.02em",
                }}
              >
                ₩{subtotal.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
      <div style={{ height: 120 }} />
      {!isEmpty && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "100%",
            maxWidth: 480,
            zIndex: 30,
            padding: "12px 16px 30px",
            background: "#fff",
            borderTop: `0.5px solid ${MODOO.hairline}`,
          }}
        >
          <CTA color={brand} onClick={() => router.push("/v2/checkout")}>
            주문하기 · ₩{subtotal.toLocaleString()}
          </CTA>
        </div>
      )}
    </div>
  );
};

export const Checkout: React.FC<BrandProp> = ({ brand = MODOO.brand }) => {
  const items = useCartStore((s) => s.items);
  const totalQty = useCartStore((s) => s.getTotalQuantity());
  const subtotal = useCartStore((s) => s.getTotalPrice());
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);
  const sizeCount = new Set(items.map((i) => i.size)).size;
  return (
  <div
    style={{
      background: MODOO.surfaceWarm,
      minHeight: "100%",
      position: "relative",
    }}
  >
    <AppBar
      title="주문/결제"
      left={
        <Link href="/v2/cart" style={{ color: "inherit" }}>
          <Icon name="arrow-l" />
        </Link>
      }
    />
    <div
      style={{
        padding: "12px 20px",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {["디자인", "인쇄", "수량", "결제"].map((s, i) => (
        <div
          key={s}
          style={{
            flex: 1,
            padding: "8px 0",
            borderRadius: 999,
            background: i < 3 ? brand : MODOO.surfaceAlt,
            color: i < 3 ? "#fff" : MODOO.faint,
            textAlign: "center",
            font: `${i === 3 ? 700 : 600} 11px/1 ${MODOO.fonts.sans}`,
            opacity: i === 3 ? 1 : i < 3 ? 0.92 : 0.7,
            outline: i === 3 ? `2px solid ${brand}` : "none",
            outlineOffset: 2,
          }}
        >
          {i + 1}. {s}
        </div>
      ))}
    </div>
    <div
      style={{
        padding: "4px 16px 0",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: 14,
          border: `1px solid ${MODOO.hairline}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ font: `700 12px/1 ${MODOO.fonts.sans}` }}>배송지</div>
          <span
            style={{ font: `600 12px/1 ${MODOO.fonts.sans}`, color: brand }}
          >
            변경
          </span>
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
          <Icon name="pin" size={18} color={MODOO.muted} />
          <div style={{ flex: 1 }}>
            <div style={{ font: `700 13px/1.2 ${MODOO.fonts.sans}` }}>
              박진우 · 010-2384-1029
            </div>
            <div
              style={{
                font: `500 12px/1.4 ${MODOO.fonts.sans}`,
                color: MODOO.muted,
                marginTop: 4,
              }}
            >
              서울시 성동구 왕십리로 222, 한양대 학생회관 3층 대학공학회
            </div>
            <div
              style={{
                marginTop: 8,
                display: "inline-block",
                padding: "3px 8px",
                borderRadius: 6,
                background: brand + "14",
                color: brand,
                font: `600 11px/1.4 ${MODOO.fonts.sans}`,
              }}
            >
              예상 도착 6/12 (수)
            </div>
          </div>
        </div>
      </div>
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: 14,
          border: `1px solid ${MODOO.hairline}`,
        }}
      >
        <div style={{ font: `700 12px/1 ${MODOO.fonts.sans}` }}>
          주문 상품 {hydrated ? items.length : 0}건
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {items.slice(0, 4).map((it) => (
            <div
              key={it.id}
              style={{
                width: 56,
                height: 56,
                borderRadius: 10,
                background: MODOO.surfaceAlt,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {it.thumbnailUrl || it.previewImage ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={it.thumbnailUrl || it.previewImage!}
                  alt={it.productTitle}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <Tee
                  color={it.productColor || "#0E1116"}
                  size={46}
                  lining={false}
                  accent="#FFD25C"
                />
              )}
            </div>
          ))}
          <div style={{ flex: 1 }}>
            <div
              className="num"
              style={{
                font: `500 12px/1.4 ${MODOO.fonts.sans}`,
                color: MODOO.muted,
              }}
            >
              총 {totalQty}장
              {sizeCount > 0 ? ` · 사이즈 ${sizeCount}종` : ""}
            </div>
            <div
              className="num"
              style={{
                font: `800 17px/1 ${MODOO.fonts.sans}`,
                marginTop: 6,
              }}
            >
              ₩{subtotal.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: 14,
          border: `1px solid ${MODOO.hairline}`,
        }}
      >
        <div style={{ font: `700 12px/1 ${MODOO.fonts.sans}` }}>결제수단</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginTop: 12,
          }}
        >
          {(
            [
              {
                l: "간편결제",
                s: "KAKAO·NAVER·TOSS",
                sel: true,
                i: "flame",
              },
              { l: "신용/체크카드", s: "국내 전 카드사", i: "card" },
              { l: "계좌이체", s: "실시간 이체", i: "send" },
              { l: "세금계산서", s: "법인·사업자", i: "verified" },
            ] as { l: string; s: string; sel?: boolean; i: IconName }[]
          ).map((p, i) => (
            <div
              key={i}
              style={{
                padding: 12,
                borderRadius: 10,
                border: p.sel
                  ? `1.5px solid ${brand}`
                  : `1px solid ${MODOO.hairline}`,
                background: p.sel ? brand + "08" : "#fff",
              }}
            >
              <Icon
                name={p.i}
                size={18}
                color={p.sel ? brand : MODOO.body}
              />
              <div
                style={{
                  font: `700 12px/1.2 ${MODOO.fonts.sans}`,
                  marginTop: 8,
                }}
              >
                {p.l}
              </div>
              <div
                style={{
                  font: `500 10px/1.2 ${MODOO.fonts.sans}`,
                  color: MODOO.muted,
                  marginTop: 3,
                }}
              >
                {p.s}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: 14,
          border: `1px solid ${MODOO.hairline}`,
          font: `500 12px/1.5 ${MODOO.fonts.sans}`,
          color: MODOO.muted,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              background: brand,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="check" size={14} color="#fff" />
          </div>
          <span
            style={{
              color: MODOO.body,
              font: `600 12px/1 ${MODOO.fonts.sans}`,
            }}
          >
            모두 동의 (필수·선택 포함)
          </span>
        </div>
      </div>
    </div>
    <div style={{ height: 110 }} />
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 480,
        zIndex: 30,
        padding: "12px 16px 30px",
        background: "#fff",
        borderTop: `0.5px solid ${MODOO.hairline}`,
      }}
    >
      <CTA color={brand}>₩{subtotal.toLocaleString()} 결제하기</CTA>
    </div>
  </div>
  );
};

interface Stage {
  n: string;
  t: string;
  i: IconName;
  current?: boolean;
}

interface OrderProp {
  order?: V2OrderSummary | null;
}

function buildStages(order?: V2OrderSummary | null): {
  stages: Stage[];
  currentIdx: number;
} {
  const idx = order ? getOrderStageIndex(order.orderStatus) : 2;
  const labels: { key: string; n: string; i: IconName }[] = [
    { key: "payment_pending", n: "결제대기", i: "card" },
    { key: "payment_completed", n: "결제완료", i: "card" },
    { key: "in_production", n: "제작중", i: "palette" },
    { key: "shipping", n: "배송중", i: "truck" },
    { key: "delivered", n: "배송완료", i: "check" },
  ];
  const created = order ? new Date(order.createdAt) : new Date();
  const fmt = (d: Date) =>
    `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes()
    ).padStart(2, "0")}`;
  const stages: Stage[] = labels.map((l, i) => ({
    n: l.n,
    i: l.i,
    t:
      i < idx
        ? fmt(new Date(created.getTime() + i * 24 * 3600 * 1000))
        : i === idx
          ? "진행 중"
          : `예정 ${new Date(
              created.getTime() + (i + 2) * 24 * 3600 * 1000
            ).getMonth() + 1}/${new Date(
              created.getTime() + (i + 2) * 24 * 3600 * 1000
            ).getDate()}`,
    current: i === idx,
  }));
  return { stages, currentIdx: idx };
}

const FALLBACK_STAGES: Stage[] = [
  { n: "결제대기", t: "—", i: "card" },
  { n: "결제완료", t: "—", i: "card" },
  { n: "제작중", t: "진행 중", i: "palette", current: true },
  { n: "배송중", t: "—", i: "truck" },
  { n: "배송완료", t: "—", i: "check" },
];

const TrackHeader: React.FC<{ brand: string; order?: V2OrderSummary | null }> = ({
  brand,
  order,
}) => {
  const headline = order
    ? getOrderStatusLabel(order.orderStatus)
    : "제작 진행 중";
  const idShort = order ? `#${order.id.slice(0, 8).toUpperCase()}` : "";
  return (
    <div
      style={{
        background: brand,
        color: "#fff",
        padding: "4px 16px 22px",
      }}
    >
      <AppBar
        transparent
        title={<span style={{ color: "#fff" }}>주문 현황</span>}
        left={
          <Link href="/v2/my-page" style={{ color: "#fff" }}>
            <Icon name="arrow-l" color="#fff" />
          </Link>
        }
        right={<Icon name="phone" color="#fff" size={20} />}
      />
      <div style={{ padding: "6px 4px 0" }}>
        {idShort && (
          <div
            className="num"
            style={{
              font: `500 11px/1 ${MODOO.fonts.mono}`,
              opacity: 0.7,
              letterSpacing: "0.06em",
            }}
          >
            ORDER · {idShort}
          </div>
        )}
        <div
          style={{
            font: `700 22px/1.25 ${MODOO.fonts.sans}`,
            marginTop: 8,
            letterSpacing: "-0.02em",
          }}
        >
          {order?.orderName ?? headline}
        </div>
        <div
          style={{
            font: `500 12px/1.3 ${MODOO.fonts.sans}`,
            opacity: 0.85,
            marginTop: 8,
          }}
        >
          상태 · {headline}
        </div>
      </div>
    </div>
  );
};

const TrackVertical: React.FC<{
  brand: string;
  currentIdx: number;
  stages: Stage[];
  order?: V2OrderSummary | null;
}> = ({ brand, currentIdx, stages, order }) => (
  <div
    style={{
      background: MODOO.surfaceWarm,
      minHeight: "100%",
      position: "relative",
    }}
  >
    <TrackHeader brand={brand} order={order} />
    {order && (
      <div style={{ margin: "-14px 16px 0", position: "relative", zIndex: 1 }}>
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: 14,
            boxShadow: "0 8px 22px rgba(0,0,0,0.08)",
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 12,
              background: MODOO.surfaceAlt,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {order.items[0]?.thumbnailUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={order.items[0].thumbnailUrl}
                alt={order.orderName ?? ""}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <Tee color="#0E1116" size={50} accent="#FFD25C" />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: `700 14px/1.2 ${MODOO.fonts.sans}` }}>
              {order.orderName}
            </div>
            <div
              className="num"
              style={{
                font: `500 11px/1.4 ${MODOO.fonts.sans}`,
                color: MODOO.muted,
                marginTop: 3,
              }}
            >
              총 {order.totalQuantity}장 · ₩{order.totalAmount.toLocaleString()}
            </div>
          </div>
          <Icon name="chevron-r" size={20} color={MODOO.faint} />
        </div>
      </div>
    )}
    <div style={{ padding: "24px 24px 0" }}>
      {stages.map((s, i) => {
        const past = i < currentIdx;
        const cur = i === currentIdx;
        const future = i > currentIdx;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 14,
              position: "relative",
              paddingBottom: i === stages.length - 1 ? 0 : 22,
            }}
          >
            {i < stages.length - 1 && (
              <div
                style={{
                  position: "absolute",
                  left: 17,
                  top: 36,
                  width: 2,
                  bottom: -6,
                  background: past ? brand : MODOO.hairlineSoft,
                }}
              />
            )}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                background: cur ? brand : past ? brand + "14" : "#fff",
                border: future ? `1.5px dashed ${MODOO.hairline}` : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: cur ? `0 0 0 6px ${brand}22` : "none",
                flexShrink: 0,
                animation: cur ? "modoo-pulse 1.6s ease-in-out infinite" : "none",
              }}
            >
              <Icon
                name={cur ? s.i : past ? "check" : s.i}
                size={cur ? 18 : 16}
                color={cur ? "#fff" : past ? brand : MODOO.faint}
                strokeWidth={cur ? 2.2 : 1.7}
              />
            </div>
            <div style={{ flex: 1, paddingTop: 6 }}>
              <div
                style={{
                  font: `${cur ? 800 : 600} 14px/1.2 ${MODOO.fonts.sans}`,
                  color: cur ? brand : future ? MODOO.faint : MODOO.body,
                  letterSpacing: "-0.01em",
                }}
              >
                {s.n}
              </div>
              <div
                className="num"
                style={{
                  font: `500 12px/1.3 ${MODOO.fonts.sans}`,
                  color: future ? MODOO.faint : MODOO.muted,
                  marginTop: 4,
                }}
              >
                {s.t}
              </div>
              {cur && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 12,
                    borderRadius: 12,
                    background: brand + "0a",
                    border: `1px solid ${brand}22`,
                  }}
                >
                  <div
                    style={{
                      font: `600 12px/1.4 ${MODOO.fonts.sans}`,
                      color: MODOO.body,
                    }}
                  >
                    오늘 14:30, 검수팀이 인쇄판 4도를 정렬했어요. 진행률 60%.
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      height: 5,
                      borderRadius: 5,
                      background: "#fff",
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        width: "60%",
                        height: "100%",
                        background: brand,
                        borderRadius: 5,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
    <div style={{ height: 110 }} />
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 480,
        zIndex: 30,
        padding: "12px 16px 30px",
        background: "#fff",
        borderTop: `0.5px solid ${MODOO.hairline}`,
        display: "flex",
        gap: 8,
      }}
    >
      <button
        style={{
          flex: 1,
          height: 50,
          borderRadius: 12,
          background: "#fff",
          border: `1.5px solid ${MODOO.hairline}`,
          font: `700 14px/1 ${MODOO.fonts.sans}`,
        }}
      >
        도안 다시보기
      </button>
      <button
        style={{
          flex: 1.4,
          height: 50,
          borderRadius: 12,
          background: brand,
          color: "#fff",
          font: `700 14px/1 ${MODOO.fonts.sans}`,
          boxShadow: `0 6px 16px ${brand}40`,
        }}
      >
        실시간 작업영상 보기
      </button>
    </div>
  </div>
);

const TrackHorizontal: React.FC<{
  brand: string;
  currentIdx: number;
  stages: Stage[];
  order?: V2OrderSummary | null;
}> = ({ brand, currentIdx, stages, order }) => (
  <div style={{ background: "#fff", minHeight: "100%", position: "relative" }}>
    <AppBar
      title={order?.orderName ?? "주문 현황"}
      left={
        <Link href="/v2/my-page" style={{ color: "inherit" }}>
          <Icon name="arrow-l" />
        </Link>
      }
      right={<Icon name="phone" size={20} />}
    />
    <div
      style={{
        margin: "12px 16px 0",
        borderRadius: 22,
        background: `linear-gradient(150deg, ${brand} 0%, ${MODOO.brandDeep} 100%)`,
        color: "#fff",
        padding: 20,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          font: `500 11px/1 ${MODOO.fonts.mono}`,
          opacity: 0.8,
          letterSpacing: "0.06em",
        }}
      >
        NOW
      </div>
      <div
        style={{
          font: `800 24px/1.25 ${MODOO.fonts.sans}`,
          marginTop: 8,
          letterSpacing: "-0.02em",
        }}
      >
        잉크가 마르는 중!
      </div>
      <div
        style={{
          font: `500 12px/1.4 ${MODOO.fonts.sans}`,
          opacity: 0.85,
          marginTop: 6,
          maxWidth: 220,
        }}
      >
        실크 4색 인쇄가 끝났고, 건조 후 검수만 남았어요.
      </div>
      <div
        style={{
          position: "absolute",
          right: -10,
          bottom: -16,
          animation: "modoo-bob 2.4s ease-in-out infinite",
        }}
      >
        <Tee color="#fff" size={150} accent={MODOO.yolk} />
      </div>
      <div
        style={{
          marginTop: 18,
          height: 6,
          borderRadius: 6,
          background: "rgba(255,255,255,0.2)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: "60%",
            height: "100%",
            background: "#fff",
            borderRadius: 6,
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 8,
          font: `600 11px/1 ${MODOO.fonts.mono}`,
          opacity: 0.85,
        }}
      >
        <span>60%</span>
        <span>D-9</span>
      </div>
    </div>
    <div style={{ padding: "24px 0 0" }}>
      <div
        style={{ overflowX: "auto", paddingLeft: 16, paddingRight: 16 }}
      >
        <div style={{ display: "flex", gap: 0, minWidth: "min-content" }}>
          {stages.map((s, i) => {
            const past = i < currentIdx;
            const cur = i === currentIdx;
            return (
              <div key={i} style={{ minWidth: 110, position: "relative" }}>
                {i < stages.length - 1 && (
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      right: "-50%",
                      top: 17,
                      height: 2,
                      background: past ? brand : MODOO.hairlineSoft,
                    }}
                  />
                )}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      background: cur
                        ? brand
                        : past
                          ? brand + "14"
                          : "#fff",
                      border:
                        !past && !cur
                          ? `1.5px dashed ${MODOO.hairline}`
                          : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: cur ? `0 0 0 6px ${brand}22` : "none",
                    }}
                  >
                    <Icon
                      name={past ? "check" : s.i}
                      size={16}
                      color={cur ? "#fff" : past ? brand : MODOO.faint}
                    />
                  </div>
                  <div
                    style={{
                      font: `${cur ? 700 : 600} 11px/1.2 ${MODOO.fonts.sans}`,
                      textAlign: "center",
                      color: cur ? brand : past ? MODOO.body : MODOO.faint,
                    }}
                  >
                    {s.n}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    <div style={{ padding: "24px 16px 0" }}>
      <div
        style={{
          font: `700 13px/1 ${MODOO.fonts.sans}`,
          marginBottom: 10,
        }}
      >
        실시간 업데이트
      </div>
      {[
        { t: "14:32", l: "4도(검·노·청·적) 인쇄 완료", new: true },
        { t: "12:10", l: "인쇄판 정렬·테스트 출력" },
        { t: "09:30", l: "도안 최종 승인 완료" },
        { t: "6/4", l: "결제 확인 · 작업 큐 진입" },
      ].map((u, i) => (
        <div
          key={i}
          style={{
            padding: "10px 0",
            borderBottom: i < 3 ? `1px solid ${MODOO.hairlineSoft}` : "none",
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div
            className="num"
            style={{
              font: `600 11px/1 ${MODOO.fonts.mono}`,
              color: MODOO.faint,
              width: 38,
            }}
          >
            {u.t}
          </div>
          <div
            style={{
              flex: 1,
              font: `${u.new ? 700 : 500} 13px/1.4 ${MODOO.fonts.sans}`,
            }}
          >
            {u.l}
          </div>
          {u.new && (
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background: MODOO.err,
              }}
            />
          )}
        </div>
      ))}
    </div>
    <div style={{ height: 30 }} />
  </div>
);

const TrackMap: React.FC<{
  brand: string;
  stages: Stage[];
  order?: V2OrderSummary | null;
}> = ({ brand, stages, order }) => (
  <div
    style={{
      background: "#0E1116",
      minHeight: "100%",
      position: "relative",
      color: "#fff",
    }}
  >
    <AppBar
      transparent
      title={
        <span style={{ color: "#fff" }}>
          {order?.orderName ?? "배송 추적"}
        </span>
      }
      left={
        <Link href="/v2/my-page" style={{ color: "#fff" }}>
          <Icon name="arrow-l" color="#fff" />
        </Link>
      }
      right={<Icon name="share" color="#fff" size={20} />}
    />
    <div
      style={{
        margin: "4px 12px 0",
        height: 320,
        borderRadius: 18,
        overflow: "hidden",
        background: "#1A1F28",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 320 320"
        style={{ position: "absolute", inset: 0 }}
      >
        <path
          d="M-10 220 Q 80 200 120 230 T 230 180 L 340 130"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="14"
          fill="none"
        />
        <path
          d="M-10 220 Q 80 200 120 230 T 230 180 L 340 130"
          stroke={brand}
          strokeWidth="3"
          strokeDasharray="6 8"
          fill="none"
        />
        <circle cx="60" cy="208" r="6" fill={brand} />
        <circle cx="245" cy="170" r="6" fill="#fff" stroke={brand} strokeWidth="2" />
      </svg>
      <div
        style={{
          position: "absolute",
          left: "40%",
          top: "60%",
          transform: "translate(-50%,-100%)",
        }}
      >
        <div
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            background: brand,
            display: "flex",
            alignItems: "center",
            gap: 6,
            boxShadow: `0 8px 22px ${brand}66`,
            font: `700 11px/1 ${MODOO.fonts.sans}`,
          }}
        >
          <Icon name="truck" size={14} color="#fff" />
          14km · 23분
        </div>
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            background: brand,
            margin: "4px auto 0",
            boxShadow: `0 0 0 6px ${brand}33`,
            animation: "modoo-pulse 1.6s infinite",
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 40,
          bottom: 80,
          font: `600 10px/1.3 ${MODOO.fonts.mono}`,
          color: "rgba(255,255,255,0.6)",
        }}
      >
        MODOO 가산공장
      </div>
      <div
        style={{
          position: "absolute",
          right: 40,
          top: 92,
          font: `600 10px/1.3 ${MODOO.fonts.mono}`,
          color: "#fff",
          textAlign: "right",
        }}
      >
        한양대학교
        <br />
        학생회관
      </div>
    </div>
    <div
      style={{
        margin: "14px 12px 0",
        borderRadius: 18,
        padding: 16,
        background: "#1A1F28",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            background: "rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="user" size={22} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ font: `700 14px/1.2 ${MODOO.fonts.sans}` }}>
            이상호 기사님 · CJ 41차
          </div>
          <div
            style={{
              font: `500 11px/1.3 ${MODOO.fonts.sans}`,
              color: "rgba(255,255,255,0.6)",
              marginTop: 3,
            }}
          >
            오늘의 13번째 배송 · 평점 4.94
          </div>
        </div>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            background: brand,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 4px 12px ${brand}66`,
          }}
        >
          <Icon name="phone" size={18} color="#fff" />
        </div>
      </div>
      <div
        style={{
          marginTop: 14,
          padding: "12px 0 0",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div
            style={{
              font: `500 11px/1 ${MODOO.fonts.sans}`,
              color: "rgba(255,255,255,0.55)",
            }}
          >
            도착 예정
          </div>
          <div
            className="num"
            style={{
              font: `800 22px/1.1 ${MODOO.fonts.sans}`,
              marginTop: 4,
              letterSpacing: "-0.02em",
            }}
          >
            17:42
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              font: `500 11px/1 ${MODOO.fonts.sans}`,
              color: "rgba(255,255,255,0.55)",
            }}
          >
            현재 위치
          </div>
          <div
            style={{
              font: `700 13px/1.1 ${MODOO.fonts.sans}`,
              marginTop: 6,
            }}
          >
            성수대교 남단
          </div>
        </div>
      </div>
    </div>
    <div style={{ padding: "14px 16px 0", display: "flex", gap: 8 }}>
      {stages.slice(2).map((s, i) => {
        const realIdx = i + 2;
        const cur = realIdx === 4;
        const past = realIdx < 4;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              padding: "10px 8px",
              borderRadius: 10,
              background: cur ? brand : "rgba(255,255,255,0.06)",
              border: cur ? "none" : "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <Icon
              name={past ? "check" : s.i}
              size={16}
              color={cur ? "#fff" : past ? brand : "rgba(255,255,255,0.6)"}
            />
            <div
              style={{
                font: `${cur ? 700 : 600} 11px/1.2 ${MODOO.fonts.sans}`,
                color: cur ? "#fff" : "rgba(255,255,255,0.85)",
                marginTop: 8,
              }}
            >
              {s.n}
            </div>
          </div>
        );
      })}
    </div>
    <div style={{ height: 30 }} />
  </div>
);

export const Tracking: React.FC<
  BrandProp &
    OrderProp & { style?: "vertical" | "horizontal" | "map" }
> = ({ brand = MODOO.brand, style = "vertical", order }) => {
  const { stages, currentIdx } = order
    ? buildStages(order)
    : { stages: FALLBACK_STAGES, currentIdx: 2 };
  if (style === "horizontal")
    return (
      <TrackHorizontal
        brand={brand}
        currentIdx={currentIdx}
        stages={stages}
        order={order}
      />
    );
  if (style === "map")
    return <TrackMap brand={brand} stages={stages} order={order} />;
  return (
    <TrackVertical
      brand={brand}
      currentIdx={currentIdx}
      stages={stages}
      order={order}
    />
  );
};
