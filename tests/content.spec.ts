import { test, expect } from "@playwright/test";
test("知識文章搜尋、分類、清除篩選与分頁", async ({ page }) => {
  await page.goto("/knowledge");
  await expect(page.locator(".article-card")).toHaveCount(3);
  await page.getByRole("link", { name: "第 2 頁", exact: true }).click();
  await expect(page.locator(".article-card")).toHaveCount(2);
  await page.getByLabel("搜尋文章").fill("吃飯");
  await page.getByRole("button", { name: "搜尋", exact: true }).click();
  await expect(page.locator(".article-card")).toHaveCount(1);
  await page.getByLabel("文章分類").selectOption("心理健康");
  await page.getByRole("button", { name: "搜尋", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "沒有符合條件的文章" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "清除篩選" }).click();
  await expect(page.locator(".article-card")).toHaveCount(3);
  await page.getByLabel("文章分類").selectOption("營養與飲食");
  await page.getByRole("button", { name: "搜尋", exact: true }).click();
  await expect(page.locator(".article-card")).toHaveCount(1);
  await page.locator(".article-card").getByRole("link").click();
  await expect(page).toHaveURL(/\/knowledge\/balanced-eating$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "好好吃飯，是照顧自己的第一步",
  );
  await expect(page.getByText("最後審閱日期：尚未專業審閱")).toBeVisible();
  await page.getByRole("link", { name: "#生活習慣" }).click();
  await expect(page).toHaveURL(/tag=/);
  await expect(page.getByText("標籤：生活習慣")).toBeVisible();
});
test("消息全文、分享與未知文章404", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/news");
  await page.locator(".article-card").first().getByRole("link").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "網站示範版本開放瀏覽",
  );
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
    "content",
    "article",
  );
  await page.getByRole("button", { name: "複製分享連結" }).click();
  await expect(page.locator(".share-control").getByRole("status")).toHaveText(
    "文章連結已複製。",
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "http://127.0.0.1:3000/news/website-preview",
  );
  const response = await page.goto("/news/unknown-article");
  expect(response?.status()).toBe(404);
});
test("活動月曆跨年、分類、詳情與未開放報名狀態", async ({ page, isMobile }) => {
  await page.goto("/events");
  await expect(page.locator(".event-list-card")).toHaveCount(3);
  await page.getByRole("link", { name: "月曆", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "2026 年 12 月" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "下個月" }).click();
  await expect(
    page.getByRole("heading", { name: "2027 年 1 月" }),
  ).toBeVisible();
  await expect(page.locator(".event-calendar tbody a")).toHaveCount(2);
  await expect(
    page.getByRole("region", { name: "活動月曆，可左右捲動" }),
  ).toHaveAttribute("tabindex", "0");
  if (isMobile) {
    await expect(page.locator(".calendar-agenda")).toBeVisible();
    await expect(page.locator(".calendar-agenda a")).toHaveCount(2);
  }
  await page.getByLabel("活動分類").selectOption("專業交流");
  await page.getByRole("button", { name: "搜尋", exact: true }).click();
  await expect(page.locator(".event-calendar tbody a")).toHaveCount(1);
  await page.locator(".event-calendar tbody a").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "健康管理的跨領域對話",
  );
  await expect(page.locator(".registration-status")).toContainText(
    "報名尚未開放",
  );
  await expect(page.locator(".event-info-panel time").first()).toHaveAttribute(
    "datetime",
    "2027-01-23T14:00:00+08:00",
  );
  await expect(page.locator(".event-info-panel time").first()).toContainText(
    "14:00",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("關於協會與聯絡FAQ不虛構資料或接受提交", async ({ page }) => {
  await page.goto("/about");
  await expect(
    page.getByRole("heading", { name: "理事長、理監事與顧問團隊" }),
  ).toBeVisible();
  await expect(
    page.getByText("姓名、職稱、照片、任期與介紹皆待本人及協會授權確認。", {
      exact: false,
    }),
  ).toBeVisible();
  await page.goto("/contact");
  await page
    .getByText("網站帳號是否等於協會正式會員？", { exact: true })
    .click();
  await expect(page.locator("details").first()).toHaveAttribute("open", "");
  await expect(page.locator("details").first()).toContainText("不是。");
  await expect(page.locator("form")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("搜尋輸入安全顯示、robots預設禁止索引、sitemap不虛構Domain", async ({
  page,
  request,
}) => {
  await page.goto(
    "/knowledge?q=" + encodeURIComponent("<script>alert(1)</script>"),
  );
  await expect(page.getByLabel("搜尋文章")).toHaveValue(
    "<script>alert(1)</script>",
  );
  await expect(
    page.getByRole("heading", { name: "沒有符合條件的文章" }),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Disallow: /");
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).not.toContain("<loc>");
});
