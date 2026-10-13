import { ArticleList } from "@/components/content/article-list";
import type { SearchQuery } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo";
export const dynamic = "force-dynamic";
export const metadata = pageMetadata(
  "最新消息",
  "中華健康管理協會網站示範消息，支援搜尋、分類及分頁。",
  "/news",
);
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchQuery>;
}) {
  return <ArticleList kind="news" query={await searchParams} />;
}
