import test from "node:test";
import assert from "node:assert/strict";
import { pageDefaults, heroDefaults, validatePageContent } from "../../src/lib/site-pages.ts";
test("舊頁面快照相容，介紹可排序但不能遺漏章節或全隱藏", () => {
  assert.deepEqual(validatePageContent("home", pageDefaults.home), pageDefaults.home);
  assert.deepEqual(validatePageContent("about", pageDefaults.about), pageDefaults.about);
  assert.doesNotThrow(() => validatePageContent("about", { ...pageDefaults.about, sections: [...pageDefaults.about.sections].reverse() }));
  for (const sections of [pageDefaults.about.sections.map((s) => ({ ...s, visible: false })), pageDefaults.about.sections.map(() => pageDefaults.about.sections[0])])
    assert.throws(() => validatePageContent("about", { ...pageDefaults.about, sections }));
  assert.throws(() => validatePageContent("home", { ...pageDefaults.home, sections: [...pageDefaults.home.sections].reverse() }));
});
test("首頁主視覺限制內建圖片與站內目的地，不接受執行型URL", () => {
  assert.doesNotThrow(() => validatePageContent("home", { ...pageDefaults.home, hero: heroDefaults }));
  for (const href of ["javascript:alert(1)", "//invalid.example", "https://invalid.example", "/api/admin/members/export"])
    assert.throws(() => validatePageContent("home", { ...pageDefaults.home, hero: { ...heroDefaults, primary: { label: "按鈕", href } } }));
  assert.throws(() => validatePageContent("home", { ...pageDefaults.home, hero: { ...heroDefaults, image: "https://invalid.example/image.svg" } }));
  assert.throws(() => validatePageContent("about", { ...pageDefaults.about, hero: heroDefaults }));
});
