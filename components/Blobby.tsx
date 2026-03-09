"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";

const SIZE = 100; // blobby video size
const BACK_CIRCLE_SIZE = Math.round(SIZE * 1.1); // 10% bigger, centered under blobby

type Mode = "idle" | "jump";

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

type SrcState = {
  activeSrc: string;
  activeMode: Mode;
  nextSrc: string;
  nextMode: Mode;
  remaining: string[];
};

function initialBlobbySrc(files: string[]): SrcState {
  if (files.length === 0) return { activeSrc: "", activeMode: "idle", nextSrc: "", nextMode: "idle", remaining: [] };
  const list = shuffle(files);
  const activeSrc = list.pop()!;
  const nextSrc = list.length > 0 ? list.pop()! : activeSrc;
  return { activeSrc, activeMode: "idle", nextSrc, nextMode: "idle", remaining: list };
}

function videoSrc(mode: Mode, filename: string) {
  return `/assets/animations/${mode}/${encodeURIComponent(filename)}`;
}

function pickNextFromRemaining(remaining: string[], allFiles: string[]): { next: string; remaining: string[] } {
  if (allFiles.length === 0) return { next: "", remaining: [] };
  let list = remaining.length > 0 ? remaining : shuffle(allFiles);
  const idx = Math.floor(Math.random() * list.length);
  const next = list[idx];
  list = list.filter((_, i) => i !== idx);
  return { next, remaining: list };
}

export function Blobby() {
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);

  const [idleFiles, setIdleFiles] = useState<string[]>([]);
  const [jumpFiles, setJumpFiles] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("idle");
  const [src, setSrc] = useState<SrcState | null>(null);
  const [visibleA, setVisibleA] = useState(true);

  // On app load, discover idle and jump animations
  useEffect(() => {
    fetch("/api/animations", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { idle?: string[]; jump?: string[] }) => {
        const idle = Array.isArray(data?.idle) ? data.idle : [];
        const jump = Array.isArray(data?.jump) ? data.jump : [];
        setIdleFiles(idle);
        setJumpFiles(jump.length > 0 ? jump : idle);
        const list = idle.length > 0 ? idle : jump;
        if (list.length > 0) {
          setSrc(initialBlobbySrc(list));
        }
      })
      .catch(() => {});
  }, []);

  const tryPlay = useCallback((el: HTMLVideoElement | null) => {
    el?.play().catch(() => {});
  }, []);

  const handleEnded = useCallback(() => {
    if (!src) return;
    const nextMode: Mode = src.nextMode === "jump" ? "idle" : "idle";
    if (src.nextMode === "jump") setMode("idle");
    setSrc((prev) => {
      if (!prev) return prev;
      const activeSrc = prev.nextSrc;
      const activeMode = prev.nextMode;
      const nextFiles = nextMode === "idle" ? idleFiles : jumpFiles.length > 0 ? jumpFiles : idleFiles;
      const remainingForPick =
        nextMode === prev.nextMode
          ? prev.remaining.filter((f) => f !== prev.nextSrc)
          : [];
      const { next, remaining: nextRemaining } = pickNextFromRemaining(remainingForPick, nextFiles);
      return { activeSrc, activeMode, nextSrc: next, nextMode: nextMode, remaining: nextRemaining };
    });
    if (visibleA) {
      setVisibleA(false);
      tryPlay(videoBRef.current);
    } else {
      setVisibleA(true);
      tryPlay(videoARef.current);
    }
  }, [visibleA, tryPlay, src, idleFiles, jumpFiles]);

  const handleTap = useCallback(() => {
    setMode("jump");
    const list = jumpFiles.length > 0 ? jumpFiles : idleFiles;
    if (list.length > 0) {
      const shuffled = shuffle(list);
      const next = shuffled[0];
      const remaining = list.filter((f) => f !== next);
      setSrc((prev) => (prev ? { ...prev, nextSrc: next, nextMode: "jump", remaining } : prev));
    }
  }, [idleFiles, jumpFiles]);

  // Initial play and user-gesture fallback for autoplay policy
  useEffect(() => {
    if (src && (idleFiles.length > 0 || jumpFiles.length > 0)) tryPlay(visibleA ? videoARef.current : videoBRef.current);
  }, [visibleA, tryPlay, src, idleFiles.length, jumpFiles.length]);

  useEffect(() => {
    if (!src || (idleFiles.length === 0 && jumpFiles.length === 0)) return;
    const onUserGesture = () => {
      tryPlay(visibleA ? videoARef.current : videoBRef.current);
      document.removeEventListener("click", onUserGesture);
      document.removeEventListener("touchstart", onUserGesture);
    };
    document.addEventListener("click", onUserGesture, { once: true, passive: true });
    document.addEventListener("touchstart", onUserGesture, { once: true, passive: true });
    return () => {
      document.removeEventListener("click", onUserGesture);
      document.removeEventListener("touchstart", onUserGesture);
    };
  }, [visibleA, tryPlay, src, idleFiles.length, jumpFiles.length]);

  // Page overlay (summarize button) sits above Blobby and dispatches this so we still get tap → jump
  useEffect(() => {
    const onTap = () => handleTap();
    window.addEventListener("blobby:tap", onTap);
    return () => window.removeEventListener("blobby:tap", onTap);
  }, [handleTap]);

  const videoStyle = {
    position: "absolute" as const,
    width: SIZE,
    height: SIZE,
    objectFit: "contain" as const,
  };

  const hasFiles = (idleFiles.length > 0 || jumpFiles.length > 0) && src !== null;

  if (!hasFiles) {
    return (
      <div
        className="blobby-container"
        style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          width: BACK_CIRCLE_SIZE,
          height: BACK_CIRCLE_SIZE,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 0,
        }}
        aria-hidden
      >
        <div
          style={{
            position: "absolute",
            width: BACK_CIRCLE_SIZE,
            height: BACK_CIRCLE_SIZE,
            borderRadius: "50%",
            backgroundColor: "var(--blobby-back-circle-bg, rgba(0, 0, 0, 0.06))",
          }}
        />
      </div>
    );
  }

  const { activeSrc, activeMode, nextSrc, nextMode } = src!;

  return (
    <div
      className="blobby-container"
      data-blobby-area
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        width: BACK_CIRCLE_SIZE,
        height: BACK_CIRCLE_SIZE,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        overflow: "visible",
        zIndex: 3,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: BACK_CIRCLE_SIZE,
          height: BACK_CIRCLE_SIZE,
          borderRadius: "50%",
          backgroundColor: "var(--blobby-back-circle-bg, rgba(0, 0, 0, 0.06))",
          zIndex: 0,
        }}
      />
      <video
        ref={videoARef}
        src={videoSrc(visibleA ? activeMode : nextMode, visibleA ? activeSrc : nextSrc)}
        muted
        playsInline
        autoPlay
        onCanPlay={() => tryPlay(videoARef.current)}
        onLoadedData={() => tryPlay(videoARef.current)}
        onEnded={handleEnded}
        style={{
          ...videoStyle,
          zIndex: visibleA ? 1 : 0,
          opacity: visibleA ? 1 : 0,
          pointerEvents: "none",
        }}
      />
      <video
        ref={videoBRef}
        src={videoSrc(visibleA ? nextMode : activeMode, visibleA ? nextSrc : activeSrc)}
        muted
        playsInline
        autoPlay
        onCanPlay={() => tryPlay(videoBRef.current)}
        onLoadedData={() => tryPlay(videoBRef.current)}
        onEnded={handleEnded}
        style={{
          ...videoStyle,
          zIndex: visibleA ? 0 : 1,
          opacity: visibleA ? 0 : 1,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
