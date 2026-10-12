# 中華健康管理協會網站暨會員平台

繁體中文協會網站。**目前完成 Phase 1 基礎與 Phase 2 前台內容瀏覽，尚非可正式營運的完整會員平台。** 所有協會介紹、活動、文章均為清楚標示的示範內容；不得視為正式法律資訊或醫療建議。

## 本機開發

Node.js 24 LTS、npm 11；版本以 `package-lock.json` 為準。

```sh
npm ci
npm run dev -- --hostname 0.0.0.0
```

首頁 `/`、協會 `/about`、消息 `/news`、知識 `/knowledge`、活動 `/events`、聯絡 `/contact`，法律草案 `/privacy`、`/terms`。文章與活動支援 `[slug]` 全文頁；搜尋、分類、標籤、分頁與月曆以 query string 保存。內容來自明確標示的本地示範資料，尚未接 CMS 或 DB。目前不需資料庫或秘密值。若使用受限雲端環境，可設定 `npm_config_cache=/workspace/.npm-cache`。

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
