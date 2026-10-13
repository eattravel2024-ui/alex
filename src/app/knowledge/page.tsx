import { ArticleList } from "@/components/content/article-list";
import type { SearchQuery } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo";
export const dynamic = "force-dynamic";
export const metadata = pageMetadata(
  "健康知識",
  "探索健康生活、營養、心理與活動知識。示範內容尚未專業審閱。",
  "/knowledge",
);
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchQuery>;
}) {
  return <ArticleList kind="knowledge" query={await searchParams} />;
}
