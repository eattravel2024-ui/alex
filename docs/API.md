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

完整 CMS 管理 UI、機器對機器 API token/OAuth、公眾 contact submission、event registration、頁面／媒體 CMS CRUD 尚未提供。本站 test types 只可在 DEVELOPMENT_MODE 使用；demo 核准不代表正式資格。

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

文章 payload：slug、kind(news/knowledge)、title、summary、category、tags、image、author、featured、reviewedAt(nullable date)、blocks[{heading,paragraphs}]、references[{title,url}]、status(DRAFT/PUBLISHED/SCHEDULED/ARCHIVED)、publishAt(nullable ISO datetime)。status=PUBLISHED 立即發布，保留有效的過去 publishAt；SCHEDULED 必須提供未來時間。新增後 slug/kind 固定。API 不接受 isDemo／更新人／額外角色等字段；所有內容仍 isDemo=true。CMS body 上限 64 KiB，restore 維持8 KiB；Origin/Session/最新角色重新驗證。

重複 slug 或過期 version 回409；不合法來源／排程／改網址回400；無目標文章或修訂不屬於目標回404；未登入401／角色不足403。版本與修訂／audit 均為交易；還原 audit=ARTICLE_RESTORED，不自動發布。下架為 soft archive，无實體刪除端點。私人預覽與所有資料頁在查詢前重新驗權，不依賴 Layout。修訂頁顯示最近20版，未提供大量歷程匯出或 hard-delete。
