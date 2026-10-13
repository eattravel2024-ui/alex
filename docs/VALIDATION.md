# Phase 1 驗證記錄

日期：2026-10-12（Asia/Taipei）。實際執行在 `/workspace/alex`。

| 項目                                  | 結果                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| npm ci                                | 成功，使用 lockfile；快取位置 /workspace/.npm-cache                                                     |
| npm run typecheck                     | 通過                                                                                                    |
| npm run lint                          | 通過                                                                                                    |
| npm run build                         | 通過，首頁／privacy／terms／404／icon                                                                   |
| npm run dev + HTTP functional request | 通過，HTTP 200 包含協會名稱及示範聲明                                                                   |
| production standalone start           | 通過，public 與 static assets 可載入                                                                    |
| Playwright system Chromium            | 8 passed，desktop + mobile chromium emulation（不代表真實 iOS WebKit）                                  |
| E2E 範圍                              | 首頁／標頭／無溢出／無 pageerror、導航、Escape、返回頂部、法律草案、404、鍵盤 skip link、reduced-motion |
| 截圖檢視                              | 1440px desktop 與 390px mobile，lazy images scroll/decode 後完整截圖                                    |
| npm audit --omit=dev                  | 0 vulnerabilities                                                                                       |
| 完整 npm audit                        | 5 high entries，開發工具 braces 相依鏈；見 SECURITY.md                                                  |
| docker compose config --quiet         | 通過                                                                                                    |

Playwright 官方 browser download 遭網域政策 403，改用 /usr/bin/chromium，沒有關閉 TLS 驗證；不需新增 egress domains。

TypeScript、lint、build 於重新 npm ci 後再次通過。樣式格式化工具曾無法推定 SVG parser；SVG 保留有效 XML，未影響功能測試。

未執行／未實作：資料庫、API、RBAC、會員／後台／報名／聯絡表單、SMTP、正式 HTTPS、安全滲透、完整 WCAG/CWV、全套正式驗收；不宣稱它們完成。資安與正式部署仍需後續階段。

## Docker 結果

- 容器 npm ping 與 `npm ci`（可信 CA + HTTPS proxy）成功，TLS 驗證維持啟用。
- 多階段 Dockerfile 的 BuildKit npm 安裝持續停滯，已停止；完整 compose build 未通過，不宣稱可於乾淨 VPS 直接重現。
- `Dockerfile.runtime`：從已建置並測試的 standalone 產物成功建置映像。
- 執行映像後：首頁、privacy、hero.svg、icon.svg 全部 HTTP 200 且內容符合預期；執行 UID=1000（非 root）。測試容器已停止。

雲端 install_script 與 start_skill 已儲存草稿；未發布，未在新雲端任務驗證還原。本地初始提交未推送 GitHub，不宣稱遠端 main 已有程式碼。

# Phase 2 驗證記錄

- 7 個 Node 單元測試通過：搜尋內文與交集條件、分頁邊界／陣列 query、URL 編碼、fixture URL 唯一性、台灣時區跨年、HTTPS Domain 驗證、JSON-LD script closure 防護。
- TypeScript、ESLint、production build 通過。動態列表採 SSR；9 篇示範文章與 3 個示範活動詳情預渲染。
- 18 個 Playwright E2E 全數通過：desktop 與 mobile Chromium，含原 Phase 1 回歸及 Phase 2 搜尋／分類／分頁／全文／標籤／分享剪貼簿／未知 slug 404、活動月曆跨年／篩選／詳情時間、about／FAQ、query 安全顯示、noindex／robots／空 sitemap。
- 第一輪發現首頁 SEO 標題缺協會名稱，已修復；日期測試改驗 datetime 與台灣時段，避免把 locale 顯示格式當成日期正確性的唯一依據。修復後所有測試通過。
- 正式 Domain 未設定：當前確認 noindex 且 sitemap 無 loc；不宣稱搜尋引擎收錄或正式 SEO 成效。
- Phase 2 未接 DB，所有資料為 fixture；沒有會員、收藏、報名、付款、聯絡資料寫入。後續能力仍按 FEATURES.md 的狀態處理。
- 沒有修改正式環境、遠端 SSH、GitHub 推送或正式部署。

內容頁截圖檢視：1440px 知識列表、390px 文章全文與月曆。修復 sr-only caption 可見問題，手機月曆加入橫向捲動提示、keyboard focus region 及可直接點選的本月活動清單；caption computed style 為 absolute/1px，手機清單 2 項連結已由 E2E 驗證。修復後再次執行 npm test：7 unit + 18 E2E 全數通過。

# Phase 3 驗證記錄（2026-10-13，Asia/Taipei）

PostgreSQL 17 + Mailpit 在本機 loopback，使用隨機生成、忽略且權限 0600 的 development 設定；無真實個資或對外寄信。

- 官方 Prisma WASM getDMMF 驗證 13 個模型；同版本 generator 實際產生 client。
- 官方 Prisma WASM migration engine 產生 SQL 並套用到 PostgreSQL，_prisma_migrations 記錄 1 個 completed migration；再次套用 0 pending。沒有手工假造 migration 記錄或關閉 checksum/TLS。
- 開發 seed 重跑保留已有資料，只有 demo membership types；沒有預設管理員或固定密碼。
- 10 unit tests 與 28 desktop/mobile E2E/API integration tests 已通過（原 Phase 1–2 回歸 + 10 會員整合）。會員測試會真實寫入 PostgreSQL，使用本機 Mailpit 確認驗證與重設郵件。
- 會員流程：未驗證無法登入、同意欄位與 password strength、個人資料保存、收藏、申請、重複409、補件／版本／併發核准／audit／站內通知、own-data isolation、角色提升阻擋、CSRF、payload limit、Session ownership、disabled/expired sessions、重設 token 單次與全 Session 撤銷、修改密碼／brute-force429。
- 測試最初暴露 standalone 未注入 .env.local，已改 runtime 注入（不把秘密檔案複製到產物）。限流確實阻擋共享 IP 的大量註冊；測試以不同 TEST-NET addresses 隔離不同 clients，沒有提高／關閉限流。
- AES-256-GCM 開發 backup 實際還原到獨立暫存 DB，驗證 completed migration 和 test user rows；只刪除該腳本建立的暫存 DB。restore-if-empty 在已有資料庫時跳過，不覆寫現有 schema。
- npm ci 通過，使用 lockfile。新增 runtime audit 發現 mysql2/deepmerge-ts 高風險，已釘選修補 overrides；Prisma config merge 已驗證。修補後須再次回歸；最終結果見下方更新。
- 標準 Prisma CLI 的 checksum domain 403 仍存在；本機已用官方內部 JS/WASM（固定版本）完成 workflow。Node migration helper 有 experimental WASM module 旗標；不宣稱標準 native CLI 或正式部署已驗證。

尚未驗證／未完成：正式 SMTP/HTTPS、MFA、完整 admin CMS、資料保留／刪除流程、正式法律政策／會員規則、跨新 cloud task 還原、正式 production Docker pipeline。站內通知已實作，可靠 email outbox 尚未提供。

## Phase 3 最終結果

修補 overrides 並重新 npm ci 後：Prisma config merge、client generation、migration 重跑、TypeScript、Lint、Build 全部通過；10 unit + 28 E2E/API 全部通過，涵蓋五個角色的 reviewer gate。npm audit --omit=dev 為 0，完整 audit 有 6 個 high 開發工具相依項目，皆沿 braces 相依鏈，詳 SECURITY.md。

會員中心已登入的 desktop/mobile 截圖與 390px body overflow 檢查通過。最後加密備份實際還原 1 completed migration、48 個虛構測試帳號；保留原開發 DB。來源檔與 browser assets 未包含隨機生成的 signing secret／DB password／backup key，.env.local 與加密備份均為 0600。

雲端 install_script/start_skill 已更新草稿，加入必要的本機服務啟動、只對空 schema 還原、migration/seed、測試與 encrypted snapshot 說明。未發布，未在新 cloud task 驗證；本地 Git 提交未推送。
