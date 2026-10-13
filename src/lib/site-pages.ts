import { z } from "zod";
export const pageKeys = z.enum(["home", "about"]);
export const pageContentSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(600),
  sections: z.array(z.object({
    id: z.string().regex(/^[a-z]+$/),
    heading: z.string().trim().min(2).max(120),
    body: z.string().trim().min(2).max(3000),
  }).strict()).min(3).max(6),
}).strict();
export type PageContent = z.infer<typeof pageContentSchema>;
export type PageKey = z.infer<typeof pageKeys>;
export const pageDefaults: Record<PageKey, PageContent> = {
  home: {
    title: "讓健康，\n成為每個人的\n美好日常。",
    description: "從理解健康，到實踐健康。\n以知識連結彼此，以行動照顧生活，\n一起走向更有品質的每一天。",
    sections: [
      { id: "about", heading: "健康的未來，從我們一起開始。", body: "我們期待成為健康知識與日常生活之間的橋梁，讓每個人都有機會理解健康、關心自己，也關心身邊的人。" },
      { id: "services", heading: "陪伴健康生活的每一步", body: "從知識、交流到參與，建立相互支持的健康生活網絡。以下為服務方向示範。" },
      { id: "membership", heading: "健康同行，\n從認識彼此開始。", body: "期待與你一起，讓健康成為更有力量的日常。" },
    ],
  },
  about: {
    title: "健康的未來，從我們一起開始。", description: "讓知識貼近生活，讓每一次交流帶來更多可能。",
    sections: [
      { id: "intro", heading: "協會簡介", body: "以下為可替換的示範文案：我們期待成為健康知識與日常實踐之間的橋梁，透過交流、學習與相互支持，讓更多人理解健康。" },
      { id: "mission", heading: "願景與使命", body: "示範理念：知識共享、健康同行、以人為本。實際成立宗旨與服務對象將以正式章程為準。" },
      { id: "history", heading: "沿革與組織架構", body: "成立日期、重要里程碑、部門與組織關係尚未提供。此處將保留正式資料的展示位置，不以虛構年表替代。" },
      { id: "team", heading: "理事長、理監事與顧問團隊", body: "姓名、職稱、照片、任期與介紹皆待本人及協會授權確認。目前不展示虛構人物或專業資格。" },
      { id: "documents", heading: "章程與重要文件", body: "正式章程、入會辦法及其他公開文件待提供。尚無可下載文件；公開前需確認版本、隱私與分享權限。" },
      { id: "partners", heading: "合作單位", body: "合作關係與 Logo 使用權待確認，暫不列出任何未授權的機構名稱。" },
    ],
  },
};
export function validatePageContent(key: PageKey, value: unknown) {
  const data = pageContentSchema.parse(value);
  const expected = pageDefaults[key].sections.map((s) => s.id);
  if (data.sections.length !== expected.length || data.sections.some((s, i) => s.id !== expected[i]))
    throw new Error("Page section identifiers and order are fixed.");
  return data;
}
