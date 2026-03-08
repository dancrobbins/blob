"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";

/** Video filenames in assets/animations (and public/assets/animations). Add new files here. */
const BLOBBY_ANIMATION_FILES = [
  "idle LIGHT 01.mp4",
  "idle LIGHT 02.mp4",
  "idle LIGHT 03.mp4",
  "lean right LIGHT 01.mp4",
  "lean right LIGHT 02.mp4",
];

const SIZE = 100; // blobby video size
const BACK_CIRCLE_SIZE = Math.round(SIZE * 1.1); // 10% bigger, centered under blobby

function pickRandomVideo() {
  return BLOBBY_ANIMATION_FILES[Math.floor(Math.random() * BLOBBY_ANIMATION_FILES.length)];
}

function videoSrc(filename: string) {
  return `/assets/animations/${encodeURIComponent(filename)}`;
}

export function Blobby() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentFile, setCurrentFile] = useState<string>(() => pickRandomVideo());

  const playNextRandom = useCallback(() => {
    const next = pickRandomVideo();
    setCurrentFile(next);
    // Video element will get new src and play via key/effect
  }, []);

  const handleCanPlay = useCallback(() => {
    videoRef.current?.play().catch(() => {});
  }, []);

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
        overflow: "visible",
        zIndex: 2,
      }}
      aria-hidden
    >
      {/* Back circle: 10% bigger than blobby, centered behind */}
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
        key={currentFile}
        ref={videoRef}
        src={videoSrc(currentFile)}
        muted
        playsInline
        autoPlay
        onCanPlay={handleCanPlay}
        onEnded={playNextRandom}
        style={{
          position: "relative",
          zIndex: 1,
          width: SIZE,
          height: SIZE,
          objectFit: "contain",
        }}
      />
    </div>
  );
}
