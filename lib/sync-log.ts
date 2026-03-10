/**
 * In-memory ring buffer of sync events for debugging blob sync and content issues.
 * Copy from the app: open the main menu (☰) and tap "Copy sync debug log" to copy the log to the clipboard.
 * Also exposed as window.__blobSyncLog in DevTools.
 */

const MAX_ENTRIES = 200;
const ring: Array<{ ts: string; event: string; detail: Record<string, unknown> }> = [];

export function syncLog(event: string, detail: Record<string, unknown> = {}): void {
  const entry = { ts: new Date().toISOString(), event, detail };
  if (ring.length >= MAX_ENTRIES) ring.shift();
  ring.push(entry);
  console.log(`[blob sync] ${event}`, detail);
}

export function getSyncLog(): typeof ring {
  return ring;
}

/** Number of blobs that have non-empty content (for debugging "blobs there but no text"). */
export function contentCount(blobs: { content?: string | null }[]): number {
  return blobs.filter((b) => (b.content ?? "").trim().length > 0).length;
}

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__blobSyncLog = ring;
}
