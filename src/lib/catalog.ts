/** Phase 2 fixtures. Replace behind the service boundary with Prisma in Phase 3. */
export type ArticleKind = "news" | "knowledge";
export type ContentBlock = { heading: string; paragraphs: string[] };
export type Article = {
  slug: string;
  kind: ArticleKind;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  image: string;
  publishedAt: string;
  author: string;
  featured: boolean;
  reviewedAt: string | null;
  blocks: ContentBlock[];
  references: { title: string; url: string }[];
};
const knowledgeBase = [
  {
    slug: "everyday-health",
    title: "把健康，放回生活的日常裡",
    summary: "從睡眠、飲食與活動開始，練習更有意識地照顧自己。",
    category: "健康生活",
    tags: ["生活習慣", "日常實踐"],
    image: "/images/living.svg",
    blocks: [
      {
        heading: "先觀察，再選擇一個小改變",
        paragraphs: [
          "健康管理可以從整理自己的生活節奏開始。先記錄睡眠、用餐與活動的日常情況，再選擇一項可持續的小調整。",
          "每個人的生活條件與身體狀況不同。一般性知識不等於個別照護計畫；若有疾病、持續不適或用藥問題，請尋求合格醫療專業協助。",
        ],
      },
      {
        heading: "為自己留下一點餘裕",
        paragraphs: [
          "把休息、日常活動與社交支持放進行事曆，並定期回顧自己的感受。不要把健康習慣變成另一個壓力來源。",
        ],
      },
    ],
  },
  {
    slug: "balanced-eating",
    title: "好好吃飯，是照顧自己的第一步",
    summary: "認識均衡飲食的基本概念，建立適合自己的生活節奏。",
    category: "營養與飲食",
    tags: ["均衡飲食", "生活習慣"],
    image: "/images/nutrition.svg",
    blocks: [
      {
        heading: "從多樣性理解飲食",
        paragraphs: [
          "一般健康飲食資訊強調食物多樣性，以及蔬菜、水果、全穀與適當蛋白質來源。生活中的選擇也需考慮取得食物的條件、文化與個人需求。",
        ],
      },
      {
        heading: "避免把單一食物當成療方",
        paragraphs: [
          "沒有一份示範菜單適用所有人。疾病、食物過敏、懷孕或特殊營養需求，應由合格專業人員提供個別建議。本文不提供治療飲食或療效保證。",
        ],
      },
    ],
  },
  {
    slug: "space-for-yourself",
    title: "留一點時間，與自己好好相處",
    summary: "在忙碌之間停下腳步，覺察壓力與情緒，尋找支持。",
    category: "心理健康",
    tags: ["壓力覺察", "支持網絡"],
    image: "/images/mind.svg",
    blocks: [
      {
        heading: "看見自己的感受",
        paragraphs: [
          "在一天中留下一段短暫的時間，注意自己的情緒、身體感受與生活負荷。用簡單的文字記錄，或與信任的人交流，可能有助於整理需求。",
        ],
      },
      {
        heading: "尋找合適的支持",
        paragraphs: [
          "自我照顧不能取代專業服務。若情緒或壓力持續影響日常功能，請向合格心理或醫療專業尋求協助；有立即危險時應聯絡當地緊急服務。",
        ],
      },
    ],
  },
  {
    slug: "move-at-your-pace",
    title: "找到適合自己的活動節奏",
    summary: "從可負擔的日常活動開始，讓身體動起來。",
    category: "運動與體適能",
    tags: ["日常活動", "生活習慣"],
    image: "/images/living.svg",
    blocks: [
      {
        heading: "以可持續為起點",
        paragraphs: [
          "日常步行、家務或減少久坐，都是認識自己活動習慣的切入點。選擇符合能力與環境的方式，不必追求與他人相同的進度。",
        ],
      },
      {
        heading: "安全優先",
        paragraphs: [
          "如有心血管、關節或其他健康問題，開始新的運動安排前請諮詢合格專業人員。出現胸痛、暈眩或異常不適時，停止活動並尋求適當協助。",
        ],
      },
    ],
  },
  {
    slug: "healthy-aging",
    title: "與家人一起規劃友善的健康日常",
    summary: "用溝通與生活支持，陪伴不同年齡的家人。",
    category: "銀髮健康",
    tags: ["家庭支持", "生活習慣"],
    image: "/images/mind.svg",
    blocks: [
      {
        heading: "從需求與偏好開始",
        paragraphs: [
          "與家人討論生活安排時，先聆聽其需求與偏好，再一起檢視交通、飲食、社交與居住空間。尊重自主，避免用單一標準衡量每個人。",
        ],
      },
      {
        heading: "把專業與生活支持連結起來",
        paragraphs: [
          "用藥、跌倒風險與慢性病管理需要適當專業評估。家庭支持可以協助安排就醫與記錄問題，但不能替代診斷或治療。",
        ],
      },
    ],
  },
];
export const knowledgeArticles: Article[] = knowledgeBase.map((a, i) => ({
  ...a,
  kind: "knowledge",
  publishedAt: `2026-10-${String(12 - i).padStart(2, "0")}`,
  author: "網站開發示範內容",
  featured: i === 0,
  reviewedAt: null,
  references: [
    {
      title: "世界衛生組織：健康主題（延伸閱讀）",
      url: "https://www.who.int/health-topics",
    },
  ],
}));
export const newsArticles: Article[] = [
  {
    slug: "website-preview",
    title: "網站示範版本開放瀏覽",
    summary: "認識官方網站的資訊架構與目前可使用的功能。",
    category: "網站公告",
    tags: ["網站建置"],
    image: "/images/living.svg",
    featured: true,
    blocks: [
      {
        heading: "目前的開發範圍",
        paragraphs: [
          "此公告為開發用示範內容，不是協會正式公告。目前可瀏覽首頁與內容頁，使用文章搜尋、分類篩選及活動月曆。",
          "會員註冊、正式入會申請與報名尚未開放。所有示範活動與資料不得作為對外營運資訊。",
        ],
      },
    ],
  },
  {
    slug: "learning-program",
    title: "健康知識專區的內容規劃",
    summary: "以容易理解的文字，連結健康資訊與生活實踐。",
    category: "內容規劃",
    tags: ["健康知識"],
    image: "/images/nutrition.svg",
    featured: false,
    blocks: [
      {
        heading: "透明的內容流程",
        paragraphs: [
          "健康知識文章將保留來源與最後審閱日期，正式發布前需有內容審閱流程。現有示範文章尚未經專業審閱。",
        ],
      },
    ],
  },
  {
    slug: "community-events",
    title: "活動與課程中心的服務方向",
    summary: "講座、工作坊與交流活動的示範資訊已可瀏覽。",
    category: "活動資訊",
    tags: ["活動", "課程"],
    image: "/images/mind.svg",
    featured: false,
    blocks: [
      {
        heading: "在學習中連結彼此",
        paragraphs: [
          "活動中心展示列表、月曆及詳情的介面，日期、主題與地點皆為測試資料，並無實際舉辦承諾。報名功能將在資料庫與權限系統完成後開放。",
        ],
      },
    ],
  },
  {
    slug: "membership-planning",
    title: "網站帳號與正式會員資格將分開管理",
    summary: "入會規則與會員資格必須由協會確認後公布。",
    category: "網站公告",
    tags: ["會員服務"],
    image: "/images/living.svg",
    featured: false,
    blocks: [
      {
        heading: "網站帳號不等於正式會員",
        paragraphs: [
          "此為服務設計說明的示範文章。未來註冊網站帳號不會自動授予協會正式會員資格。會員種類、審核程序、會費及有效期限須以協會確認的規則為準。",
        ],
      },
    ],
  },
].map((a, i) => ({
  ...a,
  kind: "news" as const,
  publishedAt: `2026-10-${String(12 - i).padStart(2, "0")}`,
  author: "網站開發示範內容",
  reviewedAt: null,
  references: [],
}));
export const allArticles = [...newsArticles, ...knowledgeArticles];
export type EventRecord = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  format: string;
  startsAt: string;
  endsAt: string;
  location: string;
  eligibility: string;
  agenda: { time: string; title: string }[];
};
export const eventRecords: EventRecord[] = [
  {
    slug: "everyday-health-talk",
    title: "從日常開始的健康管理",
    summary: "透過生活觀察，認識健康管理的基本概念。",
    category: "健康講座",
    format: "實體講座",
    startsAt: "2026-12-26T14:00:00+08:00",
    endsAt: "2026-12-26T16:00:00+08:00",
    location: "示範地點 · 正式場地待確認",
    eligibility: "公開活動（示範規則）",
    agenda: [
      { time: "14:00", title: "開場與主題介紹" },
      { time: "14:20", title: "健康生活的基本概念" },
      { time: "15:30", title: "交流與提問" },
    ],
  },
  {
    slug: "healthy-life-workshop",
    title: "建立自己的健康生活提案",
    summary: "練習設定可持續的小目標，與夥伴交流生活經驗。",
    category: "生活工作坊",
    format: "互動工作坊",
    startsAt: "2027-01-09T10:00:00+08:00",
    endsAt: "2027-01-09T12:00:00+08:00",
    location: "示範地點 · 正式場地待確認",
    eligibility: "公開活動（示範規則）",
    agenda: [
      { time: "10:00", title: "生活節奏探索" },
      { time: "10:30", title: "小目標練習" },
      { time: "11:30", title: "分享與回顧" },
    ],
  },
  {
    slug: "health-dialogue",
    title: "健康管理的跨領域對話",
    summary: "從不同生活經驗出發，探討健康支持的可能性。",
    category: "專業交流",
    format: "交流論壇",
    startsAt: "2027-01-23T14:00:00+08:00",
    endsAt: "2027-01-23T16:00:00+08:00",
    location: "示範地點 · 正式場地待確認",
    eligibility: "會員限定（示範規則，資格尚未生效）",
    agenda: [
      { time: "14:00", title: "主題引言" },
      { time: "14:30", title: "交流討論" },
      { time: "15:40", title: "回顧與提問" },
    ],
  },
];
export type SearchQuery = Record<string, string | string[] | undefined>;
export function queryValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}
export function selectArticles(
  kind: ArticleKind,
  query: SearchQuery,
  pageSize = 3,
) {
  const q = queryValue(query.q).trim().slice(0, 120),
    category = queryValue(query.category),
    tag = queryValue(query.tag);
  const filtered = allArticles.filter(
    (a) =>
      a.kind === kind &&
      (!category || a.category === category) &&
      (!tag || a.tags.includes(tag)) &&
      (!q ||
        [
          a.title,
          a.summary,
          ...a.tags,
          ...a.blocks.flatMap((b) => [b.heading, ...b.paragraphs]),
        ]
          .join(" ")
          .toLocaleLowerCase("zh-TW")
          .includes(q.toLocaleLowerCase("zh-TW"))),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const raw = queryValue(query.page);
  const requested = /^[1-9]\d{0,5}$/.test(raw) ? Number(raw) : 1;
  const page = Math.min(requested, pages);
  return {
    q,
    category,
    tag,
    page,
    pages,
    total: filtered.length,
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
  };
}
export function contentUrl(
  path: string,
  fields: Record<string, string | number>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields))
    if (String(value)) params.set(key, String(value));
  return `${path}${params.size ? "?" + params.toString() : ""}`;
}
export function eventMonth(event: EventRecord) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
  }).format(new Date(event.startsAt));
}
export function selectEvents(query: SearchQuery) {
  const q = queryValue(query.q).trim().slice(0, 120),
    category = queryValue(query.category);
  return eventRecords.filter(
    (e) =>
      (!category || e.category === category) &&
      (!q || `${e.title} ${e.summary}`.includes(q)),
  );
}
