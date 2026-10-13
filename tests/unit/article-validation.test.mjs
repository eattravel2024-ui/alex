import test from "node:test";
import assert from "node:assert/strict";
import {
  articleInputSchema,
  emptyArticle,
} from "../../src/lib/article-validation.ts";
const valid = {
  ...emptyArticle,
  slug: "safe-test",
  title: "示範文章",
  summary: "合法的示範文章摘要",
  blocks: [{ heading: "小標題", paragraphs: ["本文僅供開發測試。"] }],
};
test("CMS 拒絕執行型來源與外部封面，不接受移除示範標記", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,test",
    "http://example.test",
    "https://name:secret@example.test",
  ]) {
    assert.equal(
      articleInputSchema.safeParse({
        ...valid,
        references: [{ title: "來源", url }],
      }).success,
      false,
    );
  }
  assert.equal(
    articleInputSchema.safeParse({
      ...valid,
      references: [{ title: "來源", url: "https://www.who.int/health-topics" }],
    }).success,
    true,
  );
  assert.equal(
    articleInputSchema.safeParse({ ...valid, image: "/uploads/untrusted.svg" })
      .success,
    false,
  );
  assert.equal(
    articleInputSchema.safeParse({ ...valid, isDemo: false }).success,
    false,
  );
});
test("CMS 區塊與段落限制、標籤去重與無效日期", () => {
  assert.equal(
    articleInputSchema.safeParse({ ...valid, blocks: [] }).success,
    false,
  );
  assert.equal(
    articleInputSchema.safeParse({
      ...valid,
      blocks: [{ heading: "標題", paragraphs: [" "] }],
    }).success,
    false,
  );
  assert.equal(
    articleInputSchema.safeParse({
      ...valid,
      blocks: Array(21).fill(valid.blocks[0]),
    }).success,
    false,
  );
  assert.equal(
    articleInputSchema.safeParse({ ...valid, reviewedAt: "2026-02-30" })
      .success,
    false,
  );
  assert.deepEqual(
    articleInputSchema.parse({ ...valid, tags: ["生活", " 生活 "] }).tags,
    ["生活"],
  );
});
