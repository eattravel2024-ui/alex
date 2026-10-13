import { notFound } from "next/navigation";
import { currentUser } from "@/lib/server/access";
import { canAdmin, taipeiDate } from "@/lib/admin-permissions";
import { AccessDenied } from "@/components/admin/access-denied";
import { SitePageEditor } from "@/components/admin/site-page-editor";
import { pageKeys, pageDefaults, validatePageContent } from "@/lib/site-pages";
import { db } from "@/lib/server/db";
export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const actor = await currentUser();
  if (!actor || !canAdmin(actor.role, "content")) return <AccessDenied />;
  const key = pageKeys.safeParse((await params).key);
  if (!key.success) notFound();
  const row = await db.sitePage.findUnique({ where: { key: key.data }, include: { revisions: { orderBy: { version: "desc" }, take: 10 } } });
  return <><h2>{key.data === "home" ? "首頁內容管理" : "協會介紹管理"}</h2><p>目前版本：{row?.version ?? 0} · {row?.publishedAt ? `最近發布：${taipeiDate(row.publishedAt)}` : "使用網站原始示範文字"}</p>
    <SitePageEditor key={`${key.data}-${row?.version ?? 0}`} pageKey={key.data} initial={row ? validatePageContent(key.data, row.draft) : pageDefaults[key.data]} version={row?.version ?? 0} revisions={row?.revisions.map((r) => ({ id: r.id, version: r.version, action: r.action, date: taipeiDate(r.createdAt) })) ?? []} />
  </>;
}
