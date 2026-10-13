import { notFound } from "next/navigation";
import { currentUser } from "@/lib/server/access";
import { canAdmin } from "@/lib/admin-permissions";
import { AccessDenied } from "@/components/admin/access-denied";
import { pageKeys, pageDefaults, validatePageContent, heroDefaults } from "@/lib/site-pages";
import Image from "next/image";
import { db } from "@/lib/server/db";
export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const actor = await currentUser();
  if (!actor || !canAdmin(actor.role, "content")) return <AccessDenied />;
  const key = pageKeys.safeParse((await params).key);
  if (!key.success) notFound();
  const row = await db.sitePage.findUnique({ where: { key: key.data } });
  const data = row ? validatePageContent(key.data, row.draft) : pageDefaults[key.data];
  const hero = data.hero ?? heroDefaults;
  return <article className="prose"><p className="demo-warning">私人已儲存草稿預覽，尚未發布；隱藏章節不顯示，正式頁面的視覺版型維持網站設定。</p><h2 className="contact-message-text">{data.title}</h2><p className="contact-message-text">{data.description}</p>
    {key.data === "home" && <><Image src={hero.image} alt={hero.alt} width={480} height={320} style={{ maxWidth: "100%", height: "auto" }} /><p>主要按鈕：{hero.primary.label} · {hero.primary.href}</p><p>次要按鈕：{hero.secondary.label} · {hero.secondary.href}</p></>}
    {data.sections.filter((s) => s.visible !== false).map((s) => <section key={s.id}><h3>{s.heading}</h3><p className="contact-message-text">{s.body}</p></section>)}</article>;
}
