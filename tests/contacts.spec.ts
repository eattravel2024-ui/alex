import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createVerified, sql, clientAddress } from "./auth-helpers";
const origin = "http://127.0.0.1:3000";
const contacts: string[] = [], actors: string[] = [];
function input() {
  const submissionId = randomUUID(); contacts.push(submissionId);
  return { submissionId, name: "虛構測試訪客", email: `contact-${submissionId}@example.test`, topic: "GENERAL", subject: "虛構詢問", message: "這是測試訊息，不包含任何真實個人資料。", consent: true, website: "" };
}
test.afterEach(async () => {
  for (const id of contacts.splice(0)) {
    await sql('DELETE FROM "ContactMessageChange" WHERE "contactId"=$1', [id]);
    await sql('DELETE FROM "ContactMessage" WHERE id=$1', [id]);
  }
  for (const id of actors.splice(0)) await sql("UPDATE \"User\" SET role='MEMBER' WHERE id=$1", [id]);
});

test("訪客聯絡表單驗證、成功儲存與收件編號、不寄送郵件", async ({ page }) => {
  const data = input();
  await page.goto("/contact");
  await page.getByLabel("示範姓名").fill(data.name);
  await page.getByLabel("示範電子郵件").fill("visitor@example.com");
  await page.getByLabel("主旨", { exact: true }).fill(data.subject);
  await page.getByLabel("訊息內容").fill(data.message);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "送出示範訊息" }).click();
  await expect(page.getByRole("status")).toContainText("@example.test");
  await page.getByLabel("示範電子郵件").fill(data.email);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": clientAddress(page.request) });
  const submitted = page.waitForResponse((r) => r.url().endsWith("/api/contact") && r.request().method() === "POST");
  await page.getByRole("button", { name: "送出示範訊息" }).click();
  const response = await submitted;
  expect(response.status()).toBe(201);
  const { reference } = await response.json(); contacts.push(reference);
  await expect(page.getByRole("status")).toContainText(reference);
  await expect(page.getByRole("status")).toContainText("不會寄送通知郵件");
  const row = (await sql('SELECT * FROM "ContactMessage" WHERE id=$1', [reference]))[0];
  expect(row.email).toBe(data.email); expect(row.message).toBe(data.message);
  expect(row.consentVersion).toBe("contact-demo-v1"); expect(row.isDemo).toBe(true);
  expect(await sql('SELECT id FROM "ContactMessageChange" WHERE "contactId"=$1', [reference])).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("聯絡API防偽造、蜜罐、大小限制、同次重試去重與無公開查詢", async ({ request }) => {
  const data = input();
  const headers = { origin, "x-forwarded-for": clientAddress(request) };
  expect((await request.post("/api/contact", { headers: { origin: "https://invalid.example" }, data })).status()).toBe(403);
  for (const patch of [{ consent: false }, { website: "spam" }, { email: "real@example.com" }, { role: "ADMIN" }])
    expect((await request.post("/api/contact", { headers, data: { ...data, ...patch } })).status()).toBe(400);
  expect((await request.post("/api/contact", { headers, data: { ...data, message: "x".repeat(17000) } })).status()).toBe(413);
  const responses = await Promise.all([1, 2].map(() => request.post("/api/contact", { headers, data })));
  for (const result of responses) expect(result.status()).toBe(201);
  expect(await sql('SELECT id FROM "ContactMessage" WHERE id=$1', [data.submissionId])).toHaveLength(1);
  expect(await sql('SELECT id FROM "ContactMessageChange" WHERE "contactId"=$1', [data.submissionId])).toHaveLength(1);
  expect((await request.post("/api/contact", { headers, data: { ...data, subject: "變更的內容" } })).status()).toBe(409);
  expect((await request.get("/api/contact")).status()).toBe(405);
  expect((await request.get("/api/contact/" + data.submissionId)).status()).toBe(404);
  expect((await request.patch("/api/admin/contacts/" + data.submissionId, { headers, data: { version: 1, status: "RESOLVED", assignment: "KEEP", note: "未登入" } })).status()).toBe(401);
});

test("聯絡限流使用最後代理IP、信箱限流跨IP仍生效", async ({ request }) => {
  const actual = clientAddress(request);
  for (let i = 0; i < 11; i++) {
    const result = await request.post("/api/contact", { headers: { origin, "x-forwarded-for": `198.19.0.${i + 1}, ${actual}` }, data: input() });
    expect(result.status()).toBe(i < 10 ? 201 : 429);
  }
  const sameEmail = `rate-${randomUUID()}@example.test`;
  for (let i = 0; i < 4; i++) {
    const bytes = randomUUID().slice(0, 4);
    const result = await request.post("/api/contact", { headers: { origin, "x-forwarded-for": `198.18.${parseInt(bytes.slice(0, 2), 16)}.${parseInt(bytes.slice(2), 16)}` }, data: { ...input(), email: sameEmail } });
    expect(result.status()).toBe(i < 3 ? 201 : 429);
  }
});

test("聯絡後台角色隔離、安全文字與接手／結案歷程、版本衝突", async ({ page, request }) => {
  const data = { ...input(), subject: '<img src=x onerror="alert(1)">', message: "<script>window.contactXss=true</script> 這是虛構測試內容" };
  expect((await request.post("/api/contact", { headers: { origin, "x-forwarded-for": clientAddress(request) }, data })).status()).toBe(201);
  const actor = await createVerified(page.request); actors.push(actor.id);
  const path = "/api/admin/contacts/" + data.submissionId;
  for (const role of ["MEMBER", "EDITOR", "STAFF", "ADMIN", "SUPER_ADMIN"]) {
    await sql('UPDATE "User" SET role=$1 WHERE id=$2', [role, actor.id]);
    const allowed = ["STAFF", "ADMIN", "SUPER_ADMIN"].includes(role);
    await page.goto("/admin/contacts?q=" + encodeURIComponent(data.email));
    await expect(page.locator(".admin-record")).toHaveCount(allowed ? 1 : 0);
    const invalidId = await page.request.patch("/api/admin/contacts/" + randomUUID(), { headers: { origin }, data: { version: 1, status: "IN_PROGRESS", assignment: "CLAIM", note: "權限測試" } });
    expect(invalidId.status()).toBe(allowed ? 404 : 403);
  }
  expect(await page.evaluate(() => "contactXss" in window)).toBe(false);
  expect(await page.locator(".admin-record img, .admin-record script").count()).toBe(0);
  const card = page.locator(".admin-record");
  await card.getByText("處理訊息", { exact: true }).click();
  await card.getByLabel("處理狀態").selectOption("IN_PROGRESS");
  await card.getByLabel("負責人操作").selectOption("CLAIM");
  await card.getByLabel("內部處理說明").fill("接手測試訊息，不寄送郵件");
  await card.getByRole("button", { name: "儲存處理紀錄" }).click();
  await expect(page.getByText("沒有符合條件的訊息。")).toBeVisible();
  await page.goto("/admin/contacts?status=IN_PROGRESS&assigned=mine&q=" + encodeURIComponent(data.email));
  await expect(page.locator(".admin-record")).toHaveCount(1);
  const row = (await sql('SELECT version,"assignedToId" FROM "ContactMessage" WHERE id=$1', [data.submissionId]))[0];
  expect(row.version).toBe(2); expect(row.assignedToId).toBe(actor.id);
  const stale = await page.request.patch(path, { headers: { origin }, data: { version: 1, status: "RESOLVED", assignment: "KEEP", note: "過期更新" } });
  expect(stale.status()).toBe(409);
  const bad = await page.request.patch(path, { headers: { origin: "https://invalid.example" }, data: { version: 2, status: "RESOLVED", assignment: "KEEP", note: "來源測試" } });
  expect(bad.status()).toBe(403);
  const second = await createVerified(request); actors.push(second.id);
  await sql("UPDATE \"User\" SET role='STAFF' WHERE id=$1", [second.id]);
  const takeover = await request.patch(path, { headers: { origin }, data: { version: 2, status: "IN_PROGRESS", assignment: "CLAIM", note: "搶接手測試" } });
  expect(takeover.status()).toBe(409);
  const done = await page.request.patch(path, { headers: { origin }, data: { version: 2, status: "RESOLVED", assignment: "RELEASE", note: "示範結案，不代表已回覆郵件" } });
  expect(done.status()).toBe(200);
  const final = (await sql('SELECT status,version,"assignedToId" FROM "ContactMessage" WHERE id=$1', [data.submissionId]))[0];
  expect(final.status).toBe("RESOLVED"); expect(final.version).toBe(3); expect(final.assignedToId).toBe(null);
  expect(await sql('SELECT id FROM "ContactMessageChange" WHERE "contactId"=$1', [data.submissionId])).toHaveLength(3);
  expect(await sql('SELECT id FROM "AuditLog" WHERE "entityId"=$1 AND action=\'CONTACT_UPDATED\'', [data.submissionId])).toHaveLength(2);
});

test("關閉聯絡開關時公開頁面與API一致拒絕提交", async ({ request }) => {
  const { spawn } = await import("node:child_process");
  const { createServer } = await import("node:net");
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const otherOrigin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["scripts/start.mjs"], {
    env: { ...process.env, CONTACT_SUBMISSIONS_ENABLED: "false", HOSTNAME: "127.0.0.1", PORT: String(port), BETTER_AUTH_URL: otherOrigin },
    stdio: "ignore",
  });
  try {
    await expect.poll(async () => {
      try { return (await request.get(otherOrigin + "/contact")).status(); } catch { return 0; }
    }, { timeout: 15000 }).toBe(200);
    expect(await (await request.get(otherOrigin + "/contact")).text()).toContain("示範聯絡表單尚未開放");
    expect((await request.post(otherOrigin + "/api/contact", { headers: { origin: otherOrigin }, data: input() })).status()).toBe(503);
  } finally {
    if (child.exitCode === null) {
      const stopped = new Promise<void>((resolve) => child.once("exit", () => resolve()));
      child.kill("SIGTERM"); await stopped;
    }
  }
});
