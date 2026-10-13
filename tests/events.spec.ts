import { test, expect, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createVerified, sql } from "./auth-helpers";
import { emptyEvent } from "../src/lib/event-validation";
const origin = "http://127.0.0.1:3000",
  eventIds: string[] = [],
  actors: string[] = [];
function event() {
  return {
    ...emptyEvent,
    slug: "event-" + randomUUID(),
    title: "開發測試活動 " + randomUUID(),
    summary: "這是虛構活動的開發測試介紹，不實際舉辦。",
    startsAt: "2030-01-01T14:00:00+08:00",
    endsAt: "2030-01-01T16:00:00+08:00",
    registrationDeadline: "2029-12-31T12:00:00+08:00",
    status: "PUBLISHED" as const,
    registrationEnabled: true,
    waitlistEnabled: true,
    capacity: 1,
    agenda: [],
  };
}
async function admin(api: APIRequestContext) {
  const a = await createVerified(api);
  actors.push(a.id);
  await sql("UPDATE \"User\" SET role='ADMIN' WHERE id=$1", [a.id]);
  return a;
}
async function create(api: APIRequestContext, input = event()) {
  const r = await api.post("/api/admin/events", {
    headers: { origin },
    data: input,
  });
  expect(r.status()).toBe(201);
  const saved = await r.json();
  eventIds.push(saved.id);
  return { ...saved, input };
}
async function register(api: APIRequestContext, id: string) {
  return api.post(`/api/events/${id}/registration`, { headers: { origin } });
}
async function cancel(api: APIRequestContext, id: string) {
  return api.delete(`/api/events/${id}/registration`, { headers: { origin } });
}
test.afterEach(async () => {
  for (const id of eventIds.splice(0))
    await sql(
      'UPDATE "EventRecord" SET status=\'ARCHIVED\',"registrationEnabled"=false WHERE id=$1',
      [id],
    );
  for (const id of actors.splice(0))
    await sql("UPDATE \"User\" SET role='MEMBER' WHERE id=$1", [id]);
});

test("活動編輯與公開、會員報名／取消 UI、名單／CSV 與活動取消通知", async ({
  page,
  request,
}) => {
  await admin(page.request);
  const data = event();
  await page.goto("/admin/events/new");
  await page.getByLabel("活動網址識別碼").fill(data.slug);
  await page.getByLabel("活動標題", { exact: true }).fill(data.title);
  await page.getByLabel("活動介紹", { exact: true }).fill(data.summary);
  await page.getByLabel("開始時間", { exact: true }).fill("2030-01-01T14:00");
  await page.getByLabel("結束時間", { exact: true }).fill("2030-01-01T16:00");
  await page.getByLabel("報名截止", { exact: true }).fill("2029-12-31T12:00");
  await page.getByLabel("議程 1 主題").fill("開發流程測試");
  const savePromise = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/admin/events") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "儲存活動", exact: true }).click();
  const savedResponse = await savePromise;
  expect(savedResponse.status()).toBe(201);
  const saved = await savedResponse.json();
  eventIds.push(saved.id);
  await expect(page).toHaveURL(`/admin/events/${saved.id}`);
  expect((await request.get(`/events/${data.slug}`)).status()).toBe(404);
  await page.getByLabel("活動狀態", { exact: true }).selectOption("PUBLISHED");
  await page.getByLabel("開放本機報名").check();
  await page.getByRole("button", { name: "儲存活動", exact: true }).click();
  await expect(page.getByText(/目前版本 2/)).toBeVisible();
  const publicPage = await request.get(`/events/${data.slug}`);
  expect(publicPage.status()).toBe(200);
  expect(await publicPage.text()).toContain("開發測試報名開放中");
  const member = await createVerified(request);
  const storage = await request.storageState(),
    context = await page
      .context()
      .browser()!
      .newContext({
        storageState: storage,
        viewport: page.viewportSize() ?? undefined,
      });
  const memberPage = await context.newPage();
  try {
    await memberPage.goto(origin + `/events/${data.slug}`);
    await memberPage.getByRole("button", { name: "報名此示範活動" }).click();
    await expect(memberPage.getByText("你的狀態：報名成功")).toBeVisible();
    await memberPage.goto(origin + "/member/events");
    const record = memberPage
      .locator(".application-record")
      .filter({ hasText: data.title });
    await expect(record).toContainText("報名成功");
    await record.getByRole("checkbox").check();
    await record.getByRole("button", { name: "取消報名", exact: true }).click();
    await expect(record.getByRole("heading")).toContainText("已取消");
    expect(
      await memberPage.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  } finally {
    await context.close();
  }
  expect((await register(request, saved.id)).status()).toBe(201);
  await page.goto(`/admin/events/${saved.id}`);
  await expect(page.locator(".admin-record")).toContainText(member.address);
  const csv = await page.request.get(`/api/admin/events/${saved.id}/export`);
  expect(csv.status()).toBe(200);
  expect(csv.headers()["cache-control"]).toBe("no-store");
  expect(await csv.text()).toContain(member.address);
  await page.getByLabel("活動狀態", { exact: true }).selectOption("CANCELLED");
  await page.getByLabel("確認取消此活動", { exact: false }).check();
  await page.getByRole("button", { name: "儲存活動", exact: true }).click();
  await expect(page.getByText(/目前版本 3/)).toBeVisible();
  expect((await register(request, saved.id)).status()).toBe(409);
  expect(
    (
      await sql(
        'SELECT status FROM "EventRegistration" WHERE "eventId"=$1 AND "userId"=$2',
        [saved.id, member.id],
      )
    )[0].status,
  ).toBe("CANCELLED");
  expect(
    (
      await sql(
        'SELECT id FROM "AuditLog" WHERE "entityId"=$1 AND action=\'EVENT_CSV_EXPORTED\'',
        [saved.id],
      )
    ).length,
  ).toBe(1);
});

test("一個名額的併發報名、重複衝突、FIFO 遞補與不超額", async ({
  request,
  playwright,
}) => {
  await admin(request);
  const saved = await create(request),
    contexts = await Promise.all(
      [1, 2, 3].map(() => playwright.request.newContext({ baseURL: origin })),
    );
  try {
    const users = await Promise.all(contexts.map((api) => createVerified(api)));
    const responses = await Promise.all(
      contexts.map((api) => register(api, saved.id)),
    );
    expect(responses.map((r) => r.status())).toEqual([201, 201, 201]);
    const rows = await sql(
      'SELECT "userId",status,"queueOrder" FROM "EventRegistration" WHERE "eventId"=$1 ORDER BY "queueOrder"',
      [saved.id],
    );
    expect(rows.filter((r) => r.status === "CONFIRMED")).toHaveLength(1);
    expect(rows.filter((r) => r.status === "WAITLISTED")).toHaveLength(2);
    expect((await register(contexts[0], saved.id)).status()).toBe(409);
    const winner = rows.find((r) => r.status === "CONFIRMED")!,
      first = rows.find((r) => r.status === "WAITLISTED")!,
      winnerIndex = users.findIndex((u) => u.id === winner.userId);
    expect((await cancel(contexts[winnerIndex], saved.id)).status()).toBe(200);
    const updated = await sql(
      'SELECT "userId",status FROM "EventRegistration" WHERE "eventId"=$1',
      [saved.id],
    );
    expect(updated.find((r) => r.userId === first.userId)?.status).toBe(
      "CONFIRMED",
    );
    expect(updated.filter((r) => r.status === "CONFIRMED")).toHaveLength(1);
    const duplicate = await Promise.all([
      register(contexts[winnerIndex], saved.id),
      register(contexts[winnerIndex], saved.id),
    ]);
    expect(duplicate.map((r) => r.status()).sort()).toEqual([201, 409]);
    const final = await sql(
      'SELECT status FROM "EventRegistration" WHERE "eventId"=$1',
      [saved.id],
    );
    expect(final.filter((r) => r.status === "CONFIRMED")).toHaveLength(1);
    expect(final).toHaveLength(3);
  } finally {
    await Promise.all(contexts.map((api) => api.dispose()));
  }
});

test("會員資格、截止、規則鎖定與遞補時重新檢查資格", async ({
  request,
  playwright,
}) => {
  await admin(request);
  const data = { ...event(), eligibility: "MEMBER" as const },
    saved = await create(request, data);
  const contexts = await Promise.all(
    [1, 2, 3].map(() => playwright.request.newContext({ baseURL: origin })),
  );
  try {
    const users = await Promise.all(contexts.map((api) => createVerified(api)));
    expect((await register(contexts[0], saved.id)).status()).toBe(403);
    const types = await sql(
      "SELECT id FROM \"MembershipType\" WHERE code='DEMO_PERSONAL'",
    );
    for (const user of users)
      await sql(
        'INSERT INTO "Membership" (id,"userId","typeId","memberNumber","validFrom","validUntil","isDemo") VALUES (gen_random_uuid(),$1,$2,$3,now()-interval \'1 day\',\'2031-01-01\',true)',
        [user.id, types[0].id, "DEMO-" + randomUUID()],
      );
    // An expiration instant equal to the event start is already expired at start.
    await sql('UPDATE "Membership" SET "validUntil"=$1 WHERE "userId"=$2', [
      data.startsAt,
      users[0].id,
    ]);
    expect((await register(contexts[0], saved.id)).status()).toBe(403);
    await sql(
      'UPDATE "Membership" SET "validUntil"=\'2031-01-01\' WHERE "userId"=$1',
      [users[0].id],
    );
    for (const api of contexts)
      expect((await register(api, saved.id)).status()).toBe(201);
    const rules = await request.patch(`/api/admin/events/${saved.id}`, {
      headers: { origin },
      data: { ...data, version: 1, eligibility: "ACCOUNT" },
    });
    expect(rules.status()).toBe(409);
    await sql(
      'UPDATE "Membership" SET "validUntil"=now()-interval \'1 hour\' WHERE "userId"=$1',
      [users[1].id],
    );
    expect((await cancel(contexts[0], saved.id)).status()).toBe(200);
    const rows = await sql(
      'SELECT "userId",status FROM "EventRegistration" WHERE "eventId"=$1',
      [saved.id],
    );
    expect(rows.find((r) => r.userId === users[1].id)?.status).toBe(
      "CANCELLED",
    );
    expect(rows.find((r) => r.userId === users[2].id)?.status).toBe(
      "CONFIRMED",
    );
    await sql(
      'UPDATE "EventRecord" SET "registrationDeadline"=now()-interval \'1 minute\' WHERE id=$1',
      [saved.id],
    );
    expect((await register(contexts[0], saved.id)).status()).toBe(409);
    expect(
      await (await request.get(`/events/${saved.input.slug}`)).text(),
    ).toContain("報名已截止");
    expect((await cancel(contexts[2], saved.id)).status()).toBe(200);
    expect(
      (
        await sql(
          'SELECT id FROM "EventRegistration" WHERE "eventId"=$1 AND status=\'CONFIRMED\'',
          [saved.id],
        )
      ).length,
    ).toBe(0);
  } finally {
    await Promise.all(contexts.map((api) => api.dispose()));
  }
});

test("活動 RBAC、名單隔離、報到時間與 CSV 公式防護", async ({
  request,
  playwright,
}) => {
  const actor = await admin(request),
    saved = await create(request, { ...event(), capacity: 2 });
  const memberApi = await playwright.request.newContext({ baseURL: origin });
  try {
    const member = await createVerified(memberApi);
    const booked = await register(memberApi, saved.id);
    expect(booked.status()).toBe(201);
    const registration = await booked.json();
    expect((await register(request, saved.id)).status()).toBe(201);
    const lower = await request.patch(`/api/admin/events/${saved.id}`, {
      headers: { origin },
      data: { ...saved.input, capacity: 1, version: 1 },
    });
    expect(lower.status()).toBe(409);
    await sql('UPDATE "User" SET name=$1 WHERE id=$2', [
      "=SUM(1,2)",
      member.id,
    ]);
    expect(
      (await memberApi.get(`/api/admin/events/${saved.id}/export`)).status(),
    ).toBe(403);
    await expect(
      (await memberApi.get(`/admin/events/${saved.id}`)).text(),
    ).resolves.not.toContain(member.address);
    for (const role of ["EDITOR", "STAFF", "ADMIN", "SUPER_ADMIN"]) {
      await sql('UPDATE "User" SET role=$1 WHERE id=$2', [role, actor.id]);
      const r = await request.post("/api/admin/events", {
        headers: { origin },
        data: event(),
      });
      if (["ADMIN", "SUPER_ADMIN"].includes(role)) {
        expect(r.status()).toBe(201);
        eventIds.push((await r.json()).id);
      } else expect(r.status()).toBe(403);
      const exported = await request.get(
        `/api/admin/events/${saved.id}/export`,
      );
      expect(exported.status()).toBe(role === "EDITOR" ? 403 : 200);
      if (exported.ok())
        expect(await exported.text()).toContain('"\'=SUM(1,2)"');
    }
    await sql("UPDATE \"User\" SET role='STAFF' WHERE id=$1", [actor.id]);
    const check = (id: string) =>
      request.post(`/api/admin/events/${saved.id}/check-in`, {
        headers: { origin },
        data: { registrationId: id },
      });
    expect((await check(registration.id)).status()).toBe(409);
    await sql(
      'UPDATE "EventRecord" SET "startsAt"=now()+interval \'30 minutes\',"endsAt"=now()+interval \'2 hours\',"registrationDeadline"=now()-interval \'1 minute\' WHERE id=$1',
      [saved.id],
    );
    expect((await check(randomUUID())).status()).toBe(404);
    expect((await check(registration.id)).status()).toBe(200);
    expect((await check(registration.id)).status()).toBe(409);
    expect((await cancel(memberApi, saved.id)).status()).toBe(409);
    const me = await memberApi.get("/member/events");
    expect(await me.text()).toContain("報到：");
    expect(
      (
        await sql(
          'SELECT id FROM "AuditLog" WHERE "entityId"=$1 AND action=\'EVENT_CHECKED_IN\'',
          [registration.id],
        )
      ).length,
    ).toBe(1);
    expect(
      (
        await request.post(`/api/admin/events/${saved.id}/check-in`, {
          headers: { origin: "https://invalid.example" },
          data: { registrationId: registration.id },
        })
      ).status(),
    ).toBe(403);
  } finally {
    await memberApi.dispose();
  }
});
