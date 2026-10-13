import { currentUser } from "@/lib/server/access";
import { canAdmin, roleLabels, taipeiDate } from "@/lib/admin-permissions";
import { db } from "@/lib/server/db";
import { AccessDenied } from "@/components/admin/access-denied";
import { MemberStateForm } from "@/components/admin/admin-forms";
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
  if (!actor || !canAdmin(actor.role, "members")) return <AccessDenied />;
  const params = await searchParams,
    q = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const state =
    params.state === "disabled"
      ? "disabled"
      : params.state === "enabled"
        ? "enabled"
        : "all";
  const where: Prisma.UserWhereInput = {
    ...(state !== "all" ? { disabled: state === "disabled" } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const total = await db.user.count({ where });
  const page = Math.min(
    pageNumber(params.page),
    Math.max(1, Math.ceil(total / adminPageSize)),
  );
  const users = await db.user.findMany({
    where,
    skip: (page - 1) * adminPageSize,
    take: adminPageSize,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      role: true,
      disabled: true,
      createdAt: true,
      membership: {
        select: {
          memberNumber: true,
          isDemo: true,
          validUntil: true,
          type: { select: { name: true } },
        },
      },
    },
  });
  return (
    <>
      <h2>帳號管理</h2>
      <p className="section-description">
        帳號停用會撤銷登入，不會取消會員資格。角色指派與會員資格修改尚未提供後台操作。
      </p>
      <form className="admin-filters" action="/admin/members">
        <div>
          <label htmlFor="member-q">姓名或信箱</label>
          <input id="member-q" name="q" defaultValue={q} maxLength={120} />
        </div>
        <div>
          <label htmlFor="member-state">帳號狀態</label>
          <select id="member-state" name="state" defaultValue={state}>
            <option value="all">全部</option>
            <option value="enabled">啟用</option>
            <option value="disabled">停用</option>
          </select>
        </div>
        <button className="button button-primary">查詢帳號</button>
      </form>
      {users.map((user) => (
        <article key={user.id} className="application-record admin-record">
          <h3>
            {user.name} · {user.disabled ? "已停用" : "啟用中"}
          </h3>
          <p className="admin-identifier">{user.email}</p>
          <p>
            {roleLabels[user.role]} ·{" "}
            {user.emailVerified ? "信箱已驗證" : "信箱尚未驗證"} ·{" "}
            {taipeiDate(user.createdAt)}
          </p>
          {user.membership ? (
            <p>
              會員類別：{user.membership.type.name}
              {user.membership.isDemo ? "（開發示範）" : ""} · 有效至{" "}
              {taipeiDate(user.membership.validUntil)}
            </p>
          ) : (
            <p>尚無會員資格</p>
          )}
          {user.role === "MEMBER" && user.id !== actor.id ? (
            <details>
              <summary>管理帳號狀態</summary>
              <MemberStateForm
                key={`${user.id}-${user.disabled}`}
                id={user.id}
                disabled={user.disabled}
              />
            </details>
          ) : (
            <p>管理角色受到保護，不能在此停用。</p>
          )}
        </article>
      ))}
      {!users.length && <p className="demo-warning">没有符合條件的帳號。</p>}
      <Pagination
        path="/admin/members"
        page={page}
        total={total}
        query={{ q, state }}
      />
    </>
  );
}
