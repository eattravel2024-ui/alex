import Link from "next/link";
import { currentUser } from "@/lib/server/access";
import { canAdmin, taipeiDate } from "@/lib/admin-permissions";
import { db } from "@/lib/server/db";
import { AccessDenied } from "@/components/admin/access-denied";
import { eventStatuses } from "@/lib/event-validation";
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
  if (!actor || !canAdmin(actor.role, "eventOperations"))
    return <AccessDenied />;
  const query = await searchParams,
    q = typeof query.q === "string" ? query.q.trim().slice(0, 120) : "",
    status =
      typeof query.status === "string" &&
      Object.hasOwn(eventStatuses, query.status)
        ? (query.status as keyof typeof eventStatuses)
        : "";
  const where: Prisma.EventRecordWhereInput = {
    ...(status ? { status } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
  };
  const total = await db.eventRecord.count({ where }),
    page = Math.min(
      pageNumber(query.page),
      Math.max(1, Math.ceil(total / adminPageSize)),
    );
  const rows = await db.eventRecord.findMany({
    where,
    take: adminPageSize,
    skip: (page - 1) * adminPageSize,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      status: true,
      startsAt: true,
      capacity: true,
      registrationEnabled: true,
      _count: { select: { registrations: true } },
    },
  });
  return (
    <>
      <div className="cms-page-title">
        <h2>活動管理</h2>
        {canAdmin(actor.role, "events") && (
          <Link className="button button-primary" href="/admin/events/new">
            新增活動
          </Link>
        )}
      </div>
      <form className="admin-filters" action="/admin/events">
        <div>
          <label htmlFor="admin-event-search">活動標題搜尋</label>
          <input
            id="admin-event-search"
            name="q"
            maxLength={120}
            defaultValue={q}
          />
        </div>
        <div>
          <label htmlFor="admin-event-status">活動狀態</label>
          <select id="admin-event-status" name="status" defaultValue={status}>
            <option value="">全部</option>
            {Object.entries(eventStatuses).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <button className="button button-primary">查詢活動</button>
      </form>
      {rows.map((e) => (
        <article key={e.id} className="application-record admin-record">
          <h3>
            <Link href={`/admin/events/${e.id}`}>{e.title}</Link>
          </h3>
          <p>
            {eventStatuses[e.status]} · {taipeiDate(e.startsAt)}
          </p>
          <p>
            名額 {e.capacity} ·{" "}
            {e.registrationEnabled ? "開放本機報名" : "報名關閉"} · 報名歷史{" "}
            {e._count.registrations} 筆
          </p>
          <Link className="text-link" href={`/admin/events/${e.id}`}>
            編輯／報名名單 ↗
          </Link>
        </article>
      ))}
      {!rows.length && <p>沒有符合條件的活動。</p>}
      <Pagination
        path="/admin/events"
        page={page}
        total={total}
        query={{ q, status }}
      />
    </>
  );
}
