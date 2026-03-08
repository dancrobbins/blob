"use client";

import React, { useEffect, useState, useRef } from "react";
import { useBlobsContext } from "@/contexts/BlobsContext";

const CHANNEL_NAME = "e2eSyncAuth";
const STORAGE_KEY = "e2eSyncAuthTabs";

function getTabId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem("e2eSyncTabId");
    if (!id) {
      id = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      sessionStorage.setItem("e2eSyncTabId", id);
    }
    return id;
  } catch {
    return `tab_${Date.now()}`;
  }
}

export function TwoTabLoginToast() {
  const { userId } = useBlobsContext();
  const [otherTabsLoggedIn, setOtherTabsLoggedIn] = useState<Set<string>>(new Set());
  const tabIdRef = useRef<string>("");
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    tabIdRef.current = getTabId();
    let channel: BroadcastChannel;
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channelRef.current = channel;
    } catch {
      channelRef.current = null;
      return;
    }

    const handleMessage = (e: MessageEvent) => {
      const data = e.data;
      const myId = tabIdRef.current || getTabId();
      if (data?.type === "auth" && data?.tabId && data?.userId && data.tabId !== myId) {
        setOtherTabsLoggedIn((prev) => new Set(prev).add(data.tabId));
      }
    };
    channel.addEventListener("message", handleMessage);

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      if (typeof parsed === "object" && parsed !== null) {
        const ids = new Set<string>(Object.keys(parsed).filter((k) => parsed[k]));
        setOtherTabsLoggedIn(ids);
      }
    } catch (_) {}

    return () => {
      channel.removeEventListener("message", handleMessage);
      channel.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    const tabId = tabIdRef.current || getTabId();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const next = { ...parsed, [tabId]: true };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      channelRef.current?.postMessage({ type: "auth", tabId, userId });
    } catch (_) {}
  }, [userId]);

  const atLeastTwoLoggedIn = userId ? otherTabsLoggedIn.size >= 1 : false;
  const showToast = !atLeastTwoLoggedIn;

  if (!showToast) return null;

  return (
    <div
      role="alert"
      data-testid="e2e-login-toast"
      style={{
        position: "fixed",
        top: 60,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10000,
        padding: "12px 20px",
        background: "var(--e2e-toast-bg, #1a1a1a)",
        color: "var(--e2e-toast-fg, #fff)",
        borderRadius: 8,
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        fontSize: 14,
        maxWidth: "90vw",
        textAlign: "center",
      }}
    >
      Log in to Google in both tabs to continue test.
    </div>
  );
}
