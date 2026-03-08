"use client";

import React from "react";

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("App error boundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            fontFamily: "system-ui, sans-serif",
            backgroundColor: "#fafafa",
            color: "#111",
          }}
        >
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ color: "#666", marginBottom: 16, textAlign: "center", maxWidth: 360 }}>
            A TypeScript or runtime error may have broken the app. Reload to try again.
          </p>
          {this.state.error && (
            <pre
              style={{
                fontSize: 12,
                padding: 12,
                backgroundColor: "#eee",
                borderRadius: 8,
                overflow: "auto",
                maxWidth: "100%",
                marginBottom: 16,
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              backgroundColor: "#111",
              color: "#fff",
              border: "none",
              borderRadius: 8,
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
