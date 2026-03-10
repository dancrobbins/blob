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
  getLastPushTime,
  setLastPushTime,
  mergeLocalAndCloudBlobs,
  mergeDeletedIds,
  blobsEqual,
  debouncedSaveToCloud,
  upsertUserBlobs,
  clearSaveTimeout,
  clearAllLocalBlobData,
  appendBlobbyLog as appendBlobbyLogPersistence,
  loadBlobbyLog,
  POSITION_SAVE_DEBOUNCE_MS,
  CLOUD_POLL_INTERVAL_MS,
  CLOUD_POLL_INITIAL_DELAY_MS,
} from "@/lib/persistence";
import { loadPreferences, savePreferences, clearPreferences, mergeCloudPreferences } from "@/lib/preferences-store";
import type { CameraPosition, Preferences } from "@/lib/types";
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
  /** Short description of what the next undo would revert (e.g. "Merge blobs"). Empty when canUndo is false. */
  undoLabel: string;
  /** Short description of what the next redo would repeat (e.g. "Add blob"). Empty when canRedo is false. */
  redoLabel: string;
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
  /** Append one Blobby output to the log (cloud when logged in, else localStorage). */
  appendBlobbyLog: (text: string) => void;
  /** Blobby output log (markdown); from cloud when logged in, else empty. Use for recall when lastBlobbyOutput is null. */
  blobbyLog: string;
  /** Camera (pan/zoom) from cloud; apply once on load then clear. Null after applied or when not logged in. */
  initialCameraPosition: CameraPosition | null;
  /** Call after applying initialCameraPosition so it is not re-applied. */
  clearInitialCamera: () => void;
  /** Persist camera to cloud (debounced). Use { immediate: true } after zoom-to-fit so it saves before refresh. No-op when not logged in. */
  persistCamera: (camera: CameraPosition, options?: { immediate?: boolean }) => void;
};

const BlobsContext = createContext<BlobsContextValue | null>(null);

const MAJOR_ACTIONS = new Set<BlobsAction["type"]>([
  "ADD_BLOB",
  "DELETE_BLOB",
  "DELETE_BLOBS",
  "DUPLICATE_BLOB",
  "DUPLICATE_BLOBS",
  "MERGE_BLOBS",
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
  "MERGE_BLOBS",
  "SET_POSITION",
  "SET_LOCKED",
  "SET_HIDDEN",
  "UNHIDE_ALL",
  "SET_BLOB_SIZE",
]);

/**
 * Describe the transition from `fromState` to `toState` in one short phrase (e.g. "Merge blobs").
 * Used for Undo tooltip: describeAction(undoStackTop, current) = what we're undoing.
 * Used for Redo tooltip: describeAction(current, redoStackTop) = what we're redoing.
 */
function describeBlobStateChange(fromState: Blob[], toState: Blob[]): string {
  if (toState.length > fromState.length) {
    const added = toState.length - fromState.length;
    return added === 1 ? "Add blob" : `Add ${added} blobs`;
  }
  if (toState.length < fromState.length) {
    const removed = fromState.length - toState.length;
    if (removed === 1 && fromState.length >= 2 && toState.length >= 1) return "Merge blobs";
    return removed === 1 ? "Delete blob" : `Delete ${removed} blobs`;
  }
  const positionChanged = fromState.some((f) => {
    const t = toState.find((b) => b.id === f.id);
    return t && (t.x !== f.x || t.y !== f.y);
  });
  if (positionChanged) return "Move blob";
  const contentChanged = fromState.some((f) => {
    const t = toState.find((b) => b.id === f.id);
    return t && (t.content ?? "") !== (f.content ?? "");
  });
  if (contentChanged) return "Edit blob";
  const sizeChanged = fromState.some((f) => {
    const t = toState.find((b) => b.id === f.id);
    return t && (t.width !== f.width || t.height !== f.height);
  });
  if (sizeChanged) return "Resize blob";
  const lockedChanged = fromState.some((f) => {
    const t = toState.find((b) => b.id === f.id);
    return t && t.locked !== f.locked;
  });
  if (lockedChanged) return "Lock blob";
  const hiddenChanged = fromState.some((f) => {
    const t = toState.find((b) => b.id === f.id);
    return t && t.hidden !== f.hidden;
  });
  if (hiddenChanged) return "Hide blob";
  return "Change";
}

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
  const deletedIdsRef = React.useRef<Record<string, string>>({});
  const [blobbyLog, setBlobbyLog] = React.useState("");
  const blobbyLogRef = React.useRef(blobbyLog);
  blobbyLogRef.current = blobbyLog;
  const [showMergeDialog, setShowMergeDialog] = React.useState(false);
  const mergeDialogResolveRef = React.useRef<((value: boolean) => void) | null>(null);
  const cameraRef = React.useRef<CameraPosition | null>(null);
  const lastFetchedCameraRef = React.useRef<{ camera: CameraPosition | null; updatedAt: string | null }>({ camera: null, updatedAt: null });
  const [initialCameraPosition, setInitialCameraPosition] = React.useState<CameraPosition | null>(null);

  /** Camera to send on next upsert: use our camera if it's newer than last-fetched, else keep last-fetched so we don't overwrite another tab's newer camera. */
  const getCameraToWrite = useCallback((): CameraPosition | undefined => {
    const our = cameraRef.current;
    const lf = lastFetchedCameraRef.current;
    if (!our) return lf.camera ?? undefined;
    if (!lf.camera) return our;
    if (!our.updatedAt) return our;
    if (!lf.updatedAt) return our;
    return our.updatedAt >= lf.updatedAt ? our : lf.camera;
  }, []);

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
        let snapshot = blobsRef.current.map((b) => ({ ...b }));
        if (action.type === "MERGE_BLOBS" && action.payload.sourcePosition != null) {
          const { sourceId, sourcePosition } = action.payload;
          snapshot = snapshot.map((b) =>
            b.id === sourceId ? { ...b, x: sourcePosition.x, y: sourcePosition.y } : b
          );
        }
        setUndoStack((s) => {
          const next = [...s, snapshot];
          return next.length > UNDO_HISTORY_MAX ? next.slice(-UNDO_HISTORY_MAX) : next;
        });
        setRedoStack([]);
      }
      lastActionTypeForUndoRef.current = action.type;
    }
    // Record tombstones for any blob deletion so remote browsers can't resurrect them.
    const now = new Date().toISOString();
    if (action.type === "DELETE_BLOB") {
      deletedIdsRef.current = { ...deletedIdsRef.current, [action.payload]: now };
    } else if (action.type === "DELETE_BLOBS") {
      const additions: Record<string, string> = {};
      for (const id of action.payload) additions[id] = now;
      deletedIdsRef.current = { ...deletedIdsRef.current, ...additions };
    } else if (action.type === "MERGE_BLOBS") {
      deletedIdsRef.current = { ...deletedIdsRef.current, [action.payload.sourceId]: now };
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
        if (userId) savePreferences(next);
        return next;
      });
    },
    [userId]
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

        const currentPrefs = loadPreferences();
        const mergedPrefs = cloud?.preferences
          ? mergeCloudPreferences(currentPrefs, cloud.preferences)
          : currentPrefs;
        if (cloud?.preferences) {
          setPreferencesState(mergedPrefs);
        }
        if (cloud) {
          setBlobbyLog(cloud.blobbyLog ?? "");
        }
        if (cloud?.camera) {
          cameraRef.current = cloud.camera;
          lastFetchedCameraRef.current = { camera: cloud.camera, updatedAt: cloud.camera.updatedAt ?? null };
          setInitialCameraPosition(cloud.camera);
        }
        // Seed tombstones from cloud so we don't resurrect remotely-deleted blobs
        if (cloud?.deletedIds) {
          deletedIdsRef.current = mergeDeletedIds(deletedIdsRef.current, cloud.deletedIds);
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
          dispatch({ type: "SET_BLOBS", payload: cloud?.blobs ?? [] });
          setMergedFlag(userId, true);
          if (cloud?.updatedAt) setLastPushTime(userId, cloud.updatedAt, true);
          return;
        }

        if (!cloud) {
          console.log("[blob sync] no cloud data, pushing local to cloud");
          await upsertUserBlobs(userId, current, mergedPrefs, blobbyLogRef.current, getCameraToWrite(), deletedIdsRef.current);
          if (!getMergedFlag(userId, true)) setMergedFlag(userId, true);
          return;
        }

        const mergedBlobs = mergeLocalAndCloudBlobs(current, cloud.blobs, deletedIdsRef.current);
        console.log("[blob sync] merged blobs:", mergedBlobs.length);
        dispatch({ type: "SET_BLOBS", payload: mergedBlobs });
        setMergedFlag(userId, true);
        await upsertUserBlobs(userId, mergedBlobs, mergedPrefs, cloud.blobbyLog ?? blobbyLogRef.current, getCameraToWrite(), deletedIdsRef.current);
      } finally {
        syncingRef.current = false;
        clearAllLocalBlobData();
        clearPreferences();
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
      setBlobbyLog("");
      saveBlobsToStorage([]);
      deletedIdsRef.current = {};
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
    const camera = getCameraToWrite();
    if (action === "major") {
      clearSaveTimeout();
      lastActionRef.current = null;
      upsertUserBlobs(userId, blobs, preferences, blobbyLogRef.current, camera, deletedIdsRef.current);
      return; // skip debounced save this run
    }
    if (action === "position") {
      if (positionSaveTimeoutRef.current) clearTimeout(positionSaveTimeoutRef.current);
      positionSaveTimeoutRef.current = setTimeout(() => {
        positionSaveTimeoutRef.current = null;
        lastActionRef.current = null;
        clearSaveTimeout();
        upsertUserBlobs(userId, blobsRef.current, preferences, blobbyLogRef.current, getCameraToWrite(), deletedIdsRef.current);
      }, POSITION_SAVE_DEBOUNCE_MS);
    }

    debouncedSaveToCloud(userId, blobs, preferences, blobbyLogRef.current, camera, deletedIdsRef.current);
  }, [blobs, userId, preferences, isLoading, getCameraToWrite]);

  // Poll cloud when logged in: first poll soon, then on a cadence; also poll when tab/window becomes visible (sync when user switches to this tab)
  useEffect(() => {
    if (!userId || !supabase) return;

    const poll = async () => {
      const cloud = await fetchUserBlobs(userId);
      if (!cloud) return;
      // Merge any tombstones from the cloud into our local set so we can apply them on the next write
      if (cloud.deletedIds && Object.keys(cloud.deletedIds).length > 0) {
        deletedIdsRef.current = mergeDeletedIds(deletedIdsRef.current, cloud.deletedIds);
      }
      const latestLocal = blobsRef.current;
      let merged = mergeLocalAndCloudBlobs(latestLocal, cloud.blobs, deletedIdsRef.current);
      // When cloud is ahead of our last push, apply remote deletions: drop any blob not in cloud.
      const lastPush = getLastPushTime(userId, true);
      if (
        cloud.updatedAt &&
        lastPush &&
        new Date(cloud.updatedAt) > new Date(lastPush)
      ) {
        const cloudIds = new Set(cloud.blobs.map((b) => b.id));
        merged = merged.filter((b) => cloudIds.has(b.id));
      }
      if (!blobsEqual(merged, latestLocal)) {
        console.log("[blob sync] poll: cloud has updates, merging", merged.length, "blobs");
        dispatchReducer({ type: "SET_BLOBS", payload: merged });
        // Logged-in users: do not cache in browser
      } else {
        console.log("[blob sync] poll: cloud fetch ok, no changes");
      }
      // Sync preferences from cloud (theme, blobby color, etc.) — in memory only when logged in
      if (cloud.preferences) {
        const currentPrefs = loadPreferences();
        const mergedPrefs = mergeCloudPreferences(currentPrefs, cloud.preferences);
        setPreferencesState(mergedPrefs);
      }
      // Sync Blobby log from cloud (other devices may have appended)
      if (cloud.blobbyLog != null && cloud.blobbyLog !== blobbyLogRef.current) {
        setBlobbyLog(cloud.blobbyLog);
      }
      // Remember cloud camera so we don't overwrite a newer camera from another tab when we save
      if (cloud.camera) {
        lastFetchedCameraRef.current = { camera: cloud.camera, updatedAt: cloud.camera.updatedAt ?? null };
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

  const appendBlobbyLog = useCallback(
    (text: string) => {
      const currentLog = userId ? blobbyLogRef.current : loadBlobbyLog();
      const newLog = appendBlobbyLogPersistence(userId, text, currentLog);
      setBlobbyLog(newLog);
      if (userId) {
        upsertUserBlobs(userId, blobsRef.current, preferences, newLog, getCameraToWrite(), deletedIdsRef.current);
      }
    },
    [userId, preferences, getCameraToWrite]
  );

  const clearInitialCamera = useCallback(() => setInitialCameraPosition(null), []);
  const persistCamera = useCallback(
    (camera: CameraPosition, options?: { immediate?: boolean }) => {
      const withTimestamp: CameraPosition = { ...camera, updatedAt: new Date().toISOString() };
      cameraRef.current = withTimestamp;
      if (!userId) return;
      if (options?.immediate) {
        clearSaveTimeout();
        upsertUserBlobs(userId, blobsRef.current, preferences, blobbyLogRef.current, withTimestamp, deletedIdsRef.current);
        lastFetchedCameraRef.current = { camera: withTimestamp, updatedAt: withTimestamp.updatedAt ?? null };
      } else {
        debouncedSaveToCloud(userId, blobsRef.current, preferences, blobbyLogRef.current, withTimestamp, deletedIdsRef.current);
      }
    },
    [userId, preferences]
  );

  const undoLabel =
    undoStack.length > 0
      ? describeBlobStateChange(undoStack[undoStack.length - 1], blobs)
      : "";
  const redoLabel =
    redoStack.length > 0
      ? describeBlobStateChange(blobs, redoStack[redoStack.length - 1])
      : "";

  const value: BlobsContextValue = {
    blobs,
    dispatch,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoLabel,
    redoLabel,
    pushUndoSnapshot,
    preferences,
    setPreferences,
    userId,
    boardOwnerId: userId,
    isLoading,
    anyMenuOpenRef,
    incrementMenuOpen,
    decrementMenuOpen,
    appendBlobbyLog,
    blobbyLog,
    initialCameraPosition,
    clearInitialCamera,
    persistCamera,
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
