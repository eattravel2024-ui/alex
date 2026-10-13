import "server-only";
import { cache } from "react";
import { db } from "@/lib/server/db";
import { ServiceError } from "@/lib/server/access";
import { eventSchema, type EventInput } from "@/lib/event-validation";
import type {
  EventRecord,
  Prisma,
  EventRegistration,
  RegistrationStatus,
} from "@/generated/prisma/client";
import type { EventRecord as PublicEvent, SearchQuery } from "@/lib/catalog";
import { queryValue } from "@/lib/catalog";
type Tx = Prisma.TransactionClient;
export const publicEventsWhere: Prisma.EventRecordWhereInput = {
  status: { in: ["PUBLISHED", "CANCELLED"] },
};
export function taipeiIso(date: Date) {
  return new Date(date.getTime() + 8 * 3600000)
    .toISOString()
    .replace(/\.\d{3}Z$/, "+08:00");
}
export function eventView(e: EventRecord): PublicEvent {
  return {
    slug: e.slug,
    title: e.title,
    summary: e.summary,
    category: e.category,
    format: e.format,
    startsAt: taipeiIso(e.startsAt),
    endsAt: taipeiIso(e.endsAt),
    location: e.location,
    eligibility:
      e.eligibility === "MEMBER"
        ? "有效會員限定（示範規則）"
        : "已驗證網站帳號（示範規則）",
    agenda: eventSchema.shape.agenda.parse(e.agenda),
  };
}
function bookingNotice(event: EventRecord) {
  if (event.status === "CANCELLED") return "活動已取消";
  if (
    event.status !== "PUBLISHED" ||
    !event.registrationEnabled ||
    process.env.EVENT_REGISTRATIONS_ENABLED !== "true" ||
    (event.isDemo && process.env.DEVELOPMENT_MODE !== "true")
  )
    return "報名尚未開放";
  if (event.startsAt <= new Date()) return "活動已開始或結束";
  if (event.registrationDeadline <= new Date()) return "報名已截止";
  return "開發測試報名開放中";
}
export async function listPublicEvents(query: SearchQuery = {}, take?: number) {
  const q = queryValue(query.q).trim().slice(0, 120),
    category = queryValue(query.category).slice(0, 40);
  const records = await db.eventRecord.findMany({
    where: {
      ...publicEventsWhere,
      ...(category ? { category } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { summary: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ startsAt: "asc" }, { slug: "asc" }],
    ...(take ? { take } : {}),
  });
  return records.map((e) => ({
    ...eventView(e),
    id: e.id,
    status: e.status,
    registrationEnabled: e.registrationEnabled,
    capacity: e.capacity,
    deadline: e.registrationDeadline.toISOString(),
    bookingLabel: bookingNotice(e),
  }));
}
export const getPublicEvent = cache(async (slug: string) => {
  const event = await db.eventRecord.findFirst({
    where: { ...publicEventsWhere, slug },
  });
  return event
    ? { ...event, view: eventView(event), bookingLabel: bookingNotice(event) }
    : null;
});
async function lockEvent(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "EventRecord" WHERE id=${id}::uuid FOR UPDATE`;
  const e = await tx.eventRecord.findUnique({ where: { id } });
  if (!e) throw new ServiceError(404, "NOT_FOUND", "找不到活動。");
  return e;
}
function localBooking(event: EventRecord) {
  if (process.env.EVENT_REGISTRATIONS_ENABLED !== "true")
    throw new ServiceError(503, "BOOKING_DISABLED", "活動報名目前未開放。");
  if (event.isDemo && process.env.DEVELOPMENT_MODE !== "true")
    throw new ServiceError(403, "DEMO_EVENT", "示範活動只能在開發環境測試。");
}
async function eligible(tx: Tx, event: EventRecord, userId: string) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { disabled: true, emailVerified: true },
  });
  if (!user || user.disabled || !user.emailVerified) return false;
  if (event.eligibility === "ACCOUNT") return true;
  const m = await tx.membership.findUnique({
      where: { userId },
      include: { type: { select: { active: true } } },
    }),
    now = new Date();
  return (
    !!m &&
    m.type.active &&
    m.validFrom <= now &&
    m.validUntil > now &&
    m.validUntil > event.startsAt &&
    (!m.isDemo || process.env.DEVELOPMENT_MODE === "true")
  );
}
async function change(
  tx: Tx,
  r: EventRegistration,
  from: RegistrationStatus | null,
  actorId: string,
  note: string,
  action: string,
) {
  await tx.eventRegistrationChange.create({
    data: {
      registrationId: r.id,
      fromStatus: from,
      toStatus: r.status,
      actorId,
      note,
    },
  });
  await tx.notification.create({
    data: {
      userId: r.userId,
      title: "活動報名狀態更新",
      body: note + "（開發示範，沒有正式活動或付款承諾。）",
    },
  });
  await tx.auditLog.create({ data: { actorId, entityId: r.id, action } });
}
async function promote(tx: Tx, event: EventRecord, actorId: string) {
  if (
    process.env.EVENT_REGISTRATIONS_ENABLED !== "true" ||
    !event.registrationEnabled ||
    (event.isDemo && process.env.DEVELOPMENT_MODE !== "true") ||
    event.status !== "PUBLISHED" ||
    event.registrationDeadline <= new Date() ||
    event.startsAt <= new Date()
  )
    return;
  let available =
    event.capacity -
    (await tx.eventRegistration.count({
      where: { eventId: event.id, status: "CONFIRMED" },
    }));
  if (available <= 0) return;
  const queue = await tx.eventRegistration.findMany({
    where: { eventId: event.id, status: "WAITLISTED" },
    orderBy: { queueOrder: "asc" },
    take: 1000,
  });
  for (const r of queue) {
    if (available <= 0) break;
    const allowed = await eligible(tx, event, r.userId);
    const updated = await tx.eventRegistration.update({
      where: { id: r.id },
      data: { status: allowed ? "CONFIRMED" : "CANCELLED" },
    });
    await change(
      tx,
      updated,
      "WAITLISTED",
      actorId,
      allowed ? "候補已遞補為報名成功。" : "遞補時資格已不符，候補已取消。",
      allowed ? "EVENT_WAITLIST_PROMOTED" : "EVENT_WAITLIST_INELIGIBLE",
    );
    if (allowed) available--;
  }
}
export async function registerEvent(userId: string, eventId: string) {
  return db.$transaction(async (tx) => {
    const event = await lockEvent(tx, eventId);
    localBooking(event);
    if (
      event.status !== "PUBLISHED" ||
      !event.registrationEnabled ||
      event.registrationDeadline <= new Date() ||
      event.startsAt <= new Date()
    )
      throw new ServiceError(
        409,
        "BOOKING_CLOSED",
        "活動未開放、已截止或已開始。",
      );
    if (!(await eligible(tx, event, userId)))
      throw new ServiceError(
        403,
        "INELIGIBLE",
        "此活動要求有效會員資格，且資格須涵蓋活動開始時間；請確認帳號與資格狀態。",
      );
    const old = await tx.eventRegistration.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (old?.checkedInAt)
      throw new ServiceError(
        409,
        "ALREADY_ATTENDED",
        "此活動已有你的報到紀錄，不能重新報名。",
      );
    if (old && old.status !== "CANCELLED")
      throw new ServiceError(409, "ALREADY_REGISTERED", "已有報名或候補紀錄。");
    await promote(tx, event, userId);
    const count = await tx.eventRegistration.count({
      where: { eventId, status: "CONFIRMED" },
    });
    const status = count < event.capacity ? "CONFIRMED" : "WAITLISTED";
    if (
      status === "WAITLISTED" &&
      (!event.waitlistEnabled ||
        (await tx.eventRegistration.count({
          where: { eventId, status: "WAITLISTED" },
        })) >= 1000)
    )
      throw new ServiceError(
        409,
        "EVENT_FULL",
        "名額已滿，候補未開放或已達上限。",
      );
    let r: EventRegistration;
    if (old) {
      const next = await tx.$queryRaw<
        { n: bigint }[]
      >`SELECT nextval(pg_get_serial_sequence('"EventRegistration"','queueOrder')) AS n`;
      r = await tx.eventRegistration.update({
        where: { id: old.id },
        data: {
          status,
          queueOrder: next[0].n,
          checkedInAt: null,
          checkedInById: null,
        },
      });
    } else
      r = await tx.eventRegistration.create({
        data: { eventId, userId, status },
      });
    await change(
      tx,
      r,
      old?.status ?? null,
      userId,
      status === "CONFIRMED"
        ? "活動報名已確認。"
        : "名額已滿，已加入候補；遞補前會再次確認資格。",
      "EVENT_REGISTERED",
    );
    return { id: r.id, status: r.status };
  });
}
export async function cancelRegistration(userId: string, eventId: string) {
  return db.$transaction(async (tx) => {
    const event = await lockEvent(tx, eventId);
    const r = await tx.eventRegistration.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (!r) throw new ServiceError(404, "NOT_FOUND", "沒有你的報名紀錄。");
    if (r.status === "CANCELLED")
      throw new ServiceError(409, "ALREADY_CANCELLED", "報名已取消。");
    if (r.checkedInAt || event.startsAt <= new Date())
      throw new ServiceError(
        409,
        "CANNOT_CANCEL",
        "已報到或活動已開始，請聯絡協會。",
      );
    const updated = await tx.eventRegistration.update({
      where: { id: r.id },
      data: { status: "CANCELLED" },
    });
    await change(
      tx,
      updated,
      r.status,
      userId,
      "你已取消活動報名。",
      "EVENT_REGISTRATION_CANCELLED",
    );
    await promote(tx, event, userId);
    return { updated: true, status: "CANCELLED" };
  });
}
export async function saveEvent(
  actorId: string,
  input: EventInput,
  id?: string,
  version?: number,
) {
  try {
    return await db.$transaction(async (tx) => {
      const current = id ? await lockEvent(tx, id) : null;
      if (current) {
        if (current.version !== version)
          throw new ServiceError(
            409,
            "STALE_EVENT",
            "活動已被更新，請保留修改後重新讀取。",
          );
        if (current.slug !== input.slug)
          throw new ServiceError(
            400,
            "IMMUTABLE_URL",
            "活動網址建立後不能變更。",
          );
        const active = await tx.eventRegistration.count({
          where: { eventId: id, status: { in: ["CONFIRMED", "WAITLISTED"] } },
        });
        const confirmed = await tx.eventRegistration.count({
          where: { eventId: id, status: "CONFIRMED" },
        });
        if (input.capacity < confirmed)
          throw new ServiceError(
            409,
            "CAPACITY_CONFLICT",
            "名額不能少於已確認報名數。",
          );
        if (
          active &&
          (input.startsAt !== current.startsAt.toISOString() ||
            input.endsAt !== current.endsAt.toISOString() ||
            input.registrationDeadline !==
              current.registrationDeadline.toISOString() ||
            input.eligibility !== current.eligibility)
        ) {
          if (
            new Date(input.startsAt).getTime() !== current.startsAt.getTime() ||
            new Date(input.endsAt).getTime() !== current.endsAt.getTime() ||
            new Date(input.registrationDeadline).getTime() !==
              current.registrationDeadline.getTime() ||
            input.eligibility !== current.eligibility
          )
            throw new ServiceError(
              409,
              "RULES_LOCKED",
              "已有報名時不能變更時間、截止或资格；請先取消活動並通知報名者。",
            );
        }
        if (active && ["DRAFT", "ARCHIVED"].includes(input.status))
          throw new ServiceError(
            409,
            "ACTIVE_REGISTRATIONS",
            "仍有報名／候補，請先以取消活動通知參加者。",
          );
        if (
          current.status === "CANCELLED" &&
          input.status !== "CANCELLED" &&
          active
        )
          throw new ServiceError(
            409,
            "INVALID_STATE",
            "取消活動仍有待處理報名。",
          );
      }
      const data = {
        ...input,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        registrationDeadline: new Date(input.registrationDeadline),
        updatedById: actorId,
        isDemo: true,
      };
      const event = id
        ? await tx.eventRecord.update({
            where: { id },
            data: { ...data, version: { increment: 1 } },
          })
        : await tx.eventRecord.create({ data });
      if (input.status === "CANCELLED") {
        const bookings = await tx.eventRegistration.findMany({
          where: {
            eventId: event.id,
            status: { in: ["CONFIRMED", "WAITLISTED"] },
          },
        });
        for (const r of bookings) {
          const updated = await tx.eventRegistration.update({
            where: { id: r.id },
            data: { status: "CANCELLED" },
          });
          await change(
            tx,
            updated,
            r.status,
            actorId,
            "協會已取消此示範活動，報名／候補一併取消。",
            "EVENT_CANCELLED_BY_ADMIN",
          );
        }
      } else if (
        current &&
        (event.capacity > current.capacity ||
          (!current.registrationEnabled && event.registrationEnabled))
      )
        await promote(tx, event, actorId);
      await tx.auditLog.create({
        data: {
          actorId,
          entityId: event.id,
          action: id ? "EVENT_UPDATED" : "EVENT_CREATED",
        },
      });
      return { id: event.id, version: event.version, status: event.status };
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    )
      throw new ServiceError(409, "DUPLICATE_SLUG", "此活動網址識別碼已使用。");
    throw error;
  }
}
export async function checkInEvent(
  actorId: string,
  eventId: string,
  registrationId: string,
) {
  return db.$transaction(async (tx) => {
    const event = await lockEvent(tx, eventId);
    localBooking(event);
    if (
      event.status !== "PUBLISHED" ||
      new Date() < new Date(event.startsAt.getTime() - 2 * 3600000) ||
      new Date() > event.endsAt
    )
      throw new ServiceError(
        409,
        "CHECKIN_CLOSED",
        "報到僅限開始前兩小時至活動結束。",
      );
    const r = await tx.eventRegistration.findFirst({
      where: { id: registrationId, eventId },
    });
    if (!r) throw new ServiceError(404, "NOT_FOUND", "找不到此活動的報名。");
    if (r.status !== "CONFIRMED" || r.checkedInAt)
      throw new ServiceError(
        409,
        "INVALID_CHECKIN",
        "僅可對尚未報到的已確認報名操作。",
      );
    if (!(await eligible(tx, event, r.userId)))
      throw new ServiceError(403, "INELIGIBLE", "參加者帳號或會員資格已不符。");
    await tx.eventRegistration.update({
      where: { id: r.id },
      data: { checkedInAt: new Date(), checkedInById: actorId },
    });
    await tx.auditLog.create({
      data: { actorId, entityId: r.id, action: "EVENT_CHECKED_IN" },
    });
    return { updated: true };
  });
}
