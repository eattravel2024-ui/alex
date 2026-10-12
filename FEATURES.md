# 功能狀態

標記：完成＝有可執行成果與驗證；規劃＝尚無功能。網站目前僅 Phase 1，不可作正式會員平台營運。

## Phase 1

- 完成：Next.js / React / TypeScript / Tailwind、lockfile、共用 Header/Footer、手機選單（Escape 關閉）、skip link、返回頂部。
- 完成：深綠米白設計系統、本地主視覺插畫、首頁理念／服務／知識／活動／會員與聯絡占位內容。
- 完成：本地圖片 lazy loading、hover、reduced-motion、首頁入場動畫、loading skeleton、error boundary、404、法律草案與麵包屑。
- 完成：繁中 metadata、示範站 noindex、安全標頭、Docker/部署基礎、架構及資料庫規劃文件。
- 驗證：TypeScript、Lint、Build、桌面與手機 E2E；詳見 docs/VALIDATION.md。
- 待後續資料介面：滾動 reveal、Toast、輪播、真實資料統計動畫及空資料元件的使用。沒有正式數據，不使用虛構統計。

## Phase 2：規劃

協會各子頁與正式資訊；消息／知識文章全文、分類、標籤、搜尋、分頁、精選、分享、相關文章；活動列表／月曆／詳情；FAQ／聯絡頁；來源、審閱日期；SEO sitemap/canonical/OG/structured data。正式 Domain 未提供，不虛構 canonical。

## Phase 3：規劃

PostgreSQL / Prisma / migration / seed；成熟身分驗證、註冊、email verification、登入登出、session、重設／修改密碼、rate limit、停用；會員中心、個人資料、正式資格、期限、申請與補件、收藏、報名紀錄、通知／隱私設定；表單寫入 DB。

## Phase 4：規劃

/admin 獨立 Layout、真實 Dashboard 趨勢；Server RBAC；CMS 區塊排序／顯示、WYSIWYG/XSS、草稿／預覽／排程、Banner、頁面、導覽／Footer、媒體安全上傳；文章／分類／標籤 CRUD；會員審核、資格／停權／備註／CSV；活動名額／資格／候補／取消／報到／附件／通知／CSV；聯絡訊息指派追蹤；系統／SEO／SMTP 模板／政策設定；Audit Log。

## Phase 5：規劃

課程與教材、完課記錄；年費／續費／帳務／人工核款及金流 adapter（不虛構付款）；PDF 證明與驗證；電子報 double opt-in／取消／寄送記錄；通知 outbox；成長與瀏覽數據、全站搜尋；多語系、夥伴、捐款資訊、PWA、第三方 API、QR 擴充。

## Phase 6：待完成

關鍵 API／單元／表單／RBAC／auth／申請／報名／admin CRUD 整合與 E2E；完整安全稽核、效能/CWV、WCAG 2.2 AA 人工及自動評估；備份還原驗證；正式內容、法律政策、會員規則、Domain、SMTP、DB、HTTPS、監控確認。正式部署另需明確授權。Docker runtime 產物封裝與啟動已驗證；多階段 BuildKit 安裝管線尚未完成。完整依賴稽核有 5 個 high 開發工具相依項目，見 SECURITY.md。
