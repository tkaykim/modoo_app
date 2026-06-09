import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import Footer from "./components/Footer";
import NavigationListener from "./components/NavigationListener";
import GtmPageviewListener from "./components/GtmPageviewListener";
import AnalyticsPageviewListener from "./components/AnalyticsPageviewListener";
import AuthInitializer from "./components/AuthInitializer";
import SupabaseStorageHeal from "./components/SupabaseStorageHeal";
import ChatBubble from "./components/chatbot/ChatBubble";
import ChatWindow from "./components/chatbot/ChatWindow";
import WelcomeCouponModal from "./components/welcome/WelcomeCouponModal";
import WelcomeCouponClaimer from "./components/welcome/WelcomeCouponClaimer";
import ErrorReporter from "./components/ErrorReporter";
import FontPreloader from "./components/FontPreloader";
import { getSiteUrl } from "@/lib/site-url";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "모두의 유니폼 | 단체복 의류 주문 제작",
    template: "%s | 모두의 유니폼",
  },
  description:
    "의류 주문 제작, 무료 견적, 대량 주문, 단체 유니폼·단체복 제작. 모두의 유니폼에서 간편하게 신청하세요.",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "모두의 유니폼",
    title: "모두의 유니폼 | 단체복 의류 주문 제작",
    description:
      "의류 주문 제작, 무료 견적, 대량 주문, 단체 유니폼·단체복 제작. 모두의 유니폼에서 간편하게 신청하세요.",
    images: [
      {
        url: "/og-image.png",
        width: 1448,
        height: 1086,
        alt: "모두의 유니폼 - 단체복 제작 맛집",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "모두의 유니폼 | 단체복 의류 주문 제작",
    description:
      "의류 주문 제작, 무료 견적, 대량 주문, 단체 유니폼·단체복 제작. 모두의 유니폼에서 간편하게 신청하세요.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // GEO/AEO: schema.org JSON-LD (Organization + WebSite) — AI가 사이트 성격을 직접 파악·인용하도록.
  const origin = getSiteUrl().origin;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${origin}/#organization`,
        name: "모두의 유니폼",
        alternateName: "Modoo Uniform",
        url: origin,
        logo: `${origin}/og-image.png`,
        email: "modoo.contact@gmail.com",
        description:
          "단체복·커스텀 의류 주문 제작 플랫폼. 단체 티셔츠·후드티·과잠·팀 유니폼·굿즈를 디자인부터 제작까지 온라인으로 주문.",
        areaServed: "KR",
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        url: origin,
        name: "모두의 유니폼",
        inLanguage: "ko-KR",
        publisher: { "@id": `${origin}/#organization` },
      },
    ],
  };
  return (
    <html lang="ko">
      <head>
        {/* Preload the only true webfont so the canvas never renders a fallback for it. */}
        <link rel="preload" href="/fonts/Freshman.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        {GTM_ID && (
          <script
            id="gtm-head"
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`,
            }}
          />
        )}
        {META_PIXEL_ID && (
          <script
            id="meta-pixel"
            dangerouslySetInnerHTML={{
              __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`,
            }}
          />
        )}
        {/* Microsoft Clarity — 행동 분석 (세션 리플레이/히트맵). 프로젝트 ID는 공개 식별자라 하드코딩. */}
        <script
          id="ms-clarity"
          dangerouslySetInnerHTML={{
            __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", "wv6e81e2t2");`,
          }}
        />
        {/* GEO/AEO: schema.org 구조화 데이터 (Organization + WebSite) */}
        <script
          id="jsonld-org"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased">
        {GTM_ID && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        )}
        {META_PIXEL_ID && (
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        )}
        <ErrorReporter />
        <FontPreloader />
        <SupabaseStorageHeal />
        <AuthInitializer />
        <NavigationListener />
        <GtmPageviewListener />
        <AnalyticsPageviewListener />
        <div className="w-full lg:max-w-7xl lg:mx-auto">
          <main>{children}</main>
        </div>

        {/* Chatbot */}
        <ChatBubble />
        <ChatWindow />

        {/* 신규회원 웰컴쿠폰: 비로그인 진입 팝업 + 가입 직후 지급 알림 */}
        <WelcomeCouponModal />
        <WelcomeCouponClaimer />
        <Analytics />
      </body>
    </html>
  );
}
