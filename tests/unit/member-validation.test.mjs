import test from "node:test";
import assert from "node:assert/strict";
import {
  passwordSchema,
  registrationSchema,
  profileSchema,
  applicationSchema,
  reviewSchema,
} from "../../src/lib/validation.ts";
test("密碼與條款驗證不可只靠前端", () => {
  for (const password of ["short12", "abcdefghijklmnop", "123456789012345"])
    assert.equal(passwordSchema.safeParse(password).success, false);
  assert.equal(passwordSchema.safeParse("Abcd1234").success, true);
  assert.equal(passwordSchema.safeParse("This-is-a-test-123").success, true);
  assert.equal(
    registrationSchema.safeParse({
      name: "測試",
      email: "account@example.test",
      password: "This-is-a-test-123",
      termsAccepted: false,
      privacyAccepted: true,
    }).success,
    false,
  );
});
test("個人資料拒絕角色與他人 ID；電話不強制收集", () => {
  assert.equal(
    profileSchema.safeParse({
      name: "測試用戶",
      phone: "",
      emailNotifications: false,
    }).success,
    true,
  );
  assert.equal(
    profileSchema.safeParse({
      name: "測試用戶",
      phone: "",
      emailNotifications: false,
      role: "SUPER_ADMIN",
      userId: "other",
    }).success,
    false,
  );
});
test("申請及審核資料驗證 UUID、字數及版本", () => {
  assert.equal(
    applicationSchema.safeParse({ typeId: "not-an-id", motivation: "說明" })
      .success,
    false,
  );
  assert.equal(
    reviewSchema.safeParse({ status: "APPROVED", note: "核准測試", version: 0 })
      .success,
    false,
  );
  assert.equal(
    reviewSchema.safeParse({ status: "RETURNED", note: "請補件", version: 1 })
      .success,
    true,
  );
});
