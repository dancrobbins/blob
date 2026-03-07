"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useBlobsContext } from "@/contexts/BlobsContext";
import { BLOBBY_GRID_ROWS, BLOBBY_GRID_COLS } from "@/lib/types";

const IDLE_CHANGE_MS = 12000;

export function Blobby() {
  const { preferences } = useBlobsContext();
  const color = preferences.blobbyColor;
  const [expressionIndex, setExpressionIndex] = useState(0);
  const totalCells = BLOBBY_GRID_ROWS * BLOBBY_GRID_COLS; // 9

  const pickRandomExpression = useCallback(() => {
    setExpressionIndex((i) => (i + Math.floor(Math.random() * (totalCells - 1)) + 1) % totalCells);
  }, [totalCells]);

  // Idle: change expression periodically
  useEffect(() => {
    const t = setInterval(pickRandomExpression, IDLE_CHANGE_MS);
    return () => clearInterval(t);
  }, [pickRandomExpression]);

  // Expose a function so parent can trigger on user action (we'll use a custom event)
  useEffect(() => {
    const onAction = () => {
      pickRandomExpression();
    };
    window.addEventListener("blob:user-action", onAction);
    return () => window.removeEventListener("blob:user-action", onAction);
  }, [pickRandomExpression]);

  const row = Math.floor(expressionIndex / BLOBBY_GRID_COLS);
  const col = expressionIndex % BLOBBY_GRID_COLS;

  const imageUrl = `/assets/character%20expressions/${color}.png`;
  const size = 100; // display size of one cell in the sprite

  return (
    <div
      className="blobby-container"
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        width: size,
        height: size,
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: `${BLOBBY_GRID_COLS * 100}% ${BLOBBY_GRID_ROWS * 100}%`,
        backgroundPosition: `${col * 50}% ${row * 50}%`,
        imageRendering: "crisp-edges",
        pointerEvents: "none",
      }}
      aria-hidden
    />
  );
}
