import { z } from "zod";
import { requireAdmin, handleError, ServiceError } from "@/lib/server/access";
import { db } from "@/lib/server/db";
import { csvRows } from "@/lib/csv";
import { registrationLabels } from "@/lib/event-validation";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAdmin("eventOperations", request.headers);
    const id = z.uuid().parse((await params).id);
    if (
      !(await db.eventRecord.findUnique({
        where: { id },
        select: { id: true },
      }))
    )
      throw new ServiceError(404, "NOT_FOUND", "找不到活動。");
    const rows = await db.eventRegistration.findMany({
      where: { eventId: id },
      orderBy: { queueOrder: "asc" },
      take: 2001,
      select: {
        id: true,
        status: true,
        checkedInAt: true,
        user: { select: { name: true, email: true } },
      },
    });
    if (rows.length > 2000)
      throw new ServiceError(
        413,
        "EXPORT_TOO_LARGE",
        "超過本機匯出上限2000筆，請使用後續分批流程。",
      );
    await db.auditLog.create({
      data: { actorId: actor.id, entityId: id, action: "EVENT_CSV_EXPORTED" },
    });
    return new Response(
      csvRows([
        ["報名識別碼", "姓名", "電子郵件", "狀態", "報到時間（UTC）"],
        ...rows.map((r) => [
          r.id,
          r.user.name,
          r.user.email,
          registrationLabels[r.status],
          r.checkedInAt?.toISOString() ?? "",
        ]),
      ]),
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="event-${id}.csv"`,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (error) {
    return handleError(error);
  }
}
