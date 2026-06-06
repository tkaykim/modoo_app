import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

// 비공개/기능 경로 — 차단
const DISALLOW = [
  "/api/",
  "/login",
  "/reset-password",
  "/auth/",
  "/home/my-page/",
  "/cart",
  "/checkout",
  "/payment/",
  "/toss/",
  "/chat",
  "/editor/",
];

export default function robots(): MetadataRoute.Robots {
  const origin = getSiteUrl().origin;
  return {
    rules: [
      // 전체 허용(비공개 경로만 제외). AI 검색/학습 크롤러도 이 규칙으로 모두 허용됨
      // (전용 규칙 없는 봇은 '*'를 따르므로 일일이 나열할 필요 없음).
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      // 무단 데이터 수집봇만 차단 (바이트댄스)
      { userAgent: "Bytespider", disallow: "/" },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
