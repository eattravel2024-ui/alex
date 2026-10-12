import { test, expect } from "@playwright/test";
test("首頁具可閱讀內容、示範聲明與安全標頭", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  await expect(page).toHaveTitle(/中華健康管理協會/);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hant");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "美好日常",
  );
  await expect(page.locator(".demo-notice")).toContainText("正式資料待確認");
  await expect(page.locator(".article-card")).toHaveCount(3);
  await expect(page.locator(".event-row")).toHaveCount(3);
  await expect(
    page.getByRole("heading", { name: "會員服務建置中" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("導覽可前往內容且手機選單支援關閉", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) {
    await page.getByRole("button", { name: "開啟選單" }).click();
    await expect(page.locator("#primary-navigation")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "開啟選單" }),
    ).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("button", { name: "開啟選單" }).click();
  }
  await page
    .locator("#primary-navigation")
    .getByRole("link", { name: "健康知識" })
    .click();
  await expect(page).toHaveURL(/#knowledge$/);
  if (isMobile)
    await expect(
      page.getByRole("button", { name: "開啟選單" }),
    ).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByRole("heading", { name: "給生活一點健康靈感" }),
  ).toBeInViewport();
  await page.getByRole("button", { name: "返回頂部" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
});
test("法律頁標示草案且未知路由回傳404", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "隱私權政策草案",
  );
  await expect(page.getByText("DRAFT · 尚未正式生效")).toBeVisible();
  await page.goto("/terms");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "服務條款草案",
  );
  const response = await page.goto("/does-not-exist");
  expect(response?.status()).toBe(404);
  await page.getByRole("link", { name: "返回首頁" }).click();
  await expect(page).toHaveURL("/");
});
test("減少動態效果設定與鍵盤跳過導覽", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "跳至主要內容" })).toBeFocused();
  expect(
    await page
      .locator("html")
      .evaluate((e) => getComputedStyle(e).scrollBehavior),
  ).toBe("auto");
});
