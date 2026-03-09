import { test, expect } from "./cdp-fixture";

const SYNC_WAIT_MS = 14_000;
/** Time allowed for you to log in to Google in both tabs. */
const LOGIN_WAIT_MS = 5 * 60 * 1000; // 5 minutes
const E2E_RUNNING_KEY = "e2eSyncRunning";
const E2E_CANCEL_KEY = "e2eSyncCancel";
// Must match STORAGE_KEY in TwoTabLoginToast.tsx
const AUTH_STORAGE_KEY = "e2eSyncAuthTabs";

function assertNotCancelled(page: { evaluate: (fn: (key: string) => string | null, key: string) => Promise<string | null> }) {
  return page.evaluate((key: string) => localStorage.getItem(key), E2E_CANCEL_KEY).then((v) => {
    if (v === "1") throw new Error("Test cancelled by user");
  });
}

/** Delete all existing blobs so each test run starts clean. */
async function clearAllBlobs(page: import("@playwright/test").Page) {
  // Dismiss any open menus first
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // Keep deleting until no blob cards remain
  for (let i = 0; i < 50; i++) {
    const cards = page.getByTestId("blob-card");
    const count = await cards.count();
    if (count === 0) break;
    const options = cards.first().getByTestId("blob-options");
    if (await options.count() === 0) break;
    await options.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(200);
    const deleteBtn = page.getByTestId("blob-menu-delete");
    if (await deleteBtn.count() === 0) {
      await page.keyboard.press("Escape");
      break;
    }
    await deleteBtn.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(200);
    const confirmBtn = page.getByTestId("confirm-dialog-confirm");
    if (await confirmBtn.count() > 0) {
      await confirmBtn.click({ timeout: 3000 }).catch(() => {});
    }
    await page.waitForTimeout(400);
  }
}

/** Click an empty area of the canvas to create a new blob. */
async function createBlobAt(page: import("@playwright/test").Page, x: number, y: number) {
  // Clicking inside an existing blob or header won't create one — aim at clearly empty space
  await page.getByTestId("canvas").click({ position: { x, y }, force: true });
  await page.waitForTimeout(600);
}

test.describe("Two-tab Google sync", () => {
  test("syncs text edits, blob create/delete, theme, lock/unlock, hide/show across tabs", async ({
    tabA,
    tabB,
  }) => {
    // Clear any stale auth tokens from previous runs
    await tabA.evaluate((key: string) => localStorage.removeItem(key), AUTH_STORAGE_KEY);
    await tabB.evaluate((key: string) => localStorage.removeItem(key), AUTH_STORAGE_KEY);

    await tabA.evaluate((key: string) => localStorage.setItem(key, "1"), E2E_RUNNING_KEY);
    await tabB.evaluate((key: string) => localStorage.setItem(key, "1"), E2E_RUNNING_KEY);
    await tabA.evaluate((key: string) => localStorage.removeItem(key), E2E_CANCEL_KEY);
    await tabB.evaluate((key: string) => localStorage.removeItem(key), E2E_CANCEL_KEY);

    // --- Wait for both tabs to be logged in ---
    // After Google OAuth the browser may open a callback tab. We poll for userId
    // directly (via the app's context) and reload tabs as needed so the session
    // is picked up even if the OAuth redirect landed in a different tab.
    console.log("Waiting for both tabs to log in to Google (up to 5 min)...");

    async function waitForLogin(page: import("@playwright/test").Page, label: string) {
      const deadline = Date.now() + LOGIN_WAIT_MS;
      while (Date.now() < deadline) {
        // evaluate can throw if the page is mid-navigation
        let loggedIn = false;
        try {
          loggedIn = await page.evaluate(() => {
            // Check all localStorage keys for a Supabase session
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i) ?? "";
              if (k.includes("supabase") || k.includes("sb-")) {
                const v = localStorage.getItem(k) ?? "";
                if (v.includes("access_token")) return true;
              }
            }
            return false;
          });
        } catch {
          await page.waitForTimeout(2000);
          continue;
        }

        if (!loggedIn) {
          // Debug: log all localStorage keys to help diagnose detection issues
          try {
            const keys = await page.evaluate(() => {
              const result: string[] = [];
              for (let i = 0; i < localStorage.length; i++) {
                result.push(localStorage.key(i) ?? "");
              }
              return result;
            });
            const authKeys = keys.filter(k => k.includes("supabase") || k.includes("sb-") || k.includes("auth"));
            if (authKeys.length > 0) console.log(`${label}: found keys: ${authKeys.join(", ")}`);
          } catch (_) {}

          // Also check if the page currently shows the app (post-login redirect complete)
          // by looking for the account button which only appears when logged in
          const url = page.url();
          if (url.includes("/auth/callback") || url.includes("code=")) {
            // Mid-redirect — wait for it to complete
            await page.waitForURL("**/", { timeout: 10_000 }).catch(() => {});
            continue;
          }
        }

        if (loggedIn) {
          console.log(`${label}: logged in ✓`);
          return;
        }
        console.log(`${label}: not yet logged in, waiting...`);
        await page.waitForTimeout(5000);
      }
      throw new Error(`${label}: timed out waiting for Google login`);
    }

    // Check Tab A first — if the toast isn't visible, we may already be logged in
    const toastVisible = await tabA.getByTestId("e2e-login-toast").isVisible({ timeout: 3000 }).catch(() => false);
    if (toastVisible) {
      await waitForLogin(tabA, "Tab A");
      await waitForLogin(tabB, "Tab B");
    }
    await assertNotCancelled(tabA);

    // Dismiss the login toast if still showing (it's cosmetic at this point — both tabs are confirmed logged in)
    await tabA.keyboard.press("Escape");
    await tabB.keyboard.press("Escape");
    await tabA.waitForTimeout(300);

    // --- Start from a clean state ---
    await clearAllBlobs(tabA);
    await tabA.waitForTimeout(2000);

    // --- Theme: set dark on Tab A, verify on Tab B ---
    // Click main-menu, wait for it to open (aria-expanded=true), then click theme
    await tabA.getByTestId("main-menu").click();
    await expect(tabA.getByTestId("main-menu")).toHaveAttribute("aria-expanded", "true", { timeout: 5000 });
    await tabA.getByTestId("theme-dark").click({ force: true });
    await tabA.waitForTimeout(SYNC_WAIT_MS);

    await assertNotCancelled(tabB);
    await tabB.reload({ waitUntil: "domcontentloaded" });
    await tabB.waitForTimeout(2000);
    await tabB.getByTestId("main-menu").click();
    await expect(tabB.getByTestId("main-menu")).toHaveAttribute("aria-expanded", "true", { timeout: 5000 });
    const darkTab = tabB.getByTestId("theme-dark");
    await expect(darkTab).toHaveAttribute("aria-selected", "true", { timeout: 5000 });
    await tabB.keyboard.press("Escape");
    await tabB.waitForTimeout(300);

    // --- Blob create + text edit: create on Tab A, verify text on Tab B ---
    await assertNotCancelled(tabA);
    await createBlobAt(tabA, 200, 250);
    const blobA = tabA.getByTestId("blob-card").first();
    await expect(blobA).toBeVisible({ timeout: 5000 });
    const contentA = blobA.getByTestId("blob-content");
    await contentA.click();
    // Clear existing content and type new text
    await tabA.keyboard.press("Control+A");
    await tabA.keyboard.type("Synced note from tab A");
    await tabA.keyboard.press("Escape");
    await tabA.waitForTimeout(SYNC_WAIT_MS);

    await assertNotCancelled(tabB);
    await tabB.reload({ waitUntil: "domcontentloaded" });
    await tabB.waitForTimeout(2000);
    await expect(
      tabB.getByTestId("blob-content").filter({ hasText: "Synced note from tab A" })
    ).toBeVisible({ timeout: SYNC_WAIT_MS });

    // --- Blob delete: delete on Tab B, verify gone on Tab A ---
    await assertNotCancelled(tabB);
    const cardToDelete = tabB.getByTestId("blob-card").filter({
      has: tabB.getByTestId("blob-content").filter({ hasText: "Synced note from tab A" }),
    });
    const blobIdToDelete = await cardToDelete.getAttribute("data-blob-id");
    await cardToDelete.getByTestId("blob-options").click();
    await tabB.getByTestId("blob-menu-delete").click();
    const confirmBtn = tabB.getByTestId("confirm-dialog-confirm");
    if (await confirmBtn.count() > 0) await confirmBtn.click();
    await tabB.waitForTimeout(SYNC_WAIT_MS);

    await assertNotCancelled(tabA);
    await tabA.reload({ waitUntil: "domcontentloaded" });
    await tabA.waitForTimeout(2000);
    if (blobIdToDelete) {
      await expect(
        tabA.locator(`[data-testid="blob-card"][data-blob-id="${blobIdToDelete}"]`)
      ).toHaveCount(0, { timeout: 5000 });
    }

    // --- Blob create: create new blob on Tab A, verify on Tab B ---
    await createBlobAt(tabA, 250, 280);
    await tabA.waitForTimeout(500);
    const newBlob = tabA.getByTestId("blob-card").last();
    await expect(newBlob).toBeVisible({ timeout: 5000 });
    const newContent = newBlob.getByTestId("blob-content");
    await newContent.click();
    await tabA.keyboard.press("Control+A");
    await tabA.keyboard.type("New blob from tab A");
    await tabA.keyboard.press("Escape");
    await tabA.waitForTimeout(SYNC_WAIT_MS);

    await assertNotCancelled(tabB);
    await tabB.reload({ waitUntil: "domcontentloaded" });
    await tabB.waitForTimeout(2000);
    await expect(
      tabB.getByTestId("blob-content").filter({ hasText: "New blob from tab A" })
    ).toBeVisible({ timeout: SYNC_WAIT_MS });

    // --- Lock: lock on Tab B, verify locked on Tab A ---
    const blobToLock = tabB.getByTestId("blob-card").filter({
      has: tabB.getByTestId("blob-content").filter({ hasText: "New blob from tab A" }),
    });
    await blobToLock.getByTestId("blob-options").click();
    await tabB.getByTestId("blob-menu-lock").click();
    await tabB.waitForTimeout(SYNC_WAIT_MS);

    await assertNotCancelled(tabA);
    await tabA.reload({ waitUntil: "domcontentloaded" });
    await tabA.waitForTimeout(2000);
    const lockedCardA = tabA.getByTestId("blob-card").filter({
      has: tabA.getByTestId("blob-content").filter({ hasText: "New blob from tab A" }),
    });
    await expect(lockedCardA.locator("[data-locked]")).toBeVisible({ timeout: 5000 });

    // --- Theme back to light: set on Tab A, verify on Tab B ---
    await tabA.getByTestId("main-menu").click();
    await expect(tabA.getByTestId("main-menu")).toHaveAttribute("aria-expanded", "true", { timeout: 5000 });
    await tabA.getByTestId("theme-light").click({ force: true });
    await tabA.waitForTimeout(SYNC_WAIT_MS);

    await assertNotCancelled(tabB);
    await tabB.reload({ waitUntil: "domcontentloaded" });
    await tabB.waitForTimeout(2000);
    await tabB.getByTestId("main-menu").click();
    await expect(tabB.getByTestId("main-menu")).toHaveAttribute("aria-expanded", "true", { timeout: 5000 });
    await expect(
      tabB.getByTestId("theme-light")
    ).toHaveAttribute("aria-selected", "true", { timeout: 5000 });
    await tabB.keyboard.press("Escape");

    // --- Unlock: unlock via main menu on Tab A ---
    await tabA.getByTestId("main-menu").click();
    await expect(tabA.getByTestId("main-menu")).toHaveAttribute("aria-expanded", "true", { timeout: 5000 });
    await tabA.getByTestId("unlock-all").click({ force: true });
    await tabA.waitForTimeout(1000);

    // --- Done ---
    await tabA.evaluate((key: string) => localStorage.removeItem(key), E2E_RUNNING_KEY);
    await tabB.evaluate((key: string) => localStorage.removeItem(key), E2E_RUNNING_KEY);
  });
});
