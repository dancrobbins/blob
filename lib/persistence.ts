import type { Blob, CameraPosition, Preferences } from "./types";
import { supabase } from "./supabase";

const BLOB_STORAGE_KEY = "blob_notes_anonymous";
const BLOB_MERGED_PREFIX = "blob_merged_";
const LAST_PUSH_PREFIX = "blob_last_push_";
const BLOBBY_LOG_KEY = "blob_blobby_log";

const DEBOUNCE_MS = 500;

/** In-memory only when logged in (no localStorage for security). */
const mergedFlagMemory = new Map<string, boolean>();
const lastPushTimeMemory = new Map<string, string>();

/** Debounce for saving to cloud after move (SET_POSITION). */
export const POSITION_SAVE_DEBOUNCE_MS = 300;

/** How often to poll cloud and merge into local (cross-tab / other device sync). */
export const CLOUD_POLL_INTERVAL_MS = 10_000;

/** Delay before first poll after login (so initial load can finish first). */
export const CLOUD_POLL_INITIAL_DELAY_MS = 1_000;

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

/** Cancel any pending debounced cloud save. Call before an immediate save to avoid double-save. */
export function clearSaveTimeout(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
}

export function loadBlobsFromStorage(): Blob[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BLOB_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveBlobsToStorage(blobs: Blob[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BLOB_STORAGE_KEY, JSON.stringify(blobs));
  } catch {
    // ignore
  }
}

export function getMergedFlag(userId: string, memoryOnly?: boolean): boolean {
  if (memoryOnly) return mergedFlagMemory.get(userId) ?? false;
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(BLOB_MERGED_PREFIX + userId) === "1";
  } catch {
    return false;
  }
}

export function setMergedFlag(userId: string, memoryOnly?: boolean): void {
  if (memoryOnly) {
    mergedFlagMemory.set(userId, true);
    return;
  }
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BLOB_MERGED_PREFIX + userId, "1");
  } catch {
    // ignore
  }
}

export function clearMergedFlag(userId: string): void {
  mergedFlagMemory.delete(userId);
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(BLOB_MERGED_PREFIX + userId);
  } catch {
    // ignore
  }
}

/** Timestamp when we last successfully pushed to cloud (per user). Used to apply remote deletions. */
export function getLastPushTime(userId: string, memoryOnly?: boolean): string | null {
  if (memoryOnly) return lastPushTimeMemory.get(userId) ?? null;
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LAST_PUSH_PREFIX + userId);
  } catch {
    return null;
  }
}

export function setLastPushTime(userId: string, iso: string, memoryOnly?: boolean): void {
  if (memoryOnly) {
    lastPushTimeMemory.set(userId, iso);
    return;
  }
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAST_PUSH_PREFIX + userId, iso);
  } catch {
    // ignore
  }
}

/** Clear all blob-related and log data from localStorage (call after login to avoid leaving data on device). */
export function clearAllLocalBlobData(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(BLOB_STORAGE_KEY);
    localStorage.removeItem(BLOBBY_LOG_KEY);
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(BLOB_MERGED_PREFIX) || k.startsWith(LAST_PUSH_PREFIX))) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

/** Load the Blobby output log from localStorage (used for anonymous users only). */
export function loadBlobbyLog(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(BLOBBY_LOG_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Get the text of the most recent Blobby log entry (for recall). Log format: "## ISO\n\ntext\n\n". */
export function getLastBlobbyLogEntry(log: string): string | null {
  if (!log.trim()) return null;
  const lastHeading = log.lastIndexOf("## ");
  if (lastHeading === -1) return null;
  const afterHeading = log.slice(lastHeading);
  const nn = afterHeading.indexOf("\n\n");
  const body = nn === -1 ? afterHeading : afterHeading.slice(nn + 2);
  const trimmed = body.trim();
  return trimmed || null;
}

/** Format a single Blobby log entry (markdown heading + body). */
function formatBlobbyLogEntry(text: string): string {
  const heading = `## ${new Date().toISOString()}`;
  return `${heading}\n\n${text.trim()}\n\n`;
}

/**
 * Append one Blobby output to the log.
 * - If userId is null (anonymous): appends to localStorage and returns the new log string.
 * - If userId is set: returns currentBlobbyLog + new entry; caller must upsert to cloud with the returned value.
 */
export function appendBlobbyLog(
  userId: string | null,
  text: string,
  currentBlobbyLog: string
): string {
  if (typeof window === "undefined" || !text.trim()) return currentBlobbyLog;
  const entry = formatBlobbyLogEntry(text);
  const newLog = currentBlobbyLog + entry;
  if (!userId) {
    try {
      localStorage.setItem(BLOBBY_LOG_KEY, newLog);
    } catch {
      // ignore
    }
  }
  return newLog;
}

export async function fetchUserBlobs(userId: string): Promise<{
  blobs: Blob[];
  preferences: Partial<Preferences> | null;
  blobbyLog: string;
  camera: CameraPosition | null;
  updatedAt: string | null;
} | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("user_notes")
    .select("data, updated_at")
    .eq("user_id", userId)
    .single();
  if (error) {
    console.error("[blob sync] fetchUserBlobs error:", error.message, error.code);
    return null;
  }
  if (!data) return null;
  const dataObj = data.data as {
    notes?: Blob[];
    preferences?: Partial<Preferences>;
    blobbyLog?: string;
    camera?: { panX?: number; panY?: number; scale?: number; updatedAt?: string };
  } | null;
  const blobs = Array.isArray(dataObj?.notes) ? dataObj.notes : [];
  const preferences = dataObj?.preferences ?? null;
  const blobbyLog = typeof dataObj?.blobbyLog === "string" ? dataObj.blobbyLog : "";
  const raw = dataObj?.camera;
  const camera: CameraPosition | null =
    raw != null &&
    typeof raw.panX === "number" &&
    typeof raw.panY === "number" &&
    typeof raw.scale === "number"
      ? {
          panX: raw.panX,
          panY: raw.panY,
          scale: raw.scale,
          updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
        }
      : null;
  return {
    blobs,
    preferences: preferences && (preferences.theme != null || preferences.blobbyColor != null) ? preferences : null,
    blobbyLog,
    camera,
    updatedAt: data.updated_at ?? null,
  };
}

export async function upsertUserBlobs(
  userId: string,
  blobs: Blob[],
  preferences?: Partial<Preferences>,
  blobbyLog?: string,
  camera?: CameraPosition
): Promise<boolean> {
  if (!supabase) return false;
  const now = new Date().toISOString();
  const { error } = await supabase.from("user_notes").upsert(
    {
      user_id: userId,
      data: {
        notes: blobs,
        preferences: preferences ?? undefined,
        blobbyLog: blobbyLog ?? undefined,
        camera: camera ?? undefined,
      },
      updated_at: now,
    },
    { onConflict: "user_id" }
  );
  if (error) {
    console.error("[blob sync] upsertUserBlobs error:", error.message, error.code);
    return false;
  }
  setLastPushTime(userId, now, true);
  return true;
}

function blobsEqual(a: Blob[], b: Blob[]): boolean {
  if (a.length !== b.length) return false;
  const sortById = (arr: Blob[]) => [...arr].sort((x, y) => x.id.localeCompare(y.id));
  return JSON.stringify(sortById(a)) === JSON.stringify(sortById(b));
}

function mergeBlobs(local: Blob[], cloud: Blob[]): Blob[] {
  const byId = new Map<string, Blob>();
  for (const b of local) byId.set(b.id, b);
  for (const b of cloud) {
    const existing = byId.get(b.id);
    if (!existing || new Date(b.updatedAt) > new Date(existing.updatedAt)) {
      byId.set(b.id, b);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export function mergeLocalAndCloudBlobs(
  local: Blob[],
  cloud: Blob[]
): Blob[] {
  return mergeBlobs(local, cloud);
}

export { blobsEqual };

export function debouncedSaveToCloud(
  userId: string,
  blobs: Blob[],
  preferences: Partial<Preferences>,
  blobbyLog?: string,
  camera?: CameraPosition
): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    saveTimeout = null;
    const ok = await upsertUserBlobs(userId, blobs, preferences, blobbyLog, camera);
    if (!ok) console.error("[blob sync] debouncedSaveToCloud: upsert failed");
  }, DEBOUNCE_MS);
}
