"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  BLOB_CLOSE_MENUS_EVENT,
  dispatchCloseMenus,
  type BlobCloseMenusDetail,
} from "@/lib/menu-close-event";
import { SHOW_ALL_CONTROLS_LEFT_PX } from "@/lib/blob-constants";
import styles from "./SelectionOverlay.module.css";

type Bounds = { left: number; top: number; width: number; height: number };

export function SelectionOverlay({
  bounds,
  onDelete,
  onLock,
  onUnlock,
  onDuplicate,
  onHide,
  onCopyAll,
  allSelectedLocked,
  menuRef,
  onDragStart,
  onMoveSelected,
  onDragEnd,
  scale = 1,
  worldCoordinates = false,
}: {
  bounds: Bounds;
  onDelete: () => void;
  onLock: () => void;
  onUnlock: () => void;
  onDuplicate: () => void;
  onHide: () => void;
  onCopyAll?: () => void;
  /** When true, show Unlock; otherwise show Lock. */
  allSelectedLocked: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  /** Multi-drag: called when user starts dragging from the selection overlay handle. */
  onDragStart?: () => void;
  onMoveSelected?: (dx: number, dy: number) => void;
  onDragEnd?: () => void;
  /** Canvas scale so pointer delta is converted to world space (dx/scale, dy/scale). */
  scale?: number;
  /** When true, bounds are in world coordinates and overlay uses position:absolute so it moves with pan/scale. */
  worldCoordinates?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number } | null>(null);

  useEffect(() => {
    const closeMenus = (e: Event) => {
      const d = (e as CustomEvent<BlobCloseMenusDetail>).detail;
      if (d?.exceptSelection) return;
      setMenuOpen(false);
    };
    window.addEventListener(BLOB_CLOSE_MENUS_EVENT, closeMenus);
    return () => window.removeEventListener(BLOB_CLOSE_MENUS_EVENT, closeMenus);
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

  const handleHandlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!onDragStart || !onMoveSelected || !onDragEnd) return;
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragStartRef.current = { clientX: e.clientX, clientY: e.clientY };
      onDragStart();
    },
    [onDragStart, onMoveSelected, onDragEnd]
  );

  const handleHandlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const start = dragStartRef.current;
      if (!start || !onMoveSelected || scale <= 0) return;
      const screenDx = e.clientX - start.clientX;
      const screenDy = e.clientY - start.clientY;
      onMoveSelected(screenDx / scale, screenDy / scale);
    },
    [onMoveSelected, scale]
  );

  const handleHandlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (dragStartRef.current && onDragEnd) onDragEnd();
      dragStartRef.current = null;
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    },
    [onDragEnd]
  );

  return (
    <div
      className={`${styles.overlay} ${styles.overlayInteractive} ${worldCoordinates ? styles.overlayWorld : ""}`}
      style={{
        left: bounds.left - SHOW_ALL_CONTROLS_LEFT_PX,
        top: bounds.top,
        width: bounds.width + SHOW_ALL_CONTROLS_LEFT_PX,
        height: bounds.height,
      }}
    >
      <div className={styles.antsWrap} style={{ left: SHOW_ALL_CONTROLS_LEFT_PX, top: 0, right: 0, bottom: 0 }}>
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
      <div
        className={styles.controlsColumn}
        style={{ left: 0, top: 0 }}
      >
        <div className={styles.controlWrap}>
          <div
            className={styles.dragHandle}
            role="button"
            tabIndex={-1}
            aria-label="Drag selection"
            data-testid="selection-drag-handle"
            onPointerDown={handleHandlePointerDown}
            onPointerMove={handleHandlePointerMove}
            onPointerUp={handleHandlePointerUp}
            onPointerCancel={handleHandlePointerUp}
          >
            ⋮⋮
          </div>
        </div>
        <div className={styles.menuWrap} ref={menuRef}>
          <button
            type="button"
            className={styles.menuButton}
            data-testid="selection-options"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen((o) => {
                if (o) return false;
                dispatchCloseMenus({ exceptSelection: true });
                return true;
              });
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
              data-testid="selection-menu-duplicate"
              onClick={() => {
                onDuplicate();
                setMenuOpen(false);
              }}
            >
              Duplicate
            </button>
            {onCopyAll != null && (
              <button
                type="button"
                className={styles.selectionMenuItem}
                role="menuitem"
                data-testid="selection-menu-copy-all"
                onClick={() => {
                  onCopyAll();
                  setMenuOpen(false);
                }}
              >
                Copy all
              </button>
            )}
            {allSelectedLocked ? (
              <button
                type="button"
                className={styles.selectionMenuItem}
                role="menuitem"
                data-testid="selection-menu-unlock"
                onClick={() => {
                  onUnlock();
                  setMenuOpen(false);
                }}
              >
                Unlock
              </button>
            ) : (
              <button
                type="button"
                className={styles.selectionMenuItem}
                role="menuitem"
                data-testid="selection-menu-lock"
                onClick={() => {
                  onLock();
                  setMenuOpen(false);
                }}
              >
                Lock
              </button>
            )}
            <button
              type="button"
              className={styles.selectionMenuItem}
              role="menuitem"
              data-testid="selection-menu-hide"
              onClick={() => {
                onHide();
                setMenuOpen(false);
              }}
            >
              Hide
            </button>
            <button
              type="button"
              className={`${styles.selectionMenuItem} ${styles.selectionMenuItemDanger}`}
              role="menuitem"
              data-testid="selection-menu-delete"
              onClick={() => {
                onDelete();
                setMenuOpen(false);
              }}
            >
              Delete
            </button>
          </div>
        )}
        </div>
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
