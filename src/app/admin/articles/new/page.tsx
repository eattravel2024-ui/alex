import { currentUser } from "@/lib/server/access";
import { canAdmin } from "@/lib/admin-permissions";
import { AccessDenied } from "@/components/admin/access-denied";
import { ArticleEditor } from "@/components/admin/article-editor";
import { emptyArticle } from "@/lib/article-validation";
export default async function Page() {
  const actor = await currentUser();
  if (!actor || !canAdmin(actor.role, "content")) return <AccessDenied />;
  return (
    <>
      <h2>新增文章</h2>
      <ArticleEditor initial={emptyArticle} />
    </>
  );
}
