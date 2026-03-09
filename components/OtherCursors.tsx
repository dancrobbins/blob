"use client";

import React from "react";
import type { OtherPresence } from "@/contexts/PresenceContext";
import styles from "./OtherCursors.module.css";

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
        const { x: left, y: top } = worldToScreen(
          p.worldX,
          p.worldY,
          pan.x,
          pan.y,
          scale
        );
        return (
          <div
            key={p.sessionId}
            className={styles.cursor}
            style={{ left, top }}
          >
            <div className={styles.pointer} />
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
        );
      })}
    </div>
  );
}
