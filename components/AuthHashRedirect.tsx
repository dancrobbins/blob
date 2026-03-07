"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * If the OAuth provider redirects to the wrong URL (e.g. / instead of /auth/callback)
 * with tokens in the hash, send the user to the callback page so the session can be
 * set and the URL cleaned. Prevents the home page from showing with a huge token hash
 * and broken UI.
 */
export function AuthHashRedirect() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname === "/auth/callback") return;

    const hash = window.location.hash?.replace(/^#/, "");
    if (!hash) return;

    const params = new URLSearchParams(hash);
    const hasAuthTokens =
      params.has("access_token") ||
      params.has("refresh_token") ||
      params.has("code");

    if (hasAuthTokens) {
      window.location.replace(`/auth/callback${window.location.hash}`);
    }
  }, [pathname]);

  return null;
}
