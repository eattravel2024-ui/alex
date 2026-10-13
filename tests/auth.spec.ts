import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  sql,
  post,
  mailLink,
  createVerified,
  clientAddress,
  password,
  email,
} from "./auth-helpers";
const origin = "http://127.0.0.1:3000";
test("八字元密碼可註冊、驗證、登入與修改，七字元仍被拒絕", async ({ request }) => {
  const address = email();
  const secret = "A" + randomUUID().slice(0, 6) + "9";
  const payload = { name: "密碼規則測試", email: address, password: secret, termsAccepted: true, privacyAccepted: true, callbackURL: "/auth/verify" };
  expect((await post(request, "/api/auth/sign-up/email", { ...payload, password: secret.slice(0, 7) })).status()).toBe(400);
  expect((await post(request, "/api/auth/sign-up/email", payload)).status()).toBe(200);
  await request.get(await mailLink(request, address, "驗證電子郵件"));
  expect((await post(request, "/api/auth/sign-in/email", { email: address, password: secret })).status()).toBe(200);
  const next = "B" + randomUUID().slice(0, 6) + "8";
  expect((await post(request, "/api/auth/change-password", { currentPassword: secret, newPassword: next.slice(0, 7), revokeOtherSessions: true })).status()).toBe(400);
  expect((await post(request, "/api/auth/change-password", { currentPassword: secret, newPassword: next, revokeOtherSessions: true })).status()).toBe(200);
  expect((await post(request, "/api/auth/sign-in/email", { email: address, password: next })).status()).toBe(200);
});
test("註冊、信箱驗證、登入、資料儲存、收藏與入會申請", async ({
  page,
  request,
}) => {
  const address = email(),
    secret = password();
  await page
    .context()
    .setExtraHTTPHeaders({ "x-forwarded-for": clientAddress(page.request) });
  await page.goto("/auth/register");
  await page.getByLabel("顯示名稱").fill("開發測試會員");
  await page.getByLabel("電子郵件", { exact: true }).fill(address);
  await page.getByLabel("密碼", { exact: true }).fill(secret);
  await page.getByRole("checkbox").nth(0).check();
  await page.getByRole("checkbox").nth(1).check();
  await page.getByRole("button", { name: "建立測試帳號" }).click();
  await expect(page.getByRole("status")).toContainText("註冊請求已受理");
  const before = await post(request, "/api/auth/sign-in/email", {
    email: address,
    password: secret,
  });
  expect(before.status()).toBe(403);
  await page.goto(await mailLink(request, address, "驗證電子郵件"));
  await page.goto("/auth/login");
  await page.getByLabel("電子郵件").fill(address);
  await page.getByLabel("密碼", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await expect(page).toHaveURL("/member");
  await expect(page.getByText("尚無正式會員資格")).toBeVisible();
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find((c) => c.name.includes("session_token"));
  expect(sessionCookie?.httpOnly).toBe(true);
  expect(sessionCookie?.sameSite).toBe("Lax");
  await page.getByRole("link", { name: "個人資料", exact: true }).click();
  await page.getByLabel("顯示名稱").fill("更新的測試名稱");
  await page.getByRole("button", { name: "儲存個人資料" }).click();
  await expect(page.getByRole("status")).toHaveText("個人資料已儲存。");
  const me = await (await page.request.get("/api/me")).json();
  expect(me.name).toBe("更新的測試名稱");
  expect(me.profile.phone).toBeNull();
  await page.goto("/knowledge/balanced-eating");
  await page.getByRole("button", { name: "收藏文章", exact: true }).click();
  await expect(page.getByText("文章已加入收藏。")).toBeVisible();
  await page.goto("/member/bookmarks");
  await expect(
    page.getByRole("link", {
      name: "好好吃飯，是照顧自己的第一步",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/member/application");
  await page
    .getByLabel("申請說明")
    .fill("這是一份用於驗證入會流程的開發測試申請。");
  await page.getByRole("button", { name: "送出示範申請" }).click();
  await expect(page.getByRole("heading", { name: /待審核/ })).toBeVisible();
  const applications = await (
    await page.request.get("/api/membership/applications")
  ).json();
  expect(applications).toHaveLength(1);
  const duplicate = await post(page.request, "/api/membership/applications", {
    typeId: applications[0].typeId,
    motivation: "重複送出的測試申請說明。",
  });
  expect(duplicate.status()).toBe(409);
  await page.getByRole("button", { name: "登出", exact: true }).click();
  await expect(page).toHaveURL("/auth/login");
  expect((await page.request.get("/api/me")).status()).toBe(401);
});
test("API 權限與資料隔離、禁止角色提升、Origin 防護與帳號停用", async ({
  playwright,
  request,
}) => {
  expect((await request.get("/api/me")).status()).toBe(401);
  const a = await playwright.request.newContext({ baseURL: origin }),
    b = await playwright.request.newContext({ baseURL: origin });
  try {
    const userA = await createVerified(a),
      userB = await createVerified(b);
    const rows = await sql('SELECT role FROM "User" WHERE id=$1', [userA.id]);
    expect(rows[0].role).toBe("MEMBER");
    const me = await (await a.get("/api/me?userId=" + userB.id)).json();
    expect(me.id).toBe(userA.id);
    expect(JSON.stringify(me).includes("password")).toBe(false);
    expect(
      (
        await post(a, "/api/admin/membership/applications/" + randomUUID(), {
          status: "APPROVED",
          note: "無權審核",
          version: 1,
        })
      ).status(),
    ).toBe(405);
    const forbidden = await a.patch(
      "/api/admin/membership/applications/" + randomUUID(),
      {
        headers: { origin },
        data: { status: "APPROVED", note: "無權審核", version: 1 },
      },
    );
    expect(forbidden.status()).toBe(403);
    for (const [role, expected] of [
      ["MEMBER", 403],
      ["EDITOR", 403],
      ["STAFF", 404],
      ["ADMIN", 404],
      ["SUPER_ADMIN", 404],
    ] as const) {
      await sql('UPDATE "User" SET role=$1 WHERE id=$2', [role, userA.id]);
      const probe = await a.patch(
        "/api/admin/membership/applications/" + randomUUID(),
        {
          headers: { origin },
          data: { status: "RETURNED", note: "角色授權測試", version: 1 },
        },
      );
      expect(probe.status()).toBe(expected);
    }
    await sql('UPDATE "User" SET role=$1 WHERE id=$2', ["MEMBER", userA.id]);
    const escalate = await a.patch("/api/me", {
      headers: { origin },
      data: {
        name: "測試帳號",
        phone: "",
        emailNotifications: true,
        role: "ADMIN",
      },
    });
    expect(escalate.status()).toBe(400);
    const tooLarge = await a.patch("/api/me", {
      headers: { origin },
      data: { name: "x".repeat(9000), phone: "", emailNotifications: true },
    });
    expect(tooLarge.status()).toBe(413);
    const crossOrigin = await a.patch("/api/me", {
      headers: { origin: "https://untrusted.example.test" },
      data: { name: "測試帳號", phone: "", emailNotifications: true },
    });
    expect(crossOrigin.status()).toBe(403);
    const session = (
      await sql('SELECT id FROM "Session" WHERE "userId"=$1', [userB.id])
    )[0];
    expect(
      (
        await a.delete("/api/member/sessions/" + session.id, {
          headers: { origin },
        })
      ).status(),
    ).toBe(404);
    await sql('UPDATE "User" SET disabled=true WHERE id=$1', [userA.id]);
    expect((await a.get("/api/me")).status()).toBe(401);
    expect(
      (
        await post(a, "/api/auth/sign-in/email", {
          email: userA.address,
          password: userA.secret,
        })
      ).status(),
    ).toBe(403);
    await sql(
      'UPDATE "Session" SET "expiresAt"=NOW()-make_interval(secs => 1) WHERE "userId"=$1',
      [userB.id],
    );
    expect((await b.get("/api/me")).status()).toBe(401);
  } finally {
    await a.dispose();
    await b.dispose();
  }
});
test("併發申請、退回補件、角色審核及核准交易", async ({ playwright }) => {
  const applicant = await playwright.request.newContext({ baseURL: origin }),
    reviewer = await playwright.request.newContext({ baseURL: origin });
  try {
    const member = await createVerified(applicant),
      staff = await createVerified(reviewer);
    await sql('UPDATE "User" SET role=$1 WHERE id=$2', ["STAFF", staff.id]);
    const type = (
      await sql('SELECT id FROM "MembershipType" WHERE code=$1', [
        "DEMO_PERSONAL",
      ])
    )[0];
    const responses = await Promise.all([
      post(applicant, "/api/membership/applications", {
        typeId: type.id,
        motivation: "驗證資料庫併發控制與入會申請流程。",
      }),
      post(applicant, "/api/membership/applications", {
        typeId: type.id,
        motivation: "驗證資料庫併發控制與入會申請流程。",
      }),
    ]);
    expect(responses.map((r) => r.status()).sort()).toEqual([201, 409]);
    let application = (
      await (await applicant.get("/api/membership/applications")).json()
    )[0];
    const review = (data: unknown) =>
      reviewer.patch("/api/admin/membership/applications/" + application.id, {
        headers: { origin },
        data,
      });
    expect(
      (
        await review({
          status: "RETURNED",
          note: "請補充測試申請的說明。",
          version: application.version,
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await post(applicant, "/api/membership/applications", {
          typeId: type.id,
          motivation: "補充完成的測試申請說明，重新提交。",
        })
      ).status(),
    ).toBe(201);
    application = (
      await (await applicant.get("/api/membership/applications")).json()
    )[0];
    expect(application.history).toHaveLength(3);
    expect(
      (
        await review({
          status: "APPROVED",
          note: "過期版本測試",
          version: 1,
          validUntil: new Date(Date.now() + 86400000 * 365).toISOString(),
        })
      ).status(),
    ).toBe(409);
    const approvals = await Promise.all([
      review({
        status: "APPROVED",
        note: "核准此開發測試申請。",
        version: application.version,
        validUntil: new Date(Date.now() + 86400000 * 365).toISOString(),
      }),
      review({
        status: "APPROVED",
        note: "重複核准測試。",
        version: application.version,
        validUntil: new Date(Date.now() + 86400000 * 365).toISOString(),
      }),
    ]);
    expect(approvals.map((r) => r.status()).sort()).toEqual([200, 409]);
    const data = await (await applicant.get("/api/me")).json();
    expect(data.membership.isDemo).toBe(true);
    expect(data.membership.memberNumber.startsWith("DEMO-")).toBe(true);
    expect(data.notifications).toHaveLength(4);
    const audit = await sql(
      'SELECT action FROM "AuditLog" WHERE "entityId"=$1',
      [application.id],
    );
    expect(
      audit.filter((a) => a.action === "APPLICATION_APPROVED"),
    ).toHaveLength(1);
    expect(data.id).toBe(member.id);
  } finally {
    await applicant.dispose();
    await reviewer.dispose();
  }
});
test("密碼重設單次 token、撤銷既有 Session 與重新登入", async ({
  playwright,
}) => {
  const a = await playwright.request.newContext({ baseURL: origin }),
    b = await playwright.request.newContext({ baseURL: origin });
  try {
    const user = await createVerified(a);
    expect(
      (
        await post(b, "/api/auth/sign-in/email", {
          email: user.address,
          password: user.secret,
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await post(a, "/api/auth/request-password-reset", {
          email: user.address,
          redirectTo: origin + "/auth/reset-password",
        })
      ).status(),
    ).toBe(200);
    const link = await mailLink(a, user.address, "重設密碼");
    const redirect = await a.get(link, { maxRedirects: 0 });
    expect(redirect.status()).toBe(302);
    const token = new URL(redirect.headers().location, origin).searchParams.get(
      "token",
    );
    expect(Boolean(token)).toBe(true);
    const identifiers = await sql('SELECT identifier FROM "Verification"');
    expect(identifiers.some((v) => v.identifier.includes(token!))).toBe(false);
    const nextPassword = password();
    expect(
      (
        await post(a, "/api/auth/reset-password", {
          token,
          newPassword: nextPassword,
        })
      ).status(),
    ).toBe(200);
    expect((await a.get("/api/me")).status()).toBe(401);
    expect((await b.get("/api/me")).status()).toBe(401);
    expect(
      (
        await post(a, "/api/auth/reset-password", {
          token,
          newPassword: password(),
        })
      ).ok(),
    ).toBe(false);
    expect(
      (
        await post(a, "/api/auth/sign-in/email", {
          email: user.address,
          password: user.secret,
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await post(a, "/api/auth/sign-in/email", {
          email: user.address,
          password: nextPassword,
        })
      ).status(),
    ).toBe(200);
    const accounts = await sql(
      'SELECT password FROM "Account" WHERE "userId"=$1',
      [user.id],
    );
    expect(accounts[0].password === nextPassword).toBe(false);
  } finally {
    await a.dispose();
    await b.dispose();
  }
});
test("服務端表單驗證、登入暴力破解限制與密碼變更", async ({ playwright }) => {
  const a = await playwright.request.newContext({ baseURL: origin }),
    b = await playwright.request.newContext({ baseURL: origin });
  try {
    const invalid = await post(a, "/api/auth/sign-up/email", {
      name: "測試帳號",
      email: email(),
      password: password(),
      termsAccepted: false,
      privacyAccepted: true,
    });
    expect(invalid.status()).toBe(400);
    const user = await createVerified(a);
    expect(
      (
        await post(b, "/api/auth/sign-in/email", {
          email: user.address,
          password: user.secret,
        })
      ).status(),
    ).toBe(200);
    const nextPassword = password();
    expect(
      (
        await post(a, "/api/auth/change-password", {
          currentPassword: user.secret,
          newPassword: nextPassword,
          revokeOtherSessions: true,
        })
      ).status(),
    ).toBe(200);
    expect((await b.get("/api/me")).status()).toBe(401);
    const statuses = [];
    for (let i = 0; i < 12; i++)
      statuses.push(
        (
          await post(b, "/api/auth/sign-in/email", {
            email: user.address,
            password: password(),
          })
        ).status(),
      );
    expect(statuses.includes(429)).toBe(true);
  } finally {
    await a.dispose();
    await b.dispose();
  }
});
