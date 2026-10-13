import "server-only";
import { db } from "@/lib/server/db";
import { ServiceError } from "@/lib/server/access";
import { pageDefaults, validatePageContent, type PageKey, type PageContent } from "@/lib/site-pages";
import type { Prisma } from "@/generated/prisma/client";
export async function publicPage(key: PageKey): Promise<PageContent> {
  const row = await db.sitePage.findUnique({ where: { key } });
  return row?.published ? validatePageContent(key, row.published) : pageDefaults[key];
}
export async function savePage(actorId: string, key: PageKey, version: number, action: "SAVE" | "PUBLISH" | "RESTORE", value?: unknown, revisionId?: string) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${"site-page:" + key},0))`;
    const previous = await tx.sitePage.findUnique({ where: { key } });
    if ((previous?.version ?? 0) !== version)
      throw new ServiceError(409, "STALE_PAGE", "頁面已由其他人更新，請保留修改內容並重新讀取。");
    if (action === "RESTORE") {
      const revision = await tx.sitePageRevision.findFirst({ where: { id: revisionId, pageKey: key } });
      if (!revision) throw new ServiceError(404, "NOT_FOUND", "找不到此頁面的修訂。");
      value = revision.snapshot;
    }
    let content: PageContent;
    try { content = validatePageContent(key, value); }
    catch { throw new ServiceError(400, "INVALID_PAGE", "頁面內容無效。章節不可重複或遺漏，協會介紹至少顯示一章；首頁版型與連結目的地須使用提供的選項。"); }
    const snapshot = content as Prisma.InputJsonValue;
    const published = action === "PUBLISH" ? { published: snapshot, publishedAt: new Date() } : {};
    const row = previous
      ? await tx.sitePage.update({ where: { key }, data: { draft: snapshot, version: { increment: 1 }, ...published } })
      : await tx.sitePage.create({ data: { key, draft: snapshot, ...published } });
    await tx.sitePageRevision.create({ data: { pageKey: key, version: row.version, snapshot, action, actorId } });
    await tx.auditLog.create({ data: { actorId, entityId: key, action: `PAGE_${action === "SAVE" ? "SAVED" : action === "PUBLISH" ? "PUBLISHED" : "RESTORED"}` } });
    return { version: row.version, published: action === "PUBLISH" };
  });
}
