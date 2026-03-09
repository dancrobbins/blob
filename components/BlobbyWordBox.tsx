"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import styles from "./BlobbyWordBox.module.css";

/** Blobby is bottom: 24, centered, back circle ~110px. Box sits upper-right of it. */
const BLOBBY_BOTTOM_PX = 24;
const BLOBBY_SIZE_PX = 110;
const BOX_OFFSET_ABOVE_PX = 8;
const BOX_OFFSET_RIGHT_OF_CENTER_PX = 8;
const BOX_BOTTOM_PX = BLOBBY_BOTTOM_PX + BLOBBY_SIZE_PX + BOX_OFFSET_ABOVE_PX;
/** Hit area for the "..." button so finger/mouse can move toward it without leaving hover */
const ELLIPSIS_HIT_SIZE_PX = 44;
const ELLIPSIS_GAP_PX = 8;
const REVEAL_DURATION_MS = 5000;
const HOLD_DURATION_MS = 2000;
const FADE_OUT_DURATION_MS = 1000;
const MIN_INTERVAL_MS = 30_000;
const MAX_INTERVAL_MS = 60_000;

const WORDS = [
  "hello", "blob", "note", "think", "dream", "soft", "calm", "gentle",
  "rest", "flow", "easy", "warm", "kind", "slow", "here", "now",
  "peace", "smile", "glow", "float", "quiet", "cozy", "safe", "nice",
  "yes", "okay", "sure", "maybe", "well", "aha", "oops", "wow",
];

function pickThreeWords(): string {
  const shuffled = [...WORDS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3).join(" ");
}

type BlobbyWordBoxProps = {
  summaryFromTap?: string | null;
  summaryLoading?: boolean;
  onMouseOverChange?: (over: boolean) => void;
  /** When the pointer leaves the chat output after the user did an action (e.g. Copy), call this to hide the output. */
  onLeaveAfterAction?: () => void;
  /** When true, show the "..." button even without hovering (e.g. when output was recalled by long-hover on Blobby). */
  showOptionsWithoutHover?: boolean;
};

export function BlobbyWordBox({
  summaryFromTap = null,
  summaryLoading = false,
  onMouseOverChange,
  onLeaveAfterAction,
  showOptionsWithoutHover = false,
}: BlobbyWordBoxProps) {
  const [visible, setVisible] = useState(false);
  const [displayedText, setDisplayedText] = useState("");
  const [phase, setPhase] = useState<"idle" | "revealing" | "hold" | "fadeout">("idle");
  const [fullText, setFullText] = useState("");
  const [isHovered, setIsHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const nextShowAt = useRef<number>(0);
  const revealStart = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const actionDoneRef = useRef(false);

  const scheduleNext = useCallback(() => {
    const delay = MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
    nextShowAt.current = Date.now() + delay;
  }, []);

  const inSummaryMode = summaryFromTap != null || summaryLoading;

  const handleMouseEnter = useCallback(() => {
    actionDoneRef.current = false;
    setIsHovered(true);
    onMouseOverChange?.(true);
  }, [onMouseOverChange]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setMenuOpen(false);
    onMouseOverChange?.(false);
    if (actionDoneRef.current) {
      onLeaveAfterAction?.();
      actionDoneRef.current = false;
    }
  }, [onMouseOverChange, onLeaveAfterAction]);

  // Timer: every 30–60s show the box (suppressed while showing LLM summary or loading)
  useEffect(() => {
    scheduleNext();
    const tick = () => {
      if (phase !== "idle" || inSummaryMode) return;
      if (Date.now() >= nextShowAt.current) {
        const three = pickThreeWords();
        setFullText(three);
        setDisplayedText("");
        setPhase("revealing");
        setVisible(true);
        revealStart.current = Date.now();
        scheduleNext();
      }
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase, scheduleNext, inSummaryMode]);

  // Reveal: character by character over 5s
  useEffect(() => {
    if (phase !== "revealing" || fullText.length === 0) return;
    const totalChars = fullText.length;
    const intervalMs = REVEAL_DURATION_MS / totalChars;
    intervalRef.current = setInterval(() => {
      setDisplayedText((prev) =>
        prev.length >= fullText.length ? prev : fullText.slice(0, prev.length + 1)
      );
    }, intervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [phase, fullText]);

  // When reveal is complete, switch to hold
  useEffect(() => {
    if (phase !== "revealing" || fullText.length === 0) return;
    if (displayedText.length < fullText.length) return;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPhase("hold");
  }, [phase, fullText, displayedText]);

  // Hold 2s then fade — pause while hovered so output stays visible
  useEffect(() => {
    if (phase !== "hold") return;
    if (isHovered) return;
    const t = setTimeout(() => setPhase("fadeout"), HOLD_DURATION_MS);
    return () => clearTimeout(t);
  }, [phase, isHovered]);

  // If user hovers during fadeout, snap back to hold
  useEffect(() => {
    if (phase === "fadeout" && isHovered) {
      setPhase("hold");
    }
  }, [phase, isHovered]);

  // Fade out 1s then hide
  useEffect(() => {
    if (phase !== "fadeout") return;
    const t = setTimeout(() => {
      setVisible(false);
      setPhase("idle");
    }, FADE_OUT_DURATION_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // Close menu when clicking outside the ellipsis wrapper
  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [menuOpen]);

  const handleCopy = useCallback(() => {
    actionDoneRef.current = true;
    const text = summaryFromTap ?? displayedText;
    const provenance = `-- Blobby the AI said this on ${new Date().toLocaleString()}`;
    navigator.clipboard.writeText(`${text}\n${provenance}`).catch(() => {});
    setMenuOpen(false);
  }, [summaryFromTap, displayedText]);

  const showBox = visible || inSummaryMode;
  const content =
    summaryLoading && !summaryFromTap
      ? "Thinking…"
      : summaryFromTap != null
        ? summaryFromTap
        : displayedText;

  if (!showBox) return null;

  // Show the "..." button when we have summary text; visible on hover or when showOptionsWithoutHover (e.g. recalled by long-hover on Blobby).
  const hasSummary = summaryFromTap != null;
  const showEllipsisButton = hasSummary && (isHovered || showOptionsWithoutHover);

  const boxLeftOffset = ELLIPSIS_HIT_SIZE_PX + ELLIPSIS_GAP_PX;

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: "fixed",
        left: `calc(50% + ${BLOBBY_SIZE_PX / 2}px + ${BOX_OFFSET_RIGHT_OF_CENTER_PX}px - ${hasSummary ? boxLeftOffset : 0}px)`,
        bottom: BOX_BOTTOM_PX,
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-start",
        gap: ELLIPSIS_GAP_PX,
        pointerEvents: "auto",
        zIndex: 3,
        overflow: "visible",
      }}
    >
      {/* "..." button: upper-left outside the chat bubble; hit area stays so finger/mouse can move toward it without leaving hover */}
      {hasSummary && (
        <div
          ref={menuRef}
          style={{
            flexShrink: 0,
            minWidth: ELLIPSIS_HIT_SIZE_PX,
            minHeight: ELLIPSIS_HIT_SIZE_PX,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: 4,
            paddingLeft: 4,
          }}
        >
          <button
            onClick={() => {
              actionDoneRef.current = true;
              setMenuOpen((v) => !v);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              border: "none",
              borderRadius: 6,
              background: menuOpen ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.06)",
              cursor: "pointer",
              padding: 0,
              fontSize: 14,
              color: "#444",
              letterSpacing: "0.05em",
              transition: "background 0.1s ease, opacity 0.15s ease",
              opacity: showEllipsisButton ? 1 : 0,
            }}
            title="Options"
          >
            •••
          </button>

          {menuOpen && (
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 4px)",
                left: 4,
                background: "#fff",
                borderRadius: 6,
                boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
                minWidth: 90,
                overflow: "hidden",
                zIndex: 10,
              }}
            >
              <button
                onClick={handleCopy}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "8px 14px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 14,
                  textAlign: "left",
                  color: "#111",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f0f0")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                Copy
              </button>
            </div>
          )}
        </div>
      )}

      {/* Chat bubble */}
      <div
        className={`${styles.box} ${phase === "fadeout" && !inSummaryMode && !isHovered ? styles.fadeOut : ""}`}
        style={{
          maxWidth: "min(220px, calc(50vw - 80px))",
          borderRadius: 8,
          backgroundImage: "url('/assets/graphics/blobby%20chat%20background.svg')",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          color: "#000",
          boxShadow: isHovered
            ? "0 0 0 2px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.12)"
            : "0 1px 4px rgba(0,0,0,0.1)",
          fontSize: 15,
          lineHeight: 1.4,
          pointerEvents: "auto",
          userSelect: inSummaryMode ? "text" : "none",
          overflow: "visible",
          transition: "box-shadow 0.15s ease",
        }}
        aria-live="polite"
        aria-atomic
      >
        <div
          style={{
            overflowY: "auto",
            maxHeight: "min(260px, 40vh)",
            padding: "8px 12px",
            borderRadius: 8,
          }}
        >
          {content}
        </div>
      </div>
    </div>
  );
}
