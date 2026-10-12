import type { MetadataRoute } from "next";
import { allArticles, eventRecords } from "@/lib/catalog";
import { siteOrigin } from "@/lib/seo";
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  if (!origin) return [];
  return [
    "",
    "/about",
    "/news",
    "/knowledge",
    "/events",
    "/contact",
    "/privacy",
    "/terms",
    ...allArticles.map((a) => `/${a.kind}/${a.slug}`),
    ...eventRecords.map((e) => `/events/${e.slug}`),
  ].map((path) => ({
    url: origin + path,
    changeFrequency: "monthly" as const,
    priority: path === "" ? 1 : 0.6,
  }));
}
