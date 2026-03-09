"use client";

import React, { useEffect, useState, useRef } from "react";
import { useBlobsContext } from "@/contexts/BlobsContext";

/**
 * Each tab generates a unique session ID stored in sessionStorage.
 * When logged in, the tab writes { [tabSessionId]: true } into the
 * shared localStorage key. The toast dismisses as soon as 2+ entries exist.
 *
 * This works even when both tabs are logged in as the same Google account,
 * because we track *tabs*, not user IDs.
 */
const STORAGE_KEY = "e2eSyncAuthTabs";
const POLL_MS = 600;

function getSessionTabId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem("e2eSyncTabId");
    if (!id) {
      id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem("e2eSyncTabId", id);
    }
    return id;
  } catch {
    return `t_${Date.now()}`;
  }
}

export function TwoTabLoginToast() {
  const { userId } = useBlobsContext();
  const tabId = useRef<string>("");
  const [readyTabCount, setReadyTabCount] = useState(0);

  // Initialise tab ID once on mount
  useEffect(() => {
    tabId.current = getSessionTabId();
  }, []);

  // When this tab is logged in, stamp its ID into the shared map
  useEffect(() => {
    if (!userId || !tabId.current) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const map: Record<string, boolean> = raw ? JSON.parse(raw) : {};
      if (!map[tabId.current]) {
        map[tabId.current] = true;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
      }
    } catch (_) {}
  }, [userId]);

  // Poll: count how many tabs have written their ID as logged-in
  useEffect(() => {
    const check = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const map: Record<string, boolean> = raw ? JSON.parse(raw) : {};
        const count = Object.values(map).filter(Boolean).length;
        setReadyTabCount(count);
      } catch (_) {
        setReadyTabCount(0);
      }
    };
    check();
    const id = setInterval(check, POLL_MS);
    return () => clearInterval(id);
  }, []);

  // Hide once this tab is logged in AND at least one other tab is also logged in
  const bothReady = !!userId && readyTabCount >= 2;

  if (bothReady) return null;

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
      {!userId
        ? "Log in to Google in this tab to continue the test."
        : "Waiting for the other tab to log in…"}
    </div>
  );
}
