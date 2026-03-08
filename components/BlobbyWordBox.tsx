"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import styles from "./BlobbyWordBox.module.css";

/** Blobby is bottom: 24, centered, back circle ~110px. Box sits upper-right of it. */
const BLOBBY_BOTTOM_PX = 24;
const BLOBBY_SIZE_PX = 110;
const BOX_OFFSET_ABOVE_PX = 8;
const BOX_OFFSET_RIGHT_OF_CENTER_PX = 8;
const BOX_BOTTOM_PX = BLOBBY_BOTTOM_PX + BLOBBY_SIZE_PX + BOX_OFFSET_ABOVE_PX;
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
};

export function BlobbyWordBox({ summaryFromTap = null, summaryLoading = false }: BlobbyWordBoxProps) {
  const [visible, setVisible] = useState(false);
  const [displayedText, setDisplayedText] = useState("");
  const [phase, setPhase] = useState<"idle" | "revealing" | "hold" | "fadeout">("idle");
  const [fullText, setFullText] = useState("");
  const nextShowAt = useRef<number>(0);
  const revealStart = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scheduleNext = useCallback(() => {
    const delay = MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
    nextShowAt.current = Date.now() + delay;
  }, []);

  const inSummaryMode = summaryFromTap != null || summaryLoading;

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

  // Hold 2s then fade
  useEffect(() => {
    if (phase !== "hold") return;
    const t = setTimeout(() => setPhase("fadeout"), HOLD_DURATION_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // Fade out 1s then hide
  useEffect(() => {
    if (phase !== "fadeout") return;
    const t = setTimeout(() => {
      setVisible(false);
      setPhase("idle");
    }, FADE_OUT_DURATION_MS);
    return () => clearTimeout(t);
  }, [phase]);

  const showBox = visible || inSummaryMode;
  const content =
    summaryLoading && !summaryFromTap
      ? "Thinking…"
      : summaryFromTap != null
        ? summaryFromTap
        : displayedText;

  if (!showBox) return null;

  return (
    <div
      className={`${styles.box} ${phase === "fadeout" && !inSummaryMode ? styles.fadeOut : ""}`}
      style={{
        position: "fixed",
        left: `calc(50% + ${BLOBBY_SIZE_PX / 2}px + ${BOX_OFFSET_RIGHT_OF_CENTER_PX}px)`,
        bottom: BOX_BOTTOM_PX,
        maxWidth: "min(220px, calc(50vw - 80px))",
        padding: "8px 12px",
        borderRadius: 8,
        backgroundImage: "url('/assets/graphics/blobby%20chat%20background.svg')",
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        color: "#000",
        boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
        fontSize: 15,
        lineHeight: 1.4,
        pointerEvents: "none",
        userSelect: "none",
        zIndex: 3,
      }}
      aria-live="polite"
      aria-atomic
    >
      {content}
    </div>
  );
}
