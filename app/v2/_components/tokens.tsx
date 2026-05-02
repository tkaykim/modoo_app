"use client";

import * as React from "react";

export const MODOO = {
  brand: "#0052CC",
  brandDeep: "#003D99",
  brandSoft: "#E6EEFB",
  brandSofter: "#F2F6FC",
  brandInk: "#001F5C",

  ink: "#0E1116",
  body: "#1F242C",
  muted: "#5C6573",
  faint: "#8A93A2",
  hairline: "#E6E8EC",
  hairlineSoft: "#EEF0F4",
  surface: "#FFFFFF",
  surfaceAlt: "#F7F8FA",
  surfaceWarm: "#FAFAF7",

  pos: "#10B981",
  warn: "#F59E0B",
  err: "#EF4444",
  pink: "#FF5C8A",
  yolk: "#FFD25C",

  r: { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 },

  fonts: {
    sans: '"Pretendard","Pretendard Variable",-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif',
    display:
      '"Pretendard","Pretendard Variable",-apple-system,"Apple SD Gothic Neo",system-ui,sans-serif',
    mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  },
} as const;

export type IconName =
  | "home"
  | "grid"
  | "box"
  | "user"
  | "cart"
  | "search"
  | "arrow-r"
  | "arrow-l"
  | "arrow-up-r"
  | "plus"
  | "minus"
  | "check"
  | "close"
  | "heart"
  | "heart-fill"
  | "star"
  | "star-fill"
  | "truck"
  | "package"
  | "sparkle"
  | "palette"
  | "image"
  | "type"
  | "shapes"
  | "undo"
  | "redo"
  | "layers"
  | "rotate"
  | "bookmark"
  | "bell"
  | "card"
  | "pin"
  | "chevron-r"
  | "chevron-d"
  | "share"
  | "qr"
  | "flame"
  | "group"
  | "tag"
  | "edit"
  | "trash"
  | "filter"
  | "sort"
  | "menu"
  | "phone"
  | "gift"
  | "send"
  | "verified"
  | "leaf"
  | "sticker"
  | "crop"
  | "bg"
  | "ruler";

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 22,
  color = "currentColor",
  strokeWidth = 1.7,
}) => {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: color,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "home":
      return (
        <svg {...p}>
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5 10v9h14v-9" />
        </svg>
      );
    case "grid":
      return (
        <svg {...p}>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "box":
      return (
        <svg {...p}>
          <path d="M3.5 7.5 12 4l8.5 3.5v9L12 20l-8.5-3.5z" />
          <path d="M3.5 7.5 12 11l8.5-3.5" />
          <path d="M12 11v9" />
        </svg>
      );
    case "user":
      return (
        <svg {...p}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c1-3.5 4-5.5 7-5.5s6 2 7 5.5" />
        </svg>
      );
    case "cart":
      return (
        <svg {...p}>
          <path d="M3.5 4.5h2.5l2 12h11" />
          <path d="M7 8h13l-1.5 7H8.5" />
          <circle cx="10" cy="20" r="1.2" />
          <circle cx="17" cy="20" r="1.2" />
        </svg>
      );
    case "search":
      return (
        <svg {...p}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case "arrow-r":
      return (
        <svg {...p}>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );
    case "arrow-l":
      return (
        <svg {...p}>
          <path d="M19 12H5" />
          <path d="m11 18-6-6 6-6" />
        </svg>
      );
    case "arrow-up-r":
      return (
        <svg {...p}>
          <path d="M7 17 17 7" />
          <path d="M9 7h8v8" />
        </svg>
      );
    case "plus":
      return (
        <svg {...p}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "minus":
      return (
        <svg {...p}>
          <path d="M5 12h14" />
        </svg>
      );
    case "check":
      return (
        <svg {...p}>
          <path d="m5 12 5 5L20 7" />
        </svg>
      );
    case "close":
      return (
        <svg {...p}>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      );
    case "heart":
      return (
        <svg {...p}>
          <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />
        </svg>
      );
    case "heart-fill":
      return (
        <svg {...p} fill={color} stroke="none">
          <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />
        </svg>
      );
    case "star":
      return (
        <svg {...p}>
          <path d="m12 4 2.5 5 5.5.8-4 4 1 5.6L12 16.8 7 19.4l1-5.6-4-4 5.5-.8z" />
        </svg>
      );
    case "star-fill":
      return (
        <svg {...p} fill={color} stroke="none">
          <path d="m12 4 2.5 5 5.5.8-4 4 1 5.6L12 16.8 7 19.4l1-5.6-4-4 5.5-.8z" />
        </svg>
      );
    case "truck":
      return (
        <svg {...p}>
          <path d="M3 6.5h11v9H3z" />
          <path d="M14 9.5h4l3 3v3h-7" />
          <circle cx="7.5" cy="17" r="1.6" />
          <circle cx="17" cy="17" r="1.6" />
        </svg>
      );
    case "package":
      return (
        <svg {...p}>
          <path d="M3.5 7.5 12 4l8.5 3.5v9L12 20l-8.5-3.5z" />
          <path d="M3.5 7.5 12 11l8.5-3.5" />
          <path d="M12 11v9" />
          <path d="m7.5 5.7 8.5 3.6" />
        </svg>
      );
    case "sparkle":
      return (
        <svg {...p}>
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
        </svg>
      );
    case "palette":
      return (
        <svg {...p}>
          <path d="M12 4a8 8 0 1 0 0 16c1 0 1.5-.7 1.5-1.5 0-1-1-1-1-2.2 0-1.6 1.4-2.3 3.5-2.3H18a4 4 0 0 0 0-8 8 8 0 0 0-6-2z" />
          <circle cx="7.5" cy="11" r="1" />
          <circle cx="10" cy="7.5" r="1" />
          <circle cx="15" cy="7.5" r="1" />
        </svg>
      );
    case "image":
      return (
        <svg {...p}>
          <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
          <circle cx="9" cy="10" r="1.5" />
          <path d="m4 17 5-5 4 4 3-3 4 4" />
        </svg>
      );
    case "type":
      return (
        <svg {...p}>
          <path d="M5 6V5h14v1M12 5v14M9 19h6" />
        </svg>
      );
    case "shapes":
      return (
        <svg {...p}>
          <circle cx="7" cy="7" r="3" />
          <rect x="13" y="4" width="7" height="7" rx="1.2" />
          <path d="M12 14l4 6H8z" />
        </svg>
      );
    case "undo":
      return (
        <svg {...p}>
          <path d="M9 14 4 9l5-5" />
          <path d="M4 9h9a6 6 0 0 1 0 12h-3" />
        </svg>
      );
    case "redo":
      return (
        <svg {...p}>
          <path d="m15 14 5-5-5-5" />
          <path d="M20 9h-9a6 6 0 0 0 0 12h3" />
        </svg>
      );
    case "layers":
      return (
        <svg {...p}>
          <path d="m12 4 9 5-9 5-9-5z" />
          <path d="m3 14 9 5 9-5" />
        </svg>
      );
    case "rotate":
      return (
        <svg {...p}>
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <path d="M21 4v5h-5" />
        </svg>
      );
    case "bookmark":
      return (
        <svg {...p}>
          <path d="M6 4h12v17l-6-4-6 4z" />
        </svg>
      );
    case "bell":
      return (
        <svg {...p}>
          <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
      );
    case "card":
      return (
        <svg {...p}>
          <rect x="3.5" y="6" width="17" height="12" rx="2" />
          <path d="M3.5 10h17" />
          <path d="M7 15h3" />
        </svg>
      );
    case "pin":
      return (
        <svg {...p}>
          <path d="M12 21s-6-6-6-11a6 6 0 1 1 12 0c0 5-6 11-6 11z" />
          <circle cx="12" cy="10" r="2" />
        </svg>
      );
    case "chevron-r":
      return (
        <svg {...p}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      );
    case "chevron-d":
      return (
        <svg {...p}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
    case "share":
      return (
        <svg {...p}>
          <path d="M12 4v12" />
          <path d="m7 9 5-5 5 5" />
          <path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
        </svg>
      );
    case "qr":
      return (
        <svg {...p}>
          <rect x="4" y="4" width="6" height="6" rx="1" />
          <rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" />
          <path d="M14 14h2v2h-2zM18 14h2v2M14 18h2v2M18 18h2v2" />
        </svg>
      );
    case "flame":
      return (
        <svg {...p}>
          <path d="M12 3c2 4-2 5-2 9a4 4 0 0 0 8 0c0-2-1-3-2-4 1 4-2 5-4 5-1-3 2-5 0-10z" />
        </svg>
      );
    case "group":
      return (
        <svg {...p}>
          <circle cx="9" cy="8" r="3" />
          <circle cx="16" cy="9" r="2.5" />
          <path d="M3.5 19c.7-2.5 3-4 5.5-4s4.8 1.5 5.5 4" />
          <path d="M14 16c.5-1.5 2-2 3.5-2s2.5.5 3 2" />
        </svg>
      );
    case "tag":
      return (
        <svg {...p}>
          <path d="M3.5 12.5 12 4h7v7l-8.5 8.5z" />
          <circle cx="15.5" cy="8.5" r="1.2" />
        </svg>
      );
    case "edit":
      return (
        <svg {...p}>
          <path d="M4 20h4l11-11-4-4L4 16z" />
          <path d="m13 6 4 4" />
        </svg>
      );
    case "trash":
      return (
        <svg {...p}>
          <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
        </svg>
      );
    case "filter":
      return (
        <svg {...p}>
          <path d="M3 5h18l-7 9v6l-4-2v-4z" />
        </svg>
      );
    case "sort":
      return (
        <svg {...p}>
          <path d="M7 4v16M4 7l3-3 3 3M17 4v16M14 17l3 3 3-3" />
        </svg>
      );
    case "menu":
      return (
        <svg {...p}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      );
    case "phone":
      return (
        <svg {...p}>
          <path d="M5 4h4l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />
        </svg>
      );
    case "gift":
      return (
        <svg {...p}>
          <rect x="3.5" y="9" width="17" height="11" rx="1.5" />
          <path d="M3.5 9h17" />
          <path d="M12 9v11" />
          <path d="M12 9c-2 0-4-1.5-4-3a2 2 0 0 1 4 0c0-1.5 2-3 4-3a2 2 0 0 1 0 4c-1.5 0-4-1-4-1z" />
        </svg>
      );
    case "send":
      return (
        <svg {...p}>
          <path d="M21 4 11 14" />
          <path d="M21 4 14 21l-3-7-7-3z" />
        </svg>
      );
    case "verified":
      return (
        <svg {...p}>
          <path d="m4 12 2.5-2.5L4 7l3-1.5L8 2.5l3 1L13 1l1.5 2.5L17 4l.5 3 2.5 2-2 2.5.5 3-3 .5-1 2.5-3-1-2 2-2-2-3 1z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "leaf":
      return (
        <svg {...p}>
          <path d="M5 19c0-8 6-14 15-14 0 9-6 14-14 14" />
          <path d="M5 19 12 12" />
        </svg>
      );
    case "sticker":
      return (
        <svg {...p}>
          <path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a4 4 0 0 0 4-4V10z" />
          <path d="M14 4v4a2 2 0 0 0 2 2h4" />
        </svg>
      );
    case "crop":
      return (
        <svg {...p}>
          <path d="M6 2v16h16" />
          <path d="M2 6h16v16" />
        </svg>
      );
    case "bg":
      return (
        <svg {...p}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
          <path d="m4 16 4-4 4 4 3-3 5 5" />
          <circle cx="9" cy="9" r="1.5" />
        </svg>
      );
    case "ruler":
      return (
        <svg {...p}>
          <path d="m3 14 11-11 7 7L10 21z" />
          <path d="M7 10v3M10 7v3M13 10v3M10 13v3M16 10v3" />
        </svg>
      );
    default:
      return null;
  }
};

interface PlaceholderProps {
  label?: string;
  tone?: "warm" | "cool" | "blue" | "gray" | "dark";
  style?: React.CSSProperties;
}

export const Placeholder: React.FC<PlaceholderProps> = ({
  label = "product shot",
  tone = "warm",
  style = {},
}) => {
  const tones = {
    warm: { a: "#EFE9DD", b: "#E5DCC8", t: "#7A6A4A" },
    cool: { a: "#E1E8F2", b: "#CFDAEA", t: "#3F5275" },
    blue: { a: "#DCE7FA", b: "#C8D8F4", t: "#1A3D86" },
    gray: { a: "#EEF0F4", b: "#E2E5EB", t: "#5C6573" },
    dark: { a: "#1A1F28", b: "#0F141B", t: "#8A93A2" },
  }[tone];
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: `repeating-linear-gradient(135deg, ${tones.a} 0 8px, ${tones.b} 8px 16px)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      <span
        style={{
          font: `500 10px/1.2 ${MODOO.fonts.mono}`,
          color: tones.t,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          padding: "4px 8px",
          background: "rgba(255,255,255,0.7)",
          borderRadius: 4,
        }}
      >
        {label}
      </span>
    </div>
  );
};

interface TeeProps {
  color?: string;
  accent?: string | null;
  size?: number;
  lining?: boolean;
}

export const Tee: React.FC<TeeProps> = ({
  color = "#0052CC",
  accent = null,
  size = 220,
  lining = true,
}) => {
  return (
    <svg
      viewBox="0 0 220 240"
      width={size}
      height={(size * 240) / 220}
      style={{ display: "block" }}
    >
      <path
        d="M52 28 L88 16 Q110 32 132 16 L168 28 L208 50 L188 92 L168 80 L168 220 Q168 228 160 228 L60 228 Q52 228 52 220 L52 80 L32 92 L12 50 Z"
        fill={color}
      />
      {lining && (
        <path
          d="M88 16 Q110 32 132 16 L128 22 Q110 38 92 22 Z"
          fill="rgba(0,0,0,0.18)"
        />
      )}
      {accent && (
        <rect
          x="78"
          y="78"
          width="64"
          height="80"
          rx="2"
          fill={accent}
          opacity="0.28"
          stroke={accent}
          strokeDasharray="3 3"
          strokeWidth="1"
        />
      )}
    </svg>
  );
};

interface TabBarProps {
  active?: "home" | "shop" | "editor" | "orders" | "me";
  onChange?: (id: string) => void;
  brand?: string;
}

export const TabBar: React.FC<TabBarProps> = ({
  active = "home",
  onChange,
  brand = MODOO.brand,
}) => {
  const tabs: { id: TabBarProps["active"]; icon: IconName; label: string }[] = [
    { id: "home", icon: "home", label: "홈" },
    { id: "shop", icon: "grid", label: "상품" },
    { id: "editor", icon: "sparkle", label: "디자인" },
    { id: "orders", icon: "box", label: "주문" },
    { id: "me", icon: "user", label: "MY" },
  ];
  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 480,
        paddingBottom: 22,
        paddingTop: 8,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderTop: `0.5px solid ${MODOO.hairline}`,
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        zIndex: 50,
      }}
    >
      {tabs.map((t) => {
        const isActive = t.id === active;
        const isCenter = t.id === "editor";
        if (isCenter) {
          return (
            <button
              key={t.id}
              onClick={() => onChange && onChange(t.id!)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
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
                  boxShadow: `0 8px 18px ${brand}66, 0 2px 0 rgba(255,255,255,0.4) inset`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                }}
              >
                <Icon name="sparkle" size={24} color="#fff" strokeWidth={2} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: brand }}>
                {t.label}
              </span>
            </button>
          );
        }
        return (
          <button
            key={t.id}
            onClick={() => onChange && onChange(t.id!)}
            style={{
              background: "none",
              border: "none",
              padding: "6px 14px",
              cursor: "pointer",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
            }}
          >
            <Icon
              name={t.icon}
              size={22}
              color={isActive ? MODOO.ink : MODOO.faint}
              strokeWidth={isActive ? 2 : 1.6}
            />
            <span
              style={{
                fontSize: 10,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? MODOO.ink : MODOO.faint,
              }}
            >
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

interface AppBarProps {
  title?: React.ReactNode;
  left?: React.ReactNode;
  right?: React.ReactNode;
  transparent?: boolean;
  sub?: React.ReactNode;
  brand?: string;
}

export const AppBar: React.FC<AppBarProps> = ({
  title,
  left,
  right,
  transparent = false,
  sub = null,
}) => (
  <div
    style={{
      paddingTop: 6,
      paddingBottom: sub ? 4 : 8,
      paddingLeft: 6,
      paddingRight: 6,
      background: transparent ? "transparent" : "#fff",
      borderBottom: transparent
        ? "none"
        : `0.5px solid ${MODOO.hairlineSoft}`,
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: 44,
      }}
    >
      <div
        style={{
          width: 44,
          display: "flex",
          justifyContent: "flex-start",
          paddingLeft: 8,
        }}
      >
        {left}
      </div>
      <div
        style={{
          flex: 1,
          textAlign: "center",
          font: `600 16px/1.2 ${MODOO.fonts.sans}`,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </div>
      <div
        style={{
          width: 44,
          display: "flex",
          justifyContent: "flex-end",
          paddingRight: 8,
        }}
      >
        {right}
      </div>
    </div>
    {sub}
  </div>
);

interface CTAProps {
  children?: React.ReactNode;
  color?: string;
  fg?: string;
  sub?: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
  full?: boolean;
  ghost?: boolean;
}

export const CTA: React.FC<CTAProps> = ({
  children,
  color = MODOO.brand,
  fg = "#fff",
  sub,
  style = {},
  onClick,
  full = true,
  ghost = false,
}) => (
  <button
    onClick={onClick}
    style={{
      width: full ? "100%" : "auto",
      minHeight: 52,
      borderRadius: 14,
      background: ghost ? "transparent" : color,
      border: ghost ? `1.5px solid ${color}` : "none",
      color: ghost ? color : fg,
      font: `700 16px/1.2 ${MODOO.fonts.sans}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      boxShadow: ghost ? "none" : `0 6px 16px ${color}33`,
      cursor: "pointer",
      ...style,
    }}
  >
    <span
      style={{ display: "flex", alignItems: "center", flexDirection: "column" }}
    >
      <span>{children}</span>
      {sub && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            opacity: 0.85,
            marginTop: 2,
          }}
        >
          {sub}
        </span>
      )}
    </span>
  </button>
);

interface ChipProps {
  children?: React.ReactNode;
  active?: boolean;
  color?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export const Chip: React.FC<ChipProps> = ({
  children,
  active = false,
  color = MODOO.brand,
  style = {},
  onClick,
}) => (
  <div
    onClick={onClick}
    style={{
      height: 32,
      padding: "0 12px",
      borderRadius: 999,
      background: active ? color : "#fff",
      color: active ? "#fff" : MODOO.body,
      border: active ? "none" : `1px solid ${MODOO.hairline}`,
      font: `600 13px/1 ${MODOO.fonts.sans}`,
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      whiteSpace: "nowrap",
      cursor: onClick ? "pointer" : "default",
      ...style,
    }}
  >
    {children}
  </div>
);

interface ModooLogoProps {
  size?: number;
  color?: string;
}

export const ModooLogo: React.FC<ModooLogoProps> = ({
  size = 22,
  color = MODOO.brand,
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect x="2" y="6" width="8" height="8" rx="2" fill={color} />
      <rect x="8" y="12" width="8" height="8" rx="2" fill={color} opacity="0.55" />
      <rect x="14" y="6" width="8" height="8" rx="2" fill={color} opacity="0.8" />
    </svg>
    <span
      style={{
        font: `800 17px/1 ${MODOO.fonts.sans}`,
        letterSpacing: "-0.02em",
        color: MODOO.ink,
      }}
    >
      modoo
    </span>
  </div>
);

interface IOSStatusBarProps {
  dark?: boolean;
}

export const IOSStatusBar: React.FC<IOSStatusBarProps> = ({ dark = false }) => {
  const c = dark ? "#fff" : "#000";
  return (
    <div
      style={{
        height: 44,
        padding: "0 22px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        font: `600 14px/1 ${MODOO.fonts.sans}`,
        color: c,
        flexShrink: 0,
      }}
    >
      <div>9:41</div>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <svg width="17" height="11" viewBox="0 0 17 11" fill={c}>
          <path d="M1 7h2v3H1zM5 5h2v5H5zM9 3h2v7H9zM13 1h2v9h-2z" />
        </svg>
        <svg width="15" height="11" viewBox="0 0 15 11" fill={c}>
          <path d="M7.5 2.5C9.5 2.5 11 3.5 12 4.5l1-1c-1.5-1.5-3.5-2.5-5.5-2.5S3.5 2 2 3.5l1 1c1-1 2.5-2 4.5-2zM7.5 5.5C8.5 5.5 9.3 6 10 6.5l1-1c-1-1-2-1.5-3.5-1.5S5 4.5 4 5.5l1 1c.7-.5 1.5-1 2.5-1zM7.5 8.5c.5 0 1 .2 1.3.5l.7-.7c-.5-.5-1.2-.8-2-.8s-1.5.3-2 .8l.7.7c.3-.3.8-.5 1.3-.5z" />
        </svg>
        <svg width="27" height="13" viewBox="0 0 27 13" fill="none">
          <rect
            x="0.5"
            y="0.5"
            width="22"
            height="12"
            rx="3"
            stroke={c}
            opacity="0.4"
          />
          <rect x="2" y="2" width="19" height="9" rx="1.5" fill={c} />
          <rect x="24" y="4" width="2" height="5" rx="0.5" fill={c} opacity="0.4" />
        </svg>
      </div>
    </div>
  );
};
