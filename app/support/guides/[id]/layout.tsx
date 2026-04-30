import type { Metadata } from "next";
import { createAnonClient } from "@/lib/supabase";
import { stripHtmlForMeta } from "@/lib/seo-text";
import { DEFAULT_OG_IMAGE } from "@/lib/og-meta";

const GUIDE_CATEGORIES = ["fabric", "printing", "order_guide"] as const;

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = createAnonClient();

  const { data } = await supabase
    .from("announcements")
    .select("title, content, category")
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();

  if (
    !data?.title ||
    !data.category ||
    !GUIDE_CATEGORIES.includes(
      data.category as (typeof GUIDE_CATEGORIES)[number],
    )
  ) {
    return { title: { absolute: "가이드 | 모두의 유니폼" } };
  }

  const rawDesc = stripHtmlForMeta(data.content || "") || data.title;
  const title = `${data.title} · 가이드 | 모두의 유니폼`;

  return {
    title: { absolute: title },
    description: rawDesc,
    openGraph: {
      title,
      description: rawDesc,
      url: `/support/guides/${id}`,
      type: "article",
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: rawDesc,
      images: [DEFAULT_OG_IMAGE.url],
    },
    alternates: { canonical: `/support/guides/${id}` },
  };
}

export default function GuideDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
