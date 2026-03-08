import { test, expect } from "./cdp-fixture";

const SYNC_WAIT_MS = 12_000;
const E2E_RUNNING_KEY = "e2eSyncRunning";
const E2E_CANCEL_KEY = "e2eSyncCancel";

function assertNotCancelled(page: { evaluate: (fn: (key: string) => string | null, key: string) => Promise<string | null> }) {
  return page.evaluate((key: string) => localStorage.getItem(key), E2E_CANCEL_KEY).then((v) => {
    if (v === "1") throw new Error("Test cancelled by user");
  });
}

test.describe("Two-tab Google sync", () => {
  test("syncs text edits, blob create/delete, theme, lock/unlock, hide/show across tabs", async ({
    tabA,
    tabB,
  }) => {
    await tabA.evaluate((key: string) => localStorage.setItem(key, "1"), E2E_RUNNING_KEY);
    await tabB.evaluate((key: string) => localStorage.setItem(key, "1"), E2E_RUNNING_KEY);
    await tabA.evaluate((key: string) => localStorage.removeItem(key), E2E_CANCEL_KEY);
    await tabB.evaluate((key: string) => localStorage.removeItem(key), E2E_CANCEL_KEY);

    await assertNotCancelled(tabA);
    const loginToast = tabA.getByTestId("e2e-login-toast");
    await expect(loginToast).toBeVisible();

    await expect(loginToast).toBeHidden({ timeout: SYNC_WAIT_MS * 2 });
    await assertNotCancelled(tabA);

    await tabA.getByTestId("main-menu").click();
    await tabA.getByTestId("theme-dark").click();

    await tabA.getByTestId("canvas").click({ position: { x: 200, y: 200 } });
    await assertNotCancelled(tabA);
    await tabA.waitForTimeout(500);
    const firstBlobCard = tabA.getByTestId("blob-card").first();
    await expect(firstBlobCard).toBeVisible({ timeout: 5000 });
    const blobContentA = firstBlobCard.getByTestId("blob-content");
    await blobContentA.click();
    await blobContentA.fill("• Synced note from tab A");
    await tabA.keyboard.press("Escape");
    await tabA.waitForTimeout(SYNC_WAIT_MS);

    await assertNotCancelled(tabB);
    await tabB.reload();
    await tabB.waitForTimeout(2000);
    await expect(tabB.getByTestId("blob-card").first().getByTestId("blob-content")).toContainText(
      "Synced note from tab A",
      { timeout: SYNC_WAIT_MS }
    );

    await assertNotCancelled(tabB);
    await expect(tabB.getByTestId("theme-dark")).toBeVisible();
    const themeTabs = tabB.getByRole("tablist", { name: "Theme" });
    await expect(themeTabs).toBeVisible();
    const darkSelected = tabB.locator('[data-testid="theme-dark"][aria-selected="true"]');
    await expect(darkSelected).toBeVisible({ timeout: 5000 });

    const firstCardB = tabB.getByTestId("blob-card").first();
    const blobIdToDelete = await firstCardB.getAttribute("data-blob-id");
    await firstCardB.getByTestId("blob-options").click();
    await tabB.getByTestId("blob-menu-delete").click();
    await tabB.getByTestId("confirm-dialog-confirm").click();
    await tabB.waitForTimeout(SYNC_WAIT_MS);

    await assertNotCancelled(tabA);
    await tabA.reload();
    await tabA.waitForTimeout(2000);
    if (blobIdToDelete) {
      await expect(tabA.locator(`[data-testid="blob-card"][data-blob-id="${blobIdToDelete}"]`)).toHaveCount(0, { timeout: 5000 });
    }

    await tabA.getByTestId("canvas").click({ position: { x: 250, y: 280 } });
    await tabA.waitForTimeout(500);
    const newBlob = tabA.getByTestId("blob-card").last();
    await expect(newBlob).toBeVisible({ timeout: 5000 });
    await newBlob.getByTestId("blob-content").fill("• New blob from tab A");
    await tabA.waitForTimeout(SYNC_WAIT_MS);

    await assertNotCancelled(tabB);
    await tabB.reload();
    await tabB.waitForTimeout(2000);
    await expect(tabB.getByTestId("blob-content").filter({ hasText: "New blob from tab A" })).toBeVisible({
      timeout: SYNC_WAIT_MS,
    });

    const blobToLock = tabB.getByTestId("blob-card").filter({ has: tabB.getByTestId("blob-content").filter({ hasText: "New blob from tab A" }) });
    await blobToLock.getByTestId("blob-options").click();
    await tabB.getByTestId("blob-menu-lock").click();
    await tabB.waitForTimeout(SYNC_WAIT_MS);

    await assertNotCancelled(tabA);
    await tabA.reload();
    await tabA.waitForTimeout(2000);
    const lockedCardA = tabA.getByTestId("blob-card").filter({ has: tabA.getByTestId("blob-content").filter({ hasText: "New blob from tab A" }) });
    await expect(lockedCardA.locator("[data-locked]")).toBeVisible({ timeout: 5000 });

    await tabA.getByTestId("main-menu").click();
    await tabA.getByTestId("theme-light").click();
    await tabA.waitForTimeout(SYNC_WAIT_MS);

    await assertNotCancelled(tabB);
    await tabB.reload();
    await tabB.waitForTimeout(2000);
    await tabB.getByTestId("main-menu").click();
    await expect(tabB.getByTestId("theme-light").locator('[aria-selected="true"]')).toBeVisible({ timeout: 5000 });

    await tabB.getByTestId("main-menu").click();
    await tabB.getByTestId("unhide-all").click();
    await tabB.getByTestId("show-all").click();
    await tabB.waitForTimeout(1000);

    await tabA.evaluate((key: string) => localStorage.removeItem(key), E2E_RUNNING_KEY);
    await tabB.evaluate((key: string) => localStorage.removeItem(key), E2E_RUNNING_KEY);
  });
});
