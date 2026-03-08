"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import type { Blob } from "@/lib/types";
import { useBlobsContext } from "@/contexts/BlobsContext";
import styles from "./BlobCard.module.css";

/** Keys that commit one undo step (word boundary): space, punctuation, Enter, or delete-word. */
function isWordBoundaryKey(key: string, ctrlOrMeta: boolean): boolean {
  if (key === " " || key === "Enter") return true;
  if (/^[.,;:!?]$/.test(key)) return true;
  if (key === "Backspace" && ctrlOrMeta) return true;
  return false;
}

const BULLET = "• ";

function getCaretPosition(div: HTMLDivElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(div);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  return preCaretRange.toString().length;
}

function setCaretPosition(div: HTMLDivElement, offset: number) {
  const sel = window.getSelection();
  if (!sel) return;
  let current = 0;
  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent ?? "").length;
      if (current + len >= offset) {
        const range = document.createRange();
        range.setStart(node, Math.min(offset - current, len));
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return true;
      }
      current += len;
      return false;
    }
    for (let i = 0; i < node.childNodes.length; i++) {
      if (walk(node.childNodes[i])) return true;
    }
    return false;
  };
  walk(div);
}

export function BlobCard({
  blob,
  autoFocus,
  onAutoFocusDone,
  onUpdate,
  onPosition,
  onFocus,
  onDuplicate,
  onDelete,
  onLock,
  onUnlock,
  scale = 1,
  isSelected = false,
}: {
  blob: Blob;
  autoFocus?: boolean;
  onAutoFocusDone?: () => void;
  onUpdate: (content: string) => void;
  onPosition: (x: number, y: number) => void;
  onFocus: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onLock: () => void;
  onUnlock: () => void;
  scale?: number;
  isSelected?: boolean;
}) {
  const { pushUndoSnapshot } = useBlobsContext();
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, blobX: 0, blobY: 0 });

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  useEffect(() => {
    const closeMenus = () => setMenuOpen(false);
    window.addEventListener("blob:close-menus", closeMenus);
    return () => window.removeEventListener("blob:close-menus", closeMenus);
  }, []);

  useEffect(() => {
    if (!autoFocus || !contentRef.current) return;
    const el = contentRef.current;
    el.focus();
    const placeCaretAfterBullet = () => {
      if (!el.innerText?.startsWith(BULLET)) return;
      setCaretPosition(el, BULLET.length);
    };
    placeCaretAfterBullet();
    requestAnimationFrame(placeCaretAfterBullet);
    onAutoFocusDone?.();
  }, [autoFocus, onAutoFocusDone]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (blob.locked) return;
      if ((e.target as HTMLElement).closest("[data-drag-handle]")) {
        e.preventDefault();
        setIsDragging(true);
        dragStart.current = {
          x: e.clientX,
          y: e.clientY,
          blobX: blob.x,
          blobY: blob.y,
        };
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      }
    },
    [blob.x, blob.y, blob.locked]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      onPosition(
        dragStart.current.blobX + dx / scale,
        dragStart.current.blobY + dy / scale
      );
    },
    [isDragging, onPosition, scale]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (isDragging) {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
        setIsDragging(false);
      }
    },
    [isDragging]
  );

  const handleInput = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    let text = (el.innerText ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    if (text.length > 0 && !text.startsWith(BULLET)) {
      text = BULLET + text.replace(/^\s*/, "");
      el.innerText = text;
      setCaretPosition(el, text.length);
    }
    onUpdate(text);
  }, [onUpdate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isWordBoundaryKey(e.key, e.ctrlKey || e.metaKey)) {
        pushUndoSnapshot();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const el = contentRef.current;
        if (!el) return;

        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        // Delete any selected text first
        const range = sel.getRangeAt(0);
        range.deleteContents();

        // Insert "\n• " at the caret position directly in the DOM
        const insertText = "\n" + BULLET;
        const textNode = document.createTextNode(insertText);
        range.insertNode(textNode);

        // Move caret to end of the inserted text
        range.setStartAfter(textNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);

        // Normalize so the DOM doesn't have fragmented text nodes that
        // confuse innerText reading later
        el.normalize();

        // Re-read the final text and notify
        const newText = (el.innerText ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        onUpdate(newText);
      }
    },
    [onUpdate, pushUndoSnapshot]
  );

  const handleFocus = useCallback(() => {
    onFocus();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    let text = (el.innerText ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    if (!text) text = BULLET;
    else if (!text.startsWith(BULLET)) text = BULLET + " " + text;
    el.innerText = text;
    onUpdate(text);
  }, [onUpdate]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el || el.innerText) return;
    el.innerText = blob.content || BULLET;
  }, [blob.id]);

  const SCREEN_HANDLE_WIDTH = 24;
  const SCREEN_GAP = 8;
  const invScale = 1 / scale;

  return (
    <div
      ref={cardRef}
      data-blob-card
      data-blob-id={blob.id}
      className={styles.wrapper}
      style={{ left: blob.x, top: blob.y }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Drag handle: absolutely positioned to the left, always a constant screen-pixel gap from the card */}
      <div
        className={styles.controlWrap}
        style={{
          left: -(SCREEN_GAP + SCREEN_HANDLE_WIDTH) / scale,
          transform: `scale(${invScale})`,
          transformOrigin: "100% 0",
          width: SCREEN_HANDLE_WIDTH,
          height: SCREEN_HANDLE_WIDTH,
        }}
      >
        <div
          data-drag-handle
          className={styles.dragHandle}
          aria-hidden
        >
          ⋮⋮
        </div>
      </div>
      <div className={styles.card} data-blob-card-inner data-selected={isSelected || undefined} data-locked={blob.locked || undefined}>
        <div
          ref={contentRef}
          className={styles.content}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        <div
          className={styles.menuWrap}
          ref={menuRef}
          style={{
            transform: `scale(${invScale})`,
            transformOrigin: "100% 0",
          }}
        >
        <button
          type="button"
          className={styles.menuButton}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
          aria-label="Blob options"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          …
        </button>
        {menuOpen && (
          <div className={styles.blobMenu} role="menu">
            <button
              type="button"
              className={styles.blobMenuItem}
              role="menuitem"
              onClick={() => {
                onDuplicate();
                setMenuOpen(false);
              }}
            >
              Duplicate
            </button>
            {blob.locked ? (
              <button
                type="button"
                className={styles.blobMenuItem}
                role="menuitem"
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
                className={styles.blobMenuItem}
                role="menuitem"
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
              className={`${styles.blobMenuItem} ${styles.blobMenuItemDanger}`}
              role="menuitem"
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
