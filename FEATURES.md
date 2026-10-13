# 功能狀態

標記：完成＝有可執行成果與驗證；規劃＝尚無功能。網站目前提供 Phase 1–2 前台、Phase 3 會員核心與 Phase 4 部分後台，不可作正式協會平台營運。

## Phase 1

- 完成：Next.js / React / TypeScript / Tailwind、lockfile、共用 Header/Footer、手機選單（Escape 關閉）、skip link、返回頂部。
- 完成：深綠米白設計系統、本地主視覺插畫、首頁理念／服務／知識／活動／會員與聯絡占位內容。
- 完成：本地圖片 lazy loading、hover、reduced-motion、首頁入場動畫、loading skeleton、error boundary、404、法律草案與麵包屑。
- 完成：繁中 metadata、示範站 noindex、安全標頭、Docker/部署基礎、架構及資料庫規劃文件。
- 驗證：TypeScript、Lint、Build、桌面與手機 E2E；詳見 docs/VALIDATION.md。
- 待後續資料介面：滾動 reveal、Toast、輪播、真實資料統計動畫及空資料元件的使用。沒有正式數據，不使用虛構統計。

## Phase 2：前台瀏覽已實作，正式資料與持久化待完成

- 完成：關於協會（簡介／使命／沿革／組織／人員／章程／夥伴的正式資料占位，不虛構人物與認證）。
- 完成：消息與健康知識列表／全文、伺服器搜尋、分類、標籤、精選、分頁、相關文章、複製分享、麵包屑、未知 slug 404。
- 完成：健康文章延伸閱讀來源、明確的未審閱狀態與一般知識聲明。
- 完成：活動列表／月曆／詳情、搜尋／分類、跨年月份切換、台灣時區、示範議程及資格；報名明確未開放。
- 完成：聯絡資訊占位與可操作 FAQ；不提供尚未能儲存資料的表單。
- 完成：首頁消息區及通往全文的內容卡片、主導覽連結至實際內容頁。
- 完成：Metadata／Open Graph、預設 noindex robots、APP_URL 條件 canonical／sitemap／Article JSON-LD；無正式 Domain 不產生虛構網址。HTML 內資料序列化 escape `<`。
- 待完成：正式內容、內容審閱；閱讀統計、活動附件、正式聯絡窗口與資料政策。文章與會員已持久化；活動與測試報名已接資料庫。
- 尚未宣稱：全功能 CMS、完整 SEO/CWV／無障礙認證、正式部署驗收。

## Phase 3：本機會員核心已實作

- PostgreSQL 17、Prisma 7.10、13 個模型、SQL migration、FK／unique／索引；pending/returned 申請 partial unique、期限 CHECK；migration 實際套用且重跑 0 pending。
- Better Auth 1.7.7（使用者已確認）：註冊、信箱驗證、登入登出、忘記／重設／修改密碼、持久化 Session、停用狀態檢查、server password/consent 驗證。
- 本機 Mailpit 實際收到驗證與重設郵件；重設 token 單次使用、密碼重設撤銷所有 Session，修改密碼撤銷其他登入；自己的 Session 可逐筆撤銷。
- 會員中心：自身資料與選填電話／偏好、網站帳號與會員資格分離、示範申請、補件重新提交、進度／歷程、文章收藏、站內通知。
- 申請與審核 service：交易、row lock、版本檢查；Admin/Staff/Super Admin 伺服器授權；核准會員、history、通知、audit 同一交易；拒絕自我審核。
- CSRF Origin／JSON 大小限制、Zod strict inputs、角色不能自行指定、持久化 per-IP + per-account 限流、HttpOnly/SameSite cookies、HTTPS時 Secure。
- 加密開發 backup、孤立 DB restore 演練；現有 DB 不覆寫。無預設管理員／靜態共用密碼。
- 正式資格／章程／政策／SMTP 未確認；正式註冊預設關閉，正式申請預設關閉，示範資格無正式效力。
- 待完成：正式會員規則、MFA、通知可靠 email outbox／重試、會員證明 PDF（Phase 5）、正式活动规则、正式聯絡政策、資料刪除工作流程與完整 privacy operations。文章已接資料庫 CMS，活動與測試報名已接資料庫。
- 本機 Prisma 使用版本鎖定的官方內部 JS/WASM 介面；標準 native CLI 網域仍受限。正式上線必須驗證標準 migration 工具鏈與部署環境，不能宣稱完成。

## Phase 4：管理核心、文章 CMS 與活動報名已實作，其餘模組待完成

- 完成：獨立 `/admin` Layout、依角色顯示導覽、資料庫即時帳號／停用／待審／補件統計，統計不使用虛構營運資料。
- 完成：申請狀態／姓名／信箱搜尋與分頁、歷程、核准／退回／拒絕 UI；台灣時間期限、版本衝突與禁止自我審核沿用交易 service。
- 完成：帳號與會員資格 CSV 匯出，沿用搜尋／啟用／停用條件，匯出全部符合條件的帳號（最多1000筆），超限明確拒絕；Admin/Super Admin 授權、公式防護、no-store、匯出稽核，不含密碼／Session／私人操作原因。
- 完成：帳號搜尋、啟用／停用篩選與分頁；Admin/Super Admin 可停用一般會員、撤銷登入、站內通知與 audit 同一交易；不能操作自己或管理角色，不能改角色或會員資格。
- 完成：Super Admin 的唯讀稽核紀錄、操作代碼查詢與分頁，不顯示秘密或操作原因全文。
- 完成：每一頁資料查詢與 API 重新驗證目前角色，不只依賴 Layout；Editor 無會員個資權限，Staff 可審核與處理活動報名／報到，不能編輯文章或活動。
- 完成：本機 `dev:admin` 顯式提升已存在且驗證完成的開發帳號，具備 audit、重跑安全與 development/loopback guard；不建立預設帳號或密码。
- 完成：文章／消息的新增、編輯、區塊排序、分類／標籤欄位、全文搜尋、私人預覽、草稿／發布／台灣時間排程／下架、修訂與還原草稿；每次保存同一交易寫入修訂與 Audit Log。
- 完成：首頁／列表／全文／相關文章／條件 sitemap 與收藏查詢連動 PostgreSQL，公開文章預檢保留 HTTP 404；沒有隱藏 fixture fallback。既有九篇示範文章 seed 重跑不覆寫 CMS 修改。
- 完成：內容 RBAC（Editor/Admin/Super Admin）、strict schema、64 KiB CMS body 限制、版本409／唯一slug／固定網址、HTTPS來源與本地封面白名單；所有內容安全文字渲染。
- 完成：活動資料庫／前台列表／月曆／全文／首頁／sitemap，後台活動建立／編輯／公開／取消／下架、資格／截止／名額／候補設定、名單與狀態分頁。
- 完成：會員自身報名／候補／取消、FIFO 遞補與资格重查、站內通知／歷程／audit 原子交易；row lock 防超額、unique防重複；同一使用者取消後重報排到新隊尾。
- 完成：Staff/Admin/Super Admin 名單／CSV／報到，只有 Admin/Super Admin 可修改活動；CSV公式防護／匯出稽核／不預抓下載；報到時段與資格驗證、禁止重複報到。
- 完成：三個 migration／18模型，名額／時段／截止／check-in CHECK，空DB及加密還原驗證；seed3場原示範活動維持報名關閉，不覆寫後台狀態。
- 尚待實作：正式活動規則／收費退款／附件上傳／QR報到／可靠寄信、完整富文字 WYSIWYG、分類／標籤獨立 CRUD、以下頁面／媒體／系統等項目，以及趨勢圖、角色指派、會員資格修改與操作原因的專用管理歷程。Phase 4 尚未全部完成。

/admin 獨立 Layout、真實 Dashboard 趨勢；Server RBAC；CMS 區塊排序／顯示、WYSIWYG/XSS、草稿／預覽／排程、Banner、頁面、導覽／Footer、媒體安全上傳；文章／分類／標籤 CRUD；會員審核、資格／停權／備註／CSV；活動名額／資格／候補／取消／報到／附件／通知／CSV；聯絡訊息指派追蹤；系統／SEO／SMTP 模板／政策設定；Audit Log。

## 聯絡表單與訊息管理

- 完成：匿名示範表單、同意告知、姓名／信箱／類型／主旨／內容驗證、成功收件編號；只接受 @example.test 虛構信箱，不寄送郵件。
- 完成：ContactMessage／ContactMessageChange，四個 migration、20個模型；訊息、同意版本與時間、狀態、接手與內部處理歷程持久化。contact demo-only／version CHECK。
- 完成：Origin／16KiB上限／strict schema／蜜罐、資料庫10分鐘IP10次＋信箱3次限流；代理鏈使用最後IP，沒有可信IP時共用保守限流；同提交ID與內容重試去重、內容改變409，無公開讀取API。
- 完成：Staff/Admin/Super Admin 後台搜尋、狀態與自身／未指派篩選、分頁、新訊息數；接手／釋出、狀態與說明更新、row lock／版本衝突／交易history與audit。不能搶走或釋出他人接手的訊息；Editor/Member沒有訊息個資權限。
- CONTACT_SUBMISSIONS_ENABLED 預設false，開發新設定true；VPS需要明確啟用。正式聯絡服務、真實信箱、郵件回覆、附件、CAPTCHA、保留與刪除工作流程、對外查詢與正式法律政策尚未完成。管理員登入初始化仍未完成，沒有預設管理員。

## Phase 5：規劃

課程與教材、完課記錄；年費／續費／帳務／人工核款及金流 adapter（不虛構付款）；PDF 證明與驗證；電子報 double opt-in／取消／寄送記錄；通知 outbox；成長與瀏覽數據、全站搜尋；多語系、夥伴、捐款資訊、PWA、第三方 API、QR 擴充。

## Phase 6：待完成

關鍵 API／單元／表單／RBAC／auth／申請／報名／admin CRUD 整合與 E2E；完整安全稽核、效能/CWV、WCAG 2.2 AA 人工及自動評估；備份還原驗證；正式內容、法律政策、會員規則、Domain、SMTP、DB、HTTPS、監控確認。正式部署另需明確授權。Docker runtime 產物封裝與啟動已驗證；多階段 BuildKit 安裝管線尚未完成。完整依賴稽核有 6 個 high 開發工具相依項目，見 SECURITY.md。

## VPS 示範站

使用者提供的終端驗證顯示 test.cchm.tw 已部署：PostgreSQL／Web healthy、Nginx HTTPS 200、HTTP 301、Certbot 續期與 deploy hook 測試成功。此為示範發布，不代表正式營運驗收；註冊／入會／報名仍關閉。本次後续功能須更新 VPS 後才會出現。
