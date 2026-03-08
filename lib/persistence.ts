import type { Blob, Preferences } from "./types";
import { supabase } from "./supabase";

const BLOB_STORAGE_KEY = "blob_notes_anonymous";
const BLOB_MERGED_PREFIX = "blob_merged_";

const DEBOUNCE_MS = 500;

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

export function getMergedFlag(userId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(BLOB_MERGED_PREFIX + userId) === "1";
  } catch {
    return false;
  }
}

export function setMergedFlag(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BLOB_MERGED_PREFIX + userId, "1");
  } catch {
    // ignore
  }
}

export async function fetchUserBlobs(userId: string): Promise<{
  blobs: Blob[];
  preferences: Partial<Preferences> | null;
  updatedAt: string | null;
} | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("user_notes")
    .select("data, updated_at")
    .eq("user_id", userId)
    .single();
  if (error || !data) return null;
  const dataObj = data.data as { notes?: Blob[]; preferences?: Partial<Preferences> } | null;
  const blobs = Array.isArray(dataObj?.notes) ? dataObj.notes : [];
  const preferences = dataObj?.preferences ?? null;
  return {
    blobs,
    preferences: preferences && (preferences.theme != null || preferences.blobbyColor != null) ? preferences : null,
    updatedAt: data.updated_at ?? null,
  };
}

export async function upsertUserBlobs(
  userId: string,
  blobs: Blob[],
  preferences?: Partial<Preferences>
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("user_notes").upsert(
    {
      user_id: userId,
      data: { notes: blobs, preferences: preferences ?? undefined },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  return !error;
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
  preferences: Partial<Preferences>
): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    upsertUserBlobs(userId, blobs, preferences);
  }, DEBOUNCE_MS);
}
