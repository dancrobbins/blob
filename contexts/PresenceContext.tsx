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
  /** Session IDs from last state update; only call setOtherPresences when this set changes (join/leave). */
  const previousSessionIdsRef = useRef<Set<string>>(new Set());

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

    function buildPresenceList() {
      const state = channel.presenceState();
      const allPresences: Array<{ sessionId: string; userId: string; displayName: string }> = [];
      for (const key of Object.keys(state)) {
        const joins = state[key] as Array<Record<string, unknown>>;
        if (!Array.isArray(joins)) continue;
        for (const p of joins) {
          const sid = (p.sessionId as string) ?? "";
          const uid = (p.userId as string) ?? "";
          const name = (p.displayName as string) ?? "Guest";
          allPresences.push({ sessionId: sid, userId: uid, displayName: name });
        }
      }
      const byUser = new Map<string, typeof allPresences>();
      for (const p of allPresences) {
        const arr = byUser.get(p.userId) ?? [];
        arr.push(p);
        byUser.set(p.userId, arr);
      }
      const sessionIdToLabel = new Map<string, string>();
      for (const [, arr] of byUser) {
        arr.sort((a, b) => a.sessionId.localeCompare(b.sessionId));
        arr.forEach((p, i) => {
          sessionIdToLabel.set(
            p.sessionId,
            arr.length > 1 ? `${p.displayName} ${i + 1}` : p.displayName
          );
        });
      }
      const list: OtherPresence[] = [];
      for (const key of Object.keys(state)) {
        const joins = state[key] as Array<Record<string, unknown>>;
        if (!Array.isArray(joins)) continue;
        for (const p of joins) {
          const sid = p.sessionId as string | undefined;
          if (sid === sessionId) continue;
          const uid = (p.userId as string) ?? "";
          const name = (p.displayName as string) ?? "Guest";
          const avatar = (p.avatarUrl as string) ?? null;
          const wx = typeof p.worldX === "number" ? p.worldX : 0;
          const wy = typeof p.worldY === "number" ? p.worldY : 0;
          list.push({
            sessionId: sid ?? "",
            userId: uid,
            displayName: name,
            avatarUrl: avatar,
            worldX: wx,
            worldY: wy,
            displayLabel: sessionIdToLabel.get(sid ?? "") ?? name,
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
      const nextIds = new Set(list.map((p) => p.sessionId));
      const prev = previousSessionIdsRef.current;
      const idsChanged =
        prev.size !== nextIds.size || list.some((p) => !prev.has(p.sessionId));
      if (idsChanged) {
        previousSessionIdsRef.current = nextIds;
        setOtherPresences([...list]);
      }
    }

    function onSync() {
      const list = buildPresenceList();
      applyPresenceList(list);
    }

    function onPresenceChange(payload: { event: string }) {
      if (payload.event === "sync") {
        onSync();
        return;
      }
      const list = buildPresenceList();
      applyPresenceList(list);
    }

    channel
      .on("presence", { event: "sync" }, onSync)
      .on("presence", { event: "join" }, onPresenceChange.bind(null, { event: "join" }))
      .on("presence", { event: "leave" }, onPresenceChange.bind(null, { event: "leave" }))
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
      previousSessionIdsRef.current = new Set();
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
