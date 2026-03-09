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
  clearMergedFlag,
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
import { MergeDialog } from "@/components/MergeDialog";

const UNDO_HISTORY_MAX = 50;

type BlobsContextValue = {
  blobs: Blob[];
  dispatch: React.Dispatch<BlobsAction>;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Push current blob state to undo stack (e.g. before word-boundary typing). Clears redo. */
  pushUndoSnapshot: () => void;
  preferences: Preferences;
  setPreferences: (p: Preferences | ((prev: Preferences) => Preferences)) => void;
  userId: string | null;
  /** Whose board we're viewing. Today = userId; later can be set by share link (e.g. /view/:ownerId). Used for presence channel. */
  boardOwnerId: string | null;
  isLoading: boolean;
  /** Ref: true when any popup menu (header or blob "...") is open. Used by canvas to avoid adding a blob when tap closes a menu. */
  anyMenuOpenRef: React.MutableRefObject<boolean>;
  /** Call when a menu opens; anyMenuOpenRef is set true. */
  incrementMenuOpen: () => void;
  /** Call when a menu closes; anyMenuOpenRef set false when count reaches 0. */
  decrementMenuOpen: () => void;
};

const BlobsContext = createContext<BlobsContextValue | null>(null);

const MAJOR_ACTIONS = new Set<BlobsAction["type"]>([
  "ADD_BLOB",
  "DELETE_BLOB",
  "DELETE_BLOBS",
  "DUPLICATE_BLOB",
  "DUPLICATE_BLOBS",
  "SET_HIDDEN",
  "UNHIDE_ALL",
  "SET_BLOB_SIZE",
]);
const POSITION_ACTION = "SET_POSITION";

/** Actions that push to undo when dispatched. UPDATE_BLOB is omitted; typing uses pushUndoSnapshot at word boundaries. */
const UNDOABLE_ACTIONS = new Set<BlobsAction["type"]>([
  "ADD_BLOB",
  "DELETE_BLOB",
  "DELETE_BLOBS",
  "DUPLICATE_BLOB",
  "DUPLICATE_BLOBS",
  "SET_POSITION",
  "SET_LOCKED",
  "SET_HIDDEN",
  "UNHIDE_ALL",
  "SET_BLOB_SIZE",
]);

export function BlobsProvider({ children }: { children: ReactNode }) {
  const [blobs, dispatchReducer] = useReducer(blobsReducer, []);
  const [preferences, setPreferencesState] = React.useState<Preferences>(() =>
    loadPreferences()
  );
  const [userId, setUserId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const anyMenuOpenRef = React.useRef(false);
  const menuOpenCountRef = React.useRef(0);
  const incrementMenuOpen = React.useCallback(() => {
    menuOpenCountRef.current += 1;
    anyMenuOpenRef.current = true;
  }, []);
  const decrementMenuOpen = React.useCallback(() => {
    menuOpenCountRef.current = Math.max(0, menuOpenCountRef.current - 1);
    anyMenuOpenRef.current = menuOpenCountRef.current > 0;
  }, []);
  const lastActionRef = React.useRef<"major" | "position" | null>(null);
  const positionSaveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const blobsRef = React.useRef<Blob[]>(blobs);
  const syncingRef = React.useRef(false);
  const prevUserIdRef = React.useRef<string | null>(null);
  const [showMergeDialog, setShowMergeDialog] = React.useState(false);
  const mergeDialogResolveRef = React.useRef<((value: boolean) => void) | null>(null);

  const [undoStack, setUndoStack] = React.useState<Blob[][]>([]);
  const [redoStack, setRedoStack] = React.useState<Blob[][]>([]);
  const isUndoRedoRef = React.useRef(false);
  const lastActionTypeForUndoRef = React.useRef<BlobsAction["type"] | null>(null);

  const dispatch = useCallback((action: BlobsAction) => {
    if (isUndoRedoRef.current) {
      dispatchReducer(action);
      return;
    }
    if (UNDOABLE_ACTIONS.has(action.type)) {
      const shouldPush =
        action.type !== POSITION_ACTION ||
        lastActionTypeForUndoRef.current !== POSITION_ACTION;
      if (shouldPush) {
        const snapshot = blobsRef.current.map((b) => ({ ...b }));
        setUndoStack((s) => {
          const next = [...s, snapshot];
          return next.length > UNDO_HISTORY_MAX ? next.slice(-UNDO_HISTORY_MAX) : next;
        });
        setRedoStack([]);
      }
      lastActionTypeForUndoRef.current = action.type;
    }
    if (MAJOR_ACTIONS.has(action.type)) lastActionRef.current = "major";
    else if (action.type === POSITION_ACTION) lastActionRef.current = "position";
    dispatchReducer(action);
  }, []);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((r) => [...r, blobsRef.current.map((b) => ({ ...b }))]);
    isUndoRedoRef.current = true;
    dispatchReducer({ type: "SET_BLOBS", payload: prev });
    isUndoRedoRef.current = false;
  }, [undoStack.length]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((s) => [...s, blobsRef.current.map((b) => ({ ...b }))]);
    isUndoRedoRef.current = true;
    dispatchReducer({ type: "SET_BLOBS", payload: next });
    isUndoRedoRef.current = false;
  }, [redoStack.length]);

  const pushUndoSnapshot = useCallback(() => {
    if (isUndoRedoRef.current) return;
    const snapshot = blobsRef.current.map((b) => ({ ...b }));
    setUndoStack((s) => {
      const next = [...s, snapshot];
      return next.length > UNDO_HISTORY_MAX ? next.slice(-UNDO_HISTORY_MAX) : next;
    });
    setRedoStack([]);
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

  const handleMergeDialogChoice = useCallback((pullIntoCloud: boolean) => {
    mergeDialogResolveRef.current?.(pullIntoCloud);
    mergeDialogResolveRef.current = null;
    setShowMergeDialog(false);
  }, []);

  // On login: if user has local blobs, ask whether to pull into cloud or discard; then sync
  useEffect(() => {
    if (!userId || !supabase) return;
    syncingRef.current = true;
    clearSaveTimeout();
    const run = async () => {
      try {
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

        let pullIntoCloud = true;
        if (current.length > 0) {
          setShowMergeDialog(true);
          pullIntoCloud = await new Promise<boolean>((resolve) => {
            mergeDialogResolveRef.current = resolve;
          });
        }

        if (!pullIntoCloud) {
          // User chose to discard local: use cloud only (or empty), no cache
          saveBlobsToStorage([]);
          dispatch({ type: "SET_BLOBS", payload: cloud?.blobs ?? [] });
          setMergedFlag(userId);
          return;
        }

        if (!cloud) {
          console.log("[blob sync] no cloud data, pushing local to cloud");
          const prefs = loadPreferences();
          await upsertUserBlobs(userId, current, prefs);
          if (!getMergedFlag(userId)) setMergedFlag(userId);
          return;
        }

        const mergedBlobs = mergeLocalAndCloudBlobs(current, cloud.blobs);
        console.log("[blob sync] merged blobs:", mergedBlobs.length);
        dispatch({ type: "SET_BLOBS", payload: mergedBlobs });
        setMergedFlag(userId);
        const prefs = loadPreferences();
        await upsertUserBlobs(userId, mergedBlobs, prefs);
      } finally {
        syncingRef.current = false;
      }
    };
    run();
  }, [userId]);

  // On logout or account switch: clear scene and local cache for security and privacy
  useEffect(() => {
    const prevUserId = prevUserIdRef.current;
    const isLogout = userId === null && prevUserId !== null;
    const isAccountSwitch = userId !== null && prevUserId !== null && userId !== prevUserId;

    if (isLogout || isAccountSwitch) {
      clearSaveTimeout();
      if (positionSaveTimeoutRef.current) {
        clearTimeout(positionSaveTimeoutRef.current);
        positionSaveTimeoutRef.current = null;
      }
      dispatchReducer({ type: "SET_BLOBS", payload: [] });
      setUndoStack([]);
      setRedoStack([]);
      saveBlobsToStorage([]);
      if (prevUserId) clearMergedFlag(prevUserId);
    }
    prevUserIdRef.current = userId;
  }, [userId]);

  // Keep ref updated for polling
  blobsRef.current = blobs;

  // Persist: anonymous only to localStorage; logged-in users never cache in browser, only save to cloud
  useEffect(() => {
    if (isLoading) return;
    if (!userId) {
      saveBlobsToStorage(blobs);
      return;
    }
    if (syncingRef.current) {
      console.log("[blob sync] persist: skipping cloud save (syncing)");
      return;
    }

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
      const latestLocal = blobsRef.current;
      const merged = mergeLocalAndCloudBlobs(latestLocal, cloud.blobs);
      if (!blobsEqual(merged, latestLocal)) {
        console.log("[blob sync] poll: cloud has updates, merging", merged.length, "blobs");
        dispatchReducer({ type: "SET_BLOBS", payload: merged });
        // Logged-in users: do not cache in browser
      } else {
        console.log("[blob sync] poll: cloud fetch ok, no changes");
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
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    pushUndoSnapshot,
    preferences,
    setPreferences,
    userId,
    boardOwnerId: userId,
    isLoading,
    anyMenuOpenRef,
    incrementMenuOpen,
    decrementMenuOpen,
  };

  return (
    <BlobsContext.Provider value={value}>
      {children}
      {showMergeDialog && (
        <MergeDialog
          onPull={() => handleMergeDialogChoice(true)}
          onDiscard={() => handleMergeDialogChoice(false)}
        />
      )}
    </BlobsContext.Provider>
  );
}

export function useBlobsContext(): BlobsContextValue {
  const ctx = useContext(BlobsContext);
  if (!ctx) throw new Error("useBlobsContext must be used within BlobsProvider");
  return ctx;
}
