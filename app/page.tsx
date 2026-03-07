"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Blobby } from "@/components/Blobby";
import { BlobCard } from "@/components/BlobCard";
import {
  SelectionOverlay,
  SelectionRect,
} from "@/components/SelectionOverlay";
import { useBlobsContext } from "@/contexts/BlobsContext";
import styles from "./page.module.css";

const DRAG_THRESHOLD = 5;
const SELECTION_PADDING = 4;
const MIN_SCALE = 0.25;
const MAX_SCALE = 3;
const WHEEL_ZOOM_SENSITIVITY = 0.002;

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
    y: (screenY - panY) / s,
  };
}

export default function Home() {
  const { blobs, dispatch, anyMenuOpenRef } = useBlobsContext();
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasInnerRef = useRef<HTMLDivElement>(null);
  const pointerDownOnCanvas = useRef(false);
  const menuWasOpenAtPointerDown = useRef(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  /** When we cross the threshold, freeze the anchor at rounded pixel so the initial corner doesn't jitter. */
  const anchorRef = useRef<{ x: number; y: number } | null>(null);
  const isDrawingSelection = useRef(false);
  const selectionRectRef = useRef<Bounds | null>(null);
  const prevBlobCountRef = useRef(blobs.length);
  const selectionMenuRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
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

  useEffect(() => {
    panRef.current = pan;
    scaleRef.current = scale;
  }, [pan, scale]);

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
      const r = card.getBoundingClientRect();
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
        dragStart.current = { x: e.clientX, y: e.clientY };
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
        setPan({
          x: centerX - ((last.centerX - p.x) / s) * newScale,
          y: centerY - ((last.centerY - p.y) / s) * newScale,
        });
        setScale(newScale);
      }
      lastPinchRef.current = { distance, centerX, centerY };
      return;
    }
    if (pointers.size !== 1 || !pointerDownOnCanvas.current || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (!isPanningRef.current && !isDrawingSelection.current && distance > DRAG_THRESHOLD) {
      isPanningRef.current = true;
      setIsPanning(true);
    }
    if (isPanningRef.current) {
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      dragStart.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (!isDrawingSelection.current && distance > DRAG_THRESHOLD) {
      isDrawingSelection.current = true;
      anchorRef.current = {
        x: Math.round(dragStart.current.x),
        y: Math.round(dragStart.current.y),
      };
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

      if (isDrawingSelection.current && selectionRectRef.current && canvasRef.current) {
        const rect = selectionRectRef.current;
        const canvas = canvasRef.current;
        const cards = canvas.querySelectorAll<HTMLElement>("[data-blob-card][data-blob-id]");
        const enclosed: string[] = [];
        for (const card of cards) {
          const id = card.getAttribute("data-blob-id");
          if (!id) continue;
          const r = card.getBoundingClientRect();
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
    const inner = canvasInnerRef.current;
    if (!inner) return;
    // Use the transformed element's actual rect so zoom is about the point under the cursor
    const rect = inner.getBoundingClientRect();
    const currentScale = scaleRef.current;
    const delta = -e.deltaY * WHEEL_ZOOM_SENSITIVITY;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, currentScale * (1 + delta)));
    // World point under cursor: (cursor - inner's top-left) / scale
    const worldX = (e.clientX - rect.left) / currentScale;
    const worldY = (e.clientY - rect.top) / currentScale;
    // New pan so that (worldX, worldY) stays under the cursor at newScale
    const newPanX = e.clientX - worldX * newScale;
    const newPanY = e.clientY - worldY * newScale;
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

  return (
    <main className={styles.main}>
      <Header hasHiddenBlobs={blobs.some((b) => b.hidden)} onUnhideAll={() => dispatch({ type: "UNHIDE_ALL" })} />
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

      <Blobby />
    </main>
  );
}
