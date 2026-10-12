# 中華健康管理協會網站暨會員平台

繁體中文協會網站。**目前完成 Phase 1 前台基礎，並非可正式營運的完整平台。** 所有協會介紹、活動、文章均為清楚標示的示範內容；不得視為正式法律資訊或醫療建議。

## 本機開發

Node.js 24 LTS、npm 11；版本以 `package-lock.json` 為準。

```sh
npm ci
npm run dev -- --hostname 0.0.0.0
```

首頁 `/`，法律草案 `/privacy`、`/terms`。目前不需資料庫或秘密值。若使用受限雲端環境，可設定 `npm_config_cache=/workspace/.npm-cache`。

## 檢查

```sh
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
# 雲端已有 Chromium 時改用：
# PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
npm run test:e2e
```

E2E 啟動 production server（需先 build），以桌面及手機測試首頁、導覽、法律草案及 404。實際結果見 [驗證記錄](docs/VALIDATION.md)。Docker 檢查見 DEPLOYMENT.md。

## 文件

- ARCHITECTURE.md：資訊架構、分層與決策
- DATABASE.md：PostgreSQL 資料模型與約束規劃
- FEATURES.md：所有階段與完成狀態
- DEPLOYMENT.md：Docker、VPS 與發布前必要条件
- SECURITY.md：已實作及待實作安全措施
- docs/DESIGN_SYSTEM.md：元件與設計規範

不含預設管理員、正式資料、SMTP 密碼或金流。未授權時不得部署正式環境。
