"use client";

import React, { useState, useEffect } from "react";

const E2E_CANCEL_KEY = "e2eSyncCancel";
const E2E_RERUN_KEY = "e2eSyncRerun";
const E2E_RUNNING_KEY = "e2eSyncRunning";

export function TestRunControl() {
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () => {
      try {
        const v = localStorage.getItem(E2E_RUNNING_KEY);
        setRunning(v === "1");
      } catch (_) {}
    };
    check();
    const id = setInterval(check, 500);
    return () => clearInterval(id);
  }, []);

  const handleCancel = () => {
    try {
      localStorage.setItem(E2E_CANCEL_KEY, "1");
    } catch (_) {}
  };

  const handleRerun = () => {
    try {
      localStorage.removeItem(E2E_CANCEL_KEY);
      localStorage.removeItem(E2E_RERUN_KEY);
      localStorage.setItem(E2E_RERUN_KEY, "1");
      window.location.reload();
    } catch (_) {}
  };

  return (
    <div
      data-testid="e2e-test-control"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 10001,
      }}
    >
      {running ? (
        <button
          type="button"
          data-testid="e2e-cancel-test"
          onClick={handleCancel}
          style={{
            padding: "10px 16px",
            fontSize: 14,
            fontWeight: 600,
            background: "var(--e2e-btn-cancel-bg, #c00)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}
        >
          Cancel test
        </button>
      ) : (
        <button
          type="button"
          data-testid="e2e-rerun-test"
          onClick={handleRerun}
          style={{
            padding: "10px 16px",
            fontSize: 14,
            fontWeight: 600,
            background: "var(--e2e-btn-rerun-bg, #0a0)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}
        >
          Rerun test
        </button>
      )}
    </div>
  );
}
