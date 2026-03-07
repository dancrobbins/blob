"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function getCodeFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (code) return code;
  const hash = window.location.hash?.replace(/^#/, "");
  if (!hash) return null;
  const hashParams = new URLSearchParams(hash);
  return hashParams.get("code");
}

function AuthCallbackInner() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    const client = supabase;
    if (!client) {
      window.location.href = "/";
      return;
    }

    const run = async () => {
      // Let the client read the session from the URL (handles hash with access_token/refresh_token)
      const { data: { session } } = await client.auth.getSession();
      if (session) {
        setStatus("ok");
        window.location.href = "/";
        return;
      }

      const code = searchParams.get("code") ?? getCodeFromUrl();
      if (!code) {
        window.location.href = "/";
        return;
      }

      const timeoutMs = 15000;
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Sign-in timed out")), timeoutMs)
      );

      try {
        const result = await Promise.race([
          client.auth.exchangeCodeForSession(code),
          timeout,
        ]);
        if (result.error) {
          setStatus("error");
          setTimeout(() => {
            window.location.href = "/?auth_error=1";
          }, 2000);
        } else {
          setStatus("ok");
          window.location.href = "/";
        }
      } catch {
        setStatus("error");
        setTimeout(() => {
          window.location.href = "/?auth_error=1";
        }, 2000);
      }
    };

    run();
  }, [searchParams]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {status === "loading" && <p>Signing you in…</p>}
      {status === "ok" && <p>Signed in. Redirecting…</p>}
      {status === "error" && <p>Sign-in failed. Redirecting…</p>}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>Signing you in…</div>}>
      <AuthCallbackInner />
    </Suspense>
  );
}
