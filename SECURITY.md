# 安全設計與目前限制

目前為本機 Phase 3 開發測試平台，正式協會服務未發布。正式法律政策、SMTP、Domain、會員規則與上線審查尚未完成。

## 已實作並驗證

- Better Auth 1.7.7：credentials 的成熟 scrypt hash、電子郵件驗證、單次 password-reset token、Session 期限／登出／撤銷；cookie HttpOnly、SameSite=Lax，HTTPS origin 啟用 Secure。Cookie cache 關閉，服務端重新驗證 DB。
- 每次私有操作重讀停用／角色狀態，User.role/disabled 不能從註冊或 profile 修改。會員 API 僅以 session userId 取資料，拒絕 body 額外字段；不能撤銷別人的 Session。Reviewer 只允許 Super Admin/Admin/Staff，不能自我審核。
- 註冊同意政策、密碼長度與字母／數字在伺服器驗證，保留 server-generated 同意時間與政策版本。正式註冊預設關閉；development auth 必須 loopback origin。測試帳號不授予正式會員資格。
- Better Auth 持久化 per-IP 限流，額外 per-account hashed-email 原子計數避免僅靠可變 IP；每 10 分鐘登入最多 10 次，重設／重寄信最多 5 次。沒有關閉限流來通過測試。
- JSON mutation 同源 Origin 檢查、8 KiB 讀取上限；Zod 驗證與 Prisma parameterized SQL；交易、row lock、版本／unique／CHECK constraints 防申請併發與重複核准。
- React 對文章／使用者文字做 escape；只有 escape `<` 的 JSON-LD 使用 raw script 輸出。不接收任意富文字 HTML。
- nosniff／DENY framing／referrer／permissions policy／基本 CSP。示範站預設 noindex。
- 會員 API Cache-Control=no-store，SSR 會員頁為 dynamic。密鑰及資料庫 URL 只在 server-only 模組；Session token 不呈現在會員資料 API 或安全設定頁。
- Auth 重設 identifier 使用 hash。Session token 依框架在 DB 儲存 opaque 值，需保護 DB；不宣稱 Session token 為 hash。Session IP/user-agent 不保存，限流 keys 可能保存 IP。
- 登入與資料／審核 API 測試包含角色提升阻擋、Origin、body size、expired/disabled session、資料隔離、並發與 password reset/revocation。

## 開發秘密與備份

`.env.local` 0600、Git ignore、Docker context 排除；helper 隨機產生 DB password 與 auth signing key，不建立固定密碼或預設管理員。Mailpit 只綁定 loopback，郵件不外寄；請勿使用真實個資。

開發 backup 使用 AES-256-GCM，檔案 0600、目錄 0700，key 存於忽略的本機設定。還原演練使用獨立暫存 DB；restore-if-empty 不覆寫現有 schema。正式環境需要異地 backup、獨立 key management、存取控管、保留期限與 restore/RPO/RTO 規劃，不能把本機方案當成全部正式備份設計。

## 上線前尚須完成

Admin MFA、完整 CMS RBAC／敏感字段控制、富文字 sanitizer、上傳 MIME/magic-byte/size/掃描/隔離、CSRF/nonce CSP 及 HTTPS proxy 部署驗證、HSTS、監控／告警、資料刪除與保留工作流程、政策／會費正式確認。Cookie/SMTP 的正式 TLS 路徑尚未部署驗證。

Auth 郵件使用 Next after，以免 SMTP 的等待時間暴露帳號存在性；目前無 durable outbox/retry，背景寄送失敗可重新請求，可靠通知寄送留待後續。站內申請通知已寫 DB，不宣稱申請 email 已可靠寄送。

反向代理必須覆寫 forwarded IP header 並封閉後端公開端口。測試以不同 TEST-NET IP 模擬獨立客戶端，不代表可信任對外任意 forwarded header。現有 CSP 允許 Next hydration 的 inline scripts/styles，正式版本需 nonce 等完善；尚未完成滲透／完整 WCAG/CWV 檢查。

## 依賴與工具鏈

Prisma/native engine checksum 網域在本環境被封鎖；本機採版本鎖定 7.10.0 的官方 internal generator/WASM engine，使用 NPM lockfile integrity，未關閉 TLS 或 checksum 校驗。這些內部介面無穩定 API 承諾；升級需回歸，production migration 使用標準 Prisma CLI 並驗證官方引擎來源。

Phase 3 發現 mysql2 與 deepmerge-ts advisories；以 overrides 固定 mysql2 3.24.5、deepmerge-ts 8.0.2，Prisma config merge 與整合流程需重新驗證。MySQL adapter 未使用；deepmerge-ts 升至 major 8，保留回歸與版本釘選。

開發 ESLint 相依鏈的 braces GHSA-vfj7-8cjw-p6xm 尚無相容修補，避免將不可信 glob 輸入傳給 lint；不採用與 Next 16 不相容的套件降級。正式發布前需重新完整 audit。

PostgreSQL 開發容器使用開發管理角色以支援 migration/test，正式環境必須分離 migration owner 與最小權限 application role，不可沿用開發 superuser。
