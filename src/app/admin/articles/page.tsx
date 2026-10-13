import Link from "next/link";
import { currentUser } from "@/lib/server/access";
import { canAdmin, taipeiDate } from "@/lib/admin-permissions";
import { db } from "@/lib/server/db";
import { articleStatuses } from "@/lib/article-validation";
import { AccessDenied } from "@/components/admin/access-denied";
import {
  Pagination,
  adminPageSize,
  pageNumber,
} from "@/components/admin/pagination";
import type { Prisma } from "@/generated/prisma/client";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await currentUser();
  if (!actor || !canAdmin(actor.role, "content")) return <AccessDenied />;
  const query = await searchParams,
    q = typeof query.q === "string" ? query.q.trim().slice(0, 120) : "",
    status =
      typeof query.status === "string" &&
      Object.hasOwn(articleStatuses, query.status)
        ? (query.status as keyof typeof articleStatuses)
        : "",
    kind =
      query.kind === "news" || query.kind === "knowledge" ? query.kind : "";
  const where: Prisma.ArticleRecordWhereInput = {
    ...(status ? { status } : {}),
    ...(kind ? { kind } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
  };
  const total = await db.articleRecord.count({ where }),
    page = Math.min(
      pageNumber(query.page),
      Math.max(1, Math.ceil(total / adminPageSize)),
    );
  const articles = await db.articleRecord.findMany({
    where,
    skip: (page - 1) * adminPageSize,
    take: adminPageSize,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      kind: true,
      slug: true,
      status: true,
      version: true,
      updatedAt: true,
      publishAt: true,
    },
  });
  return (
    <>
      <div className="cms-page-title">
        <h2>文章管理</h2>
        <Link className="button button-primary" href="/admin/articles/new">
          新增文章
        </Link>
      </div>
      <p>最新消息與健康知識共用 CMS。所有內容仍帶有開發示範聲明。</p>
      <form className="admin-filters" action="/admin/articles">
        <div>
          <label htmlFor="cms-search">標題搜尋</label>
          <input id="cms-search" name="q" defaultValue={q} maxLength={120} />
        </div>
        <div>
          <label htmlFor="cms-filter-kind">內容類型</label>
          <select id="cms-filter-kind" name="kind" defaultValue={kind}>
            <option value="">全部</option>
            <option value="news">最新消息</option>
            <option value="knowledge">健康知識</option>
          </select>
        </div>
        <div>
          <label htmlFor="cms-filter-status">發布狀態</label>
          <select id="cms-filter-status" name="status" defaultValue={status}>
            <option value="">全部</option>
            {Object.entries(articleStatuses).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <button className="button button-primary">查詢文章</button>
      </form>
      {articles.map((a) => (
        <article key={a.id} className="application-record admin-record">
          <h3>
            <Link href={`/admin/articles/${a.id}`}>{a.title}</Link>
          </h3>
          <p>
            {a.kind === "news" ? "最新消息" : "健康知識"} ·{" "}
            {articleStatuses[a.status]}
            {a.status === "SCHEDULED" &&
            a.publishAt &&
            a.publishAt <= new Date()
              ? "（排程已生效）"
              : ""}{" "}
            · 版本 {a.version}
          </p>
          <p>更新：{taipeiDate(a.updatedAt)}</p>
          {a.publishAt && <p>發布時間：{taipeiDate(a.publishAt)}</p>}
          <div className="actions">
            <Link className="text-link" href={`/admin/articles/${a.id}`}>
              編輯文章 ↗
            </Link>
            <Link
              className="text-link"
              href={`/admin/articles/${a.id}/preview`}
            >
              預覽已儲存版本 ↗
            </Link>
          </div>
        </article>
      ))}
      {!articles.length && <p className="demo-warning">沒有符合條件的文章。</p>}
      <Pagination
        path="/admin/articles"
        page={page}
        total={total}
        query={{ q, status, kind }}
      />
    </>
  );
}
