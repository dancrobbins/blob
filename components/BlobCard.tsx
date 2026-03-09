"use client";

import React, { useRef, useState, useCallback, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import type { Blob, BlobLine, BlobMarkdownView } from "@/lib/types";
import {
  BLOB_CLIPBOARD_MIME,
  linesToHtml,
  parseBlobClipboardData,
  parsePastedContent,
} from "@/lib/blob-lines";
import { markdownToLines, linesToMarkdown } from "@/lib/blob-markdown";
import { useBlobsContext } from "@/contexts/BlobsContext";
import { useControlsPortal } from "@/contexts/ControlsPortalContext";
import { usePopupPortal } from "@/contexts/PopupPortalContext";
import styles from "./BlobCard.module.css";

const BULLET_TEXT = "• ";

/** Keys that commit one undo step (word boundary): space, punctuation, Enter, or delete-word. */
function isWordBoundaryKey(key: string, ctrlOrMeta: boolean): boolean {
  if (key === " " || key === "Enter") return true;
  if (/^[.,;:!?]$/.test(key)) return true;
  if (key === "Backspace" && ctrlOrMeta) return true;
  return false;
}

function readLinesFromContentEl(container: HTMLDivElement): BlobLine[] {
  const lineDivs = container.querySelectorAll<HTMLDivElement>("[data-line-index]");
  if (lineDivs.length === 0) {
    const raw = (container.innerText ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const parsed = raw.split("\n").map((line) => {
      const t = line.trimStart();
      if (t.startsWith(BULLET_TEXT)) return { text: t.slice(BULLET_TEXT.length), style: "bullet" as const };
      return { text: line.replace(/^\s+/, ""), style: "bullet" as const };
    });
    return parsed.length > 0 ? parsed : [{ text: "", style: "bullet" }];
  }
  const lines: BlobLine[] = [];
  lineDivs.forEach((div) => {
    const style = (div.getAttribute("data-style") as BlobLine["style"]) ?? "bullet";
    const bulletSpan = div.querySelector("[data-bullet]");
    const textEl = bulletSpan?.nextElementSibling ?? div;
    const text = (textEl.textContent ?? "").replace(/\u200b/g, "").trimEnd();
    const indentRaw = div.getAttribute("data-indent");
    const indent = indentRaw != null ? Math.max(0, parseInt(indentRaw, 10) || 0) : 0;
    lines.push({
      text,
      style,
      ...(indent > 0 ? { indent } : {}),
      ...(style === "todo" ? { checked: div.getAttribute("data-checked") === "true" } : {}),
      ...(style === "ordered"
        ? { number: Math.max(1, parseInt(div.getAttribute("data-number") ?? "1", 10) || 1) }
        : {}),
    });
  });
  return lines;
}

function buildContentFromLines(container: HTMLDivElement, lines: BlobLine[]) {
  container.innerHTML = "";
  const list = lines.length > 0 ? lines : [{ text: "", style: "bullet" as const }];
  list.forEach((line, i) => {
    const div = document.createElement("div");
    div.className = styles.line;
    div.setAttribute("data-line-index", String(i));
    div.setAttribute("data-style", line.style ?? "bullet");
    const indent = Math.max(0, line.indent ?? 0);
    div.setAttribute("data-indent", String(indent));
    if (line.style === "todo" && line.checked != null) div.setAttribute("data-checked", String(line.checked));
    if (line.style === "ordered" && line.number != null) div.setAttribute("data-number", String(line.number));

    const bullet = document.createElement("span");
    bullet.className = styles.bullet;
    bullet.setAttribute("data-bullet", "");
    bullet.contentEditable = "false";
    bullet.textContent =
      line.style === "ordered"
        ? `${line.number ?? i + 1}. `
        : BULLET_TEXT;

    const textSpan = document.createElement("span");
    textSpan.className = styles.lineText;
    textSpan.textContent = line.text || "\u200b"; // zero-width space so line is focusable when empty

    div.appendChild(bullet);
    div.appendChild(textSpan);
    container.appendChild(div);
  });
}

/** Return true if the selection is collapsed and the caret is "before" the bullet (in the bullet span or at offset 0 of line text). */
function isCaretBeforeBullet(container: HTMLDivElement): boolean {
  const sel = window.getSelection();
  if (!sel || !sel.isCollapsed || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    if (!parent || !container.contains(parent)) return false;
    const lineDiv = parent.closest<HTMLDivElement>("[data-line-index]");
    if (!lineDiv) return false;
    const bulletSpan = lineDiv.querySelector("[data-bullet]");
    if (!bulletSpan) return false;
    if (parent === bulletSpan) return true;
    if (bulletSpan.nextSibling === parent && range.startOffset === 0) return true;
    return false;
  }
  const el = node as HTMLElement;
  if (el.hasAttribute?.("data-bullet")) return true;
  if (container.contains(el)) {
    const lineDiv = el.closest<HTMLDivElement>("[data-line-index]");
    if (!lineDiv) return false;
    const bulletSpan = lineDiv.querySelector("[data-bullet]");
    return bulletSpan?.contains(el) ?? false;
  }
  return false;
}

function getTextOffsetIn(container: Node, target: Node, targetOffset: number): number {
  let offset = 0;
  const walk = (node: Node): boolean => {
    if (node === target) {
      if (node.nodeType === Node.TEXT_NODE) offset += targetOffset;
      else {
        for (let i = 0; i < targetOffset && i < node.childNodes.length; i++) {
          offset += (node.childNodes[i].textContent ?? "").length;
        }
      }
      return true;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      offset += (node.textContent ?? "").length;
      return false;
    }
    for (let i = 0; i < node.childNodes.length; i++) {
      if (walk(node.childNodes[i])) return true;
    }
    return false;
  };
  walk(container);
  return offset;
}

/** Move caret to immediately after the bullet of the first line (or the line containing the current selection). */
function moveCaretAfterBullet(container: HTMLDivElement) {
  const sel = window.getSelection();
  if (!sel) return;
  const lineDiv = container.querySelector<HTMLDivElement>("[data-line-index]");
  if (!lineDiv) return;
  const bulletSpan = lineDiv.querySelector("[data-bullet]");
  const textSpan = bulletSpan?.nextElementSibling ?? lineDiv;
  const target = textSpan.nodeType === Node.TEXT_NODE ? textSpan : textSpan.firstChild ?? textSpan;
  const range = document.createRange();
  range.setStart(target, 0);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Place caret at a given line index and character offset (after DOM rebuild). */
function placeCaretInLine(container: HTMLDivElement, lineIndex: number, offset: number) {
  const lineDiv = container.children[lineIndex] as HTMLDivElement | undefined;
  if (!lineDiv) return;
  const textSpan = lineDiv.querySelector("[data-bullet]")?.nextElementSibling;
  if (!textSpan) return;
  const totalLen = (textSpan.textContent ?? "").length;
  const clampedOffset = Math.min(offset, totalLen);
  let current = 0;
  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent ?? "").length;
      if (current + len >= clampedOffset) {
        const r = document.createRange();
        r.setStart(node, clampedOffset - current);
        r.collapse(true);
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(r);
        }
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
  walk(textSpan);
}

/** Alt/Option only (no Ctrl, Meta, or Shift) — used for move line up/down so it works on Windows. */
function isAltOnly(e: React.KeyboardEvent | KeyboardEvent) {
  return e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;
}

const RAW_INDENT = "  "; // two spaces per indent level in raw markdown

/** Get current line index (0-based) and offset within line from textarea selection. */
function getRawLineInfo(ta: HTMLTextAreaElement): { lineIndex: number; offsetInLine: number } {
  const lines = ta.value.split("\n");
  const start = ta.selectionStart;
  let cum = 0;
  for (let i = 0; i < lines.length; i++) {
    const endOfLine = cum + lines[i].length;
    if (start <= endOfLine) return { lineIndex: i, offsetInLine: start - cum };
    cum = endOfLine + 1; // newline
  }
  return { lineIndex: Math.max(0, lines.length - 1), offsetInLine: lines[lines.length - 1]?.length ?? 0 };
}

/** Move the current line up or down in raw markdown text; update textarea and call onUpdateContent. */
function moveRawLine(ta: HTMLTextAreaElement, direction: "up" | "down", onUpdateContent: (content: string) => void): boolean {
  const lines = ta.value.split("\n");
  const { lineIndex } = getRawLineInfo(ta);
  if (direction === "up" && lineIndex <= 0) return false;
  if (direction === "down" && lineIndex >= lines.length - 1) return false;
  const newLines = [...lines];
  const swapIdx = direction === "up" ? lineIndex - 1 : lineIndex + 1;
  [newLines[lineIndex], newLines[swapIdx]] = [newLines[swapIdx], newLines[lineIndex]];
  const newContent = newLines.join("\n");
  const newLineIndex = direction === "up" ? lineIndex - 1 : lineIndex + 1;
  let newCursor = 0;
  for (let i = 0; i < newLineIndex; i++) newCursor += newLines[i].length + 1;
  newCursor += Math.min(getRawLineInfo(ta).offsetInLine, newLines[newLineIndex].length);
  ta.value = newContent;
  ta.setSelectionRange(newCursor, newCursor);
  onUpdateContent(newContent);
  return true;
}

/** Indent current line in raw markdown by RAW_INDENT. */
function indentRawLine(ta: HTMLTextAreaElement, onUpdateContent: (content: string) => void): boolean {
  const lines = ta.value.split("\n");
  const { lineIndex, offsetInLine } = getRawLineInfo(ta);
  const line = lines[lineIndex];
  const newLine = RAW_INDENT + line;
  lines[lineIndex] = newLine;
  const newContent = lines.join("\n");
  const newCursor = ta.selectionStart + RAW_INDENT.length;
  ta.value = newContent;
  ta.setSelectionRange(newCursor, newCursor);
  onUpdateContent(newContent);
  return true;
}

/** Unindent current line in raw markdown (remove up to RAW_INDENT from start). */
function unindentRawLine(ta: HTMLTextAreaElement, onUpdateContent: (content: string) => void): boolean {
  const lines = ta.value.split("\n");
  const { lineIndex, offsetInLine } = getRawLineInfo(ta);
  const line = lines[lineIndex];
  const toRemove = line.startsWith(RAW_INDENT) ? RAW_INDENT.length : line.match(/^\s*/)?.[0].length ?? 0;
  if (toRemove === 0) return false;
  lines[lineIndex] = line.slice(toRemove);
  const newContent = lines.join("\n");
  const newCursor = Math.max(0, ta.selectionStart - toRemove);
  ta.value = newContent;
  ta.setSelectionRange(newCursor, newCursor);
  onUpdateContent(newContent);
  return true;
}

/** Get current line index and cursor offset in the content container, or null if not in a line. */
function getCurrentLineInfo(container: HTMLDivElement): { currentIndex: number; cursorOffset: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  const startEl: Element | null =
    node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
  const currentLineDiv = startEl?.closest<HTMLDivElement>("[data-line-index]");
  if (!currentLineDiv || currentLineDiv.parentElement !== container) return null;
  const currentIndex = Array.from(container.children).indexOf(currentLineDiv);
  const textSpan = currentLineDiv.querySelector("[data-bullet]")?.nextElementSibling;
  const cursorOffset =
    textSpan && sel.rangeCount
      ? getTextOffsetIn(textSpan, sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset)
      : 0;
  return { currentIndex, cursorOffset };
}

export function BlobCard({
  blob,
  blobMarkdownView = "preview",
  autoFocus,
  onAutoFocusDone,
  onUpdate,
  onUpdateContent,
  onPosition,
  onFocus,
  onDuplicate,
  onDelete,
  onHide,
  onLock,
  onUnlock,
  scale = 1,
  isSelected = false,
}: {
  blob: Blob;
  blobMarkdownView?: BlobMarkdownView;
  autoFocus?: boolean;
  onAutoFocusDone?: () => void;
  onUpdate: (lines: BlobLine[]) => void;
  onUpdateContent?: (content: string) => void;
  onPosition: (x: number, y: number) => void;
  onFocus: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onHide?: () => void;
  onLock: () => void;
  onUnlock: () => void;
  scale?: number;
  isSelected?: boolean;
}) {
  const { pushUndoSnapshot, incrementMenuOpen, decrementMenuOpen, dispatch } = useBlobsContext();
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const rawTextareaRef = useRef<HTMLTextAreaElement>(null);
  /** Content we last sent from this card (typing/paste/blur). Skip rebuilding DOM when blob.content matches so we don't wipe the cursor on every keystroke. */
  const lastDispatchedContentRef = useRef<string>(blob.content ?? "");
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const portaledMenuRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const hoverLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const dragStart = useRef({ x: 0, y: 0, blobX: 0, blobY: 0 });
  const popupPortal = usePopupPortal();

  useLayoutEffect(() => {
    if (!menuOpen) {
      setDropdownPosition(null);
      return;
    }
    const rect = menuButtonRef.current?.getBoundingClientRect();
    if (rect) {
      setDropdownPosition({
        top: rect.bottom + 2,
        left: rect.right,
      });
    }
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      const inButton = menuRef.current?.contains(target);
      const inPortaledMenu = portaledMenuRef.current?.contains(target);
      if (!inButton && !inPortaledMenu) {
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
    if (!menuOpen) return;
    incrementMenuOpen();
    return () => decrementMenuOpen();
  }, [menuOpen, incrementMenuOpen, decrementMenuOpen]);

  const dispatchLines = useCallback(
    (lines: BlobLine[]) => {
      lastDispatchedContentRef.current = linesToMarkdown(lines);
      onUpdate(lines);
    },
    [onUpdate]
  );

  useEffect(() => {
    if (blobMarkdownView !== "preview") return;
    const el = contentRef.current;
    if (!el) return;
    const enforceCaretNotBeforeBullet = () => {
      if (!document.contains(el)) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      if (!el.contains(sel.anchorNode)) return;
      if (isCaretBeforeBullet(el)) moveCaretAfterBullet(el);
    };
    document.addEventListener("selectionchange", enforceCaretNotBeforeBullet);
    return () => document.removeEventListener("selectionchange", enforceCaretNotBeforeBullet);
  }, [blobMarkdownView]);

  // Document-level capture keydown so move line up/down and indent work in both Raw and Preview, and before OS/browser.
  useEffect(() => {
    const onKeyDownCapture = (e: KeyboardEvent) => {
      const card = cardRef.current;
      const nowActive = document.activeElement as HTMLElement | null;
      if (!card?.contains(nowActive)) return;
      const nowRaw = blobMarkdownView === "raw" && nowActive === rawTextareaRef.current;
      const nowPreview = blobMarkdownView === "preview" && nowActive === contentRef.current;
      if (!nowRaw && !nowPreview) return;

      if (nowRaw && rawTextareaRef.current && onUpdateContent) {
        const ta = rawTextareaRef.current;
        const isMoveUp = (e.key === "ArrowUp" || e.key === "Up") && isAltOnly(e);
        const isMoveDown = (e.key === "ArrowDown" || e.key === "Down") && isAltOnly(e);
        if (isMoveUp || isMoveDown) {
          const handled = moveRawLine(ta, isMoveUp ? "up" : "down", onUpdateContent);
          if (handled) {
            e.preventDefault();
            e.stopPropagation();
          }
          return;
        }
        if (e.key === "Tab") {
          e.preventDefault();
          e.stopPropagation();
          if (e.shiftKey) unindentRawLine(ta, onUpdateContent);
          else indentRawLine(ta, onUpdateContent);
          return;
        }
      }

      if (nowPreview && contentRef.current) {
        const el = contentRef.current;
        const isMoveUp = (e.key === "ArrowUp" || e.key === "Up") && isAltOnly(e);
        const isMoveDown = (e.key === "ArrowDown" || e.key === "Down") && isAltOnly(e);
        if (isMoveUp || isMoveDown) {
          const info = getCurrentLineInfo(el);
          if (!info) return;
          const { currentIndex, cursorOffset } = info;
          if (isMoveUp && currentIndex > 0) {
            e.preventDefault();
            e.stopPropagation();
            const lines = readLinesFromContentEl(el);
            const swapped = [...lines];
            [swapped[currentIndex - 1], swapped[currentIndex]] = [swapped[currentIndex], swapped[currentIndex - 1]];
            buildContentFromLines(el, swapped);
            placeCaretInLine(el, currentIndex - 1, cursorOffset);
            dispatchLines(readLinesFromContentEl(el));
          } else if (isMoveDown && currentIndex < el.children.length - 1) {
            e.preventDefault();
            e.stopPropagation();
            const lines = readLinesFromContentEl(el);
            const swapped = [...lines];
            [swapped[currentIndex], swapped[currentIndex + 1]] = [swapped[currentIndex + 1], swapped[currentIndex]];
            buildContentFromLines(el, swapped);
            placeCaretInLine(el, currentIndex + 1, cursorOffset);
            dispatchLines(readLinesFromContentEl(el));
          }
        }
      }
    };
    document.addEventListener("keydown", onKeyDownCapture, true);
    return () => document.removeEventListener("keydown", onKeyDownCapture, true);
  }, [blobMarkdownView, dispatchLines, onUpdateContent]);

  useEffect(() => {
    if (!autoFocus || !contentRef.current) return;
    const el = contentRef.current;
    el.focus();
    const placeCaretAfterBullet = () => moveCaretAfterBullet(el);
    placeCaretAfterBullet();
    requestAnimationFrame(placeCaretAfterBullet);
    onAutoFocusDone?.();
  }, [autoFocus, onAutoFocusDone]);

  const handleMouseEnter = useCallback(() => {
    if (hoverLeaveTimer.current) clearTimeout(hoverLeaveTimer.current);
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    hoverLeaveTimer.current = setTimeout(() => setIsHovered(false), 80);
  }, []);

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
    if (blob.locked) return;
    const el = contentRef.current;
    if (!el) return;
    const lines = readLinesFromContentEl(el);
    dispatchLines(lines);
  }, [blob.locked, dispatchLines]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (blob.locked) return;
      const el = contentRef.current;
      if (!el) return;

      if (e.key === "ArrowLeft") {
        if (isCaretBeforeBullet(el)) {
          e.preventDefault();
          moveCaretAfterBullet(el);
        }
        return;
      }

      const lineInfo = getCurrentLineInfo(el);
      const currentIndex = lineInfo?.currentIndex ?? -1;
      const cursorOffset = lineInfo?.cursorOffset ?? 0;

      if (e.key === "Backspace") {
        const sel = window.getSelection();
        if (sel?.rangeCount && sel.isCollapsed && currentIndex >= 0) {
          const lines = readLinesFromContentEl(el);
          const currentLineText = (lines[currentIndex]?.text ?? "").replace(/\u200b/g, "").trim();
          const lineIsEmpty = currentLineText.length === 0;
          if (lineIsEmpty && cursorOffset === 0) {
            e.preventDefault();
            if (lines.length <= 1) {
              moveCaretAfterBullet(el);
            } else {
              const newLines = lines.filter((_, i) => i !== currentIndex);
              const prevLineLength = (lines[currentIndex - 1]?.text ?? "").length;
              const targetLineIndex = currentIndex - 1;
              buildContentFromLines(el, newLines);
              dispatchLines(readLinesFromContentEl(el));
              requestAnimationFrame(() => {
                const container = contentRef.current;
                if (container && document.contains(container)) {
                  placeCaretInLine(container, targetLineIndex, prevLineLength);
                }
              });
            }
            return;
          }
        }
      }

      const isMoveUp = (e.key === "ArrowUp" || e.key === "Up") && isAltOnly(e);
      const isMoveDown = (e.key === "ArrowDown" || e.key === "Down") && isAltOnly(e);
      if (isMoveUp && currentIndex > 0) {
        e.preventDefault();
        e.stopPropagation();
        const lines = readLinesFromContentEl(el);
        const swapped = [...lines];
        [swapped[currentIndex - 1], swapped[currentIndex]] = [swapped[currentIndex], swapped[currentIndex - 1]];
        buildContentFromLines(el, swapped);
        placeCaretInLine(el, currentIndex - 1, cursorOffset);
        dispatchLines(readLinesFromContentEl(el));
        return;
      }
      if (isMoveDown && currentIndex >= 0 && currentIndex < el.children.length - 1) {
        e.preventDefault();
        e.stopPropagation();
        const lines = readLinesFromContentEl(el);
        const swapped = [...lines];
        [swapped[currentIndex], swapped[currentIndex + 1]] = [swapped[currentIndex + 1], swapped[currentIndex]];
        buildContentFromLines(el, swapped);
        placeCaretInLine(el, currentIndex + 1, cursorOffset);
        dispatchLines(readLinesFromContentEl(el));
        return;
      }
      if (e.key === "Tab") {
        if (currentIndex < 0) return;
        e.preventDefault();
        const lines = readLinesFromContentEl(el);
        const line = lines[currentIndex];
        if (e.shiftKey) {
          const currentIndent = line.indent ?? 0;
          if (currentIndent === 0) return;
          const nextIndent = currentIndent - 1;
          const updated = [...lines];
          updated[currentIndex] = { ...line, indent: nextIndent > 0 ? nextIndent : undefined };
          buildContentFromLines(el, updated);
          placeCaretInLine(el, currentIndex, cursorOffset);
          dispatchLines(readLinesFromContentEl(el));
        } else {
          const nextIndent = (line.indent ?? 0) + 1;
          const updated = [...lines];
          updated[currentIndex] = { ...line, indent: nextIndent };
          buildContentFromLines(el, updated);
          placeCaretInLine(el, currentIndex, cursorOffset);
          dispatchLines(readLinesFromContentEl(el));
        }
        return;
      }

      if (isWordBoundaryKey(e.key, e.ctrlKey || e.metaKey)) {
        pushUndoSnapshot();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        const range = sel.getRangeAt(0);
        range.deleteContents();

        const startEl: Element | null =
          range.startContainer.nodeType === Node.TEXT_NODE
            ? range.startContainer.parentElement
            : (range.startContainer as Element);
        const lineDiv = startEl?.closest<HTMLDivElement>("[data-line-index]");
        if (!lineDiv || lineDiv.parentElement !== el) return;

        const bulletSpan = lineDiv.querySelector("[data-bullet]");
        const textSpan = bulletSpan?.nextElementSibling;
        const style = (lineDiv.getAttribute("data-style") as BlobLine["style"]) ?? "bullet";
        const indentRaw = lineDiv.getAttribute("data-indent");
        const indent = indentRaw != null ? Math.max(0, parseInt(indentRaw, 10) || 0) : 0;

        const newLineDiv = document.createElement("div");
        newLineDiv.className = styles.line;
        newLineDiv.setAttribute("data-line-index", String(el.children.length));
        newLineDiv.setAttribute("data-style", style);
        newLineDiv.setAttribute("data-indent", String(indent));
        const newBullet = document.createElement("span");
        newBullet.className = styles.bullet;
        newBullet.setAttribute("data-bullet", "");
        newBullet.contentEditable = "false";
        newBullet.textContent = BULLET_TEXT;
        const newTextSpan = document.createElement("span");
        newTextSpan.className = styles.lineText;
        newTextSpan.textContent = "\u200b";
        newLineDiv.appendChild(newBullet);
        newLineDiv.appendChild(newTextSpan);

        const nextLine = lineDiv.nextElementSibling;
        if (nextLine) el.insertBefore(newLineDiv, nextLine);
        else el.appendChild(newLineDiv);

        const r = document.createRange();
        r.setStart(newTextSpan, 0);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);

        const lines = readLinesFromContentEl(el);
        dispatchLines(lines);
      }
    },
    [blob.locked, dispatchLines, pushUndoSnapshot]
  );

  const handleFocus = useCallback(() => {
    onFocus();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    if (blob.locked) return;
    const el = contentRef.current;
    if (!el) return;
    let lines = readLinesFromContentEl(el);
    if (lines.length === 0 || lines.every((l) => !l.text.trim())) {
      lines = [{ text: "", style: "bullet" }];
      buildContentFromLines(el, lines);
    }
    dispatchLines(lines);
  }, [blob.locked, dispatchLines]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (blob.locked) {
        e.preventDefault();
        return;
      }
      const el = contentRef.current;
      if (!el) return;
      const html = e.clipboardData.getData("text/html");
      const text = e.clipboardData.getData("text/plain");
      const blobData = e.clipboardData.getData(BLOB_CLIPBOARD_MIME);
      let pasted: BlobLine[];
      if (blobData) {
        const parsed = parseBlobClipboardData(blobData);
        pasted = parsed ?? markdownToLines(blobData);
      } else {
        pasted = parsePastedContent(html || null, text);
      }
      if (pasted.length === 0) return;
      e.preventDefault();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const startEl: Element | null =
        range.startContainer.nodeType === Node.TEXT_NODE
          ? range.startContainer.parentElement
          : (range.startContainer as Element);
      const lineDiv = startEl?.closest<HTMLDivElement>("[data-line-index]");
      if (!lineDiv || lineDiv.parentElement !== el) return;
      const insertAtLineIndex = Array.from(el.children).indexOf(lineDiv);
      const textSpan = lineDiv.querySelector("[data-bullet]")?.nextElementSibling;
      const cursorOffset =
        textSpan && range.startContainer === textSpan
          ? range.startOffset
          : textSpan?.contains(range.startContainer)
            ? getTextOffsetIn(textSpan, range.startContainer, range.startOffset)
            : 0;
      range.deleteContents();
      const existingLines = readLinesFromContentEl(el);
      const current = existingLines[insertAtLineIndex] ?? { text: "", style: "bullet" as const };
      const lineStart = current.text.slice(0, cursorOffset);
      const lineEnd = current.text.slice(cursorOffset);
      const newLines: BlobLine[] = [
        ...existingLines.slice(0, insertAtLineIndex),
        { text: lineStart + (pasted[0]?.text ?? ""), style: current.style ?? "bullet" },
        ...pasted.slice(1).map((l) => ({ ...l, style: (l.style ?? "bullet") as BlobLine["style"] })),
        ...(lineEnd ? [{ text: lineEnd, style: "bullet" as const }] : []),
        ...existingLines.slice(insertAtLineIndex + 1),
      ];
      buildContentFromLines(el, newLines);
      const lastPastedLineIndex = insertAtLineIndex + pasted.length - 1;
      const newLineDiv = el.children[lastPastedLineIndex + (lineEnd ? 1 : 0)] as HTMLDivElement | undefined;
      const newTextSpan = newLineDiv?.querySelector("[data-bullet]")?.nextElementSibling;
      const node = newTextSpan?.firstChild ?? newTextSpan;
      if (node) {
        const len = (pasted[pasted.length - 1]?.text ?? "").length;
        const r = document.createRange();
        r.setStart(node, Math.min(len, (node.textContent ?? "").length));
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
      }
      dispatchLines(readLinesFromContentEl(el));
    },
    [blob.locked, dispatchLines]
  );

  const handleCopy = useCallback(
    (e: React.ClipboardEvent) => {
      const el = contentRef.current;
      if (!el) return;
      const lines = readLinesFromContentEl(el);
      const md = linesToMarkdown(lines);
      e.clipboardData.setData(BLOB_CLIPBOARD_MIME, md);
      e.clipboardData.setData("text/plain", md);
      e.clipboardData.setData("text/html", linesToHtml(lines));
    },
    []
  );

  useLayoutEffect(() => {
    if (blobMarkdownView !== "preview") return;
    const el = contentRef.current;
    if (!el) return;
    const content = blob.content ?? "";
    if (content === lastDispatchedContentRef.current && el.children.length > 0) return;
    lastDispatchedContentRef.current = content;
    const lines = markdownToLines(content);
    const list = lines.length > 0 ? lines : [{ text: "", style: "bullet" as const }];
    buildContentFromLines(el, list);
  }, [blob.id, blob.content, blobMarkdownView]);

  useEffect(() => {
    if (blobMarkdownView === "raw" && autoFocus && rawTextareaRef.current) {
      rawTextareaRef.current.focus();
      onAutoFocusDone?.();
    }
  }, [blobMarkdownView, autoFocus, onAutoFocusDone]);

  const SCREEN_HANDLE_WIDTH = 24;
  const SCREEN_GAP = 8;
  const CONTROLS_COLUMN_WIDTH = 28;
  const invScale = 1 / scale;

  const portal = useControlsPortal();

  const blobMenuItems = (
    <>
      <button
        type="button"
        className={styles.blobMenuItem}
        role="menuitem"
        data-testid="blob-menu-duplicate"
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
          data-testid="blob-menu-unlock"
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
          data-testid="blob-menu-lock"
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
        className={styles.blobMenuItem}
        role="menuitem"
        data-testid="blob-menu-hide"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dispatch({ type: "SET_HIDDEN", payload: { ids: [blob.id], hidden: true } });
          setMenuOpen(false);
        }}
      >
        Hide
      </button>
      <button
        type="button"
        className={`${styles.blobMenuItem} ${styles.blobMenuItemDanger}`}
        role="menuitem"
        data-testid="blob-menu-delete"
        onClick={() => {
          onDelete();
          setMenuOpen(false);
        }}
      >
        Delete
      </button>
    </>
  );

  const controlsFragment = (
    <div
      className={styles.wrapper}
      data-blob-controls
      data-dragging={isDragging ? "" : undefined}
      data-hovered={isHovered ? "" : undefined}
      style={{ left: blob.x, top: blob.y }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={styles.controlsColumn}
        style={{
          left: -(SCREEN_GAP + CONTROLS_COLUMN_WIDTH) / scale,
          transform: `scale(${invScale})`,
          transformOrigin: "100% 0",
        }}
      >
        <div className={styles.controlsColumnHitArea} aria-hidden />
        <div className={styles.controlWrap}>
          <div
            data-drag-handle
            className={styles.dragHandle}
            aria-hidden
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            ⋮⋮
          </div>
        </div>
        <div className={styles.menuWrap} ref={menuRef}>
        <button
          ref={menuButtonRef}
          type="button"
          className={styles.menuButton}
          data-testid="blob-options"
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
        {menuOpen && !(popupPortal?.portalReady && popupPortal.portalRef.current) && (
          <div className={styles.blobMenu} role="menu">
            {blobMenuItems}
          </div>
        )}
        </div>
      </div>
    </div>
  );

  const cardBody = (
    <div
      ref={cardRef}
      data-blob-card
      data-blob-id={blob.id}
      data-testid="blob-card"
      className={styles.cardBodyWrapper}
      style={{ left: blob.x, top: blob.y }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={styles.card}
        data-blob-card-inner
        data-selected={isSelected || undefined}
        data-locked={blob.locked || undefined}
      >
        {blobMarkdownView === "raw" ? (
          <textarea
            ref={rawTextareaRef}
            className={styles.contentRaw}
            data-testid="blob-content"
            value={blob.content ?? ""}
            onChange={(e) => onUpdateContent?.(e.target.value)}
            onFocus={(e) => {
              handleFocus();
              if (!blob.locked) pushUndoSnapshot();
            }}
            readOnly={!!blob.locked}
            aria-label="Blob content"
            data-locked={blob.locked || undefined}
          />
        ) : (
          <div
            ref={contentRef}
            className={styles.content}
            contentEditable={!blob.locked}
            data-locked={blob.locked || undefined}
            suppressContentEditableWarning
            data-testid="blob-content"
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onPaste={handlePaste}
            onCopy={handleCopy}
          />
        )}
      </div>
    </div>
  );

  const portaledDropdown =
    menuOpen &&
    dropdownPosition &&
    popupPortal?.portalReady &&
    popupPortal.portalRef.current &&
    createPortal(
      <div
        ref={portaledMenuRef}
        className={styles.blobMenu}
        role="menu"
        style={{
          position: "fixed",
          top: dropdownPosition.top,
          left: dropdownPosition.left,
          width: "max-content",
          transform: "translateX(-100%)",
        }}
      >
        {blobMenuItems}
      </div>,
      popupPortal.portalRef.current
    );

  if (portal?.portalReady && portal.portalRef.current) {
    return (
      <>
        {cardBody}
        {createPortal(controlsFragment, portal.portalRef.current)}
        {portaledDropdown}
      </>
    );
  }

  return (
    <>
      <div
        ref={cardRef}
        data-blob-card
        data-blob-id={blob.id}
        data-testid="blob-card"
        data-dragging={isDragging ? "" : undefined}
        data-hovered={isHovered ? "" : undefined}
        className={styles.wrapper}
        style={{ left: blob.x, top: blob.y }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className={styles.controlsColumn}
          style={{
            left: -(SCREEN_GAP + CONTROLS_COLUMN_WIDTH) / scale,
            transform: `scale(${invScale})`,
            transformOrigin: "100% 0",
          }}
        >
          <div className={styles.controlsColumnHitArea} aria-hidden />
          <div className={styles.controlWrap}>
            <div data-drag-handle className={styles.dragHandle} aria-hidden>
              ⋮⋮
            </div>
          </div>
          <div className={styles.menuWrap} ref={menuRef}>
            <button
              ref={menuButtonRef}
              type="button"
              className={styles.menuButton}
              data-testid="blob-options"
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
            {menuOpen && !(popupPortal?.portalReady && popupPortal.portalRef.current) && (
              <div className={styles.blobMenu} role="menu">
                {blobMenuItems}
              </div>
            )}
          </div>
        </div>
        <div
          className={styles.card}
          data-blob-card-inner
          data-selected={isSelected || undefined}
          data-locked={blob.locked || undefined}
        >
          {blobMarkdownView === "raw" ? (
            <textarea
              ref={rawTextareaRef}
              className={styles.contentRaw}
              data-testid="blob-content"
              value={blob.content ?? ""}
              onChange={(e) => onUpdateContent?.(e.target.value)}
              onFocus={(e) => {
                handleFocus();
                if (!blob.locked) pushUndoSnapshot();
              }}
              readOnly={!!blob.locked}
              aria-label="Blob content"
              data-locked={blob.locked || undefined}
            />
          ) : (
            <div
              ref={contentRef}
              className={styles.content}
              contentEditable={!blob.locked}
              data-locked={blob.locked || undefined}
              suppressContentEditableWarning
              data-testid="blob-content"
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onPaste={handlePaste}
              onCopy={handleCopy}
            />
          )}
        </div>
      </div>
      {portaledDropdown}
    </>
  );
}
