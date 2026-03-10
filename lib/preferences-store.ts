import type { Preferences } from "./types";
import { DEFAULT_PREFERENCES } from "./types";

const BLOB_PREFERENCES_KEY = "blob_preferences";

export function loadPreferences(): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(BLOB_PREFERENCES_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    const rawPx = parsed.blobbyBackerSizePx ?? DEFAULT_PREFERENCES.blobbyBackerSizePx;
    const clamped = Math.min(500, Math.max(100, Number(rawPx)));
    return {
      theme: parsed.theme ?? DEFAULT_PREFERENCES.theme,
      blobbyColor: parsed.blobbyColor ?? (parsed as { characterColor?: string }).characterColor ?? DEFAULT_PREFERENCES.blobbyColor,
      blobbyBackerSizePx: Number.isFinite(clamped) ? clamped : DEFAULT_PREFERENCES.blobbyBackerSizePx,
      blobbyCommenting: parsed.blobbyCommenting === "commenting" ? "commenting" : DEFAULT_PREFERENCES.blobbyCommenting,
      blobMarkdownView: parsed.blobMarkdownView === "raw" ? "raw" : DEFAULT_PREFERENCES.blobMarkdownView,
      mergingMode: parsed.mergingMode === "loose" ? "loose" : DEFAULT_PREFERENCES.mergingMode,
      mergeMarginPx: (() => {
        const v = Number(parsed.mergeMarginPx);
        return Number.isFinite(v) ? Math.min(200, Math.max(10, v)) : DEFAULT_PREFERENCES.mergeMarginPx;
      })(),
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: Preferences): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BLOB_PREFERENCES_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

/** Clear preferences from localStorage (call when logged in so we don't leave data on device). */
export function clearPreferences(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(BLOB_PREFERENCES_KEY);
  } catch {
    // ignore
  }
}

/** Merge cloud preferences into current; returns new Preferences. Used when loading from account. */
export function mergeCloudPreferences(
  current: Preferences,
  cloud: Partial<Preferences> | null
): Preferences {
  if (!cloud) return current;
  const backerPx = cloud.blobbyBackerSizePx ?? current.blobbyBackerSizePx;
  const clamped = Math.min(500, Math.max(100, backerPx));
  return {
    theme: cloud.theme ?? current.theme,
    blobbyColor: cloud.blobbyColor ?? (cloud as { characterColor?: string }).characterColor ?? current.blobbyColor,
    blobbyBackerSizePx: Number.isFinite(clamped) ? clamped : current.blobbyBackerSizePx,
    blobbyCommenting: cloud.blobbyCommenting === "commenting" ? "commenting" : current.blobbyCommenting,
    blobMarkdownView: cloud.blobMarkdownView === "raw" ? "raw" : current.blobMarkdownView,
    mergingMode: cloud.mergingMode === "loose" ? "loose" : current.mergingMode,
    mergeMarginPx: (() => {
      const v = cloud.mergeMarginPx ?? current.mergeMarginPx;
      return Number.isFinite(v) ? Math.min(200, Math.max(10, v)) : current.mergeMarginPx;
    })(),
  };
}
