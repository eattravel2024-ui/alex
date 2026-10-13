import { currentUser } from "@/lib/server/access";
import { canAdmin, taipeiDate } from "@/lib/admin-permissions";
import { db } from "@/lib/server/db";
import { AccessDenied } from "@/components/admin/access-denied";
import {
  Pagination,
  adminPageSize,
  pageNumber,
} from "@/components/admin/pagination";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await currentUser();
  if (!actor || !canAdmin(actor.role, "audit")) return <AccessDenied />;
  const params = await searchParams;
  const action =
    typeof params.action === "string" && /^[A-Z_]{1,60}$/.test(params.action)
      ? params.action
      : "";
  const where = action ? { action } : {};
  const total = await db.auditLog.count({ where });
  const page = Math.min(
    pageNumber(params.page),
    Math.max(1, Math.ceil(total / adminPageSize)),
  );
  const logs = await db.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * adminPageSize,
    take: adminPageSize,
    select: {
      id: true,
      action: true,
      entityId: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  });
  return (
    <>
      <h2>稽核紀錄</h2>
      <p className="section-description">
        檢視資料變更的操作人、時間與目標識別碼；不呈現密碼、Session token
        或操作原因全文。
      </p>
      <form className="admin-filters" action="/admin/audit">
        <div>
          <label htmlFor="audit-action">操作代碼（精確查詢）</label>
          <input
            id="audit-action"
            name="action"
            defaultValue={action}
            maxLength={60}
            pattern="[A-Z_]*"
            placeholder="例如 MEMBER_DISABLED"
          />
        </div>
        <button className="button button-primary">查詢紀錄</button>
      </form>
      {logs.map((log) => (
        <article className="application-record admin-record" key={log.id}>
          <h3>{log.action}</h3>
          <p>
            {log.actor.name} · {taipeiDate(log.createdAt)}
          </p>
          <p className="admin-identifier">目標：{log.entityId}</p>
        </article>
      ))}
      {!logs.length && <p className="demo-warning">沒有符合條件的紀錄。</p>}
      <Pagination
        path="/admin/audit"
        page={page}
        total={total}
        query={{ action }}
      />
    </>
  );
}
