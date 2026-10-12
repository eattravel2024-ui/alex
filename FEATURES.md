# 功能狀態

標記：完成＝有可執行成果與驗證；規劃＝尚無功能。網站目前提供 Phase 1–2 前台瀏覽，不可作正式會員平台營運。

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
- 待完成：正式內容、內容審閱、CMS 資料來源；會員收藏與閱讀統計、活動附件與報名、聯絡提交／防垃圾訊息。後續 Phase 3–4 接資料庫，不能宣稱目前具備持久化。
- 尚未宣稱：全功能 CMS、完整 SEO/CWV／無障礙認證、正式部署驗收。

## Phase 3：規劃

PostgreSQL / Prisma / migration / seed；成熟身分驗證、註冊、email verification、登入登出、session、重設／修改密碼、rate limit、停用；會員中心、個人資料、正式資格、期限、申請與補件、收藏、報名紀錄、通知／隱私設定；表單寫入 DB。

## Phase 4：規劃

/admin 獨立 Layout、真實 Dashboard 趨勢；Server RBAC；CMS 區塊排序／顯示、WYSIWYG/XSS、草稿／預覽／排程、Banner、頁面、導覽／Footer、媒體安全上傳；文章／分類／標籤 CRUD；會員審核、資格／停權／備註／CSV；活動名額／資格／候補／取消／報到／附件／通知／CSV；聯絡訊息指派追蹤；系統／SEO／SMTP 模板／政策設定；Audit Log。

## Phase 5：規劃

課程與教材、完課記錄；年費／續費／帳務／人工核款及金流 adapter（不虛構付款）；PDF 證明與驗證；電子報 double opt-in／取消／寄送記錄；通知 outbox；成長與瀏覽數據、全站搜尋；多語系、夥伴、捐款資訊、PWA、第三方 API、QR 擴充。

## Phase 6：待完成

關鍵 API／單元／表單／RBAC／auth／申請／報名／admin CRUD 整合與 E2E；完整安全稽核、效能/CWV、WCAG 2.2 AA 人工及自動評估；備份還原驗證；正式內容、法律政策、會員規則、Domain、SMTP、DB、HTTPS、監控確認。正式部署另需明確授權。Docker runtime 產物封裝與啟動已驗證；多階段 BuildKit 安裝管線尚未完成。完整依賴稽核有 5 個 high 開發工具相依項目，見 SECURITY.md。
