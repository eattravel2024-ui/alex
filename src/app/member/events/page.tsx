import Link from "next/link";
import { requireUser } from "@/lib/server/access";
import { db } from "@/lib/server/db";
import { taipeiDate } from "@/lib/admin-permissions";
import { registrationLabels } from "@/lib/event-validation";
import { EventAction } from "@/components/member/event-actions";
import {
  Pagination,
  pageNumber,
  adminPageSize,
} from "@/components/admin/pagination";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser(),
    params = await searchParams,
    total = await db.eventRegistration.count({ where: { userId: user.id } }),
    page = Math.min(
      pageNumber(params.page),
      Math.max(1, Math.ceil(total / adminPageSize)),
    );
  const rows = await db.eventRegistration.findMany({
    where: { userId: user.id },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * adminPageSize,
    take: adminPageSize,
    select: {
      id: true,
      status: true,
      checkedInAt: true,
      event: {
        select: {
          id: true,
          title: true,
          slug: true,
          startsAt: true,
          status: true,
        },
      },
      changes: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, toStatus: true, note: true, createdAt: true },
      },
    },
  });
  return (
    <>
      <h2>我的活動</h2>
      <p className="demo-warning">
        報名、候補與報到皆為本機開發測試，不代表真實活動。
      </p>
      {rows.map((r) => (
        <article key={r.id} className="application-record">
          <h3>
            {r.event.title} · {registrationLabels[r.status]}
          </h3>
          <p>開始：{taipeiDate(r.event.startsAt)}</p>
          {r.checkedInAt && <p>報到：{taipeiDate(r.checkedInAt)}</p>}
          <Link className="text-link" href={`/events/${r.event.slug}`}>
            查看活動 ↗
          </Link>
          {r.status !== "CANCELLED" && (
            <EventAction
              key={r.status}
              eventId={r.event.id}
              cancel
              canAct={!r.checkedInAt && r.event.startsAt > new Date()}
            />
          )}
          <details>
            <summary>最近20筆狀態歷程</summary>
            <ol>
              {r.changes.map((c) => (
                <li key={c.id}>
                  {registrationLabels[c.toStatus]} · {taipeiDate(c.createdAt)} ·{" "}
                  {c.note}
                </li>
              ))}
            </ol>
          </details>
        </article>
      ))}
      {!rows.length && (
        <p>
          尚未報名活動。
          <Link className="text-link" href="/events">
            探索活動 ↗
          </Link>
        </p>
      )}
      <Pagination path="/member/events" page={page} total={total} query={{}} />
    </>
  );
}
