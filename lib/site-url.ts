const CANONICAL_PRODUCTION_URL = "https://www.modoouniform.com";

/**
 * Canonical site origin for metadata, sitemap, and Open Graph URLs.
 * Production은 항상 canonical 도메인을 사용해야 외부 크롤러(카카오/페북/슬랙)가
 * Vercel SSO 보호된 *-vercel.app 도메인을 받지 않는다.
 */
export function getSiteUrl(): URL {
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();

  let raw: string;
  if (explicit) {
    raw = explicit;
  } else if (process.env.VERCEL_ENV === "production") {
    raw = CANONICAL_PRODUCTION_URL;
  } else if (process.env.VERCEL_URL) {
    raw = `https://${process.env.VERCEL_URL}`;
  } else {
    raw = "http://localhost:3000";
  }

  const normalized = raw.endsWith("/") ? raw.slice(0, -1) : raw;
  return new URL(normalized);
}
