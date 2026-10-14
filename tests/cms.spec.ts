import { test, expect, type APIRequestContext, type Locator } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createVerified, sql } from "./auth-helpers";
import { emptyArticle } from "../src/lib/article-validation";
const origin = "http://127.0.0.1:3000";
const ids: string[] = [],
  actors: string[] = [];
function article() {
  const slug = "cms-" + randomUUID();
  return {
    ...emptyArticle,
    slug,
    title: "CMS測試 " + slug,
    summary: "僅供 CMS 整合測試的文章摘要",
    category: "CMS 測試",
    blocks: [
      {
        heading: "安全文字區塊",
        paragraphs: ["僅供測試，不代表正式協會公告或醫療資訊。"],
      },
    ],
  };
}
async function editor(api: APIRequestContext) {
  const actor = await createVerified(api);
  actors.push(actor.id);
  await sql("UPDATE \"User\" SET role='EDITOR' WHERE id=$1", [actor.id]);
  return actor;
}
async function create(api: APIRequestContext, input = article()) {
  const r = await api.post("/api/admin/articles", {
    headers: { origin },
    data: input,
  });
  expect(r.status()).toBe(201);
  const saved = await r.json();
  ids.push(saved.id);
  return { ...saved, input };
}
async function patch(api: APIRequestContext, id: string, input: unknown) {
  return api.patch(`/api/admin/articles/${id}`, {
    headers: { origin },
    data: input,
  });
}
test.afterEach(async () => {
  for (const id of ids.splice(0))
    await sql(
      'UPDATE "ArticleRecord" SET status=\'ARCHIVED\', "publishAt"=NULL WHERE id=$1',
      [id],
    );
  for (const id of actors.splice(0))
    await sql("UPDATE \"User\" SET role='MEMBER' WHERE id=$1", [id]);
});

test("CMS 表單、區塊排序、安全預覽、發布／下架、收藏與版本還原", async ({
  page,
  request,
}) => {
  await editor(page.request);
  const input = article();
  const title = input.title + " <script>window.__cmsPwned=1</script>";
  await page.goto("/admin/articles/new");
  await page.getByLabel("網址識別碼（英文小寫與連字號）").fill(input.slug);
  await page.getByLabel("文章標題", { exact: true }).fill(title);
  await page.getByLabel("文章摘要").fill(input.summary);
  await page.getByLabel("區塊 1 標題").fill("第一個區塊");
  await page
    .getByLabel("區塊 1 段落")
    .fill('<img src=x onerror="window.__cmsPwned=1">安全顯示為文字。');
  await page.getByRole("button", { name: "新增區塊", exact: true }).click();
  await page.getByLabel("區塊 2 標題").fill("第二個區塊");
  await page.getByLabel("區塊 2 段落").fill("這個區塊將移到文章最前方。");
  await page.getByRole("button", { name: "上移區塊 2" }).click();
  await expect(page.getByLabel("區塊 1 標題")).toHaveValue("第二個區塊");
  const savedPromise = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/admin/articles") &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "儲存文章", exact: true }).click();
  const savedResponse = await savedPromise;
  expect(savedResponse.status()).toBe(201);
  const saved = await savedResponse.json();
  ids.push(saved.id);
  await expect(page).toHaveURL(`/admin/articles/${saved.id}`);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect((await request.get(`/knowledge/${input.slug}`)).status()).toBe(404);
  await page.getByRole("link", { name: "預覽已儲存版本", exact: true }).click();
  await expect(page.locator(".article-detail h1")).toHaveText(title);
  expect(await page.evaluate(() => Object.hasOwn(window, "__cmsPwned"))).toBe(
    false,
  );
  await expect(page.locator(".article-detail .prose img")).toHaveCount(0);
  await expect(page.locator(".prose > section").first()).toContainText(
    "第二個區塊",
  );
  const privatePage = await request.get(`/admin/articles/${saved.id}/preview`);
  expect(await privatePage.text()).not.toContain(input.slug);
  await page.goto(`/admin/articles/${saved.id}`);
  const revisedTitle = input.title + "已更新";
  await page.getByLabel("文章標題", { exact: true }).fill(revisedTitle);
  await page.getByLabel("發布狀態", { exact: true }).selectOption("PUBLISHED");
  await page.getByRole("button", { name: "儲存文章", exact: true }).click();
  await expect(page.getByText(/目前版本 2/)).toBeVisible();
  const published = await request.get(`/knowledge/${input.slug}`);
  expect(published.status()).toBe(200);
  expect(await published.text()).toContain(revisedTitle);
  await page.goto(`/knowledge?q=${encodeURIComponent(input.slug)}`);
  await expect(page.locator(".article-card")).toHaveCount(1);
  await createVerified(request);
  expect(
    (
      await request.post("/api/member/bookmarks", {
        headers: { origin },
        data: { slug: input.slug },
      })
    ).status(),
  ).toBe(200);
  await page.goto(`/admin/articles/${saved.id}`);
  await page.getByLabel("發布狀態", { exact: true }).selectOption("ARCHIVED");
  await page.getByRole("button", { name: "儲存文章", exact: true }).click();
  await expect(page.getByText(/目前版本 3/)).toBeVisible();
  expect((await request.get(`/knowledge/${input.slug}`)).status()).toBe(404);
  const bookmarks = await request.get("/member/bookmarks");
  expect(await bookmarks.text()).toContain("文章已下架");
  expect(await bookmarks.text()).not.toContain(revisedTitle);
  expect(
    (
      await request.delete("/api/member/bookmarks", {
        headers: { origin },
        data: { slug: input.slug },
      })
    ).status(),
  ).toBe(200);
  const revision = page
    .locator("details.application-record")
    .filter({ hasText: "版本 1" });
  await revision.locator("summary").click();
  await revision.getByRole("checkbox").check();
  await revision.getByRole("button", { name: "還原為草稿" }).click();
  await expect(page.getByText(/目前版本 4/)).toBeVisible();
  await expect(page.getByLabel("文章標題", { exact: true })).toHaveValue(title);
  await expect(page.getByLabel("發布狀態", { exact: true })).toHaveValue(
    "DRAFT",
  );
  expect(
    (
      await sql('SELECT id FROM "ArticleRevision" WHERE "articleId"=$1', [
        saved.id,
      ])
    ).length,
  ).toBe(4);
  expect(
    (
      await sql(
        'SELECT id FROM "AuditLog" WHERE "entityId"=$1 AND action=\'ARTICLE_RESTORED\'',
        [saved.id],
      )
    ).length,
  ).toBe(1);
});

test("文章格式工具、連結驗證與編輯／私人／公開預覽一致", async ({ page, request }, testInfo) => {
  await editor(page.request);
  const input = article();
  await page.goto("/admin/articles/new");
  await page.getByLabel("網址識別碼（英文小寫與連字號）").fill(input.slug);
  await page.getByLabel("文章標題", { exact: true }).fill(input.title);
  await page.getByLabel("文章摘要").fill(input.summary);
  await page.getByLabel("區塊 1 標題").fill("段落格式測試");
  const field = page.getByLabel("區塊 1 段落", { exact: true });
  const toolbar = page.getByRole("toolbar", { name: "段落格式工具" });
  const literal = '<img src=x onerror="window.__formatPwned=1">';
  const plain = [
    "專業審閱與日常照顧。", "第一項\n第二項", "步驟一\n步驟二",
    "延伸閱讀", literal, "[危險](javascript:alert(1))",
  ].join("\n\n");
  async function select(text: string) {
    await field.evaluate((element, selected) => {
      const textarea = element as HTMLTextAreaElement;
      const start = textarea.value.indexOf(selected);
      if (start < 0) throw new Error("Selection not found");
      textarea.focus();
      textarea.setSelectionRange(start, start + selected.length);
    }, text);
  }
  await field.fill("跨段落甲\n\n跨段落乙");
  await select("跨段落甲\n\n跨段落乙");
  await toolbar.getByRole("button", { name: "粗體", exact: true }).click();
  await expect(field).toHaveValue("**跨段落甲**\n\n**跨段落乙**");
  await page.locator(".cms-live-preview summary").click();
  await expect(page.locator(".cms-live-preview strong")).toHaveText(["跨段落甲", "跨段落乙"]);
  await page.locator(".cms-live-preview summary").click();
  await field.fill(plain);
  await select("專業審閱");
  await toolbar.getByRole("button", { name: "粗體", exact: true }).click();
  await expect(field).toHaveValue(/\*\*專業審閱\*\*/);
  await select("日常照顧");
  await field.press("Control+i");
  await expect(field).toHaveValue(/\*日常照顧\*/);
  await select("第一項\n第二項");
  await toolbar.getByRole("button", { name: "項目清單", exact: true }).click();
  await expect(field).toHaveValue(/- 第一項\n- 第二項/);
  await select("步驟一\n步驟二");
  await toolbar.getByRole("button", { name: "編號清單", exact: true }).click();
  await expect(field).toHaveValue(/1\. 步驟一\n2\. 步驟二/);
  await toolbar.getByRole("button", { name: "粗體", exact: true }).focus();
  await page.keyboard.press("End");
  await expect(toolbar.getByRole("button", { name: "加入連結", exact: true })).toBeFocused();
  await select("延伸閱讀");
  await toolbar.getByRole("button", { name: "加入連結", exact: true }).click();
  await expect(page.getByLabel("連結文字", { exact: true })).toHaveValue("延伸閱讀");
  await page.getByLabel("HTTPS 網址", { exact: true }).fill("javascript:alert(1)");
  await page.getByRole("button", { name: "插入連結", exact: true }).click();
  await expect(page.locator(".article-textarea").getByRole("alert")).toContainText("請輸入 HTTPS 網址");
  await page.getByLabel("HTTPS 網址", { exact: true }).fill("https://example.org/health");
  await page.getByLabel("HTTPS 網址", { exact: true }).press("Enter");
  await expect(field).toHaveValue(/\[延伸閱讀\]\(https:\/\/example\.org\/health\)/);
  await expect(page).toHaveURL("/admin/articles/new");
  await expect(page.getByRole("group", { name: "加入段落連結" })).toHaveCount(0);
  const formatted = await field.inputValue();
  async function assertFormatted(body: Locator) {
    await expect(body.locator("strong")).toHaveText("專業審閱");
    await expect(body.locator("em")).toHaveText("日常照顧");
    await expect(body.locator("ul.article-body-list li")).toHaveText(["第一項", "第二項"]);
    await expect(body.locator("ol.article-body-list li")).toHaveText(["步驟一", "步驟二"]);
    await expect(body.locator("ul.article-body-list")).toHaveCSS("list-style-type", "disc");
    await expect(body.locator("ol.article-body-list")).toHaveCSS("list-style-type", "decimal");
    const link = body.getByRole("link", { name: "延伸閱讀", exact: true });
    await expect(link).toHaveAttribute("href", "https://example.org/health");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await expect(body.getByText(literal, { exact: true })).toBeVisible();
    await expect(body.getByText("[危險](javascript:alert(1))", { exact: true })).toBeVisible();
    await expect(body.locator("img, script, a[href^='javascript:']")).toHaveCount(0);
    expect(await page.evaluate(() => Object.hasOwn(window, "__formatPwned"))).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.locator(".cms-live-preview summary").click();
  await assertFormatted(page.locator(".cms-live-preview .prose"));
  await page.locator(".article-textarea").screenshot({ path: testInfo.outputPath("format-toolbar.png") });
  await page.locator(".cms-live-preview").screenshot({ path: testInfo.outputPath("format-preview.png") });
  const savedPromise = page.waitForResponse((r) => r.url().endsWith("/api/admin/articles") && r.request().method() === "POST");
  await page.getByRole("button", { name: "儲存文章", exact: true }).click();
  const response = await savedPromise;
  expect(response.status()).toBe(201);
  const saved = await response.json();
  ids.push(saved.id);
  await expect(page).toHaveURL(`/admin/articles/${saved.id}`);
  await expect(page.getByLabel("區塊 1 段落", { exact: true })).toHaveValue(formatted);
  expect((await request.get(`/knowledge/${input.slug}`)).status()).toBe(404);
  await page.getByRole("link", { name: "預覽已儲存版本", exact: true }).click();
  await assertFormatted(page.locator(".article-detail .prose > section"));
  await page.goto(`/admin/articles/${saved.id}`);
  await page.getByLabel("發布狀態", { exact: true }).selectOption("PUBLISHED");
  await page.getByRole("button", { name: "儲存文章", exact: true }).click();
  await expect(page.getByText(/目前版本 2/)).toBeVisible();
  await page.goto(`/knowledge/${input.slug}`);
  await assertFormatted(page.locator(".article-detail .prose > section"));
});

test("CMS API 角色、防 CSRF、大小限制與危險網址驗證", async ({ request }) => {
  const input = article();
  expect(
    (
      await request.post("/api/admin/articles", {
        headers: { origin },
        data: input,
      })
    ).status(),
  ).toBe(401);
  const actor = await createVerified(request);
  actors.push(actor.id);
  for (const role of ["MEMBER", "STAFF", "EDITOR", "ADMIN", "SUPER_ADMIN"]) {
    await sql('UPDATE "User" SET role=$1 WHERE id=$2', [role, actor.id]);
    const r = await request.post("/api/admin/articles", {
      headers: { origin },
      data: { ...input, slug: "cms-" + randomUUID() },
    });
    if (["EDITOR", "ADMIN", "SUPER_ADMIN"].includes(role)) {
      expect(r.status()).toBe(201);
      ids.push((await r.json()).id);
    } else expect(r.status()).toBe(403);
  }
  await sql("UPDATE \"User\" SET role='STAFF' WHERE id=$1", [actor.id]);
  const privatePreview = await request.get(`/admin/articles/${ids[0]}/preview`);
  expect(await privatePreview.text()).not.toContain(input.title);
  await sql("UPDATE \"User\" SET role='SUPER_ADMIN' WHERE id=$1", [actor.id]);
  expect(
    (
      await request.post("/api/admin/articles", {
        headers: { origin: "https://invalid.example" },
        data: input,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/admin/articles", {
        headers: { origin },
        data: { ...input, unknownRole: "SUPER_ADMIN" },
      })
    ).status(),
  ).toBe(400);
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,x",
    "https://user:password@example.test/path",
    "http://example.test/path",
  ]) {
    expect(
      (
        await request.post("/api/admin/articles", {
          headers: { origin },
          data: { ...input, references: [{ title: "危險來源", url }] },
        })
      ).status(),
    ).toBe(400);
  }
  expect(
    (
      await request.post("/api/admin/articles", {
        headers: { origin },
        data: { ...input, image: "https://example.test/track.svg" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/admin/articles", {
        headers: { origin },
        data: { ...input, summary: "x".repeat(66000) },
      })
    ).status(),
  ).toBe(413);
  expect(
    (await sql('SELECT id FROM "ArticleRecord" WHERE slug=$1', [input.slug]))
      .length,
  ).toBe(0);
});

test("CMS 重複網址、併發版本衝突與修訂歸屬", async ({ request }) => {
  await editor(request);
  const saved = await create(request),
    other = await create(request);
  expect(
    (
      await request.post("/api/admin/articles", {
        headers: { origin },
        data: saved.input,
      })
    ).status(),
  ).toBe(409);
  const changed = {
    ...saved.input,
    title: saved.input.title + "新版",
    version: 1,
  };
  const responses = await Promise.all([
    patch(request, saved.id, changed),
    patch(request, saved.id, changed),
  ]);
  expect(responses.map((r) => r.status()).sort()).toEqual([200, 409]);
  expect(
    (
      await sql('SELECT version FROM "ArticleRecord" WHERE id=$1', [saved.id])
    )[0].version,
  ).toBe(2);
  expect(
    (
      await sql('SELECT id FROM "ArticleRevision" WHERE "articleId"=$1', [
        saved.id,
      ])
    ).length,
  ).toBe(2);
  expect(
    (
      await patch(request, saved.id, {
        ...changed,
        version: 2,
        slug: "changed-" + randomUUID(),
      })
    ).status(),
  ).toBe(400);
  const revisions = await sql(
    'SELECT id FROM "ArticleRevision" WHERE "articleId"=$1',
    [other.id],
  );
  expect(
    (
      await request.post(`/api/admin/articles/${saved.id}/restore`, {
        headers: { origin },
        data: { revisionId: revisions[0].id, version: 2 },
      })
    ).status(),
  ).toBe(404);
  expect(
    (await sql('SELECT id FROM "AuditLog" WHERE "entityId"=$1', [saved.id]))
      .length,
  ).toBe(2);
});

test("排程時間到期即時可見、草稿與下架不回退至示範資料", async ({
  request,
}) => {
  await editor(request);
  const input = {
    ...article(),
    kind: "news" as const,
    status: "SCHEDULED" as const,
    publishAt: new Date(Date.now() + 86400000).toISOString(),
  };
  const saved = await create(request, input);
  expect((await request.get(`/news/${input.slug}`)).status()).toBe(404);
  expect(await (await request.get("/")).text()).not.toContain(input.title);
  expect(
    (
      await patch(request, saved.id, {
        ...input,
        version: 1,
        publishAt: "2000-01-01T00:00:00+08:00",
      })
    ).status(),
  ).toBe(400);
  await sql(
    'UPDATE "ArticleRecord" SET "publishAt"=now()-interval \'1 minute\' WHERE id=$1',
    [saved.id],
  );
  expect((await request.get(`/news/${input.slug}`)).status()).toBe(200);
  expect(await (await request.get("/")).text()).toContain(input.title);
  const unpublish = await patch(request, saved.id, {
    ...input,
    status: "DRAFT",
    publishAt: null,
    version: 1,
  });
  expect(unpublish.status()).toBe(200);
  expect((await request.get(`/news/${input.slug}`)).status()).toBe(404);
  const listing = await request.get(
    `/news?q=${encodeURIComponent(input.slug)}`,
  );
  expect(await listing.text()).toContain("沒有符合條件的文章");
});
