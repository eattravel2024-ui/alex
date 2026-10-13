import { notFound } from "next/navigation";
import { currentUser } from "@/lib/server/access";
import { canAdmin } from "@/lib/admin-permissions";
import { AccessDenied } from "@/components/admin/access-denied";
import { pageKeys, pageDefaults, validatePageContent } from "@/lib/site-pages";
import { db } from "@/lib/server/db";
export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const actor = await currentUser();
  if (!actor || !canAdmin(actor.role, "content")) return <AccessDenied />;
  const key = pageKeys.safeParse((await params).key);
  if (!key.success) notFound();
  const row = await db.sitePage.findUnique({ where: { key: key.data } });
  const data = row ? validatePageContent(key.data, row.draft) : pageDefaults[key.data];
  return <article className="prose"><p className="demo-warning">私人草稿文字預覽，尚未發布；正式頁面的視覺版型維持網站設定。</p><h2 className="contact-message-text">{data.title}</h2><p className="contact-message-text">{data.description}</p>{data.sections.map((s) => <section key={s.id}><h3>{s.heading}</h3><p className="contact-message-text">{s.body}</p></section>)}</article>;
}
