"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useBlobsContext } from "@/contexts/BlobsContext";
import { getDisplayName, getAvatarUrl } from "@/lib/auth-identity";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const PRESENCE_STORAGE_KEY = "blob_presence_session_id";
/** How often (ms) we send our cursor position over the wire. */
const CURSOR_SEND_INTERVAL_MS = 33;

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem(PRESENCE_STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(PRESENCE_STORAGE_KEY, id);
  }
  return id;
}

export type OtherPresence = {
  sessionId: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  worldX: number;
  worldY: number;
  /** Display label: name, or "Name 2" etc. when same user has multiple sessions. */
  displayLabel: string;
};

/** Called whenever any remote cursor moves (hot path — no React re-render). */
export type CursorMoveCallback = (sessionId: string, worldX: number, worldY: number) => void;

type PresenceContextValue = {
  /** Update local cursor position (world coords). Throttled. No-op when not in channel. */
  updateLocalCursor: (worldX: number, worldY: number) => void;
  /** Other users' presences (join/leave only, not cursor moves). */
  otherPresences: OtherPresence[];
  /** This tab's session id (to exclude self from display). */
  mySessionId: string | null;
  /** Register a callback that fires on every remote cursor move (bypasses React state). */
  setOnCursorMove: (cb: CursorMoveCallback | null) => void;
};

const PresenceContext = createContext<PresenceContextValue | null>(null);

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { userId, boardOwnerId } = useBlobsContext();
  const [otherPresences, setOtherPresences] = useState<OtherPresence[]>([]);
  const mySessionIdRef = useRef<string | null>(null);
  const [mySessionId, setMySessionId] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastPayloadRef = useRef<Record<string, unknown> | null>(null);
  const sendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSendRef = useRef<{ worldX: number; worldY: number } | null>(null);
  /** Hot-path callback — called directly without setState when a remote cursor moves. */
  const onCursorMoveRef = useRef<CursorMoveCallback | null>(null);
  /**
   * Stable arrival-order map: sessionId → order number (1-based) within that userId.
   * Built on join, cleared on leave/teardown. This keeps numbers stable even when
   * the presence state is re-read (sync events don't renumber existing sessions).
   */
  const sessionArrivalOrderRef = useRef<Map<string, number>>(new Map());
  /** Per-userId counter so we know what the next arrival-order number is. */
  const userSessionCounterRef = useRef<Map<string, number>>(new Map());
  /** Last-rendered presence list (for label-change detection). */
  const previousPresenceRef = useRef<OtherPresence[]>([]);

  const setOnCursorMove = useCallback((cb: CursorMoveCallback | null) => {
    onCursorMoveRef.current = cb;
  }, []);

  const updateLocalCursor = useCallback((worldX: number, worldY: number) => {
    const ch = channelRef.current;
    const payload = lastPayloadRef.current;
    if (!ch || !payload) return;

    // Always store the latest position so we never send stale coords.
    pendingSendRef.current = { worldX, worldY };

    if (sendTimerRef.current) return; // already scheduled
    // Send immediately for the first call, then enforce minimum interval.
    const next = { ...payload, worldX, worldY };
    lastPayloadRef.current = next;
    ch.track(next);
    sendTimerRef.current = setTimeout(() => {
      sendTimerRef.current = null;
      const pending = pendingSendRef.current;
      if (!pending) return;
      const latest = { ...lastPayloadRef.current!, ...pending };
      lastPayloadRef.current = latest;
      pendingSendRef.current = null;
      ch.track(latest);
    }, CURSOR_SEND_INTERVAL_MS);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    mySessionIdRef.current = getOrCreateSessionId();
    setMySessionId(mySessionIdRef.current);
  }, []);

  useEffect(() => {
    if (!supabase || !boardOwnerId || !userId) {
      setOtherPresences([]);
      if (channelRef.current) {
        supabase?.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      lastPayloadRef.current = null;
      return;
    }

    const sessionId = mySessionIdRef.current;
    if (!sessionId) return;

    const client = supabase;
    const channelName = `presence:${boardOwnerId}`;
    const channel = client.channel(channelName);
    channelRef.current = channel;

    /**
     * Record any newly-seen sessions in arrival order (per userId).
     * Called on join events so numbers are assigned at first sight and never change.
     */
    function recordArrivals(stateSnapshot: ReturnType<typeof channel.presenceState>) {
      for (const key of Object.keys(stateSnapshot)) {
        const joins = stateSnapshot[key] as Array<Record<string, unknown>>;
        if (!Array.isArray(joins)) continue;
        for (const p of joins) {
          const sid = (p.sessionId as string) ?? "";
          if (!sid || sessionArrivalOrderRef.current.has(sid)) continue;
          const uid = (p.userId as string) ?? "";
          const prev = userSessionCounterRef.current.get(uid) ?? 0;
          const next = prev + 1;
          userSessionCounterRef.current.set(uid, next);
          sessionArrivalOrderRef.current.set(sid, next);
        }
      }
    }

    function buildPresenceList() {
      const state = channel.presenceState();

      // Collect full presence so we know total per-user counts.
      const allPresences: Array<{ sessionId: string; userId: string; displayName: string }> = [];
      for (const key of Object.keys(state)) {
        const joins = state[key] as Array<Record<string, unknown>>;
        if (!Array.isArray(joins)) continue;
        for (const p of joins) {
          allPresences.push({
            sessionId: (p.sessionId as string) ?? "",
            userId: (p.userId as string) ?? "",
            displayName: (p.displayName as string) ?? "Guest",
          });
        }
      }

      // Count sessions per user across the full state.
      const userSessionCount = new Map<string, number>();
      for (const p of allPresences) {
        userSessionCount.set(p.userId, (userSessionCount.get(p.userId) ?? 0) + 1);
      }

      const list: OtherPresence[] = [];
      for (const key of Object.keys(state)) {
        const joins = state[key] as Array<Record<string, unknown>>;
        if (!Array.isArray(joins)) continue;
        for (const p of joins) {
          const sid = p.sessionId as string | undefined;
          if (!sid || sid === sessionId) continue;
          const uid = (p.userId as string) ?? "";
          const name = (p.displayName as string) ?? "Guest";
          const avatar = (p.avatarUrl as string) ?? null;
          const wx = typeof p.worldX === "number" ? p.worldX : 0;
          const wy = typeof p.worldY === "number" ? p.worldY : 0;

          const totalForUser = userSessionCount.get(uid) ?? 1;
          const arrivalNum = sessionArrivalOrderRef.current.get(sid);
          const displayLabel =
            totalForUser > 1 && arrivalNum !== undefined
              ? `${name} ${arrivalNum}`
              : name;

          list.push({
            sessionId: sid,
            userId: uid,
            displayName: name,
            avatarUrl: avatar,
            worldX: wx,
            worldY: wy,
            displayLabel,
          });
        }
      }
      return list;
    }

    function applyPresenceList(list: OtherPresence[]) {
      const cb = onCursorMoveRef.current;
      if (cb) {
        for (const p of list) {
          cb(p.sessionId, p.worldX, p.worldY);
        }
      }
      const prev = previousPresenceRef.current;
      const prevById = new Map(prev.map((p) => [p.sessionId, p]));
      const rosterChanged =
        prev.length !== list.length ||
        list.some((p) => {
          const was = prevById.get(p.sessionId);
          return !was || was.displayLabel !== p.displayLabel;
        });
      if (rosterChanged) {
        previousPresenceRef.current = list;
        setOtherPresences([...list]);
      }
    }

    function onSync() {
      const state = channel.presenceState();
      recordArrivals(state);
      const list = buildPresenceList();
      applyPresenceList(list);
    }

    function onPresenceChange() {
      const state = channel.presenceState();
      recordArrivals(state);
      const list = buildPresenceList();
      applyPresenceList(list);
    }

    channel
      .on("presence", { event: "sync" }, onSync)
      .on("presence", { event: "join" }, onPresenceChange)
      .on("presence", { event: "leave" }, onPresenceChange)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          client.auth.getSession().then(({ data: { session } }) => {
            const user = session?.user ?? null;
            const name = getDisplayName(user);
            const avatar = getAvatarUrl(user);
            const payload = {
              sessionId,
              userId,
              displayName: name,
              avatarUrl: avatar,
              worldX: 0,
              worldY: 0,
            };
            lastPayloadRef.current = payload;
            channel.track(payload);
          });
        }
      });

    return () => {
      if (sendTimerRef.current) {
        clearTimeout(sendTimerRef.current);
        sendTimerRef.current = null;
      }
      sessionArrivalOrderRef.current = new Map();
      userSessionCounterRef.current = new Map();
      previousPresenceRef.current = [];
      client.removeChannel(channel);
      channelRef.current = null;
      lastPayloadRef.current = null;
      setOtherPresences([]);
    };
  }, [boardOwnerId, userId]);

  const value: PresenceContextValue = {
    updateLocalCursor,
    otherPresences,
    mySessionId,
    setOnCursorMove,
  };

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence(): PresenceContextValue {
  const ctx = useContext(PresenceContext);
  if (!ctx) throw new Error("usePresence must be used within PresenceProvider");
  return ctx;
}
