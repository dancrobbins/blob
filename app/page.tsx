"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Blobby } from "@/components/Blobby";
import { BlobCard } from "@/components/BlobCard";
import {
  SelectionOverlay,
  SelectionRect,
} from "@/components/SelectionOverlay";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useBlobsContext } from "@/contexts/BlobsContext";
import styles from "./page.module.css";

const DRAG_THRESHOLD = 5;
const SELECTION_PADDING = 4;
/** If the user moves past threshold within this ms of pointer down → pan. If after → rectangle select. */
const HOLD_DELAY_MS = 220;
const MIN_SCALE = 0.25;
const MAX_SCALE = 3;
const WHEEL_ZOOM_SENSITIVITY = 0.002;
const HEADER_HEIGHT = 52;
/** Approximate card size in world coords for "Show all" bounds. */
const CARD_WIDTH = 250;
const CARD_HEIGHT = 80;
const SHOW_ALL_PADDING = 48;

type Bounds = { left: number; top: number; width: number; height: number };

function normalizeRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): Bounds {
  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const right = Math.max(x1, x2);
  const bottom = Math.max(y1, y2);
  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function isFullyEnclosed(
  blobRect: DOMRect,
  selectionRect: Bounds
): boolean {
  const selRight = selectionRect.left + selectionRect.width;
  const selBottom = selectionRect.top + selectionRect.height;
  return (
    blobRect.left >= selectionRect.left &&
    blobRect.top >= selectionRect.top &&
    blobRect.right <= selRight &&
    blobRect.bottom <= selBottom
  );
}

function screenToWorld(
  screenX: number,
  screenY: number,
  panX: number,
  panY: number,
  s: number
) {
  return {
    x: (screenX - panX) / s,
    y: (screenY - HEADER_HEIGHT - panY) / s,
  };
}

export default function Home() {
  const { blobs, dispatch, anyMenuOpenRef, undo, redo, canUndo, canRedo } = useBlobsContext();
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasInnerRef = useRef<HTMLDivElement>(null);
  const pointerDownOnCanvas = useRef(false);
  const menuWasOpenAtPointerDown = useRef(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const pointerDownTimeRef = useRef<number>(0);
  /** When we cross the threshold, freeze the anchor at rounded pixel so the initial corner doesn't jitter. */
  const anchorRef = useRef<{ x: number; y: number } | null>(null);
  const isDrawingSelection = useRef(false);
  const selectionRectRef = useRef<Bounds | null>(null);
  const prevBlobCountRef = useRef(blobs.length);
  const selectionMenuRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  /** Selection count at pointer down; used to clear selection on tap without adding a blob. */
  const selectedIdsCountRef = useRef(0);
  const selectedIdsRef = useRef<string[]>([]);
  const hadSelectionAtPointerDownRef = useRef(false);
  /** True if at pointer down the active element was inside a blob (user was editing); tap-up then cancels insertion only, no new blob. */
  const hadActiveInsertionAtPointerDownRef = useRef(false);
  /** True once we've committed to either pan or selection for this gesture. */
  const gestureChosenRef = useRef(false);
  const activePointersRef = useRef<Map<number, { clientX: number; clientY: number }>>(new Map());
  const lastPinchRef = useRef<{ distance: number; centerX: number; centerY: number } | null>(null);
  const panRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const primaryPointerIdRef = useRef<number | null>(null);

  const [focusBlobId, setFocusBlobId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionRect, setSelectionRect] = useState<Bounds | null>(null);
  const [selectionBounds, setSelectionBounds] = useState<Bounds | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);

  const visibleBlobs = blobs.filter((b) => !b.hidden);

  useEffect(() => {
    if (blobs.length > prevBlobCountRef.current) {
      setFocusBlobId(blobs[blobs.length - 1].id);
    }
    prevBlobCountRef.current = blobs.length;
  }, [blobs.length]);

  // Compute selection bounds from DOM when selectedIds or visible blobs change
  useEffect(() => {
    if (selectedIds.length === 0) {
      setSelectionBounds(null);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cards = canvas.querySelectorAll<HTMLElement>("[data-blob-card][data-blob-id]");
    let bounds: Bounds | null = null;
    const idSet = new Set(selectedIds);
    for (const card of cards) {
      const id = card.getAttribute("data-blob-id");
      if (!id || !idSet.has(id)) continue;
      const inner = card.querySelector<HTMLElement>("[data-blob-card-inner]");
      const r = (inner ?? card).getBoundingClientRect();
      if (!bounds) {
        bounds = { left: r.left, top: r.top, width: r.width, height: r.height };
      } else {
        const left = Math.min(bounds.left, r.left);
        const top = Math.min(bounds.top, r.top);
        const right = Math.max(bounds.left + bounds.width, r.right);
        const bottom = Math.max(bounds.top + bounds.height, r.bottom);
        bounds = { left, top, width: right - left, height: bottom - top };
      }
    }
    if (bounds) {
      setSelectionBounds({
        left: bounds.left - SELECTION_PADDING,
        top: bounds.top - SELECTION_PADDING,
        width: bounds.width + SELECTION_PADDING * 2,
        height: bounds.height + SELECTION_PADDING * 2,
      });
    } else {
      setSelectionBounds(null);
    }
  }, [selectedIds, visibleBlobs]);

  useEffect(() => {
    selectedIdsCountRef.current = selectedIds.length;
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const ids = selectedIdsRef.current;
      if (ids.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingDeleteIds([...ids]);
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("header") || target.closest("[data-selection-overlay]")) return;
      if (target.closest("[data-blob-card]")) {
        setSelectedIds([]);
        return;
      }
      activePointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
      const isFirstPointer = activePointersRef.current.size === 1;
      if (isFirstPointer) {
        window.dispatchEvent(new CustomEvent("blob:close-menus"));
        pointerDownOnCanvas.current = true;
        primaryPointerIdRef.current = e.pointerId;
        menuWasOpenAtPointerDown.current = anyMenuOpenRef.current;
        hadSelectionAtPointerDownRef.current = selectedIdsCountRef.current > 0;
        hadActiveInsertionAtPointerDownRef.current = !!(
          document.activeElement && (document.activeElement as HTMLElement).closest?.("[data-blob-card]")
        );
        dragStart.current = { x: e.clientX, y: e.clientY };
        pointerDownTimeRef.current = Date.now();
        gestureChosenRef.current = false;
        isDrawingSelection.current = false;
        isPanningRef.current = false;
        setSelectionRect(null);
      }
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [anyMenuOpenRef]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    activePointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    const pointers = activePointersRef.current;
    if (pointers.size === 2 && pointerDownOnCanvas.current) {
      const [[, a], [, b]] = Array.from(pointers.entries());
      const centerX = (a.clientX + b.clientX) / 2;
      const centerY = (a.clientY + b.clientY) / 2;
      const distance = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY) || 1;
      const last = lastPinchRef.current;
      const p = panRef.current;
      const s = scaleRef.current;
      if (last !== null) {
        const scaleFactor = distance / last.distance;
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * scaleFactor));
        const newPan = {
          x: centerX - ((last.centerX - p.x) / s) * newScale,
          y: centerY - HEADER_HEIGHT - ((last.centerY - HEADER_HEIGHT - p.y) / s) * newScale,
        };
        panRef.current = newPan;
        scaleRef.current = newScale;
        setPan(newPan);
        setScale(newScale);
      }
      lastPinchRef.current = { distance, centerX, centerY };
      return;
    }
    if (pointers.size !== 1 || !pointerDownOnCanvas.current || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const elapsed = Date.now() - pointerDownTimeRef.current;
    // First time past threshold: choose pan vs rectangle select by hold time.
    if (!gestureChosenRef.current && distance > DRAG_THRESHOLD) {
      gestureChosenRef.current = true;
      if (elapsed < HOLD_DELAY_MS) {
        isPanningRef.current = true;
        setIsPanning(true);
      } else {
        isDrawingSelection.current = true;
        anchorRef.current = {
          x: Math.round(dragStart.current.x),
          y: Math.round(dragStart.current.y),
        };
      }
    }
    if (isPanningRef.current) {
      setPan((prev) => {
        const next = { x: prev.x + dx, y: prev.y + dy };
        panRef.current = next;
        return next;
      });
      dragStart.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (isDrawingSelection.current && anchorRef.current) {
      const anchor = anchorRef.current;
      const curX = Math.round(e.clientX);
      const curY = Math.round(e.clientY);
      const rect = normalizeRect(anchor.x, anchor.y, curX, curY);
      selectionRectRef.current = rect;
      setSelectionRect(rect);
    }
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const hadPanOrZoom = isPanningRef.current || lastPinchRef.current !== null;
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      activePointersRef.current.delete(e.pointerId);
      if (activePointersRef.current.size === 0) {
        lastPinchRef.current = null;
        isPanningRef.current = false;
        setIsPanning(false);
      }
      const wasPrimary = e.pointerId === primaryPointerIdRef.current;
      if (!wasPrimary) return;
      primaryPointerIdRef.current = null;
      pointerDownOnCanvas.current = false;
      dragStart.current = null;
      anchorRef.current = null;
      gestureChosenRef.current = false;

      if (isDrawingSelection.current && selectionRectRef.current && canvasRef.current) {
        const rect = selectionRectRef.current;
        const canvas = canvasRef.current;
        const cards = canvas.querySelectorAll<HTMLElement>("[data-blob-card][data-blob-id]");
        const enclosed: string[] = [];
        for (const card of cards) {
          const id = card.getAttribute("data-blob-id");
          if (!id) continue;
          const inner = card.querySelector<HTMLElement>("[data-blob-card-inner]");
          const r = (inner ?? card).getBoundingClientRect();
          if (isFullyEnclosed(r, rect)) enclosed.push(id);
        }
        setSelectedIds(enclosed);
        setSelectionRect(null);
        isDrawingSelection.current = false;
        return;
      }

      isDrawingSelection.current = false;
      setSelectionRect(null);
      if (hadPanOrZoom || menuWasOpenAtPointerDown.current) return;
      if (target.closest("[data-blob-card]") || target.closest("header")) return;

      setSelectedIds([]);
      if (hadSelectionAtPointerDownRef.current) return;
      if (hadActiveInsertionAtPointerDownRef.current) return;

      const { x: worldX, y: worldY } = screenToWorld(
        e.clientX - 24,
        e.clientY - 24,
        panRef.current.x,
        panRef.current.y,
        scaleRef.current
      );
      dispatch({
        type: "ADD_BLOB",
        payload: { x: worldX, y: worldY },
      });
      window.dispatchEvent(new CustomEvent("blob:user-action"));
    },
    [dispatch]
  );

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const p = panRef.current;
    const s = scaleRef.current;
    const delta = -e.deltaY * WHEEL_ZOOM_SENSITIVITY;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * (1 + delta)));
    // World point under cursor — account for the header offset
    const worldX = (e.clientX - p.x) / s;
    const worldY = (e.clientY - HEADER_HEIGHT - p.y) / s;
    // New pan keeps that world point fixed under the cursor
    const newPanX = e.clientX - worldX * newScale;
    const newPanY = e.clientY - HEADER_HEIGHT - worldY * newScale;
    panRef.current = { x: newPanX, y: newPanY };
    scaleRef.current = newScale;
    setPan({ x: newPanX, y: newPanY });
    setScale(newScale);
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const showAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const viewportWidth = canvas.clientWidth;
    const viewportHeight = canvas.clientHeight;
    if (visibleBlobs.length === 0) {
      panRef.current = { x: 0, y: 0 };
      scaleRef.current = 1;
      setPan({ x: 0, y: 0 });
      setScale(1);
      return;
    }
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const b of visibleBlobs) {
      left = Math.min(left, b.x);
      top = Math.min(top, b.y);
      right = Math.max(right, b.x + CARD_WIDTH);
      bottom = Math.max(bottom, b.y + CARD_HEIGHT);
    }
    const boundsWidth = right - left + SHOW_ALL_PADDING * 2;
    const boundsHeight = bottom - top + SHOW_ALL_PADDING * 2;
    const scaleX = viewportWidth / boundsWidth;
    const scaleY = viewportHeight / boundsHeight;
    let newScale = Math.min(scaleX, scaleY, MAX_SCALE);
    newScale = Math.max(MIN_SCALE, newScale);
    const boundsCenterX = (left + right) / 2;
    const boundsCenterY = (top + bottom) / 2;
    const newPanX = viewportWidth / 2 - boundsCenterX * newScale;
    const newPanY = viewportHeight / 2 - boundsCenterY * newScale;
    panRef.current = { x: newPanX, y: newPanY };
    scaleRef.current = newScale;
    setPan({ x: newPanX, y: newPanY });
    setScale(newScale);
  }, [visibleBlobs]);

  useEffect(() => {
    const handler = () => showAll();
    window.addEventListener("blob:show-all", handler);
    return () => window.removeEventListener("blob:show-all", handler);
  }, [showAll]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;
      if (e.key === "z" || e.key === "Z") {
        if (e.shiftKey) {
          if (canRedo) {
            e.preventDefault();
            e.stopPropagation();
            redo();
          }
        } else {
          if (canUndo) {
            e.preventDefault();
            e.stopPropagation();
            undo();
          }
        }
        return;
      }
      if (e.key === "y" && !e.shiftKey && !isMac) {
        if (canRedo) {
          e.preventDefault();
          e.stopPropagation();
          redo();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [undo, redo, canUndo, canRedo]);

  return (
    <main className={styles.main}>
      <Header
        hasHiddenBlobs={blobs.some((b) => b.hidden)}
        onUnhideAll={() => dispatch({ type: "UNHIDE_ALL" })}
        hasLockedBlobs={blobs.some((b) => b.locked)}
        onUnlockAll={() => {
          const lockedIds = blobs.filter((b) => b.locked).map((b) => b.id);
          if (lockedIds.length > 0) dispatch({ type: "SET_LOCKED", payload: { ids: lockedIds, locked: false } });
        }}
      />
      <div
        ref={canvasRef}
        className={styles.canvas}
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={(e) => {
          if (e.buttons === 0) return;
          handlePointerUp(e as React.PointerEvent<HTMLDivElement>);
        }}
      >
        <div
          ref={canvasInnerRef}
          className={styles.canvasInner}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: "0 0",
          }}
        >
        {visibleBlobs.map((blob) => (
          <BlobCard
            key={blob.id}
            blob={blob}
            scale={scale}
            isSelected={selectedIds.includes(blob.id)}
            autoFocus={blob.id === focusBlobId}
            onAutoFocusDone={() => setFocusBlobId(null)}
            onUpdate={(content) =>
              dispatch({ type: "UPDATE_BLOB", payload: { id: blob.id, content } })
            }
            onPosition={(x, y) =>
              dispatch({
                type: "SET_POSITION",
                payload: { id: blob.id, x, y },
              })
            }
            onFocus={() => window.dispatchEvent(new CustomEvent("blob:user-action"))}
            onDuplicate={() => dispatch({ type: "DUPLICATE_BLOB", payload: blob.id })}
            onDelete={() => dispatch({ type: "DELETE_BLOB", payload: blob.id })}
            onLock={() => dispatch({ type: "SET_LOCKED", payload: { ids: [blob.id], locked: true } })}
            onUnlock={() => dispatch({ type: "SET_LOCKED", payload: { ids: [blob.id], locked: false } })}
          />
        ))}
        </div>
      </div>

      {selectionRect && selectionRect.width > 0 && selectionRect.height > 0 && (
        <SelectionRect
          left={selectionRect.left}
          top={selectionRect.top}
          width={selectionRect.width}
          height={selectionRect.height}
        />
      )}

      {selectedIds.length > 0 && selectionBounds && (
        <div data-selection-overlay>
          <SelectionOverlay
            bounds={selectionBounds}
            menuRef={selectionMenuRef}
            onDelete={() => {
              dispatch({ type: "DELETE_BLOBS", payload: selectedIds });
              clearSelection();
            }}
            onLock={() => {
              dispatch({
                type: "SET_LOCKED",
                payload: { ids: selectedIds, locked: true },
              });
            }}
            onDuplicate={() => {
              dispatch({ type: "DUPLICATE_BLOBS", payload: selectedIds });
            }}
            onHide={() => {
              dispatch({
                type: "SET_HIDDEN",
                payload: { ids: selectedIds, hidden: true },
              });
              clearSelection();
            }}
          />
        </div>
      )}

      {/* Blobby backer graphic; behind Blobby, in front of blobs */}
      <img
        src="/assets/graphics/blobby%20backer%2001.svg"
        alt=""
        aria-hidden
        style={{
          position: "fixed",
          left: "50%",
          bottom: 24 + 50 - (100 * Math.SQRT2) / 2,
          transform: "translateX(-50%)",
          width: 100 * Math.SQRT2,
          height: 100 * Math.SQRT2,
          zIndex: 1,
          pointerEvents: "none",
        }}
      />
      <Blobby />

      {pendingDeleteIds && (
        <ConfirmDialog
          message={`Delete ${pendingDeleteIds.length} blob${pendingDeleteIds.length === 1 ? "" : "s"}?`}
          onConfirm={() => {
            dispatch({ type: "DELETE_BLOBS", payload: pendingDeleteIds });
            setSelectedIds([]);
            setPendingDeleteIds(null);
          }}
          onCancel={() => setPendingDeleteIds(null)}
        />
      )}
    </main>
  );
}
