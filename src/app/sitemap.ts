import type { MetadataRoute } from "next";
import { listPublicEvents } from "@/lib/services/event-service";
import { siteOrigin } from "@/lib/seo";
import { listPublishedArticles } from "@/lib/services/content-service";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();
  if (!origin) return [];
  const [allArticles, eventRecords] = await Promise.all([
    listPublishedArticles(),
    listPublicEvents(),
  ]);
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
