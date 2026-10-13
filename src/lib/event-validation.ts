import { z } from "zod";
export const eventStatuses = {
  DRAFT: "草稿",
  PUBLISHED: "已公開",
  CANCELLED: "活動取消",
  ARCHIVED: "已下架",
};
export const registrationLabels = {
  CONFIRMED: "報名成功",
  WAITLISTED: "候補中",
  CANCELLED: "已取消",
};
export const eventSchema = z
  .object({
    slug: z
      .string()
      .min(3)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().trim().min(2).max(120),
    summary: z.string().trim().min(5).max(1000),
    category: z.string().trim().min(1).max(40),
    format: z.string().trim().min(1).max(60),
    location: z.string().trim().min(2).max(200),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    registrationDeadline: z.iso.datetime({ offset: true }),
    status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED", "ARCHIVED"]),
    eligibility: z.enum(["ACCOUNT", "MEMBER"]),
    capacity: z.number().int().min(1).max(1000),
    registrationEnabled: z.boolean(),
    waitlistEnabled: z.boolean(),
    agenda: z
      .array(
        z
          .object({
            time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
            title: z.string().trim().min(1).max(120),
          })
          .strict(),
      )
      .max(30),
  })
  .strict()
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), {
    message: "結束時間須晚於開始时间",
    path: ["endsAt"],
  })
  .refine((v) => new Date(v.registrationDeadline) <= new Date(v.startsAt), {
    message: "報名截止不能晚於活動開始",
    path: ["registrationDeadline"],
  });
export const eventUpdateSchema = eventSchema.safeExtend({
  version: z.number().int().positive(),
});
export type EventInput = z.infer<typeof eventSchema>;
export const emptyEvent: EventInput = {
  slug: "",
  title: "",
  summary: "",
  category: "健康講座",
  format: "實體講座",
  location: "示範地點，待正式確認",
  startsAt: "",
  endsAt: "",
  registrationDeadline: "",
  status: "DRAFT",
  eligibility: "ACCOUNT",
  capacity: 20,
  registrationEnabled: false,
  waitlistEnabled: false,
  agenda: [{ time: "14:00", title: "" }],
};
