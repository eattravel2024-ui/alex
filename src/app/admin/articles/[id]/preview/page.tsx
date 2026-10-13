import { notFound } from "next/navigation";
import { z } from "zod";
import { currentUser } from "@/lib/server/access";
import { canAdmin } from "@/lib/admin-permissions";
import { AccessDenied } from "@/components/admin/access-denied";
import { ArticleDetail } from "@/components/content/article-detail";
import { cmsArticle } from "@/lib/services/article-cms-service";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await currentUser();
  if (!actor || !canAdmin(actor.role, "content")) return <AccessDenied />;
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) notFound();
  const article = await cmsArticle(parsed.data);
  if (!article) notFound();
  return <ArticleDetail article={article.view} preview />;
}
