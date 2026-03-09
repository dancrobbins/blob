"use client";

import React, { useRef, useState, useCallback, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import type { Blob, BlobLine, BlobMarkdownView } from "@/lib/types";
import { DEFAULT_BLOB_W, DEFAULT_BLOB_H } from "@/lib/blob-constants";
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
import {
  BLOB_CLOSE_MENUS_EVENT,
  dispatchCloseMenus,
  type BlobCloseMenusDetail,
} from "@/lib/menu-close-event";
import styles from "./BlobCard.module.css";

const BULLET_TEXT = "• ";

/** Match markdown link [text](url). Captures: group 1 = link text, group 2 = url. */
const MARKDOWN_LINK_REGEX = /\[([^\]]*)\]\(([^)]+)\)/g;

type LineSegment = { type: "text"; value: string } | { type: "link"; text: string; url: string };

function parseLineToSegments(lineText: string): LineSegment[] {
  const segments: LineSegment[] = [];
  let lastIndex = 0;
  const re = new RegExp(MARKDOWN_LINK_REGEX.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(lineText)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ type: "text", value: lineText.slice(lastIndex, m.index) });
    }
    segments.push({ type: "link", text: m[1], url: m[2] });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < lineText.length) {
    segments.push({ type: "text", value: lineText.slice(lastIndex) });
  }
  if (segments.length === 0 && lineText.length > 0) return [{ type: "text", value: lineText }];
  return segments;
}

/** Serialize a line's DOM content (text nodes + <a>) back to markdown so links round-trip. */
function serializeLineContentToMarkdown(el: Element): string {
  let s = "";
  for (const node of el.childNodes) {
    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === "A") {
      const a = node as HTMLAnchorElement;
      const href = a.getAttribute("href");
      if (href) s += `[${a.textContent ?? ""}](${href})`;
      else s += a.textContent ?? "";
    } else {
      s += node.textContent ?? "";
    }
  }
  return s.replace(/\u200b/g, "").trimEnd();
}

/** Clamp value to [min, max]. */
function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

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
    const text = textEl ? serializeLineContentToMarkdown(textEl) : "";
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
    const segments = parseLineToSegments(line.text ?? "");
    if (segments.length === 0) {
      textSpan.textContent = line.text || "\u200b"; // zero-width space so line is focusable when empty
    } else {
      const hasLink = segments.some((s) => s.type === "link");
      if (!hasLink) {
        textSpan.textContent = line.text || "\u200b";
      } else {
        for (const seg of segments) {
          if (seg.type === "text") {
            textSpan.appendChild(document.createTextNode(seg.value));
          } else {
            const a = document.createElement("a");
            a.href = seg.url;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.textContent = seg.text;
            textSpan.appendChild(a);
          }
        }
      }
    }

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

/** Move caret to immediately after the bullet of the line containing the current selection (so we don't jump to line 0). */
function moveCaretAfterBullet(container: HTMLDivElement) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const node = sel.anchorNode;
  const startEl: Element | null =
    node?.nodeType === Node.TEXT_NODE ? (node as Text).parentElement : (node as Element) ?? null;
  const lineDiv = startEl?.closest<HTMLDivElement>("[data-line-index]");
  const useLineDiv = lineDiv && lineDiv.parentElement === container ? lineDiv : container.querySelector<HTMLDivElement>("[data-line-index]");
  if (!useLineDiv) return;
  const bulletSpan = useLineDiv.querySelector("[data-bullet]");
  const textSpan = bulletSpan?.nextElementSibling ?? useLineDiv;
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

/**
 * Ctrl+↑/↓ (both Windows and Mac) — used for move line up/down.
 * This is the one modifier+arrow combo with no OS/browser/Electron intercept:
 *  - Alt key triggers Windows menu bar / Electron accelerators → arrow never arrives.
 *  - Ctrl+Alt is intercepted by Intel/AMD graphics drivers (display rotation).
 *  - Alt+Shift triggers Windows keyboard language switcher.
 *  - Ctrl+Shift+Arrow extends text selection (undesirable as a move shortcut).
 *  - Ctrl+↑/↓ inside a focused text field is not claimed by any OS or browser.
 * We use plain Ctrl on both platforms (not Cmd on Mac) because Cmd+↑/↓ on Mac
 * is taken by the system to jump to start/end of document.
 */
function isMoveMod(e: React.KeyboardEvent | KeyboardEvent) {
  return e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey;
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
  onDragStart: onDragStartProp,
  onDragEnd: onDragEndProp,
  scale = 1,
  pan = { x: 0, y: 0 },
  blobbyBackerSizePx = 200,
  isSelected = false,
  isPartOfMultiSelection = false,
  onMoveSelected,
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
  onDragStart?: (blobId: string) => void;
  onDragEnd?: (blobId: string) => void;
  scale?: number;
  /** For clamping controls to viewport and avoiding blobby. */
  pan?: { x: number; y: number };
  /** Blobby backer size in px (for avoiding that region when positioning controls). */
  blobbyBackerSizePx?: number;
  isSelected?: boolean;
  /** When true, dragging this blob's handle moves all selected blobs by the same delta. */
  isPartOfMultiSelection?: boolean;
  onMoveSelected?: (dx: number, dy: number) => void;
}) {
  const { pushUndoSnapshot, incrementMenuOpen, decrementMenuOpen, dispatch } = useBlobsContext();
  const cardRef = useRef<HTMLDivElement>(null);
  const cardInnerRef = useRef<HTMLDivElement>(null);
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
  const [dropdownAdjust, setDropdownAdjust] = useState({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0, blobX: 0, blobY: 0 });
  const popupPortal = usePopupPortal();

  const LINK_PREVIEW_HOVER_MS = 3000;
  const linkPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const linkPreviewAnchorRef = useRef<{ url: string; anchorRect: DOMRect } | null>(null);
  const linkPreviewContainerRef = useRef<HTMLDivElement | null>(null);
  const [linkPreview, setLinkPreview] = useState<{
    url: string;
    imageUrl: string | null;
    title: string | null;
    anchorRect: { top: number; left: number; bottom: number; right: number };
  } | null>(null);
  const [linkPreviewPosition, setLinkPreviewPosition] = useState({ top: 0, left: 0 });

  const MIN_BLOB_W = 120;
  const MIN_BLOB_H = 80;
  const EDGE_THRESHOLD_SCREEN_W = 100;
  const EDGE_THRESHOLD_SCREEN_H = 60;

  const [resizingEdge, setResizingEdge] = useState<"n" | "e" | "s" | "w" | null>(null);
  const [resizeOverlay, setResizeOverlay] = useState<{ width: number; height: number; x: number; y: number } | null>(null);
  const resizeStartRef = useRef<{
    edge: "n" | "e" | "s" | "w";
    startWidth: number;
    startHeight: number;
    startX: number;
    startY: number;
    startBlobX: number;
    startBlobY: number;
  } | null>(null);
  const resizeOverlayRef = useRef<{ width: number; height: number; x: number; y: number } | null>(null);
  const measureWrapRef = useRef<HTMLDivElement>(null);
  const measureContentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!menuOpen) {
      setDropdownPosition(null);
      setDropdownAdjust({ x: 0, y: 0 });
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

  /** Keep popup menu fully on screen; move the shortest distance necessary. */
  const POPUP_PAD = 8;
  useLayoutEffect(() => {
    if (!menuOpen || !dropdownPosition) return;
    const run = () => {
      const menu = portaledMenuRef.current;
      if (!menu) return;
      const r = menu.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const adjX = clamp(POPUP_PAD - r.left, 0, vw - POPUP_PAD - r.right);
      const adjY = clamp(POPUP_PAD - r.top, 0, vh - POPUP_PAD - r.bottom);
      setDropdownAdjust((prev) =>
        prev.x === adjX && prev.y === adjY ? prev : { x: adjX, y: adjY }
      );
    };
    if (portaledMenuRef.current) {
      run();
    } else {
      const raf = requestAnimationFrame(run);
      return () => cancelAnimationFrame(raf);
    }
  }, [menuOpen, dropdownPosition]);

  const handleContentMouseOver = useCallback(
    (e: React.MouseEvent) => {
      if (blobMarkdownView !== "preview") return;
      const a = (e.target as Element).closest?.("a");
      if (!a || !contentRef.current?.contains(a) || !(a instanceof HTMLAnchorElement)) return;
      const href = a.href;
      if (!href || (!href.startsWith("http://") && !href.startsWith("https://"))) return;
      const rect = a.getBoundingClientRect();
      if (linkPreviewTimerRef.current) clearTimeout(linkPreviewTimerRef.current);
      linkPreviewAnchorRef.current = { url: href, anchorRect: rect };
      linkPreviewTimerRef.current = setTimeout(() => {
        linkPreviewTimerRef.current = null;
        const anchor = linkPreviewAnchorRef.current;
        if (!anchor) return;
        fetch(`/api/link-preview?url=${encodeURIComponent(anchor.url)}`)
          .then((r) => (r.ok ? r.json() : { imageUrl: null, title: null }))
          .then((data: { imageUrl?: string | null; title?: string | null }) => {
            setLinkPreview({
              url: anchor.url,
              imageUrl: data.imageUrl ?? null,
              title: data.title ?? null,
              anchorRect: {
                top: anchor.anchorRect.top,
                left: anchor.anchorRect.left,
                bottom: anchor.anchorRect.bottom,
                right: anchor.anchorRect.right,
              },
            });
          })
          .catch(() => {
            setLinkPreview({
              url: anchor.url,
              imageUrl: null,
              title: null,
              anchorRect: {
                top: anchor.anchorRect.top,
                left: anchor.anchorRect.left,
                bottom: anchor.anchorRect.bottom,
                right: anchor.anchorRect.right,
              },
            });
          });
      }, LINK_PREVIEW_HOVER_MS);
    },
    [blobMarkdownView]
  );

  const handleContentMouseOut = useCallback(
    (e: React.MouseEvent) => {
      const related = e.relatedTarget as Node | null;
      const enteringPreview = related && linkPreviewContainerRef.current?.contains(related);
      if (enteringPreview) return;
      if (linkPreviewTimerRef.current) {
        clearTimeout(linkPreviewTimerRef.current);
        linkPreviewTimerRef.current = null;
      }
      linkPreviewAnchorRef.current = null;
      // Do not hide the preview here so the user can mouse from the link onto the thumbnail
      // without it disappearing. Preview closes on its own onMouseLeave or document click.
    },
    []
  );

  useEffect(() => {
    return () => {
      if (linkPreviewTimerRef.current) clearTimeout(linkPreviewTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (blobMarkdownView !== "preview") setLinkPreview(null);
  }, [blobMarkdownView]);

  const LINK_PREVIEW_W = 280;
  const LINK_PREVIEW_H = 160;
  const LINK_PREVIEW_GAP = 8;
  const LINK_PREVIEW_HIT_PAD = 16;
  useLayoutEffect(() => {
    if (!linkPreview) return;
    const { anchorRect } = linkPreview;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = anchorRect.bottom + LINK_PREVIEW_GAP;
    let left = anchorRect.left;
    const pad = POPUP_PAD;
    if (left + LINK_PREVIEW_W > vw - pad) left = vw - pad - LINK_PREVIEW_W;
    if (left < pad) left = pad;
    if (top + LINK_PREVIEW_H > vh - pad) {
      top = anchorRect.top - LINK_PREVIEW_H - LINK_PREVIEW_GAP;
      if (top < pad) top = pad;
    }
    if (top < pad) top = pad;
    setLinkPreviewPosition({ top, left });
  }, [linkPreview]);

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
    if (!linkPreview) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      const inPreview = linkPreviewContainerRef.current?.contains(target);
      if (!inPreview) setLinkPreview(null);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [linkPreview]);

  useEffect(() => {
    const closeMenus = (e: Event) => {
      const d = (e as CustomEvent<BlobCloseMenusDetail>).detail;
      if (d?.exceptBlobMenu === blob.id) return;
      setMenuOpen(false);
    };
    window.addEventListener(BLOB_CLOSE_MENUS_EVENT, closeMenus);
    return () => window.removeEventListener(BLOB_CLOSE_MENUS_EVENT, closeMenus);
  }, [blob.id]);

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
        const isMoveUp = (e.key === "ArrowUp" || e.key === "Up") && isMoveMod(e);
        const isMoveDown = (e.key === "ArrowDown" || e.key === "Down") && isMoveMod(e);
        if (isMoveUp || isMoveDown) {
          pushUndoSnapshot();
          const handled = moveRawLine(ta, isMoveUp ? "up" : "down", onUpdateContent);
          if (handled) {
            e.preventDefault();
            e.stopPropagation();
          }
          return;
        }
        if (e.key === "Tab") {
          pushUndoSnapshot();
          e.preventDefault();
          e.stopPropagation();
          if (e.shiftKey) unindentRawLine(ta, onUpdateContent);
          else indentRawLine(ta, onUpdateContent);
          return;
        }
      }

      if (nowPreview && contentRef.current) {
        const el = contentRef.current;
        const isMoveUp = (e.key === "ArrowUp" || e.key === "Up") && isMoveMod(e);
        const isMoveDown = (e.key === "ArrowDown" || e.key === "Down") && isMoveMod(e);
        if (isMoveUp || isMoveDown) {
          const info = getCurrentLineInfo(el);
          if (!info) return;
          const { currentIndex, cursorOffset } = info;
          if (isMoveUp && currentIndex > 0) {
            pushUndoSnapshot();
            e.preventDefault();
            e.stopPropagation();
            const lines = readLinesFromContentEl(el);
            const swapped = [...lines];
            [swapped[currentIndex - 1], swapped[currentIndex]] = [swapped[currentIndex], swapped[currentIndex - 1]];
            buildContentFromLines(el, swapped);
            placeCaretInLine(el, currentIndex - 1, cursorOffset);
            dispatchLines(readLinesFromContentEl(el));
          } else if (isMoveDown && currentIndex < el.children.length - 1) {
            pushUndoSnapshot();
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
  }, [blobMarkdownView, dispatchLines, onUpdateContent, pushUndoSnapshot]);

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
    hoverLeaveTimer.current = setTimeout(() => setIsHovered(false), 120);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (blob.locked) return;
      if ((e.target as HTMLElement).closest("[data-drag-handle]")) {
        e.preventDefault();
        dispatchCloseMenus();
        setIsDragging(true);
        onDragStartProp?.(blob.id);
        dragStart.current = {
          x: e.clientX,
          y: e.clientY,
          blobX: blob.x,
          blobY: blob.y,
        };
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      }
    },
    [blob.id, blob.x, blob.y, blob.locked, onDragStartProp]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const dx = (e.clientX - dragStart.current.x) / scale;
      const dy = (e.clientY - dragStart.current.y) / scale;
      if (isPartOfMultiSelection && onMoveSelected) {
        onMoveSelected(dx, dy);
      } else {
        onPosition(dragStart.current.blobX + dx, dragStart.current.blobY + dy);
      }
    },
    [isDragging, isPartOfMultiSelection, onMoveSelected, onPosition, scale]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (isDragging) {
        onDragEndProp?.(blob.id);
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
        setIsDragging(false);
      }
    },
    [blob.id, isDragging, onDragEndProp]
  );

  const effectiveX = resizeOverlay?.x ?? blob.x;
  const effectiveY = resizeOverlay?.y ?? blob.y;
  const effectiveW = resizeOverlay?.width ?? blob.width ?? undefined;
  const effectiveH = resizeOverlay?.height ?? blob.height ?? undefined;
  const showEdgeLeftRight =
    (effectiveW ?? DEFAULT_BLOB_W) * scale >= EDGE_THRESHOLD_SCREEN_W;
  const showEdgeTopBottom =
    (effectiveH ?? DEFAULT_BLOB_H) * scale >= EDGE_THRESHOLD_SCREEN_H;

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent, edge: "n" | "e" | "s" | "w") => {
      if (blob.locked) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = cardInnerRef.current?.getBoundingClientRect();
      const w =
        blob.width ??
        (rect ? rect.width / scale : DEFAULT_BLOB_W);
      const h =
        blob.height ??
        (rect ? rect.height / scale : DEFAULT_BLOB_H);
      resizeStartRef.current = {
        edge,
        startWidth: w,
        startHeight: h,
        startX: e.clientX,
        startY: e.clientY,
        startBlobX: blob.x,
        startBlobY: blob.y,
      };
      setResizingEdge(edge);
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [blob.locked, blob.x, blob.y, blob.width, blob.height, scale]
  );

  useEffect(() => {
    if (resizingEdge == null) return;
    const wrapEl = measureWrapRef.current;
    const contentEl = measureContentRef.current;

    const getLines = (): BlobLine[] => {
      if (blobMarkdownView === "preview" && contentRef.current) {
        return readLinesFromContentEl(contentRef.current);
      }
      return markdownToLines(blob.content ?? "");
    };

    const measureContentHeightAtWidth = (worldWidth: number): number => {
      if (!wrapEl || !contentEl) return resizeStartRef.current?.startHeight ?? DEFAULT_BLOB_H;
      wrapEl.style.width = `${worldWidth}px`;
      const lines = getLines();
      buildContentFromLines(contentEl, lines.length > 0 ? lines : [{ text: "", style: "bullet" }]);
      const heightPx = wrapEl.getBoundingClientRect().height;
      return heightPx / scale;
    };

    const measureContentWidthAtHeight = (worldHeight: number): number => {
      if (!wrapEl || !contentEl) return resizeStartRef.current?.startWidth ?? DEFAULT_BLOB_W;
      let low = MIN_BLOB_W;
      let high = 800;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (measureContentHeightAtWidth(mid) <= worldHeight) {
          high = mid;
        } else {
          low = mid + 1;
        }
      }
      return low;
    };

    const onMove = (e: PointerEvent) => {
      const start = resizeStartRef.current;
      if (!start) return;
      const dx = (e.clientX - start.startX) / scale;
      const dy = (e.clientY - start.startY) / scale;
      let w = start.startWidth;
      let h = start.startHeight;
      let x = start.startBlobX;
      let y = start.startBlobY;
      if (start.edge === "e") {
        w = Math.max(MIN_BLOB_W, start.startWidth + dx);
        h = Math.max(MIN_BLOB_H, measureContentHeightAtWidth(w));
      } else if (start.edge === "w") {
        w = Math.max(MIN_BLOB_W, start.startWidth - dx);
        h = Math.max(MIN_BLOB_H, measureContentHeightAtWidth(w));
        x = start.startBlobX + (start.startWidth - w);
      } else if (start.edge === "s") {
        h = Math.max(MIN_BLOB_H, start.startHeight + dy);
        w = Math.max(MIN_BLOB_W, measureContentWidthAtHeight(h));
      } else {
        h = Math.max(MIN_BLOB_H, start.startHeight - dy);
        w = Math.max(MIN_BLOB_W, measureContentWidthAtHeight(h));
        y = start.startBlobY + (start.startHeight - h);
      }
      const next = { width: w, height: h, x, y };
      resizeOverlayRef.current = next;
      setResizeOverlay(next);
    };
    const onUp = () => {
      const start = resizeStartRef.current;
      const overlay = resizeOverlayRef.current;
      const finalW = overlay?.width ?? start?.startWidth ?? blob.width ?? DEFAULT_BLOB_W;
      const finalH = overlay?.height ?? start?.startHeight ?? blob.height ?? DEFAULT_BLOB_H;
      const finalX = overlay?.x ?? blob.x;
      const finalY = overlay?.y ?? blob.y;
      dispatch({
        type: "SET_BLOB_SIZE",
        payload: { id: blob.id, width: finalW, height: finalH },
      });
      if (
        start &&
        (start.edge === "w" || start.edge === "n") &&
        (finalX !== blob.x || finalY !== blob.y)
      ) {
        onPosition(finalX, finalY);
      }
      resizeStartRef.current = null;
      resizeOverlayRef.current = null;
      setResizingEdge(null);
      setResizeOverlay(null);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, [resizingEdge, blob.id, blob.x, blob.y, blob.width, blob.height, blob.content, blobMarkdownView, scale, onPosition, dispatch]);

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

      const isMoveUp = (e.key === "ArrowUp" || e.key === "Up") && isMoveMod(e);
      const isMoveDown = (e.key === "ArrowDown" || e.key === "Down") && isMoveMod(e);
      if (isMoveUp && currentIndex > 0) {
        pushUndoSnapshot();
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
        pushUndoSnapshot();
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
        pushUndoSnapshot();
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
      pushUndoSnapshot();
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
    [blob.locked, dispatchLines, pushUndoSnapshot]
  );

  const handleCut = useCallback(() => {
    if (blob.locked) return;
    pushUndoSnapshot();
  }, [blob.locked, pushUndoSnapshot]);

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

  /** In Raw mode, shrink blob height when content is deleted so we don't show empty space or an unnecessary scrollbar. */
  const CARD_PADDING_VERTICAL_PX = 20;
  useLayoutEffect(() => {
    if (blobMarkdownView !== "raw" || blob.locked) return;
    const ta = rawTextareaRef.current;
    const currentH = blob.height ?? DEFAULT_BLOB_H;
    if (!ta || currentH <= MIN_BLOB_H) return;
    const contentHeightPx = CARD_PADDING_VERTICAL_PX + ta.scrollHeight;
    const contentHeightWorld = contentHeightPx / scale;
    if (contentHeightWorld < currentH && contentHeightWorld >= MIN_BLOB_H) {
      dispatch({
        type: "SET_BLOB_SIZE",
        payload: {
          id: blob.id,
          width: blob.width ?? DEFAULT_BLOB_W,
          height: Math.max(MIN_BLOB_H, contentHeightWorld),
        },
      });
    }
  }, [blob.id, blob.content, blob.height, blob.width, blob.locked, blobMarkdownView, scale, dispatch]);

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

  const menuActionRef = useRef<{ at: number } | null>(null);
  const runAndClose = (fn: () => void) => (e: React.PointerEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    if (menuActionRef.current && now - menuActionRef.current.at < 80) return;
    menuActionRef.current = { at: now };
    fn();
    setMenuOpen(false);
  };

  const blobMenuItems = (
    <>
      <button
        type="button"
        className={styles.blobMenuItem}
        role="menuitem"
        data-testid="blob-menu-duplicate"
        onPointerDown={runAndClose(onDuplicate)}
        onClick={runAndClose(onDuplicate)}
      >
        Duplicate
      </button>
      <button
        type="button"
        className={styles.blobMenuItem}
        role="menuitem"
        data-testid="blob-menu-copy-all"
        onPointerDown={runAndClose(() => {
          void navigator.clipboard.writeText(blob.content ?? "");
        })}
        onClick={runAndClose(() => {
          void navigator.clipboard.writeText(blob.content ?? "");
        })}
      >
        Copy all
      </button>
      {blob.locked ? (
        <button
          type="button"
          className={styles.blobMenuItem}
          role="menuitem"
          data-testid="blob-menu-unlock"
          onPointerDown={runAndClose(onUnlock)}
          onClick={runAndClose(onUnlock)}
        >
          Unlock
        </button>
      ) : (
        <button
          type="button"
          className={styles.blobMenuItem}
          role="menuitem"
          data-testid="blob-menu-lock"
          onPointerDown={runAndClose(onLock)}
          onClick={runAndClose(onLock)}
        >
          Lock
        </button>
      )}
      <button
        type="button"
        className={styles.blobMenuItem}
        role="menuitem"
        data-testid="blob-menu-hide"
        onPointerDown={runAndClose(() => onHide?.())}
        onClick={runAndClose(() => onHide?.())}
      >
        Hide
      </button>
      <button
        type="button"
        className={`${styles.blobMenuItem} ${styles.blobMenuItemDanger}`}
        role="menuitem"
        data-testid="blob-menu-delete"
        onPointerDown={runAndClose(onDelete)}
        onClick={runAndClose(onDelete)}
      >
        Delete
      </button>
    </>
  );

  /* When portaled, the wrapper has no in-flow content so it collapses to 0×0 and never
   * receives mouse enter. Give it explicit size so hover is kept when moving from
   * dragger to "…" button (avoids button disappearing from hit-region / leave timer).
   * Clamp position so controls stay within viewport and avoid the blobby + backer area. */
  const WRAPPER_SCREEN_W = SCREEN_GAP + CONTROLS_COLUMN_WIDTH + 24;
  const WRAPPER_SCREEN_H = 100;
  const VIEWPORT_PAD = 8;
  let portaledLeft = effectiveX - (SCREEN_GAP + CONTROLS_COLUMN_WIDTH) / scale;
  let portaledTop = effectiveY;
  if (
    typeof window !== "undefined" &&
    portal?.portalReady &&
    scale > 0
  ) {
    const screenLeft = portaledLeft * scale + pan.x;
    const screenTop = portaledTop * scale + pan.y;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const blobbyTop = vh - 74 - blobbyBackerSizePx / 2;
    const topLimit = Math.min(
      vh - VIEWPORT_PAD - WRAPPER_SCREEN_H,
      blobbyTop - WRAPPER_SCREEN_H - VIEWPORT_PAD
    );
    const screenLeftClamped = Math.max(
      VIEWPORT_PAD,
      Math.min(vw - VIEWPORT_PAD - WRAPPER_SCREEN_W, screenLeft)
    );
    const screenTopClamped = Math.max(
      VIEWPORT_PAD,
      Math.min(topLimit, screenTop)
    );
    portaledLeft = (screenLeftClamped - pan.x) / scale;
    portaledTop = (screenTopClamped - pan.y) / scale;
  }
  const portaledWrapperStyle: React.CSSProperties = portal?.portalReady
    ? {
        left: portaledLeft,
        top: portaledTop,
        width: (SCREEN_GAP + CONTROLS_COLUMN_WIDTH + 24) / scale,
        height: 100 / scale,
      }
    : { left: effectiveX, top: effectiveY };
  const portaledColumnLeft = portal?.portalReady ? 0 : -(SCREEN_GAP + CONTROLS_COLUMN_WIDTH) / scale;

  const controlsFragment = (
    <div
      className={styles.wrapper}
      data-blob-controls
      data-dragging={isDragging ? "" : undefined}
      data-hovered={isHovered && !isPartOfMultiSelection ? "" : undefined}
      style={portaledWrapperStyle}
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
          left: portaledColumnLeft,
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
        <div
          className={`${styles.menuWrap} ${isDragging ? styles.menuWrapHidden : ""}`}
          ref={menuRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
        <button
          ref={menuButtonRef}
          type="button"
          className={styles.menuButton}
          data-testid="blob-options"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (menuOpen) {
              setMenuOpen(false);
            } else {
              dispatchCloseMenus({ exceptBlobMenu: blob.id });
              setMenuOpen(true);
            }
          }}
          onMouseEnter={handleMouseEnter}
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
      style={{ left: effectiveX, top: effectiveY }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={cardInnerRef}
        className={styles.card}
        data-blob-card-inner
        data-selected={isSelected || undefined}
        data-locked={blob.locked || undefined}
        style={
          blobMarkdownView === "preview"
            ? effectiveW != null
              ? { width: effectiveW, minWidth: effectiveW, maxWidth: effectiveW }
              : undefined
            : effectiveW != null && effectiveH != null
              ? { width: effectiveW, height: effectiveH, minWidth: effectiveW, maxWidth: effectiveW, minHeight: effectiveH }
              : undefined
        }
      >
        {!blob.locked && (
          <>
            {showEdgeTopBottom && (
              <div
                className={styles.resizeEdge}
                data-edge="n"
                onPointerDown={(e) => handleResizePointerDown(e, "n")}
                aria-hidden
              />
            )}
            {showEdgeLeftRight && (
              <div
                className={styles.resizeEdge}
                data-edge="e"
                onPointerDown={(e) => handleResizePointerDown(e, "e")}
                aria-hidden
              />
            )}
            {showEdgeTopBottom && (
              <div
                className={styles.resizeEdge}
                data-edge="s"
                onPointerDown={(e) => handleResizePointerDown(e, "s")}
                aria-hidden
              />
            )}
            {showEdgeLeftRight && (
              <div
                className={styles.resizeEdge}
                data-edge="w"
                onPointerDown={(e) => handleResizePointerDown(e, "w")}
                aria-hidden
              />
            )}
          </>
        )}
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
            onCut={handleCut}
            onCopy={handleCopy}
            onMouseOver={handleContentMouseOver}
            onMouseOut={handleContentMouseOut}
            onPointerDown={(e) => {
              const a = (e.target as Node).nodeType === Node.ELEMENT_NODE && (e.target as Element).closest("a");
              if (a instanceof HTMLAnchorElement && a.href) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            onClick={(e) => {
              const a = (e.target as Node).nodeType === Node.ELEMENT_NODE && (e.target as Element).closest("a");
              if (a instanceof HTMLAnchorElement && a.href) {
                e.preventDefault();
                e.stopPropagation();
                window.open(a.href, "_blank", "noopener,noreferrer");
              }
            }}
          />
        )}
      </div>
    </div>
  );

  const portaledPopupContent =
    popupPortal?.portalReady &&
    popupPortal.portalRef.current &&
    (menuOpen || linkPreview) &&
    createPortal(
      <>
        {menuOpen && dropdownPosition && (
          <div
            ref={portaledMenuRef}
            className={styles.blobMenu}
            role="menu"
            data-popup-menu
            style={{
              position: "fixed",
              top: dropdownPosition.top + dropdownAdjust.y,
              left: dropdownPosition.left + dropdownAdjust.x,
              width: "max-content",
              transform: "translateX(-100%)",
            }}
          >
            {blobMenuItems}
          </div>
        )}
        {linkPreview && (
          <div
            ref={linkPreviewContainerRef}
            data-link-preview
            className={styles.linkPreviewWrap}
            style={{
              position: "fixed",
              top: linkPreviewPosition.top - LINK_PREVIEW_HIT_PAD,
              left: linkPreviewPosition.left - LINK_PREVIEW_HIT_PAD,
              width: LINK_PREVIEW_W + LINK_PREVIEW_HIT_PAD * 2,
              minHeight: LINK_PREVIEW_H + 48 + LINK_PREVIEW_HIT_PAD * 2,
            }}
            onMouseLeave={() => setLinkPreview(null)}
          >
            <div
              className={styles.linkPreview}
              style={{
                position: "absolute",
                top: LINK_PREVIEW_HIT_PAD,
                left: LINK_PREVIEW_HIT_PAD,
                width: LINK_PREVIEW_W,
                minHeight: LINK_PREVIEW_H,
              }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
                window.open(linkPreview.url, "_blank", "noopener,noreferrer");
                setLinkPreview(null);
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(linkPreview.url, "_blank", "noopener,noreferrer");
                setLinkPreview(null);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  window.open(linkPreview.url, "_blank", "noopener,noreferrer");
                  setLinkPreview(null);
                }
              }}
              aria-label={`Preview: ${linkPreview.title ?? linkPreview.url}`}
            >
              {linkPreview.imageUrl ? (
                <img
                  src={linkPreview.imageUrl}
                  alt=""
                  className={styles.linkPreviewImage}
                />
              ) : (
                <div className={styles.linkPreviewPlaceholder} />
              )}
              {(linkPreview.title || linkPreview.url) && (
                <div className={styles.linkPreviewTitle}>
                  {linkPreview.title ?? linkPreview.url}
                </div>
              )}
            </div>
          </div>
        )}
      </>,
      popupPortal.portalRef.current
    );

  const measureEl = (
    <div
      ref={measureWrapRef}
      className={styles.card}
      aria-hidden
      data-resize-measure
      style={{
        position: "absolute",
        left: -9999,
        top: 0,
        visibility: "hidden",
        width: 1,
        minWidth: 0,
        maxWidth: "none",
      }}
    >
      <div ref={measureContentRef} className={styles.content} />
    </div>
  );

  if (portal?.portalReady && portal.portalRef.current) {
    return (
      <>
        {cardBody}
        {measureEl}
        {createPortal(controlsFragment, portal.portalRef.current)}
        {portaledPopupContent}
      </>
    );
  }

  return (
    <>
      {measureEl}
      <div
        ref={cardRef}
        data-blob-card
        data-blob-id={blob.id}
        data-testid="blob-card"
        data-dragging={isDragging ? "" : undefined}
        data-hovered={isHovered && !isPartOfMultiSelection ? "" : undefined}
        className={styles.wrapper}
        style={{ left: effectiveX, top: effectiveY }}
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
          <div
            className={`${styles.menuWrap} ${isDragging ? styles.menuWrapHidden : ""}`}
            ref={menuRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <button
              ref={menuButtonRef}
              type="button"
              className={styles.menuButton}
              data-testid="blob-options"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (menuOpen) {
                  setMenuOpen(false);
                } else {
                  dispatchCloseMenus({ exceptBlobMenu: blob.id });
                  setMenuOpen(true);
                }
              }}
              onMouseEnter={handleMouseEnter}
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
          ref={cardInnerRef}
          className={styles.card}
          data-blob-card-inner
          data-selected={isSelected || undefined}
          data-locked={blob.locked || undefined}
          style={
            blobMarkdownView === "preview"
              ? effectiveW != null
                ? { width: effectiveW, minWidth: effectiveW, maxWidth: effectiveW }
                : undefined
              : effectiveW != null && effectiveH != null
                ? { width: effectiveW, height: effectiveH, minWidth: effectiveW, maxWidth: effectiveW, minHeight: effectiveH }
                : undefined
          }
        >
          {!blob.locked && (
            <>
              {showEdgeTopBottom && (
                <div
                  className={styles.resizeEdge}
                  data-edge="n"
                  onPointerDown={(e) => handleResizePointerDown(e, "n")}
                  aria-hidden
                />
              )}
              {showEdgeLeftRight && (
                <div
                  className={styles.resizeEdge}
                  data-edge="e"
                  onPointerDown={(e) => handleResizePointerDown(e, "e")}
                  aria-hidden
                />
              )}
              {showEdgeTopBottom && (
                <div
                  className={styles.resizeEdge}
                  data-edge="s"
                  onPointerDown={(e) => handleResizePointerDown(e, "s")}
                  aria-hidden
                />
              )}
              {showEdgeLeftRight && (
                <div
                  className={styles.resizeEdge}
                  data-edge="w"
                  onPointerDown={(e) => handleResizePointerDown(e, "w")}
                  aria-hidden
                />
              )}
            </>
          )}
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
              onCut={handleCut}
              onCopy={handleCopy}
            />
          )}
        </div>
      </div>
      {portaledPopupContent}
    </>
  );
}
