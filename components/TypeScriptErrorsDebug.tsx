"use client";

import { useCallback, useEffect, useState } from "react";

// High z-index so the button and panel appear above Cursor Browser's embedded viewport
const DEBUG_Z_INDEX = 2147483647;

interface TsErrorItem {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
  raw: string;
}

function formatError(e: TsErrorItem): string {
  if (e.file || e.code) {
    return `${e.file} (${e.line},${e.column}) ${e.code}: ${e.message}`;
  }
  return e.message || e.raw;
}

function formatAllForCopy(errors: TsErrorItem[]): string {
  return errors.map(formatError).join("\n");
}

export function TypeScriptErrorsDebug() {
  const [errors, setErrors] = useState<TsErrorItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const FETCH_TIMEOUT_MS = 15000;

  const fetchErrors = useCallback(async () => {
    setFetchError(null);
    setLoading(true);
    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch("/api/ts-errors", {
        cache: "no-store",
        signal: ac.signal,
      });
      clearTimeout(timeoutId);
      let data: { errors?: TsErrorItem[] };
      try {
        data = await res.json();
      } catch {
        data = { errors: [] };
      }
      const nextErrors = Array.isArray(data.errors) ? data.errors : [];
      setErrors(nextErrors);
      if (!res.ok) {
        setFetchError(res.statusText || "Request failed");
      }
    } catch (e) {
      clearTimeout(timeoutId);
      // Do not clear errors on fetch failure — keep previous TS errors so the red button still shows
      if (e instanceof Error && e.name === "AbortError") {
        setFetchError("Request timed out");
      } else {
        setFetchError(e instanceof Error ? e.message : "Failed to load");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  useEffect(() => {
    const onFocus = () => { fetchErrors(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchErrors]);

  const handleCopy = useCallback(() => {
    const text = formatAllForCopy(errors);
    void navigator.clipboard.writeText(text);
  }, [errors]);

  const hasErrors = errors.length > 0;
  const showRedButton = hasErrors;
  const showCheckFailedButton = !!fetchError && !hasErrors;
  const showAnyButton = showRedButton || showCheckFailedButton;

  if (!showAnyButton && !open) {
    return null;
  }

  return (
    <>
      {showRedButton && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="TypeScript errors"
          style={{
            position: "fixed",
            left: 12,
            bottom: 12,
            zIndex: DEBUG_Z_INDEX,
            padding: "8px 12px",
            backgroundColor: "#c00",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          }}
        >
          TypeScript errors
        </button>
      )}
      {showCheckFailedButton && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Could not check TypeScript errors"
          style={{
            position: "fixed",
            left: 12,
            bottom: 12,
            zIndex: DEBUG_Z_INDEX,
            padding: "8px 12px",
            backgroundColor: "#c75a00",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          }}
        >
          Could not check TypeScript errors
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="TypeScript errors panel"
          style={{
            position: "fixed",
            left: 12,
            bottom: 52,
            zIndex: DEBUG_Z_INDEX,
            width: "min(420px, calc(100vw - 24px))",
            maxHeight: "min(60vh, 400px)",
            backgroundColor: "var(--bg)",
            color: "var(--fg)",
            border: "1px solid var(--muted)",
            borderRadius: 8,
            boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid var(--muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
              gap: 8,
            }}
          >
            <strong style={{ fontSize: 14 }}>TypeScript errors</strong>
            <span style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={handleCopy}
              style={{
                  padding: "4px 10px",
                  fontSize: 12,
                  cursor: "pointer",
                  backgroundColor: "var(--muted)",
                  color: "var(--bg)",
                  border: "none",
                  borderRadius: 4,
                }}
              >
                Copy
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close panel"
                style={{
                  padding: "4px 10px",
                  fontSize: 12,
                  cursor: "pointer",
                  backgroundColor: "var(--muted)",
                  color: "var(--bg)",
                  border: "none",
                  borderRadius: 4,
                }}
              >
                Close
              </button>
            </span>
          </div>
          <div
            style={{
              padding: 10,
              overflow: "auto",
              fontSize: 12,
              fontFamily: "ui-monospace, monospace",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {loading ? (
              <span style={{ color: "var(--muted)" }}>Checking…</span>
            ) : (
              <>
                {fetchError && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: errors.length > 0 ? 12 : 0 }}>
                    <span style={{ color: "var(--muted)" }}>Could not check: {fetchError}</span>
                    <button
                      type="button"
                      onClick={() => fetchErrors()}
                      style={{
                        padding: "6px 12px",
                        fontSize: 12,
                        cursor: "pointer",
                        alignSelf: "flex-start",
                        backgroundColor: "var(--muted)",
                        color: "var(--bg)",
                        border: "none",
                        borderRadius: 4,
                      }}
                    >
                      Retry
                    </button>
                  </div>
                )}
                {errors.length === 0 && !fetchError ? (
                  <span style={{ color: "var(--muted)" }}>No TypeScript errors.</span>
                ) : (errors.length > 0) ? (
                  <>
                    {fetchError && <div style={{ color: "var(--muted)", marginBottom: 6 }}>Previously loaded errors:</div>}
                    {errors.map((e, i) => (
                      <div
                        key={i}
                        style={{
                          marginBottom: 8,
                          paddingBottom: 8,
                          borderBottom:
                            i < errors.length - 1
                              ? "1px solid var(--muted)"
                              : "none",
                        }}
                      >
                        {e.file && (
                          <div style={{ color: "var(--muted)", marginBottom: 2 }}>
                            {e.file}
                            {(e.line || e.column) && (
                              <span> ({e.line}, {e.column})</span>
                            )}
                          </div>
                        )}
                        {e.code && (
                          <span style={{ fontWeight: 600, marginRight: 6 }}>
                            {e.code}
                          </span>
                        )}
                        <span>{e.message || e.raw}</span>
                      </div>
                    ))}
                  </>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
