import { z } from "zod";
export const passwordSchema = z
  .string()
  .min(8, "密碼至少 8 字元")
  .max(128, "密碼不得超過 128 字元")
  .regex(/[A-Za-z]/, "密碼需包含英文字母")
  .regex(/[0-9]/, "密碼需包含數字");
export const registrationSchema = z.object({
  name: z.string().trim().min(2, "姓名至少 2 字").max(60),
  email: z
    .email("請輸入有效信箱")
    .max(254)
    .transform((v) => v.toLowerCase().trim()),
  password: passwordSchema,
  termsAccepted: z.literal(true, { error: "請同意服務條款" }),
  privacyAccepted: z.literal(true, { error: "請同意隱私權政策" }),
});
export const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    phone: z
      .string()
      .trim()
      .max(30)
      .regex(/^[0-9+()\s-]*$/)
      .optional(),
    emailNotifications: z.boolean(),
  })
  .strict();
export const applicationSchema = z
  .object({
    typeId: z.uuid(),
    motivation: z.string().trim().min(10, "申請說明至少 10 字").max(1000),
  })
  .strict();
export const reviewSchema = z
  .object({
    status: z.enum(["APPROVED", "RETURNED", "REJECTED"]),
    note: z.string().trim().min(2).max(500),
    version: z.number().int().min(1),
    validUntil: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();
export const bookmarkSchema = z
  .object({
    slug: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9-]+$/),
  })
  .strict();
