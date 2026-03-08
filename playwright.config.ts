import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

/** Sync poll interval is 10s; allow time for sync + one retry. */
const SYNC_WAIT_MS = 15_000;

/**
 * Sync spec (google-sync-two-tab.spec.ts) imports tests/e2e/cdp-fixture.ts and connects
 * to the existing Cursor Browser via CDP — it never launches a new window. Only tabs
 * in that browser are used. PLAYWRIGHT_CDP_URL defaults to http://127.0.0.1:9222.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "test-results/sync-results.json" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },
  timeout: 120_000,
  expect: { timeout: SYNC_WAIT_MS },
  projects: [
    {
      name: "default",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /google-sync-two-tab\.spec\.ts/,
    },
    {
      name: "ci",
      use: {
        ...devices["Desktop Chrome"],
        storageState: ".auth/user.json",
      },
      testMatch: /google-sync-two-tab\.spec\.ts/,
    },
  ],
});
