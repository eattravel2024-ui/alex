import { requireAdmin, handleError, ServiceError } from "@/lib/server/access";
import { db } from "@/lib/server/db";
import { csvRows } from "@/lib/csv";
import { memberFilters } from "@/lib/member-filters";
import { roleLabels } from "@/lib/admin-permissions";

// Metadata probes must not trigger a personal-data export or audit entry.
export function HEAD() {
  return new Response(null, { status: 405, headers: { Allow: "GET", "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  try {
    const actor = await requireAdmin("members", request.headers);
    const params = new URL(request.url).searchParams;
    const { where } = memberFilters({
      q: params.get("q") ?? undefined,
      state: params.get("state") ?? undefined,
    });
    const rows = await db.$transaction(async (tx) => {
      const users = await tx.user.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: 1001,
        select: {
          id: true, name: true, email: true, emailVerified: true,
          role: true, disabled: true,
          membership: {
            select: {
              memberNumber: true, validFrom: true, validUntil: true,
              isDemo: true, type: { select: { name: true, active: true } },
            },
          },
        },
      });
      if (users.length > 1000)
        throw new ServiceError(413, "EXPORT_TOO_LARGE", "超過匯出上限1000筆，請縮小查詢範圍後重試。");
      await tx.auditLog.create({
        data: { actorId: actor.id, entityId: actor.id, action: "MEMBER_CSV_EXPORTED" },
      });
      return users;
    }, { isolationLevel: "RepeatableRead" });
    return new Response(csvRows([
      ["帳號識別碼", "姓名", "電子郵件", "信箱驗證", "角色", "帳號狀態", "會員編號", "會員類別", "類別狀態", "資格開始（UTC）", "資格到期（UTC）", "資格性質"],
      ...rows.map((r) => [
        r.id, r.name, r.email, r.emailVerified ? "已驗證" : "未驗證",
        roleLabels[r.role], r.disabled ? "停用" : "啟用",
        r.membership?.memberNumber ?? "", r.membership?.type.name ?? "",
        r.membership ? (r.membership.type.active ? "啟用" : "停用") : "",
        r.membership?.validFrom.toISOString() ?? "",
        r.membership?.validUntil.toISOString() ?? "",
        r.membership ? (r.membership.isDemo ? "示範資格（無正式效力）" : "正式資格") : "尚無會員資格",
      ]),
    ]), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="member-accounts.csv"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
