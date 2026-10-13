import "server-only";
import { db } from "@/lib/server/db";
import { ServiceError } from "@/lib/server/access";

// The caller must authorize the current request before entering this transaction.
// Role changes and membership changes are deliberately separate operations.
export async function setMemberDisabled(
  actorId: string,
  targetId: string,
  disabled: boolean,
  expectedDisabled: boolean,
  note: string,
) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${targetId}::uuid FOR UPDATE`;
    const target = await tx.user.findUnique({
      where: { id: targetId },
      select: { id: true, role: true, disabled: true },
    });
    if (!target) throw new ServiceError(404, "NOT_FOUND", "找不到帳號。");
    if (actorId === targetId || target.role !== "MEMBER")
      throw new ServiceError(
        403,
        "PROTECTED_ACCOUNT",
        "僅可操作其他一般會員帳號。管理角色請另由權限管理流程處理。",
      );
    if (target.disabled !== expectedDisabled || target.disabled === disabled)
      throw new ServiceError(
        409,
        "STALE_MEMBER",
        "帳號狀態已變更，請重新讀取。",
      );
    await tx.user.update({ where: { id: targetId }, data: { disabled } });
    // Both disable and re-enable require a fresh login. No previously issued session survives.
    await tx.session.deleteMany({ where: { userId: targetId } });
    await tx.notification.create({
      data: {
        userId: targetId,
        title: disabled ? "帳號已停用" : "帳號已恢復",
        body: note,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: disabled ? "MEMBER_DISABLED" : "MEMBER_ENABLED",
        entityId: targetId,
      },
    });
    return { updated: true, disabled };
  });
}
