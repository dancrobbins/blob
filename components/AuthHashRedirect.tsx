"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * If the OAuth provider redirects to the wrong URL (e.g. / instead of /auth/callback)
 * with tokens in the hash or code/params in the query string, send the user to the
 * callback page so the session can be set and the URL cleaned. Prevents the home page
 * from showing with auth params and the user never being logged in.
 */
export function AuthHashRedirect() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname === "/auth/callback") return;

    const search = window.location.search;
    const hash = window.location.hash ?? "";

    // Check query string (e.g. ?code=... from PKCE redirect to / instead of /auth/callback)
    const searchParams = new URLSearchParams(search);
    const hasAuthInSearch =
      searchParams.has("code") ||
      searchParams.has("access_token") ||
      searchParams.has("refresh_token");

    // Check hash (e.g. #access_token=... when redirect went to wrong URL)
    let hasAuthInHash = false;
    if (hash) {
      const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
      hasAuthInHash =
        hashParams.has("access_token") ||
        hashParams.has("refresh_token") ||
        hashParams.has("code");
    }

    if (hasAuthInSearch || hasAuthInHash) {
      const target = `/auth/callback${search}${hash}`;
      window.location.replace(target);
    }
  }, [pathname]);

  return null;
}
