import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import Footer from "./components/Footer";
import NavigationListener from "./components/NavigationListener";
import AuthInitializer from "./components/AuthInitializer";
import ChatBubble from "./components/chatbot/ChatBubble";
import ChatWindow from "./components/chatbot/ChatWindow";
import { getSiteUrl } from "@/lib/site-url";
import { Analytics } from "@vercel/analytics/next";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

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
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        {GTM_ID && (
          <Script id="gtm-head" strategy="afterInteractive">{`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${GTM_ID}');
          `}</Script>
        )}
        {GA_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga-init" strategy="afterInteractive">{`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `}</Script>
          </>
        )}
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
        <AuthInitializer />
        <NavigationListener />
        <div className="w-full lg:max-w-7xl lg:mx-auto">
          <main>{children}</main>
        </div>

        {/* Chatbot */}
        <ChatBubble />
        <ChatWindow />

        <Analytics />
      </body>
    </html>
  );
}
