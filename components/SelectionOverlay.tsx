"use client";

import React, { useState, useRef, useEffect } from "react";
import styles from "./SelectionOverlay.module.css";

type Bounds = { left: number; top: number; width: number; height: number };

export function SelectionOverlay({
  bounds,
  onDelete,
  onLock,
  onDuplicate,
  onHide,
  menuRef,
}: {
  bounds: Bounds;
  onDelete: () => void;
  onLock: () => void;
  onDuplicate: () => void;
  onHide: () => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const closeMenus = () => setMenuOpen(false);
    window.addEventListener("blob:close-menus", closeMenus);
    return () => window.removeEventListener("blob:close-menus", closeMenus);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen, menuRef]);

  return (
    <div
      className={`${styles.overlay} ${styles.overlayInteractive}`}
      style={{
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      }}
    >
      <div className={styles.antsWrap}>
        <svg className={styles.antsSvg} viewBox="0 0 100 100" preserveAspectRatio="none">
          <rect
            className={styles.antsLine}
            x="1"
            y="1"
            width="98"
            height="98"
            rx="0"
            ry="0"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className={styles.menuWrap} ref={menuRef}>
        <button
          type="button"
          className={styles.menuButton}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
          aria-label="Selection options"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          …
        </button>
        {menuOpen && (
          <div className={styles.selectionMenu} role="menu">
            <button
              type="button"
              className={styles.selectionMenuItem}
              role="menuitem"
              onClick={() => {
                onDelete();
                setMenuOpen(false);
              }}
            >
              Delete
            </button>
            <button
              type="button"
              className={styles.selectionMenuItem}
              role="menuitem"
              onClick={() => {
                onLock();
                setMenuOpen(false);
              }}
            >
              Lock
            </button>
            <button
              type="button"
              className={styles.selectionMenuItem}
              role="menuitem"
              onClick={() => {
                onDuplicate();
                setMenuOpen(false);
              }}
            >
              Duplicate
            </button>
            <button
              type="button"
              className={styles.selectionMenuItem}
              role="menuitem"
              onClick={() => {
                onHide();
                setMenuOpen(false);
              }}
            >
              Hide
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function SelectionRect({
  left,
  top,
  width,
  height,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
}) {
  return (
    <div
      className={styles.overlay}
      style={{ left, top, width, height }}
      aria-hidden
    >
      <div className={styles.antsWrap}>
        <svg className={styles.antsSvg} viewBox="0 0 100 100" preserveAspectRatio="none">
          <rect
            className={styles.antsLine}
            x="1"
            y="1"
            width="98"
            height="98"
            rx="0"
            ry="0"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </div>
  );
}
