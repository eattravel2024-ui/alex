import "server-only";
import { db } from "@/lib/server/db";
import { ServiceError } from "@/lib/server/access";
import { getArticle } from "@/lib/services/content-service";
import type { z } from "zod";
import {
  profileSchema,
  applicationSchema,
  reviewSchema,
} from "@/lib/validation";
export async function memberDashboard(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      termsAcceptedAt: true,
      privacyAcceptedAt: true,
      profile: true,
      membership: { include: { type: true } },
      applications: {
        include: { type: true, history: { orderBy: { createdAt: "desc" } } },
        orderBy: { createdAt: "desc" },
      },
      notifications: { orderBy: { createdAt: "desc" }, take: 20 },
      bookmarks: { orderBy: { createdAt: "desc" } },
    },
  });
}
export async function updateProfile(
  userId: string,
  input: z.infer<typeof profileSchema>,
) {
  return db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { name: input.name } });
    await tx.memberProfile.upsert({
      where: { userId },
      create: {
        userId,
        phone: input.phone || null,
        emailNotifications: input.emailNotifications,
      },
      update: {
        phone: input.phone || null,
        emailNotifications: input.emailNotifications,
      },
    });
    await tx.auditLog.create({
      data: { actorId: userId, action: "PROFILE_UPDATED", entityId: userId },
    });
    return { updated: true };
  });
}
export async function submitApplication(
  userId: string,
  input: z.infer<typeof applicationSchema>,
) {
  if (process.env.MEMBERSHIP_APPLICATIONS_ENABLED !== "true")
    throw new ServiceError(503, "APPLICATIONS_CLOSED", "入會申請尚未開放。");
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
    if (await tx.membership.findUnique({ where: { userId } }))
      throw new ServiceError(
        409,
        "ALREADY_MEMBER",
        "已有會員資格，請聯絡協會處理續期。",
      );
    const type = await tx.membershipType.findUnique({
      where: { id: input.typeId },
    });
    if (!type?.active)
      throw new ServiceError(400, "INVALID_TYPE", "會員類別無效。");
    if (type.isDemo && process.env.DEVELOPMENT_MODE !== "true")
      throw new ServiceError(
        503,
        "DEMO_TYPE",
        "示範會員類別不能用於正式申請。",
      );
    const pending = await tx.membershipApplication.findFirst({
      where: { userId, status: "PENDING" },
    });
    if (pending)
      throw new ServiceError(409, "DUPLICATE_APPLICATION", "已有待審核申請。");
    const returned = await tx.membershipApplication.findFirst({
      where: { userId, status: "RETURNED" },
    });
    const application = returned
      ? await tx.membershipApplication.update({
          where: { id: returned.id },
          data: {
            typeId: input.typeId,
            motivation: input.motivation,
            status: "PENDING",
            reviewNote: null,
            version: { increment: 1 },
          },
        })
      : await tx.membershipApplication.create({
          data: {
            userId,
            typeId: input.typeId,
            motivation: input.motivation,
            isDemo: type.isDemo,
          },
        });
    await tx.membershipStatusHistory.create({
      data: {
        applicationId: application.id,
        actorId: userId,
        fromStatus: returned ? "RETURNED" : undefined,
        toStatus: "PENDING",
      },
    });
    await tx.notification.create({
      data: {
        userId,
        title: "入會申請已送出",
        body: application.isDemo
          ? "開發測試申請已送出，等待審核；不代表正式會員資格。"
          : "申請已送出，等待協會審核。",
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: "APPLICATION_SUBMITTED",
        entityId: application.id,
      },
    });
    return { id: application.id, status: application.status };
  });
}
export async function reviewApplication(
  reviewerId: string,
  id: string,
  input: z.infer<typeof reviewSchema>,
) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "MembershipApplication" WHERE id = ${id}::uuid FOR UPDATE`;
    const application = await tx.membershipApplication.findUnique({
      where: { id },
      include: { type: true },
    });
    if (!application) throw new ServiceError(404, "NOT_FOUND", "找不到申請。");
    if (application.userId === reviewerId)
      throw new ServiceError(403, "SELF_REVIEW", "不能審核自己的申請。");
    if (
      application.status !== "PENDING" ||
      application.version !== input.version
    )
      throw new ServiceError(
        409,
        "STALE_REVIEW",
        "申請狀態已變更，請重新讀取。",
      );
    if (application.isDemo && process.env.DEVELOPMENT_MODE !== "true")
      throw new ServiceError(403, "DEMO_REVIEW", "示範申請不能用於正式審核。");
    if (input.status === "APPROVED") {
      if (!input.validUntil || new Date(input.validUntil) <= new Date())
        throw new ServiceError(
          400,
          "INVALID_EXPIRY",
          "核准須指定未來的有效期限。",
        );
      await tx.membership.create({
        data: {
          userId: application.userId,
          typeId: application.typeId,
          memberNumber:
            (application.isDemo ? "DEMO-" : "M-") + crypto.randomUUID(),
          validFrom: new Date(),
          validUntil: new Date(input.validUntil),
          isDemo: application.isDemo,
        },
      });
    }
    await tx.membershipApplication.update({
      where: { id },
      data: {
        status: input.status,
        reviewerId,
        reviewNote: input.note,
        version: { increment: 1 },
      },
    });
    await tx.membershipStatusHistory.create({
      data: {
        applicationId: id,
        actorId: reviewerId,
        fromStatus: "PENDING",
        toStatus: input.status,
        note: input.note,
      },
    });
    await tx.notification.create({
      data: {
        userId: application.userId,
        title: "入會申請審核更新",
        body: `申請狀態：${{ APPROVED: "核准", RETURNED: "退回補件", REJECTED: "拒絕" }[input.status]}。${application.isDemo ? "此為開發測試，不授予正式會員資格。" : ""}`,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: reviewerId,
        action: "APPLICATION_" + input.status,
        entityId: id,
      },
    });
    return { updated: true, status: input.status };
  });
}
export async function toggleBookmark(
  userId: string,
  slug: string,
  remove = false,
) {
  if (remove) {
    await db.articleBookmark.deleteMany({
      where: { userId, articleSlug: slug },
    });
    return { saved: false };
  }
  if (!(await getArticle("knowledge", slug)))
    throw new ServiceError(404, "NOT_FOUND", "找不到健康文章。");
  await db.articleBookmark.upsert({
    where: { userId_articleSlug: { userId, articleSlug: slug } },
    create: { userId, articleSlug: slug },
    update: {},
  });
  return { saved: true };
}
