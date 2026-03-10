"use client";

import React from "react";
import {
  getMergeCueRect,
  getSeparateMergeCuesPath,
  getFusedBoundaryPath,
  gapBetweenRects,
} from "@/lib/blob-boundary-path";
import type { BlobBounds } from "@/lib/blob-constants";

const INSERTION_BAR_HEIGHT = 4;

export type ViewportWorld = { top: number; left: number; width: number; height: number };

export function BlobBoundaryOverlay({
  rectA,
  rectB,
  mergeMarginPx,
  isVeryClose,
  insertAtTop,
  viewport,
}: {
  rectA: BlobBounds;
  rectB: BlobBounds;
  /** Merge region margin in world px (padding around each blob for cue outline). */
  mergeMarginPx: number;
  isVeryClose: boolean;
  /** When set, show a horizontal insertion bar: true = top of target, false = bottom (width = rectB). */
  insertAtTop?: boolean;
  /** Visible canvas area in world coords; used to clamp insertion bar on screen. */
  viewport?: ViewportWorld;
}) {
  const cueA = getMergeCueRect(rectA, mergeMarginPx);
  const cueB = getMergeCueRect(rectB, mergeMarginPx);
  const cueGap = gapBetweenRects(cueA, cueB);
  // Fused outline and top/bottom insertion bar only when merge bounds touch or overlap.
  const mergePossible = cueGap <= 0;
  const fused = mergePossible;

  const margin = 4;
  let left: number;
  let top: number;
  let w: number;
  let h: number;
  let path: string;

  if (fused) {
    left = Math.min(cueA.left, cueB.left) - margin;
    top = Math.min(cueA.top, cueB.top) - margin;
    w = Math.max(cueA.left + cueA.width, cueB.left + cueB.width) - left + margin;
    h = Math.max(cueA.top + cueA.height, cueB.top + cueB.height) - top + margin;
    path = getFusedBoundaryPath(cueA, cueB);
    const pathOriginX = Math.min(cueA.left, cueB.left) - left;
    const pathOriginY = Math.min(cueA.top, cueB.top) - top;
    path = path.replace(
      /([\d.-]+)\s+([\d.-]+)/g,
      (_, a, b) => `${Number(a) + pathOriginX} ${Number(b) + pathOriginY}`
    );
  } else {
    left = Math.min(cueA.left, cueB.left) - margin;
    top = Math.min(cueA.top, cueB.top) - margin;
    const right = Math.max(cueA.left + cueA.width, cueB.left + cueB.width) + margin;
    const bottom = Math.max(cueA.top + cueA.height, cueB.top + cueB.height) + margin;
    w = right - left;
    h = bottom - top;
    path = getSeparateMergeCuesPath(cueA, cueB, left, top);
  }

  const v = viewport;
  const viewportTop = v?.top ?? -Infinity;
  const viewportBottom = v ? v.top + v.height : Infinity;
  const viewportLeft = v?.left ?? -Infinity;
  const viewportRight = v ? v.left + v.width : Infinity;

  let insertionBarY: number | null = null;
  let insertionBarLeft = rectB.left;
  let insertionBarWidth = rectB.width;
  if (mergePossible && insertAtTop === true) {
    insertionBarY = v != null ? Math.max(rectB.top, viewportTop) : rectB.top;
    insertionBarLeft = v != null ? Math.max(rectB.left, viewportLeft) : rectB.left;
    insertionBarWidth = v != null ? Math.min(rectB.left + rectB.width, viewportRight) - insertionBarLeft : rectB.width;
  } else if (mergePossible && insertAtTop === false) {
    const naturalY = rectB.top + rectB.height - INSERTION_BAR_HEIGHT;
    insertionBarY = v != null ? Math.min(naturalY, viewportBottom - INSERTION_BAR_HEIGHT) : naturalY;
    insertionBarLeft = v != null ? Math.max(rectB.left, viewportLeft) : rectB.left;
    insertionBarWidth = v != null ? Math.min(rectB.left + rectB.width, viewportRight) - insertionBarLeft : rectB.width;
  }
  insertionBarWidth = Math.max(0, insertionBarWidth);

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 150,
      }}
    >
      <svg
        style={{
          position: "absolute",
          left,
          top,
          width: w,
          height: h,
          overflow: "visible",
        }}
        viewBox={`0 0 ${w} ${h}`}
      >
        <path
          d={path}
          fill="none"
          stroke="var(--blob-merge-boundary-stroke, rgba(0, 120, 212, 0.4))"
          strokeWidth={isVeryClose ? 2.5 : 2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      {insertionBarY !== null && (
        <div
          style={{
            position: "absolute",
            left: insertionBarLeft,
            top: insertionBarY,
            width: insertionBarWidth,
            height: INSERTION_BAR_HEIGHT,
            borderRadius: 1,
            background: "var(--blob-merge-insertion-bar, rgba(0, 120, 212, 0.5))",
            zIndex: 1,
          }}
        />
      )}
    </div>
  );
}
