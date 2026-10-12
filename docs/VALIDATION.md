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
