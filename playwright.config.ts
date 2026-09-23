import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "phone-chromium",
      use: {
        ...devices["Pixel 7"]
      }
    },
    ...(process.env.PLAYWRIGHT_CROSS_BROWSER
      ? [
          {
            name: "phone-firefox",
            use: {
              browserName: "firefox" as const,
              viewport: { width: 412, height: 915 },
              hasTouch: true
            }
          },
          {
            name: "phone-webkit",
            use: {
              ...devices["iPhone 13"],
              browserName: "webkit" as const
            }
          }
        ]
      : [])
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev:e2e",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000
      }
});
