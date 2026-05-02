"use client";

import * as React from "react";
import Link from "next/link";
import {
  MODOO,
  Icon,
  Tee,
  TabBar,
  AppBar,
  Chip,
  Placeholder,
  IconName,
} from "../tokens";
import type {
  V2OrderSummary,
  V2UserProfile,
  V2UserStats,
  V2SavedDesign,
} from "../../_lib/types";

interface BrandProp {
  brand?: string;
}

interface OrderSuccessProps extends BrandProp {
  order?: V2OrderSummary | null;
}

function shortId(id: string | undefined) {
  if (!id) return "";
  return `#${id.slice(0, 4).toUpperCase()}-${id.slice(4, 8).toUpperCase()}-${id.slice(8, 12).toUpperCase()}`;
}

export const OrderSuccess: React.FC<OrderSuccessProps> = ({
  brand = MODOO.brand,
  order,
}) => (
  <div style={{ background: "#fff", minHeight: "100%", position: "relative" }}>
    <AppBar transparent left={null} right={<Icon name="close" />} title="" />
    <div style={{ padding: "20px 24px 0", textAlign: "center" }}>
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          background: brand + "14",
          margin: "12px auto 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: -10,
            borderRadius: "50%",
            border: `2px solid ${brand}`,
            opacity: 0.3,
            animation: "modoo-pulse 1.6s infinite",
          }}
        />
        <Icon name="check" size={36} color={brand} strokeWidth={2.4} />
      </div>
      <div
        style={{
          font: `800 24px/1.25 ${MODOO.fonts.sans}`,
          marginTop: 22,
          letterSpacing: "-0.02em",
        }}
      >
        주문이 들어갔어요
      </div>
      <div
        style={{
          font: `500 13px/1.5 ${MODOO.fonts.sans}`,
          color: MODOO.muted,
          marginTop: 8,
        }}
      >
        전문가가 도안을 검수하면 알림으로
        <br />
        알려드릴게요. 평균 4시간 이내.
      </div>
    </div>
    <div
      style={{
        margin: "24px 16px 0",
        padding: 18,
        borderRadius: 18,
        background: MODOO.surfaceAlt,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span
          className="num"
          style={{
            font: `600 11px/1 ${MODOO.fonts.mono}`,
            color: MODOO.muted,
            letterSpacing: "0.04em",
          }}
        >
          {shortId(order?.id)}
        </span>
        <span
          style={{ font: `700 11px/1 ${MODOO.fonts.sans}`, color: brand }}
        >
          결제 완료
        </span>
      </div>
      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 14,
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: 10,
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {order?.items[0]?.thumbnailUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={order.items[0].thumbnailUrl}
              alt={order.orderName ?? ""}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Tee color="#0E1116" size={44} accent="#FFD25C" />
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ font: `700 13px/1.2 ${MODOO.fonts.sans}` }}>
            {order?.orderName ?? "주문 내역"}
          </div>
          <div
            className="num"
            style={{
              font: `500 11px/1.4 ${MODOO.fonts.sans}`,
              color: MODOO.muted,
              marginTop: 4,
            }}
          >
            {order
              ? `총 ${order.totalQuantity}장 · ₩${order.totalAmount.toLocaleString()}`
              : "—"}
          </div>
        </div>
      </div>
      {order?.shippingAddress && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: `1px solid ${MODOO.hairlineSoft}`,
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span
            style={{
              font: `500 12px/1 ${MODOO.fonts.sans}`,
              color: MODOO.muted,
              flexShrink: 0,
            }}
          >
            받는 곳
          </span>
          <span
            style={{
              font: `700 12px/1.4 ${MODOO.fonts.sans}`,
              textAlign: "right",
            }}
          >
            {order.customerName} · {order.shippingAddress}
          </span>
        </div>
      )}
    </div>
    <div
      style={{
        margin: "14px 16px 0",
        padding: 16,
        borderRadius: 18,
        background: brand,
        color: "#fff",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ font: `700 14px/1.3 ${MODOO.fonts.sans}` }}>
        친구에게 입금 링크 보내기
      </div>
      <div
        style={{
          font: `500 11px/1.4 ${MODOO.fonts.sans}`,
          marginTop: 6,
          opacity: 0.85,
          maxWidth: 220,
        }}
      >
        단체 비용 정산도 모두에서. 카톡 한 번이면 끝.
      </div>
      <div
        style={{
          marginTop: 12,
          padding: "8px 14px",
          display: "inline-flex",
          gap: 6,
          alignItems: "center",
          background: "#fff",
          color: brand,
          borderRadius: 999,
          font: `700 12px/1 ${MODOO.fonts.sans}`,
        }}
      >
        공유하기 <Icon name="arrow-up-r" size={14} color={brand} />
      </div>
      <div
        style={{
          position: "absolute",
          right: 8,
          top: 8,
          width: 70,
          height: 70,
          borderRadius: 14,
          background: "rgba(255,255,255,0.16)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="qr" size={32} color="#fff" />
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
        display: "flex",
        gap: 8,
      }}
    >
      <Link
        href="/v2"
        style={{
          flex: 1,
          height: 50,
          borderRadius: 12,
          background: "#fff",
          border: `1.5px solid ${MODOO.hairline}`,
          font: `700 14px/1 ${MODOO.fonts.sans}`,
          color: MODOO.ink,
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        홈으로
      </Link>
      <Link
        href={order ? `/v2/order/${order.id}` : "/v2"}
        style={{
          flex: 1.4,
          height: 50,
          borderRadius: 12,
          background: brand,
          color: "#fff",
          font: `700 14px/1 ${MODOO.fonts.sans}`,
          boxShadow: `0 6px 16px ${brand}40`,
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        제작 현황 보기
      </Link>
    </div>
  </div>
);

interface MyPageProps extends BrandProp {
  user?: V2UserProfile | null;
  stats?: V2UserStats;
  inProgressOrders?: V2OrderSummary[];
  designs?: V2SavedDesign[];
}

export const MyPage: React.FC<MyPageProps> = ({
  brand = MODOO.brand,
  user,
  stats = { orders: 0, designs: 0, coupons: 0, reviews: 0 },
  inProgressOrders = [],
  designs = [],
}) => (
  <div
    style={{
      background: MODOO.surfaceWarm,
      minHeight: "100%",
      position: "relative",
    }}
  >
    <AppBar title="MY" left={null} right={<Icon name="bell" />} />
    <div style={{ padding: "4px 16px 0" }}>
      <div
        style={{
          background: "#fff",
          borderRadius: 18,
          padding: 16,
          border: `1px solid ${MODOO.hairline}`,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            background: brand + "14",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: `800 18px/1 ${MODOO.fonts.sans}`,
            color: brand,
          }}
        >
          {user?.initials || "GU"}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ font: `700 15px/1.2 ${MODOO.fonts.sans}` }}>
            {user?.name ?? "게스트"}
          </div>
          <div
            style={{
              font: `500 12px/1.4 ${MODOO.fonts.sans}`,
              color: MODOO.muted,
              marginTop: 4,
            }}
          >
            {user?.email ?? "로그인하고 모든 기능을 사용해보세요"}
          </div>
        </div>
        {user?.role === "admin" && (
          <div
            style={{
              padding: "5px 10px",
              borderRadius: 999,
              background: brand + "14",
              font: `700 11px/1.2 ${MODOO.fonts.sans}`,
              color: brand,
            }}
          >
            ADMIN
          </div>
        )}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          marginTop: 10,
        }}
      >
        {[
          { n: String(stats.designs), l: "내 디자인" },
          { n: String(stats.orders), l: "주문" },
          { n: String(stats.coupons), l: "쿠폰" },
        ].map((s, i) => (
          <div
            key={i}
            style={{
              background: "#fff",
              border: `1px solid ${MODOO.hairline}`,
              borderRadius: 12,
              padding: "12px 0",
              textAlign: "center",
            }}
          >
            <div
              className="num"
              style={{
                font: `800 18px/1 ${MODOO.fonts.sans}`,
                letterSpacing: "-0.02em",
              }}
            >
              {s.n}
            </div>
            <div
              style={{
                font: `500 11px/1 ${MODOO.fonts.sans}`,
                color: MODOO.muted,
                marginTop: 4,
              }}
            >
              {s.l}
            </div>
          </div>
        ))}
      </div>
    </div>
    <div style={{ padding: "20px 16px 0" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span style={{ font: `700 14px/1 ${MODOO.fonts.sans}` }}>
          진행중인 주문
        </span>
        <span
          style={{ font: `600 12px/1 ${MODOO.fonts.sans}`, color: brand }}
        >
          전체 {stats.orders}건
        </span>
      </div>
      {inProgressOrders.length === 0 && (
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            padding: "20px 14px",
            border: `1px solid ${MODOO.hairline}`,
            font: `500 12px/1.5 ${MODOO.fonts.sans}`,
            color: MODOO.muted,
            textAlign: "center",
          }}
        >
          진행중인 주문이 없어요
        </div>
      )}
      {inProgressOrders.map((o) => {
        const stageLabel = (() => {
          switch (o.orderStatus) {
            case "payment_pending":
              return { label: "결제대기", p: 0.1, c: MODOO.warn };
            case "payment_completed":
              return { label: "결제완료", p: 0.25, c: brand };
            case "in_production":
              return { label: "제작중", p: 0.6, c: brand };
            case "shipping":
              return { label: "배송중", p: 0.85, c: MODOO.warn };
            default:
              return { label: o.orderStatus, p: 0.5, c: brand };
          }
        })();
        return (
          <Link
            key={o.id}
            href={`/v2/order/${o.id}`}
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: 14,
              border: `1px solid ${MODOO.hairline}`,
              marginBottom: 8,
              display: "flex",
              gap: 12,
              alignItems: "center",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 10,
                background: MODOO.surfaceAlt,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {o.items[0]?.thumbnailUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={o.items[0].thumbnailUrl}
                  alt={o.orderName ?? ""}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <Tee color="#0E1116" size={40} lining={false} accent="#FFD25C" />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  font: `700 13px/1.2 ${MODOO.fonts.sans}`,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {o.orderName}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 6,
                }}
              >
                <span
                  style={{
                    font: `700 11px/1 ${MODOO.fonts.sans}`,
                    color: stageLabel.c,
                  }}
                >
                  {stageLabel.label}
                </span>
                <span
                  style={{
                    flex: 1,
                    height: 3,
                    borderRadius: 3,
                    background: MODOO.hairlineSoft,
                    position: "relative",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: `${stageLabel.p * 100}%`,
                      background: stageLabel.c,
                      borderRadius: 3,
                    }}
                  />
                </span>
              </div>
            </div>
            <Icon name="chevron-r" size={18} color={MODOO.faint} />
          </Link>
        );
      })}
    </div>
    <div style={{ padding: "20px 16px 0" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span style={{ font: `700 14px/1 ${MODOO.fonts.sans}` }}>
          내 디자인 보관함
        </span>
        <span
          style={{ font: `600 12px/1 ${MODOO.fonts.sans}`, color: brand }}
        >
          + 새로만들기
        </span>
      </div>
      <div
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          paddingBottom: 4,
        }}
      >
        {designs.length === 0 && (
          <div
            style={{
              padding: "30px 16px",
              font: `500 12px/1.4 ${MODOO.fonts.sans}`,
              color: MODOO.muted,
            }}
          >
            보관된 디자인이 없어요
          </div>
        )}
        {designs.map((d) => {
          const dt = new Date(d.updatedAt);
          const days = Math.max(
            0,
            Math.floor((Date.now() - dt.getTime()) / (24 * 3600 * 1000))
          );
          return (
            <Link
              key={d.id}
              href={`/v2/editor/${d.productId}`}
              style={{
                minWidth: 130,
                height: 160,
                borderRadius: 14,
                padding: 10,
                background: "#fff",
                border: `1px solid ${MODOO.hairline}`,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div
                style={{
                  flex: 1,
                  background: MODOO.surfaceAlt,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {d.preview ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={d.preview}
                    alt={d.title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <Tee color={brand} size={88} accent="#FFD25C" />
                )}
              </div>
              <div
                style={{
                  font: `700 12px/1.2 ${MODOO.fonts.sans}`,
                  marginTop: 8,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {d.title}
              </div>
              <div
                style={{
                  font: `500 10px/1 ${MODOO.fonts.sans}`,
                  color: MODOO.muted,
                  marginTop: 2,
                }}
              >
                {days === 0 ? "오늘" : `${days}일 전`}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
    <div style={{ padding: "20px 16px 0" }}>
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          border: `1px solid ${MODOO.hairline}`,
        }}
      >
        {(
          [
            { i: "tag", l: "쿠폰함", s: `${stats.coupons}장`, href: "/home/my-page/coupons" },
            { i: "gift", l: "친구 초대", s: "1명당 ₩5,000", href: "/home/my-page" },
            { i: "card", l: "결제 수단·세금계산서", href: "/home/my-page" },
            { i: "phone", l: "1:1 문의", href: "/inquiries" },
          ] as { i: IconName; l: string; s?: string; href: string }[]
        ).map((r, i, arr) => (
          <Link
            key={i}
            href={r.href}
            style={{
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              borderBottom:
                i < arr.length - 1
                  ? `1px solid ${MODOO.hairlineSoft}`
                  : "none",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <Icon name={r.i} size={20} color={MODOO.body} />
            <div
              style={{
                flex: 1,
                font: `600 13px/1.2 ${MODOO.fonts.sans}`,
              }}
            >
              {r.l}
            </div>
            {r.s && (
              <div
                style={{
                  font: `600 12px/1 ${MODOO.fonts.sans}`,
                  color: MODOO.muted,
                }}
              >
                {r.s}
              </div>
            )}
            <Icon name="chevron-r" size={16} color={MODOO.faint} />
          </Link>
        ))}
      </div>
    </div>
    <div style={{ height: 110 }} />
    <TabBar active="me" brand={brand} />
  </div>
);

interface ReviewPromptProps extends BrandProp {
  product?: {
    id: string;
    title: string;
    thumbnail: string | null;
  } | null;
  orderId?: string | null;
}

export const ReviewPrompt: React.FC<ReviewPromptProps> = ({
  brand = MODOO.brand,
  product,
  orderId,
}) => {
  const [stars, setStars] = React.useState(5);
  const [content, setContent] = React.useState("");
  const [tags, setTags] = React.useState<Set<number>>(new Set([0, 1, 3, 5]));
  const toggle = (i: number) => {
    setTags((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };
  return (
    <div
      style={{ background: "#fff", minHeight: "100%", position: "relative" }}
    >
      <AppBar
        title="리뷰 작성"
        left={<Icon name="close" />}
        right={
          <span
            style={{
              font: `600 12px/1 ${MODOO.fonts.sans}`,
              color: MODOO.muted,
            }}
          >
            임시저장
          </span>
        }
      />
      <div style={{ padding: "8px 20px 0" }}>
        <div
          style={{
            padding: 16,
            background: brand + "08",
            borderRadius: 16,
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {product?.thumbnail ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={product.thumbnail}
                alt={product.title}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <Tee color="#0E1116" size={44} accent="#FFD25C" />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ font: `700 14px/1.2 ${MODOO.fonts.sans}` }}>
              {product?.title ?? "잘 받으셨나요?"}
            </div>
            <div
              style={{
                font: `500 12px/1.4 ${MODOO.fonts.sans}`,
                color: MODOO.muted,
                marginTop: 4,
              }}
            >
              사진 리뷰 작성하면 ₩3,000 적립금
            </div>
          </div>
        </div>
      </div>
      <div style={{ padding: "24px 20px 0", textAlign: "center" }}>
        <div style={{ font: `700 16px/1.3 ${MODOO.fonts.sans}` }}>
          이번 단체티는
          <br />
          몇 점이세요?
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 6,
            marginTop: 18,
          }}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              onClick={() => setStars(i)}
              style={{
                padding: 4,
                transform: i <= stars ? "scale(1.1)" : "scale(1)",
                transition: "transform .15s",
              }}
            >
              <Icon
                name="star-fill"
                size={36}
                color={i <= stars ? MODOO.yolk : MODOO.hairline}
              />
            </button>
          ))}
        </div>
        <div
          style={{
            font: `700 14px/1 ${MODOO.fonts.sans}`,
            color: brand,
            marginTop: 14,
          }}
        >
          {["", "아쉬워요", "그저그래요", "괜찮아요", "좋아요!", "완벽해요!"][
            stars
          ]}
        </div>
      </div>
      <div style={{ padding: "24px 20px 0" }}>
        <div style={{ font: `700 13px/1 ${MODOO.fonts.sans}` }}>
          마음에 든 점은?
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 12,
            flexWrap: "wrap",
          }}
        >
          {[
            "핏이 예뻐요",
            "인쇄 선명해요",
            "원단 좋아요",
            "빠른배송",
            "포장 깔끔",
            "실물이 더 예뻐요",
            "단체로 만족",
          ].map((c, i) => (
            <Chip
              key={c}
              active={tags.has(i)}
              color={brand}
              onClick={() => toggle(i)}
            >
              {c}
            </Chip>
          ))}
        </div>
      </div>
      <div style={{ padding: "24px 20px 0" }}>
        <div style={{ font: `700 13px/1 ${MODOO.fonts.sans}` }}>
          사진 (선택)
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 12,
            overflowX: "auto",
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 10,
              border: `1.5px dashed ${MODOO.hairline}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              color: MODOO.muted,
              flexShrink: 0,
            }}
          >
            <Icon name="image" size={20} color={MODOO.muted} />
            <span
              className="num"
              style={{ font: `600 10px/1 ${MODOO.fonts.mono}` }}
            >
              0/5
            </span>
          </div>
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                width: 80,
                height: 80,
                borderRadius: 10,
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              <Placeholder label="photo" tone={i ? "cool" : "warm"} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: "20px 20px 0" }}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="단체로 입었을 때 어땠나요? (선택)"
          style={{
            width: "100%",
            background: MODOO.surfaceAlt,
            borderRadius: 12,
            padding: 14,
            font: `500 13px/1.5 ${MODOO.fonts.sans}`,
            color: MODOO.body,
            minHeight: 88,
            border: "none",
            outline: "none",
            resize: "vertical",
          }}
        />
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
        <button
          style={{
            width: "100%",
            minHeight: 52,
            borderRadius: 14,
            background: brand,
            color: "#fff",
            font: `700 16px/1.2 ${MODOO.fonts.sans}`,
            boxShadow: `0 6px 16px ${brand}33`,
          }}
        >
          리뷰 등록 · ₩3,000 받기
        </button>
      </div>
    </div>
  );
};
