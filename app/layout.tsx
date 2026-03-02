import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import Footer from "./components/Footer";
import NavigationListener from "./components/NavigationListener";
import AuthInitializer from "./components/AuthInitializer";
import ChatBubble from "./components/chatbot/ChatBubble";
import ChatWindow from "./components/chatbot/ChatWindow";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export const metadata: Metadata = {
  title: "모두의 유니폼 | 단체복 의류 주문 제작",
  description: "의류 주문 제작, 뮤료 견적, 대랸 주문, 단체복 제작",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
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
        <AuthInitializer />
        <NavigationListener />
        <div className="w-full lg:max-w-7xl lg:mx-auto">
          <main>{children}</main>
        </div>

        {/* Chatbot */}
        <ChatBubble />
        <ChatWindow />
      </body>
    </html>
  );
}
