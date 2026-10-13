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

# Phase 4 管理核心驗證（2026-10-13，Asia/Taipei）

- TypeScript、ESLint、production build 通過；`/admin` 與各後台頁皆 dynamic，統計與列表直接讀取 PostgreSQL。
- 10 unit + 36 desktop/mobile E2E/API 全數通過；新增 8 個管理整合檢查，既有 28 個前台與會員檢查保留。
- 五種角色：MEMBER 无後台；EDITOR 無會員個資；STAFF 可審核但不可帳號管理／稽核；ADMIN 可帳號管理但不可稽核；SUPER_ADMIN 可查稽核。直接請求資料頁與 mutation API 都檢查權限，角色變更立即生效。
- 真實 UI 核准申請，驗證 PostgreSQL membership/demo flag/history，`2099-12-31` 有效期保存為台灣當日 23:59:59（UTC 15:59:59），示範資料無正式效力。
- 帳號停用／恢復 UI、確認勾選、操作原因、Session 全撤銷、未登入401、重複狀態409、跨 Origin403、管理角色保護403；通知和 audit 寫入驗證；手機畫面無 body 橫向 overflow。
- 本機 `dev:admin` 真實提升專用 verified fixture，重跑不新增 audit，DEVELOPMENT_MODE=false 明確拒絕；測試 afterEach 在失敗時也恢復專用 fixture 角色，無固定管理員帳號／密码。
- 初次測試暴露 details 收合的測試操作問題；修正為只在收合時展開。CLI audit insert 曾因 UUID/text 共用 SQL parameter 失敗，交易完整回滾；分開參數後重跑成功。最終完整 36 tests 零失敗、零跳過。
- 加密 backup 在独立 DB 還原驗證：1 個 completed migration、121 個虛構測試帳號；原始資料庫未覆寫。來源與 browser assets 無產生的 signing secret／DB password／backup key，`.env.local` 0600。
- `start_skill` 更新並已確認草稿儲存；install_script 保留原已驗證流程。草稿未發布，新任務還原未驗證；Git 僅本機提交，未推送、未執行正式部署。

此交付為 Phase 4 的會員管理核心。文章／頁面 CMS、媒體上傳、活動管理、聯絡追蹤、系統設定、角色指派、營運趨勢與 CSV 尚未完成，不宣稱整個 Phase 4 已完成。

# Phase 4 文章 CMS 驗證（2026-10-13，Asia/Taipei）

- 新增 ArticleRecord／ArticleRevision，共 15 個 models；第二個 migration 只新增 CMS schema，原會員 migration 與 partial unique/CHECK 保留。實際套用 1 pending，重跑 0 pending。
- 官方 WASM createMigration 的 shadow factory 不支援，改為明確指定已驗證前一版 schema 的 schema-to-schema SQL diff；生成與套用分開，SQL 已檢閱。沒有 DB reset、checksum/TLS bypass 或 migration history 偽造。
- `db:verify:cms` 在自己建立的獨立空白 DB 套用兩個 migrations、重跑0 pending、seed9篇文章、確認0預設帳號、四個業務 CHECK 與會員 partial unique，修改／下架文章後再次 seed 保留狀態。只刪除自己建立的測試 DB，不更動現有 DB。
- TypeScript、Lint、production build 通過。首頁、文章列表／全文／sitemap 改為 dynamic SSR；CMS 有權限保護的列表、編輯與預覽頁。文章僅讀 DB，活動保持 fixtures。
- 最終 12 unit + 44 desktop/mobile E2E/API 全數通過、零跳過／未執行；原36個前台、會員與管理測試保留，新增8個CMS整合與2個validation unit。CMS projects 在舊 suites 通過後執行，避免公開測試內容干擾 fixture 分頁。
- 真實表單建立草稿、区塊排序、私人／即時預覽、發布、搜尋、收藏、下架、取消下架收藏、修訂還原4版本；PostgreSQL revisions/audit 驗證。XSS 標題與段落顯示為文字，沒有執行 script／img onerror；手機 editor 無橫向 overflow。
- API 角色：Editor/Admin/Super Admin可寫，Staff/Member403，未登入401；直接 Staff preview 不含私人標題。CSRF403、未知fields／危險來源／外部封面400、>64KiB413、duplicate slug409、併發update一成功一409、固定網址400、跨文章revision404。失敗不新增 revision/audit。
- 排程未到期公開404／首頁不含標題，到期同狀態立即公開200／首頁可見；過去排程輸入400，改草稿立即404／列表不含內容。無 fixture fallback。
- 回歸曾發現 Next loading stream 導致未知文章畫面404但HTTP200； metadata 阻塞不足以解決，最終由公開文章 Proxy 先查可見性、rewrite共用404，再由頁面獨立查詢。最終原404測試及CMS草稿／下架測試皆通過。未提供 CDN-cache 或正式 latency/CWV 驗收。
- 最新加密 DB backup 實際在獨立DB還原，確認2 completed migrations；原 DB 未覆寫。來源／browser assets 未包含隨機 generated secrets，`.env.local` 0600。編輯器1440px／390px截圖已檢視；虛構視覺檢查帳號的暫時 Editor 角色已恢復，檢查用 server 已停止。
- 雲端 install_script/start_skill 已確認更新草稿，加入 db:verify:cms、兩個 migrations、示範seed保護與CMS啟動／測試說明；未發布、未驗證新任務還原。Git 僅本機提交，無推送或正式部署。

文字區塊 CMS 基礎已實作。完整富文字 WYSIWYG、獨立分類／標籤 CRUD、媒體上傳、頁面／Banner／導覽 CMS、活動與聯絡管理、系統設定及正式內容審閱仍未完成；不宣稱 Phase 4 全部完成。

# Phase 4 活動與報名驗證（2026-10-13，Asia/Taipei）

- 三個新增模型 EventRecord/Registration/Change、18 models、第三個 migration，時段／截止／名額／version／check-in pair CHECK、unique 與索引。初次 migration 的 SQL comment 分號被本機 Pg adapter 誤拆，已核對三張本次新表0rows，僅撤回自己新增的空表/enum，使用官方 markMigrationRolledBack 保留失敗紀錄，修正後 apply成功、重跑0pending；既有會員／文章資料未重置。
- 空白獨立 DB 驗证三個 migration、9篇文章／3場活動、0個預設帳號；seed 重跑保留文章與活動的修改／下架，9個業務CHECK及會員partial unique完整。只刪除自己建立的測試 DB。
- TypeScript、Lint、production build通過；完整14 unit+52 E2E/API desktop/mobile回歸通過，零跳過／未執行。原44個回歸保留，新增8個活動整合與2個validation/CSV unit。
- 後台表單建立草稿404／公開200、會員報名與取消 UI、重新報名、名單、CSV匯出、活動取消與歷程／通知／audit均真實操作PostgreSQL。CSV曾因Next Link預抓而多記audit，改為普通下載anchor後確認只有實際匯出新增紀錄，沒有放寬測試斷言。
- 一個名額的3人併發僅1CONFIRMED+2WAITLISTED；重複409，FIFO候補遞補；取消後重報排序回新隊尾，併發重報201/409，仍不超額。實際Membership檢查、失效候補取消並遞補下一人、截止後拒絕報名／取消不遞補、已報名規則鎖定409、容量不可低於已確認409。
- 最新資格邊界：有效期等於活動開始視為不足，expiry必須晚於start；調整後重新build並單獨重跑8個活動desktop/mobile檢查全部通過。該次 --no-deps僅為受影響活動檢查，不冒充另一輪完整52tests。
- Staff可名單／CSV／報到，不能新增／編輯活動；Editor/Member403；私人名單不洩漏其他會員信箱。報到時段409、跨活動／不存在registration404、成功200／重複409、已報到不能取消；CSV公式／引號／換行與no-store、Origin403、audit寫入均驗證。
- 首頁、列表、月曆、全文、條件sitemap全部讀活動DB、無fixture fallback；關閉／開放／截止／取消狀態一致，草稿／下架公開URL真404。種子活動維持報名關閉，沒有虛構正式開放或收费。
- 最新加密backup在獨立DB實際還原3 completed migrations；原DB未覆寫。Source/browser資產無generated signing secret／DB password／backup key，.env.local 0600。Docker compose正式配置只做quiet syntax check，沒有部署。
- 1440px／390px活動後台截圖已檢視，無body橫向overflow；視覺檢查專用暫時角色已恢復，自己啟動的server已停止，確認3000連線拒絕。
- start_skill更新草稿已確認保存，加入活動角色、global flag、示範guard、三個migration與測試／seed保護；install_script保留已驗證通用流程。未發布、未驗證新任務restore；程式只做本機commit，未推送或正式部署。

未完成：附件／媒體安全上傳、QR身分查驗、正式活動規則／收費退款、可靠email outbox、大量營運容量／效能／MFA／完整privacy operations；聯絡追蹤與系統設定亦未完成。全部報名仍為開發示範，不宣稱完整Phase 4或正式營運驗收。

## 2026-10-13 帳號 CSV 與 VPS 文件更新

Typecheck、ESLint、production build 通過。`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- tests/admin.spec.ts --project=desktop --project=mobile` 實際執行12項、全部通過（35.8秒），含五種角色頁面/API隔離、未登入與停用拒絕、CSV查詢與state一致、资格資料、quote／換行／公式防護、不含密碼、下載檔名與no-store、HEAD不觸發稽核、成功下載只新增一次audit、1001筆413不截斷且無成功audit、1000筆完整匯出。大量測試僅建立隨機識別碼的虛構帳號，finally刪除其自身新增資料；暫時角色還原。既有停權／核准／本機bootstrap測試也通過。

這是受影響的後台套件驗證，未在本次重跑其他文章／活動／前台／單元套件，不將過往全套結果算成本次全套通過。沒有新migration。會員中心僅修正文案與既有活動紀錄連結。

使用者提供的VPS紀錄確認標準Prisma三個migration成功、Docker multi-stage build後web/db healthy、HTTPS200／HTTP301、Certbot renewal dry-run及deploy hook成功；agent沒有直接登入VPS，也尚未驗證本次新版本的VPS更新。
