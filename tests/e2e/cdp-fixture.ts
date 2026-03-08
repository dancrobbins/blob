/**
 * Playwright fixture that connects to the existing Cursor Browser (or Chrome with
 * remote debugging) via CDP. All pages are tabs in that same browser — no new window.
 * Ensures two tabs exist at the sync test URL, opening/navigating them if needed.
 *
 * Usage: import { test, expect } from "./cdp-fixture";
 * Use fixtures tabA and tabB in the test.
 *
 * Requires PLAYWRIGHT_CDP_URL (default http://127.0.0.1:9222). The browser must already
 * be running with remote debugging (e.g. Cursor Browser or Chrome --remote-debugging-port=9222).
 */

import { test as base, chromium } from "@playwright/test";

const CDP_URL = process.env.PLAYWRIGHT_CDP_URL ?? "http://127.0.0.1:9222";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const SYNC_TEST_URL = `${BASE_URL.replace(/\/$/, "")}/?e2eSync=1`;

export const test = base.extend({
  browser: async ({}, use) => {
    let browser;
    try {
      browser = await chromium.connectOverCDP(CDP_URL, {
        timeout: 10_000,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Sync test runs only in the built-in Cursor Browser (no new window). ` +
          `Connect failed: ${msg}. ` +
          `Ensure the Cursor Browser is open and has remote debugging on port 9222, or set PLAYWRIGHT_CDP_URL.`
      );
    }
    await use(browser);
    // Do not close — browser is owned by Cursor/user
  },

  context: async ({ browser }, use) => {
    const contexts = browser.contexts();
    let ctx = contexts[0];
    if (!ctx) {
      ctx = await browser.newContext();
    }
    await use(ctx);
  },

  tabA: async ({ context }, use) => {
    const pages = context.pages();
    let tabA = pages[0];
    if (!tabA) {
      tabA = await context.newPage();
    }
    await tabA.goto(SYNC_TEST_URL, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await use(tabA);
  },

  tabB: async ({ context, tabA }, use) => {
    const pages = context.pages();
    let tabB = pages.length >= 2 ? pages[1] : null;
    if (!tabB) {
      tabB = await context.newPage();
    }
    await tabB.goto(SYNC_TEST_URL, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await use(tabB);
  },

  page: async ({ tabA }, use) => {
    await use(tabA);
  },
});

export { expect } from "@playwright/test";
