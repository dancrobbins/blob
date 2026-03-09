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
const CURSOR_THROTTLE_MS = 80;

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

type PresenceContextValue = {
  /** Update local cursor position (world coords). Throttled. No-op when not in channel. */
  updateLocalCursor: (worldX: number, worldY: number) => void;
  /** Other users' presences (excluding self). */
  otherPresences: OtherPresence[];
  /** This tab's session id (to exclude self from display). */
  mySessionId: string | null;
};

const PresenceContext = createContext<PresenceContextValue | null>(null);

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { userId, boardOwnerId } = useBlobsContext();
  const [otherPresences, setOtherPresences] = useState<OtherPresence[]>([]);
  const mySessionIdRef = useRef<string | null>(null);
  const [mySessionId, setMySessionId] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPayloadRef = useRef<Record<string, unknown> | null>(null);

  const updateLocalCursor = useCallback((worldX: number, worldY: number) => {
    const ch = channelRef.current;
    const payload = lastPayloadRef.current;
    if (!ch || !payload) return;

    const next = { ...payload, worldX, worldY };
    lastPayloadRef.current = next;

    if (throttleRef.current) return;
    throttleRef.current = setTimeout(() => {
      throttleRef.current = null;
      ch.track(next);
    }, CURSOR_THROTTLE_MS);
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

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
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
              displayLabel: name,
            });
          }
        }
        const byUser = new Map<string, typeof list>();
        for (const p of list) {
          const arr = byUser.get(p.userId) ?? [];
          arr.push(p);
          byUser.set(p.userId, arr);
        }
        for (const [, arr] of byUser) {
          arr.sort((a, b) => a.sessionId.localeCompare(b.sessionId));
          arr.forEach((p, i) => {
            p.displayLabel = arr.length > 1 ? `${p.displayName} ${i + 1}` : p.displayName;
          });
        }
        setOtherPresences([...list]);
      })
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
      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
        throttleRef.current = null;
      }
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
