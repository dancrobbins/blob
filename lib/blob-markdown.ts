import { marked } from "marked";
import type { BlobLine, BlobLineStyle } from "./types";

/** Leading list markers (markdown or unicode bullets). Strip so we never double-prefix. */
const LEADING_LIST_MARKER = /^(\s*[-*•·▪▸►]\s+)+/;

/** Remove any leading list-marker chars from line text so serialization adds exactly one. */
function stripLeadingMarkers(text: string): string {
  return text.replace(LEADING_LIST_MARKER, "").trimStart();
}

/** Serialize BlobLine[] to CommonMark. Used when persisting or copying. Only we add "- "; line text is stored without markers. */
export function linesToMarkdown(lines: BlobLine[]): string {
  if (!lines.length) return "";
  const list = lines.length > 0 ? lines : [{ text: "", style: "bullet" as const }];
  return list
    .map((line) => {
      const style: BlobLineStyle = (line.style ?? "bullet") as BlobLineStyle;
      const indent = Math.max(0, line.indent ?? 0);
      const prefix = "  ".repeat(indent);
      const raw = line.text ?? "";
      const text = stripLeadingMarkers(raw);
      if (style === "todo") {
        const check = line.checked ? "[x]" : "[ ]";
        return `${prefix}- ${check} ${text}`;
      }
      if (style === "ordered" && line.number != null) {
        const textNoNum = raw.replace(/^\s*\d+\.\s*/, "");
        return `${prefix}${line.number}. ${stripLeadingMarkers(textNoNum)}`;
      }
      if (style === "strikeout") {
        return `${prefix}- ~~${text}~~`;
      }
      if (style === "indent" || style === "bullet") {
        return `${prefix}- ${text}`;
      }
      return `${prefix}- ${text}`;
    })
    .join("\n");
}

/** Token types from marked lexer (minimal typing). */
interface MarkedListToken {
  type: string;
  raw?: string;
  ordered?: boolean;
  start?: number;
  items?: MarkedListItem[];
}

interface MarkedListItem {
  type: string;
  raw?: string;
  text?: string;
  task?: boolean;
  checked?: boolean;
  tokens?: Array<{ type: string; text?: string; raw?: string }>;
}

interface MarkedParagraphToken {
  type: string;
  text?: string;
  tokens?: Array<{ type: string; text?: string }>;
}

/** Parse CommonMark into BlobLine[] for the editor. */
export function markdownToLines(md: string): BlobLine[] {
  if (typeof md !== "string") return [{ text: "", style: "bullet" }];
  const trimmed = md.trimEnd();
  if (!trimmed) return [{ text: "", style: "bullet" }];

  const tokens = marked.lexer(trimmed) as Array<
    | MarkedListToken
    | MarkedParagraphToken
    | { type: string; raw?: string }
  >;
  const lines: BlobLine[] = [];

  for (const token of tokens) {
    if (token.type === "space") continue;
    if (token.type === "list" && "items" in token && Array.isArray(token.items)) {
      const list = token as MarkedListToken;
      const ordered = list.ordered === true;
      const start = typeof list.start === "number" ? list.start : 1;
      list.items!.forEach((item, i) => {
        const itemRaw = item.raw ?? "";
        const leading = itemRaw.match(/^(\s*)/)?.[1].length ?? 0;
        const indent = Math.floor(leading / 2);
        const rawText = (item.text ?? "").trim();
        const text = stripLeadingMarkers(rawText);
        if (item.task === true) {
          lines.push({
            text,
            style: "todo",
            checked: item.checked === true,
            indent: indent > 0 ? indent : undefined,
          });
        } else if (ordered) {
          lines.push({
            text: stripLeadingMarkers(rawText.replace(/^\s*\d+\.\s*/, "")),
            style: "ordered",
            number: start + i,
            indent: indent > 0 ? indent : undefined,
          });
        } else {
          lines.push({
            text,
            style: indent >= 1 ? "indent" : "bullet",
            indent: indent > 0 ? indent : undefined,
          });
        }
      });
      continue;
    }
    if (token.type === "paragraph" && "text" in token) {
      const p = token as MarkedParagraphToken;
      const raw = p.text ?? "";
      const innerTokens = p.tokens ?? [];
      const singleDel =
        innerTokens.length === 1 && innerTokens[0].type === "del";
      if (singleDel && innerTokens[0].text != null) {
        lines.push({ text: stripLeadingMarkers(innerTokens[0].text), style: "strikeout" });
      } else {
        lines.push({ text: stripLeadingMarkers(raw), style: "bullet" });
      }
      continue;
    }
    if (token.type === "heading" && "text" in token) {
      const h = token as { type: string; text?: string; depth?: number };
      lines.push({ text: stripLeadingMarkers((h.text ?? "").trim()), style: "bullet" });
      continue;
    }
    if (token.type === "code" && "text" in token) {
      const c = token as { type: string; text?: string };
      lines.push({ text: stripLeadingMarkers(c.text ?? ""), style: "bullet" });
      continue;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawStr = (token as any).raw as string | undefined;
    if (rawStr) {
      const line = rawStr.split("\n")[0].trim();
      if (line) lines.push({ text: stripLeadingMarkers(line), style: "bullet" });
    }
  }

  if (lines.length === 0) return [{ text: "", style: "bullet" }];
  return lines;
}

/** Strip markdown to plain text (for summarize/title APIs). */
export function markdownToPlainText(md: string): string {
  if (typeof md !== "string") return "";
  const lines = markdownToLines(md);
  return lines.map((l) => l.text).join("\n");
}

/** True if blob has no user-created text (empty, whitespace-only, or only list markers like "- "). */
export function isBlobContentEmpty(content: string | undefined): boolean {
  const s = (content ?? "").trim();
  if (!s) return true;
  const lines = markdownToLines(content ?? "");
  return lines.every((line) => !(line.text ?? "").trim());
}

/** Remove lines that are blank or only a bullet (empty line text). Returns at least one empty bullet line. */
export function removeEmptyLines(lines: BlobLine[]): BlobLine[] {
  const filtered = lines.filter((line) => (line.text ?? "").trim() !== "");
  return filtered.length > 0 ? filtered : [{ text: "", style: "bullet" }];
}
