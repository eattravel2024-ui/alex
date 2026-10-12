import test from "node:test";
import assert from "node:assert/strict";
import {
  allArticles,
  selectArticles,
  contentUrl,
  eventRecords,
  eventMonth,
  selectEvents,
} from "../../src/lib/catalog.ts";
import {
  siteOrigin,
  pageMetadata,
  serializeStructuredData,
} from "../../src/lib/seo.ts";
test("搜尋涵蓋內文，分類與標籤共同限制結果", () => {
  const result = selectArticles("knowledge", {
    q: "  疾病 ",
    category: "營養與飲食",
    tag: "均衡飲食",
  });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].slug, "balanced-eating");
  assert.equal(selectArticles("knowledge", { q: "不存在的詞" }).total, 0);
});
test("分頁輸入正規化，越界不會產生空白假頁", () => {
  assert.equal(selectArticles("knowledge", { page: "2" }).items.length, 2);
  for (const value of ["-1", "1e3", "NaN", "0", "1.5"])
    assert.equal(selectArticles("knowledge", { page: value }).page, 1);
  assert.equal(selectArticles("knowledge", { page: "999999" }).page, 2);
  assert.equal(
    selectArticles("knowledge", { q: ["生活", "忽略"], category: "無此分類" })
      .total,
    0,
  );
});
test("連結保留篩選且正確編碼特殊字元", () => {
  const url = new URL(
    contentUrl("/knowledge", { q: "A&B <script>", tag: "生活習慣", page: 2 }),
    "https://example.test",
  );
  assert.equal(url.searchParams.get("q"), "A&B <script>");
  assert.equal(url.searchParams.get("tag"), "生活習慣");
  assert.equal(url.searchParams.get("page"), "2");
});
test("所有 fixtures 有唯一 URL，健康文章標示未審閱", () => {
  assert.equal(
    new Set(allArticles.map((a) => a.kind + "/" + a.slug)).size,
    allArticles.length,
  );
  assert.ok(
    allArticles
      .filter((a) => a.kind === "knowledge")
      .every((a) => a.reviewedAt === null && a.references.length),
  );
});
test("活動月份跨年與台灣時區正確，分類可過濾", () => {
  assert.equal(eventMonth(eventRecords[0]), "2026-12");
  assert.equal(
    eventMonth({ ...eventRecords[0], startsAt: "2026-12-31T16:30:00Z" }),
    "2027-01",
  );
  assert.equal(selectEvents({ category: "專業交流" }).length, 1);
  assert.equal(selectEvents({ q: "不存在" }).length, 0);
});
test("未提供 Domain 不虛構 canonical；Domain 需為無 credentials HTTPS origin", () => {
  assert.equal(siteOrigin(""), undefined);
  assert.equal(siteOrigin("https://example.test/"), "https://example.test");
  for (const value of [
    "http://example.test",
    "https://user:password@example.test",
    "https://example.test/path",
    "https://example.test/?token=x",
  ])
    assert.throws(() => siteOrigin(value));
  const previous = process.env.APP_URL;
  delete process.env.APP_URL;
  assert.equal(pageMetadata("標題", "說明", "/news").alternates, undefined);
  if (previous !== undefined) process.env.APP_URL = previous;
});
test("JSON-LD escaped text 無法關閉 script 元素", () => {
  const json = serializeStructuredData({
    name: "</script><script>alert(1)</script>",
  });
  assert.equal(json.includes("<"), false);
  assert.equal(JSON.parse(json).name, "</script><script>alert(1)</script>");
});
