import test from "node:test";
import assert from "node:assert/strict";
import { contactSchema, contactUpdateSchema } from "../../src/lib/contact-validation.ts";
const valid = {
  submissionId: "550e8400-e29b-41d4-a716-446655440000",
  name: "示範訪客", email: "visitor@example.test", topic: "GENERAL",
  subject: "示範詢問", message: "這是至少十字的虛構示範訊息內容", consent: true, website: "",
};
test("聯絡提交只接受已同意的虛構資料且拒絕隱藏角色／狀態欄位", () => {
  assert.equal(contactSchema.safeParse(valid).success, true);
  for (const changes of [{ email: "real@example.com" }, { consent: false }, { website: "bot" }, { status: "RESOLVED" }, { assignedToId: valid.submissionId }, { message: "短" }, { topic: "OTHER" }, { message: "字".repeat(1501) }])
    assert.equal(contactSchema.safeParse({ ...valid, ...changes }).success, false);
  assert.equal(contactSchema.parse({ ...valid, email: "Visitor@EXAMPLE.TEST" }).email, "visitor@example.test");
});
test("聯絡處理需要版本、受限指派操作與內部說明", () => {
  const value = { version: 1, status: "IN_PROGRESS", assignment: "CLAIM", note: "接手處理" };
  assert.equal(contactUpdateSchema.safeParse(value).success, true);
  for (const changes of [{ version: 0 }, { assignedToId: valid.submissionId }, { assignment: "OTHER" }, { status: "DELETED" }, { note: "" }])
    assert.equal(contactUpdateSchema.safeParse({ ...value, ...changes }).success, false);
});
