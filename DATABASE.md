# PostgreSQL 資料庫架構規劃

**Phase 3 已實作 prisma/schema.prisma 與初始 migration 的 13 個會員核心模型。以下完整平台模型仍為後續設計，不代表全部表已建立。** UUID 主鍵，UTC timestamptz，前台以 Asia/Taipei 顯示。金額用整數最小貨幣單位與 ISO currency，不用浮點数。

| 模型                                          | 主要欄位及關聯                                                                                 | 必要約束／索引                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| User                                          | email、passwordHash、emailVerifiedAt、disabledAt、createdAt                                    | normalizedEmail unique，createdAt index                           |
| Account / Session                             | provider identity / userId、tokenHash、expiresAt、revokedAt                                    | provider+account unique，tokenHash unique，userId+expiresAt index |
| VerificationToken                             | userId、purpose、tokenHash、expiresAt、usedAt                                                  | tokenHash unique，單次消耗                                        |
| Role / Permission / UserRole / RolePermission | 多對多權限關係                                                                                 | name unique，組合 PK                                              |
| MemberProfile                                 | userId、displayName、可選電話、隱私選項                                                        | userId unique；不預設醫療資訊                                     |
| MembershipType                                | code、name、ruleDescription、active                                                            | code unique；法定規則待確認                                       |
| Membership                                    | userId、typeId、memberNumber、status、validFrom、validUntil                                    | memberNumber unique，userId+status index                          |
| MembershipApplication                         | userId、typeId、status、補件資料、reviewerId、note                                             | userId+createdAt index；pending/returned 的 partial unique 防重複 |
| MembershipStatusHistory                       | membershipId/applicationId、from/to、actorId、reason                                           | 關聯 index；append-only                                           |
| Article / ArticleCategory                     | slug、locale、kind、title、body、status、publishAt、authorId、source、reviewedAt、coverMediaId | slug+locale unique；status+publishAt、category index              |
| Tag / ArticleTag / ArticleBookmark            | 多對多與 userId 收藏                                                                           | 組合 unique                                                       |
| Page / PageSection / Banner / NavigationItem  | slug、locale、content、SEO、enabled、sortOrder、schedule                                       | slug+locale unique，sortOrder index                               |
| Media                                         | storageKey、mime、size、ownerId、alt                                                           | storageKey unique；不存公開秘密                                   |
| Event                                         | slug、title、startsAt、endsAt、capacity、deadline、eligibility、feeMinor、currency             | slug unique；時間與容量 CHECK；startsAt index                     |
| EventRegistration                             | eventId、userId、status、waitlistPosition、cancelledAt                                         | eventId+userId unique；eventId+status index                       |
| EventAttendance                               | registrationId、checkedInAt、staffId                                                           | registrationId unique                                             |
| Course / CourseEnrollment                     | eventId 可選、教材、userId、progress、completedAt                                              | courseId+userId unique                                            |
| Certificate                                   | userId、type、eventId/courseId、verificationHash、issuedAt、revokedAt                          | verificationHash unique                                           |
| Payment                                       | userId、membershipId/registrationId、amountMinor、currency、status、providerRef、reviewerId    | providerRef unique（非 null）；禁止未確認 payment=paid            |
| Notification / EmailOutbox                    | userId、type、readAt；寄送 payload、attempts、status                                           | userId+readAt index；idempotencyKey unique                        |
| ContactSubmission                             | name、email、message、status、assigneeId、internalNote                                         | status+createdAt index                                            |
| NewsletterSubscriber                          | normalizedEmail、status、consentAt、tokenHash                                                  | normalizedEmail unique；double opt-in                             |
| SiteSetting                                   | key、locale、validatedValue                                                                    | key+locale unique；SMTP secret 不存公開 CMS                       |
| AuditLog                                      | actorId、action、entityType/id、redactedDiff、createdAt                                        | actorId+createdAt、entityType+id index；append-only               |

## 交易與權限

- 申請核准、Membership 建立、歷程、Audit Log、通知 outbox 同一交易；並使用版本／行鎖避免重複核准。
- 報名對 Event 取得行鎖，在交易內检查名額、資格、截止與唯一性；取消後依序遞補，避免超賣。
- Better Auth Session 使用框架管理的 opaque token（DB 受限制，不回傳於會員資料 API）；重設 verification identifier 使用 hash。Email verification 由成熟框架管理簽章與期限，重設 token 單次消耗；密碼重設成功失效所有 sessions。
- 刪除 user：依法定保留理由處理；session/bookmark 可 cascade，帳務／稽核 restrict 或去識別，不任意刪除歷史。
- 角色：Super Admin 全部；Admin 內容／會員／活動／報表；Editor 僅內容；Staff 申請／報名／訊息；Member 僅自身資料。所有讀寫於 service 驗權。

## Migration / Seed / 保留

Phase 3 使用 Prisma migration 與可重複的測試 seed，所有示範紀錄加 isDemo 或來源標記。正式環境禁用預設管理員／共用密碼 seed。migration 在乾淨 DB 與升級 DB 測試。備份採加密每日 dump + 定期還原演練；RPO/RTO 與保留期限待營運確認。政策確認前不蒐集真實會員資料。

## 已建立的資料模型與差異

User、Session、Account、Verification、RateLimit、MemberProfile、MembershipType、MembershipApplication、Membership、MembershipStatusHistory、Notification、ArticleBookmark、AuditLog 已建立。Role 暫以 enum 覆蓋五種角色；Role/Permission 多對多與頁面 CMS／course／payment 模型在後續階段。

Better Auth 密碼 hash 在 Account.password，User 保存 emailVerified、停用、server-owned role、條款/隱私同意時間與版本。Session token 屬敏感 DB 資料，會員 API 不暴露它；IP/user-agent 不寫入 Session。框架限流 key 可能含 IP，額外 per-account key 以 email 的 SHA-256 作識別，資料保留/定期清理留待正式營運政策。

ArticleBookmark 保存不可變的文章 slug，service 驗證目前文章可見；下架仍可取消收藏。尚未改為 Article FK，文章只做軟下架、不提供實體刪除或改網址，歷史 slug 保留。申請使用 uuid，history 與 audit 不做任意 cascade 刪除。Membership.isDemo 與 DEMO- 編號明確區分測試核准；user 註冊不建立 Membership。

`20261013000100_phase3_membership/migration.sql` 由官方 Prisma WASM diff 產生，補上 partial unique 與業務 CHECK。套用由同版本 Prisma migration engine 管理 `_prisma_migrations` 的 checksum，不是 db push 或手工假冒 migration 記錄。

## Phase 4 文章模型

新增 ArticleRecord／ArticleRevision，目前共 15 個 models。ArticleRecord 具 unique slug、kind/status enum、category/tags、title/summary/searchText、JSON blocks/references、publishAt、version、更新人 FK 與 isDemo。kind+status+publishAt、category+kind 索引，tags GIN；version 正值與可發布狀態必須有 publishAt 的 CHECK。ArticleRevision 保存完整驗證過的內容與狀態快照，articleId+version unique、article/actor Restrict FK。

增量 SQL migration 由鎖定版本 Prisma WASM schema-to-schema diff 產生並檢閱，僅新增 CMS tables/enums/indexes/constraints，不修改 Phase 3 migration 或移除會員約束。WASM createMigration shadow factory 在本版本不支援；development helper 明確要求先前 schema 檔，只產生 SQL，人工檢閱後再 apply，沒有 reset 或假造 migration history。不能用來宣稱完成 drift 檢查或正式 migration 工具驗收。

開發 seed 匯入九篇文章，只做 ON CONFLICT DO NOTHING；新增文章第一次建立即有 revision，原 seed 文章由首次保存開始記錄後續修訂。排程不需要 DB status 轉換 job：SCHEDULED + publishAt<=now 即可見；UI 會標示已生效。

## Phase 4 活動模型

新增 EventRecord、EventRegistration、EventRegistrationChange，共18 models。EventRecord unique slug、status/eligibility enum、三個 timestamptz 時间、capacity／候補／報名開關、version、isDemo、更新人FK。CHECK限制 endsAt>startsAt、deadline<=startsAt、capacity1..1000及version>0；status+startsAt與category+status索引。

EventRegistration eventId+userId unique、queueOrder BIGSERIAL unique、eventId+status+queueOrder／userId+createdAt索引；checkedInAt／checkedInById 同時空或同時非空。報名對 user/event Restrict，報到人 user Restrict；Change 保存每次狀態、原因、操作者与时间，不刪除歷史。沒有保存付款、保健資料或 Session token。

第三個 migration 第一次因 Pg adapter 的簡易分號拆分誤讀 SQL 註解而失敗。已確認本次新建的三表全部0 rows，僅移除這三張空表及其新 enum，使用官方 engine.markMigrationRolledBack 標記失败，保留失敗紀錄；修正註解後正式apply及重跑成功。既有會員／文章資料、migration checksums與業務約束未重置。對此 adapter 的 migration SQL 註解不可使用分號，複雜函式／字串需正式 native tooling；未宣稱完全 SQL parser。

## 聯絡示範資料

第四個 migration phase4_contacts 增加 ContactMessage／ContactMessageChange，共20模型。訊息ID由客户端一次提交UUID提供，重試在 advisory transaction lock 下核對完全相同的正規化內容，避免重複資料；不公開訊息查詢。ContactMessage保存同意版本／時間與version；CHECK要求version>0、isDemo=true、信箱以@example.test結尾。狀態NEW/IN_PROGRESS/RESOLVED/SPAM，status+createdAt與assignedToId+status索引。

assignedTo User FK刪除SET NULL；Change contact/actor FK Restrict。歷程的assignedToId是當次快照，沒有現存User FK，用於保留原指派識別碼。更新contact row lock，版本檢查後同交易保存訊息／Change／AuditLog，內部note不放入公開回應與AuditLog。沒有正式保留政策、自動刪除或hard-delete端點。示範seed不建立聯絡訊息。
