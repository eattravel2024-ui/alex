import { notFound } from "next/navigation";
import { ArticleDetail } from "@/components/content/article-detail";
import { getArticle } from "@/lib/services/content-service";
import { pageMetadata } from "@/lib/seo";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = await getArticle("news", slug);
  if (!a) notFound();
  return pageMetadata(a.title, a.summary, "/news/" + a.slug, "article");
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = await getArticle("news", slug);
  if (!a) notFound();
  return <ArticleDetail article={a} />;
}
