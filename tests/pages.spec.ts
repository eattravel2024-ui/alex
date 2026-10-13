import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { sql, createVerified } from "./auth-helpers";
import { pageDefaults } from "../src/lib/site-pages";
const origin = "http://127.0.0.1:3000";
test("頁面草稿隔離、發布UI、私人預覽、角色、還原與併發版本交易", async ({ page }) => {
  const actor = await createVerified(page.request);
  const originals = new Map<string, Record<string, unknown> | undefined>();
  for (const key of ["home", "about"]) originals.set(key, (await sql('SELECT * FROM "SitePage" WHERE key=$1', [key]))[0]);
  const marker = randomUUID();
  const draft = { ...pageDefaults.about, title: "私人草稿 " + marker };
  const headers = { origin };
  let version = Number(originals.get("about")?.version ?? 0);
  try {
    await sql("UPDATE \"User\" SET role='EDITOR' WHERE id=$1", [actor.id]);
    expect((await page.request.patch("/api/admin/pages/about", { headers, data: { action: "SAVE", version, content: draft } })).status()).toBe(200);
    version++;
    const firstRevision = (await sql('SELECT id FROM "SitePageRevision" WHERE "pageKey"=\'about\' AND version=$1', [version]))[0].id;
    expect(await (await page.request.get("/about")).text()).not.toContain(marker);
    for (const role of ["MEMBER", "STAFF", "EDITOR", "ADMIN", "SUPER_ADMIN"]) {
      await sql('UPDATE "User" SET role=$1 WHERE id=$2', [role, actor.id]);
      const allowed = ["EDITOR", "ADMIN", "SUPER_ADMIN"].includes(role);
      const preview = await page.request.get("/admin/pages/about/preview");
      expect((await preview.text()).includes(marker)).toBe(allowed);
      const invalid = await page.request.patch("/api/admin/pages/unknown", { headers, data: { action: "SAVE", version, content: draft } });
      expect(invalid.status()).toBe(allowed ? 400 : 403);
    }
    expect((await page.request.patch("/api/admin/pages/about", { headers: { origin: "https://invalid.example" }, data: { action: "SAVE", version, content: draft } })).status()).toBe(403);
    expect((await page.request.patch("/api/admin/pages/about", { headers, data: { action: "SAVE", version, content: { ...draft, role: "ADMIN" } } })).status()).toBe(400);
    expect((await page.request.patch("/api/admin/pages/about", { headers, data: { action: "SAVE", version, content: { ...draft, sections: [...draft.sections].reverse() } } })).status()).toBe(400);
    expect((await page.request.patch("/api/admin/pages/about", { headers, data: { action: "SAVE", version, content: { ...draft, description: "x".repeat(70000) } } })).status()).toBe(413);
    await page.goto("/admin/pages/about");
    await page.getByLabel("頁面主標題").fill("公開介紹 " + marker);
    await page.getByLabel("章節內容：intro").fill("<script>window.pageInjected=true</script> 這是安全文字測試。");
    const saved = page.waitForResponse((r) => r.url().endsWith("/api/admin/pages/about") && r.request().method() === "PATCH");
    await page.getByRole("button", { name: "發布目前內容" }).click();
    expect((await saved).status()).toBe(200); version++;
    await page.goto("/about");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("公開介紹 " + marker);
    expect(await page.evaluate(() => "pageInjected" in window)).toBe(false);
    expect(await page.locator(".prose script").count()).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const homeVersion = Number(originals.get("home")?.version ?? 0);
    const home = { ...pageDefaults.home, description: "首頁私人草稿 " + marker };
    expect((await page.request.patch("/api/admin/pages/home", { headers, data: { action: "SAVE", version: homeVersion, content: home } })).status()).toBe(200);
    expect(await (await page.request.get("/")).text()).not.toContain("首頁私人草稿 " + marker);
    expect((await page.request.patch("/api/admin/pages/home", { headers, data: { action: "RESTORE", version: homeVersion + 1, revisionId: firstRevision } })).status()).toBe(404);
    expect((await page.request.patch("/api/admin/pages/about", { headers, data: { action: "RESTORE", version, revisionId: firstRevision } })).status()).toBe(200); version++;
    expect(await (await page.request.get("/about")).text()).toContain("公開介紹 " + marker);
    expect(await (await page.request.get("/admin/pages/about/preview")).text()).toContain("私人草稿 " + marker);
    const concurrent = await Promise.all(["甲", "乙"].map((label) => page.request.patch("/api/admin/pages/about", { headers, data: { action: "SAVE", version, content: { ...draft, title: label + marker } } })));
    expect(concurrent.map((r) => r.status()).sort()).toEqual([200, 409]);
    const revisions = await sql('SELECT version FROM "SitePageRevision" WHERE "pageKey"=\'about\' AND "actorId"=$1', [actor.id]);
    expect(revisions).toHaveLength(4);
    const audits = await sql('SELECT action FROM "AuditLog" WHERE "actorId"=$1 AND "entityId"=\'about\'', [actor.id]);
    expect(audits).toHaveLength(4);
    expect(await (await page.request.get("/about")).text()).toContain("公開介紹 " + marker);
  } finally {
    for (const [key, row] of originals) {
      await sql('DELETE FROM "SitePageRevision" WHERE "pageKey"=$1 AND "actorId"=$2', [key, actor.id]);
      if (row) await sql('UPDATE "SitePage" SET draft=$2::jsonb,published=$3::jsonb,"publishedAt"=$4,version=$5,"updatedAt"=$6 WHERE key=$1', [key, JSON.stringify(row.draft), row.published === null ? null : JSON.stringify(row.published), row.publishedAt, row.version, row.updatedAt]);
      else await sql('DELETE FROM "SitePage" WHERE key=$1', [key]);
    }
    await sql("UPDATE \"User\" SET role='MEMBER' WHERE id=$1", [actor.id]);
  }
});
