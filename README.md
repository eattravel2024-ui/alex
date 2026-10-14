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

首頁 `/`、協會 `/about`、消息 `/news`、知識 `/knowledge`、活動 `/events`、聯絡 `/contact`，法律草案 `/privacy`、`/terms`。文章與活動支援 `[slug]` 全文頁；搜尋、分類、標籤、分頁與月曆以 query string 保存。文章、活動與會員已由 PostgreSQL 保存，保留開發示範聲明。會員功能需要本機 PostgreSQL 與 Mailpit。`dev:setup` 隨機產生未追蹤的 `.env.local`（已有檔案不覆寫），啟動兩個服務；不建立預設管理員或共用密碼。開發來源必須與 BETTER_AUTH_URL 相符，預設是 `http://127.0.0.1:3000`。若使用受限雲端環境，可設定 `npm_config_cache=/workspace/.npm-cache`。

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

`/auth/register`、`/auth/login`、`/auth/verify`、`/auth/forgot-password`、`/auth/reset-password`；`/member` 的個人資料、安全設定、示範申請、收藏與站內通知。註冊須同意開發版政策，信箱驗證後才能登入。密碼至少 8 字且包含字母與數字。網站帳號不自動成為正式會員，示範核准沒有正式效力。

Mailpit SMTP：127.0.0.1:1025；測試收件匣：127.0.0.1:8025。只收本機測試郵件，不向真實收件人寄送。使用 `.example.test` 虛構資料，勿提交真實個資。PostgreSQL 在 loopback 5433，密碼與簽署密鑰只保存在權限 0600 的 `.env.local`。

完整測試需先完成本機服務／migration／seed／build：`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test`。API 整合測試透過 HTTP 操作並驗證 PostgreSQL 寫入；權限測試僅對專用 fixture 暫時賦予管理角色，無對外管理員預設帳號。測試使用不同模擬 IP 隔離正常的 per-IP 限流，沒有關閉限流。正式 proxy 必須覆寫 forwarded IP headers，不能公開直連後端端口。

## Prisma 工具與資料保存

本環境封鎖 binaries.prisma.sh，標準 Prisma CLI 無法下載原生 schema engine。`db:generate` 使用鎖定 7.10.0 的官方內部 client generator；`db:migrate:local` 使用同版本官方 WASM schema engine與 Pg adapter，追蹤真正 `_prisma_migrations` 及 checksum。沒有停用任何 TLS／checksum 驗證。這是本機替代工具鏈，介面非穩定承諾；升級需回歸測試。WASM migration 必須 Node 24 的 experimental-wasm-modules 旗標，僅允許本機 development DB，不執行 reset。正式 migration 保留 `npm run db:migrate`（標準 CLI），仍需允許官方引擎網域。

Docker volumes 不假定隨雲端任務保存。`npm run db:backup` 在 `.local/backups` 產生 AES-256-GCM 加密備份；key 位於忽略的 `.env.local`。`npm run db:backup:verify` 還原至獨立暫存測試 DB；`db:restore:local` 僅在目標 public schema 完全空白時還原。備份與原始 key 必須一併安全保存，不放 Git；不要任意更換 key。這是開發 snapshot 保存方式，正式備份仍須另行制定異地儲存、key management、RPO/RTO與法律保留期限。

## 管理後台（Phase 4 管理核心）

`/admin` 提供真實資料統計；`/admin/applications` 為申請審核；`/admin/members` 為帳號搜尋與停用／恢復；`/admin/audit` 為唯讀稽核紀錄。角色限制見 docs/API.md。會員中心會對有權限的帳號顯示後台入口。文章、活動與封面圖片媒體管理基礎已完成；系統設定仍待完成。

開發環境先註冊並完成本機 Mailpit 信箱驗證，再以**自己的既有開發帳號**執行 `npm run dev:admin -- <已驗證的開發帳號信箱>`。這會提升該帳號為 Super Admin 並留下稽核紀錄，不建立帳號、不產生密码；拒絕 production／非 loopback DB。此命令不納入自動 install/seed；正式角色初始化流程仍待制定。

停用／恢復會撤銷登入，原因寫入對方站內通知。這不改變會員資格；管理角色不能在此被停用。管理畫面的資料搜尋、分頁與 mutation 皆於伺服器重新檢查權限。

## 文章 CMS（Phase 4）

`/admin/articles`：列表、標題搜尋、類型／狀態篩選與分頁；`/admin/articles/new` 與 `/admin/articles/[id]`：文字區塊編輯、區塊排序、分類／標籤、作者、來源連結、示範封面、草稿／發布／排程／下架；`/preview` 為受權限保護的已儲存預覽。Editor、Admin、Super Admin 可操作；Staff、Member 不可讀取草稿或操作內容。

發布與到期排程即時出現在首頁、列表、全文、相關文章及有正式 APP_URL 時的 sitemap。下架與草稿不會回退到 fixtures；下架收藏顯示「文章已下架」，可取消收藏。文章網址／類型建立後固定。版本檢查拒絕過期修改，保留最近 20 版修訂的後台入口；還原建立新版本且先回到草稿。

段落工具列支援粗體、斜體、項目清單、編號清單與 HTTPS 連結；選取文字後按工具鈕，或使用 Ctrl／⌘＋B、Ctrl／⌘＋I。連結在編輯器內填寫並驗證，Enter 插入連結，Escape 取消。空白行分隔段落，清單項目使用單一換行。編輯中的預覽、已儲存私人預覽與公開全文共用同一個渲染器。

這是**文字區塊與有限格式 CMS**：段落仍存為字串，支援 `**粗體**`、`*斜體*`、`[連結文字](https://example.org/)`、`- 項目` 與 `1. 項目`；標題與摘要保持純文字。HTML、不合法網址與未配對格式會保留為文字，不執行 HTML／MDX；段落連結不得夾帶帳密。文字格式本身不需migration；封面媒體增量需要第六個migration。完整 WYSIWYG、分類／標籤獨立管理、文件／影片上傳、導覽／Footer CMS 仍待實作。来源只接受 HTTPS 且不得夾帶帳密；封面可選三張本地插畫或經過驗證的上傳圖片。所有內容仍為示範，不宣稱已完成專業內容審閱。

`db:seed` 使用 Node 24 的原生 TypeScript stripping 匯入 fixtures，只新增不存在的九篇示範文章，不覆寫管理員的修改／下架。前台文章與首頁現在需要正常 PostgreSQL；DB 失效不偷偷切回 fixtures。公開文章 URL 由 Next Proxy 在串流前判斷可見性，再由頁面重新查詢，以保留真正的 HTTP 404。

WASM 增量 migration 可用 `npm run db:migrate:local -- --create <name> --from-schema <verified-previous-schema-file>` 產生 SQL；只產生檔案，不立即套用。必須檢閱 SQL、保留手工業務約束，再執行不带 --create 的 migration 指令。此為 development-only helper，不偵測實體 DB drift，也不替代正式 native Prisma migration tooling。

E2E 的 CMS projects 在既有前台／會員 projects 通過後執行，避免測試中的公開內容干擾既有 fixture 數量；每個 CMS test 完成後將自己的文章下架並恢復專用角色。未執行的 dependency projects 或 tests 不算通過。

## 活動與報名（Phase 4 本機核心）

`/admin/events` 提供活動搜尋／狀態篩選、分頁與報名名單；Admin/Super Admin 可建立／編輯活動、公開／取消／下架、調整名額与報名開關。Staff 僅能查看名單、匯出及報到，不能編輯活動；Editor 無報名個資權限。報名 CSV 防止試算表公式執行，匯出會記錄 audit；下載使用一般連結，避免框架預抓造成虛假匯出紀錄。

公開活動、首頁與月曆皆讀資料庫，取消活動保留說明，草稿／下架回404，沒有 fixtures fallback。三個示範活動首次 seed 公開但關閉報名，重跑不覆寫後台編輯。只有本機 `EVENT_REGISTRATIONS_ENABLED=true` 且活動開放、未截止／未開始、帳號符合資格時可報名；示範活動在非 development 環境拒絕報名。舊 `.env.local` 不覆寫；如尚未有這個開關，請自行補上本機測試旗標，不要更換任何密鑰。

`/member/events`：本人報名／候補／取消、最近20筆狀態歷程、報到狀態。額滿可依活動設定候補，採資料庫 sequence 排序；取消／增加名額時遞補，重新檢查帳號、會員狀態與資格期限。會員限定不是 role=MEMBER，而是真實 Membership 有效、類別啟用且涵蓋活動開始；示範資格只在 development 可用。

所有變更使用活動 row lock，名額、報名、通知、狀態歷程與 audit 同一交易，不能超額或重複報名。已報名時時間／資格固定，名額不能低於已確認人數；草稿／下架前須先取消全部報名。會員取消限活動開始前且未報到；截止後取消不再遞補。報到只限開始前兩小時至結束，拒絕候補、重複報到、跨活動紀錄與失效資格。

此為測試報名，沒有實際活動、收費／退款、附件上傳、QR 身分驗證或可靠寄信 outbox。名額與候補各限1000，CSV最多2000筆歷史紀錄（超過會明確回413，不偷偷截斷）；大量營運量、正式規則與部署仍需後續驗證。`db:verify:cms` 現在從空 DB 驗證三個 migrations、9篇文章與3個活動，以及 seed 保留修改與會員約束。

## 聯絡示範

`/contact` 在 CONTACT_SUBMISSIONS_ENABLED=true 時接受虛構姓名與 @example.test 信箱；匿名詢問寫入 PostgreSQL，不寄送任何郵件。`/admin/contacts` 僅 Staff/Admin/Super Admin 可讀取與處理。需要第四個 migration；新開發設定會啟用，既有 .env.local 若缺少此旗標，僅追加 CONTACT_SUBMISSIONS_ENABLED=true，保留所有密鑰。公開 VPS 預設關閉，按 DEPLOYMENT.md 的聯絡版本更新流程啟用；不是正式聯絡服務。

VPS可用一次性`scripts/demo-admin.mjs`建立首位保留@example.test識別碼的示範管理員，不寄送郵件，無預設密碼。必須由VPS操作者明確確認，讀取owner-only密碼檔、只在cchm_demo/test.cchm.tw或隔離本機測試DB執行；詳見DEPLOYMENT.md。正式管理員與MFA流程仍待完成。

## 首頁／介紹管理

登入後台後選「首頁內容」「協會介紹」。修改後「儲存草稿」不改公開頁面，私人預覽只顯示已儲存的文字；「發布目前內容」更新前台。修訂還原只生成草稿，需另按發布。需要第五個migration，不用seed；圖片、版型、導覽與Footer未提供編輯。

頁面CMS現在支援首頁主視覺四張內建插圖、替代文字、兩個按鈕文字與站內目的地，以及協會介紹章節排序／顯示（至少保留一章）。沿用SitePage JSON，無新增migration；舊snapshot仍有效，沒有新欄位時使用原始設定。此階段依使用者指示只開發／測試與上傳原始碼，不執行VPS備份、migration或部署。

## 文章封面與媒體管理

Editor/Admin/Super Admin 可在 `/admin/media` 上傳、搜尋、分頁、修改圖片替代文字，以及確認刪除未使用圖片。文章編輯器的「選擇媒體圖片」可選用既有圖片或直接上傳；封面替代文字保存在文章與修訂版本中，舊文章與舊snapshot仍相容。媒體描述更新用於之後的選用，不覆寫文章自己的替代文字。

只接受不超過5MB的JPG、PNG、WebP靜態圖片。伺服器確認檔案內容／MIME與完整性，限制1600萬像素，移除中繼資料、依EXIF方向旋轉，縮至1600×1200內並重新編碼WebP。SVG、GIF、動畫、多頁、偽裝或損壞檔案會拒絕。圖片庫總量上限512MB，每位操作者每分鐘最多5張成功上傳，同時最多處理2筆，串流上傳逾時30秒。圖片以隨機UUID命名，原始檔名不保存。

圖片預設只供內容管理角色預覽；有目前已發布／排程已到期文章引用時，`/media/[id]` 才公開提供。圖片回應no-store，Next optimizer禁止處理`/media`，避免下架後殘留公開快取。當前文章和全部修訂版本引用的圖片禁止刪除，包括草稿或已下架文章；切換封面不會破壞歷史還原。

本機開發默认使用忽略Git的 `.local/media`，`npm start` 將它解析為絕對路徑，避免standalone工作目錄改變。正式runtime必須指定絕對且非public、沒有符號連結的`MEDIA_STORAGE_DIR`；Compose使用獨立`media_data` volume，Dockerfile預先建立非root使用者可寫目錄。資料庫備份不包含圖片檔案，保存／搬遷時需同步保留圖片目錄或volume。這版新增MediaAsset與ArticleRecord.imageAlt，共23模型、6個migrations；圖片處理使用直接鎖定的sharp0.35.5依賴。依使用者安排，VPS更新仍另行處理。
