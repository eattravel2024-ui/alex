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

正式管理 UI、機器對機器 API token/OAuth、公眾 contact submission、event registration、CMS CRUD 尚未提供。本站 test types 只可在 DEVELOPMENT_MODE 使用；demo 核准不代表正式資格。
