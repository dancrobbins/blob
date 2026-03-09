"use client";

import React from "react";
import type { OtherPresence } from "@/contexts/PresenceContext";
import styles from "./OtherCursors.module.css";

const POINTER_LENGTH_PX = 24;
const BASE_OFFSET = Math.round((POINTER_LENGTH_PX / Math.SQRT2));
const AVATAR_OFFSET_FROM_BASE = 8;
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
        const baseX = tipX - BASE_OFFSET;
        const baseY = tipY - BASE_OFFSET;
        const avatarCenterX = baseX + AVATAR_OFFSET_FROM_BASE;
        const avatarCenterY = baseY + AVATAR_OFFSET_FROM_BASE;
        const avatarLeft = avatarCenterX - AVATAR_SIZE / 2;
        const avatarTop = avatarCenterY - AVATAR_SIZE / 2;

        return (
          <div key={p.sessionId} className={styles.cursor}>
            <svg
              className={styles.pointerSvg}
              style={{
                left: baseX,
                top: baseY,
                width: POINTER_LENGTH_PX + 4,
                height: POINTER_LENGTH_PX + 4,
              }}
              viewBox="-2 -2 26 26"
              preserveAspectRatio="none"
            >
              <line
                x1={0}
                y1={0}
                x2={BASE_OFFSET}
                y2={BASE_OFFSET}
                className={styles.pointerLine}
              />
              <polygon
                points={`${BASE_OFFSET},${BASE_OFFSET} ${BASE_OFFSET - 2},${BASE_OFFSET - 6} ${BASE_OFFSET - 6},${BASE_OFFSET - 2}`}
                className={styles.pointerHead}
              />
            </svg>
            <div
              className={styles.avatarWrap}
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
