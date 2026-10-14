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

## Phase 4 管理核心

伺服器每次查詢／mutation 檢查最新 role、emailVerified 與 disabled；每頁明確投影需要的欄位，沒有 password／token query。Admin/Super Admin 僅能切換其他 MEMBER 的帳號狀態，保護管理角色及自己；角色指派未提供 Web API。停用／恢復在 row-lock 交易中寫入通知、稽核並刪除 Session；member 資格不改動。最高管理員稽核唯讀介面不呈現原因、IP、信箱或秘密。尚未提供不可竄改 audit storage、MFA 與正式 privilege bootstrap。

本機 `dev:admin` 必須明確提供既有已驗證帳號，拒絕 production／非 loopback DB；不在 seed/setup 自動執行，不建立帳號／密码。此為開發工具，不可用於正式角色初始化。

## Phase 4 文章 CMS

Editor/Admin/Super Admin 的內容權限於每次讀／寫重新驗證；Staff/Member 無私人文章資料權限。CMS不渲染輸入HTML，段落使用有限粗體／斜體／清單／安全HTTPS連結AST，所有文字經React轉義，解析深度與工作量受限。來源限定HTTPS/no credentials，封面為本地插畫或已驗證媒體；來源不由server fetch。JSON strict schema／大小64KiB／段落數與長度限制、Origin驗證、row-lock version409、唯一slug、修訂與audit原子寫入。正文HTML元素只能由渲染元件產生。

媒體僅接受內容角色的同來源上傳，body串流固定緩衝、5MiB+64KiB整體上限／30秒逾時／2並發，JPEG／PNG／WebP容器與MIME／decoder驗證，1600萬像素／静態单頁限制，sharp0.35.5重編碼WebP並移除中繼資料。私有絕對儲存路徑拒絕public與symlink祖先，UUID.webp以O_EXCL／O_NOFOLLOW及0600寫入；讀取只接受regularfile與已記錄大小。公開圖片須有當前可見文章引用，否則重新驗證內容角色；所有媒體no-store與CORP same-origin，Next optimizer localPatterns僅允許/images避免媒體快取旁路。圖片修改／刪除檢查版本，引用與刪除共用媒體rowlock，當前及歷史引用阻止刪除。上傳DB失敗會嘗試清理檔案；刪除IO失敗保留元資料可重試，刪檔後DB失敗時只有未使用元資料可能暫時缺檔，可再次刪除。DB與檔案不是分散式交易，不宣稱已提供完整儲存事故復原。

公開內容服務沒有 fixture fallback，無效／草稿／下架公開 URL 在 Next Proxy 串流前預檢並回404；private preview 禁用公開 JSON-LD/分享/收藏。此預檢增加公開全文的一次輕量 DB 查詢，頁面仍獨立查詢，不把 Proxy 作為 private authorization 邊界。尚未驗證正式 DB latency/CWV。文章保持 demo flag；正式審閱與法規內容發布流程仍待建立。

## Phase 4 活動與報名

活動內容修改限Admin/Super Admin，Staff只可名單／CSV／報到；Editor/Member無報名個資資料權限。會員報名與歷程只以session userId查詢。最新資格在報名／遞補／報到時驗證，role=MEMBER不等於Membership；示範資格與示範活動仅限development報名。

活動row lock防超額、event+user unique防重複、sequence防候補重報插隊；所有報名狀態／通知／history／audit一個交易。未提供付款或真實健康資訊收集。CSV不預抓、no-store、防公式注入、明示2000筆上限且有audit，不把user-controlled filename送到header。QR身分查驗、MFA、正式規則、可靠email、大量併發／超時與營運容量尚未驗收。

## 聯絡示範

公開提交有獨立預設false開關、固定@example.test信箱限制與DB demo CHECK，不使用 SMTP。蜜罐／same-origin／strict輸入／大小限制、持久化IP與email限流；IP依目前VPS單層Nginx追加的最後peer，不能直接公開容器或未審查改成多層代理。資料庫操作無原始IP保存，RateLimit key保留SHA256而非明文信箱/IP；不將它稱為不可逆匿名化。

Staff/Admin/Super Admin才能讀聯絡個資與note，Editor/Member不可讀，更新記history/audit。匿名收件reference只作收件識別，不提供公開讀取。反垃圾機制不是完整CAPTCHA/DoS解決方案；資料刪除／保留期限與正式聯絡隱私政策尚未完成。

## 操作員限定示範初始化

CLI demo-admin不是public endpoint，只允許cchm_demo/test.cchm.tw及明確指定的隨機隔離測試DB；需要顯式確認與owner-only regular password file，O_NOFOLLOW/fstat拒絕symlink、其他使用者所有權、group/other權限與過大檔案。密碼不接受命令列字串、不print/hash輸出，使用Better Auth官方hashPassword；不保證JS記憶體字串安全清零。

首次初始化以advisory transaction lock檢查任何管理角色／重複email，拒絕覆寫；新增User/Account/AuditLog原子交易。emailVerified為保留@example.test識別碼的操作者手動核准，不是SMTP驗證；不更改政策／signup flags，consentfalse。這不提供正式身分確認、MFA或忘記密碼的無SMTP繞過。操作後移除暫存密碼檔，使用者自行保存密碼。

依使用者明確指定，帳號密碼最低長度改為8字元、上限128，保留英文字母與數字要求；註冊、重設／修改、UI與示範初始化一致。Auth簽章密鑰與資料庫密碼規則不使用這個帳號密碼下限。

操作員密碼重設新增顯式--reset-demo-password，沿用示範DB/origin/identifier/private-file限制；只允許enabled/verified SUPER_ADMIN且唯一credential，同交易hash更新、Session全部撤銷、DEMO_ADMIN_PASSWORD_RESET audit。不是SMTP重設或公開端點，不恢復停用／未核准狀態。audit actor為目標示範管理員，action標記操作員CLI重設，不冒稱Session驗證的使用者操作。

依使用者指定，demo CLI額外允許唯一真實形式的登入識別碼admin@cchm.tw。操作員顯式reset/previous-email才能由保留示範識別碼更名；目標既存拒絕，保留UUID與權限，同交易稽核/撤銷Session。emailVerified仍表示手動管理核准，不冒稱SMTP／信箱所有權驗證，不接受其他真實信箱。

頁面CMS每一個API與私人編輯／預覽頁驗Editor/Admin/Super Admin，strict schema與固定章節不允許插入HTML／自訂ID。公開service僅返回published，draft不作公開fallback；初始無發布版本才使用原始示範文字，DB錯誤不隱藏。page-key transaction lock與version防覆寫，revision／audit原子保存，restore不自動發布。示範聲明與正式資訊待確認提示不由CMS移除；無圖片／檔案／外部連結欄位。

首頁CTA與插圖設定使用固定站內路徑與既有本地圖片白名單，沒有任意href/src欄位；about章節排序只允許固定完整ID集合，隱藏介紹章不移除固定法律資訊提示。舊JSON snapshot安全文字及草稿／發布隔離保持。新增JSON欄位不需要新的schema migration。
