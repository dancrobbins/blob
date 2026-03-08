"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useReducer,
  useEffect,
  type ReactNode,
} from "react";
import type { Blob } from "@/lib/types";
import {
  blobsReducer,
  type BlobsAction,
} from "@/lib/blobs-store";
import {
  loadBlobsFromStorage,
  saveBlobsToStorage,
  fetchUserBlobs,
  getMergedFlag,
  setMergedFlag,
  mergeLocalAndCloudBlobs,
  blobsEqual,
  debouncedSaveToCloud,
  upsertUserBlobs,
  clearSaveTimeout,
  POSITION_SAVE_DEBOUNCE_MS,
  CLOUD_POLL_INTERVAL_MS,
  CLOUD_POLL_INITIAL_DELAY_MS,
} from "@/lib/persistence";
import { loadPreferences, savePreferences, mergeCloudPreferences } from "@/lib/preferences-store";
import type { Preferences } from "@/lib/types";
import { supabase } from "@/lib/supabase";

type BlobsContextValue = {
  blobs: Blob[];
  dispatch: React.Dispatch<BlobsAction>;
  preferences: Preferences;
  setPreferences: (p: Preferences | ((prev: Preferences) => Preferences)) => void;
  userId: string | null;
  isLoading: boolean;
  /** Ref set by Header: true when Main menu or account menu is open. Used by canvas to avoid adding a blob when tap closes a menu. */
  anyMenuOpenRef: React.MutableRefObject<boolean>;
};

const BlobsContext = createContext<BlobsContextValue | null>(null);

const MAJOR_ACTIONS = new Set<BlobsAction["type"]>([
  "ADD_BLOB",
  "DELETE_BLOB",
  "DELETE_BLOBS",
  "DUPLICATE_BLOB",
  "DUPLICATE_BLOBS",
]);
const POSITION_ACTION = "SET_POSITION";

export function BlobsProvider({ children }: { children: ReactNode }) {
  const [blobs, dispatchReducer] = useReducer(blobsReducer, []);
  const [preferences, setPreferencesState] = React.useState<Preferences>(() =>
    loadPreferences()
  );
  const [userId, setUserId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const anyMenuOpenRef = React.useRef(false);
  const lastActionRef = React.useRef<"major" | "position" | null>(null);
  const positionSaveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const blobsRef = React.useRef<Blob[]>(blobs);

  const dispatch = useCallback((action: BlobsAction) => {
    if (MAJOR_ACTIONS.has(action.type)) lastActionRef.current = "major";
    else if (action.type === POSITION_ACTION) lastActionRef.current = "position";
    dispatchReducer(action);
  }, []);

  const setPreferences = useCallback(
    (p: Preferences | ((prev: Preferences) => Preferences)) => {
      setPreferencesState((prev) => {
        const next = typeof p === "function" ? p(prev) : p;
        savePreferences(next);
        return next;
      });
    },
    []
  );

  // Hydrate from localStorage on mount
  useEffect(() => {
    dispatch({ type: "SET_BLOBS", payload: loadBlobsFromStorage() });
    setPreferencesState(loadPreferences());
    setIsLoading(false);
  }, []);

  // Auth state
  useEffect(() => {
    if (!supabase) {
      setUserId(null);
      return;
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // On login: always merge cloud + local so both origins stay in sync
  useEffect(() => {
    if (!userId || !supabase) return;
    const run = async () => {
      console.log("[blob sync] user logged in, fetching cloud blobs for", userId);
      const cloud = await fetchUserBlobs(userId);
      const current = loadBlobsFromStorage();
      console.log("[blob sync] cloud blobs:", cloud?.blobs?.length ?? 0, "local blobs:", current.length);

      if (cloud?.preferences) {
        const currentPrefs = loadPreferences();
        const mergedPrefs = mergeCloudPreferences(currentPrefs, cloud.preferences);
        setPreferencesState(mergedPrefs);
        savePreferences(mergedPrefs);
      }

      if (!cloud) {
        // No cloud data yet — push local to cloud
        console.log("[blob sync] no cloud data, pushing local to cloud");
        const prefs = loadPreferences();
        await upsertUserBlobs(userId, current, prefs);
        if (!getMergedFlag(userId)) setMergedFlag(userId);
        return;
      }

      const mergedBlobs = mergeLocalAndCloudBlobs(current, cloud.blobs);
      console.log("[blob sync] merged blobs:", mergedBlobs.length);
      dispatch({ type: "SET_BLOBS", payload: mergedBlobs });
      saveBlobsToStorage(mergedBlobs);
      if (!getMergedFlag(userId)) {
        setMergedFlag(userId);
        const prefs = loadPreferences();
        await upsertUserBlobs(userId, mergedBlobs, prefs);
      }
    };
    run();
  }, [userId]);

  // Keep ref updated for polling
  blobsRef.current = blobs;

  // Persist blobs: localStorage always; cloud when logged in (debounced + immediate on major actions)
  useEffect(() => {
    if (isLoading) return;
    saveBlobsToStorage(blobs);
    if (!userId) return;

    const action = lastActionRef.current;
    if (action === "major") {
      clearSaveTimeout();
      lastActionRef.current = null;
      upsertUserBlobs(userId, blobs, preferences);
      return; // skip debounced save this run
    }
    if (action === "position") {
      if (positionSaveTimeoutRef.current) clearTimeout(positionSaveTimeoutRef.current);
      positionSaveTimeoutRef.current = setTimeout(() => {
        positionSaveTimeoutRef.current = null;
        lastActionRef.current = null;
        clearSaveTimeout();
        upsertUserBlobs(userId, blobsRef.current, preferences);
      }, POSITION_SAVE_DEBOUNCE_MS);
    }

    debouncedSaveToCloud(userId, blobs, preferences);
  }, [blobs, userId, preferences, isLoading]);

  // Poll cloud when logged in: first poll soon, then on a cadence; also poll when tab/window becomes visible (sync when user switches to this tab)
  useEffect(() => {
    if (!userId || !supabase) return;

    const poll = async () => {
      const cloud = await fetchUserBlobs(userId);
      if (!cloud) return;
      const current = blobsRef.current;
      const merged = mergeLocalAndCloudBlobs(current, cloud.blobs);
      if (!blobsEqual(merged, current)) {
        console.log("[blob sync] poll: cloud has updates, merging", merged.length, "blobs");
        dispatchReducer({ type: "SET_BLOBS", payload: merged });
        saveBlobsToStorage(merged);
      }
    };

    const initialTimer = setTimeout(poll, CLOUD_POLL_INITIAL_DELAY_MS);
    const interval = setInterval(poll, CLOUD_POLL_INTERVAL_MS);

    const onVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") poll();
    };
    const onFocus = () => poll();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [userId]);

  const value: BlobsContextValue = {
    blobs,
    dispatch,
    preferences,
    setPreferences,
    userId,
    isLoading,
    anyMenuOpenRef,
  };

  return (
    <BlobsContext.Provider value={value}>{children}</BlobsContext.Provider>
  );
}

export function useBlobsContext(): BlobsContextValue {
  const ctx = useContext(BlobsContext);
  if (!ctx) throw new Error("useBlobsContext must be used within BlobsProvider");
  return ctx;
}
