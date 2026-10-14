import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, type MediaAsset } from "@/generated/prisma/client";
import { db } from "@/lib/server/db";
import { ServiceError } from "@/lib/server/access";
import { writeMediaFile, removeMediaFile } from "@/lib/server/media-storage";
import { type MediaItem, type MediaList } from "@/lib/media-validation";
type Transaction = Prisma.TransactionClient;
const pageSize = 12;
const storageLimit = 512 * 1024 * 1024;

function mediaView(asset: MediaAsset, used = false): MediaItem {
  return { id: asset.id, url: `/media/${asset.id}`, altText: asset.altText,
    width: asset.width, height: asset.height, byteSize: asset.byteSize,
    version: asset.version, createdAt: asset.createdAt.toISOString(), used };
}
async function mediaUsed(tx: Transaction, url: string) {
  const result = await tx.$queryRaw<{ used: boolean }[]>`
    SELECT EXISTS(SELECT 1 FROM "ArticleRecord" WHERE image=${url})
      OR EXISTS(SELECT 1 FROM "ArticleRevision" WHERE snapshot->>'image'=${url}) AS used`;
  return result[0].used;
}
async function lockMedia(tx: Transaction, id: string) {
  await tx.$queryRaw`SELECT id FROM "MediaAsset" WHERE id=${id}::uuid FOR UPDATE`;
  const asset = await tx.mediaAsset.findUnique({ where: { id } });
  if (!asset) throw new ServiceError(404, "NOT_FOUND", "找不到圖片。");
  return asset;
}
export async function listMedia(search = "", requestedPage = 1): Promise<MediaList> {
  const q = search.trim().slice(0, 120);
  const where = q ? { altText: { contains: q, mode: "insensitive" as const } } : {};
  const total = await db.mediaAsset.count({ where });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(1, Math.min(Number.isSafeInteger(requestedPage) ? requestedPage : 1, pages));
  const assets = await db.mediaAsset.findMany({ where, skip: (page - 1) * pageSize,
    take: pageSize, orderBy: [{ createdAt: "desc" }, { id: "asc" }] });
  const urls = assets.map((asset) => `/media/${asset.id}`);
  const references = urls.length ? await db.$queryRaw<{ image: string }[]>(Prisma.sql`
    SELECT image FROM "ArticleRecord" WHERE image IN (${Prisma.join(urls)})
    UNION SELECT snapshot->>'image' AS image FROM "ArticleRevision"
      WHERE snapshot->>'image' IN (${Prisma.join(urls)})`) : [];
  const used = new Set(references.map((reference) => reference.image));
  return { items: assets.map((asset) => mediaView(asset, used.has(`/media/${asset.id}`))), total, page, pages };
}
export async function createMedia(actorId: string, altText: string, image: {
  buffer: Buffer; width: number; height: number; mimeType: "image/webp";
}) {
  const id = randomUUID();
  await writeMediaFile(id, image.buffer);
  try {
    const asset = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext('cchm-media-library'))`;
      const recent = await tx.auditLog.count({ where: { actorId, action: "MEDIA_UPLOADED",
        createdAt: { gte: new Date(Date.now() - 60000) } } });
      if (recent >= 5) throw new ServiceError(429, "MEDIA_RATE_LIMIT", "圖片上傳過於頻繁，請稍候再試。");
      const total = await tx.mediaAsset.aggregate({ _sum: { byteSize: true } });
      if ((total._sum.byteSize || 0) + image.buffer.length > storageLimit) {
        throw new ServiceError(409, "MEDIA_STORAGE_FULL", "媒體空間已滿，請先清理未使用的圖片。");
      }
      const saved = await tx.mediaAsset.create({ data: { id, altText,
        mimeType: image.mimeType, width: image.width, height: image.height,
        byteSize: image.buffer.length, createdById: actorId } });
      await tx.auditLog.create({ data: { actorId, entityId: id, action: "MEDIA_UPLOADED" } });
      return saved;
    });
    return mediaView(asset);
  } catch (error) {
    try { await removeMediaFile(id); } catch { console.error("Media upload cleanup requires operator attention"); }
    throw error;
  }
}
export async function updateMedia(actorId: string, id: string, altText: string, version: number) {
  return db.$transaction(async (tx) => {
    const current = await lockMedia(tx, id);
    if (current.version !== version) throw new ServiceError(409, "STALE_MEDIA", "圖片資料已更新，請重新讀取。");
    const asset = await tx.mediaAsset.update({ where: { id }, data: { altText, version: { increment: 1 } } });
    await tx.auditLog.create({ data: { actorId, entityId: id, action: "MEDIA_UPDATED" } });
    return mediaView(asset, await mediaUsed(tx, `/media/${id}`));
  });
}
export async function deleteMedia(actorId: string, id: string, version: number) {
  await db.$transaction(async (tx) => {
    const asset = await lockMedia(tx, id);
    if (asset.version !== version) throw new ServiceError(409, "STALE_MEDIA", "圖片資料已更新，請重新讀取。");
    if (await mediaUsed(tx, `/media/${id}`)) throw new ServiceError(409, "MEDIA_IN_USE", "文章或歷史版本正在使用此圖片，無法刪除。");
    try { await removeMediaFile(id); } catch {
      throw new ServiceError(503, "MEDIA_STORAGE_UNAVAILABLE", "圖片檔案暫時無法刪除，請稍後重試或聯絡管理員。");
    }
    await tx.mediaAsset.delete({ where: { id } });
    await tx.auditLog.create({ data: { actorId, entityId: id, action: "MEDIA_DELETED" } });
  });
  return { deleted: true };
}
