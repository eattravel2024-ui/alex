import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createVerified, sql } from "./auth-helpers";
const origin = "http://127.0.0.1:3000";
const elevatedActors: string[] = [];
test.afterEach(async () => {
  for (const id of elevatedActors.splice(0))
    await sql("UPDATE \"User\" SET role='MEMBER' WHERE id=$1", [id]);
});

test("後台各角色的頁面與 API 權限、個資隔離", async ({ page, request }) => {
  const actor = await createVerified(page.request);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "無法使用管理後台" }),
  ).toBeVisible();
  const target = await createVerified(request);
  elevatedActors.push(actor.id);
  for (const role of ["MEMBER", "EDITOR", "STAFF", "ADMIN", "SUPER_ADMIN"]) {
    await sql('UPDATE "User" SET role=$1 WHERE id=$2', [role, actor.id]);
    await page.goto("/admin/members?q=" + encodeURIComponent(target.address));
    const allowed = role === "ADMIN" || role === "SUPER_ADMIN";
    if (allowed)
      await expect(page.locator(".admin-record")).toContainText(target.address);
    else await expect(page.locator(".admin-record")).toHaveCount(0);
    const result = await page.request.patch(
      "/api/admin/members/" + randomUUID(),
      {
        headers: { origin },
        data: { disabled: true, expectedDisabled: false, note: "權限測試" },
      },
    );
    expect(result.status()).toBe(allowed ? 404 : 403);
    const csv = await page.request.get("/api/admin/members/export?q=" + encodeURIComponent(target.address));
    expect(csv.status()).toBe(allowed ? 200 : 403);
    if (allowed) {
      expect(await csv.text()).toContain(target.address);
      expect(csv.headers()["cache-control"]).toBe("no-store");
    }
    await page.goto("/admin/audit");
    if (role === "SUPER_ADMIN")
      await expect(
        page.getByRole("heading", { name: "稽核紀錄", exact: true }),
      ).toBeVisible();
    else await expect(page.locator(".admin-record")).toHaveCount(0);
    await page.goto("/admin/applications");
    if (["ADMIN", "STAFF", "SUPER_ADMIN"].includes(role))
      await expect(
        page.getByRole("button", { name: "查詢申請" }),
      ).toBeVisible();
    else
      await expect(page.getByRole("button", { name: "查詢申請" })).toHaveCount(
        0,
      );
  }
  await sql("UPDATE \"User\" SET role='MEMBER' WHERE id=$1", [actor.id]);
});

test("帳號CSV篩選、資格、公式防護、下載與稽核，不洩漏私人欄位", async ({ page, request }) => {
  expect((await request.get("/api/admin/members/export")).status()).toBe(401);
  const admin = await createVerified(page.request);
  const member = await createVerified(request);
  elevatedActors.push(admin.id);
  await sql("UPDATE \"User\" SET role='ADMIN' WHERE id=$1", [admin.id]);
  await sql('UPDATE "User" SET name=$1 WHERE id=$2', [' =HYPERLINK("https://invalid.example")\n測試', member.id]);
  const type = (await sql("SELECT id FROM \"MembershipType\" WHERE code='DEMO_PERSONAL'"))[0];
  const memberNumber = "CSV-" + randomUUID();
  await sql('INSERT INTO "Membership" (id,"userId","typeId","memberNumber","validFrom","validUntil","isDemo") VALUES ($1,$2,$3,$4,now(),$5,true)', [randomUUID(), member.id, type.id, memberNumber, "2099-12-31T00:00:00Z"]);
  const path = "/api/admin/members/export?q=" + encodeURIComponent(member.address);
  const result = await page.request.get(path + "&state=enabled");
  expect(result.status()).toBe(200);
  expect(result.headers()["content-type"]).toContain("text/csv");
  expect(result.headers()["content-disposition"]).toContain("attachment");
  const text = await result.text();
  expect(text).toContain(member.address);
  expect(text).not.toContain(admin.address);
  expect(text).toContain('"\' =HYPERLINK(""https://invalid.example"")\n測試"');
  expect(text).toContain(memberNumber);
  expect(text).toContain("示範資格（無正式效力）");
  expect(text).not.toContain(member.secret);
  expect(text).not.toContain("password");
  expect(await (await page.request.get(path + "&state=disabled")).text()).not.toContain(member.address);
  await page.goto("/admin/members?q=" + encodeURIComponent(member.address) + "&state=enabled");
  const before = (await sql('SELECT id FROM "AuditLog" WHERE "actorId"=$1 AND action=\'MEMBER_CSV_EXPORTED\'', [admin.id])).length;
  expect((await page.request.head(path)).status()).toBe(405);
  const link = page.getByRole("link", { name: "匯出目前查詢 CSV" });
  await expect(link).toHaveAttribute("href", path + "&state=enabled");
  const download = page.waitForEvent("download");
  await link.click();
  expect((await download).suggestedFilename()).toBe("member-accounts.csv");
  expect((await sql('SELECT id FROM "AuditLog" WHERE "actorId"=$1 AND action=\'MEMBER_CSV_EXPORTED\'', [admin.id])).length).toBe(before + 1);
  await sql('UPDATE "User" SET disabled=true WHERE id=$1', [admin.id]);
  try {
    expect((await page.request.get(path)).status()).toBe(401);
  } finally {
    await sql('UPDATE "User" SET disabled=false WHERE id=$1', [admin.id]);
  }
});

test("帳號CSV超限明確拒絕、不截斷且失敗不寫匯出稽核", async ({ page }) => {
  const admin = await createVerified(page.request);
  elevatedActors.push(admin.id);
  await sql("UPDATE \"User\" SET role='ADMIN' WHERE id=$1", [admin.id]);
  const prefix = "csv-limit-" + randomUUID();
  const path = "/api/admin/members/export?q=" + prefix;
  const ids = await sql('INSERT INTO "User" (id,name,email,"updatedAt") SELECT gen_random_uuid(),$1,$1 || n::text || \'@example.test\',now() FROM generate_series(1,1001) n RETURNING id', [prefix]);
  try {
    const large = await page.request.get(path);
    expect(large.status()).toBe(413);
    expect((await large.json()).error.code).toBe("EXPORT_TOO_LARGE");
    expect((await sql('SELECT id FROM "AuditLog" WHERE "actorId"=$1 AND action=\'MEMBER_CSV_EXPORTED\'', [admin.id])).length).toBe(0);
    await sql('DELETE FROM "User" WHERE id=$1', [ids[0].id]);
    const bounded = await page.request.get(path);
    expect(bounded.status()).toBe(200);
    expect((await bounded.text()).trim().split("\r\n")).toHaveLength(1001);
    expect((await sql('SELECT id FROM "AuditLog" WHERE "actorId"=$1 AND action=\'MEMBER_CSV_EXPORTED\'', [admin.id])).length).toBe(1);
  } finally {
    await sql('DELETE FROM "User" WHERE id=ANY($1::uuid[])', [ids.map((r) => r.id)]);
  }
});

test("帳號停權 UI、撤銷登入、版本衝突、恢復與稽核交易", async ({
  page,
  request,
}) => {
  const admin = await createVerified(page.request),
    member = await createVerified(request);
  elevatedActors.push(admin.id);
  await sql("UPDATE \"User\" SET role='SUPER_ADMIN' WHERE id=$1", [admin.id]);
  await page.goto("/admin/members?q=" + encodeURIComponent(member.address));
  const card = page.locator(".admin-record");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await card.getByText("管理帳號狀態", { exact: true }).click();
  await card
    .getByLabel("操作原因（會員可查看）")
    .fill("測試停用，請勿提供真實資料");
  await card.getByRole("checkbox").check();
  await card.getByRole("button", { name: "停用帳號", exact: true }).click();
  await expect(card.getByRole("heading")).toContainText("已停用");
  expect((await request.get("/api/me")).status()).toBe(401);
  expect(
    (await sql('SELECT id FROM "Session" WHERE "userId"=$1', [member.id]))
      .length,
  ).toBe(0);
  const stale = await page.request.patch("/api/admin/members/" + member.id, {
    headers: { origin },
    data: { disabled: true, expectedDisabled: false, note: "重複操作測試" },
  });
  expect(stale.status()).toBe(409);
  const badOrigin = await page.request.patch(
    "/api/admin/members/" + member.id,
    {
      headers: { origin: "https://invalid.example" },
      data: { disabled: false, expectedDisabled: true, note: "無效來源" },
    },
  );
  expect(badOrigin.status()).toBe(403);
  const privileged = await page.request.patch(
    "/api/admin/members/" + admin.id,
    {
      headers: { origin },
      data: { disabled: true, expectedDisabled: false, note: "管理角色保護" },
    },
  );
  expect(privileged.status()).toBe(403);
  if (!(await card.getByLabel("操作原因（會員可查看）").isVisible()))
    await card.getByText("管理帳號狀態", { exact: true }).click();
  await card.getByLabel("操作原因（會員可查看）").fill("測試恢復帳號");
  await card.getByRole("checkbox").check();
  await card.getByRole("button", { name: "恢復帳號", exact: true }).click();
  await expect(card.getByRole("heading")).toContainText("啟用中");
  const actions = await sql(
    'SELECT action FROM "AuditLog" WHERE "entityId"=$1 AND "actorId"=$2 ORDER BY "createdAt"',
    [member.id, admin.id],
  );
  expect(actions.map((r) => r.action)).toEqual([
    "MEMBER_DISABLED",
    "MEMBER_ENABLED",
  ]);
  expect(
    (await sql('SELECT id FROM "Notification" WHERE "userId"=$1', [member.id]))
      .length,
  ).toBe(2);
  await page.goto("/admin/audit?action=MEMBER_DISABLED");
  await expect(
    page.locator(".admin-record").filter({ hasText: member.id }),
  ).toHaveCount(1);
  await sql("UPDATE \"User\" SET role='MEMBER' WHERE id=$1", [admin.id]);
});

test("後台申請核准 UI 與真實會員、通知、歷程", async ({ page, request }) => {
  const admin = await createVerified(page.request),
    applicant = await createVerified(request);
  elevatedActors.push(admin.id);
  await sql("UPDATE \"User\" SET role='STAFF' WHERE id=$1", [admin.id]);
  const types = await sql(
    "SELECT id FROM \"MembershipType\" WHERE code='DEMO_PERSONAL'",
  );
  const response = await request.post("/api/membership/applications", {
    headers: { origin },
    data: { typeId: types[0].id, motivation: "這是後台審核流程的開發測試申請" },
  });
  expect(response.status()).toBe(201);
  const application = await response.json();
  await page.goto(
    "/admin/applications?q=" + encodeURIComponent(applicant.address),
  );
  const card = page.locator(".admin-record");
  await card.getByLabel("審核結果").selectOption("APPROVED");
  await card.getByLabel("有效期限（台灣時間）").fill("2099-12-31");
  await card
    .getByLabel("審核說明（會員可查看）")
    .fill("開發示範核准，無正式會員效力");
  await card.getByRole("button", { name: "送出審核" }).click();
  await expect(page.getByText("沒有符合條件的申請。")).toBeVisible();
  await page.goto(
    "/admin/applications?status=APPROVED&q=" +
      encodeURIComponent(applicant.address),
  );
  await expect(
    page.locator(".admin-record").getByRole("heading"),
  ).toContainText("核准");
  const memberships = await sql(
    'SELECT "isDemo", "validUntil" FROM "Membership" WHERE "userId"=$1',
    [applicant.id],
  );
  expect(memberships).toHaveLength(1);
  expect(memberships[0].isDemo).toBe(true);
  expect(new Date(memberships[0].validUntil).toISOString()).toBe(
    "2099-12-31T15:59:59.000Z",
  );
  expect(
    (
      await sql(
        'SELECT id FROM "MembershipStatusHistory" WHERE "applicationId"=$1 AND "toStatus"=\'APPROVED\'',
        [application.id],
      )
    ).length,
  ).toBe(1);
  await sql("UPDATE \"User\" SET role='MEMBER' WHERE id=$1", [admin.id]);
});

test("本機管理員初始化只提升已驗證帳號，可重跑且拒絕正式環境", async ({
  request,
}) => {
  const { execFileSync } = await import("node:child_process");
  const actor = await createVerified(request);
  elevatedActors.push(actor.id);
  const first = execFileSync(
    process.execPath,
    ["scripts/dev-admin.mjs", actor.address],
    { encoding: "utf8" },
  );
  expect(first).toContain("audit record written");
  const second = execFileSync(
    process.execPath,
    ["scripts/dev-admin.mjs", actor.address],
    { encoding: "utf8" },
  );
  expect(second).toContain("already configured");
  expect(
    (await sql('SELECT role FROM "User" WHERE id=$1', [actor.id]))[0].role,
  ).toBe("SUPER_ADMIN");
  expect(
    (
      await sql(
        'SELECT id FROM "AuditLog" WHERE "entityId"=$1 AND action=\'DEV_ADMIN_BOOTSTRAPPED\'',
        [actor.id],
      )
    ).length,
  ).toBe(1);
  expect(() =>
    execFileSync(process.execPath, ["scripts/dev-admin.mjs", actor.address], {
      env: { ...process.env, DEVELOPMENT_MODE: "false" },
      stdio: "pipe",
    }),
  ).toThrow();
  await sql("UPDATE \"User\" SET role='MEMBER' WHERE id=$1", [actor.id]);
});
