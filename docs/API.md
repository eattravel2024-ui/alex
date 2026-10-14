# Phase 3 REST API

所有私有 API 使用 Better Auth HttpOnly cookie session；需已驗證且未停用帳號。Mutation 要求 Origin 與 BETTER_AUTH_URL 相符，JSON body 上限 8 KiB。錯誤回傳 `{error:{code,message}}`，不回傳 stack/credentials。資料 API Cache-Control=no-store。原生 auth endpoints 的錯誤格式由 Better Auth 管理。

| Method / path                                 | 行為                                                    | 授權                                  |
| --------------------------------------------- | ------------------------------------------------------- | ------------------------------------- |
| POST /api/auth/sign-up/email                  | name/email/password、termsAccepted/privacyAccepted=true | 開發本機或政策已核准；不接受 role     |
| POST /api/auth/sign-in/email                  | email/password，信箱必須已驗證                          | 正常帳號、限流                        |
| GET /api/auth/verify-email                    | 框架簽署的 token，callback 白名單                       | token 驗證                            |
| POST /api/auth/send-verification-email        | email/callbackURL                                       | 通用提示、限流                        |
| POST /api/auth/request-password-reset         | email/redirectTo                                        | 通用提示、限流                        |
| POST /api/auth/reset-password                 | token/newPassword                                       | 有效單次 token，撤銷所有 Session      |
| POST /api/auth/change-password                | currentPassword/newPassword/revokeOtherSessions         | 本人 Session 與目前密碼               |
| POST /api/auth/sign-out                       | 登出                                                    | 本人 Session                          |
| GET /api/me                                   | 個人資料、資格、申請、收藏、站內通知                    | 本人；忽略任意 query userId           |
| PATCH /api/me                                 | name、phone?、emailNotifications                        | 本人；strict schema                   |
| GET /api/membership/applications              | 申請／type／歷程                                        | 僅本人                                |
| POST /api/membership/applications             | typeId/motivation；首次送出或補件                       | 本人、服務開關、合法類別              |
| PATCH /api/admin/membership/applications/[id] | status/note/version/validUntil?                         | Super Admin/Admin/Staff，禁止自我審核 |
| GET /api/member/bookmarks?slug=               | 自己的收藏狀態                                          | 本人                                  |
| POST /api/member/bookmarks                    | slug 存在才收藏；可重複安全請求                         | 本人                                  |
| DELETE /api/member/bookmarks                  | slug 取消收藏                                           | 本人                                  |
| DELETE /api/member/sessions/[id]              | 撤銷指定 UUID Session；不暴露 token                     | 本人擁有的 Session                    |

審核 status 為 APPROVED/RETURNED/REJECTED，note 最多 500 字；APPROVED 需要未來有效期限。version 不符或非 PENDING 回 409。送出申請時鎖定 user row，pending/returned 有 partial unique；核准時鎖 application，Membership + history + notification + audit 同一交易。

完整 CMS 管理 UI、機器對機器 API token/OAuth、公眾 contact submission、正式收費報名、頁面／媒體 CMS CRUD 尚未提供。本站 test types 只可在 DEVELOPMENT_MODE 使用；demo 核准不代表正式資格。

# Phase 4 管理核心

| 路徑 | 功能 | 角色 |
| --- | --- | --- |
| /admin | 即時統計，各角色只讀取授權資料 | Super Admin/Admin/Staff/Editor |
| /admin/applications | 狀態／姓名／信箱搜尋、歷程、審核 | Super Admin/Admin/Staff |
| /admin/members | 帳號查詢、篩選、停用／恢復 | Super Admin/Admin |
| /admin/audit | 唯讀稽核紀錄與操作代碼篩選 | Super Admin |
| PATCH /api/admin/members/[id] | disabled、expectedDisabled、note | Super Admin/Admin |

帳號 mutation 使用 strict JSON、UUID、原因 2–500 字、Origin 驗證與 8 KiB 上限。目標只能是其他 MEMBER；管理角色／本人回 403，狀態已變更或重複操作回 409，缺少帳號回 404。停用／恢復、Session 撤銷、站內通知、audit 同一交易，鎖定目標 User row。停權不改角色、不更動正式會員資格。每頁資料查詢前重新確認角色，不依賴 Layout 作為唯一授權；Editor 的總覽不讀會員統計。查詢預設每頁 10 筆，搜尋限制 120 字、越界頁會截取。

`DEV_ADMIN_BOOTSTRAPPED` 是本機顯式角色初始化的稽核代碼。管理操作原因保存在對方通知；AuditLog 目前僅保存 action/entity/actor/time，尚無原因專用欄位與不可竄改外部稽核儲存。

# Phase 4 文章 CMS API

| Method / path | 行為 | 授權 |
| --- | --- | --- |
| POST /api/admin/articles | 新增文章、revision、audit 同一交易，成功201 | Editor/Admin/Super Admin |
| PATCH /api/admin/articles/[id] | 完整欄位與目前 version，成功200 | Editor/Admin/Super Admin |
| POST /api/admin/articles/[id]/restore | revisionId + 目前 version，還原為新草稿版 | Editor/Admin/Super Admin |

文章 payload：slug、kind(news/knowledge)、title、summary、category、tags、image、imageAlt(可省略，預設空字串)、author、featured、reviewedAt(nullable date)、blocks[{heading,paragraphs}]、references[{title,url}]、status(DRAFT/PUBLISHED/SCHEDULED/ARCHIVED)、publishAt(nullable ISO datetime)。status=PUBLISHED立即發布，保留有效的過去publishAt；SCHEDULED必須提供未來時間。新增後slug/kind固定。API不接受isDemo／更新人／額外角色等字段；所有內容仍isDemo=true。CMS body上限64KiB，restore維持8KiB；Origin/Session/最新角色重新驗證。image只接受三張內建插畫或精確`/media/<uuid>`；媒體需存在且檔案可讀，否則400 MEDIA_NOT_FOUND。imageAlt最多160字，上傳媒體未填時採用媒體替代文字並保存在文章與revision，舊snapshot保持相容。

## 文章封面媒體 API

| Method / path | 行為 | 授權 |
| --- | --- | --- |
| GET /api/admin/media?q=&page=1 | 替代文字搜尋、12筆分頁，回items/total/page/pages | Editor/Admin/Super Admin |
| POST /api/admin/media | multipart file與altText；成功201回MediaItem | 同上＋Origin |
| PATCH /api/admin/media/[id] | strict JSON {altText,version}，修改替代文字及增版本 | 同上＋Origin |
| DELETE /api/admin/media/[id] | strict JSON {version}，刪除未使用圖片 | 同上＋Origin |
| GET /media/[id] | 重新編碼後的WebP，當前公開文章引用時公開；否則只給內容角色預覽 | 公開引用或上述角色 |

MediaItem為id、url、altText、width、height、byteSize、createdAt(ISO)、version、used；不含原始檔名／儲存路徑／操作者個資。altText為trim後1–160字，PATCH/DELETE JSON上限8KiB，version須正整數。不接受額外或重複multipart字段。未登入401／角色不足403／Origin無效403／格式無效400／大小超限413／上傳逾時408／版本或正在使用409／繁忙與成功上傳限速429／儲存未配置或IO問題503。

圖片上限5MiB，multipart整體5MiB+64KiB，串流固定記憶體及30秒限制、2並發。JPG/PNG/WebP須實際內容與MIME一致、完整静態單頁且最多1600萬像素；重新編碼至1600×1200內的WebP並移除原始中繼資料。媒體總量512MiB，每操作者最近60秒最多5筆成功MEDIA_UPLOADED稽核記錄；刪除圖片不重設限速。當前文章與任何修訂版本引用都阻止刪除，saveArticle與刪除鎖同一媒體row，避免併發留下斷鏈。舊媒體描述修改不覆寫文章自己的imageAlt。

沒有公開媒體清單。未公開圖片／無權限／不存在的檔案路徑回404，全部圖片private,no-store／nosniff／CORP same-origin；Next optimizer仅允許/images，不能為/media建立公開快取。這些路徑以經處理的圖片回應，不允許SVG／任意HTML／下載原始內容。資料表與圖片volume各自保存，DB備份不含檔案；對外CDN／物件儲存、附件／影音與媒體復原作業尚未提供。

`blocks[].paragraphs[]` 仍為每段最多2000字的字串；顯示時支援有限語法 `**粗體**`、`*斜體*`、`[文字](https://...)`、連續的 `- 項目`／`1. 項目` 行。既有純文字段落維持相容，反斜線可跳脫格式符號；不支援HTML／MDX／圖片／任意Markdown。僅明確HTTPS且沒有帳密、空白／控制字元或反斜線的段落網址會成為連結，其他網址與不完整語法顯示為文字。API不因段落內的不合法連結而拒絕保存；references欄位的HTTPS驗證與400行為不變。標題／摘要／區塊標題不解析格式，無新增資料欄位或migration。

重複 slug 或過期 version 回409；不合法來源／排程／改網址回400；無目標文章或修訂不屬於目標回404；未登入401／角色不足403。版本與修訂／audit 均為交易；還原 audit=ARTICLE_RESTORED，不自動發布。下架為 soft archive，无實體刪除端點。私人預覽與所有資料頁在查詢前重新驗權，不依賴 Layout。修訂頁顯示最近20版，未提供大量歷程匯出或 hard-delete。

# Phase 4 活動 API

| Method / path | 功能 | 權限 |
| --- | --- | --- |
| POST /api/admin/events | 建立活動，成功201 | Admin/Super Admin |
| PATCH /api/admin/events/[id] | 完整欄位+version，成功200 | Admin/Super Admin |
| POST /api/events/[id]/registration | 本人報名／候補，成功201 | 已驗證未停用帳號，依活動資格 |
| DELETE /api/events/[id]/registration | 本人取消，成功200 | 本人，開始前且未報到 |
| POST /api/admin/events/[id]/check-in | registrationId，成功200 | Staff/Admin/Super Admin |
| GET /api/admin/events/[id]/export | 報名CSV，no-store，audit | Staff/Admin/Super Admin |

活動 payload：slug/title/summary/category/format/location/agenda[{time,title}]，startsAt/endsAt/registrationDeadline（含offset的ISO），status=DRAFT/PUBLISHED/CANCELLED/ARCHIVED，eligibility=ACCOUNT/MEMBER，capacity1..1000，registrationEnabled/waitlistEnabled。新增後slug固定。內容 JSON strict schema，上限32KiB；報到資料8KiB，報名／取消無需body，忽略caller提供的userId而始終使用session。Mutation驗Origin，所有資料頁與API重新驗最新角色，不依賴Layout。

報名受global flag／本機demo guard／公開狀態／截止与开始／實際Membership資格限制；未符合403、重複／額滿／已截止409。Event row lock + unique維持容量；候補最多1000人，先入先遞補，取消後重報取得新的queue sequence。截止後取消不遞補；帳號失效／資格到期的候補轉取消、記通知與歷程，再處理下一人。更改已報名活動的時間／資格、減少至不足已確認容量、直接改draft/archive會409；活動取消將所有active報名／候補一併取消。

報到窗口為開始前2小時至结束，僅CONFIRMED、未報到、當下帳號與會員資格仍有效；其他活动的registration404／重複409，CSV最高2000筆（413明示超限）。CSV以UTF-8 BOM+quote生成，公式開頭以apostrophe保護，含換行／引號也正確處理；只包含姓名／信箱／status／checkedIn，不含其他會員欄位。成功匯出留下EVENT_CSV_EXPORTED。

通知為站內，活動與資格均保留demo聲明；未提供正式費用／退款、QR、附件上傳、可靠email outbox，正式booking flag預設false。

# 帳號與會員資格 CSV

`GET /api/admin/members/export?q=<姓名或信箱>&state=all|enabled|disabled`，僅 Admin/Super Admin。未登入／停用／未驗證401，角色不足403。搜尋與後台列表共用正規化（trim、120字）；匯出全部符合條件的帳號，不受分頁影響。

最多1000筆，1001筆回413／EXPORT_TOO_LARGE，無截斷；查詢與 MEMBER_CSV_EXPORTED audit 在 RepeatableRead 交易內，失敗不留下成功紀錄。Audit 的 entityId 為操作者ID，不記搜尋詞或名單。UTF-8 BOM、CSV quoting、公式防護、attachment、no-store。包含帳號ID／姓名／信箱／驗證／角色／停用狀態／資格編號類別及啟用狀態／UTC起迄／示範性質，不含密碼、token、電話或備註。資格期限與帳號狀態分別呈現，不虛構正式資格有效性。

下載使用普通 anchor，避免 Next 預抓；HEAD 回405，不觸發查詢與稽核。大量分批匯出、單獨匯出通知／操作原因及耐久不可竄改 audit 未實作。

# 聯絡訊息 API

POST /api/contact：匿名、本站Origin、開關啟用；strict JSON上限16KiB，submissionId UUID、name2–60、email≤254且@example.test、topic GENERAL/PARTNERSHIP/ACTIVITY/MEMBERSHIP、subject2–120、message10–1500、consent=true、website空字串。只回201 {reference}，不回姓名信箱內容。相同ID內容重試回相同reference、不另建訊息或history；ID內容不符409。每IP10／每信箱3次/10分鐘持久化限流，429；invalid400、異Origin403、超大413、關閉503。重試也計入限流。

IP採x-forwarded-for最後一跳，必須由可信反向代理追加peer，網站容器只允許loopback對外映射；未取得有效IP共用unknown限流。多層代理/CDN需要重新確認trusted proxy設置，未宣稱完整抗bot/DoS。不存在公開GET／依ID查詢；不接受真實信箱、不寄送郵件。

PATCH /api/admin/contacts/[id]：Staff/Admin/Super Admin，本站Origin、8KiB strict JSON：version正整數、status NEW/IN_PROGRESS/RESOLVED/SPAM、assignment KEEP/CLAIM/RELEASE、note2–1000。CLAIM只能接手無負責人或本人訊息；RELEASE不能釋出別人訊息，衝突409，版本過期409，缺目標404。KEEP允許有權限的工作人員協作更新狀態，不改負責人。成功寫ContactMessageChange與CONTACT_UPDATED audit，無匿名auditactor。未登入401、Editor/Member403。

後台page每次query驗當前角色，搜尋限120字、每頁10筆、只顯示最近20筆歷程；notes僅工作人員可見，所有輸入作文字渲染。

# 首頁與協會介紹

PATCH /api/admin/pages/[key]，key=home|about，Editor/Admin/Super Admin；Origin、64KiB strict JSON、每次驗當前角色。SAVE/PUBLISH需{action,version>=0,content:{title2–160,description2–600,sections:[{id,heading2–120,body2–3000}]}}；RESTORE需{action,version>=1,revisionId UUID}。固定完整章節ID／順序：home=about/services/membership，about=intro/mission/history/team/documents/partners。未建立頁面version=0，首次儲存version=1；其後必須送目前version，衝突409。

交易advisory lock保持版本、draft、revision與PAGE_SAVED/PUBLISHED/RESTORED audit一致；PUBLISH才更新published與publishedAt，SAVE/RESTORE保留公開版本。RESTORE修訂必須屬於當前頁面，否則404，不接受其他頁面修訂；還原也新增版本。公開service不讀draft作輸出，只有沒有published的頁面用原始固定示範文字，不提供文章／活動DB故障fallback。

私人文字預覽與編輯頁皆重驗權限，內容以React文字渲染，不支援HTML／script／附件／圖片路徑。沒有公開寫入或私人草稿讀取API。metadata／圖片／導覽等尚非CMS欄位。

## 頁面CMS顯示控制擴充

content.sections新增optional visible:boolean，未指定視為true。about可調整完整六章順序與顯示，ID不能重複／遺漏，至少一章可見；home三章順序與顯示仍固定。intro隱藏也不移除正式法律資訊待確認提示，章節導覽只列可見章節。

home可新增optional hero:{image,alt,primary:{label,href},secondary:{label,href}}。image白名單hero/living/nutrition/mind四張內建SVG，alt2–160字，label1–30字，href只允許/about,/events,/news,/knowledge,/member,/contact；拒絕任意圖片／外連／執行型URL／API網址。about不能包含hero。舊revision缺新欄位仍可還原，home用heroDefaults。儲存／發布／版本／權限／稽核語義不變，無新資料表或migration。
