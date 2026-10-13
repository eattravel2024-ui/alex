import "server-only";
import { cache } from "react";
import { db } from "@/lib/server/db";
import {
  eventRecords,
  queryValue,
  type Article,
  type ArticleKind,
  type SearchQuery,
} from "@/lib/catalog";
import type { ArticleRecord, Prisma } from "@/generated/prisma/client";
import { articleFieldsSchema } from "@/lib/article-validation";
export function publishedWhere(): Prisma.ArticleRecordWhereInput {
  return {
    status: { in: ["PUBLISHED", "SCHEDULED"] },
    publishAt: { lte: new Date() },
  };
}
export function articleFields(a: ArticleRecord) {
  return articleFieldsSchema.parse({
    slug: a.slug,
    kind: a.kind,
    title: a.title,
    summary: a.summary,
    category: a.category,
    tags: a.tags,
    image: a.image,
    author: a.author,
    featured: a.featured,
    reviewedAt: a.reviewedAt,
    blocks: a.blocks,
    references: a.references,
  });
}
export function articleView(a: ArticleRecord): Article {
  return {
    ...articleFields(a),
    publishedAt: a.publishAt
      ? new Intl.DateTimeFormat("sv-SE", {
          timeZone: "Asia/Taipei",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(a.publishAt)
      : "尚未發布",
  };
}
export const getArticle = cache(async (kind: ArticleKind, slug: string) => {
  const article = await db.articleRecord.findFirst({
    where: { ...publishedWhere(), kind, slug },
  });
  return article ? articleView(article) : undefined;
});
export async function listPublishedArticles(kind?: ArticleKind, take?: number) {
  const records = await db.articleRecord.findMany({
    where: { ...publishedWhere(), ...(kind ? { kind } : {}) },
    orderBy: [{ publishAt: "desc" }, { slug: "asc" }],
    ...(take ? { take } : {}),
  });
  return records.map(articleView);
}
export async function selectPublishedArticles(
  kind: ArticleKind,
  query: SearchQuery,
  pageSize = 3,
) {
  const q = queryValue(query.q).trim().slice(0, 120),
    category = queryValue(query.category).slice(0, 40),
    tag = queryValue(query.tag).slice(0, 40);
  const where: Prisma.ArticleRecordWhereInput = {
    ...publishedWhere(),
    kind,
    ...(category ? { category } : {}),
    ...(tag ? { tags: { has: tag } } : {}),
    ...(q ? { searchText: { contains: q, mode: "insensitive" } } : {}),
  };
  const [total, categoryRecords] = await Promise.all([
    db.articleRecord.count({ where }),
    db.articleRecord.findMany({
      where: { ...publishedWhere(), kind },
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / pageSize)),
    raw = queryValue(query.page),
    page = Math.min(/^[1-9]\d{0,5}$/.test(raw) ? Number(raw) : 1, pages);
  const records = await db.articleRecord.findMany({
    where,
    orderBy: [{ publishAt: "desc" }, { slug: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return {
    q,
    category,
    tag,
    page,
    pages,
    total,
    items: records.map(articleView),
    categories: categoryRecords.map((c) => c.category),
  };
}
export async function getRelatedArticles(kind: ArticleKind, slug: string) {
  const article = await getArticle(kind, slug);
  if (!article) return [];
  const same = await db.articleRecord.findMany({
    where: {
      ...publishedWhere(),
      kind,
      slug: { not: slug },
      category: article.category,
    },
    orderBy: [{ publishAt: "desc" }, { slug: "asc" }],
    take: 3,
  });
  if (same.length === 3) return same.map(articleView);
  const more = await db.articleRecord.findMany({
    where: {
      ...publishedWhere(),
      kind,
      slug: { notIn: [slug, ...same.map((a) => a.slug)] },
    },
    orderBy: [{ publishAt: "desc" }, { slug: "asc" }],
    take: 3 - same.length,
  });
  return [...same, ...more].map(articleView);
}
export function getEvent(slug: string) {
  return eventRecords.find((e) => e.slug === slug);
}
