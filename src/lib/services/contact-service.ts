import "server-only";
import type { z } from "zod";
import { contactSchema, contactUpdateSchema } from "@/lib/contact-validation";
import { db } from "@/lib/server/db";
import { ServiceError } from "@/lib/server/access";
import { contactEnabled } from "@/lib/server/contact-settings";

export async function submitContact(input: z.infer<typeof contactSchema>) {
  if (!contactEnabled())
    throw new ServiceError(503, "CONTACT_CLOSED", "示範聯絡提交尚未開放。");
  return db.$transaction(async (tx) => {
    // Serializes retries without creating multiple messages or disclosing prior contents.
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${input.submissionId}, 0))`;
    const previous = await tx.contactMessage.findUnique({ where: { id: input.submissionId } });
    if (previous) {
      if ((["name", "email", "topic", "subject", "message"] as const).some((key) =>
        previous[key] !== input[key]))
        throw new ServiceError(409, "SUBMISSION_CONFLICT", "提交資料已變更，請重新送出。");
      return { reference: previous.id };
    }
    const row = await tx.contactMessage.create({ data: {
      id: input.submissionId, name: input.name, email: input.email,
      topic: input.topic, subject: input.subject, message: input.message,
      consentVersion: "contact-demo-v1", isDemo: true,
      changes: { create: { toStatus: "NEW", note: "示範訊息提交" } },
    } });
    return { reference: row.id };
  });
}

export async function updateContact(actorId: string, id: string, input: z.infer<typeof contactUpdateSchema>) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ContactMessage" WHERE id=${id}::uuid FOR UPDATE`;
    const previous = await tx.contactMessage.findUnique({ where: { id } });
    if (!previous) throw new ServiceError(404, "NOT_FOUND", "找不到訊息。");
    if (previous.version !== input.version)
      throw new ServiceError(409, "STALE_CONTACT", "訊息已由其他人更新，請重新讀取。");
    if (input.assignment !== "KEEP" && previous.assignedToId && previous.assignedToId !== actorId)
      throw new ServiceError(409, "ALREADY_ASSIGNED", "已由其他工作人員接手，請由原處理人釋出。");
    const assignedToId = input.assignment === "CLAIM" ? actorId
      : input.assignment === "RELEASE" ? null : previous.assignedToId;
    await tx.contactMessage.update({ where: { id }, data: {
      status: input.status, assignedToId, version: { increment: 1 },
    } });
    await tx.contactMessageChange.create({ data: {
      contactId: id, actorId, fromStatus: previous.status, toStatus: input.status,
      assignedToId, note: input.note,
    } });
    await tx.auditLog.create({ data: { actorId, entityId: id, action: "CONTACT_UPDATED" } });
    return { updated: true };
  });
}
