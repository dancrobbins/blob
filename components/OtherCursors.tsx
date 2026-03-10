"use client";

import React, { useEffect, useRef } from "react";
import type { OtherPresence, CursorMoveCallback } from "@/contexts/PresenceContext";
import { usePresence } from "@/contexts/PresenceContext";
import styles from "./OtherCursors.module.css";

/** Remote-user pointer graphic: hotspot matches SVG tip position. */
const POINTER_WIDTH = 28;
const POINTER_HEIGHT = 29;
const POINTER_HOTSPOT_X = 14; // tip x within SVG
const POINTER_HOTSPOT_Y = 12; // tip y within SVG
/** Right edge of the drawn cursor shape at its bottom (from path, not bbox). */
const POINTER_DRAWN_RIGHT_AT_BOTTOM = 20;
/** Bottom of the drawn cursor shape in SVG coords (path extends to ~28.86, not 29). */
const POINTER_DRAWN_BOTTOM_Y = 28.85;
const AVATAR_HEIGHT = 24;
/** No gap: avatar should touch the drawn graphic. */
const GAP = 0;

function worldToScreen(
  worldX: number,
  worldY: number,
  panX: number,
  panY: number,
  scale: number
) {
  return {
    x: worldX * scale + panX,
    y: worldY * scale + panY,
  };
}

function getAvatarPos(tipX: number, tipY: number) {
  const pointerLeft = tipX - POINTER_HOTSPOT_X;
  const pointerTop = tipY - POINTER_HOTSPOT_Y;
  return {
    left: pointerLeft + POINTER_DRAWN_RIGHT_AT_BOTTOM + GAP,
    top: pointerTop + POINTER_DRAWN_BOTTOM_Y,
  };
}

function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Renders each remote cursor as a fixed-position element.
 * Cursor *moves* are applied directly to the DOM via refs (no React re-render).
 * React only re-renders when the presence list changes (join/leave).
 */
export function OtherCursors({
  presences,
  pan,
  scale,
}: {
  presences: OtherPresence[];
  pan: { x: number; y: number };
  scale: number;
}) {
  const { setOnCursorMove } = usePresence();

  // Map: sessionId → { pointerEl, avatarWrapEl }
  const domRefsRef = useRef<Map<string, { pointerEl: HTMLElement; avatarWrapEl: HTMLElement }>>(new Map());
  // Keep pan/scale in a ref so the hot-path callback always has current values.
  const panRef = useRef(pan);
  const scaleRef = useRef(scale);
  panRef.current = pan;
  scaleRef.current = scale;

  // Register the hot-path callback once.
  useEffect(() => {
    const cb: CursorMoveCallback = (sessionId, worldX, worldY) => {
      const els = domRefsRef.current.get(sessionId);
      if (!els) return;
      const { x: tipX, y: tipY } = worldToScreen(
        worldX, worldY,
        panRef.current.x, panRef.current.y, scaleRef.current
      );
      els.pointerEl.style.left = `${tipX - POINTER_HOTSPOT_X}px`;
      els.pointerEl.style.top = `${tipY - POINTER_HOTSPOT_Y}px`;
      const { left: avatarLeft, top: avatarTop } = getAvatarPos(tipX, tipY);
      els.avatarWrapEl.style.left = `${avatarLeft}px`;
      els.avatarWrapEl.style.top = `${avatarTop}px`;
    };
    setOnCursorMove(cb);
    return () => setOnCursorMove(null);
  }, [setOnCursorMove]);

  if (presences.length === 0) return null;

  return (
    <div className={styles.layer} aria-hidden>
      {presences.map((p) => {
        const { x: tipX, y: tipY } = worldToScreen(
          p.worldX, p.worldY, pan.x, pan.y, scale
        );
        const { left: avatarLeft, top: avatarTop } = getAvatarPos(tipX, tipY);

        return (
          <div key={p.sessionId} className={styles.cursor}>
            <img
              src="/assets/graphics/Pointer-01.svg"
              alt=""
              className={styles.remotePointerIcon}
              ref={(el) => {
                const existing = domRefsRef.current.get(p.sessionId);
                if (el && existing) existing.pointerEl = el;
                else if (el) domRefsRef.current.set(p.sessionId, { pointerEl: el, avatarWrapEl: null! });
              }}
              style={{
                left: tipX - POINTER_HOTSPOT_X,
                top: tipY - POINTER_HOTSPOT_Y,
                width: POINTER_WIDTH,
                height: POINTER_HEIGHT,
              }}
            />
            <div
              className={styles.avatarWrap}
              ref={(el) => {
                const existing = domRefsRef.current.get(p.sessionId);
                if (el && existing) existing.avatarWrapEl = el;
                else if (el) domRefsRef.current.set(p.sessionId, { pointerEl: null!, avatarWrapEl: el });
              }}
              style={{ left: avatarLeft, top: avatarTop }}
            >
              {p.avatarUrl ? (
                <img
                  src={p.avatarUrl}
                  alt=""
                  className={styles.avatar}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  {getInitials(p.displayName)}
                </div>
              )}
              <span className={styles.label}>{p.displayLabel}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
