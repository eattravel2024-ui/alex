import { currentUser } from "@/lib/server/access";
import { canAdmin, statusLabels, taipeiDate } from "@/lib/admin-permissions";
import { db } from "@/lib/server/db";
import { AccessDenied } from "@/components/admin/access-denied";
import { ReviewForm } from "@/components/admin/admin-forms";
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
  const user = await currentUser();
  if (!user || !canAdmin(user.role, "review")) return <AccessDenied />;
  const params = await searchParams;
  const status =
    typeof params.status === "string" &&
    Object.hasOwn(statusLabels, params.status)
      ? (params.status as keyof typeof statusLabels)
      : "PENDING";
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const where: Prisma.MembershipApplicationWhereInput = {
    status,
    ...(q
      ? {
          user: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
        }
      : {}),
  };
  const total = await db.membershipApplication.count({ where });
  const page = Math.min(
    pageNumber(params.page),
    Math.max(1, Math.ceil(total / adminPageSize)),
  );
  const applications = await db.membershipApplication.findMany({
    where,
    skip: (page - 1) * adminPageSize,
    take: adminPageSize,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      userId: true,
      status: true,
      motivation: true,
      reviewNote: true,
      version: true,
      isDemo: true,
      createdAt: true,
      type: { select: { name: true } },
      user: { select: { name: true, email: true, disabled: true } },
      history: {
        orderBy: { createdAt: "desc" },
        select: { id: true, toStatus: true, note: true, createdAt: true },
      },
    },
  });
  return (
    <>
      <h2>申請審核</h2>
      <p className="section-description">
        核准會建立會員資格；請確認申請內容、正式規則與期限。此環境的示範申請不授予正式資格。
      </p>
      <form className="admin-filters" action="/admin/applications">
        <div>
          <label htmlFor="application-status">申請狀態</label>
          <select id="application-status" name="status" defaultValue={status}>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="application-q">姓名或信箱</label>
          <input id="application-q" name="q" defaultValue={q} maxLength={120} />
        </div>
        <button className="button button-primary">查詢申請</button>
      </form>
      {applications.length ? (
        applications.map((a) => (
          <article key={a.id} className="application-record admin-record">
            <h3>
              {a.user.name} · {statusLabels[a.status]}
            </h3>
            <p className="admin-identifier">{a.user.email}</p>
            <p>
              {a.type.name}
              {a.isDemo ? " · 開發測試" : ""} · {taipeiDate(a.createdAt)}
            </p>
            <p>申請說明：{a.motivation}</p>
            {a.user.disabled && (
              <p className="demo-warning">此申請人的帳號已停用。</p>
            )}
            {a.reviewNote && <p>審核回覆：{a.reviewNote}</p>}
            <details>
              <summary>申請歷程</summary>
              <ol>
                {a.history.map((h) => (
                  <li key={h.id}>
                    {statusLabels[h.toStatus]} · {taipeiDate(h.createdAt)}
                    {h.note && ` · ${h.note}`}
                  </li>
                ))}
              </ol>
            </details>
            {a.status === "PENDING" &&
              (a.userId === user.id ? (
                <p>不能審核自己的申請。</p>
              ) : (
                <ReviewForm id={a.id} version={a.version} />
              ))}
          </article>
        ))
      ) : (
        <p className="demo-warning">沒有符合條件的申請。</p>
      )}
      <Pagination
        path="/admin/applications"
        page={page}
        total={total}
        query={{ status, q }}
      />
    </>
  );
}
