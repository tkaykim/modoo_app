import type { Metadata } from "next";
import { DEFAULT_OG_IMAGE } from "@/lib/og-meta";

const TITLE = "이용약관 · 모두의 유니폼";
const DESC = "모두의 유니폼 서비스 이용약관입니다.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESC,
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "/policies",
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
    images: [DEFAULT_OG_IMAGE.url],
  },
  alternates: { canonical: "/policies" },
};

export default function PoliciesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
