"use client";

import * as React from "react";
import Link from "next/link";
import {
  MODOO,
  Icon,
  Tee,
  AppBar,
  CTA,
  Placeholder,
  IconName,
} from "../tokens";
import type { V2ProductDetail } from "../../_lib/types";

interface BrandProp {
  brand?: string;
}

interface ProductProp {
  product?: V2ProductDetail | null;
}

const EditorBase: React.FC<{
  brand: string;
  title?: string;
  children: React.ReactNode;
}> = ({ brand, title = "디자인 에디터", children }) => (
  <div
    style={{
      background: "#1A1F28",
      minHeight: "100%",
      position: "relative",
      color: "#fff",
    }}
  >
    <div
      style={{
        padding: "6px 12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: 50,
        position: "relative",
        zIndex: 3,
      }}
    >
      <Link
        href="/v2/mall"
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          background: "rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
        }}
      >
        <Icon name="close" size={18} color="#fff" />
      </Link>
      <div style={{ font: `700 14px/1 ${MODOO.fonts.sans}` }}>{title}</div>
      <div
        style={{
          padding: "6px 14px",
          borderRadius: 999,
          background: brand,
          font: `700 13px/1 ${MODOO.fonts.sans}`,
        }}
      >
        저장
      </div>
    </div>
    {children}
  </div>
);

export const Editor: React.FC<BrandProp & ProductProp> = ({
  brand = MODOO.brand,
  product,
}) => (
  <EditorBase brand={brand} title={product ? `${product.title} · 앞면` : "디자인 에디터"}>
    <div
      style={{
        position: "absolute",
        left: 12,
        top: 110,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 2,
      }}
    >
      {(["undo", "redo", "layers", "rotate"] as IconName[]).map((b, i) => (
        <div
          key={i}
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            background: "rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={b} size={18} color="#fff" />
        </div>
      ))}
    </div>
    <div
      style={{
        position: "absolute",
        right: 12,
        top: 110,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 2,
      }}
    >
      {["앞", "뒤", "좌", "우"].map((s, i) => (
        <div
          key={s}
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            background: i === 0 ? "#fff" : "rgba(255,255,255,0.08)",
            color: i === 0 ? MODOO.ink : "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: `700 12px/1 ${MODOO.fonts.sans}`,
          }}
        >
          {s}
        </div>
      ))}
    </div>
    <div
      style={{
        margin: "4px 12px 0",
        height: 400,
        borderRadius: 18,
        background: "linear-gradient(180deg, #2A2F38 0%, #1A1F28 100%)",
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
          inset: 0,
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      />
      <div style={{ position: "relative" }}>
        <Tee color="#0E1116" size={260} accent={null} lining={false} />
        <div
          style={{
            position: "absolute",
            left: "32%",
            top: "34%",
            width: "36%",
            height: "38%",
            border: `1px dashed ${brand}`,
            borderRadius: 4,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "12% 6% 18% 6%",
              border: `1.5px solid ${brand}`,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 0 1px rgba(0,0,0,0.4)`,
            }}
          >
            <span
              style={{
                font: `900 22px/1 "Pretendard"`,
                color: "#FFD25C",
                letterSpacing: "-0.02em",
                textAlign: "center",
                textShadow: "0 1px 0 rgba(0,0,0,0.4)",
              }}
            >
              SEOIL
              <br />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.2em",
                }}
              >
                WORKSHOP &apos;26
              </span>
            </span>
            {[
              { l: -4, t: -4 },
              { r: -4, t: -4 },
              { l: -4, b: -4 },
              { r: -4, b: -4 },
            ].map((c, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: c.l,
                  top: c.t,
                  right: c.r,
                  bottom: c.b,
                  width: 9,
                  height: 9,
                  borderRadius: 2,
                  background: "#fff",
                  border: `1.5px solid ${brand}`,
                }}
              />
            ))}
            <div
              style={{
                position: "absolute",
                top: -22,
                left: "50%",
                transform: "translateX(-50%)",
                width: 22,
                height: 22,
                borderRadius: 11,
                background: "#fff",
                border: `1.5px solid ${brand}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="rotate" size={12} color={brand} />
            </div>
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 12,
          bottom: 12,
          padding: "6px 10px",
          borderRadius: 8,
          background: "rgba(0,0,0,0.5)",
          font: `600 10px/1 ${MODOO.fonts.mono}`,
          letterSpacing: "0.06em",
          backdropFilter: "blur(8px)",
        }}
      >
        A4 · 297mm × 210mm
      </div>
      <div
        style={{
          position: "absolute",
          right: 12,
          bottom: 12,
          padding: "6px 10px",
          borderRadius: 8,
          background: "rgba(0,0,0,0.5)",
          font: `600 10px/1 ${MODOO.fonts.mono}`,
          letterSpacing: "0.06em",
          backdropFilter: "blur(8px)",
        }}
      >
        100%
      </div>
    </div>
    <div style={{ padding: "14px 16px 0" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            font: `600 12px/1 ${MODOO.fonts.sans}`,
            color: "rgba(255,255,255,0.7)",
          }}
        >
          의류 색상
        </div>
        <div
          style={{
            font: `500 11px/1 ${MODOO.fonts.sans}`,
            color: "rgba(255,255,255,0.5)",
          }}
        >
          전체 14색
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          marginTop: 10,
          overflowX: "auto",
          paddingBottom: 4,
        }}
      >
        {(product?.colors.length
          ? product.colors.map((c) => c.hex)
          : [
              "#0E1116",
              "#FFFFFF",
              brand,
              "#A23232",
              "#16331F",
              "#FFD25C",
              "#E5DCC8",
              "#5C6573",
              "#FF5C8A",
            ]
        ).map((c, i) => (
          <div
            key={i}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              background: c,
              flexShrink: 0,
              outline: i === 0 ? `2px solid ${brand}` : "none",
              outlineOffset: 2,
              border:
                c.toUpperCase() === "#FFFFFF"
                  ? `1px solid ${MODOO.hairline}`
                  : "none",
            }}
          />
        ))}
      </div>
    </div>
    <div
      style={{
        marginTop: 16,
        background: "rgba(255,255,255,0.04)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        padding: "14px 8px 28px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-around" }}>
        {(
          [
            { i: "type", l: "글씨", a: true },
            { i: "image", l: "이미지" },
            { i: "sticker", l: "스티커" },
            { i: "shapes", l: "도형" },
            { i: "sparkle", l: "AI 생성" },
          ] as { i: IconName; l: string; a?: boolean }[]
        ).map((t) => (
          <div
            key={t.l}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              padding: "4px 8px",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: t.a ? brand : "rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: t.a ? `0 6px 16px ${brand}66` : "none",
              }}
            >
              <Icon
                name={t.i}
                size={22}
                color="#fff"
                strokeWidth={t.a ? 2 : 1.7}
              />
            </div>
            <div
              style={{
                font: `${t.a ? 700 : 500} 11px/1 ${MODOO.fonts.sans}`,
                color: t.a ? "#fff" : "rgba(255,255,255,0.7)",
              }}
            >
              {t.l}
            </div>
          </div>
        ))}
      </div>
    </div>
  </EditorBase>
);

export const PrintMethod: React.FC<BrandProp> = ({ brand = MODOO.brand }) => {
  const methods: {
    n: string;
    sub: string;
    best: string;
    price: string;
    desc: string;
    pros: string[];
    cons: string[];
    icon: IconName;
    selected?: boolean;
  }[] = [
    {
      n: "디지털 전사",
      sub: "풀컬러 · 사진 인쇄",
      best: "소량·다색",
      price: "+₩2,000",
      desc: "잉크젯으로 인쇄 후 열압착. 사진/그라데이션에 가장 강함.",
      pros: ["풀컬러", "소량부터 OK", "빠른제작"],
      cons: ["두꺼운 질감"],
      icon: "image",
    },
    {
      n: "실크 나염",
      sub: "인쇄판 · 단색~3색",
      best: "50장 이상",
      price: "기본",
      desc: "잉크를 망점 없이 두껍게 입혀 색상이 선명하고 내구성이 강함.",
      pros: ["선명·진한색", "대량 시 가장 저렴"],
      cons: ["색상수 추가비"],
      icon: "palette",
      selected: true,
    },
    {
      n: "자수",
      sub: "실 자수 · 입체감",
      best: "폴로/유니폼",
      price: "+₩4,500",
      desc: "실로 한 땀 한 땀 박아 고급스러움. 작은 로고/와펜 추천.",
      pros: ["고급스러움", "내구성 최고"],
      cons: ["세밀 그래픽 X"],
      icon: "verified",
    },
    {
      n: "DTF 전사",
      sub: "신축성 · 풀컬러",
      best: "져지·기능성",
      price: "+₩2,800",
      desc: "신축성 좋고 풀컬러 가능. 스포츠/져지에 잘 맞음.",
      pros: ["신축성", "풀컬러"],
      cons: ["크기 제한 있음"],
      icon: "sparkle",
    },
  ];
  return (
    <div
      style={{
        background: MODOO.surfaceWarm,
        minHeight: "100%",
        position: "relative",
      }}
    >
      <AppBar
        title="인쇄 방식"
        left={<Icon name="arrow-l" />}
        right={<Icon name="search" />}
      />
      <div style={{ padding: "6px 20px 0" }}>
        <div
          style={{
            font: `500 12px/1 ${MODOO.fonts.mono}`,
            color: brand,
            letterSpacing: "0.06em",
          }}
        >
          STEP 02 / 04
        </div>
        <div
          style={{
            font: `700 22px/1.3 ${MODOO.fonts.sans}`,
            marginTop: 8,
            letterSpacing: "-0.02em",
          }}
        >
          어떤 방식으로
          <br />
          인쇄해드릴까요?
        </div>
        <div
          style={{
            font: `500 12px/1.5 ${MODOO.fonts.sans}`,
            color: MODOO.muted,
            marginTop: 6,
          }}
        >
          전문가가 디자인을 보고 가장 잘 어울리는 방식을 추천했어요.
        </div>
      </div>
      <div
        style={{
          padding: "20px 16px 0",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {methods.map((m, i) => (
          <div
            key={i}
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 14,
              border: m.selected
                ? `2px solid ${brand}`
                : `1px solid ${MODOO.hairline}`,
              position: "relative",
              boxShadow: m.selected ? `0 8px 22px ${brand}22` : "none",
            }}
          >
            {m.selected && (
              <div
                style={{
                  position: "absolute",
                  top: -10,
                  left: 14,
                  padding: "3px 10px",
                  borderRadius: 999,
                  background: brand,
                  color: "#fff",
                  font: `700 10px/1.4 ${MODOO.fonts.sans}`,
                }}
              >
                전문가 추천
              </div>
            )}
            <div
              style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: m.selected ? brand + "14" : MODOO.surfaceAlt,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon
                  name={m.icon}
                  size={22}
                  color={m.selected ? brand : MODOO.body}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      font: `700 15px/1.2 ${MODOO.fonts.sans}`,
                    }}
                  >
                    {m.n}
                  </div>
                  <div
                    style={{
                      font: `500 11px/1 ${MODOO.fonts.sans}`,
                      color: MODOO.muted,
                    }}
                  >
                    {m.sub}
                  </div>
                </div>
                <div
                  style={{
                    font: `500 12px/1.45 ${MODOO.fonts.sans}`,
                    color: MODOO.muted,
                    marginTop: 6,
                  }}
                >
                  {m.desc}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    marginTop: 10,
                    flexWrap: "wrap",
                  }}
                >
                  {m.pros.map((p) => (
                    <span
                      key={p}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: MODOO.pos + "14",
                        color: MODOO.pos,
                        font: `600 11px/1.3 ${MODOO.fonts.sans}`,
                      }}
                    >
                      + {p}
                    </span>
                  ))}
                  {m.cons.map((p) => (
                    <span
                      key={p}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: MODOO.surfaceAlt,
                        color: MODOO.muted,
                        font: `600 11px/1.3 ${MODOO.fonts.sans}`,
                      }}
                    >
                      − {p}
                    </span>
                  ))}
                </div>
              </div>
              <div
                style={{
                  font: `700 13px/1 ${MODOO.fonts.sans}`,
                  color: m.selected ? brand : MODOO.ink,
                  whiteSpace: "nowrap",
                }}
              >
                {m.price}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ height: 110 }} />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "12px 16px 30px",
          background: "#fff",
          borderTop: `0.5px solid ${MODOO.hairline}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <div>
            <div
              style={{
                font: `500 11px/1 ${MODOO.fonts.sans}`,
                color: MODOO.muted,
              }}
            >
              장당 단가
            </div>
            <div
              className="num"
              style={{
                font: `800 18px/1.1 ${MODOO.fonts.sans}`,
                marginTop: 4,
              }}
            >
              ₩4,900
            </div>
          </div>
          <div
            style={{
              font: `500 11px/1.3 ${MODOO.fonts.sans}`,
              color: MODOO.muted,
              textAlign: "right",
            }}
          >
            제작 약 5일 · 전문가 검수 포함
          </div>
        </div>
        <CTA color={brand}>다음 단계 (수량·사이즈)</CTA>
      </div>
    </div>
  );
};

export const EditorEmpty: React.FC<BrandProp> = ({ brand = MODOO.brand }) => (
  <EditorBase brand={brand}>
    <div
      style={{
        margin: "4px 12px 0",
        height: 400,
        borderRadius: 18,
        position: "relative",
        background: "linear-gradient(180deg, #2A2F38 0%, #1A1F28 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      />
      <div style={{ position: "relative" }}>
        <Tee color="#0E1116" size={260} lining={false} />
        <div
          style={{
            position: "absolute",
            left: "32%",
            top: "34%",
            width: "36%",
            height: "38%",
            border: `1.5px dashed ${brand}`,
            borderRadius: 4,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              background: brand,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 8px 24px ${brand}88`,
              animation: "modoo-pulse 1.6s infinite",
            }}
          >
            <Icon name="plus" size={22} color="#fff" strokeWidth={2.4} />
          </div>
          <div
            style={{
              font: `700 12px/1.3 ${MODOO.fonts.sans}`,
              color: "#fff",
              textAlign: "center",
            }}
          >
            여기에 디자인을
            <br />
            추가해보세요
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 12,
          bottom: 12,
          right: 12,
          padding: "12px 14px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.12)",
          backdropFilter: "blur(12px)",
          display: "flex",
          gap: 10,
          alignItems: "center",
        }}
      >
        <Icon name="sparkle" size={20} color={brand} />
        <div style={{ flex: 1, font: `600 12px/1.4 ${MODOO.fonts.sans}` }}>
          처음이신가요? AI에게 한 줄로 부탁해보세요
        </div>
        <Icon name="close" size={14} color="rgba(255,255,255,0.5)" />
      </div>
    </div>
    <div style={{ padding: "14px 16px 0" }}>
      <div
        style={{
          font: `600 11px/1 ${MODOO.fonts.mono}`,
          color: "rgba(255,255,255,0.55)",
          letterSpacing: "0.06em",
        }}
      >
        START FROM
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          marginTop: 12,
          overflowX: "auto",
        }}
      >
        {(
          [
            { l: "템플릿", s: "200+", i: "grid" },
            { l: "내 로고", s: "업로드", i: "image" },
            { l: "AI", s: "한 줄로", i: "sparkle" },
            { l: "글씨만", s: "간단히", i: "type" },
          ] as { l: string; s: string; i: IconName }[]
        ).map((s, i) => (
          <div
            key={s.l}
            style={{
              minWidth: 92,
              padding: 12,
              borderRadius: 12,
              flexShrink: 0,
              background: i === 2 ? brand : "rgba(255,255,255,0.06)",
              border: i === 2 ? "none" : "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <Icon name={s.i} size={18} color="#fff" />
            <div
              style={{
                font: `700 12px/1.2 ${MODOO.fonts.sans}`,
                marginTop: 10,
              }}
            >
              {s.l}
            </div>
            <div
              style={{
                font: `500 10px/1 ${MODOO.fonts.sans}`,
                color: "rgba(255,255,255,0.6)",
                marginTop: 3,
              }}
            >
              {s.s}
            </div>
          </div>
        ))}
      </div>
    </div>
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        background: "rgba(255,255,255,0.04)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        padding: "14px 8px 28px",
        opacity: 0.55,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-around" }}>
        {(["type", "image", "sticker", "shapes", "sparkle"] as IconName[]).map(
          (i) => (
            <div
              key={i}
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: "rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name={i} size={22} color="#fff" />
            </div>
          )
        )}
      </div>
    </div>
  </EditorBase>
);

export const EditorAIModal: React.FC<BrandProp> = ({
  brand = MODOO.brand,
}) => (
  <EditorBase brand={brand}>
    <div
      style={{
        margin: "4px 12px 0",
        height: 400,
        borderRadius: 18,
        position: "relative",
        background: "#1A1F28",
        overflow: "hidden",
        filter: "brightness(0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Tee color="#0E1116" size={240} lining={false} />
    </div>
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        background: "#fff",
        color: MODOO.ink,
        borderRadius: "20px 20px 0 0",
        padding: "8px 18px 28px",
        boxShadow: "0 -10px 40px rgba(0,0,0,0.4)",
      }}
    >
      <div
        style={{
          width: 36,
          height: 4,
          borderRadius: 2,
          background: MODOO.hairline,
          margin: "4px auto 12px",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: brand,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="sparkle" size={16} color="#fff" strokeWidth={2.2} />
        </div>
        <div
          style={{
            font: `800 17px/1 ${MODOO.fonts.sans}`,
            letterSpacing: "-0.02em",
          }}
        >
          AI에게 부탁하기
        </div>
        <span
          style={{
            marginLeft: "auto",
            padding: "3px 8px",
            borderRadius: 6,
            background: brand + "14",
            color: brand,
            font: `700 10px/1.4 ${MODOO.fonts.mono}`,
            letterSpacing: "0.06em",
          }}
        >
          BETA
        </span>
      </div>
      <div
        style={{
          marginTop: 14,
          padding: 14,
          borderRadius: 14,
          background: MODOO.surfaceAlt,
          minHeight: 88,
          border: `1.5px solid ${brand}`,
        }}
      >
        <div
          style={{
            font: `500 14px/1.5 ${MODOO.fonts.sans}`,
            color: MODOO.body,
          }}
        >
          <span>
            한양대 컴퓨터공학과 24학번 OT 단체티, 검정색 바탕에 노란 빈티지
            폰트로{" "}
          </span>
          <span
            style={{
              borderBottom: `2px solid ${brand}`,
              position: "relative",
            }}
          >
            &quot;SEOIL &apos;26&quot;
          </span>
          <span
            style={{
              display: "inline-block",
              width: 1.5,
              height: 16,
              background: brand,
              marginLeft: 2,
              verticalAlign: "-3px",
              animation: "modoo-pulse 1s infinite",
            }}
          />
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <div
          style={{
            font: `600 11px/1 ${MODOO.fonts.sans}`,
            color: MODOO.muted,
            marginBottom: 8,
          }}
        >
          이런 식으로 적어보세요
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            "졸업식 야상에 새길 우아한 영문 캘리그라피",
            "농구동호회 져지, 빨강+검정 + 등번호 88",
            "카페 10주년 굿즈티, 따뜻한 일러스트 분위기",
          ].map((s, i) => (
            <div
              key={i}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "#fff",
                border: `1px solid ${MODOO.hairline}`,
                font: `500 12px/1.3 ${MODOO.fonts.sans}`,
                color: MODOO.body,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>{s}</span>
              <Icon name="arrow-up-r" size={14} color={MODOO.muted} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <CTA color={brand}>4가지 시안 만들기 (15초)</CTA>
      </div>
    </div>
  </EditorBase>
);

export const EditorAIResults: React.FC<BrandProp> = ({
  brand = MODOO.brand,
}) => (
  <EditorBase brand={brand}>
    <div style={{ padding: "4px 18px 0", position: "relative" }}>
      <div
        style={{
          font: `500 11px/1 ${MODOO.fonts.mono}`,
          color: "rgba(255,255,255,0.55)",
          letterSpacing: "0.06em",
        }}
      >
        AI · 생성 완료
      </div>
      <div
        style={{
          font: `800 22px/1.25 ${MODOO.fonts.sans}`,
          marginTop: 8,
          letterSpacing: "-0.02em",
        }}
      >
        4가지 시안이 도착했어요
      </div>
      <div
        style={{
          marginTop: 8,
          padding: "6px 10px",
          borderRadius: 8,
          background: "rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          font: `500 11px/1.3 ${MODOO.fonts.sans}`,
          color: "rgba(255,255,255,0.65)",
        }}
      >
        <Icon name="sparkle" size={14} color={brand} />
        <span>&quot;검정 바탕에 노란 빈티지 폰트로 SEOIL &apos;26&quot;</span>
      </div>
    </div>
    <div
      style={{
        padding: "16px 14px 0",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
      }}
    >
      {[
        { c: "#0E1116", a: "#FFD25C", sel: true, s: "01 · vintage" },
        { c: "#0E1116", a: brand, s: "02 · modern" },
        { c: "#FFD25C", a: "#0E1116", s: "03 · invert" },
        { c: "#16331F", a: "#FFD25C", s: "04 · forest" },
      ].map((r, i) => (
        <div
          key={i}
          style={{
            aspectRatio: "1/1.1",
            borderRadius: 14,
            overflow: "hidden",
            background: "rgba(255,255,255,0.04)",
            border: r.sel
              ? `2px solid ${brand}`
              : "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <Tee color={r.c} size={130} accent={r.a} />
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              padding: "2px 7px",
              borderRadius: 5,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(6px)",
              font: `600 9px/1.4 ${MODOO.fonts.mono}`,
              color: "#fff",
              letterSpacing: "0.06em",
            }}
          >
            {r.s}
          </div>
          {r.sel && (
            <div
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                width: 22,
                height: 22,
                borderRadius: 11,
                background: brand,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="check" size={14} color="#fff" strokeWidth={2.4} />
            </div>
          )}
        </div>
      ))}
    </div>
    <div style={{ padding: "14px 16px 0" }}>
      <div
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.04)",
          font: `500 11px/1.4 ${MODOO.fonts.sans}`,
          color: "rgba(255,255,255,0.65)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Icon name="redo" size={14} color="rgba(255,255,255,0.65)" />
        다시 생성 (남은 횟수 4/5)
      </div>
    </div>
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "12px 16px 28px",
        background: "rgba(11,14,19,0.94)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div style={{ display: "flex", gap: 8 }}>
        <button
          style={{
            flex: 1,
            height: 50,
            borderRadius: 12,
            background: "rgba(255,255,255,0.08)",
            color: "#fff",
            font: `700 14px/1 ${MODOO.fonts.sans}`,
          }}
        >
          편집
        </button>
        <button
          style={{
            flex: 1.4,
            height: 50,
            borderRadius: 12,
            background: brand,
            color: "#fff",
            font: `700 14px/1 ${MODOO.fonts.sans}`,
            boxShadow: `0 6px 16px ${brand}66`,
          }}
        >
          이 시안 사용하기
        </button>
      </div>
    </div>
  </EditorBase>
);

export const EditorTextPanel: React.FC<BrandProp> = ({
  brand = MODOO.brand,
}) => (
  <EditorBase brand={brand}>
    <div
      style={{
        margin: "4px 12px 0",
        height: 320,
        borderRadius: 18,
        position: "relative",
        background: "linear-gradient(180deg, #2A2F38 0%, #1A1F28 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "relative", transform: "translateY(-12px)" }}>
        <Tee color="#0E1116" size={210} lining={false} />
        <div
          style={{
            position: "absolute",
            left: "32%",
            top: "34%",
            width: "36%",
            height: "38%",
            border: `1px dashed ${brand}66`,
            borderRadius: 4,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "12% 6% 18% 6%",
              border: `1.5px solid ${brand}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                font: `900 18px/1 "Pretendard"`,
                color: "#FFD25C",
                letterSpacing: "-0.02em",
              }}
            >
              SEOIL&apos;26
            </span>
            {[
              { l: -4, t: -4 },
              { r: -4, t: -4 },
              { l: -4, b: -4 },
              { r: -4, b: -4 },
            ].map((c, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: c.l,
                  top: c.t,
                  right: c.r,
                  bottom: c.b,
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: "#fff",
                  border: `1.5px solid ${brand}`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        background: "#fff",
        color: MODOO.ink,
        borderRadius: "20px 20px 0 0",
        padding: "8px 16px 24px",
        boxShadow: "0 -10px 40px rgba(0,0,0,0.4)",
      }}
    >
      <div
        style={{
          width: 36,
          height: 4,
          borderRadius: 2,
          background: MODOO.hairline,
          margin: "4px auto 12px",
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          paddingBottom: 10,
        }}
      >
        <Icon name="type" size={18} />
        <div style={{ font: `800 15px/1 ${MODOO.fonts.sans}` }}>
          텍스트 편집
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: MODOO.surfaceAlt,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="trash" size={15} />
          </div>
        </div>
      </div>
      <div
        style={{
          padding: 12,
          borderRadius: 10,
          background: MODOO.surfaceAlt,
          font: `800 18px/1 "Pretendard"`,
          letterSpacing: "-0.02em",
        }}
      >
        SEOIL&apos;26
      </div>
      <div style={{ marginTop: 12 }}>
        <div
          style={{
            font: `600 11px/1 ${MODOO.fonts.sans}`,
            color: MODOO.muted,
            marginBottom: 8,
          }}
        >
          폰트
        </div>
        <div
          style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            paddingBottom: 4,
          }}
        >
          {[
            { n: "Pretendard", sel: true, s: "한·영" },
            { n: "Cafe24 빈티지", s: "한·영" },
            { n: "Helvetica", s: "영" },
            { n: "Bauer Bodoni", s: "영" },
            { n: "나눔손글씨", s: "한" },
          ].map((f, i) => (
            <div
              key={i}
              style={{
                minWidth: 96,
                padding: "8px 10px",
                borderRadius: 10,
                flexShrink: 0,
                background: f.sel ? MODOO.ink : "#fff",
                color: f.sel ? "#fff" : MODOO.body,
                border: f.sel ? "none" : `1px solid ${MODOO.hairline}`,
              }}
            >
              <div
                style={{
                  font: `800 13px/1.2 ${MODOO.fonts.sans}`,
                  letterSpacing: "-0.01em",
                }}
              >
                {f.n}
              </div>
              <div
                style={{
                  font: `500 9px/1 ${MODOO.fonts.mono}`,
                  opacity: 0.65,
                  marginTop: 4,
                  letterSpacing: "0.05em",
                }}
              >
                {f.s}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
        <div style={{ flex: 1.2 }}>
          <div
            style={{
              font: `600 11px/1 ${MODOO.fonts.sans}`,
              color: MODOO.muted,
              marginBottom: 8,
            }}
          >
            색상
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              "#FFD25C",
              "#FFFFFF",
              "#FF5C8A",
              brand,
              "#10B981",
              "#0E1116",
            ].map((c, i) => (
              <div
                key={i}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  background: c,
                  outline: i === 0 ? `2px solid ${brand}` : "none",
                  outlineOffset: 2,
                  border:
                    c === "#FFFFFF" ? `1px solid ${MODOO.hairline}` : "none",
                }}
              />
            ))}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              font: `600 11px/1 ${MODOO.fonts.sans}`,
              color: MODOO.muted,
              marginBottom: 8,
            }}
          >
            정렬
          </div>
          <div
            style={{
              display: "flex",
              gap: 4,
              padding: 3,
              borderRadius: 10,
              background: MODOO.surfaceAlt,
            }}
          >
            {["L", "C", "R"].map((a, i) => (
              <div
                key={a}
                style={{
                  flex: 1,
                  height: 28,
                  borderRadius: 7,
                  background: i === 1 ? "#fff" : "transparent",
                  boxShadow: i === 1 ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  font: `700 11px/28px ${MODOO.fonts.mono}`,
                  textAlign: "center",
                }}
              >
                {a}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              font: `600 11px/1 ${MODOO.fonts.sans}`,
              color: MODOO.muted,
            }}
          >
            크기
          </div>
          <div
            className="num"
            style={{
              font: `700 11px/1 ${MODOO.fonts.mono}`,
              color: MODOO.body,
            }}
          >
            92pt
          </div>
        </div>
        <div
          style={{
            height: 24,
            position: "relative",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              height: 4,
              background: MODOO.hairlineSoft,
              borderRadius: 2,
              width: "100%",
            }}
          >
            <div
              style={{
                width: "64%",
                height: "100%",
                background: brand,
                borderRadius: 2,
              }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              left: "64%",
              transform: "translateX(-50%)",
              width: 22,
              height: 22,
              borderRadius: 11,
              background: "#fff",
              border: `1.5px solid ${brand}`,
              boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
            }}
          />
        </div>
      </div>
    </div>
  </EditorBase>
);

export const EditorLayers: React.FC<BrandProp> = ({ brand = MODOO.brand }) => (
  <EditorBase brand={brand}>
    <div
      style={{
        margin: "4px 12px 0",
        height: 340,
        borderRadius: 18,
        position: "relative",
        background: "linear-gradient(180deg, #2A2F38 0%, #1A1F28 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "relative" }}>
        <Tee color="#0E1116" size={220} />
        <div
          style={{
            position: "absolute",
            left: "34%",
            top: "40%",
            width: "32%",
            height: "34%",
            background: "#FFD25C",
            borderRadius: 4,
            opacity: 0.95,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: `900 22px/1 "Pretendard"`,
            color: "#0E1116",
          }}
        >
          SEOIL
        </div>
      </div>
    </div>
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        background: "#fff",
        color: MODOO.ink,
        borderRadius: "20px 20px 0 0",
        padding: "8px 16px 24px",
        maxHeight: 380,
      }}
    >
      <div
        style={{
          width: 36,
          height: 4,
          borderRadius: 2,
          background: MODOO.hairline,
          margin: "4px auto 12px",
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          paddingBottom: 12,
        }}
      >
        <Icon name="layers" size={18} />
        <div style={{ font: `800 15px/1 ${MODOO.fonts.sans}` }}>레이어 (4)</div>
        <span
          style={{
            marginLeft: "auto",
            font: `600 12px/1 ${MODOO.fonts.sans}`,
            color: brand,
          }}
        >
          완료
        </span>
      </div>
      {(
        [
          {
            i: "type",
            n: "SEOIL '26",
            s: "Pretendard 92pt · 노랑",
            sel: true,
            vis: true,
            lock: false,
          },
          {
            i: "shapes",
            n: "둥근 사각형",
            s: "#FFD25C · 채움",
            vis: true,
            lock: false,
          },
          {
            i: "image",
            n: "학교 로고.png",
            s: "PNG · 1.2MB · 240×240",
            vis: true,
            lock: true,
          },
          {
            i: "sticker",
            n: "하트 스티커",
            s: "내장 라이브러리",
            vis: false,
            lock: false,
          },
        ] as {
          i: IconName;
          n: string;
          s: string;
          sel?: boolean;
          vis: boolean;
          lock: boolean;
        }[]
      ).map((l, i) => (
        <div
          key={i}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            marginBottom: 6,
            background: l.sel ? brand + "10" : "#fff",
            border: l.sel
              ? `1.5px solid ${brand}`
              : `1px solid ${MODOO.hairline}`,
            display: "flex",
            alignItems: "center",
            gap: 12,
            opacity: l.vis ? 1 : 0.5,
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              background: MODOO.surfaceAlt,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name={l.i} size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: `700 13px/1.2 ${MODOO.fonts.sans}` }}>
              {l.n}
            </div>
            <div
              style={{
                font: `500 11px/1.2 ${MODOO.fonts.sans}`,
                color: MODOO.muted,
                marginTop: 3,
              }}
            >
              {l.s}
            </div>
          </div>
          {l.lock && (
            <div style={{ width: 18, height: 18, color: MODOO.faint }}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </div>
          )}
          <div
            style={{
              width: 24,
              height: 24,
              color: l.vis ? MODOO.body : MODOO.faint,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              {l.vis ? (
                <>
                  <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              ) : (
                <>
                  <path d="M3 3l18 18" />
                  <path d="M10.6 6.6A10 10 0 0 1 12 5c6 0 10 7 10 7a18 18 0 0 1-3 3.7M6.5 6.5C3.6 8.3 2 12 2 12s4 7 10 7c1.4 0 2.7-.3 3.9-.7" />
                </>
              )}
            </svg>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              color: MODOO.faint,
            }}
          >
            {[0, 1].map((d) => (
              <div
                key={d}
                style={{
                  width: 14,
                  height: 2,
                  background: "currentColor",
                  borderRadius: 1,
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  </EditorBase>
);

export const EditorWarning: React.FC<BrandProp> = ({
  brand = MODOO.brand,
}) => (
  <EditorBase brand={brand}>
    <div
      style={{
        margin: "4px 12px 0",
        height: 380,
        borderRadius: 18,
        position: "relative",
        background: "#1A1F28",
        filter: "brightness(0.45)",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Tee color="#0E1116" size={240} accent={brand} />
    </div>
    <div
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        top: 100,
        background: "#fff",
        color: MODOO.ink,
        borderRadius: 20,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        padding: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            background: MODOO.warn + "22",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="ruler" size={20} color={MODOO.warn} />
        </div>
        <div
          style={{
            font: `800 16px/1.2 ${MODOO.fonts.sans}`,
            letterSpacing: "-0.01em",
          }}
        >
          이미지가 인쇄에 살짝 작아요
        </div>
      </div>
      <div
        style={{
          marginTop: 14,
          padding: 12,
          borderRadius: 10,
          background: MODOO.surfaceAlt,
        }}
      >
        <div
          style={{
            font: `500 12px/1.5 ${MODOO.fonts.sans}`,
            color: MODOO.body,
          }}
        >
          업로드한 <b>학교 로고.png</b>는 144 DPI예요.
          <br />A4 인쇄 시 권장 해상도는{" "}
          <b style={{ color: brand }}>300 DPI 이상</b>이에요.
        </div>
      </div>
      <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
        <div
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 10,
            background: MODOO.surfaceAlt,
            textAlign: "center",
          }}
        >
          <div
            className="num"
            style={{
              font: `800 18px/1 ${MODOO.fonts.sans}`,
              color: MODOO.warn,
              letterSpacing: "-0.02em",
            }}
          >
            144
          </div>
          <div
            style={{
              font: `500 10px/1 ${MODOO.fonts.mono}`,
              color: MODOO.muted,
              marginTop: 6,
              letterSpacing: "0.05em",
            }}
          >
            YOUR DPI
          </div>
        </div>
        <div
          style={{
            width: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: MODOO.faint,
          }}
        >
          →
        </div>
        <div
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 10,
            background: brand + "10",
            textAlign: "center",
            border: `1px solid ${brand}40`,
          }}
        >
          <div
            className="num"
            style={{
              font: `800 18px/1 ${MODOO.fonts.sans}`,
              color: brand,
              letterSpacing: "-0.02em",
            }}
          >
            300
          </div>
          <div
            style={{
              font: `500 10px/1 ${MODOO.fonts.mono}`,
              color: brand,
              marginTop: 6,
              letterSpacing: "0.05em",
            }}
          >
            RECOMMENDED
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 14,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <button
          style={{
            width: "100%",
            height: 46,
            borderRadius: 12,
            background: brand,
            color: "#fff",
            font: `700 14px/1 ${MODOO.fonts.sans}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Icon name="sparkle" size={16} color="#fff" /> AI로 화질 키우기 (무료)
        </button>
        <button
          style={{
            width: "100%",
            height: 46,
            borderRadius: 12,
            background: "#fff",
            color: MODOO.body,
            border: `1px solid ${MODOO.hairline}`,
            font: `600 13px/1 ${MODOO.fonts.sans}`,
          }}
        >
          고화질 파일 다시 올리기
        </button>
        <button
          style={{
            width: "100%",
            height: 36,
            color: MODOO.muted,
            font: `500 12px/1 ${MODOO.fonts.sans}`,
            background: "transparent",
          }}
        >
          그대로 진행할게요
        </button>
      </div>
    </div>
  </EditorBase>
);

export const EditorUpload: React.FC<BrandProp> = ({ brand = MODOO.brand }) => (
  <EditorBase brand={brand}>
    <div
      style={{
        margin: "4px 12px 0",
        height: 320,
        borderRadius: 18,
        position: "relative",
        background: "#1A1F28",
        filter: "brightness(0.5)",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Tee color="#0E1116" size={200} lining={false} />
    </div>
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        background: "#fff",
        color: MODOO.ink,
        borderRadius: "20px 20px 0 0",
        padding: "8px 18px 28px",
      }}
    >
      <div
        style={{
          width: 36,
          height: 4,
          borderRadius: 2,
          background: MODOO.hairline,
          margin: "4px auto 14px",
        }}
      />
      <div
        style={{
          font: `800 17px/1 ${MODOO.fonts.sans}`,
          letterSpacing: "-0.02em",
        }}
      >
        이미지 추가
      </div>
      <div
        style={{
          font: `500 12px/1.4 ${MODOO.fonts.sans}`,
          color: MODOO.muted,
          marginTop: 4,
        }}
      >
        PNG·JPG·SVG·AI 지원 · 한 번에 10장까지
      </div>
      <div
        style={{
          marginTop: 16,
          padding: 18,
          borderRadius: 14,
          border: `1.5px dashed ${brand}66`,
          background: brand + "06",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `1px solid ${MODOO.hairline}`,
          }}
        >
          <Icon name="image" size={22} color={brand} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ font: `700 14px/1.2 ${MODOO.fonts.sans}` }}>
            여기를 눌러 업로드
          </div>
          <div
            style={{
              font: `500 11px/1.4 ${MODOO.fonts.sans}`,
              color: MODOO.muted,
              marginTop: 4,
            }}
          >
            10MB 이하 · 권장 300DPI 이상
          </div>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginTop: 10,
        }}
      >
        {(
          [
            { i: "image", l: "내 사진", s: "갤러리에서" },
            { i: "send", l: "구글 드라이브", s: "연동됨" },
          ] as { i: IconName; l: string; s: string }[]
        ).map((c, i) => (
          <div
            key={i}
            style={{
              padding: 14,
              borderRadius: 12,
              background: MODOO.surfaceAlt,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Icon name={c.i} size={18} color={MODOO.body} />
            <div>
              <div style={{ font: `700 12px/1.2 ${MODOO.fonts.sans}` }}>
                {c.l}
              </div>
              <div
                style={{
                  font: `500 10px/1.2 ${MODOO.fonts.sans}`,
                  color: MODOO.muted,
                  marginTop: 2,
                }}
              >
                {c.s}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <div
          style={{
            font: `600 11px/1 ${MODOO.fonts.sans}`,
            color: MODOO.muted,
            marginBottom: 8,
          }}
        >
          내 보관함 · 최근
        </div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
          {(
            [
              { l: "학교 로고", tone: "cool" },
              { l: "24OT 글자", tone: "warm" },
              { l: "동아리 마스코트", tone: "blue" },
              { l: "작년 디자인", tone: "gray" },
            ] as { l: string; tone: "cool" | "warm" | "blue" | "gray" }[]
          ).map((it, i) => (
            <div
              key={i}
              style={{
                minWidth: 80,
                height: 80,
                borderRadius: 10,
                overflow: "hidden",
                flexShrink: 0,
                position: "relative",
              }}
            >
              <Placeholder label={it.l} tone={it.tone} />
              {i === 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    background: brand,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon
                    name="check"
                    size={12}
                    color="#fff"
                    strokeWidth={2.4}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  </EditorBase>
);

export const EditorPreview: React.FC<BrandProp> = ({
  brand = MODOO.brand,
}) => (
  <EditorBase brand={brand}>
    <div style={{ padding: "4px 18px 0" }}>
      <div
        style={{
          font: `500 11px/1 ${MODOO.fonts.mono}`,
          color: "rgba(255,255,255,0.55)",
          letterSpacing: "0.06em",
        }}
      >
        FINAL PREVIEW
      </div>
      <div
        style={{
          font: `800 22px/1.25 ${MODOO.fonts.sans}`,
          marginTop: 8,
          letterSpacing: "-0.02em",
        }}
      >
        앞·뒤 모두 확인하셨나요?
      </div>
      <div
        style={{
          font: `500 12px/1.4 ${MODOO.fonts.sans}`,
          color: "rgba(255,255,255,0.65)",
          marginTop: 6,
        }}
      >
        제작 후엔 수정이 어려워요. 한 번 더 봐주세요.
      </div>
    </div>
    <div
      style={{
        padding: "18px 12px 0",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
      }}
    >
      {[
        { l: "앞면", a: "#FFD25C", t: "SEOIL" },
        { l: "뒷면", a: brand, t: "24" },
      ].map((s, i) => (
        <div
          key={i}
          style={{
            aspectRatio: "1/1.15",
            borderRadius: 14,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ position: "relative" }}>
            <Tee color="#0E1116" size={140} lining={false} />
            <div
              style={{
                position: "absolute",
                left: "36%",
                top: i === 0 ? "36%" : "34%",
                width: "28%",
                height: "24%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                font: `900 ${i === 0 ? 13 : 22}px/1 "Pretendard"`,
                color: s.a,
                letterSpacing: "-0.02em",
              }}
            >
              {s.t}
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              padding: "3px 8px",
              borderRadius: 6,
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(6px)",
              font: `700 10px/1.4 ${MODOO.fonts.mono}`,
              letterSpacing: "0.08em",
            }}
          >
            {s.l.toUpperCase()}
          </div>
        </div>
      ))}
    </div>
    <div
      style={{
        margin: "14px 16px 0",
        padding: 14,
        borderRadius: 12,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {[
        { l: "의류", v: "드라이 라운드 반팔 · 블랙" },
        { l: "인쇄", v: "실크 4도 · 앞 + 뒤" },
        { l: "인쇄 영역", v: "A4 (297×210mm)" },
        { l: "예상 단가", v: "₩4,900 / 장" },
      ].map((r, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "7px 0",
            borderTop: i ? "1px solid rgba(255,255,255,0.06)" : "none",
          }}
        >
          <span
            style={{
              font: `500 12px/1 ${MODOO.fonts.sans}`,
              color: "rgba(255,255,255,0.55)",
            }}
          >
            {r.l}
          </span>
          <span
            className="num"
            style={{ font: `700 12px/1 ${MODOO.fonts.sans}` }}
          >
            {r.v}
          </span>
        </div>
      ))}
    </div>
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "12px 16px 28px",
        background: "rgba(11,14,19,0.94)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(12px)",
        display: "flex",
        gap: 8,
      }}
    >
      <button
        style={{
          flex: 1,
          height: 50,
          borderRadius: 12,
          background: "rgba(255,255,255,0.08)",
          color: "#fff",
          font: `700 14px/1 ${MODOO.fonts.sans}`,
        }}
      >
        다시 편집
      </button>
      <button
        style={{
          flex: 1.4,
          height: 50,
          borderRadius: 12,
          background: brand,
          color: "#fff",
          font: `700 14px/1 ${MODOO.fonts.sans}`,
          boxShadow: `0 6px 16px ${brand}66`,
        }}
      >
        인쇄 방식 선택
      </button>
    </div>
  </EditorBase>
);

export const EditorSaving: React.FC<BrandProp> = ({ brand = MODOO.brand }) => (
  <EditorBase brand={brand}>
    <div
      style={{
        margin: "4px 12px 0",
        height: 400,
        borderRadius: 18,
        position: "relative",
        background: "#1A1F28",
        filter: "brightness(0.45)",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Tee color="#0E1116" size={220} accent="#FFD25C" />
    </div>
    <div
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        top: 220,
        background: "#fff",
        color: MODOO.ink,
        borderRadius: 20,
        padding: 22,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          margin: "0 auto",
          background: brand + "14",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `3px solid ${brand}22`,
            borderTopColor: brand,
            animation: "modoo-spin .9s linear infinite",
          }}
        />
        <Icon name="sparkle" size={22} color={brand} />
      </div>
      <div
        style={{
          font: `800 17px/1.25 ${MODOO.fonts.sans}`,
          marginTop: 16,
          letterSpacing: "-0.02em",
        }}
      >
        디자인을 정리하는 중…
      </div>
      <div
        style={{
          font: `500 12px/1.5 ${MODOO.fonts.sans}`,
          color: MODOO.muted,
          marginTop: 8,
        }}
      >
        인쇄용 고해상도 파일로 변환하고 있어요.
        <br />
        잠시만요, 5초 안에 끝나요.
      </div>
      <div
        style={{
          marginTop: 18,
          height: 6,
          borderRadius: 6,
          background: MODOO.surfaceAlt,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            height: "100%",
            width: "40%",
            background: brand,
            borderRadius: 6,
            animation: "modoo-progress 1.4s ease-in-out infinite",
          }}
        />
      </div>
      <div style={{ marginTop: 16, textAlign: "left" }}>
        {[
          { l: "레이어 병합", done: true, current: false },
          { l: "CMYK 색공간 변환", done: true, current: false },
          { l: "인쇄 영역 검수", done: false, current: true },
          { l: "미리보기 렌더링", done: false, current: false },
        ].map((s, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 0",
              color: s.done
                ? MODOO.body
                : s.current
                  ? brand
                  : MODOO.faint,
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                background: s.done
                  ? brand
                  : s.current
                    ? brand + "22"
                    : "transparent",
                border: s.done
                  ? "none"
                  : `1.5px solid ${s.current ? brand : MODOO.hairline}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {s.done && (
                <Icon name="check" size={11} color="#fff" strokeWidth={2.6} />
              )}
              {s.current && (
                <div
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 2.5,
                    background: brand,
                    animation: "modoo-pulse 1s infinite",
                  }}
                />
              )}
            </div>
            <span
              style={{
                font: `${s.current ? 700 : 500} 12px/1.3 ${MODOO.fonts.sans}`,
              }}
            >
              {s.l}
            </span>
          </div>
        ))}
      </div>
    </div>
  </EditorBase>
);

export const EditorTemplates: React.FC<BrandProp> = ({
  brand = MODOO.brand,
}) => (
  <EditorBase brand={brand}>
    <div style={{ padding: "4px 18px 0" }}>
      <div
        style={{
          font: `500 11px/1 ${MODOO.fonts.mono}`,
          color: "rgba(255,255,255,0.55)",
          letterSpacing: "0.06em",
        }}
      >
        TEMPLATES · 218
      </div>
      <div
        style={{
          font: `800 22px/1.25 ${MODOO.fonts.sans}`,
          marginTop: 8,
          letterSpacing: "-0.02em",
        }}
      >
        한 번 클릭으로
        <br />
        거의 완성된 디자인
      </div>
    </div>
    <div
      style={{
        padding: "14px 16px 0",
        display: "flex",
        gap: 6,
        overflowX: "auto",
      }}
    >
      {[
        { l: "전체", a: false },
        { l: "대학 동아리", a: true },
        { l: "회사 단체복", a: false },
        { l: "스포츠", a: false },
        { l: "카페·매장", a: false },
        { l: "결혼·이벤트", a: false },
      ].map((c, i) => (
        <div
          key={i}
          style={{
            padding: "7px 12px",
            borderRadius: 999,
            flexShrink: 0,
            background: c.a ? brand : "rgba(255,255,255,0.06)",
            border: c.a ? "none" : "1px solid rgba(255,255,255,0.08)",
            font: `${c.a ? 700 : 500} 12px/1 ${MODOO.fonts.sans}`,
            color: "#fff",
          }}
        >
          {c.l}
        </div>
      ))}
    </div>
    <div
      style={{
        padding: "14px 12px 0",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
      }}
    >
      {[
        { c: "#0E1116", a: "#FFD25C", n: "24학번 OT", cat: "동아리 · 1.2k 사용" },
        { c: brand, a: "#fff", n: "연구실 폴로", cat: "대학원 · 840 사용" },
        { c: "#16331F", a: "#FFD25C", n: "리그전 져지", cat: "스포츠 · 612 사용" },
        { c: "#FF5C8A", a: "#fff", n: "졸업의 밤", cat: "이벤트 · 502 사용" },
      ].map((t, i) => (
        <div
          key={i}
          style={{
            aspectRatio: "1/1.25",
            borderRadius: 14,
            padding: 10,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              flex: 1,
              borderRadius: 10,
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <Tee color={t.c} size={110} accent={t.a} />
            {i === 0 && (
              <div
                style={{
                  position: "absolute",
                  top: 6,
                  left: 6,
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: brand,
                  font: `700 9px/1.4 ${MODOO.fonts.mono}`,
                  letterSpacing: "0.06em",
                }}
              >
                BEST
              </div>
            )}
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={{ font: `700 12px/1.2 ${MODOO.fonts.sans}` }}>
              {t.n}
            </div>
            <div
              style={{
                font: `500 10px/1.2 ${MODOO.fonts.sans}`,
                color: "rgba(255,255,255,0.55)",
                marginTop: 3,
              }}
            >
              {t.cat}
            </div>
          </div>
        </div>
      ))}
    </div>
    <div style={{ height: 80 }} />
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "12px 16px 28px",
        background: "rgba(11,14,19,0.94)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          justifyContent: "center",
          font: `500 11px/1.3 ${MODOO.fonts.sans}`,
          color: "rgba(255,255,255,0.55)",
        }}
      >
        <Icon name="check" size={14} color={brand} />
        모든 템플릿은 무료, 가져온 뒤 자유롭게 편집할 수 있어요
      </div>
    </div>
  </EditorBase>
);
