import type { Preferences } from "./types";
import { DEFAULT_PREFERENCES } from "./types";

const BLOB_PREFERENCES_KEY = "blob_preferences";

export function loadPreferences(): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(BLOB_PREFERENCES_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      theme: parsed.theme ?? DEFAULT_PREFERENCES.theme,
      blobbyColor: parsed.blobbyColor ?? (parsed as { characterColor?: string }).characterColor ?? DEFAULT_PREFERENCES.blobbyColor,
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

/** Merge cloud preferences into current; returns new Preferences. Used when loading from account. */
export function mergeCloudPreferences(
  current: Preferences,
  cloud: Partial<Preferences> | null
): Preferences {
  if (!cloud) return current;
  return {
    theme: cloud.theme ?? current.theme,
    blobbyColor: cloud.blobbyColor ?? (cloud as { characterColor?: string }).characterColor ?? current.blobbyColor,
  };
}
