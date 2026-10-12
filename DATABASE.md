# PostgreSQL 資料庫架構規劃

**此文件為 Phase 3 實作依據，尚無 Prisma schema、migration 或資料庫功能；不得宣稱已完成。** UUID 主鍵，UTC timestamptz，前台以 Asia/Taipei 顯示。金額用整數最小貨幣單位與 ISO currency，不用浮點数。

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
- Session 与 reset token 只存 hash；密碼重設成功失效既有 sessions。
- 刪除 user：依法定保留理由處理；session/bookmark 可 cascade，帳務／稽核 restrict 或去識別，不任意刪除歷史。
- 角色：Super Admin 全部；Admin 內容／會員／活動／報表；Editor 僅內容；Staff 申請／報名／訊息；Member 僅自身資料。所有讀寫於 service 驗權。

## Migration / Seed / 保留

Phase 3 使用 Prisma migration 與可重複的測試 seed，所有示範紀錄加 isDemo 或來源標記。正式環境禁用預設管理員／共用密碼 seed。migration 在乾淨 DB 與升級 DB 測試。備份採加密每日 dump + 定期還原演練；RPO/RTO 與保留期限待營運確認。政策確認前不蒐集真實會員資料。
