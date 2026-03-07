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
  debouncedSaveToCloud,
  upsertUserBlobs,
} from "@/lib/persistence";
import { loadPreferences, savePreferences } from "@/lib/preferences-store";
import type { Preferences } from "@/lib/types";
import { supabase } from "@/lib/supabase";

type BlobsContextValue = {
  blobs: Blob[];
  dispatch: React.Dispatch<BlobsAction>;
  preferences: Preferences;
  setPreferences: (p: Preferences | ((prev: Preferences) => Preferences)) => void;
  userId: string | null;
  isLoading: boolean;
};

const BlobsContext = createContext<BlobsContextValue | null>(null);

export function BlobsProvider({ children }: { children: ReactNode }) {
  const [blobs, dispatch] = useReducer(blobsReducer, []);
  const [preferences, setPreferencesState] = React.useState<Preferences>(() =>
    loadPreferences()
  );
  const [userId, setUserId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

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

  // First-time merge when user logs in; then use cloud as source when loaded
  useEffect(() => {
    if (!userId || !supabase) return;
    const run = async () => {
      const merged = getMergedFlag(userId);
      const cloud = await fetchUserBlobs(userId);
      const current = loadBlobsFromStorage();
      if (!merged && cloud) {
        const mergedBlobs = mergeLocalAndCloudBlobs(
          current,
          cloud.blobs
        );
        dispatch({ type: "SET_BLOBS", payload: mergedBlobs });
        saveBlobsToStorage(mergedBlobs);
        setMergedFlag(userId);
        const prefs = loadPreferences();
        await upsertUserBlobs(userId, mergedBlobs, prefs);
      } else if (cloud?.blobs.length) {
        dispatch({ type: "SET_BLOBS", payload: cloud.blobs });
        saveBlobsToStorage(cloud.blobs);
      }
    };
    run();
  }, [userId]);

  // Persist blobs: localStorage always; cloud when logged in (debounced)
  useEffect(() => {
    if (isLoading) return;
    saveBlobsToStorage(blobs);
    if (userId) {
      debouncedSaveToCloud(userId, blobs, preferences);
    }
  }, [blobs, userId, preferences, isLoading]);

  const value: BlobsContextValue = {
    blobs,
    dispatch,
    preferences,
    setPreferences,
    userId,
    isLoading,
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
