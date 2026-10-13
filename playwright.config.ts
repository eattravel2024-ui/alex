import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  workers: 2,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      testIgnore: "**/cms.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      testIgnore: "**/cms.spec.ts",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
    {
      name: "cms-desktop",
      testMatch: "**/cms.spec.ts",
      dependencies: ["desktop", "mobile"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "cms-mobile",
      testMatch: "**/cms.spec.ts",
      dependencies: ["desktop", "mobile"],
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "HOSTNAME=127.0.0.1 npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
