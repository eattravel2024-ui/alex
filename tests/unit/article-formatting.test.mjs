import test from "node:test";
import assert from "node:assert/strict";
import {
  parseInline,
  parseArticleParagraphs,
  safeArticleLink,
  applyArticleFormat,
} from "../../src/lib/article-formatting.ts";

const text = (value) => ({ type: "text", text: value });
const strong = (...children) => ({ type: "strong", children });
const em = (...children) => ({ type: "em", children });

test("舊文章的純文字、換行與 HTML 標籤保持文字，不產生 HTML 節點", () => {
  const paragraphs = ["中文與 English 123", "第一行\n第二行", '<img src=x onerror="alert(1)"><script>alert(1)</script>'];
  assert.deepEqual(parseArticleParagraphs(paragraphs), paragraphs.map((paragraph) => ({ type: "paragraph", children: [text(paragraph)] })));
  assert.deepEqual(parseInline(""), []);
});

test("粗體與斜體可相互巢狀，也可使用連續三個星號結尾", () => {
  assert.deepEqual(parseInline("閱讀 **粗體與 *斜體***。"), [
    text("閱讀 "), strong(text("粗體與 "), em(text("斜體"))), text("。"),
  ]);
  assert.deepEqual(parseInline("*斜體與 **粗體***"), [em(text("斜體與 "), strong(text("粗體")))]);
  assert.deepEqual(parseInline("***兩種格式***"), [strong(em(text("兩種格式")))]);
  assert.deepEqual(parseInline("**外層 *內層* 結束**"), [strong(text("外層 "), em(text("內層")), text(" 結束"))]);
  assert.deepEqual(parseInline("***粗體** 斜體*"), [em(strong(text("粗體")), text(" 斜體"))]);
  assert.deepEqual(parseInline("***斜體* 粗體**"), [strong(em(text("斜體")), text(" 粗體"))]);
});

test("跳脫字元及未配對的格式符號保持可讀", () => {
  assert.deepEqual(parseInline(String.raw`\*不是斜體\* 與 \[不是連結](https://example.test)`), [text("*不是斜體* 與 [不是連結](https://example.test)")]);
  for (const value of ["**未結束", "未開始**", "****", "* 文字 *", String.raw`原本\q`]) {
    assert.deepEqual(parseInline(value), [text(value)]);
  }
});

test("HTTPS 連結允許格式化標籤與括號路徑，原始 HTML 標籤仍是文字", () => {
  assert.deepEqual(parseInline('[**來源**與 *說明*](https://example.test/a_(b)?q=1#part)'), [{
    type: "link", href: "https://example.test/a_(b)?q=1#part",
    children: [strong(text("來源")), text("與 "), em(text("說明"))],
  }]);
  assert.deepEqual(parseInline('[<img src=x>](https://example.test)'), [{
    type: "link", href: "https://example.test/", children: [text("<img src=x>")],
  }]);
  assert.equal(safeArticleLink("HTTPS://EXAMPLE.TEST/path"), "https://example.test/path");
});

test("拒絕執行型、相對、非 HTTPS、憑證與被 URL 正規化隱藏的危險輸入", () => {
  const rejected = [
    "javascript:alert(1)", "data:text/html,<script>alert(1)</script>",
    "http://example.test", "//example.test", "/news", "https:example.test",
    "https:///example.test", " https://example.test", "https://example.test ",
    "https://name:secret@example.test", "https://name@example.test", "https://@example.test",
    "https://example.test\\@evil.test", "https://example.test/\npath",
    "https://example.test/\u0000path", "https://example.test/\u0085path",
    "https://example.test/%0apath", "https://example.test/%1fpath", "https://example.test/%7fpath",
    "https://", "https://example.test:invalid",
  ];
  for (const url of rejected) assert.equal(safeArticleLink(url), null, url);
  for (const url of rejected.filter((value) => !value.includes("\n"))) {
    const source = `[**來源**](${url})`;
    assert.deepEqual(parseInline(source), [text(source)], url);
  }
  assert.equal(safeArticleLink("https://example.test/%E4%B8%AD%E6%96%87"), "https://example.test/%E4%B8%AD%E6%96%87");
});

test("未完成的連結保持整段文字，且不建立巢狀連結", () => {
  assert.deepEqual(parseInline("[**來源**](https://example.test"), [text("[**來源**](https://example.test")]);
  const parsed = parseInline("[[內部](https://one.test)](https://two.test)");
  function nestedLink(nodes, inLink = false) {
    return nodes.some((node) => node.type === "link"
      ? inLink || nestedLink(node.children, true)
      : node.children && nestedLink(node.children, inLink));
  }
  assert.equal(nestedLink(parsed), false);
});

test("清單依連續行與種類分組，保留既有段落邊界及有序起始號碼", () => {
  assert.deepEqual(parseArticleParagraphs([
    "前言\n- 第一項\n- **第二項**\n\n3. 第三項\n4. 第四項\n結語",
    "- 下一段",
  ]), [
    { type: "paragraph", children: [text("前言")] },
    { type: "unordered-list", items: [[text("第一項")], [strong(text("第二項"))]] },
    { type: "ordered-list", start: 3, items: [[text("第三項")], [text("第四項")]] },
    { type: "paragraph", children: [text("結語")] },
    { type: "unordered-list", items: [[text("下一段")]] },
  ]);
  assert.deepEqual(parseArticleParagraphs(["- 不同種類\n1. 有序\n- 再次無序"]), [
    { type: "unordered-list", items: [[text("不同種類")]] },
    { type: "ordered-list", start: 1, items: [[text("有序")]] },
    { type: "unordered-list", items: [[text("再次無序")]] },
  ]);
});

test("沒有清單內容的符號、四格縮排與非支援語法不誤轉換", () => {
  for (const value of ["-", "- ", "1.", "0. 項目", "    - 縮排", "+ 項目", "# 標題"]) {
    assert.deepEqual(parseArticleParagraphs([value]), [{ type: "paragraph", children: [text(value)] }]);
  }
  assert.deepEqual(parseArticleParagraphs(["- 一\r\n- 二"]), [{ type: "unordered-list", items: [[text("一")], [text("二")]] }]);
});

test("深度與長篇未配對語法受限，不丟失文字或導致無限遞迴", () => {
  const nested = `${"**x *x ".repeat(80)}核心${"* x** ".repeat(80)}`;
  function depth(nodes) {
    return Math.max(0, ...nodes.map((node) => node.children ? 1 + depth(node.children) : 0));
  }
  assert.ok(depth(parseInline(nested)) <= 8);
  const long = "[".repeat(20_000) + "未結束 **";
  assert.deepEqual(parseInline(long), [text(long)]);
  const hugeDelimiter = "*".repeat(30_000);
  assert.deepEqual(parseInline(hugeDelimiter), [text(hugeDelimiter)]);
});

test("格式工具對選取文字加粗並選取內文，再次操作移除周圍格式", () => {
  const first = applyArticleFormat("健康生活", 2, 4, "bold");
  assert.deepEqual(first, { value: "健康**生活**", selectionStart: 4, selectionEnd: 6 });
  assert.deepEqual(applyArticleFormat(first.value, first.selectionStart, first.selectionEnd, "bold"), {
    value: "健康生活", selectionStart: 2, selectionEnd: 4,
  });
  assert.deepEqual(applyArticleFormat("**生活**", 0, 6, "bold"), { value: "生活", selectionStart: 0, selectionEnd: 2 });
  assert.deepEqual(applyArticleFormat("*生活*", 0, 4, "italic"), { value: "生活", selectionStart: 0, selectionEnd: 2 });
});

test("格式工具保留選取文字的外圍空白，斜體不誤取消粗體", () => {
  assert.deepEqual(applyArticleFormat("甲  生活  乙", 1, 7, "bold"), {
    value: "甲  **生活**  乙", selectionStart: 5, selectionEnd: 7,
  });
  const italic = applyArticleFormat("**生活**", 2, 4, "italic");
  assert.deepEqual(italic, { value: "***生活***", selectionStart: 3, selectionEnd: 5 });
  assert.deepEqual(applyArticleFormat(italic.value, italic.selectionStart, italic.selectionEnd, "italic"), {
    value: "**生活**", selectionStart: 2, selectionEnd: 4,
  });
});

test("空選取插入中文佔位文字，越界與逆向選取仍有效", () => {
  assert.deepEqual(applyArticleFormat("前後", 1, 1, "italic"), { value: "前*文字*後", selectionStart: 2, selectionEnd: 4 });
  assert.deepEqual(applyArticleFormat("內容", 99, -5, "bold"), { value: "**內容**", selectionStart: 2, selectionEnd: 4 });
  assert.deepEqual(applyArticleFormat("", Number.NaN, Number.POSITIVE_INFINITY, "bold"), { value: "**文字**", selectionStart: 2, selectionEnd: 4 });
});

test("清單工具只處理選中行，選取終點在下一行開頭不修改下一行", () => {
  assert.deepEqual(applyArticleFormat("前言\n第一\n第二\n結語", 4, 9, "unordered-list"), {
    value: "前言\n- 第一\n- 第二\n結語", selectionStart: 3, selectionEnd: 12,
  });
  assert.deepEqual(applyArticleFormat("甲\n乙\n丙", 2, 4, "ordered-list"), {
    value: "甲\n1. 乙\n丙", selectionStart: 2, selectionEnd: 6,
  });
});

test("清單工具可取消與轉換整组选中前綴，不重複堆疊符號", () => {
  const initial = "- 一\n- 二";
  assert.deepEqual(applyArticleFormat(initial, 0, initial.length, "unordered-list"), {
    value: "一\n二", selectionStart: 0, selectionEnd: 3,
  });
  assert.deepEqual(applyArticleFormat(initial, 0, initial.length, "ordered-list"), {
    value: "1. 一\n2. 二", selectionStart: 0, selectionEnd: 9,
  });
  const mixed = "3. 一\n普通文字\n- 三";
  assert.equal(applyArticleFormat(mixed, 0, mixed.length, "unordered-list").value, "- 一\n- 普通文字\n- 三");
  assert.equal(applyArticleFormat("  - 一\n\n  - 二", 0, 13, "unordered-list").value, "  一\n\n  二");
});

test("空行的清單佔位文字與首字為換行的選取不錯位", () => {
  assert.deepEqual(applyArticleFormat("", 0, 0, "ordered-list"), { value: "1. 文字", selectionStart: 3, selectionEnd: 5 });
  assert.deepEqual(applyArticleFormat("\n下一行", 0, 0, "unordered-list"), { value: "- 文字\n下一行", selectionStart: 2, selectionEnd: 4 });
  const whitespace = applyArticleFormat("    ", 0, 4, "unordered-list");
  assert.equal(whitespace.value, "   - 文字");
  assert.equal(whitespace.value.slice(whitespace.selectionStart, whitespace.selectionEnd), "文字");
});

test("跨空白段落格式化後，編輯器拆段仍各有有效格式且再次操作可取消", () => {
  for (const [format, marker, makeNode] of [["bold", "**", strong], ["italic", "*", em]]) {
    const initial = "跨段落甲\n\n跨段落乙";
    const first = applyArticleFormat(initial, 0, initial.length, format);
    assert.equal(first.value, `${marker}跨段落甲${marker}\n\n${marker}跨段落乙${marker}`);
    assert.deepEqual(parseArticleParagraphs(first.value.split(/\n\s*\n/)), [
      { type: "paragraph", children: [makeNode(text("跨段落甲"))] },
      { type: "paragraph", children: [makeNode(text("跨段落乙"))] },
    ]);
    assert.equal(applyArticleFormat(first.value, first.selectionStart, first.selectionEnd, format).value, initial);
  }
});

test("跨段落與清單的選取按行格式化，不把清單前綴包進星號", () => {
  const initial = "line\n- item\n\n2. next";
  const first = applyArticleFormat(initial, 0, initial.length, "bold");
  assert.equal(first.value, "**line**\n- **item**\n\n2. **next**");
  assert.deepEqual(parseArticleParagraphs(first.value.split(/\n\s*\n/)), [
    { type: "paragraph", children: [strong(text("line"))] },
    { type: "unordered-list", items: [[strong(text("item"))]] },
    { type: "ordered-list", start: 2, items: [[strong(text("next"))]] },
  ]);
  assert.equal(applyArticleFormat(first.value, first.selectionStart, first.selectionEnd, "bold").value, initial);
  assert.equal(applyArticleFormat("- item", 0, 6, "italic").value, "- *item*");
});

test("多個分散 wrapper 的選取不誤剝外側或產生四個星號", () => {
  for (const [format, marker, makeNode] of [["bold", "**", strong], ["italic", "*", em]]) {
    const initial = `${marker}one${marker} and ${marker}two${marker}`;
    const result = applyArticleFormat(initial, 0, initial.length, format);
    assert.equal(result.value, `${marker}one and two${marker}`);
    assert.deepEqual(parseInline(result.value), [makeNode(text("one and two"))]);
  }
});

test("三重星號完整選取取消指定格式，仍保留另一層可渲染格式", () => {
  const initial = "***text***";
  const italic = applyArticleFormat(initial, 0, initial.length, "italic");
  assert.equal(italic.value, "**text**");
  assert.deepEqual(parseInline(italic.value), [strong(text("text"))]);
  const bold = applyArticleFormat(initial, 0, initial.length, "bold");
  assert.equal(bold.value, "*text*");
  assert.deepEqual(parseInline(bold.value), [em(text("text"))]);
  const multiple = "*one* and *two*";
  assert.deepEqual(parseInline(applyArticleFormat(multiple, 0, multiple.length, "bold").value), [
    strong(em(text("one")), text(" and "), em(text("two"))),
  ]);
});

test("跨段落部分選取與外側 wrapper 的切換保留前後文字及範圍", () => {
  const initial = "前 one\n\n two 後";
  const result = applyArticleFormat(initial, 2, 11, "bold");
  assert.equal(result.value, "前 **one**\n\n **two** 後");
  assert.equal(applyArticleFormat(result.value, result.selectionStart, result.selectionEnd, "bold").value, initial);
  const wrapped = "**one**\n\n**two**";
  assert.equal(applyArticleFormat(wrapped, 2, wrapped.length - 2, "bold").value, "one\n\ntwo");
});
