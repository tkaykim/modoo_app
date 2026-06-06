import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

// 비공개/기능 경로 — 모든 봇 공통 차단
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

// AI 검색/학습 크롤러 — 명시적 허용 (GEO/AEO: AI 응답에 인용되도록).
// 검색봇(OAI-SearchBot·Claude-SearchBot·PerplexityBot)과 학습봇(GPTBot·ClaudeBot·Google-Extended) 모두 허용.
const AI_BOTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "ClaudeBot", "Claude-SearchBot", "anthropic-ai", "Claude-User",
  "PerplexityBot", "Perplexity-User",
  "Google-Extended", "Applebot-Extended",
  "cohere-ai", "Amazonbot", "DuckAssistBot", "Meta-ExternalAgent",
];

export default function robots(): MetadataRoute.Robots {
  const origin = getSiteUrl().origin;
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      ...AI_BOTS.map((ua) => ({ userAgent: ua, allow: "/", disallow: DISALLOW })),
      // 데이터 무단 수집형 봇 차단 (바이트댄스)
      { userAgent: "Bytespider", disallow: "/" },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
