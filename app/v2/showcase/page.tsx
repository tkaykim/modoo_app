import Link from "next/link";

const sections: { title: string; items: { l: string; href: string }[] }[] = [
  {
    title: "01 · 홈 / 온보딩",
    items: [
      { l: "온보딩 (첫 진입)", href: "/v2/onboarding" },
      { l: "A · 친근/캐주얼", href: "/v2/onboarding?style=friendly" },
      { l: "B · 심플/미니멀", href: "/v2/onboarding?style=minimal" },
      { l: "C · 전문/B2B", href: "/v2/onboarding?style=professional" },
      { l: "D · 에디토리얼", href: "/v2/onboarding?style=editorial" },
      { l: "E · 다크 스포츠", href: "/v2/onboarding?style=darksport" },
      { l: "F · 컬러필드", href: "/v2/onboarding?style=colorfield" },
    ],
  },
  {
    title: "02 · 상품",
    items: [
      { l: "카탈로그", href: "/v2/mall" },
      { l: "상품 상세", href: "/v2/product/sample" },
    ],
  },
  {
    title: "03 · 디자인 에디터",
    items: [
      { l: "에디터 메인 (텍스트 선택)", href: "/v2/editor/sample" },
      { l: "인쇄 방식 선택", href: "/v2/editor/sample?scenario=print-method" },
      { l: "E1 빈 캔버스", href: "/v2/editor/sample?scenario=empty" },
      { l: "E2 템플릿", href: "/v2/editor/sample?scenario=templates" },
      { l: "E3 AI 프롬프트", href: "/v2/editor/sample?scenario=ai-prompt" },
      { l: "E4 AI 시안", href: "/v2/editor/sample?scenario=ai-results" },
      { l: "E5 이미지 업로드", href: "/v2/editor/sample?scenario=upload" },
      { l: "E6 텍스트 편집", href: "/v2/editor/sample?scenario=text-panel" },
      { l: "E7 레이어", href: "/v2/editor/sample?scenario=layers" },
      { l: "E8 화질 경고", href: "/v2/editor/sample?scenario=warning" },
      { l: "E9 앞·뒤 미리보기", href: "/v2/editor/sample?scenario=preview" },
      { l: "E10 저장 진행", href: "/v2/editor/sample?scenario=saving" },
    ],
  },
  {
    title: "04 · 장바구니/결제",
    items: [
      { l: "장바구니", href: "/v2/cart" },
      { l: "결제", href: "/v2/checkout" },
      { l: "주문 완료", href: "/v2/order/sample/success" },
    ],
  },
  {
    title: "05 · 제작·배송 추적",
    items: [
      { l: "A · 수직 타임라인", href: "/v2/order/sample" },
      { l: "B · 캐릭터 + 가로 스텝", href: "/v2/order/sample?track=horizontal" },
      { l: "C · 지도형", href: "/v2/order/sample?track=map" },
    ],
  },
  {
    title: "06 · MY · 리뷰",
    items: [
      { l: "MY 페이지", href: "/v2/my-page" },
      { l: "리뷰 작성", href: "/v2/reviews/new" },
    ],
  },
];

export default function ShowcasePage() {
  return (
    <div style={{ padding: 20, color: "#0E1116" }}>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          marginBottom: 4,
        }}
      >
        MODOO v2 · 디자인 시안
      </h1>
      <p style={{ fontSize: 12, color: "#5C6573", marginBottom: 20 }}>
        16개 화면 · 내부 검수용. 각 링크는 v2 라우트로 직접 진입합니다.
      </p>
      {sections.map((s) => (
        <div key={s.title} style={{ marginBottom: 22 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 8,
              color: "#0052CC",
              letterSpacing: "-0.01em",
            }}
          >
            {s.title}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {s.items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "#fff",
                  border: "1px solid #E6E8EC",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#0E1116",
                  textDecoration: "none",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{it.l}</span>
                <span style={{ color: "#8A93A2", fontWeight: 500 }}>
                  {it.href}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
