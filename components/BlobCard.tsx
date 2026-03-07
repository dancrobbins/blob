"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import type { Blob } from "@/lib/types";
import styles from "./BlobCard.module.css";

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
  onUpdate,
  onPosition,
  onFocus,
}: {
  blob: Blob;
  onUpdate: (content: string) => void;
  onPosition: (x: number, y: number) => void;
  onFocus: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, blobX: 0, blobY: 0 });

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
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
    [blob.x, blob.y]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      onPosition(dragStart.current.blobX + dx, dragStart.current.blobY + dy);
    },
    [isDragging, onPosition]
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
      if (e.key === "Enter") {
        e.preventDefault();
        const el = contentRef.current;
        if (!el) return;
        const caret = getCaretPosition(el);
        const text = el.innerText ?? "";
        const before = text.slice(0, caret);
        const after = text.slice(caret);
        const newText = before + "\n" + after;
        el.innerText = newText;
        setCaretPosition(el, before.length + 1);
        onUpdate(newText);
      }
    },
    [onUpdate]
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

  return (
    <div
      ref={cardRef}
      data-blob-card
      className={styles.card}
      style={{
        left: blob.x,
        top: blob.y,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div
        data-drag-handle
        className={styles.dragHandle}
        aria-hidden
      >
        ⋮⋮
      </div>
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
    </div>
  );
}
