"use client";

import * as React from "react";
import Link from "next/link";
import {
  MODOO,
  Icon,
  Tee,
  TabBar,
  AppBar,
  CTA,
  ModooLogo,
  Placeholder,
  IconName,
} from "../tokens";
import type {
  V2UserProfile,
  V2OrderSummary,
  V2Category,
  V2CatalogProduct,
} from "../../_lib/types";
import { getOrderStageIndex, getOrderStatusLabel } from "../../_lib/types";

interface BrandProp {
  brand?: string;
}

interface HomeFriendlyProps extends BrandProp {
  user?: V2UserProfile | null;
  ongoingOrder?: V2OrderSummary | null;
  categories?: V2Category[];
  featuredProducts?: V2CatalogProduct[];
}

const CATEGORY_TINTS = ["#FFE4B5", "#DCE7FA", "#FFD8DD", "#D7F5DD", "#E8E1FA", "#F0E5DC"];

export const HomeFriendly: React.FC<HomeFriendlyProps> = ({
  brand = MODOO.brand,
  user,
  ongoingOrder,
  categories = [],
  featuredProducts = [],
}) => {
  const greetingName = user?.name ?? "고객";
  const orderStage = ongoingOrder ? getOrderStageIndex(ongoingOrder.orderStatus) : 0;
  const orderProgress = ongoingOrder ? Math.min(orderStage / 4, 1) : 0;
  const orderLabel = ongoingOrder
    ? getOrderStatusLabel(ongoingOrder.orderStatus)
    : null;
  return (
    <div
      style={{
        background: "#FFF9EE",
        minHeight: "100%",
        position: "relative",
      }}
    >
      <AppBar
        transparent
        title={<ModooLogo />}
        right={<Icon name="bell" />}
        left={<Icon name="menu" />}
      />
      <div style={{ padding: "8px 20px 0" }}>
        <div
          style={{
            font: `500 13px/1.3 ${MODOO.fonts.sans}`,
            color: MODOO.muted,
          }}
        >
          안녕하세요, {greetingName}님 👋
        </div>
        <div
          style={{
            font: `800 26px/1.2 ${MODOO.fonts.sans}`,
            marginTop: 6,
            letterSpacing: "-0.025em",
          }}
        >
          오늘은 어떤 단체복을
          <br />
          만들어볼까요?
        </div>
      </div>
      <div style={{ margin: "18px 16px 0", position: "relative" }}>
        <div
          style={{
            borderRadius: 24,
            background: brand,
            color: "#fff",
            padding: "20px 18px",
            position: "relative",
            overflow: "hidden",
            boxShadow: `0 12px 28px ${brand}40`,
          }}
        >
          <div
            style={{
              font: `600 11px/1 ${MODOO.fonts.mono}`,
              opacity: 0.75,
              letterSpacing: "0.08em",
            }}
          >
            FIRST-ORDER · 신규 가입
          </div>
          <div
            style={{
              font: `800 22px/1.2 ${MODOO.fonts.sans}`,
              marginTop: 10,
              letterSpacing: "-0.02em",
            }}
          >
            첫 주문 30% 할인
            <br />
            오늘만 무료 디자인 첨삭
          </div>
          <div
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              gap: 6,
              font: `600 13px/1 ${MODOO.fonts.sans}`,
            }}
          >
            지금 시작하기 <Icon name="arrow-r" size={16} />
          </div>
          <div
            style={{
              position: "absolute",
              right: -30,
              bottom: -40,
              width: 160,
              height: 160,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.12)",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 12,
              top: 18,
              width: 60,
              height: 60,
              borderRadius: 16,
              background: "rgba(255,255,255,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: "rotate(-8deg)",
            }}
          >
            <Tee color="#fff" size={48} accent={null} lining={false} />
          </div>
        </div>
      </div>
      <div style={{ marginTop: 22, padding: "0 16px" }}>
        <div
          style={{
            font: `700 15px/1 ${MODOO.fonts.sans}`,
            marginBottom: 12,
          }}
        >
          1분 컷, 빠른 시작
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          {(
            [
              { t: "AI로 디자인", s: "문구만 써도 끝", i: "sparkle", c: brand },
              {
                t: "템플릿 둘러보기",
                s: "동아리 200+",
                i: "grid",
                c: "#1F242C",
              },
              {
                t: "내 로고 올리기",
                s: "PNG·SVG·AI",
                i: "image",
                c: MODOO.pink,
              },
              { t: "견적 받기", s: "20장부터", i: "tag", c: MODOO.pos },
            ] as { t: string; s: string; i: IconName; c: string }[]
          ).map((it, i) => (
            <div
              key={i}
              style={{
                background: "#fff",
                borderRadius: 18,
                padding: 14,
                border: `1px solid ${MODOO.hairline}`,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: it.c + "15",
                  color: it.c,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={it.i} size={20} color={it.c} />
              </div>
              <div
                style={{
                  font: `700 14px/1.2 ${MODOO.fonts.sans}`,
                  marginTop: 12,
                }}
              >
                {it.t}
              </div>
              <div
                style={{
                  font: `500 11px/1.2 ${MODOO.fonts.sans}`,
                  color: MODOO.muted,
                  marginTop: 3,
                }}
              >
                {it.s}
              </div>
            </div>
          ))}
        </div>
      </div>
      {ongoingOrder && (
        <div style={{ margin: "20px 16px 0" }}>
          <Link
            href={`/v2/order/${ongoingOrder.id}`}
            style={{
              borderRadius: 18,
              background: "#fff",
              border: `1px solid ${MODOO.hairline}`,
              padding: 14,
              display: "flex",
              gap: 12,
              alignItems: "center",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                background: brand + "14",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "modoo-truck 1.4s ease-in-out infinite",
              }}
            >
              <Icon name="truck" size={26} color={brand} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  font: `600 11px/1 ${MODOO.fonts.mono}`,
                  color: brand,
                  letterSpacing: "0.04em",
                }}
              >
                {orderLabel} · {Math.round(orderProgress * 100)}%
              </div>
              <div
                style={{
                  font: `700 14px/1.2 ${MODOO.fonts.sans}`,
                  marginTop: 4,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {ongoingOrder.orderName ?? "주문 진행중"}
              </div>
              <div
                style={{
                  marginTop: 8,
                  height: 4,
                  borderRadius: 4,
                  background: MODOO.hairlineSoft,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: `${orderProgress * 100}%`,
                    background: brand,
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>
            <Icon name="chevron-r" size={20} color={MODOO.faint} />
          </Link>
        </div>
      )}
      {featuredProducts.length > 0 && (
        <div style={{ marginTop: 24, padding: "0 16px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 12,
            }}
          >
            <div style={{ font: `700 15px/1 ${MODOO.fonts.sans}` }}>
              추천 상품
            </div>
            <Link
              href="/v2/mall"
              style={{
                font: `600 12px/1 ${MODOO.fonts.sans}`,
                color: MODOO.muted,
                textDecoration: "none",
              }}
            >
              전체보기
            </Link>
          </div>
          <div
            style={{
              display: "flex",
              gap: 10,
              overflowX: "auto",
              paddingBottom: 4,
            }}
          >
            {featuredProducts.slice(0, 6).map((p) => (
              <Link
                key={p.id}
                href={`/v2/product/${p.id}`}
                style={{
                  minWidth: 140,
                  flexShrink: 0,
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div
                  style={{
                    width: 140,
                    height: 140,
                    borderRadius: 14,
                    overflow: "hidden",
                    background: MODOO.surfaceWarm,
                    border: `1px solid ${MODOO.hairlineSoft}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {p.thumbnail ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.thumbnail}
                      alt={p.title}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <Tee color={brand} size={110} />
                  )}
                </div>
                <div
                  style={{
                    font: `600 12px/1.3 ${MODOO.fonts.sans}`,
                    marginTop: 8,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {p.title}
                </div>
                <div
                  className="num"
                  style={{
                    font: `700 13px/1 ${MODOO.fonts.sans}`,
                    marginTop: 4,
                  }}
                >
                  ₩{p.price.toLocaleString()}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
      <div style={{ marginTop: 24, padding: "0 16px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 12,
          }}
        >
          <div style={{ font: `700 15px/1 ${MODOO.fonts.sans}` }}>
            인기 카테고리
          </div>
          <div
            style={{
              font: `600 12px/1 ${MODOO.fonts.sans}`,
              color: MODOO.muted,
            }}
          >
            전체보기
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            overflowX: "auto",
            paddingBottom: 4,
          }}
        >
          {categories.map((c, i) => (
            <Link
              key={c.key}
              href={`/v2/mall?category=${c.key}`}
              style={{
                minWidth: 110,
                height: 130,
                borderRadius: 16,
                background: CATEGORY_TINTS[i % CATEGORY_TINTS.length],
                padding: 12,
                position: "relative",
                flexShrink: 0,
                color: MODOO.ink,
                textDecoration: "none",
              }}
            >
              <div style={{ font: `700 13px/1.2 ${MODOO.fonts.sans}` }}>
                {c.name}
              </div>
              <div
                style={{
                  position: "absolute",
                  right: 6,
                  bottom: 6,
                  width: 70,
                  height: 70,
                }}
              >
                <Tee color="#fff" size={70} lining={false} />
              </div>
            </Link>
          ))}
        </div>
      </div>
      <div style={{ height: 110 }} />
      <TabBar active="home" brand={brand} />
    </div>
  );
};

export const HomeMinimal: React.FC<BrandProp> = ({ brand = MODOO.brand }) => (
  <div style={{ background: "#fff", minHeight: "100%", position: "relative" }}>
    <AppBar
      transparent
      title={<ModooLogo />}
      right={<Icon name="search" />}
      left={null}
    />
    <div style={{ padding: "8px 24px 0" }}>
      <div
        style={{
          font: `800 36px/1.05 ${MODOO.fonts.sans}`,
          letterSpacing: "-0.035em",
        }}
      >
        단체의 첫인상,
        <br />
        <span style={{ color: brand }}>한 벌부터.</span>
      </div>
      <div
        style={{
          font: `500 13px/1.5 ${MODOO.fonts.sans}`,
          color: MODOO.muted,
          marginTop: 12,
        }}
      >
        최소 1장부터 20만 장까지. 디자인부터 배송까지 평균 7일.
      </div>
    </div>
    <div style={{ marginTop: 22, position: "relative" }}>
      <div
        style={{
          margin: "0 24px",
          height: 280,
          borderRadius: 20,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <Placeholder label="hero · group photo" tone="cool" />
        <div
          style={{
            position: "absolute",
            left: 16,
            bottom: 16,
            right: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.92)",
              font: `600 11px/1 ${MODOO.fonts.mono}`,
              letterSpacing: "0.06em",
            }}
          >
            EDITORS' PICK
          </div>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="arrow-up-r" size={18} />
          </div>
        </div>
      </div>
    </div>
    <div
      style={{
        margin: "24px 24px 0",
        display: "flex",
        borderTop: `1px solid ${MODOO.hairlineSoft}`,
        borderBottom: `1px solid ${MODOO.hairlineSoft}`,
      }}
    >
      {[
        { n: "12,400", l: "누적 주문" },
        { n: "4.92", l: "평균 별점" },
        { n: "7일", l: "평균 제작" },
      ].map((s, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            padding: "14px 0",
            textAlign: "center",
            borderLeft: i ? `1px solid ${MODOO.hairlineSoft}` : "none",
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
    <div style={{ padding: "20px 24px 0" }}>
      <div
        style={{
          font: `700 14px/1 ${MODOO.fonts.sans}`,
          marginBottom: 14,
        }}
      >
        지금 떠오르는 디자인
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        {[
          { c: "#0E1116", l: "BLACK CREW" },
          { c: "#FFD25C", l: "OAT YELLOW" },
          { c: brand, l: "COBALT" },
          { c: "#F4EEE3", l: "PAPER" },
        ].map((p, i) => (
          <div
            key={i}
            style={{
              aspectRatio: "1/1",
              borderRadius: 14,
              position: "relative",
              background: MODOO.surfaceWarm,
              overflow: "hidden",
              border: `1px solid ${MODOO.hairlineSoft}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Tee color={p.c} size={120} lining={false} />
            <div
              style={{
                position: "absolute",
                left: 10,
                bottom: 10,
                font: `600 9px/1 ${MODOO.fonts.mono}`,
                letterSpacing: "0.08em",
                color: MODOO.muted,
              }}
            >
              {p.l}
            </div>
          </div>
        ))}
      </div>
    </div>
    <div style={{ padding: "20px 24px 0" }}>
      <CTA color={MODOO.ink}>디자인 시작하기</CTA>
    </div>
    <div style={{ height: 110 }} />
    <TabBar active="home" brand={brand} />
  </div>
);

export const HomeProfessional: React.FC<BrandProp> = ({
  brand = MODOO.brand,
}) => (
  <div
    style={{ background: "#F4F6FA", minHeight: "100%", position: "relative" }}
  >
    <div
      style={{
        background: brand,
        color: "#fff",
        paddingBottom: 22,
        position: "relative",
      }}
    >
      <AppBar
        transparent
        title={
          <span
            style={{
              color: "#fff",
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            modoo<span style={{ opacity: 0.6 }}>·</span>biz
          </span>
        }
        right={<Icon name="bell" color="#fff" />}
        left={<Icon name="menu" color="#fff" />}
      />
      <div style={{ padding: "4px 20px 0" }}>
        <div
          style={{
            font: `500 12px/1.2 ${MODOO.fonts.mono}`,
            opacity: 0.75,
            letterSpacing: "0.06em",
          }}
        >
          B2B WORKWEAR & UNIFORM
        </div>
        <div
          style={{
            font: `700 22px/1.25 ${MODOO.fonts.sans}`,
            marginTop: 8,
            letterSpacing: "-0.02em",
          }}
        >
          (주)서일테크놀로지
          <br />
          전용 기업 계정
        </div>
        <div
          style={{
            marginTop: 18,
            background: "rgba(255,255,255,0.10)",
            border: "1px solid rgba(255,255,255,0.16)",
            borderRadius: 14,
            padding: 14,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
          }}
        >
          {[
            { n: "14건", l: "진행 중" },
            { n: "₩2,840만", l: "이번 분기" },
            { n: "4.96", l: "평가 점수" },
          ].map((m, i) => (
            <div
              key={i}
              style={{
                paddingLeft: i ? 12 : 0,
                borderLeft: i
                  ? "1px solid rgba(255,255,255,0.18)"
                  : "none",
              }}
            >
              <div
                className="num"
                style={{
                  font: `700 16px/1 ${MODOO.fonts.sans}`,
                  letterSpacing: "-0.02em",
                }}
              >
                {m.n}
              </div>
              <div
                style={{
                  font: `500 10px/1 ${MODOO.fonts.sans}`,
                  opacity: 0.75,
                  marginTop: 4,
                }}
              >
                {m.l}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    <div style={{ padding: "16px 16px 0" }}>
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
      >
        {(
          [
            { t: "신규 견적", s: "대량 주문", i: "tag", c: brand },
            { t: "리오더", s: "이전 주문 복제", i: "redo", c: MODOO.ink },
            {
              t: "디자인 승인",
              s: "대기 2건",
              i: "check",
              c: MODOO.pos,
              badge: "2",
            },
            {
              t: "계약·세금계산서",
              s: "발행 관리",
              i: "card",
              c: MODOO.muted,
            },
          ] as {
            t: string;
            s: string;
            i: IconName;
            c: string;
            badge?: string;
          }[]
        ).map((it, i) => (
          <div
            key={i}
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 14,
              border: `1px solid ${MODOO.hairline}`,
              position: "relative",
            }}
          >
            {it.badge && (
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  minWidth: 18,
                  height: 18,
                  padding: "0 6px",
                  borderRadius: 9,
                  background: MODOO.err,
                  color: "#fff",
                  font: `700 11px/18px ${MODOO.fonts.sans}`,
                  textAlign: "center",
                }}
              >
                {it.badge}
              </div>
            )}
            <Icon name={it.i} size={20} color={it.c} />
            <div
              style={{
                font: `700 13px/1.2 ${MODOO.fonts.sans}`,
                marginTop: 12,
              }}
            >
              {it.t}
            </div>
            <div
              style={{
                font: `500 11px/1.2 ${MODOO.fonts.sans}`,
                color: MODOO.muted,
                marginTop: 3,
              }}
            >
              {it.s}
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
          alignItems: "baseline",
          marginBottom: 10,
        }}
      >
        <div style={{ font: `700 14px/1 ${MODOO.fonts.sans}` }}>최근 주문</div>
        <div
          style={{ font: `600 12px/1 ${MODOO.fonts.sans}`, color: brand }}
        >
          전체보기
        </div>
      </div>
      {[
        {
          n: "SO-24-1043",
          d: "서일테크 워크샵 단체티",
          q: 240,
          st: "제작중",
          stc: brand,
          p: 0.55,
        },
        {
          n: "SO-24-1029",
          d: "연구개발팀 폴로셔츠",
          q: 38,
          st: "배송중",
          stc: MODOO.warn,
          p: 0.85,
        },
        {
          n: "SO-24-1011",
          d: "신입공채 OT 후드",
          q: 120,
          st: "완료",
          stc: MODOO.pos,
          p: 1,
        },
      ].map((o, i) => (
        <div
          key={i}
          style={{
            background: "#fff",
            borderRadius: 12,
            border: `1px solid ${MODOO.hairline}`,
            padding: 14,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <div
                className="num"
                style={{
                  font: `600 11px/1 ${MODOO.fonts.mono}`,
                  color: MODOO.faint,
                  letterSpacing: "0.04em",
                }}
              >
                {o.n}
              </div>
              <div
                style={{
                  font: `700 14px/1.2 ${MODOO.fonts.sans}`,
                  marginTop: 6,
                }}
              >
                {o.d}
              </div>
              <div
                className="num"
                style={{
                  font: `500 12px/1 ${MODOO.fonts.sans}`,
                  color: MODOO.muted,
                  marginTop: 6,
                }}
              >
                {o.q}장
              </div>
            </div>
            <div
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                background: o.stc + "14",
                color: o.stc,
                font: `700 11px/1 ${MODOO.fonts.sans}`,
              }}
            >
              {o.st}
            </div>
          </div>
          <div
            style={{
              marginTop: 10,
              height: 3,
              borderRadius: 3,
              background: MODOO.hairlineSoft,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                width: `${o.p * 100}%`,
                background: o.stc,
                borderRadius: 3,
              }}
            />
          </div>
        </div>
      ))}
    </div>
    <div style={{ height: 110 }} />
    <TabBar active="home" brand={brand} />
  </div>
);

export const HomeEditorial: React.FC<BrandProp> = ({
  brand = MODOO.brand,
}) => (
  <div
    style={{ background: "#F4EEE3", minHeight: "100%", position: "relative" }}
  >
    <AppBar
      transparent
      title={<ModooLogo />}
      left={<Icon name="menu" />}
      right={<Icon name="search" />}
    />
    <div style={{ padding: "6px 22px 0" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <div
          className="num"
          style={{
            font: `600 10px/1 ${MODOO.fonts.mono}`,
            color: MODOO.muted,
            letterSpacing: "0.12em",
          }}
        >
          VOL.07 / 2026 SS
        </div>
        <div
          className="num"
          style={{
            font: `600 10px/1 ${MODOO.fonts.mono}`,
            color: MODOO.muted,
            letterSpacing: "0.12em",
          }}
        >
          ISSN 2024-0052
        </div>
      </div>
      <div style={{ height: 1, background: MODOO.ink, marginTop: 8 }} />
      <div
        style={{
          font: `900 56px/0.92 ${MODOO.fonts.sans}`,
          marginTop: 14,
          letterSpacing: "-0.045em",
        }}
      >
        Wear
        <br />
        <i
          style={{
            fontStyle: "italic",
            color: brand,
            fontWeight: 800,
          }}
        >
          together
        </i>
        .
      </div>
      <div
        style={{
          font: `500 13px/1.5 ${MODOO.fonts.sans}`,
          color: MODOO.body,
          marginTop: 14,
          maxWidth: 280,
        }}
      >
        한 사람의 디자인이 모두의 옷이 되는 곳. 이번 호의 키워드는{" "}
        <b>「우리만의 단복」</b>.
      </div>
    </div>
    <div style={{ marginTop: 18, position: "relative" }}>
      <div
        style={{
          height: 240,
          margin: "0 22px",
          borderRadius: 2,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <Placeholder label="cover · group portrait" tone="warm" />
        <div
          style={{
            position: "absolute",
            left: 14,
            bottom: 12,
            padding: "4px 8px",
            background: brand,
            color: "#fff",
            font: `700 10px/1.3 ${MODOO.fonts.mono}`,
            letterSpacing: "0.08em",
          }}
        >
          FEATURE · STORY 01
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          right: 30,
          top: -14,
          padding: "8px 12px",
          background: MODOO.ink,
          color: "#fff",
          borderRadius: 0,
          font: `800 13px/1.1 ${MODOO.fonts.sans}`,
          transform: "rotate(2deg)",
        }}
      >
        NEW · FW26 ARRIVED
      </div>
    </div>
    <div style={{ padding: "20px 22px 0" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <div
          style={{
            font: `800 14px/1 ${MODOO.fonts.sans}`,
            letterSpacing: "-0.01em",
          }}
        >
          이번 호 차례
        </div>
        <div
          className="num"
          style={{
            font: `600 10px/1 ${MODOO.fonts.mono}`,
            color: MODOO.muted,
            letterSpacing: "0.06em",
          }}
        >
          P. 04—42
        </div>
      </div>
      <div style={{ height: 1, background: MODOO.ink, marginTop: 8 }} />
      {[
        {
          p: "04",
          t: "연대 농활 단체티가 17년째 살아있는 이유",
          s: "INTERVIEW",
        },
        { p: "12", t: "실크 4도 인쇄, 손맛으로 찍어낸다는 것", s: "CRAFT" },
        { p: "24", t: "대학 동아리 100팀이 고른 색·소재 BEST", s: "PICKS" },
        { p: "36", t: "돈 안 쓰고 디자인하는 법: AI 첨삭 가이드", s: "HOW-TO" },
      ].map((r, i) => (
        <div
          key={i}
          style={{
            padding: "12px 0",
            borderBottom: `1px solid ${MODOO.ink}22`,
            display: "flex",
            alignItems: "baseline",
            gap: 12,
          }}
        >
          <div
            className="num"
            style={{
              font: `700 12px/1 ${MODOO.fonts.mono}`,
              color: brand,
              width: 24,
            }}
          >
            {r.p}
          </div>
          <div style={{ flex: 1 }}>
            <div
              className="num"
              style={{
                font: `600 10px/1 ${MODOO.fonts.mono}`,
                color: MODOO.muted,
                letterSpacing: "0.08em",
              }}
            >
              {r.s}
            </div>
            <div
              style={{
                font: `700 14px/1.3 ${MODOO.fonts.sans}`,
                marginTop: 4,
                letterSpacing: "-0.01em",
              }}
            >
              {r.t}
            </div>
          </div>
          <Icon name="arrow-up-r" size={16} />
        </div>
      ))}
    </div>
    <div style={{ padding: "24px 22px 0" }}>
      <CTA color={MODOO.ink}>이번 호 보기 · 디자인 시작</CTA>
    </div>
    <div style={{ height: 110 }} />
    <TabBar active="home" brand={brand} />
  </div>
);

export const HomeDarkSport: React.FC<BrandProp> = ({
  brand = MODOO.brand,
}) => (
  <div
    style={{
      background: "#0B0E13",
      minHeight: "100%",
      position: "relative",
      color: "#fff",
    }}
  >
    <AppBar
      transparent
      title={
        <span
          style={{
            color: "#fff",
            font: `800 17px/1 ${MODOO.fonts.sans}`,
            letterSpacing: "-0.02em",
          }}
        >
          modoo<span style={{ color: brand }}>·</span>club
        </span>
      }
      left={<Icon name="menu" color="#fff" />}
      right={<Icon name="bell" color="#fff" />}
    />
    <div style={{ padding: "6px 22px 0" }}>
      <div
        className="num"
        style={{
          font: `600 10px/1 ${MODOO.fonts.mono}`,
          color: brand,
          letterSpacing: "0.16em",
        }}
      >
        FOR YOUR CREW
      </div>
      <div
        style={{
          font: `900 36px/0.96 ${MODOO.fonts.sans}`,
          marginTop: 14,
          letterSpacing: "-0.035em",
        }}
      >
        OUR
        <br />
        UNIFORM.
        <br />
        <span style={{ color: brand }}>OUR RULES.</span>
      </div>
    </div>
    <div style={{ marginTop: 14, position: "relative", padding: "0 16px" }}>
      <div
        style={{
          height: 230,
          borderRadius: 18,
          overflow: "hidden",
          position: "relative",
          background: `radial-gradient(circle at 50% 60%, ${brand}55 0%, transparent 70%), #0B0E13`,
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Tee color="#0E1116" size={220} accent={brand} />
        <div
          style={{
            position: "absolute",
            left: 14,
            bottom: 14,
            padding: "6px 10px",
            borderRadius: 999,
            background: brand,
            font: `700 11px/1 ${MODOO.fonts.sans}`,
          }}
        >
          NEW · 져지 셋업
        </div>
        <div
          style={{
            position: "absolute",
            right: 14,
            top: 14,
            width: 38,
            height: 38,
            borderRadius: 19,
            background: "rgba(255,255,255,0.1)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="arrow-up-r" size={18} color="#fff" />
        </div>
      </div>
    </div>
    <div style={{ display: "flex", padding: "20px 22px 0", gap: 14 }}>
      {[
        { n: "7일", l: "평균 제작" },
        { n: "4.9★", l: "팀 만족도" },
        { n: "600+", l: "동호회 사용" },
      ].map((s, i) => (
        <div key={i} style={{ flex: 1 }}>
          <div
            className="num"
            style={{
              font: `800 22px/1 ${MODOO.fonts.sans}`,
              letterSpacing: "-0.02em",
            }}
          >
            {s.n}
          </div>
          <div
            style={{
              font: `500 11px/1 ${MODOO.fonts.sans}`,
              color: "rgba(255,255,255,0.55)",
              marginTop: 6,
            }}
          >
            {s.l}
          </div>
        </div>
      ))}
    </div>
    <div style={{ padding: "20px 16px 0" }}>
      <div
        style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}
      >
        <div
          style={{
            gridRow: "span 2",
            background: brand,
            borderRadius: 16,
            padding: 16,
            minHeight: 160,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              font: `500 11px/1 ${MODOO.fonts.mono}`,
              opacity: 0.85,
              letterSpacing: "0.06em",
            }}
          >
            BUILD
          </div>
          <div
            style={{
              font: `800 22px/1.15 ${MODOO.fonts.sans}`,
              marginTop: 8,
              letterSpacing: "-0.02em",
            }}
          >
            팀 단복
            <br />
            30초 빌더
          </div>
          <div
            style={{
              font: `500 11px/1.4 ${MODOO.fonts.sans}`,
              marginTop: 8,
              opacity: 0.85,
              maxWidth: 140,
            }}
          >
            팀명·시즌·컬러만 정하면 끝
          </div>
          <div
            style={{
              position: "absolute",
              right: -24,
              bottom: -24,
              opacity: 0.4,
            }}
          >
            <Tee color="#fff" size={130} lining={false} />
          </div>
        </div>
        {(
          [
            { t: "리오더", s: "저번 그대로", i: "redo" },
            { t: "AI 생성", s: "1줄로 끝", i: "sparkle" },
          ] as { t: string; s: string; i: IconName }[]
        ).map((c, i) => (
          <div
            key={i}
            style={{
              background: "rgba(255,255,255,0.06)",
              borderRadius: 16,
              padding: 14,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <Icon name={c.i} size={18} color={brand} />
            <div
              style={{
                font: `700 13px/1.2 ${MODOO.fonts.sans}`,
                marginTop: 10,
              }}
            >
              {c.t}
            </div>
            <div
              style={{
                font: `500 11px/1.2 ${MODOO.fonts.sans}`,
                color: "rgba(255,255,255,0.55)",
                marginTop: 4,
              }}
            >
              {c.s}
            </div>
          </div>
        ))}
      </div>
    </div>
    <div style={{ padding: "20px 22px 0" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <div style={{ font: `700 13px/1 ${MODOO.fonts.sans}` }}>오늘의 크루</div>
        <div
          style={{
            font: `600 11px/1 ${MODOO.fonts.sans}`,
            color: "rgba(255,255,255,0.55)",
          }}
        >
          전체
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {["#FFD25C", "#FF5C8A", brand, "#10B981", "#fff"].map((c, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              aspectRatio: "1/1.2",
              borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Tee color={c} size={50} lining={false} />
          </div>
        ))}
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
        paddingBottom: 22,
        paddingTop: 8,
        background: "rgba(11,14,19,0.92)",
        backdropFilter: "blur(20px)",
        borderTop: "0.5px solid rgba(255,255,255,0.08)",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
      }}
    >
      {(
        [
          { id: "home", i: "home", l: "홈", a: true },
          { id: "shop", i: "grid", l: "상품" },
          { id: "editor", i: "sparkle", l: "디자인", center: true },
          { id: "orders", i: "box", l: "주문" },
          { id: "me", i: "user", l: "MY" },
        ] as {
          id: string;
          i: IconName;
          l: string;
          a?: boolean;
          center?: boolean;
        }[]
      ).map((t) =>
        t.center ? (
          <div
            key={t.id}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              marginTop: -22,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 18,
                background: brand,
                boxShadow: `0 8px 18px ${brand}66`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="sparkle" size={24} color="#fff" strokeWidth={2} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, color: brand }}>
              {t.l}
            </span>
          </div>
        ) : (
          <div
            key={t.id}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              padding: "6px 14px",
              flex: 1,
            }}
          >
            <Icon
              name={t.i}
              size={22}
              color={t.a ? "#fff" : "rgba(255,255,255,0.45)"}
              strokeWidth={t.a ? 2 : 1.6}
            />
            <span
              style={{
                fontSize: 10,
                fontWeight: t.a ? 600 : 500,
                color: t.a ? "#fff" : "rgba(255,255,255,0.45)",
              }}
            >
              {t.l}
            </span>
          </div>
        )
      )}
    </div>
  </div>
);

export const HomeColorfield: React.FC<BrandProp> = ({
  brand = MODOO.brand,
}) => (
  <div style={{ background: "#fff", minHeight: "100%", position: "relative" }}>
    <AppBar
      transparent
      title={<ModooLogo />}
      left={null}
      right={<Icon name="search" />}
    />
    <div style={{ padding: "0 14px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 8,
          height: 280,
        }}
      >
        <div
          style={{
            background: brand,
            borderRadius: 20,
            padding: 18,
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              font: `500 11px/1 ${MODOO.fonts.mono}`,
              opacity: 0.8,
              letterSpacing: "0.08em",
            }}
          >
            THIS WEEK
          </div>
          <div>
            <div
              style={{
                font: `800 30px/0.96 ${MODOO.fonts.sans}`,
                letterSpacing: "-0.035em",
              }}
            >
              팀의
              <br />
              색을
              <br />
              고르세요
            </div>
            <div
              style={{
                marginTop: 14,
                padding: "6px 12px",
                display: "inline-flex",
                gap: 6,
                alignItems: "center",
                background: "#fff",
                color: brand,
                borderRadius: 999,
                font: `700 12px/1 ${MODOO.fonts.sans}`,
              }}
            >
              시작 <Icon name="arrow-r" size={14} color={brand} />
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              right: -18,
              top: -10,
              width: 100,
              height: 100,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.14)",
            }}
          />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateRows: "1fr 1fr",
            gap: 8,
          }}
        >
          <div
            style={{
              background: "#FFD25C",
              borderRadius: 20,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                font: `500 10px/1 ${MODOO.fonts.mono}`,
                color: "#5A4500",
                letterSpacing: "0.06em",
              }}
            >
              EVENT
            </div>
            <div
              style={{
                font: `800 16px/1.1 ${MODOO.fonts.sans}`,
                color: "#5A4500",
                letterSpacing: "-0.02em",
              }}
            >
              OT시즌
              <br />
              30%
            </div>
          </div>
          <div
            style={{
              background: "#0E1116",
              borderRadius: 20,
              padding: 14,
              color: "#fff",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                font: `500 10px/1 ${MODOO.fonts.mono}`,
                color: "rgba(255,255,255,0.6)",
                letterSpacing: "0.06em",
              }}
            >
              BLACK
            </div>
            <div
              style={{
                font: `800 16px/1.1 ${MODOO.fonts.sans}`,
                letterSpacing: "-0.02em",
              }}
            >
              실키
              <br />
              맨투맨
            </div>
          </div>
        </div>
      </div>
    </div>
    <div style={{ padding: "22px 22px 0" }}>
      <div
        style={{
          font: `500 12px/1 ${MODOO.fonts.sans}`,
          color: MODOO.muted,
        }}
      >
        안녕하세요, 진우님
      </div>
      <div
        style={{
          font: `800 22px/1.25 ${MODOO.fonts.sans}`,
          marginTop: 6,
          letterSpacing: "-0.025em",
        }}
      >
        오늘의 큐레이션
      </div>
    </div>
    <div style={{ padding: "14px 14px 0" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        {[
          { t: "졸업과제 단체 후드", tag: "컴공 24", c: brand, a: "#fff" },
          {
            t: "농구 동호회 져지",
            tag: "강남리그",
            c: "#A23232",
            a: "#FFD25C",
          },
          { t: "카페 직원 앞치마", tag: "BLEND", c: "#5C6573", a: "#fff" },
          {
            t: "결혼식 친구 단체",
            tag: "PRIVATE",
            c: "#FFD25C",
            a: brand,
          },
        ].map((c, i) => (
          <div
            key={i}
            style={{
              borderRadius: 16,
              overflow: "hidden",
              position: "relative",
              background: MODOO.surfaceWarm,
              border: `1px solid ${MODOO.hairlineSoft}`,
            }}
          >
            <div
              style={{
                aspectRatio: "1/1",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Tee color={c.c} size={130} accent={c.a} />
            </div>
            <div style={{ padding: "10px 12px 12px" }}>
              <div
                className="num"
                style={{
                  font: `600 10px/1 ${MODOO.fonts.mono}`,
                  color: MODOO.muted,
                  letterSpacing: "0.06em",
                }}
              >
                {c.tag}
              </div>
              <div
                style={{
                  font: `700 13px/1.3 ${MODOO.fonts.sans}`,
                  marginTop: 4,
                }}
              >
                {c.t}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
    <div style={{ padding: "20px 14px 0" }}>
      <div
        style={{
          background: "#0E1116",
          color: "#fff",
          borderRadius: 14,
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Icon name="flame" size={20} color={brand} />
        <div style={{ flex: 1 }}>
          <div style={{ font: `700 13px/1.2 ${MODOO.fonts.sans}` }}>
            지금 이 시즌, 가장 빠른 길
          </div>
          <div
            style={{
              font: `500 11px/1.3 ${MODOO.fonts.sans}`,
              opacity: 0.65,
              marginTop: 4,
            }}
          >
            평균 7일, 급한 단체는 3일도 가능
          </div>
        </div>
        <Icon name="arrow-r" size={18} color="#fff" />
      </div>
    </div>
    <div style={{ height: 110 }} />
    <TabBar active="home" brand={brand} />
  </div>
);

export const Onboarding: React.FC<BrandProp> = ({ brand = MODOO.brand }) => (
  <div style={{ background: "#fff", minHeight: "100%", position: "relative" }}>
    <div
      style={{
        height: 380,
        background: `linear-gradient(180deg, ${brand}10 0%, #fff 100%)`,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 30,
          top: 70,
          opacity: 0.6,
          transform: "rotate(-12deg)",
        }}
      >
        <Tee color="#FFD25C" size={110} lining={false} />
      </div>
      <div
        style={{
          position: "absolute",
          right: 20,
          top: 110,
          opacity: 0.6,
          transform: "rotate(8deg)",
        }}
      >
        <Tee color="#FF5C8A" size={100} lining={false} />
      </div>
      <div style={{ zIndex: 1 }}>
        <Tee color={brand} size={200} accent="#FFD25C" />
      </div>
      <div
        style={{
          position: "absolute",
          left: 50,
          bottom: 30,
          opacity: 0.5,
          transform: "rotate(15deg)",
        }}
      >
        <Tee color="#0E1116" size={90} lining={false} />
      </div>
    </div>
    <div style={{ padding: "20px 28px 0" }}>
      <div
        style={{
          display: "flex",
          gap: 6,
          justifyContent: "center",
          marginBottom: 24,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: i === 0 ? 22 : 6,
              height: 6,
              borderRadius: 3,
              background: i === 0 ? brand : MODOO.hairline,
              transition: "all .3s",
            }}
          />
        ))}
      </div>
      <div
        style={{
          font: `800 28px/1.2 ${MODOO.fonts.sans}`,
          letterSpacing: "-0.03em",
          textAlign: "center",
        }}
      >
        모두의 단체복,
        <br />
        한 번에 만들기
      </div>
      <div
        style={{
          font: `500 14px/1.55 ${MODOO.fonts.sans}`,
          color: MODOO.muted,
          marginTop: 14,
          textAlign: "center",
        }}
      >
        1장부터 1만 장까지. 내 디자인을
        <br />
        입혀보고, 견적받고, 받아보세요.
      </div>
    </div>
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 480,
        zIndex: 30,
        padding: "0 20px 30px",
      }}
    >
      <CTA color={brand}>3초 만에 시작하기</CTA>
      <button
        style={{
          width: "100%",
          height: 48,
          marginTop: 8,
          font: `600 13px/1 ${MODOO.fonts.sans}`,
          color: MODOO.muted,
          background: "transparent",
        }}
      >
        로그인 / 회원가입
      </button>
    </div>
  </div>
);
