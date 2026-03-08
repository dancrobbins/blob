"use client";

import React, { useEffect, useState } from "react";

const CHECK_URL = "/api/build-info";
const RETRIES = 2;
const RETRY_DELAY_MS = 1500;

export function ConnectivityGuard({ children }: { children: React.ReactNode }) {
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;

    const check = async () => {
      try {
        const res = await fetch(CHECK_URL, { cache: "no-store", method: "GET" });
        if (!cancelled && res.ok) {
          setUnreachable(false);
          return;
        }
      } catch {
        // Network error or CORS, etc.
      }
      if (cancelled) return;
      attempt++;
      if (attempt <= RETRIES) {
        setTimeout(check, RETRY_DELAY_MS);
      } else {
        setUnreachable(true);
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!unreachable) return <>{children}</>;

  return (
    <>
      <div
        role="alert"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          padding: "10px 16px",
          backgroundColor: "#c75a00",
          color: "#fff",
          fontSize: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span>
          Server unreachable. Start the dev server (e.g. run <code style={{ background: "rgba(0,0,0,0.2)", padding: "2px 6px", borderRadius: 4 }}>npm run runapp</code>) and reload.
        </span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: "6px 14px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            backgroundColor: "rgba(255,255,255,0.25)",
            color: "#fff",
            border: "none",
            borderRadius: 6,
          }}
        >
          Reload
        </button>
      </div>
      <div style={{ paddingTop: 52 }}>{children}</div>
    </>
  );
}
