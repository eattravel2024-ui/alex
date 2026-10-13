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

首頁 `/`、協會 `/about`、消息 `/news`、知識 `/knowledge`、活動 `/events`、聯絡 `/contact`，法律草案 `/privacy`、`/terms`。文章與活動支援 `[slug]` 全文頁；搜尋、分類、標籤、分頁與月曆以 query string 保存。內容來自明確標示的本地示範資料，文章與活動尚未接 CMS；會員資料已由 PostgreSQL 保存。會員功能需要本機 PostgreSQL 與 Mailpit。`dev:setup` 隨機產生未追蹤的 `.env.local`（已有檔案不覆寫），啟動兩個服務；不建立預設管理員或共用密碼。開發來源必須與 BETTER_AUTH_URL 相符，預設是 `http://127.0.0.1:3000`。若使用受限雲端環境，可設定 `npm_config_cache=/workspace/.npm-cache`。

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

完整測試需先完成本機服務／migration／seed／build：`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test`。API 整合測試透過 HTTP 操作並驗證 PostgreSQL 寫入；權限測試僅對專用 fixture 賦予 Staff 角色，無對外管理員預設帳號。測試使用不同模擬 IP 隔離正常的 per-IP 限流，沒有關閉限流。正式 proxy 必須覆寫 forwarded IP headers，不能公開直連後端端口。

## Prisma 工具與資料保存

本環境封鎖 binaries.prisma.sh，標準 Prisma CLI 無法下載原生 schema engine。`db:generate` 使用鎖定 7.10.0 的官方內部 client generator；`db:migrate:local` 使用同版本官方 WASM schema engine與 Pg adapter，追蹤真正 `_prisma_migrations` 及 checksum。沒有停用任何 TLS／checksum 驗證。這是本機替代工具鏈，介面非穩定承諾；升級需回歸測試。WASM migration 必須 Node 24 的 experimental-wasm-modules 旗標，僅允許本機 development DB，不執行 reset。正式 migration 保留 `npm run db:migrate`（標準 CLI），仍需允許官方引擎網域。

Docker volumes 不假定隨雲端任務保存。`npm run db:backup` 在 `.local/backups` 產生 AES-256-GCM 加密備份；key 位於忽略的 `.env.local`。`npm run db:backup:verify` 還原至獨立暫存測試 DB；`db:restore:local` 僅在目標 public schema 完全空白時還原。備份與原始 key 必須一併安全保存，不放 Git；不要任意更換 key。這是開發 snapshot 保存方式，正式備份仍須另行制定異地儲存、key management、RPO/RTO與法律保留期限。
