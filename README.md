# 中華健康管理協會網站暨會員平台

繁體中文協會網站。**目前完成 Phase 1–2 前台與 Phase 3 本機會員核心，尚非可正式營運的完整平台。** 所有協會介紹、活動、文章均為清楚標示的示範內容；不得視為正式法律資訊或醫療建議。

## 本機開發

Node.js 24 LTS、npm 11；版本以 `package-lock.json` 為準。

```sh
npm ci
npm run dev:setup
npm run db:restore:local
npm run db:migrate:local
npm run db:seed
npm run db:generate
npm run dev -- --hostname 0.0.0.0
```

首頁 `/`、協會 `/about`、消息 `/news`、知識 `/knowledge`、活動 `/events`、聯絡 `/contact`，法律草案 `/privacy`、`/terms`。文章與活動支援 `[slug]` 全文頁；搜尋、分類、標籤、分頁與月曆以 query string 保存。文章已接 PostgreSQL CMS，保留示範聲明；活動仍來自本地 fixtures，會員資料由 PostgreSQL 保存。會員功能需要本機 PostgreSQL 與 Mailpit。`dev:setup` 隨機產生未追蹤的 `.env.local`（已有檔案不覆寫），啟動兩個服務；不建立預設管理員或共用密碼。開發來源必須與 BETTER_AUTH_URL 相符，預設是 `http://127.0.0.1:3000`。若使用受限雲端環境，可設定 `npm_config_cache=/workspace/.npm-cache`。

## 檢查

```sh
npm run test:unit
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
# 雲端已有 Chromium 時改用：
# PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
npm run test:e2e
```

單元測試檢查篩選、分頁、URL、安全序列化與時區。E2E 啟動 production server（需先 build），以桌面與手機 Chromium 測試首頁、內容搜尋／全文／分享、活動月曆、FAQ、法律草案與 404。實際結果見 [驗證記錄](docs/VALIDATION.md)。Docker 檢查見 DEPLOYMENT.md。

## 文件

- ARCHITECTURE.md：資訊架構、分層與決策
- DATABASE.md：PostgreSQL 資料模型與約束規劃
- FEATURES.md：所有階段與完成狀態
- DEPLOYMENT.md：Docker、VPS 與發布前必要条件
- SECURITY.md：已實作及待實作安全措施
- docs/DESIGN_SYSTEM.md：元件與設計規範

不含預設管理員、正式資料、SMTP 密碼或金流。未授權時不得部署正式環境。

## SEO 設定

預設 noindex，沒有 APP_URL 時 sitemap 為空且不產生 canonical，避免虛構正式 Domain。確認網域後設定 `APP_URL=https://實際網域`（只接受 HTTPS origin，不含路徑、credentials 或 query），重新 build。只有正式內容、法律資訊與發布準備完成後，才能設定 `SITE_INDEXING_ENABLED=true` 並重新 build。這是建置階段設定，不能只改 runtime env 就假定所有預先產生頁面更新。

## 會員測試與本機服務

`/auth/register`、`/auth/login`、`/auth/verify`、`/auth/forgot-password`、`/auth/reset-password`；`/member` 的個人資料、安全設定、示範申請、收藏與站內通知。註冊須同意開發版政策，信箱驗證後才能登入。密碼至少 12 字且包含字母與數字。網站帳號不自動成為正式會員，示範核准沒有正式效力。

Mailpit SMTP：127.0.0.1:1025；測試收件匣：127.0.0.1:8025。只收本機測試郵件，不向真實收件人寄送。使用 `.example.test` 虛構資料，勿提交真實個資。PostgreSQL 在 loopback 5433，密碼與簽署密鑰只保存在權限 0600 的 `.env.local`。

完整測試需先完成本機服務／migration／seed／build：`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test`。API 整合測試透過 HTTP 操作並驗證 PostgreSQL 寫入；權限測試僅對專用 fixture 暫時賦予管理角色，無對外管理員預設帳號。測試使用不同模擬 IP 隔離正常的 per-IP 限流，沒有關閉限流。正式 proxy 必須覆寫 forwarded IP headers，不能公開直連後端端口。

## Prisma 工具與資料保存

本環境封鎖 binaries.prisma.sh，標準 Prisma CLI 無法下載原生 schema engine。`db:generate` 使用鎖定 7.10.0 的官方內部 client generator；`db:migrate:local` 使用同版本官方 WASM schema engine與 Pg adapter，追蹤真正 `_prisma_migrations` 及 checksum。沒有停用任何 TLS／checksum 驗證。這是本機替代工具鏈，介面非穩定承諾；升級需回歸測試。WASM migration 必須 Node 24 的 experimental-wasm-modules 旗標，僅允許本機 development DB，不執行 reset。正式 migration 保留 `npm run db:migrate`（標準 CLI），仍需允許官方引擎網域。

Docker volumes 不假定隨雲端任務保存。`npm run db:backup` 在 `.local/backups` 產生 AES-256-GCM 加密備份；key 位於忽略的 `.env.local`。`npm run db:backup:verify` 還原至獨立暫存測試 DB；`db:restore:local` 僅在目標 public schema 完全空白時還原。備份與原始 key 必須一併安全保存，不放 Git；不要任意更換 key。這是開發 snapshot 保存方式，正式備份仍須另行制定異地儲存、key management、RPO/RTO與法律保留期限。

## 管理後台（Phase 4 管理核心）

`/admin` 提供真實資料統計；`/admin/applications` 為申請審核；`/admin/members` 為帳號搜尋與停用／恢復；`/admin/audit` 為唯讀稽核紀錄。角色限制見 docs/API.md。會員中心會對有權限的帳號顯示後台入口。文章 CMS 基礎已完成；活動、媒體與設定仍待完成。

開發環境先註冊並完成本機 Mailpit 信箱驗證，再以**自己的既有開發帳號**執行 `npm run dev:admin -- <已驗證的開發帳號信箱>`。這會提升該帳號為 Super Admin 並留下稽核紀錄，不建立帳號、不產生密码；拒絕 production／非 loopback DB。此命令不納入自動 install/seed；正式角色初始化流程仍待制定。

停用／恢復會撤銷登入，原因寫入對方站內通知。這不改變會員資格；管理角色不能在此被停用。管理畫面的資料搜尋、分頁與 mutation 皆於伺服器重新檢查權限。

## 文章 CMS（Phase 4）

`/admin/articles`：列表、標題搜尋、類型／狀態篩選與分頁；`/admin/articles/new` 與 `/admin/articles/[id]`：文字區塊編輯、區塊排序、分类／標籤、作者、來源連結、示範封面、草稿／發布／排程／下架；`/preview` 為受權限保護的已儲存預覽。Editor、Admin、Super Admin 可操作；Staff、Member 不可讀取草稿或操作內容。

發布與到期排程即時出現在首頁、列表、全文、相關文章及有正式 APP_URL 時的 sitemap。下架與草稿不會回退到 fixtures；下架收藏顯示「文章已下架」，可取消收藏。文章網址／類型建立後固定。版本檢查拒絕過期修改，保留最近 20 版修訂的後台入口；還原建立新版本且先回到草稿。

這是**文字區塊 CMS**，HTML 以文字呈現；完整 WYSIWYG、分類／標籤獨立管理、任意媒體上傳、頁面／Banner／導覽 CMS 仍待實作。來源只接受 HTTPS 且不得夾帶帳密；封面僅用三張本地插畫。所有內容仍為示範，不宣稱已完成專業內容審閱。

`db:seed` 使用 Node 24 的原生 TypeScript stripping 匯入 fixtures，只新增不存在的九篇示範文章，不覆寫管理員的修改／下架。前台文章與首頁現在需要正常 PostgreSQL；DB 失效不偷偷切回 fixtures。公開文章 URL 由 Next Proxy 在串流前判斷可見性，再由頁面重新查詢，以保留真正的 HTTP 404。

WASM 增量 migration 可用 `npm run db:migrate:local -- --create <name> --from-schema <verified-previous-schema-file>` 產生 SQL；只產生檔案，不立即套用。必須檢閱 SQL、保留手工業務約束，再執行不带 --create 的 migration 指令。此為 development-only helper，不偵測實體 DB drift，也不替代正式 native Prisma migration tooling。

E2E 的 CMS projects 在既有前台／會員 projects 通過後執行，避免測試中的公開內容干擾既有 fixture 數量；每個 CMS test 完成後將自己的文章下架並恢復專用角色。未執行的 dependency projects 或 tests 不算通過。
