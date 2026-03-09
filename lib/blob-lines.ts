import type { Blob, BlobLine, BlobLineStyle } from "./types";
import { linesToMarkdown, markdownToPlainText } from "./blob-markdown";

const LEGACY_BULLET = "• ";
const BULLET_CHAR = "• ";

/**
 * Parse legacy blob content (plain string with "• " at line starts) into BlobLine[].
 * Used when migrating old blobs that had content but no lines.
 */
export function parseLegacyContent(content: string): BlobLine[] {
  if (!content || typeof content !== "string") return [{ text: "", style: "bullet" }];
  const rawLines = content.split(/\r\n|\r|\n/);
  return rawLines.map((raw) => {
    const trimmed = raw.trimStart();
    if (trimmed.startsWith(LEGACY_BULLET)) {
      return { text: trimmed.slice(LEGACY_BULLET.length), style: "bullet" as const };
    }
    if (trimmed.length === 0) return { text: "", style: "bullet" as const };
    return { text: raw.replace(/^\s+/, ""), style: "bullet" as const };
  });
}

/**
 * Normalize a blob to markdown source of truth. Migrates old blobs that have `lines` or
 * legacy `content` (plain text with "• ") into `content` (markdown) and drops `lines`.
 * Does not mutate; returns a new blob with content set and lines removed.
 */
export function normalizeBlob(blob: Blob): Blob {
  const hasLines = blob.lines != null && Array.isArray(blob.lines);
  if (hasLines && blob.lines!.length > 0) {
    const content = linesToMarkdown(blob.lines!);
    return { ...blob, content, lines: undefined };
  }
  if (hasLines && blob.lines!.length === 0) {
    return { ...blob, content: "", lines: undefined };
  }
  const raw = blob.content ?? "";
  if (raw.includes(LEGACY_BULLET)) {
    const lines = parseLegacyContent(raw);
    const content = linesToMarkdown(lines);
    return { ...blob, content, lines: undefined };
  }
  return { ...blob, content: raw, lines: undefined };
}

/**
 * Plain text for a single blob (e.g. for summarize API). Joins line texts with newlines; no bullet chars.
 */
export function blobLinesToPlainText(lines: BlobLine[]): string {
  return lines.map((l) => l.text).join("\n");
}

/**
 * Get plain text from a blob. Uses blob.content (markdown) and strips markdown syntax.
 * For normalized blobs, content is always set.
 */
export function blobToPlainText(blob: Blob): string {
  const md = blob.content ?? "";
  if (!md) return "";
  return markdownToPlainText(md);
}

/** MIME type for our rich clipboard format (JSON lines). */
export const BLOB_CLIPBOARD_MIME = "application/x-blob-lines";

/**
 * Serialize lines to our clipboard format (for in-app paste with style).
 */
export function linesToClipboardData(lines: BlobLine[]): string {
  return JSON.stringify(lines);
}

/**
 * Parse our clipboard format back to BlobLine[].
 */
export function parseBlobClipboardData(data: string): BlobLine[] | null {
  try {
    const parsed = JSON.parse(data) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (item): item is BlobLine =>
        item != null &&
        typeof item === "object" &&
        typeof (item as BlobLine).text === "string"
    ) as BlobLine[];
  } catch {
    return null;
  }
}

/**
 * Plain text for external paste: bullet lines get "• " prefix so pasting into plain text apps works.
 */
export function linesToPlainTextWithBullets(lines: BlobLine[]): string {
  return lines
    .map((l) => {
      const style = l.style ?? "bullet";
      if (style === "bullet") return BULLET_CHAR + l.text;
      return l.text;
    })
    .join("\n");
}

/**
 * Build HTML for copy (structured list when possible).
 */
export function linesToHtml(lines: BlobLine[]): string {
  const items = lines
    .map((l) => {
      const text = escapeHtml(l.text);
      const style = l.style ?? "bullet";
      if (style === "bullet") return `<li>${text}</li>`;
      return `<li>${text}</li>`;
    })
    .join("");
  return `<ul>${items}</ul>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Common bullet chars and list markers we recognize when pasting from external apps. */
const EXTERNAL_BULLET_PATTERN = /^[\s]*([•·▪▸►\-\*]\s+)/;

/**
 * Parse pasted HTML or plain text from another app into BlobLine[].
 * Detects list items (ul/ol/li) and leading bullets/dashes; maps indentation to indent style.
 * Prefers plain text when it's much longer than HTML-derived content so we don't drop pasted
 * text (e.g. copying from a page that puts a short list in HTML but full selection in plain).
 */
export function parsePastedContent(html: string | null, plainText: string): BlobLine[] {
  const plainLen = (plainText ?? "").length;
  if (html && html.trim().length > 0) {
    const fromHtml = parseHtmlToList(html);
    if (fromHtml.length > 0) {
      const htmlTextLen = fromHtml.reduce((s, l) => s + (l.text?.length ?? 0), 0);
      // Use HTML only if it captured a reasonable share of content; otherwise plain text has the full paste
      if (plainLen <= 0 || htmlTextLen >= plainLen * 0.5) return fromHtml;
    }
  }
  return parsePlainTextToList(plainText);
}

function parseHtmlToList(html: string): BlobLine[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const lis = doc.querySelectorAll("ul li, ol li");
  if (lis.length === 0) return [];
  const lines: BlobLine[] = [];
  lis.forEach((li) => {
    const text = (li.textContent ?? "").trim();
    const style: BlobLineStyle = "bullet";
    lines.push({ text, style });
  });
  return lines;
}

function parsePlainTextToList(plain: string): BlobLine[] {
  const rawLines = plain.split(/\r\n|\r|\n/);
  return rawLines.map((raw) => {
    const trimmed = raw.trimStart();
    const bulletMatch = trimmed.match(EXTERNAL_BULLET_PATTERN);
    if (bulletMatch) {
      return { text: trimmed.slice(bulletMatch[1].length), style: "bullet" as const };
    }
    const leadingSpaces = raw.match(/^(\s+)/)?.[1].length ?? 0;
    const text = raw.replace(/^\s+/, "");
    if (leadingSpaces >= 2) return { text, style: "indent" as const };
    return { text, style: "bullet" as const };
  });
}
