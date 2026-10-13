import "server-only";
import { db } from "@/lib/server/db";
import { ServiceError } from "@/lib/server/access";
import { articleFields, articleView } from "./content-service";
import {
  articleInputSchema,
  type ArticleInput,
} from "@/lib/article-validation";
import type { Prisma } from "@/generated/prisma/client";
function publicationTime(input: ArticleInput) {
  if (input.status === "SCHEDULED") {
    if (!input.publishAt || new Date(input.publishAt) <= new Date())
      throw new ServiceError(400, "INVALID_SCHEDULE", "排程須指定未來時間。");
    return new Date(input.publishAt);
  }
  if (input.status === "PUBLISHED")
    return input.publishAt && new Date(input.publishAt) <= new Date()
      ? new Date(input.publishAt)
      : new Date();
  return null;
}
function dataFields(input: ArticleInput, actorId: string) {
  return {
    ...input,
    publishAt: publicationTime(input),
    searchText: [
      input.title,
      input.summary,
      ...input.tags,
      ...input.blocks.flatMap((b) => [b.heading, ...b.paragraphs]),
    ].join(" "),
    updatedById: actorId,
    isDemo: true,
  };
}
function duplicate(error: unknown): never {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002"
  )
    throw new ServiceError(409, "DUPLICATE_SLUG", "此網址識別碼已被使用。");
  throw error;
}
export async function saveArticle(
  actorId: string,
  input: ArticleInput,
  id?: string,
  version?: number,
  restored = false,
) {
  try {
    return await db.$transaction(async (tx) => {
      if (id) {
        await tx.$queryRaw`SELECT id FROM "ArticleRecord" WHERE id=${id}::uuid FOR UPDATE`;
        const current = await tx.articleRecord.findUnique({ where: { id } });
        if (!current) throw new ServiceError(404, "NOT_FOUND", "找不到文章。");
        if (current.version !== version)
          throw new ServiceError(
            409,
            "STALE_ARTICLE",
            "文章已被其他人更新，請重新讀取並保留你的修改內容。",
          );
        if (current.slug !== input.slug || current.kind !== input.kind)
          throw new ServiceError(
            400,
            "IMMUTABLE_URL",
            "建立後不能更改網址識別碼或內容類型。",
          );
      }
      const data = dataFields(input, actorId);
      const article = id
        ? await tx.articleRecord.update({
            where: { id },
            data: { ...data, version: { increment: 1 } },
          })
        : await tx.articleRecord.create({ data });
      const snapshot = {
        ...articleFields(article),
        status: article.status,
        publishAt: article.publishAt?.toISOString() ?? null,
      };
      await tx.articleRevision.create({
        data: {
          articleId: article.id,
          version: article.version,
          actorId,
          snapshot: snapshot as Prisma.InputJsonValue,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          entityId: article.id,
          action: restored
            ? "ARTICLE_RESTORED"
            : id
              ? "ARTICLE_UPDATED"
              : "ARTICLE_CREATED",
        },
      });
      return {
        id: article.id,
        version: article.version,
        status: article.status,
      };
    });
  } catch (error) {
    duplicate(error);
  }
}
export async function restoreArticle(
  actorId: string,
  id: string,
  revisionId: string,
  version: number,
) {
  const revision = await db.articleRevision.findFirst({
    where: { id: revisionId, articleId: id },
  });
  if (!revision)
    throw new ServiceError(404, "NOT_FOUND", "找不到這篇文章的修訂版本。");
  const fields = articleInputSchema.parse(revision.snapshot);
  // Restoring never republishes an old article or repeats an old schedule.
  return saveArticle(
    actorId,
    { ...fields, status: "DRAFT", publishAt: null },
    id,
    version,
    true,
  );
}
export async function cmsArticle(id: string) {
  const article = await db.articleRecord.findUnique({
    where: { id },
    include: {
      revisions: {
        orderBy: { version: "desc" },
        take: 20,
        select: {
          id: true,
          version: true,
          createdAt: true,
          actor: { select: { name: true } },
        },
      },
    },
  });
  return article
    ? { ...article, fields: articleFields(article), view: articleView(article) }
    : null;
}
