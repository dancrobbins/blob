/**
 * Playwright fixture for two-tab sync test.
 *
 * Strategy:
 *   1. Try to connect to an existing browser via CDP (Cursor Browser or Chrome with --remote-debugging-port).
 *   2. If that fails, use chromium.launchPersistentContext() with a fresh temp dir.
 *      This gives an isolated context (no cached Google session) that both tabs share,
 *      so localStorage polling in the toast works correctly.
 *
 * Both tabs always open at SYNC_TEST_URL (localhost:3001/?e2eSync=1).
 * The normal dev tab at localhost:3000 is never touched.
 */

import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { test as base, chromium } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";

const CDP_URL = process.env.PLAYWRIGHT_CDP_URL ?? "http://127.0.0.1:9222";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const SYNC_TEST_URL = `${BASE_URL.replace(/\/$/, "")}/?e2eSync=1`;

const COMMON_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--no-sandbox",
  "--start-maximized",
];

function makeTempDir(): string {
  const dir = path.join(os.tmpdir(), `pw-blob-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Shared context + cleanup holder, lives for the duration of one test run.
let sharedCtx: BrowserContext | null = null;
let ctxTempDir: string | null = null;
let ctxIsOwned = false; // true = we launched it, false = CDP

async function getOrCreateContext(): Promise<BrowserContext> {
  if (sharedCtx) return sharedCtx;

  // --- Try CDP first ---
  try {
    const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5_000 });
    const contexts = browser.contexts();
    sharedCtx = contexts[0] ?? (await browser.newContext());
    ctxIsOwned = false;
    return sharedCtx;
  } catch {
    // CDP not available — launch a fresh isolated persistent context
  }

  ctxIsOwned = true;
  ctxTempDir = makeTempDir();

  const launchOpts = {
    headless: !!process.env.CI,
    args: COMMON_ARGS,
  };

  try {
    sharedCtx = await chromium.launchPersistentContext(ctxTempDir, {
      ...launchOpts,
      channel: process.env.CI ? undefined : "chrome",
    });
  } catch {
    // Fall back to Playwright's bundled Chromium
    sharedCtx = await chromium.launchPersistentContext(ctxTempDir, launchOpts);
  }

  return sharedCtx;
}

async function cleanupContext() {
  if (!ctxIsOwned || !sharedCtx) return;
  try { await sharedCtx.close(); } catch (_) {}
  sharedCtx = null;
  if (ctxTempDir) {
    try { fs.rmSync(ctxTempDir, { recursive: true, force: true }); } catch (_) {}
    ctxTempDir = null;
  }
  ctxIsOwned = false;
}

async function getTab(index: 0 | 1): Promise<Page> {
  const ctx = await getOrCreateContext();
  const pages = ctx.pages();
  if (pages[index]) {
    await pages[index].goto(SYNC_TEST_URL, { waitUntil: "domcontentloaded", timeout: 20_000 });
    return pages[index];
  }
  // Create missing tabs (newPage opens a blank tab in this context)
  while (ctx.pages().length <= index) {
    await ctx.newPage();
  }
  const page = ctx.pages()[index];
  await page.goto(SYNC_TEST_URL, { waitUntil: "domcontentloaded", timeout: 20_000 });
  return page;
}

export const test = base.extend<{
  tabA: Page;
  tabB: Page;
}>({
  // tabA must run before tabB (tabB depends on tabA to ensure the context exists)
  tabA: async ({}, use) => {
    const page = await getTab(0);
    await use(page);
  },

  tabB: async ({ tabA }, use) => {
    // tabA ensures the context is ready; tabB gets the second tab
    void tabA; // satisfy the dependency
    const page = await getTab(1);
    await use(page);
    // Cleanup after tabB teardown (last fixture to tear down)
    await cleanupContext();
  },
});

export { expect } from "@playwright/test";
