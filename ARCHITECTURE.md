# 系統架構與資訊架構

## 實際技術

Next.js 16 App Router、React 19、TypeScript、Tailwind CSS 4、npm lockfile。首頁為 Server Component；選單與返回頂部為小型 Client Components。自製可存取的基礎元件，不在第一階段加入尚無需求的 shadcn、表單與動畫函式庫。使用本地 SVG 插畫及系統中文字型，避免外部圖庫、Google Fonts 的網路依賴。動畫以 CSS 配合 reduced-motion 實作。

Node.js 24 與 Docker daemon 可用；PostgreSQL 尚未啟動，Phase 1 不需要資料庫。Prisma、成熟身分驗證套件、Zod、React Hook Form 與物件儲存 adapter 於對應階段加入。

## 網站資訊架構

- `/`：主視覺、理念、服務、健康知識、活動、會員服務與聯絡資訊
- `/about`：簡介、宗旨、沿革、組織、理監事、章程、文件、夥伴（Phase 2）
- `/news`、`/news/[slug]`：分類、標籤、搜尋、分頁、分享（Phase 2）
- `/knowledge`、`/knowledge/[slug]`：分類、來源、審閱日期；收藏於 Phase 3
- `/events`、`/events/[slug]`：列表／月曆、附件、報名規則（Phase 2–4）
- `/contact`：FAQ、聯絡表單（Phase 2–3）
- `/privacy`、`/terms`：目前為靜態法律草案，後續由 CMS 維護
- `/auth/*`：註冊、驗證、登入、重設（Phase 3）
- `/member/*`：個人資料、安全、資格、申請、收藏、報名、通知（Phase 3）
- `/admin/*`：獨立 Layout、Dashboard、內容、會員、活動、訊息、設定、稽核（Phase 4）
- `/courses`、證明驗證及帳務：Phase 5

後續資料流：UI → Server Actions / REST Route Handlers → 認證與授權 → Service → Prisma → PostgreSQL。不得讓 Client Component 直接使用資料庫。Service 負責輸入驗證、交易與稽核；Route Handler 僅轉換 HTTP 邊界。

## 後續主要介面

`POST /api/auth/register`、verify、reset；`GET/PATCH /api/me`；`POST /api/membership/applications`；`POST/DELETE /api/events/:id/registrations`；`POST /api/contact`；admin content / members / events CRUD；報名名單 CSV。錯誤格式 `{error:{code,message}}`，不暴露資料庫細節；列表需分頁與上限。

## 關鍵決策

PostgreSQL 與 Prisma 依需求採用。帳號與正式會員資格分離。Auth.js 或另一維護中的成熟 session library 在 Phase 3 評估 credentials、verification、失效策略相容性後決定。正式會員規則、SMTP、Domain、金流、個資保留期限與證明措辭須由協會確認；目前不需要它們即可完成 Phase 1。多語系保留於資料模型，不建立無內容的英文站。
