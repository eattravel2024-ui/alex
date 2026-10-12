import type { Metadata } from "next";
export function siteOrigin(value = process.env.APP_URL): string | undefined {
  if (!value) return undefined;
  const parsed = new URL(value);
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  )
    throw new Error(
      "APP_URL must be an HTTPS origin without credentials, path, query or fragment.",
    );
  return parsed.origin;
}
export function pageMetadata(
  title: string,
  description: string,
  path: string,
  type: "website" | "article" = "website",
): Metadata {
  const origin = siteOrigin();
  return {
    title,
    description,
    ...(origin ? { alternates: { canonical: origin + path } } : {}),
    openGraph: {
      title,
      description,
      locale: "zh_TW",
      type,
      ...(origin ? { url: origin + path } : {}),
    },
  };
}
export function isIndexingEnabled() {
  return process.env.SITE_INDEXING_ENABLED === "true" && !!siteOrigin();
}
export function serializeStructuredData(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
