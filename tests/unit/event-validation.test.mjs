import test from "node:test";
import assert from "node:assert/strict";
import { eventSchema, emptyEvent } from "../../src/lib/event-validation.ts";
import { csvCell, csvRows } from "../../src/lib/csv.ts";
const valid = {
  ...emptyEvent,
  slug: "sample-event",
  title: "示範活動",
  summary: "安全的示範活動介紹",
  startsAt: "2030-01-01T14:00:00+08:00",
  endsAt: "2030-01-01T16:00:00+08:00",
  registrationDeadline: "2030-01-01T12:00:00+08:00",
  agenda: [],
};
test("活動時間、名額與未知權限欄位必須由伺服器驗證", () => {
  assert.equal(eventSchema.safeParse(valid).success, true);
  for (const changes of [
    { capacity: 0 },
    { capacity: 1001 },
    { endsAt: valid.startsAt },
    { registrationDeadline: "2030-01-01T15:00:00+08:00" },
    { isDemo: false },
    { eligibility: "SUPER_ADMIN" },
  ])
    assert.equal(
      eventSchema.safeParse({ ...valid, ...changes }).success,
      false,
    );
});
test("CSV 引號／換行保留且試算表公式不會直接執行", () => {
  for (const value of [
    "=SUM(A1)",
    "+cmd",
    "-cmd",
    "@SUM(A1)",
    "\t=cmd",
    "\u0001=cmd",
  ])
    assert.equal(csvCell(value), "\"'" + value + '"');
  assert.equal(csvCell('正常,"名稱"'), '"正常,""名稱"""');
  assert.equal(
    csvRows([["正常", "多行\n內容"]]),
    '\uFEFF"正常","多行\n內容"\r\n',
  );
});
