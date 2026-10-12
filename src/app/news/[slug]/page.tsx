import { notFound } from "next/navigation";
import { ArticleDetail } from "@/components/content/article-detail";
import { allArticles } from "@/lib/catalog";
import { getArticle } from "@/lib/services/content-service";
import { pageMetadata } from "@/lib/seo";
export function generateStaticParams() {
  return allArticles
    .filter((a) => a.kind === "news")
    .map((a) => ({ slug: a.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = getArticle("news", slug);
  return a
    ? pageMetadata(a.title, a.summary, "/news/" + a.slug, "article")
    : { title: "找不到文章" };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = getArticle("news", slug);
  if (!a) notFound();
  return <ArticleDetail article={a} />;
}
