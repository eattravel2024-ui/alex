import { notFound } from "next/navigation";
import { z } from "zod";
import { currentUser } from "@/lib/server/access";
import { canAdmin, taipeiDate } from "@/lib/admin-permissions";
import { AccessDenied } from "@/components/admin/access-denied";
import {
  ArticleEditor,
  RestoreRevision,
} from "@/components/admin/article-editor";
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
  return (
    <>
      <h2>編輯文章</h2>
      <p>
        目前版本 {article.version} · 更新：{taipeiDate(article.updatedAt)}
      </p>
      <ArticleEditor
        key={`${article.id}-${article.version}`}
        id={article.id}
        version={article.version}
        initial={{
          ...article.fields,
          status: article.status,
          publishAt: article.publishAt?.toISOString() ?? null,
        }}
      />
      <h2 className="subsection-title">修訂歷程</h2>
      <p>最近 20 個已儲存版本；還原會建立新版本並回到草稿，不自動重新發布。</p>
      {article.revisions.map((r) => (
        <details key={r.id} className="application-record">
          <summary>
            版本 {r.version} · {r.actor.name} · {taipeiDate(r.createdAt)}
          </summary>
          {r.version !== article.version ? (
            <RestoreRevision
              id={article.id}
              revisionId={r.id}
              version={article.version}
            />
          ) : (
            <p>目前版本</p>
          )}
        </details>
      ))}
      {!article.revisions.length && (
        <p>本機匯入的示範文章會在第一次儲存後開始記錄修訂。</p>
      )}
    </>
  );
}
