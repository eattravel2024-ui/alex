# 系統架構與資訊架構

## 實際技術

Next.js 16 App Router、React 19、TypeScript、Tailwind CSS 4、npm lockfile。首頁為 Server Component；選單與返回頂部為小型 Client Components。自製可存取的基礎元件，不在第一階段加入尚無需求的 shadcn、表單與動畫函式庫。使用本地 SVG 插畫及系統中文字型，避免外部圖庫、Google Fonts 的網路依賴。動畫以 CSS 配合 reduced-motion 實作。

Node.js 24、Docker daemon 與 PostgreSQL 17 可用；Phase 3 已加入 Prisma、Better Auth、Zod、React Hook Form，物件儲存 adapter 留待媒體功能階段。

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

PostgreSQL 與 Prisma 依需求採用。帳號與正式會員資格分離。身分驗證已依使用者確認採用 Better Auth，credentials、verification 與失效策略已實作並測試。正式會員規則、SMTP、Domain、金流、個資保留期限與證明措辭須由協會確認；目前不需要它們即可完成 Phase 1。多語系保留於資料模型，不建立無內容的英文站。

## Phase 2 實際實作

`src/lib/catalog.ts`：明確測試來源的文章與活動型別／fixture、純函數篩選與分頁。`services/content-service.ts`：全文／相關文章查詢；下一階段替換 Prisma，route 與 UI 不應直連 DB。搜尋列表使用 Server Components 與 async searchParams；詳情 generateStaticParams 預渲染。

`components/content`：列表、卡片、頁首／麵包屑、文章全文、活動月曆；分享是小型 Client Component。純文字內容由 React escape，不接收任意富文字 HTML。健康文章不虛構審閱者或認證。Calendar 與事件時間指定 Asia/Taipei。

`seo.ts`：APP_URL 嚴格驗證、條件 canonical/OG、安全 JSON-LD；robots 預設禁止索引，sitemap 無 Domain 為空。正式對外 URL 與索引設定屬 build-time，變更需要重新 build。此次沒有資料庫 migration 或寫入 API。

## Phase 3 實際架構

Better Auth 1.7.7 + Prisma adapter（transaction=true），credentials 與 session/verification 由框架處理；user.role/disabled 不能由 signup 輸入。Server-only db/auth/access/service 防止 server 設定進 Client bundle。認證依 request headers；每個私有資料操作重讀 User 狀態與角色，不以 UI 隱藏作授權。

RHF AuthForm + shared Zod schemas；API routes 提供自己的資料讀寫、bookmark、session UUID 撤銷、申請及角色審核。Member layout 與頁面動態 SSR，訪客 redirect login。Profile service 交易更新姓名/選填電話/偏好及 audit；application service 在 user/application row lock 與版本檢查內處理變更。

Local PostgreSQL/Mailpit 由 compose.dev.yaml 管理，.env.local 保存隨機開發憑證（忽略且 0600）。Auth 郵件透過 Next after 寄至本機 SMTP，不阻塞存在性差異的回應；尚無 durable outbox/retry，寄送失敗可重新請求。正式 SMTP 需 TLS。標準 Prisma CLI native engine egress 被阻擋，本機使用官方、版本固定的 internal generator 與 WASM engine；這不是內部 API 穩定性承諾，升級需驗證。正常 application runtime 使用 PrismaPg，無需要 Node 的 WASM 模組實驗旗標；只有本機 migration helper 需要。
