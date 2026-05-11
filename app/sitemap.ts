import type { MetadataRoute } from "next";
import { createAnonClient } from "@/lib/supabase";
import { getSiteUrl } from "@/lib/site-url";

const GUIDE_CATEGORIES = new Set(["fabric", "printing", "order_guide"]);

const STATIC_PATHS: MetadataRoute.Sitemap = [
  "/home",
  "/home/search",
  "/home/designs",
  "/policies",
  "/support/privacy",
  "/support/notices",
  "/support/guides",
  "/order/lookup",
  "/inquiries",
  "/cobuy",
  "/templates",
  "/templates/family",
  "/templates/pet",
  "/templates/group",
  "/templates/logo",
  "/templates/event",
].map((path) => ({
  url: new URL(path, getSiteUrl()).href,
  changeFrequency: "daily" as const,
  priority: path === "/" || path === "/home" ? 1 : 0.8,
}));

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl().toString();
  const entries: MetadataRoute.Sitemap = [...STATIC_PATHS];

  try {
    const supabase = createAnonClient();

    const [{ data: products }, { data: announcements }] = await Promise.all([
      supabase.from("products").select("id, updated_at").eq("is_active", true),
      supabase
        .from("announcements")
        .select("id, category, created_at")
        .eq("is_published", true),
    ]);

    for (const p of products ?? []) {
      entries.push({
        url: new URL(`/editor/${p.id}`, base).href,
        lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
        changeFrequency: "weekly",
        priority: 0.9,
      });
    }

    for (const row of announcements ?? []) {
      const cat = row.category ?? "";
      const path = GUIDE_CATEGORIES.has(cat)
        ? `/support/guides/${row.id}`
        : `/support/notices/${row.id}`;
      entries.push({
        url: new URL(path, base).href,
        lastModified: row.created_at ? new Date(row.created_at) : undefined,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch (e) {
    console.error("[sitemap] dynamic routes skipped:", e);
  }

  return entries;
}
