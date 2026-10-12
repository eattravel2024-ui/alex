# 安全設計

## 已實作

React text rendering；僅在結構化資料輸出使用經 `<` escape 的 JSON-LD，不接收任意 HTML；同源本地素材；DENY framing、nosniff、referrer／permissions policy、基本 CSP；示範站禁止搜尋索引；無秘密值、無個資提交、無登入或資料存取端點。CSP 暫保留 inline scripts/styles 以支援 Next hydration，正式站改為 nonce CSP 並驗證 streaming/cache 相容性。

## 尚未實作，啟用會員功能前必要

成熟 server session、HttpOnly/Secure/SameSite cookies、Argon2id 或適當 scrypt 密碼 hash、email verification 與單次 hash reset tokens、登出／停權即時失效、RBAC 服務層、CSRF/Origin checks、server Zod validation、Prisma parameterized queries、富文字 allowlist sanitizer、持久化 rate limiting／登入防暴力破解、admin MFA、遮罩日志與稽核、敏感字段最小權限。

上傳需限制 size/MIME/magic bytes，拒絕可執行與 SVG active content，隔離 storage origin，掃描、不可猜 key、signed URLs。Secrets 僅 runtime env 或 secret manager，不放 public prefix、Git、一般 CMS。避免用個資作 analytics identifiers。

## 正式環境

HTTPS reverse proxy、確定 HTTPS 後 HSTS、備份加密／還原演練、DB 最小權限、更新與 dependency audit、監控、資料保留／刪除程序。尚未通過正式資安審查，不能宣稱正式營運安全或 WCAG 完全符合。

## Phase 1 依賴稽核結果

`npm audit --omit=dev`：0 項；完整 `npm audit`：5 個 high dependency entries，均沿 ESLint Next plugin → fast-glob → micromatch → braces（GHSA-vfj7-8cjw-p6xm）。braces 3.0.3 為鎖定版本，公告範圍 <=3.0.3，尚未採用可確認的相容修補。風險在開發 lint toolchain 的惡意深層 glob pattern，非已確認的網站 runtime 漏洞。不要將不可信任輸入傳入 lint glob；追蹤上游修補。npm 建議降級 eslint-config-next 至 14.2.35，與 Next 16 版本不符，未自動套用。正式發布前仍須重新掃描與處置。

## Phase 2 輸入與資料界限

搜尋限制 120 字，分類／標籤為精確篩選；分頁限制正整數範圍並 clamp 到有效頁。React 對 URL query 的表單顯示做 escape；不將 query 注入 HTML。JSON-LD 透過專用序列化 escape `<` 防 script closure。分享僅複製本機頁面 URL，操作結果有可存取的狀態訊息。聯絡頁尚不接受提交。
