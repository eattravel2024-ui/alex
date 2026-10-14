import {
  test,
  expect,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import path from "node:path";
import sharp from "sharp";
import { createVerified, sql } from "./auth-helpers";
import { emptyArticle } from "../src/lib/article-validation";

const origin = "http://127.0.0.1:3000";
const maxFileBytes = 5 * 1024 * 1024;
const headers = { origin };
const articles: string[] = [];
const actors: string[] = [];
const media = new Map<string, APIRequestContext>();

type MediaItem = {
  id: string;
  url: string;
  altText: string;
  width: number;
  height: number;
  byteSize: number;
  version: number;
  used: boolean;
};

function article(image = emptyArticle.image as string, imageAlt = "") {
  const slug = "media-" + randomUUID();
  return {
    ...emptyArticle,
    slug,
    title: "媒體整合測試 " + slug,
    summary: "僅供本機媒體整合測試的文章摘要。",
    category: "媒體測試",
    image,
    imageAlt,
    blocks: [{ heading: "圖片測試", paragraphs: ["這篇文章由測試建立。"] }],
  };
}

async function editor(api: APIRequestContext) {
  const actor = await createVerified(api);
  actors.push(actor.id);
  await sql('UPDATE "User" SET role=\'EDITOR\' WHERE id=$1', [actor.id]);
  return actor;
}

async function raster(format: "jpeg" | "png" | "webp" = "png") {
  return sharp({
    create: {
      width: 64,
      height: 48,
      channels: 3,
      background: { r: 48, g: 130, b: 104 },
    },
  })
    .withMetadata()
    .toFormat(format)
    .toBuffer();
}

async function upload(
  api: APIRequestContext,
  altText = "整合測試圖片 " + randomUUID(),
  format: "jpeg" | "png" | "webp" = "png",
) {
  const response = await api.post("/api/admin/media", {
    headers,
    multipart: {
      file: {
        name: `fixture.${format}`,
        mimeType: `image/${format}`,
        buffer: await raster(format),
      },
      altText,
    },
  });
  expect(response.status()).toBe(201);
  const saved = (await response.json()) as MediaItem;
  media.set(saved.id, api);
  return saved;
}

async function createArticle(api: APIRequestContext, input = article()) {
  const response = await api.post("/api/admin/articles", { headers, data: input });
  expect(response.status()).toBe(201);
  const saved = await response.json();
  articles.push(saved.id);
  return saved as { id: string; version: number };
}

function patchArticle(api: APIRequestContext, id: string, data: unknown) {
  return api.patch(`/api/admin/articles/${id}`, { headers, data });
}

function mediaFile(id: string) {
  return path.join(
    process.env.MEDIA_STORAGE_DIR || path.resolve(".local/media"),
    `${id}.webp`,
  );
}

async function privateMedia(response: APIResponse) {
  expect(response.status()).toBe(404);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

// Explicit Transfer-Encoding exercises the streamed limit without Content-Length.
async function chunkedUpload(api: APIRequestContext, body: Buffer, boundary: string) {
  const state = await api.storageState();
  const cookie = state.cookies
    .filter((value) => ["127.0.0.1", "localhost"].includes(value.domain))
    .map((value) => `${value.name}=${value.value}`)
    .join("; ");
  return new Promise<number>((resolve, reject) => {
    const outgoing = httpRequest(
      origin + "/api/admin/media",
      {
        method: "POST",
        headers: {
          origin,
          cookie,
          "content-type": `multipart/form-data; boundary=${boundary}`,
          "transfer-encoding": "chunked",
        },
      },
      (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      },
    );
    outgoing.on("error", reject);
    outgoing.setTimeout(15000, () => outgoing.destroy(new Error("Upload timed out")));
    for (let offset = 0; offset < body.length; offset += 32 * 1024)
      outgoing.write(body.subarray(offset, offset + 32 * 1024));
    outgoing.end();
  });
}

test.afterEach(async () => {
  for (const id of actors)
    await sql('UPDATE "User" SET role=\'EDITOR\' WHERE id=$1', [id]);
  // Delete only this test's records. Historical revisions protect media too.
  for (const id of articles.splice(0)) {
    await sql('DELETE FROM "ArticleRevision" WHERE "articleId"=$1', [id]);
    await sql('DELETE FROM "ArticleRecord" WHERE id=$1', [id]);
  }
  for (const [id, api] of media) {
    const rows = await sql('SELECT version FROM "MediaAsset" WHERE id=$1', [id]);
    if (rows.length) {
      const response = await api.delete(`/api/admin/media/${id}`, {
        headers,
        data: { version: rows[0].version },
      });
      expect(response.status(), `Cleanup media ${id}`).toBe(200);
    }
  }
  media.clear();
  for (const id of actors.splice(0))
    await sql('UPDATE "User" SET role=\'MEMBER\' WHERE id=$1', [id]);
});

test("媒體 API 登入、內容角色、私人圖片與同來源保護", async ({ request }) => {
  const missing = randomUUID();
  expect((await request.get("/api/admin/media")).status()).toBe(401);
  expect((await request.post("/api/admin/media", { headers, multipart: {} })).status()).toBe(401);
  for (const method of ["patch", "delete"] as const)
    expect(
      (await request[method](`/api/admin/media/${missing}`, {
        headers,
        data: { version: 1, ...(method === "patch" ? { altText: "圖片" } : {}) },
      })).status(),
    ).toBe(401);

  const actor = await editor(request);
  const saved = await upload(request);
  for (const role of ["MEMBER", "STAFF", "EDITOR", "ADMIN", "SUPER_ADMIN"]) {
    await sql('UPDATE "User" SET role=$1 WHERE id=$2', [role, actor.id]);
    const allowed = ["EDITOR", "ADMIN", "SUPER_ADMIN"].includes(role);
    expect((await request.get("/api/admin/media")).status()).toBe(allowed ? 200 : 403);
    const image = await request.get(saved.url);
    if (allowed) {
      expect(image.status()).toBe(200);
      expect(image.headers()["cache-control"]).toContain("no-store");
      const extra = await upload(request, "角色測試 " + role);
      expect(extra.used).toBe(false);
    } else {
      await privateMedia(image);
      expect((await request.post("/api/admin/media", { headers, multipart: {} })).status()).toBe(403);
      expect((await request.patch(`/api/admin/media/${saved.id}`, { headers, data: { altText: "無權變更", version: 1 } })).status()).toBe(403);
      expect((await request.delete(`/api/admin/media/${saved.id}`, { headers, data: { version: 1 } })).status()).toBe(403);
      expect(await (await request.get("/admin/media")).text()).not.toContain(saved.altText);
    }
  }
  for (const badOrigin of ["https://invalid.example", undefined]) {
    const unsafeHeaders: Record<string, string> = badOrigin ? { origin: badOrigin } : {};
    expect((await request.post("/api/admin/media", { headers: unsafeHeaders, multipart: {} })).status()).toBe(403);
    expect((await request.patch(`/api/admin/media/${saved.id}`, { headers: unsafeHeaders, data: { version: 1, altText: "跨站修改" } })).status()).toBe(403);
    expect((await request.delete(`/api/admin/media/${saved.id}`, { headers: unsafeHeaders, data: { version: 1 } })).status()).toBe(403);
  }
  expect((await sql('SELECT version FROM "MediaAsset" WHERE id=$1', [saved.id]))[0].version).toBe(1);
});

test("圖片辨識、重新編碼、移除中繼資料與有無長度的上傳大小限制", async ({ request }) => {
  await editor(request);
  for (const format of ["jpeg", "png", "webp"] as const) {
    const saved = await upload(request, "安全圖片 " + format, format);
    expect(saved.url).toBe(`/media/${saved.id}`);
    expect(saved).toMatchObject({ width: 64, height: 48, version: 1, used: false });
    const output = await request.get(saved.url);
    expect(output.status()).toBe(200);
    expect(output.headers()["content-type"]).toContain("image/webp");
    expect(output.headers()["x-content-type-options"]).toBe("nosniff");
    const bytes = await output.body();
    expect(saved.byteSize).toBe(bytes.length);
    const metadata = await sharp(bytes).metadata();
    expect(metadata).toMatchObject({ format: "webp", width: 64, height: 48 });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
  }
  const fixtures = [
    { name: "spoof.png", mimeType: "image/png", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') },
    { name: "broken.jpeg", mimeType: "image/jpeg", buffer: (await raster("jpeg")).subarray(0, 32) },
    { name: "unsupported.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>') },
    { name: "mismatched.jpeg", mimeType: "image/jpeg", buffer: await raster("png") },
  ];
  for (const file of fixtures)
    expect((await request.post("/api/admin/media", { headers, multipart: { file, altText: "拒絕圖片" } })).status()).toBe(400);
  const tooLarge = Buffer.alloc(maxFileBytes + 1, 0x61);
  expect((await request.post("/api/admin/media", {
    headers,
    multipart: { file: { name: "too-large.png", mimeType: "image/png", buffer: tooLarge }, altText: "過大圖片" },
  })).status()).toBe(413);
  expect((await request.post("/api/admin/media", {
    headers,
    multipart: { file: { name: "small.png", mimeType: "image/png", buffer: await raster() }, altText: "a".repeat(maxFileBytes + 65537) },
  })).status()).toBe(413);
  const boundary = "media-test-" + randomUUID();
  const chunkedBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="large.png"\r\nContent-Type: image/png\r\n\r\n`),
    Buffer.alloc(maxFileBytes + 65537, 0x61),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  expect(await chunkedUpload(request, chunkedBody, boundary)).toBe(413);
  expect((await request.post("/api/admin/media", { headers, multipart: { altText: "缺少檔案" } })).status()).toBe(400);
});

test("刪除圖片不能重設每分鐘上傳限制", async ({ request }) => {
  const actor = await editor(request);
  for (let index = 0; index < 5; index++) {
    const saved = await upload(request, "限速測試 " + index);
    expect((await request.delete(`/api/admin/media/${saved.id}`, {
      headers, data: { version: 1 },
    })).status()).toBe(200);
  }
  const sixth = await request.post("/api/admin/media", {
    headers, multipart: {
      file: { name: "limited.png", mimeType: "image/png", buffer: await raster() },
      altText: "第六張圖片",
    },
  });
  expect(sixth.status()).toBe(429);
  expect(await sixth.json()).toMatchObject({ error: { code: "MEDIA_RATE_LIMIT" } });
  expect(await sql('SELECT id FROM "MediaAsset" WHERE "createdById"=$1', [actor.id])).toHaveLength(0);
  const actions = await sql('SELECT id FROM "AuditLog" WHERE "actorId"=$1 AND action=\'MEDIA_UPLOADED\'', [actor.id]);
  expect(actions).toHaveLength(5);
});

test("替代文字版本衝突、未使用圖片刪除檔案與稽核紀錄", async ({ request }) => {
  await editor(request);
  const saved = await upload(request);
  await access(mediaFile(saved.id));
  for (const data of [
    { altText: "", version: 1 },
    { altText: "a".repeat(161), version: 1 },
    { altText: "無效版本", version: 0 },
    { altText: "未知欄位", version: 1, role: "SUPER_ADMIN" },
  ])
    expect((await request.patch(`/api/admin/media/${saved.id}`, { headers, data })).status()).toBe(400);
  const first = await request.patch(`/api/admin/media/${saved.id}`, {
    headers,
    data: { altText: "更新圖片文字", version: saved.version },
  });
  expect(first.status()).toBe(200);
  expect(await first.json()).toMatchObject({ id: saved.id, altText: "更新圖片文字", version: 2 });
  expect((await request.patch(`/api/admin/media/${saved.id}`, { headers, data: { altText: "過期變更", version: 1 } })).status()).toBe(409);
  expect((await request.delete(`/api/admin/media/${saved.id}`, { headers, data: { version: 1 } })).status()).toBe(409);
  const concurrent = await Promise.all(["甲", "乙"].map((label) =>
    request.patch(`/api/admin/media/${saved.id}`, { headers, data: { altText: "併發修改 " + label, version: 2 } }),
  ));
  expect(concurrent.map((value) => value.status()).sort()).toEqual([200, 409]);
  expect((await sql('SELECT version FROM "MediaAsset" WHERE id=$1', [saved.id]))[0].version).toBe(3);
  expect((await request.delete(`/api/admin/media/${saved.id}`, { headers, data: { version: 3 } })).status()).toBe(200);
  expect(await sql('SELECT id FROM "MediaAsset" WHERE id=$1', [saved.id])).toHaveLength(0);
  await expect(access(mediaFile(saved.id))).rejects.toMatchObject({ code: "ENOENT" });
  await privateMedia(await request.get(saved.url));
  const actions = (await sql('SELECT action FROM "AuditLog" WHERE "entityId"=$1', [saved.id])).map((row) => row.action);
  expect(actions.sort()).toEqual([
    "MEDIA_DELETED", "MEDIA_UPDATED", "MEDIA_UPDATED", "MEDIA_UPLOADED",
  ]);
});

test("草稿、發布、下架、排程及歷史修訂保留圖片與替代文字", async ({ page, request }) => {
  await editor(page.request);
  const saved = await upload(page.request, "圖片原始描述");
  const bytes = await readFile(mediaFile(saved.id));
  await privateMedia(await request.get(saved.url));
  const missingInput = article(`/media/${randomUUID()}`);
  const missing = await page.request.post("/api/admin/articles", { headers, data: missingInput });
  expect(missing.status()).toBe(400);
  expect(await missing.json()).toMatchObject({ error: { code: "MEDIA_NOT_FOUND" } });
  expect(await sql('SELECT id FROM "ArticleRecord" WHERE slug=$1', [missingInput.slug])).toHaveLength(0);
  const input = article(saved.url);
  const created = await createArticle(page.request, input);
  const stored = (await sql('SELECT image,"imageAlt" FROM "ArticleRecord" WHERE id=$1', [created.id]))[0];
  expect(stored).toMatchObject({ image: saved.url, imageAlt: saved.altText });
  const original = (await sql('SELECT id,snapshot FROM "ArticleRevision" WHERE "articleId"=$1 AND version=1', [created.id]))[0];
  expect(original.snapshot.imageAlt).toBe(saved.altText);
  await privateMedia(await request.get(saved.url));
  await page.goto(`/admin/articles/${created.id}/preview`);
  await expect(page.locator(".detail-cover")).toHaveAttribute("src", saved.url);
  await expect(page.locator(".detail-cover")).toHaveAttribute("alt", saved.altText);
  await expect.poll(() => page.locator(".detail-cover").evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const published = { ...input, imageAlt: "文章自己的圖片描述", status: "PUBLISHED" };
  expect((await patchArticle(page.request, created.id, { ...published, version: 1 })).status()).toBe(200);
  const publicImage = await request.get(saved.url);
  expect(publicImage.status()).toBe(200);
  expect((await request.get(`/_next/image?url=${encodeURIComponent(saved.url)}&w=640&q=75`)).status()).toBe(400);
  expect(await publicImage.body()).toEqual(bytes);
  const html = await (await request.get(`/knowledge/${input.slug}`)).text();
  expect(html).toContain('alt="文章自己的圖片描述"');
  expect(html).toContain(`src="${saved.url}"`);
  expect((await page.request.delete(`/api/admin/media/${saved.id}`, { headers, data: { version: 1 } })).status()).toBe(409);
  expect((await patchArticle(page.request, created.id, { ...published, status: "ARCHIVED", version: 2 })).status()).toBe(200);
  await privateMedia(await request.get(saved.url));
  expect((await page.request.get(saved.url)).status()).toBe(200);
  expect((await patchArticle(page.request, created.id, { ...input, image: "/images/living.svg", status: "DRAFT", version: 3 })).status()).toBe(200);
  // Even after the current article stops referring to the image, an old revision uses it.
  expect((await page.request.delete(`/api/admin/media/${saved.id}`, { headers, data: { version: 1 } })).status()).toBe(409);
  expect((await page.request.post(`/api/admin/articles/${created.id}/restore`, { headers, data: { revisionId: original.id, version: 4 } })).status()).toBe(200);
  expect((await sql('SELECT image,"imageAlt",status,version FROM "ArticleRecord" WHERE id=$1', [created.id]))[0]).toMatchObject({ image: saved.url, imageAlt: saved.altText, status: "DRAFT", version: 5 });
  expect(await readFile(mediaFile(saved.id))).toEqual(bytes);
  await privateMedia(await request.get(saved.url));
  const scheduled = { ...input, status: "SCHEDULED", publishAt: new Date(Date.now() + 86400000).toISOString(), version: 5 };
  expect((await patchArticle(page.request, created.id, scheduled)).status()).toBe(200);
  await privateMedia(await request.get(saved.url));
  await sql('UPDATE "ArticleRecord" SET "publishAt"=now()-interval \'1 minute\' WHERE id=$1', [created.id]);
  expect((await request.get(saved.url)).status()).toBe(200);
  expect((await request.get(`/knowledge/${input.slug}`)).status()).toBe(200);
});

test("並行刪除與文章引用不會留下遺失的媒體", async ({ request }) => {
  await editor(request);
  const saved = await upload(request);
  const input = article(saved.url);
  const [deleted, created] = await Promise.all([
    request.delete(`/api/admin/media/${saved.id}`, { headers, data: { version: 1 } }),
    request.post("/api/admin/articles", { headers, data: input }),
  ]);
  if (created.status() === 201) {
    const record = await created.json();
    articles.push(record.id);
    expect(deleted.status()).toBe(409);
    expect(await sql('SELECT id FROM "MediaAsset" WHERE id=$1', [saved.id])).toHaveLength(1);
    await access(mediaFile(saved.id));
  } else {
    expect(created.status()).toBe(400);
    expect(deleted.status()).toBe(200);
    expect(await sql('SELECT id FROM "ArticleRecord" WHERE slug=$1', [input.slug])).toHaveLength(0);
  }
});

test("圖片庫上傳、選用、封面文字、私人預覽及公開圖片在各尺寸可用", async ({ page, request }, testInfo) => {
  await editor(page.request);
  const altText = "圖片庫測試 " + randomUUID();
  await page.goto("/admin/media");
  await page.getByLabel("圖片檔案", { exact: true }).setInputFiles({ name: "library.png", mimeType: "image/png", buffer: await raster() });
  await page.getByLabel("圖片替代文字", { exact: true }).fill(altText);
  const uploaded = page.waitForResponse((response) => response.url().endsWith("/api/admin/media") && response.request().method() === "POST");
  await page.getByRole("button", { name: "上傳圖片", exact: true }).click();
  const uploadResponse = await uploaded;
  expect(uploadResponse.status()).toBe(201);
  const saved = (await uploadResponse.json()) as MediaItem;
  media.set(saved.id, page.request);
  const card = page.getByRole("article", { name: altText, exact: true });
  await expect(card).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("media-library.png"), fullPage: true });
  const updatedAlt = altText + " 已更新";
  await card.getByLabel("編輯圖片替代文字", { exact: true }).fill(updatedAlt);
  const updated = page.waitForResponse((response) => response.url().endsWith(`/api/admin/media/${saved.id}`) && response.request().method() === "PATCH");
  await card.getByRole("button", { name: "儲存替代文字", exact: true }).click();
  expect((await updated).status()).toBe(200);
  const input = article();
  await page.goto("/admin/articles/new");
  await page.getByLabel("網址識別碼（英文小寫與連字號）").fill(input.slug);
  await page.getByLabel("文章標題", { exact: true }).fill(input.title);
  await page.getByLabel("文章摘要").fill(input.summary);
  await page.getByLabel("區塊 1 標題").fill(input.blocks[0].heading);
  await page.getByLabel("區塊 1 段落", { exact: true }).fill(input.blocks[0].paragraphs[0]);
  await page.getByRole("button", { name: "選擇媒體圖片", exact: true }).click();
  await page.getByLabel("搜尋圖片替代文字", { exact: true }).fill(updatedAlt);
  await page.getByRole("button", { name: "搜尋圖片", exact: true }).click();
  const choice = page.getByRole("article", { name: updatedAlt, exact: true });
  await expect(choice).toBeVisible();
  await noOverflow(page);
  await page.locator(".media-picker").screenshot({ path: testInfo.outputPath("cover-picker.png") });
  await choice.getByRole("button", { name: "使用此圖片", exact: true }).click();
  await expect(page.getByLabel("封面替代文字", { exact: true })).toHaveValue(updatedAlt);
  const coverAlt = updatedAlt + ' <img src=x onerror="window.__mediaPwned=1">';
  await page.getByLabel("封面替代文字", { exact: true }).fill(coverAlt);
  const created = page.waitForResponse((response) => response.url().endsWith("/api/admin/articles") && response.request().method() === "POST");
  await page.getByRole("button", { name: "儲存文章", exact: true }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const record = await response.json();
  articles.push(record.id);
  await expect(page).toHaveURL(`/admin/articles/${record.id}`);
  await privateMedia(await request.get(saved.url));
  await page.getByRole("link", { name: "預覽已儲存版本", exact: true }).click();
  await expect(page.locator(".detail-cover")).toHaveAttribute("alt", coverAlt);
  await expect(page.locator(".detail-cover")).toHaveAttribute("src", saved.url);
  await expect(page.locator(".detail-cover")).toBeVisible();
  await expect.poll(() => page.locator(".detail-cover").evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(64);
  expect(await page.evaluate(() => Object.hasOwn(window, "__mediaPwned"))).toBe(false);
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("uploaded-cover-preview.png"), fullPage: true });
  await page.goto(`/admin/articles/${record.id}`);
  await page.getByLabel("發布狀態", { exact: true }).selectOption("PUBLISHED");
  const published = page.waitForResponse((value) => value.url().endsWith(`/api/admin/articles/${record.id}`) && value.request().method() === "PATCH");
  await page.getByRole("button", { name: "儲存文章", exact: true }).click();
  expect((await published).status()).toBe(200);
  expect((await request.get(saved.url)).status()).toBe(200);
  await page.goto(`/knowledge/${input.slug}`);
  await expect(page.locator(".detail-cover")).toHaveAttribute("alt", coverAlt);
  await expect(page.locator(".detail-cover")).toHaveAttribute("src", saved.url);
  await noOverflow(page);
  await page.goto("/admin/media");
  const used = page.getByRole("article", { name: updatedAlt, exact: true });
  await expect(used.getByText("文章或歷史版本使用中，無法刪除。", { exact: true })).toBeVisible();
  await expect(used.getByRole("button", { name: "刪除圖片", exact: true })).toHaveCount(0);
});

test("文章編輯器直接上傳選用圖片與圖片庫確認刪除", async ({ page }) => {
  await editor(page.request);
  const altText = "編輯器上傳 " + randomUUID();
  await page.goto("/admin/articles/new");
  await page.getByRole("button", { name: "選擇媒體圖片", exact: true }).click();
  // A native selection may exist before React receives a change event.
  await page.getByLabel("圖片檔案", { exact: true }).evaluate((element, bytes) => {
    const selected = new DataTransfer();
    selected.items.add(new File([new Uint8Array(bytes)], "editor.webp", { type: "image/webp" }));
    (element as HTMLInputElement).files = selected.files;
  }, [...await raster("webp")]);
  await page.getByLabel("圖片替代文字", { exact: true }).fill(altText);
  const uploaded = page.waitForResponse((response) => response.url().endsWith("/api/admin/media") && response.request().method() === "POST");
  await page.getByRole("button", { name: "上傳圖片", exact: true }).click();
  const response = await uploaded;
  expect(response.status()).toBe(201);
  const saved = (await response.json()) as MediaItem;
  media.set(saved.id, page.request);
  await expect(page.getByLabel("封面替代文字", { exact: true })).toHaveValue(altText);
  await expect(page.getByRole("button", { name: "上傳圖片", exact: true })).toHaveCount(0);
  await noOverflow(page);
  await page.goto("/admin/media");
  const card = page.getByRole("article", { name: altText, exact: true });
  await expect(card.getByRole("button", { name: "刪除圖片", exact: true })).toBeDisabled();
  await card.getByLabel("確認刪除此圖片", { exact: true }).check();
  const deleted = page.waitForResponse((value) => value.url().endsWith(`/api/admin/media/${saved.id}`) && value.request().method() === "DELETE");
  await card.getByRole("button", { name: "刪除圖片", exact: true }).click();
  expect((await deleted).status()).toBe(200);
  await expect(card).toHaveCount(0);
  expect(await sql('SELECT id FROM "MediaAsset" WHERE id=$1', [saved.id])).toHaveLength(0);
  await expect(access(mediaFile(saved.id))).rejects.toMatchObject({ code: "ENOENT" });
});
