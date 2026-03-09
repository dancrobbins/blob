"use client";

import React, { useState, useRef, useEffect } from "react";
import { useBlobsContext } from "@/contexts/BlobsContext";
import { APP_VERSION, BUILD_TIME, BUILD_UPDATES } from "@/lib/constants";
import type { BuildInfo } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import styles from "./Header.module.css";

export function Header({
  hasHiddenBlobs,
  onUnhideAll,
  hasLockedBlobs,
  onUnlockAll,
  canShowAll = true,
}: {
  hasHiddenBlobs?: boolean;
  onUnhideAll?: () => void;
  hasLockedBlobs?: boolean;
  onUnlockAll?: () => void;
  canShowAll?: boolean;
}) {
  const { preferences, setPreferences, userId, incrementMenuOpen, decrementMenuOpen, undo, redo, canUndo, canRedo } = useBlobsContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const prevAnyOpenRef = useRef(false);

  useEffect(() => {
    const open = menuOpen || accountOpen;
    if (open && !prevAnyOpenRef.current) incrementMenuOpen();
    if (!open && prevAnyOpenRef.current) decrementMenuOpen();
    prevAnyOpenRef.current = open;
  }, [menuOpen, accountOpen, incrementMenuOpen, decrementMenuOpen]);

  useEffect(() => {
    return () => {
      if (menuCloseTimeoutRef.current) clearTimeout(menuCloseTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const closeMenus = () => {
      setMenuOpen(false);
      setAccountOpen(false);
      setBuildTooltipOpen(false);
    };
    window.addEventListener("blob:close-menus", closeMenus);
    return () => window.removeEventListener("blob:close-menus", closeMenus);
  }, []);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [buildTooltipOpen, setBuildTooltipOpen] = useState(false);
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const buildTooltipRef = useRef<HTMLDivElement>(null);
  const menuCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch build info at runtime; refetch when menu opens so new builds show without full refresh
  const fetchBuildInfo = () => {
    fetch("/api/build-info", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: BuildInfo | null) => {
        if (data && typeof data.buildTime === "string" && Array.isArray(data.updates)) {
          setBuildInfo(data);
        }
      })
      .catch(() => {});
  };
  useEffect(() => {
    fetchBuildInfo();
  }, []);
  useEffect(() => {
    if (menuOpen) fetchBuildInfo();
  }, [menuOpen]);

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

  const buildNumberDisplay = buildInfo?.buildNumber ?? 0;
  const buildDateLocal = (() => {
    const raw = buildInfo?.buildTime ?? BUILD_TIME;
    try {
      return new Date(raw).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return typeof raw === "string" ? raw : BUILD_TIME;
    }
  })();
  const buildLabel = buildNumberDisplay > 0 ? `#${buildNumberDisplay} · ${buildDateLocal}` : buildDateLocal;

  const buildUpdatesList = (buildInfo?.updates?.length ? buildInfo.updates : BUILD_UPDATES) as string[];

  const setTheme = (theme: "light" | "dark") => {
    setPreferences((p) => ({ ...p, theme }));
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
      // If Supabase returns a localhost URL (e.g. Site URL in dashboard is localhost) but we're
      // on production, rewrite to current origin so deployed users stay on blobapp.vercel.app.
      // Also set Supabase Auth → URL Configuration: add https://blobapp.vercel.app and
      // https://blobapp.vercel.app/auth/callback to Redirect URLs; set Site URL for production.
      let url = data.url;
      if (typeof window !== "undefined") {
        try {
          const parsed = new URL(url);
          if (
            (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
            window.location.hostname !== "localhost" &&
            window.location.hostname !== "127.0.0.1"
          ) {
            parsed.protocol = window.location.protocol;
            parsed.host = window.location.host;
            url = parsed.toString();
          }
        } catch {
          // keep original url
        }
      }
      window.location.href = url;
    }
  };

  const signOut = () => {
    if (!supabase) return;
    supabase.auth.signOut();
    setAccountOpen(false);
  };

  return (
    <header className={styles.header}>
      <div
        className={styles.left}
        ref={menuRef}
        onMouseEnter={() => {
          if (menuCloseTimeoutRef.current) {
            clearTimeout(menuCloseTimeoutRef.current);
            menuCloseTimeoutRef.current = null;
          }
          setMenuOpen(true);
        }}
        onMouseLeave={() => {
          menuCloseTimeoutRef.current = setTimeout(() => {
            setMenuOpen(false);
            menuCloseTimeoutRef.current = null;
          }, 150);
        }}
      >
        <button
          type="button"
          className={styles.mainMenu}
          data-testid="main-menu"
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
              <div className={styles.menuActionRow}>
                <button
                  type="button"
                  className={styles.menuAction}
                  disabled={!canUndo}
                  onClick={() => {
                    undo();
                    setMenuOpen(false);
                  }}
                  aria-label="Undo"
                >
                  <span className={styles.menuActionWithIcon}>
                    <svg className={styles.menuActionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M3 10h10a5 5 0 0 1 5 5v2" />
                      <path d="M3 10l3-3M3 10l3 3" />
                    </svg>
                    Undo
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.menuAction}
                  disabled={!canRedo}
                  onClick={() => {
                    redo();
                    setMenuOpen(false);
                  }}
                  aria-label="Redo"
                >
                  <span className={styles.menuActionWithIcon}>
                    <svg className={styles.menuActionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M21 10H11a5 5 0 0 0-5 5v2" />
                      <path d="M21 10l-3-3m3 3l-3 3" />
                    </svg>
                    Redo
                  </span>
                </button>
              </div>
            </div>
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
                  data-testid="theme-light"
                  onClick={() => setTheme("light")}
                >
                  Light
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={preferences.theme === "dark"}
                  className={styles.themeTab}
                  data-testid="theme-dark"
                  onClick={() => setTheme("dark")}
                >
                  Dark
                </button>
              </div>
            </div>
            <div className={styles.menuSection}>
              <span className={styles.menuLabel}>Blobby backer</span>
              <div className={styles.backerSliderWrap}>
                <input
                  type="range"
                  min={100}
                  max={500}
                  value={preferences.blobbyBackerSizePx}
                  onChange={(e) => {
                    const v = Math.min(500, Math.max(100, Number(e.target.value)));
                    setPreferences((p) => ({ ...p, blobbyBackerSizePx: v }));
                  }}
                  className={styles.backerSlider}
                  aria-label="Blobby backer size"
                />
                <span className={styles.backerSliderValue} aria-hidden>{preferences.blobbyBackerSizePx}</span>
              </div>
            </div>
            <div className={styles.menuSection}>
              <span className={styles.menuLabel}>Blobby</span>
              <div className={styles.themeTabs} role="tablist" aria-label="Blobby commenting">
                <div
                  className={styles.themeTabSelector}
                  style={{
                    transform:
                      preferences.blobbyCommenting === "commenting"
                        ? "translateX(100%)"
                        : "translateX(0)",
                  }}
                  aria-hidden
                />
                <button
                  type="button"
                  role="tab"
                  aria-selected={preferences.blobbyCommenting === "silent"}
                  className={styles.themeTab}
                  onClick={() => setPreferences((p) => ({ ...p, blobbyCommenting: "silent" }))}
                >
                  Silent
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={preferences.blobbyCommenting === "commenting"}
                  className={styles.themeTab}
                  onClick={() => setPreferences((p) => ({ ...p, blobbyCommenting: "commenting" }))}
                >
                  Comments
                </button>
              </div>
            </div>
            <div className={styles.menuSection}>
              <span className={styles.menuLabel}>Blob text</span>
              <div className={styles.themeTabs} role="tablist" aria-label="Blob text view">
                <div
                  className={styles.themeTabSelector}
                  style={{
                    transform:
                      preferences.blobMarkdownView === "preview"
                        ? "translateX(100%)"
                        : "translateX(0)",
                  }}
                  aria-hidden
                />
                <button
                  type="button"
                  role="tab"
                  aria-selected={preferences.blobMarkdownView === "raw"}
                  className={styles.themeTab}
                  data-testid="blob-view-raw"
                  onClick={() => setPreferences((p) => ({ ...p, blobMarkdownView: "raw" }))}
                >
                  Raw
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={preferences.blobMarkdownView === "preview"}
                  className={styles.themeTab}
                  data-testid="blob-view-preview"
                  onClick={() => setPreferences((p) => ({ ...p, blobMarkdownView: "preview" }))}
                >
                  Preview
                </button>
              </div>
            </div>
            <div className={styles.menuSection}>
              <button
                type="button"
                className={styles.menuAction}
                data-testid="unhide-all"
                disabled={!hasHiddenBlobs}
                onClick={() => {
                  onUnhideAll?.();
                  setMenuOpen(false);
                }}
              >
                Unhide all
              </button>
            </div>
            <div className={styles.menuSection}>
              <button
                type="button"
                className={styles.menuAction}
                data-testid="unlock-all"
                disabled={!hasLockedBlobs}
                onClick={() => {
                  onUnlockAll?.();
                  setMenuOpen(false);
                }}
              >
                Unlock all
              </button>
            </div>
            <div className={styles.menuSection}>
              <button
                type="button"
                className={styles.menuAction}
                data-testid="show-all"
                disabled={!canShowAll}
                onClick={() => {
                  setMenuOpen(false);
                  window.dispatchEvent(new CustomEvent("blob:show-all"));
                }}
              >
                Show all
              </button>
            </div>
            <div className={styles.menuSection}>
              <span className={styles.menuLabel}>Version</span>
              <span className={styles.menuValue}>{APP_VERSION}</span>
            </div>
            <div className={styles.menuSection}>
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
                  aria-label="Number and date; tap or hover for updates"
                >
                  {buildLabel}
                </button>
                {buildTooltipOpen && (buildNumberDisplay > 0 || buildUpdatesList.length > 0) && (
                  <div
                    className={styles.buildTooltip}
                    role="tooltip"
                    id="build-updates-tooltip"
                  >
                    {buildNumberDisplay > 0 && (
                      <p className={styles.buildTooltipHeading}>#{buildNumberDisplay}</p>
                    )}
                    {buildUpdatesList.length > 0 && (
                      <ul className={styles.buildTooltipList}>
                        {buildUpdatesList.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    )}
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
          data-testid="account-button"
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
                <button type="button" className={styles.accountItem} data-testid="account-login" onClick={signIn}>
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
