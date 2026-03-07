"use client";

import React, { useState, useRef, useEffect } from "react";
import { useBlobsContext } from "@/contexts/BlobsContext";
import { APP_VERSION, BUILD_TIME, BUILD_UPDATES } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { BLOBBY_GRID_COLS, BLOBBY_GRID_ROWS } from "@/lib/types";
import styles from "./Header.module.css";

// Grid order: left-to-right, top-to-bottom (indices 0..8). Add names as you add expression assets.
const BLOBBY_COLORS: string[] = ["pink"];

export function Header({
  hasHiddenBlobs,
  onUnhideAll,
}: {
  hasHiddenBlobs?: boolean;
  onUnhideAll?: () => void;
}) {
  const { preferences, setPreferences, userId, anyMenuOpenRef } = useBlobsContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    anyMenuOpenRef.current = menuOpen || accountOpen;
  }, [menuOpen, accountOpen, anyMenuOpenRef]);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [buildTooltipOpen, setBuildTooltipOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const buildTooltipRef = useRef<HTMLDivElement>(null);

  const readAvatarFromUser = (user: { user_metadata?: Record<string, unknown>; raw_user_meta_data?: Record<string, unknown> } | null) => {
    if (!user) return null;
    const meta = user.user_metadata ?? user.raw_user_meta_data ?? {};
    return (meta.avatar_url as string) ?? (meta.picture as string) ?? null;
  };

  useEffect(() => {
    if (!supabase || !userId) {
      setUserAvatar(null);
      return;
    }
    const applyAvatar = (user: Parameters<typeof readAvatarFromUser>[0]) => {
      setUserAvatar(readAvatarFromUser(user));
    };
    supabase.auth.getSession().then(({ data: { session } }) => {
      applyAvatar(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applyAvatar(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [userId]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        accountRef.current && !accountRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
        setAccountOpen(false);
        setBuildTooltipOpen(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  // Close build tooltip when clicking outside it (e.g. elsewhere in menu)
  useEffect(() => {
    if (!buildTooltipOpen) return;
    const close = (e: MouseEvent) => {
      if (buildTooltipRef.current && !buildTooltipRef.current.contains(e.target as Node)) {
        setBuildTooltipOpen(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [buildTooltipOpen]);

  const buildDateLocal = (() => {
    try {
      return new Date(BUILD_TIME).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return BUILD_TIME;
    }
  })();

  const setTheme = (theme: "light" | "dark") => {
    setPreferences((p) => ({ ...p, theme }));
  };

  const handleBlobbyCellClick = (index: number) => {
    const color = BLOBBY_COLORS[index] ?? preferences.blobbyColor;
    setPreferences((p) => ({ ...p, blobbyColor: color }));
  };

  const signIn = async () => {
    setSignInError(null);
    if (!supabase) {
      setSignInError(
        "Sign-in is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local and configure Google in the Supabase dashboard."
      );
      return;
    }
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setSignInError(error.message ?? "Sign-in failed.");
      return;
    }
    if (data?.url) {
      setAccountOpen(false);
      window.location.href = data.url;
    }
  };

  const signOut = () => {
    if (!supabase) return;
    supabase.auth.signOut();
    setAccountOpen(false);
  };

  return (
    <header className={styles.header}>
      <div className={styles.left} ref={menuRef}>
        <button
          type="button"
          className={styles.mainMenu}
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Open Main menu"
          aria-expanded={menuOpen}
        >
          <span className={styles.mainMenuIconBar} />
          <span className={styles.mainMenuIconBar} />
          <span className={styles.mainMenuIconBar} />
        </button>
        {menuOpen && (
          <div className={styles.menu}>
            <div className={styles.menuSection}>
              <span className={styles.menuLabel}>Theme</span>
              <div className={styles.themeTabs} role="tablist" aria-label="Theme">
                <div
                  className={styles.themeTabSelector}
                  style={{
                    transform:
                      preferences.theme === "dark"
                        ? "translateX(100%)"
                        : "translateX(0)",
                  }}
                  aria-hidden
                />
                <button
                  type="button"
                  role="tab"
                  aria-selected={preferences.theme === "light"}
                  className={styles.themeTab}
                  onClick={() => setTheme("light")}
                >
                  Light
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={preferences.theme === "dark"}
                  className={styles.themeTab}
                  onClick={() => setTheme("dark")}
                >
                  Dark
                </button>
              </div>
            </div>
            <div className={styles.menuSection}>
              <span className={styles.menuLabel}>Blobby</span>
              <div
                className={styles.blobbyGrid}
                style={{
                  width: 120,
                  height: 120,
                  backgroundImage: "url(/assets/character%20color%20schemes.png)",
                  backgroundSize: "100% 100%",
                }}
              >
                {Array.from({ length: BLOBBY_GRID_ROWS * BLOBBY_GRID_COLS }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={styles.blobbyCell}
                    onClick={() => handleBlobbyCellClick(i)}
                    style={{
                      width: `${100 / BLOBBY_GRID_COLS}%`,
                      height: `${100 / BLOBBY_GRID_ROWS}%`,
                      left: `${(i % BLOBBY_GRID_COLS) * (100 / BLOBBY_GRID_COLS)}%`,
                      top: `${Math.floor(i / BLOBBY_GRID_COLS) * (100 / BLOBBY_GRID_ROWS)}%`,
                    }}
                    aria-label={`Blobby option ${i + 1}`}
                  />
                ))}
              </div>
            </div>
            <div className={styles.menuSection}>
              <button
                type="button"
                className={styles.menuAction}
                disabled={!hasHiddenBlobs}
                onClick={() => onUnhideAll?.()}
              >
                Unhide all
              </button>
            </div>
            <div className={styles.menuSection}>
              <span className={styles.menuLabel}>Version</span>
              <span className={styles.menuValue}>{APP_VERSION}</span>
            </div>
            <div className={styles.menuSection}>
              <span className={styles.menuLabel}>Build</span>
              <div
                ref={buildTooltipRef}
                className={styles.buildTooltipWrap}
                onMouseEnter={() => setBuildTooltipOpen(true)}
                onMouseLeave={() => setBuildTooltipOpen(false)}
              >
                <button
                  type="button"
                  className={styles.buildTooltipTrigger}
                  onClick={() => setBuildTooltipOpen((o) => !o)}
                  aria-expanded={buildTooltipOpen}
                  aria-label="Build date; tap or hover for updates in this build"
                >
                  {buildDateLocal}
                </button>
                {buildTooltipOpen && BUILD_UPDATES.length > 0 && (
                  <div
                    className={styles.buildTooltip}
                    role="tooltip"
                    id="build-updates-tooltip"
                  >
                    <ul className={styles.buildTooltipList}>
                      {BUILD_UPDATES.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.right} ref={accountRef}>
        <button
          type="button"
          className={styles.accountBubble}
          onClick={() => setAccountOpen((o) => !o)}
          aria-label="Account"
          aria-expanded={accountOpen}
        >
          {userAvatar ? (
            <img
              src={userAvatar}
              alt=""
              width={36}
              height={36}
              className={styles.avatarImg}
              referrerPolicy="no-referrer"
              onError={() => setUserAvatar(null)}
            />
          ) : (
            <span className={styles.accountQuestion}>?</span>
          )}
        </button>
        {accountOpen && (
          <div className={styles.accountDropdown}>
            {userId ? (
              <>
                <button type="button" className={styles.accountItem} onClick={signOut}>
                  Logout
                </button>
                <button type="button" className={styles.accountItem} onClick={signIn}>
                  Switch account
                </button>
              </>
            ) : (
              <>
                {signInError && (
                  <p className={styles.accountError}>{signInError}</p>
                )}
                <button type="button" className={styles.accountItem} onClick={signIn}>
                  Login
                </button>
                <button type="button" className={styles.accountItem} onClick={signIn}>
                  Create account
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
