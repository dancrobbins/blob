"use client";

import React, { useCallback, useLayoutEffect, useRef, useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Blobby } from "@/components/Blobby";
import { BlobbyWordBox } from "@/components/BlobbyWordBox";
import { BlobCard } from "@/components/BlobCard";
import {
  SelectionOverlay,
  SelectionRect,
} from "@/components/SelectionOverlay";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useBlobsContext } from "@/contexts/BlobsContext";
import { usePresence } from "@/contexts/PresenceContext";
import { getLastBlobbyLogEntry } from "@/lib/persistence";
import { OtherCursors } from "@/components/OtherCursors";
import { blobToPlainText } from "@/lib/blob-lines";
import { linesToMarkdown, markdownToLines, removeEmptyLines, hasEmptyLines, isBlobContentEmpty } from "@/lib/blob-markdown";
import { getBlobBounds, SHOW_ALL_CONTROLS_LEFT_PX } from "@/lib/blob-constants";
import { dispatchCloseMenus } from "@/lib/menu-close-event";
import { gapBetweenRects, getMergeCueRect, overlapArea, pointInRect } from "@/lib/blob-boundary-path";
import { BlobBoundaryOverlay } from "@/components/BlobBoundaryOverlay";
import { ControlsPortalProvider, useControlsPortal } from "@/contexts/ControlsPortalContext";
import { PopupPortalProvider, usePopupPortal } from "@/contexts/PopupPortalContext";
import styles from "./page.module.css";

const BLOBBY_BACKER_FILE = "blobby backer L.svg";

/** Single container for Blobby + backer; only the slider (and platform half in mobile) sets size. */
const BLOBBY_CONTAINER_BOTTOM_PX = 74;

function BlobbyBacker({
  onTap,
  onPointerEnter,
  onPointerLeave,
}: {
  onTap: () => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="Summarize blobs"
      data-blobby-area
      onClick={onTap}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        padding: 0,
        border: "none",
        borderRadius: "50%",
        background: "transparent",
        cursor: "pointer",
        display: "block",
      }}
    >
      <img
        src={`/assets/graphics/${encodeURIComponent(BLOBBY_BACKER_FILE)}`}
        alt=""
        aria-hidden
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          pointerEvents: "none",
        }}
      />
    </button>
  );
}

const DRAG_THRESHOLD = 5;
const SELECTION_PADDING = 4;
/** If the user moves past threshold within this ms of pointer down → pan. If after → rectangle select. */
const HOLD_DELAY_MS = 220;
const MIN_SCALE = 0.25;
const MAX_SCALE = 3;
const WHEEL_ZOOM_SENSITIVITY = 0.002;
const SHOW_ALL_PADDING = 48;

const CLOSE_THRESHOLD = 80;
const VERY_CLOSE_THRESHOLD = 24;
/** Pixels to pan per frame when cursor is at viewport edge during blob drag. */
const DRAG_EDGE_PAN_SPEED = 12;

/** Mobile focus: target screen font size (px) so blob text is readable at user’s default. */
const MOBILE_FOCUS_SCREEN_FONT_PX = 16;
/** Blob content font in world px (0.9375rem). */
const MOBILE_FOCUS_WORLD_FONT_PX = 15;
/** Horizontal padding (each side) so blob doesn’t touch screen edges. */
const MOBILE_FOCUS_HORIZ_PADDING = 24;
/** Reserved space (px) for header + top/bottom padding when fitting blob height to viewport. */
const MOBILE_FOCUS_HEADER_PX = 68;
/** Height (px) of the mobile top bar; same as header height so the bar fully encompasses menu and avatar. */
const MOBILE_TOP_BAR_HEIGHT_PX = MOBILE_FOCUS_HEADER_PX;
const MOBILE_FOCUS_VERT_PADDING_PX = 24;
/** Bottom offset (px) before blobby backer; add effectiveBackerSize for full reserved bottom. */
const MOBILE_FOCUS_BOTTOM_OFFSET_PX = 74;

const MIN_BLOB_W = 120;
const MIN_BLOB_H = 80;

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
  const { blobs, dispatch, anyMenuOpenRef, undo, redo, canUndo, canRedo, preferences, appendBlobbyLog, blobbyLog, initialCameraPosition, clearInitialCamera, persistCamera } = useBlobsContext();
  const { updateLocalCursor, otherPresences } = usePresence();
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
  const visibleBlobsRef = useRef<typeof blobs>([]);
  const blobsRef = useRef(blobs);
  const multiDragStartPositionsRef = useRef<Record<string, { x: number; y: number }> | null>(null);
  const multiDragSelectedIdsRef = useRef<string[] | null>(null);
  /** Single-blob drag start position for undo merge (restore source blob here). */
  const mergeDragStartPositionRef = useRef<{ blobId: string; x: number; y: number } | null>(null);
  const hadSelectionAtPointerDownRef = useRef(false);
  /** True if a blob had the text insertion point at pointer down; tap on empty canvas then does not create a new blob. */
  const hadFocusBlobAtPointerDownRef = useRef(false);
  /** Ref for user-focused blob (not state) so we don't trigger autoFocus effect when user taps existing blob. */
  const focusedBlobIdRef = useRef<string | null>(null);
  /** When we apply mobile focus, store the blob's desktop size so we can restore on switch back to desktop. */
  const preMobileFocusBlobRef = useRef<{ blobId: string; width: number; height: number } | null>(null);
  /** True once we've committed to either pan or selection for this gesture. */
  const gestureChosenRef = useRef(false);
  const activePointersRef = useRef<Map<number, { clientX: number; clientY: number }>>(new Map());
  const lastPinchRef = useRef<{ distance: number; centerX: number; centerY: number } | null>(null);
  const panRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const primaryPointerIdRef = useRef<number | null>(null);
  /** Cursor position during blob drag (for edge auto-pan). Updated from document pointermove. */
  const dragCursorRef = useRef({ clientX: 0, clientY: 0 });
  /** World-space pick offset for the dragging blob (cursor world pos - blob world pos at drag start). */
  const dragPickOffsetRef = useRef<{ x: number; y: number } | null>(null);
  /** Merging mode for the merge rAF (strict = cursor in merge region; loose = blob overlap). */
  const mergingModeRef = useRef<"strict" | "loose">("strict");
  mergingModeRef.current = preferences.mergingMode;
  /** Merge region margin (world px) for the merge rAF. */
  const mergeMarginPxRef = useRef(50);
  mergeMarginPxRef.current = preferences.mergeMarginPx;

  const [focusBlobId, setFocusBlobId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionRect, setSelectionRect] = useState<Bounds | null>(null);
  const [selectionBounds, setSelectionBounds] = useState<Bounds | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [isShowingAll, setIsShowingAll] = useState(true);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [llmSummary, setLlmSummary] = useState<string | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [isBlobbyHovered, setIsBlobbyHovered] = useState(false);
  const [lastBlobbyOutput, setLastBlobbyOutput] = useState<string | null>(null);
  const [showRecalledOutput, setShowRecalledOutput] = useState(false);
  const [backerHovered, setBackerHovered] = useState(false);
  const [isBlobbyMenuOpen, setIsBlobbyMenuOpen] = useState(false);
  const blobbyLongHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backerLeaveGraceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recallHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draggingBlobId, setDraggingBlobId] = useState<string | null>(null);

  const visibleBlobs = React.useMemo(
    () => blobs.filter((b) => !b.hidden),
    [blobs]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 0, height: 0 };
      setCanvasSize({ width, height });
    });
    ro.observe(canvas);
    setCanvasSize({ width: canvas.clientWidth, height: canvas.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Rehydrate camera from cloud (once per load)
  useEffect(() => {
    if (!initialCameraPosition) return;
    const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, initialCameraPosition.scale));
    const p = { x: initialCameraPosition.panX, y: initialCameraPosition.panY };
    panRef.current = p;
    scaleRef.current = s;
    setPan(p);
    setScale(s);
    setIsShowingAll(false);
    clearInitialCamera();
  }, [initialCameraPosition, clearInitialCamera]);

  // Persist camera to cloud when pan/scale change (debounced). Don't persist while we still have cloud camera to apply.
  const cameraPersistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (initialCameraPosition != null) {
      if (cameraPersistDebounceRef.current) {
        clearTimeout(cameraPersistDebounceRef.current);
        cameraPersistDebounceRef.current = null;
      }
      return; // Wait until we've applied cloud camera
    }
    if (cameraPersistDebounceRef.current) clearTimeout(cameraPersistDebounceRef.current);
    cameraPersistDebounceRef.current = setTimeout(() => {
      cameraPersistDebounceRef.current = null;
      persistCamera({ panX: pan.x, panY: pan.y, scale });
    }, 500);
    return () => {
      if (cameraPersistDebounceRef.current) clearTimeout(cameraPersistDebounceRef.current);
    };
  }, [pan.x, pan.y, scale, initialCameraPosition, persistCamera]);

  /** Live merge state computed entirely from DOM rects every frame so there is no React state lag. */
  const [liveMergeState, setLiveMergeState] = useState<{
    closeTargetId: string;
    mergePossible: boolean;
    boundsA: Bounds;
    boundsB: Bounds;
  } | null>(null);

  // During drag, read all blob card positions from DOM every frame and pick the best merge target.
  useLayoutEffect(() => {
    if (!draggingBlobId) {
      setLiveMergeState(null);
      return;
    }
    let rafId: number;
    const tick = () => {
      const inner = canvasInnerRef.current;
      const id = draggingBlobId;
      if (!inner || !id) {
        setLiveMergeState(null);
        return;
      }
      const p = panRef.current;
      const s = scaleRef.current;
      if (s === 0) { rafId = requestAnimationFrame(tick); return; }

      const toWorld = (r: DOMRect): Bounds => ({
        left: (r.left - p.x) / s,
        top: (r.top - p.y) / s,
        width: r.width / s,
        height: r.height / s,
      });

      // Blob shape = the card (data-blob-card-inner) — the visible rounded rect the user sees.
      // Merge region = that shape + fixed margin on all sides.
      const getBlobShapeBounds = (blobId: string): Bounds | null => {
        const el = inner.querySelector<HTMLElement>(`[data-blob-card][data-blob-id="${blobId}"] [data-blob-card-inner]`);
        return el ? toWorld(el.getBoundingClientRect()) : null;
      };

      const boundsA = getBlobShapeBounds(id);
      if (!boundsA) { rafId = requestAnimationFrame(tick); return; }

      const visible = visibleBlobsRef.current;
      const strict = mergingModeRef.current === "strict";
      const cursorWorld = strict
        ? {
            x: (dragCursorRef.current.clientX - p.x) / s,
            y: (dragCursorRef.current.clientY - p.y) / s,
          }
        : null;

      let bestId: string | null = null;
      let bestGap = Infinity;
      let bestOverlap = 0;
      let bestBoundsB: Bounds | null = null;

      if (strict && cursorWorld) {
        // Strict: merge region = blob shape + fixed margin; cursor must be inside that.
        let bestCueArea = Infinity;
        for (const b of visible) {
          if (b.id === id) continue;
          const shapeB = getBlobShapeBounds(b.id);
          if (!shapeB) continue;
          const cueB = getMergeCueRect(shapeB, mergeMarginPxRef.current);
          if (!pointInRect(cursorWorld.x, cursorWorld.y, cueB)) continue;
          const area = cueB.width * cueB.height;
          if (area < bestCueArea) {
            bestId = b.id;
            bestCueArea = area;
            bestBoundsB = shapeB;
          }
        }
      } else {
        // Loose: merge region = same blob shape + margin; pick by overlap of those shapes.
        for (const b of visible) {
          if (b.id === id) continue;
          const shapeB = getBlobShapeBounds(b.id);
          if (!shapeB) continue;
          const gap = gapBetweenRects(boundsA, shapeB);
          if (gap >= CLOSE_THRESHOLD) continue;
          const overlap = overlapArea(boundsA, shapeB);
          const strictlyBetter =
            bestId == null ||
            overlap > bestOverlap ||
            (overlap === bestOverlap && gap < bestGap);
          if (strictlyBetter) {
            bestId = b.id;
            bestGap = gap;
            bestOverlap = overlap;
            bestBoundsB = shapeB;
          }
        }
      }

      if (bestId == null || bestBoundsB == null) {
        setLiveMergeState(null);
      } else {
        const mergePossible = strict
          ? true
          : gapBetweenRects(getMergeCueRect(boundsA, mergeMarginPxRef.current), getMergeCueRect(bestBoundsB, mergeMarginPxRef.current)) <= 0;
        setLiveMergeState({ closeTargetId: bestId, mergePossible, boundsA, boundsB: bestBoundsB });
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      setLiveMergeState(null);
    };
  }, [draggingBlobId]);

  // When dragging a blob, pan the canvas if the cursor touches the viewport edge so the blob stays in view.
  useLayoutEffect(() => {
    if (!draggingBlobId) return;
    const onPointerMove = (e: PointerEvent) => {
      dragCursorRef.current = { clientX: e.clientX, clientY: e.clientY };
    };
    document.addEventListener("pointermove", onPointerMove, { capture: true });
    let rafId: number;
    const tick = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      const { clientX, clientY } = dragCursorRef.current;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      let dx = 0;
      let dy = 0;
      // Use >= w-1 (not strictly > w) because browsers clamp clientX to innerWidth-1
      // when pointer is captured and exits the window.
      if (clientX <= 1) dx = DRAG_EDGE_PAN_SPEED;
      else if (clientX >= w - 1) dx = -DRAG_EDGE_PAN_SPEED;
      if (clientY <= 1) dy = DRAG_EDGE_PAN_SPEED;
      else if (clientY >= h - 1) dy = -DRAG_EDGE_PAN_SPEED;
      if (dx !== 0 || dy !== 0) {
        setPan((prev) => {
          const next = { x: prev.x + dx, y: prev.y + dy };
          panRef.current = next;
          return next;
        });
        setIsShowingAll(false);
        // Re-position dragging blob so it keeps following the (clamped) cursor
        // as the view pans — otherwise the blob appears stuck at the edge.
        const pickOffset = dragPickOffsetRef.current;
        const blobId = draggingBlobId;
        if (pickOffset && blobId) {
          const newPan = panRef.current;
          const s = scaleRef.current;
          if (s > 0) {
            const worldCursorX = (clientX - newPan.x) / s;
            const worldCursorY = (clientY - newPan.y) / s;
            dispatch({
              type: "SET_POSITION",
              payload: { id: blobId, x: worldCursorX - pickOffset.x, y: worldCursorY - pickOffset.y },
            });
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      document.removeEventListener("pointermove", onPointerMove, { capture: true });
      cancelAnimationFrame(rafId);
    };
  }, [draggingBlobId, dispatch]);

  // Merge cues: primary = liveMergeState (DOM-driven every frame).
  // Fallback for handleDragEnd (merge on release): store-based bounds for when rAF hasn't updated yet.
  const { closeTargetId, mergePossible } = React.useMemo(() => {
    if (liveMergeState) {
      return {
        closeTargetId: liveMergeState.closeTargetId,
        mergePossible: liveMergeState.mergePossible,
      };
    }
    return { closeTargetId: null, mergePossible: false };
  }, [liveMergeState]);

  // Clear LLM summary after 12s — paused while the mouse is over the word box
  useEffect(() => {
    if (llmSummary == null) return;
    if (isBlobbyHovered) return;
    const t = setTimeout(() => setLlmSummary(null), 12_000);
    return () => clearTimeout(t);
  }, [llmSummary, isBlobbyHovered]);

  const BLOBBY_LONG_HOVER_MS = 3000;

  const handleBlobbyBackerPointerEnter = useCallback(() => {
    setBackerHovered(true);
    if (backerLeaveGraceRef.current) {
      clearTimeout(backerLeaveGraceRef.current);
      backerLeaveGraceRef.current = null;
    }
    if (blobbyLongHoverTimerRef.current) clearTimeout(blobbyLongHoverTimerRef.current);
    blobbyLongHoverTimerRef.current = setTimeout(() => {
      blobbyLongHoverTimerRef.current = null;
      setShowRecalledOutput(true);
    }, BLOBBY_LONG_HOVER_MS);
  }, []);

  const handleBlobbyBackerPointerLeave = useCallback(() => {
    setBackerHovered(false);
    if (backerLeaveGraceRef.current) clearTimeout(backerLeaveGraceRef.current);
    backerLeaveGraceRef.current = setTimeout(() => {
      backerLeaveGraceRef.current = null;
      if (blobbyLongHoverTimerRef.current) {
        clearTimeout(blobbyLongHoverTimerRef.current);
        blobbyLongHoverTimerRef.current = null;
      }
    }, 400);
    if (recallHideTimerRef.current) {
      clearTimeout(recallHideTimerRef.current);
      recallHideTimerRef.current = null;
    }
  }, []);

  // When in recall mode, hide the recalled output shortly after pointer leaves both backer and word box (but not while the "..." menu is open)
  useEffect(() => {
    if (!showRecalledOutput || backerHovered || isBlobbyHovered || isBlobbyMenuOpen) return;
    recallHideTimerRef.current = setTimeout(() => setShowRecalledOutput(false), 400);
    return () => {
      if (recallHideTimerRef.current) {
        clearTimeout(recallHideTimerRef.current);
        recallHideTimerRef.current = null;
      }
    };
  }, [showRecalledOutput, backerHovered, isBlobbyHovered, isBlobbyMenuOpen]);

  // After refresh when logged in: seed lastBlobbyOutput from cloud blobbyLog when it loads so 3s-hover recall works
  useEffect(() => {
    const last = getLastBlobbyLogEntry(blobbyLog);
    if (last != null) {
      setLastBlobbyOutput((prev) => (prev == null ? last : prev));
    }
  }, [blobbyLog]);

  const handleBlobbyTap = useCallback(async () => {
    const combined = blobs
      .map((b) => blobToPlainText(b))
      .filter((c) => c.trim().length > 0)
      .join("\n");
    if (combined.length === 0) return;
    setLlmSummary(null);
    setLlmLoading(true);
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: combined }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data?.summary === "string") {
        const summary = data.summary;
        setLlmSummary(summary);
        setLastBlobbyOutput(summary);
        appendBlobbyLog(summary);
      } else if (res.status === 429 || data?.error === "RATE_LIMIT") {
        const msg = "The AI limit has been reached. Try again tomorrow.";
        setLlmSummary(msg);
        setLastBlobbyOutput(msg);
        appendBlobbyLog(msg);
      }
    } finally {
      setLlmLoading(false);
    }
  }, [blobs]);

  useEffect(() => {
    if (blobs.length > prevBlobCountRef.current) {
      setFocusBlobId(blobs[blobs.length - 1].id);
    }
    prevBlobCountRef.current = blobs.length;
  }, [blobs.length]);

  // Compute selection bounds in world coordinates from DOM (matches rendered blob positions; overlay moves with pan/scale)
  useLayoutEffect(() => {
    if (selectedIds.length === 0) {
      setSelectionBounds(null);
      return;
    }
    const canvas = canvasRef.current;
    const canvasInner = canvasInnerRef.current;
    if (!canvas || !canvasInner || scale <= 0) return;
    const canvasRect = canvas.getBoundingClientRect();
    const panX = pan.x;
    const panY = pan.y;
    const idSet = new Set(selectedIds);
    const cards = canvas.querySelectorAll<HTMLElement>("[data-blob-card][data-blob-id]");
    let bounds: Bounds | null = null;
    for (const card of cards) {
      const id = card.getAttribute("data-blob-id");
      if (!id || !idSet.has(id)) continue;
      const inner = card.querySelector<HTMLElement>("[data-blob-card-inner]");
      const el = inner ?? card;
      const r = el.getBoundingClientRect();
      // Convert screen rect to world coordinates (same system as canvas inner transform)
      const worldLeft = (r.left - canvasRect.left - panX) / scale;
      const worldTop = (r.top - canvasRect.top - panY) / scale;
      const worldWidth = r.width / scale;
      const worldHeight = r.height / scale;
      if (!Number.isFinite(worldLeft + worldTop + worldWidth + worldHeight)) continue;
      if (!bounds) {
        bounds = { left: worldLeft, top: worldTop, width: worldWidth, height: worldHeight };
      } else {
        const left = Math.min(bounds.left, worldLeft);
        const top = Math.min(bounds.top, worldTop);
        const right = Math.max(bounds.left + bounds.width, worldLeft + worldWidth);
        const bottom = Math.max(bounds.top + bounds.height, worldTop + worldHeight);
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
  }, [selectedIds, visibleBlobs, pan.x, pan.y, scale]);

  useEffect(() => {
    selectedIdsCountRef.current = selectedIds.length;
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  useEffect(() => {
    visibleBlobsRef.current = visibleBlobs;
  }, [visibleBlobs]);

  useEffect(() => {
    blobsRef.current = blobs;
  }, [blobs]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const ids = selectedIdsRef.current;
      if (ids.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      const currentBlobs = blobsRef.current;
      const allEmpty = ids.every((id) => {
        const b = currentBlobs.find((blob) => blob.id === id);
        return b != null && isBlobContentEmpty(b.content);
      });
      if (allEmpty) {
        dispatch({ type: "DELETE_BLOBS", payload: ids });
        setSelectedIds([]);
        return;
      }
      setPendingDeleteIds([...ids]);
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [dispatch]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSelectedIds([]);
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  // Track cursor over the entire document (including blob cards) for remote presence.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.buttons > 1) return; // skip right/middle drag
      const { x: worldX, y: worldY } = screenToWorld(
        e.clientX,
        e.clientY,
        panRef.current.x,
        panRef.current.y,
        scaleRef.current
      );
      updateLocalCursor(worldX, worldY);
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => document.removeEventListener("pointermove", onMove);
  }, [updateLocalCursor]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("header") || target.closest("[data-selection-overlay]")) return;
      if (target.closest("[data-blob-card]") || target.closest("[data-blob-controls]")) {
        setSelectedIds([]);
        return;
      }
      activePointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
      const isFirstPointer = activePointersRef.current.size === 1;
      if (isFirstPointer) {
        dispatchCloseMenus();
        pointerDownOnCanvas.current = true;
        primaryPointerIdRef.current = e.pointerId;
        menuWasOpenAtPointerDown.current = anyMenuOpenRef.current;
        hadSelectionAtPointerDownRef.current = selectedIdsCountRef.current > 0;
        hadFocusBlobAtPointerDownRef.current = focusedBlobIdRef.current != null;
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
          y: centerY - ((last.centerY - p.y) / s) * newScale,
        };
        panRef.current = newPan;
        scaleRef.current = newScale;
        setPan(newPan);
        setScale(newScale);
        setIsShowingAll(false);
      }
      lastPinchRef.current = { distance, centerX, centerY };
      return;
    }
    if (pointers.size !== 1 || !pointerDownOnCanvas.current || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const elapsed = Date.now() - pointerDownTimeRef.current;
    // First time past threshold: choose pan vs rectangle select. In mobile mode, no pan and no rectangle drag select.
    if (!gestureChosenRef.current && distance > DRAG_THRESHOLD) {
      gestureChosenRef.current = true;
      if (preferences.platformMode === "mobile") {
        // Mobile: one-finger drag does nothing (no pan, no rectangle select).
      } else if (elapsed < HOLD_DELAY_MS) {
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
      setIsShowingAll(false);
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
  }, [preferences.platformMode]);

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
      const blobCard = target.closest<HTMLElement>("[data-blob-card]");
      const blobControls = target.closest<HTMLElement>("[data-blob-controls]");
      const blobIdFromCard = blobCard?.getAttribute("data-blob-id") ?? blobControls?.closest<HTMLElement>("[data-blob-card]")?.getAttribute("data-blob-id");
      if (blobCard || blobControls) {
        if (blobIdFromCard) {
          setSelectedIds((prev) => {
            if (e.ctrlKey || e.metaKey) {
              if (prev.includes(blobIdFromCard)) return prev.filter((id) => id !== blobIdFromCard);
              return [...prev, blobIdFromCard];
            }
            return [blobIdFromCard];
          });
        }
        return;
      }
      if (target.closest("header")) return;
      const under = document.elementFromPoint(e.clientX, e.clientY);
      if (under?.closest?.("[data-blobby-area]")) return;

      setSelectedIds([]);
      if (hadSelectionAtPointerDownRef.current) return;
      if (hadFocusBlobAtPointerDownRef.current) return;

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

  const handleDragStart = useCallback((blobId: string) => {
    setDraggingBlobId(blobId);
    const ids = selectedIdsRef.current;
    if (ids.length > 1 && ids.includes(blobId)) {
      const visible = visibleBlobsRef.current;
      const positions: Record<string, { x: number; y: number }> = {};
      for (const b of visible) {
        if (ids.includes(b.id) && !b.locked) positions[b.id] = { x: b.x, y: b.y };
      }
      multiDragStartPositionsRef.current = positions;
      multiDragSelectedIdsRef.current = [...ids];
      mergeDragStartPositionRef.current = null;
    } else {
      multiDragStartPositionsRef.current = null;
      multiDragSelectedIdsRef.current = null;
      const blob = blobs.find((b) => b.id === blobId);
      mergeDragStartPositionRef.current = blob ? { blobId, x: blob.x, y: blob.y } : null;
    }
  }, [blobs]);

  const handleMoveSelected = useCallback((dx: number, dy: number) => {
    const start = multiDragStartPositionsRef.current;
    const ids = multiDragSelectedIdsRef.current;
    if (!start || !ids) return;
    for (const id of ids) {
      const s = start[id];
      if (s) dispatch({ type: "SET_POSITION", payload: { id, x: s.x + dx, y: s.y + dy } });
    }
  }, [dispatch]);

  const handleDragPickOffset = useCallback((offsetX: number, offsetY: number) => {
    dragPickOffsetRef.current = { x: offsetX, y: offsetY };
  }, []);

  const handleDragEnd = useCallback(
    (blobId: string) => {
      dragPickOffsetRef.current = null;
      const originalPosition =
        multiDragStartPositionsRef.current?.[blobId] ??
        (mergeDragStartPositionRef.current?.blobId === blobId
          ? { x: mergeDragStartPositionRef.current.x, y: mergeDragStartPositionRef.current.y }
          : undefined);
      multiDragStartPositionsRef.current = null;
      multiDragSelectedIdsRef.current = null;
      mergeDragStartPositionRef.current = null;
      if (mergePossible && closeTargetId && blobId !== closeTargetId) {
        const targetId = closeTargetId;
        // Merge at top of stationary blob if dragged blob is above its vertical midpoint, else at bottom
        const prependSource =
          (() => {
            const live = liveMergeState;
            if (live) {
              return live.boundsA.top + live.boundsA.height / 2 < live.boundsB.top + live.boundsB.height / 2;
            }
            const sourceBlob = blobs.find((b) => b.id === blobId);
            const targetBlob = blobs.find((b) => b.id === targetId);
            if (!sourceBlob || !targetBlob) return false;
            const boundsA = getBlobBounds(sourceBlob);
            const boundsB = getBlobBounds(targetBlob);
            return boundsA.top + boundsA.height / 2 < boundsB.top + boundsB.height / 2;
          })();
        // Preserve target blob size when merging (so Raw mode merged blob doesn’t resize)
        const canvas = canvasRef.current;
        if (canvas && scale > 0) {
          const card = canvas.querySelector<HTMLElement>(`[data-blob-card][data-blob-id="${targetId}"]`);
          if (card) {
            const inner = card.querySelector<HTMLElement>("[data-blob-card-inner]");
            const r = (inner ?? card).getBoundingClientRect();
            const worldW = Math.max(120, r.width / scale);
            const worldH = Math.max(80, r.height / scale);
            dispatch({ type: "SET_BLOB_SIZE", payload: { id: targetId, width: worldW, height: worldH } });
          }
        }
        dispatch({
          type: "MERGE_BLOBS",
          payload: { sourceId: blobId, targetId, prependSource, sourcePosition: originalPosition },
        });
        setSelectedIds((prev) => (prev.includes(blobId) ? prev.filter((id) => id !== blobId && id !== targetId).concat(targetId) : prev));
      }
      setDraggingBlobId(null);
    },
    [dispatch, scale, mergePossible, closeTargetId, liveMergeState, blobs]
  );

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      // In mobile mode (even on desktop), route wheel over a blob to that blob's scrollable content
      if (preferences.platformMode === "mobile") {
        const card = (e.target as Element).closest("[data-blob-card]");
        const inner = card?.querySelector("[data-blob-card-inner][data-mobile-fill]");
        const scrollEl = inner?.querySelector("[data-testid=\"blob-content\"]") as HTMLElement | null;
        if (scrollEl) {
          scrollEl.scrollTop += e.deltaY;
          e.preventDefault();
          return;
        }
      }
      e.preventDefault();
      const p = panRef.current;
      const s = scaleRef.current;
      const delta = -e.deltaY * WHEEL_ZOOM_SENSITIVITY;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * (1 + delta)));
      const worldX = (e.clientX - p.x) / s;
      const worldY = (e.clientY - p.y) / s;
      const newPanX = e.clientX - worldX * newScale;
      const newPanY = e.clientY - worldY * newScale;
      panRef.current = { x: newPanX, y: newPanY };
      scaleRef.current = newScale;
      setPan({ x: newPanX, y: newPanY });
      setScale(newScale);
      setIsShowingAll(false);
    },
    [preferences.platformMode]
  );

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const zoomToFit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const viewportWidth = canvas.clientWidth;
    const viewportHeight = canvas.clientHeight;
    if (visibleBlobs.length === 0) {
      panRef.current = { x: 0, y: 0 };
      scaleRef.current = 1;
      setPan({ x: 0, y: 0 });
      setScale(1);
      setIsShowingAll(true);
      persistCamera({ panX: 0, panY: 0, scale: 1 }, { immediate: true });
      return;
    }
    const panVal = panRef.current;
    const scaleVal = scaleRef.current;
    const canvasRect = canvas.getBoundingClientRect();
    const visibleIds = new Set(visibleBlobs.map((b) => b.id));
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    const cards = canvas.querySelectorAll<HTMLElement>("[data-blob-card][data-blob-id]");
    let usedDomBounds = false;
    for (const card of cards) {
      const id = card.getAttribute("data-blob-id");
      if (!id || !visibleIds.has(id)) continue;
      const inner = card.querySelector<HTMLElement>("[data-blob-card-inner]");
      const r = (inner ?? card).getBoundingClientRect();
      const worldLeft = (r.left - canvasRect.left - panVal.x) / scaleVal;
      const worldTop = (r.top - canvasRect.top - panVal.y) / scaleVal;
      const worldW = r.width / scaleVal;
      const worldH = r.height / scaleVal;
      left = Math.min(left, worldLeft);
      top = Math.min(top, worldTop);
      right = Math.max(right, worldLeft + worldW);
      bottom = Math.max(bottom, worldTop + worldH);
      usedDomBounds = true;
    }
    if (!usedDomBounds) {
      for (const b of visibleBlobs) {
        const rect = getBlobBounds(b);
        left = Math.min(left, rect.left);
        top = Math.min(top, rect.top);
        right = Math.max(right, rect.left + rect.width);
        bottom = Math.max(bottom, rect.top + rect.height);
      }
    }
    const paddingL = SHOW_ALL_PADDING + SHOW_ALL_CONTROLS_LEFT_PX;
    const paddingR = SHOW_ALL_PADDING;
    const paddingT = SHOW_ALL_PADDING;
    const paddingB = SHOW_ALL_PADDING;
    const contentW = right - left;
    const contentH = bottom - top;
    const scaleX = (viewportWidth - paddingL - paddingR) / contentW;
    const scaleY = (viewportHeight - paddingT - paddingB) / contentH;
    let newScale = Math.min(scaleX, scaleY, MAX_SCALE);
    newScale = Math.max(MIN_SCALE, newScale);
    const boundsCenterX = (left + right) / 2;
    const boundsCenterY = (top + bottom) / 2;
    const newPanX = (viewportWidth + paddingL - paddingR) / 2 - boundsCenterX * newScale;
    const newPanY = (viewportHeight + paddingT - paddingB) / 2 - boundsCenterY * newScale;
    panRef.current = { x: newPanX, y: newPanY };
    scaleRef.current = newScale;
    setPan({ x: newPanX, y: newPanY });
    setScale(newScale);
    setIsShowingAll(true);
    persistCamera({ panX: newPanX, panY: newPanY, scale: newScale }, { immediate: true });
  }, [visibleBlobs, persistCamera]);

  const zoomToSelection = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || selectedIds.length === 0) return;
    const viewportWidth = canvas.clientWidth;
    const viewportHeight = canvas.clientHeight;
    const selectedSet = new Set(selectedIds);
    const toFit = visibleBlobs.filter((b) => selectedSet.has(b.id));
    if (toFit.length === 0) return;
    const panVal = panRef.current;
    const scaleVal = scaleRef.current;
    const canvasRect = canvas.getBoundingClientRect();
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    const cards = canvas.querySelectorAll<HTMLElement>("[data-blob-card][data-blob-id]");
    let usedDomBounds = false;
    for (const card of cards) {
      const id = card.getAttribute("data-blob-id");
      if (!id || !selectedSet.has(id)) continue;
      const inner = card.querySelector<HTMLElement>("[data-blob-card-inner]");
      const r = (inner ?? card).getBoundingClientRect();
      const worldLeft = (r.left - canvasRect.left - panVal.x) / scaleVal;
      const worldTop = (r.top - canvasRect.top - panVal.y) / scaleVal;
      const worldW = r.width / scaleVal;
      const worldH = r.height / scaleVal;
      left = Math.min(left, worldLeft);
      top = Math.min(top, worldTop);
      right = Math.max(right, worldLeft + worldW);
      bottom = Math.max(bottom, worldTop + worldH);
      usedDomBounds = true;
    }
    if (!usedDomBounds) {
      for (const b of toFit) {
        const rect = getBlobBounds(b);
        left = Math.min(left, rect.left);
        top = Math.min(top, rect.top);
        right = Math.max(right, rect.left + rect.width);
        bottom = Math.max(bottom, rect.top + rect.height);
      }
    }
    const paddingL = SHOW_ALL_PADDING + SHOW_ALL_CONTROLS_LEFT_PX;
    const paddingR = SHOW_ALL_PADDING;
    const paddingT = SHOW_ALL_PADDING;
    const paddingB = SHOW_ALL_PADDING;
    const contentW = right - left;
    const contentH = bottom - top;
    const scaleX = (viewportWidth - paddingL - paddingR) / contentW;
    const scaleY = (viewportHeight - paddingT - paddingB) / contentH;
    let newScale = Math.min(scaleX, scaleY, MAX_SCALE);
    newScale = Math.max(MIN_SCALE, newScale);
    const boundsCenterX = (left + right) / 2;
    const boundsCenterY = (top + bottom) / 2;
    const newPanX = (viewportWidth + paddingL - paddingR) / 2 - boundsCenterX * newScale;
    const newPanY = (viewportHeight + paddingT - paddingB) / 2 - boundsCenterY * newScale;
    panRef.current = { x: newPanX, y: newPanY };
    scaleRef.current = newScale;
    setPan({ x: newPanX, y: newPanY });
    setScale(newScale);
    setIsShowingAll(false);
    persistCamera({ panX: newPanX, panY: newPanY, scale: newScale }, { immediate: true });
  }, [visibleBlobs, selectedIds, persistCamera]);

  /** In mobile mode, when user taps into a blob: zoom to default font size, pan so blob top-left is at app top-left, then resize blob to fit viewport. */
  const handleMobileFocusBlob = useCallback(
    (blobId: string) => {
      const canvas = canvasRef.current;
      const blob = blobs.find((b) => b.id === blobId);
      if (!canvas || !blob || blob.locked) return;
      const viewportWidth = canvas.clientWidth;
      const viewportHeight = canvas.clientHeight;
      const newScale = MOBILE_FOCUS_SCREEN_FONT_PX / MOBILE_FOCUS_WORLD_FONT_PX;
      // 1. Zoom then pan so blob's upper-left (blob.x, blob.y) is at the app's upper-left (with padding)
      const newPanX = MOBILE_FOCUS_HORIZ_PADDING - blob.x * newScale;
      const newPanY = MOBILE_FOCUS_HEADER_PX - blob.y * newScale;
      panRef.current = { x: newPanX, y: newPanY };
      scaleRef.current = newScale;
      setPan({ x: newPanX, y: newPanY });
      setScale(newScale);
      setIsShowingAll(false);
      persistCamera({ panX: newPanX, panY: newPanY, scale: newScale }, { immediate: true });
      // 2. Then resize blob: width to screen, height to fit viewport
      const screenWidthForBlob = viewportWidth - 2 * MOBILE_FOCUS_HORIZ_PADDING;
      const newBlobWidthWorld = Math.max(MIN_BLOB_W, screenWidthForBlob / newScale);
      const effectiveBackerSize =
        preferences.platformMode === "mobile" ? 0 : preferences.blobbyBackerSizePx;
      // In mobile, Blobby sits in the top bar (no extra space); blob gets space below header.
      const availableHeightScreen =
        preferences.platformMode === "mobile"
          ? viewportHeight -
            MOBILE_FOCUS_HEADER_PX -
            2 * MOBILE_FOCUS_VERT_PADDING_PX
          : viewportHeight -
            MOBILE_FOCUS_HEADER_PX -
            2 * MOBILE_FOCUS_VERT_PADDING_PX -
            (MOBILE_FOCUS_BOTTOM_OFFSET_PX + effectiveBackerSize);
      const newBlobHeight = Math.max(MIN_BLOB_H, availableHeightScreen / newScale);
      const bounds = getBlobBounds(blob);
      preMobileFocusBlobRef.current = { blobId, width: bounds.width, height: bounds.height };
      dispatch({
        type: "SET_BLOB_SIZE",
        payload: { id: blobId, width: newBlobWidthWorld, height: newBlobHeight },
      });
    },
    [blobs, dispatch, persistCamera, preferences.platformMode, preferences.blobbyBackerSizePx]
  );

  const prevPlatformModeRef = useRef(preferences.platformMode);
  useEffect(() => {
    const prev = prevPlatformModeRef.current;
    prevPlatformModeRef.current = preferences.platformMode;
    if (prev !== "mobile" || preferences.platformMode !== "desktop" || !preMobileFocusBlobRef.current) return;
    const { blobId, width: storedWidth, height: storedHeight } = preMobileFocusBlobRef.current;
    preMobileFocusBlobRef.current = null;
    dispatch({ type: "SET_BLOB_SIZE", payload: { id: blobId, width: storedWidth, height: storedHeight } });
    const canvas = canvasRef.current;
    if (!canvas) return;
    const runAfterPaint = () => {
      requestAnimationFrame(() => {
        const card = canvas.querySelector<HTMLElement>(`[data-blob-id="${blobId}"]`);
        const contentEl = card?.querySelector<HTMLElement>("[data-testid=\"blob-content\"]");
        if (!contentEl || contentEl.scrollHeight === 0) return;
        const s = scaleRef.current;
        const CARD_PADDING_VERTICAL_PX = 20;
        const contentHeightWorld = (CARD_PADDING_VERTICAL_PX + contentEl.scrollHeight) / s;
        dispatch({
          type: "SET_BLOB_SIZE",
          payload: { id: blobId, width: storedWidth, height: Math.max(MIN_BLOB_H, contentHeightWorld) },
        });
      });
    };
    runAfterPaint();
  }, [preferences.platformMode, dispatch]);

  useEffect(() => {
    const handler = () => zoomToFit();
    window.addEventListener("blob:zoom-to-fit", handler);
    return () => window.removeEventListener("blob:zoom-to-fit", handler);
  }, [zoomToFit]);

  useEffect(() => {
    const handler = () => zoomToSelection();
    window.addEventListener("blob:zoom-to-selection", handler);
    return () => window.removeEventListener("blob:zoom-to-selection", handler);
  }, [zoomToSelection]);

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

  /** When switching to Raw, capture current blob sizes from DOM so they don’t change. */
  const captureBlobSizesBeforeViewChange = useCallback(
    (newView: "raw" | "preview") => {
      if (newView !== "raw") return;
      const canvas = canvasRef.current;
      if (!canvas || scale <= 0) return;
      const cards = canvas.querySelectorAll<HTMLElement>("[data-blob-card][data-blob-id]");
      const blobMap = new Map(blobs.map((b) => [b.id, b]));
      for (const card of cards) {
        const id = card.getAttribute("data-blob-id");
        if (!id) continue;
        const blob = blobMap.get(id);
        if (!blob || blob.locked) continue;
        const inner = card.querySelector<HTMLElement>("[data-blob-card-inner]");
        const r = (inner ?? card).getBoundingClientRect();
        const worldW = Math.max(MIN_BLOB_W, r.width / scale);
        const worldH = Math.max(MIN_BLOB_H, r.height / scale);
        dispatch({ type: "SET_BLOB_SIZE", payload: { id, width: worldW, height: worldH } });
      }
    },
    [blobs, dispatch, scale]
  );

  return (
    <main className={styles.main}>
      <ControlsPortalProvider>
        <PopupPortalProvider>
          <PopupLayerPortal />
          <ControlsOverlayPortal pan={pan} scale={scale} />
        <Header
        hasHiddenBlobs={blobs.some((b) => b.hidden)}
        onUnhideAll={() => dispatch({ type: "UNHIDE_ALL" })}
        hasLockedBlobs={blobs.some((b) => b.locked)}
        onUnlockAll={() => {
          const lockedIds = blobs.filter((b) => b.locked).map((b) => b.id);
          if (lockedIds.length > 0) dispatch({ type: "SET_LOCKED", payload: { ids: lockedIds, locked: false } });
        }}
        onBeforeBlobViewChange={captureBlobSizesBeforeViewChange}
        canSelectAll={visibleBlobs.length > 0 && selectedIds.length < visibleBlobs.length}
        onSelectAll={() => setSelectedIds(visibleBlobs.map((b) => b.id))}
        canDeselectAll={selectedIds.length > 0}
        onDeselectAll={() => setSelectedIds([])}
        canZoomToSelection={selectedIds.length > 0}
        canCleanup={blobs.some((b) => isBlobContentEmpty(b.content))}
        onCleanup={() => {
          const ids = blobs.filter((b) => isBlobContentEmpty(b.content)).map((b) => b.id);
          if (ids.length) dispatch({ type: "DELETE_BLOBS", payload: ids });
        }}
      />
      {preferences.platformMode === "mobile" && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            height: MOBILE_TOP_BAR_HEIGHT_PX,
            background: "#fff",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
      )}
      <div
        ref={canvasRef}
        className={styles.canvas}
        data-testid="canvas"
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
        {draggingBlobId && liveMergeState && (() => {
          const rectA = liveMergeState.boundsA;
          const rectB = liveMergeState.boundsB;
          const targetMidY = rectB.top + rectB.height / 2;
          const insertAtTop =
            preferences.mergingMode === "strict"
              ? (dragCursorRef.current.clientY - pan.y) / scale < targetMidY
              : (rectA.top + rectA.height / 2) < targetMidY;
          const viewport =
            scale > 0 && canvasSize.width > 0 && canvasSize.height > 0
              ? {
                  left: -pan.x / scale,
                  top: -pan.y / scale,
                  width: canvasSize.width / scale,
                  height: canvasSize.height / scale,
                }
              : undefined;
          return (
            <BlobBoundaryOverlay
              rectA={rectA}
              rectB={rectB}
              mergeMarginPx={preferences.mergeMarginPx}
              isVeryClose={mergePossible}
              insertAtTop={insertAtTop}
              viewport={viewport}
            />
          );
        })()}
        {visibleBlobs.map((blob) => (
          <BlobCard
            key={blob.id}
            blob={blob}
            blobMarkdownView={preferences.blobMarkdownView}
            scale={scale}
            pan={pan}
            panRef={panRef}
            scaleRef={scaleRef}
            blobbyBackerSizePx={preferences.platformMode === "mobile" ? Math.round(preferences.blobbyBackerSizePx / 2) : preferences.blobbyBackerSizePx}
            platformMode={preferences.platformMode}
            viewportWorld={
              scale > 0 && canvasSize.width > 0 && canvasSize.height > 0
                ? {
                    left: -pan.x / scale,
                    top: -pan.y / scale,
                    width: canvasSize.width / scale,
                    height: canvasSize.height / scale,
                  }
                : undefined
            }
            isSelected={selectedIds.includes(blob.id)}
            autoFocus={blob.id === focusBlobId}
            onAutoFocusDone={() => {
              setFocusBlobId(null);
              focusedBlobIdRef.current = null;
            }}
            onUpdate={(lines) =>
              dispatch({
                type: "UPDATE_BLOB",
                payload: { id: blob.id, content: linesToMarkdown(lines) },
              })
            }
            onUpdateContent={(content) =>
              dispatch({
                type: "UPDATE_BLOB",
                payload: { id: blob.id, content },
              })
            }
            onPosition={(x, y) =>
              dispatch({
                type: "SET_POSITION",
                payload: { id: blob.id, x, y },
              })
            }
            isPartOfMultiSelection={selectedIds.length > 1 && selectedIds.includes(blob.id)}
            onMoveSelected={handleMoveSelected}
            onFocus={() => {
              focusedBlobIdRef.current = blob.id;
              if (preferences.platformMode === "mobile") handleMobileFocusBlob(blob.id);
              window.dispatchEvent(new CustomEvent("blob:user-action"));
            }}
            onBlur={() => {
              focusedBlobIdRef.current = null;
            }}
            onDuplicate={() => dispatch({ type: "DUPLICATE_BLOB", payload: blob.id })}
            onDelete={() => dispatch({ type: "DELETE_BLOB", payload: blob.id })}
            onHide={() => dispatch({ type: "SET_HIDDEN", payload: { ids: [blob.id], hidden: true } })}
            onLock={() => dispatch({ type: "SET_LOCKED", payload: { ids: [blob.id], locked: true } })}
            onUnlock={() => dispatch({ type: "SET_LOCKED", payload: { ids: [blob.id], locked: false } })}
            onDragStart={handleDragStart}
            onDragPickOffset={handleDragPickOffset}
            onDragEnd={handleDragEnd}
          />
        ))}
        {selectedIds.length > 1 && selectionBounds && (
          <div data-selection-overlay>
            <SelectionOverlay
              bounds={selectionBounds}
              menuRef={selectionMenuRef}
              worldCoordinates
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
              onUnlock={() => {
                dispatch({
                  type: "SET_LOCKED",
                  payload: { ids: selectedIds, locked: false },
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
              onCopyAll={() => {
                const text = selectedIds
                  .map((id) => blobs.find((b) => b.id === id)?.content ?? "")
                  .join("\n\n");
                void navigator.clipboard.writeText(text);
              }}
              onRemoveEmptyLines={() => {
                selectedIds.forEach((id) => {
                  const blob = blobs.find((b) => b.id === id);
                  if (!blob?.locked && blob?.content != null) {
                    const lines = markdownToLines(blob.content);
                    const cleaned = removeEmptyLines(lines);
                    if (cleaned.length !== lines.length) {
                      dispatch({
                        type: "UPDATE_BLOB",
                        payload: { id: blob.id, content: linesToMarkdown(cleaned) },
                      });
                    }
                  }
                });
              }}
              hasEmptyLinesInSelection={selectedIds.some((id) => {
                const blob = blobs.find((b) => b.id === id);
                return blob ? hasEmptyLines(markdownToLines(blob.content ?? "")) : false;
              })}
              allSelectedLocked={
                selectedIds.length > 0 &&
                selectedIds.every(
                  (id) => blobs.find((b) => b.id === id)?.locked
                )
              }
              scale={scale}
              panRef={panRef}
              scaleRef={scaleRef}
              onDragStart={() => {
                const ids = selectedIdsRef.current;
                if (ids.length === 0) return;
                const visible = visibleBlobsRef.current;
                const positions: Record<string, { x: number; y: number }> = {};
                for (const b of visible) {
                  if (ids.includes(b.id) && !b.locked) positions[b.id] = { x: b.x, y: b.y };
                }
                multiDragStartPositionsRef.current = positions;
                multiDragSelectedIdsRef.current = [...ids];
              }}
              onMoveSelected={handleMoveSelected}
              onDragEnd={() => {
                multiDragStartPositionsRef.current = null;
                multiDragSelectedIdsRef.current = null;
              }}
            />
          </div>
        )}
        </div>
      </div>

      <OtherCursors presences={otherPresences} pan={pan} scale={scale} />

      {selectionRect && selectionRect.width > 0 && selectionRect.height > 0 && (
        <SelectionRect
          left={selectionRect.left}
          top={selectionRect.top}
          width={selectionRect.width}
          height={selectionRect.height}
        />
      )}

      {/* Desktop: container with backer + Blobby. Mobile: white top bar (separate div); Blobby only, no backer, sized to bar height. */}
      {(() => {
        const isMobile = preferences.platformMode === "mobile";
        const containerSizePx = isMobile
          ? MOBILE_TOP_BAR_HEIGHT_PX
          : preferences.blobbyBackerSizePx;
        const blobbySizePx = isMobile
          ? MOBILE_TOP_BAR_HEIGHT_PX
          : Math.round((containerSizePx * preferences.blobbySizePercent) / 100);
        return (
          <div
            style={{
              position: "fixed",
              left: "50%",
              ...(isMobile
                ? { top: 0, transform: "translateX(-50%)" }
                : { bottom: BLOBBY_CONTAINER_BOTTOM_PX, transform: "translate(-50%, 50%)" }),
              width: containerSizePx,
              height: containerSizePx,
              zIndex: 2,
            }}
          >
            {isMobile ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "auto",
                  cursor: "pointer",
                }}
                onClick={() => {
                  handleBlobbyTap();
                  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("blobby:tap"));
                }}
                onPointerEnter={handleBlobbyBackerPointerEnter}
                onPointerLeave={handleBlobbyBackerPointerLeave}
                aria-label="Blobby"
              />
            ) : (
              <BlobbyBacker
                onTap={() => {
                  handleBlobbyTap();
                  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("blobby:tap"));
                }}
                onPointerEnter={handleBlobbyBackerPointerEnter}
                onPointerLeave={handleBlobbyBackerPointerLeave}
              />
            )}
            <Blobby summaryLoading={llmLoading} sizePx={blobbySizePx} />
          </div>
        );
      })()}
      {(preferences.blobbyCommenting === "commenting" ||
        llmSummary != null ||
        llmLoading ||
        (showRecalledOutput && (lastBlobbyOutput != null || getLastBlobbyLogEntry(blobbyLog) != null))) && (() => {
        const blobbyContainerSizePx =
          preferences.platformMode === "mobile"
            ? MOBILE_TOP_BAR_HEIGHT_PX
            : preferences.blobbyBackerSizePx;
        const blobbyAtTop = preferences.platformMode === "mobile";
        const blobbyContainerTopPx = blobbyAtTop
          ? 0
          : canvasSize.height - BLOBBY_CONTAINER_BOTTOM_PX - 1.5 * blobbyContainerSizePx;
        return (
          <BlobbyWordBox
            summaryFromTap={llmLoading ? null : (llmSummary ?? (showRecalledOutput ? (lastBlobbyOutput ?? getLastBlobbyLogEntry(blobbyLog)) : null))}
            summaryLoading={llmLoading}
            onMouseOverChange={setIsBlobbyHovered}
            onLeaveAfterAction={() => {
              setShowRecalledOutput(false);
              setLlmSummary(null);
            }}
            showOptionsWithoutHover={showRecalledOutput}
            onMenuOpenChange={setIsBlobbyMenuOpen}
            blobbyContainerTopPx={blobbyContainerTopPx}
            blobbyContainerSizePx={blobbyContainerSizePx}
            blobbyAtTop={blobbyAtTop}
            viewportWidthPx={canvasSize.width}
            viewportHeightPx={canvasSize.height}
          />
        );
      })()}

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
      </PopupPortalProvider>
      </ControlsPortalProvider>
    </main>
  );
}

function PopupLayerPortal() {
  const portal = usePopupPortal();
  if (!portal) return null;
  return (
    <div className={styles.popupLayer} aria-hidden>
      <div ref={portal.setPortalContainer} />
    </div>
  );
}

function ControlsOverlayPortal({ pan, scale }: { pan: { x: number; y: number }; scale: number }) {
  const portal = useControlsPortal();
  if (!portal) return null;
  return (
    <div className={styles.controlsOverlay}>
      <div
        ref={portal.setPortalContainer}
        className={styles.controlsOverlayInner}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: "0 0",
        }}
      />
    </div>
  );
}
