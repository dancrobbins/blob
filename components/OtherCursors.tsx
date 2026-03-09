"use client";

import React from "react";
import type { OtherPresence } from "@/contexts/PresenceContext";
import styles from "./OtherCursors.module.css";

/** Cursor icon size (tip at 0,0; base at CURSOR_SIZE,CURSOR_SIZE). */
const CURSOR_SIZE = 16;
const GAP_POINTER_TO_AVATAR = 4;
const AVATAR_SIZE = 24;

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

function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function OtherCursors({
  presences,
  pan,
  scale,
}: {
  presences: OtherPresence[];
  pan: { x: number; y: number };
  scale: number;
}) {
  if (presences.length === 0) return null;

  return (
    <div className={styles.layer} aria-hidden>
      {presences.map((p) => {
        const { x: tipX, y: tipY } = worldToScreen(
          p.worldX,
          p.worldY,
          pan.x,
          pan.y,
          scale
        );
        const avatarWrapLeft = tipX + CURSOR_SIZE + GAP_POINTER_TO_AVATAR;
        const avatarWrapTop = tipY + CURSOR_SIZE + GAP_POINTER_TO_AVATAR;

        return (
          <div key={p.sessionId} className={styles.cursor}>
            <svg
              className={styles.pointerSvg}
              style={{ left: tipX, top: tipY }}
              viewBox={`0 0 ${CURSOR_SIZE} ${CURSOR_SIZE}`}
              width={CURSOR_SIZE}
              height={CURSOR_SIZE}
              preserveAspectRatio="none"
            >
              <path
                d="M 0 0 L 14 2 L 14 14 L 2 14 Z"
                className={styles.pointerIcon}
              />
            </svg>
            <div
              className={styles.avatarWrap}
              style={{ left: avatarWrapLeft, top: avatarWrapTop }}
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
