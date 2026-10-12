import type { MetadataRoute } from "next";
import { siteOrigin, isIndexingEnabled } from "@/lib/seo";
export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  return {
    rules: {
      userAgent: "*",
      ...(isIndexingEnabled()
        ? { allow: "/", disallow: ["/admin/", "/member/", "/auth/"] }
        : { disallow: "/" }),
    },
    ...(origin ? { sitemap: origin + "/sitemap.xml" } : {}),
  };
}
