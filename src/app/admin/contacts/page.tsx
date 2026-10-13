import { currentUser } from "@/lib/server/access";
import { canAdmin, taipeiDate } from "@/lib/admin-permissions";
import { contactStatuses, contactTopics } from "@/lib/contact-validation";
import { db } from "@/lib/server/db";
import { AccessDenied } from "@/components/admin/access-denied";
import { ContactUpdateForm } from "@/components/admin/contact-update-form";
import { Pagination, pageNumber, adminPageSize } from "@/components/admin/pagination";
import type { Prisma } from "@/generated/prisma/client";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await currentUser();
  if (!actor || !canAdmin(actor.role, "contacts")) return <AccessDenied />;
  const params = await searchParams;
  const status = typeof params.status === "string" && Object.hasOwn(contactStatuses, params.status)
    ? params.status as keyof typeof contactStatuses : "NEW";
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const assigned = params.assigned === "mine" ? "mine" : params.assigned === "unassigned" ? "unassigned" : "all";
  const where: Prisma.ContactMessageWhereInput = {
    status, ...(assigned === "mine" ? { assignedToId: actor.id } : assigned === "unassigned" ? { assignedToId: null } : {}),
    ...(q ? { OR: ["name", "email", "subject"].map((field) => ({ [field]: { contains: q, mode: "insensitive" } })) } : {}),
  };
  const total = await db.contactMessage.count({ where });
  const page = Math.min(pageNumber(params.page), Math.max(1, Math.ceil(total / adminPageSize)));
  const rows = await db.contactMessage.findMany({ where, skip: (page - 1) * adminPageSize, take: adminPageSize,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    include: { assignedTo: { select: { name: true } }, changes: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20, include: { actor: { select: { name: true } } } } },
  });
  return <>
    <h2>聯絡訊息管理</h2>
    <p className="section-description">示範訊息由工作人員在站內處理，不寄送郵件。每次更新保留狀態、接手與內部說明歷程。</p>
    <form className="admin-filters" action="/admin/contacts">
      <div><label htmlFor="contact-q">姓名、信箱或主旨</label><input id="contact-q" name="q" defaultValue={q} maxLength={120} /></div>
      <div><label htmlFor="contact-filter-status">訊息狀態</label><select id="contact-filter-status" name="status" defaultValue={status}>{Object.entries(contactStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div><label htmlFor="contact-assigned">負責人篩選</label><select id="contact-assigned" name="assigned" defaultValue={assigned}><option value="all">全部</option><option value="mine">由我負責</option><option value="unassigned">尚未指派</option></select></div>
      <button className="button button-primary">查詢訊息</button>
    </form>
    {rows.map((row) => <article className="application-record admin-record" key={row.id}>
      <h3>{row.subject} · {contactStatuses[row.status]}</h3>
      <p className="admin-identifier">{row.name} · {row.email}</p>
      <p>{contactTopics[row.topic as keyof typeof contactTopics]} · {taipeiDate(row.createdAt)} · 收件編號：{row.id}</p>
      <p>負責人：{row.assignedTo?.name ?? "尚未指派"} · 示範資料 · 告知版本：{row.consentVersion}</p>
      <p className="contact-message-text">{row.message}</p>
      <details><summary>處理訊息</summary><ContactUpdateForm key={`${row.id}-${row.version}`} id={row.id} version={row.version} status={row.status} /></details>
      <details><summary>最近20筆處理歷程</summary>{row.changes.map((change) => <div key={change.id}><p>{taipeiDate(change.createdAt)} · {change.actor?.name ?? "訪客提交"} · {change.fromStatus ? `${contactStatuses[change.fromStatus]} → ` : ""}{contactStatuses[change.toStatus]}</p><p className="admin-identifier">當次負責人識別碼：{change.assignedToId ?? "未指派"}</p><p className="contact-message-text">{change.note}</p></div>)}</details>
    </article>)}
    {!rows.length && <p className="demo-warning">沒有符合條件的訊息。</p>}
    <Pagination path="/admin/contacts" page={page} total={total} query={{ status, q, assigned }} />
  </>;
}
