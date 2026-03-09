/** Line-level style; used for editing representation (not persisted; blob stores markdown). */
export type BlobLineStyle = "bullet" | "indent" | "todo" | "strikeout" | "ordered";

export interface BlobLine {
  text: string;
  style?: BlobLineStyle;
  /** Used when style is "todo" (checkbox). */
  checked?: boolean;
  /** Indent level (0 = top level). Omitted or 0 = no indent. */
  indent?: number;
  /** Used when style is "ordered" (numbered list). 1-based. */
  number?: number;
}

export interface Blob {
  id: string;
  x: number;
  y: number;
  /** Markdown source of truth. Persisted and synced. */
  content: string;
  /** @deprecated Only present when loading old data; migration converts to content and drops this. */
  lines?: BlobLine[];
  createdAt: string;
  updatedAt: string;
  locked?: boolean;
  hidden?: boolean;
  /** Explicit size (px in blob/canvas space). When set, changing width adjusts height (and vice versa) to keep aspect ratio. */
  width?: number;
  height?: number;
}

/** How blob text is shown: raw markdown source or preview (line-based editor). */
export type BlobMarkdownView = "raw" | "preview";

export interface Preferences {
  theme: "light" | "dark";
  blobbyColor: string;
  /** Blobby backer display size in px (100–500). */
  blobbyBackerSizePx: number;
  /** Whether Blobby talks proactively: "silent" | "commenting". */
  blobbyCommenting: "silent" | "commenting";
  /** Blob text: show raw markdown or preview (bullets/todos). */
  blobMarkdownView: BlobMarkdownView;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "light",
  blobbyColor: "pink",
  blobbyBackerSizePx: 200,
  blobbyCommenting: "silent",
  blobMarkdownView: "preview",
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

/** Canvas viewport: pan (translate) and scale (zoom). Persisted to cloud per user. */
export interface CameraPosition {
  panX: number;
  panY: number;
  scale: number;
  /** ISO timestamp when this camera was last changed; used for last-write-wins across tabs. */
  updatedAt?: string;
}

/** Build info from /api/build-info (written at build time; buildNumber increments every build). */
export interface BuildInfo {
  buildNumber?: number;
  buildTime: string;
  version: string;
  updates: string[];
}
