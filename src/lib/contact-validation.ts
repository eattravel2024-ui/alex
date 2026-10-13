import { z } from "zod";
export const contactTopics = {
  GENERAL: "一般詢問",
  PARTNERSHIP: "合作提案",
  ACTIVITY: "活動詢問",
  MEMBERSHIP: "會員服務",
};
export const contactStatuses = {
  NEW: "新訊息",
  IN_PROGRESS: "處理中",
  RESOLVED: "已結案",
  SPAM: "垃圾訊息",
};
export const contactSchema = z.object({
  submissionId: z.uuid(),
  name: z.string().trim().min(2).max(60),
  email: z.email().max(254).transform((v) => v.toLowerCase())
    .refine((v) => v.endsWith("@example.test"), "示範表單請使用 @example.test 虛構信箱。"),
  topic: z.enum(["GENERAL", "PARTNERSHIP", "ACTIVITY", "MEMBERSHIP"]),
  subject: z.string().trim().min(2).max(120),
  message: z.string().trim().min(10).max(1500),
  consent: z.literal(true),
  website: z.string().max(0),
}).strict();
export const contactUpdateSchema = z.object({
  version: z.number().int().min(1),
  status: z.enum(["NEW", "IN_PROGRESS", "RESOLVED", "SPAM"]),
  assignment: z.enum(["KEEP", "CLAIM", "RELEASE"]),
  note: z.string().trim().min(2).max(1000),
}).strict();
