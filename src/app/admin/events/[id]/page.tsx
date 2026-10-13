import { notFound } from "next/navigation";
import { z } from "zod";
import { currentUser } from "@/lib/server/access";
import { canAdmin, taipeiDate } from "@/lib/admin-permissions";
import { db } from "@/lib/server/db";
import { AccessDenied } from "@/components/admin/access-denied";
import { EventEditor } from "@/components/admin/event-editor";
import { CheckInButton } from "@/components/member/event-actions";
import { registrationLabels, eventSchema } from "@/lib/event-validation";
import {
  Pagination,
  pageNumber,
  adminPageSize,
} from "@/components/admin/pagination";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await currentUser();
  if (!actor || !canAdmin(actor.role, "eventOperations"))
    return <AccessDenied />;
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) notFound();
  const event = await db.eventRecord.findUnique({ where: { id: parsed.data } });
  if (!event) notFound();
  const query = await searchParams;
  const status =
    typeof query.status === "string" &&
    Object.hasOwn(registrationLabels, query.status)
      ? (query.status as keyof typeof registrationLabels)
      : "";
  const where = { eventId: event.id, ...(status ? { status } : {}) };
  const total = await db.eventRegistration.count({ where }),
    page = Math.min(
      pageNumber(query.page),
      Math.max(1, Math.ceil(total / adminPageSize)),
    );
  const rows = await db.eventRegistration.findMany({
    where,
    take: adminPageSize,
    skip: (page - 1) * adminPageSize,
    orderBy: { queueOrder: "asc" },
    select: {
      id: true,
      status: true,
      checkedInAt: true,
      user: { select: { name: true, email: true } },
    },
  });
  const initial = eventSchema.parse({
    slug: event.slug,
    title: event.title,
    summary: event.summary,
    category: event.category,
    format: event.format,
    location: event.location,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    registrationDeadline: event.registrationDeadline.toISOString(),
    status: event.status,
    eligibility: event.eligibility,
    capacity: event.capacity,
    registrationEnabled: event.registrationEnabled,
    waitlistEnabled: event.waitlistEnabled,
    agenda: event.agenda,
  });
  return (
    <>
      <h2>{canAdmin(actor.role, "events") ? "編輯活動" : "活動報名管理"}</h2>
      <p>
        目前版本 {event.version} · {taipeiDate(event.updatedAt)}
      </p>
      {canAdmin(actor.role, "events") && (
        <EventEditor
          key={`${event.id}-${event.version}`}
          id={event.id}
          version={event.version}
          initial={initial}
        />
      )}
      <h2 className="subsection-title">報名名單</h2>
      <p>僅顯示必要的姓名、信箱與報名狀態；CSV 匯出會留下稽核紀錄。</p>
      <a
        className="button button-outline"
        href={`/api/admin/events/${event.id}/export`}
      >
        匯出報名 CSV
      </a>
      <form className="admin-filters" action={`/admin/events/${event.id}`}>
        <div>
          <label htmlFor="registration-filter">報名狀態</label>
          <select id="registration-filter" name="status" defaultValue={status}>
            <option value="">全部</option>
            {Object.entries(registrationLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <button className="button button-primary">篩選名單</button>
      </form>
      {rows.map((r) => (
        <article key={r.id} className="application-record admin-record">
          <h3>
            {r.user.name} · {registrationLabels[r.status]}
          </h3>
          <p className="admin-identifier">{r.user.email}</p>
          {r.checkedInAt ? (
            <p>報到：{taipeiDate(r.checkedInAt)}</p>
          ) : r.status === "CONFIRMED" && event.status === "PUBLISHED" ? (
            <CheckInButton eventId={event.id} registrationId={r.id} />
          ) : null}
        </article>
      ))}
      {!rows.length && <p>沒有符合條件的報名。</p>}
      <Pagination
        path={`/admin/events/${event.id}`}
        page={page}
        total={total}
        query={{ status }}
      />
    </>
  );
}
