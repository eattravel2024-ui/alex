import { z } from "zod";
import { mediaImageId } from "./media-validation.ts";
export const articleStatuses = {
  DRAFT: "草稿",
  PUBLISHED: "已發布",
  SCHEDULED: "排程發布",
  ARCHIVED: "已下架",
};
export const articleImages = [
  "/images/living.svg",
  "/images/nutrition.svg",
  "/images/mind.svg",
] as const;
const httpsLink = z
  .string()
  .max(2048)
  .url()
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  }, "來源僅接受不含帳密的 HTTPS 網址");
export const articleFieldsSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(3)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    kind: z.enum(["news", "knowledge"]),
    title: z.string().trim().min(2).max(120),
    summary: z.string().trim().min(5).max(500),
    category: z.string().trim().min(1).max(40),
    tags: z
      .array(z.string().trim().min(1).max(40))
      .max(10)
      .transform((tags) => [...new Set(tags)]),
    image: z.string().refine((value) =>
      (articleImages as readonly string[]).includes(value) || mediaImageId(value) !== null,
      "請選擇內建插畫或已上傳的封面圖片",
    ),
    imageAlt: z.string().trim().max(160).default(""),
    author: z.string().trim().min(2).max(60),
    featured: z.boolean(),
    reviewedAt: z.iso.date().nullable(),
    blocks: z
      .array(
        z
          .object({
            heading: z.string().trim().min(1).max(120),
            paragraphs: z
              .array(z.string().trim().min(1).max(2000))
              .min(1)
              .max(10),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    references: z
      .array(
        z
          .object({ title: z.string().trim().min(1).max(120), url: httpsLink })
          .strict(),
      )
      .max(20),
  })
  .strict();
export const articleInputSchema = articleFieldsSchema
  .extend({
    status: z.enum(["DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED"]),
    publishAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .strict();
export const articleUpdateSchema = articleInputSchema
  .extend({ version: z.number().int().positive() })
  .strict();
export type ArticleInput = z.infer<typeof articleInputSchema>;

export const emptyArticle: ArticleInput = {
  slug: "",
  kind: "knowledge",
  title: "",
  summary: "",
  category: "健康生活",
  tags: [],
  image: "/images/living.svg",
  imageAlt: "",
  author: "網站編輯（開發示範）",
  featured: false,
  reviewedAt: null,
  blocks: [{ heading: "", paragraphs: [""] }],
  references: [],
  status: "DRAFT",
  publishAt: null,
};
