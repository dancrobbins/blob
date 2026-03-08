/** Line-level style; extensible for indent, todo, strikeout later. */
export type BlobLineStyle = "bullet" | "indent" | "todo" | "strikeout";

export interface BlobLine {
  text: string;
  style?: BlobLineStyle;
  /** Used when style is "todo" (checkbox). */
  checked?: boolean;
  /** Indent level (0 = top level). Omitted or 0 = no indent. */
  indent?: number;
}

export interface Blob {
  id: string;
  x: number;
  y: number;
  /** @deprecated Use lines instead. Parsed on load when lines is missing. */
  content?: string;
  /** Structured lines (text + style). When present, this is the source of truth. */
  lines?: BlobLine[];
  createdAt: string;
  updatedAt: string;
  locked?: boolean;
  hidden?: boolean;
}

export interface Preferences {
  theme: "light" | "dark";
  blobbyColor: string;
  /** Blobby backer display size in px (100–500). */
  blobbyBackerSizePx: number;
  /** Whether Blobby talks proactively: "silent" | "commenting". */
  blobbyCommenting: "silent" | "commenting";
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "light",
  blobbyColor: "pink",
  blobbyBackerSizePx: 200,
  blobbyCommenting: "silent",
};

export const BLOBBY_GRID_ROWS = 3;
export const BLOBBY_GRID_COLS = 3;

/** Color scheme names for Blobby (grid order: left-to-right, top-to-bottom). Must match filenames in public/assets/character expressions/. */
export const BLOBBY_COLOR_NAMES: string[] = [
  "pink",
  "green",
  "light brown",
  "seafoam",
  "purple",
  "yellow",
  "dark brown",
  "rainbow",
  "grey",
];

/** Character sprite grid (same as blobby grid). */
export const CHARACTER_GRID_ROWS = BLOBBY_GRID_ROWS;
export const CHARACTER_GRID_COLS = BLOBBY_GRID_COLS;

/** Build info from /api/build-info (written at build time; buildNumber increments every build). */
export interface BuildInfo {
  buildNumber?: number;
  buildTime: string;
  version: string;
  updates: string[];
}
