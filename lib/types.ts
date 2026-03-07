export interface Blob {
  id: string;
  x: number;
  y: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  locked?: boolean;
  hidden?: boolean;
}

export interface Preferences {
  theme: "light" | "dark";
  blobbyColor: string;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "light",
  blobbyColor: "pink",
};

export const BLOBBY_GRID_ROWS = 3;
export const BLOBBY_GRID_COLS = 3;

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
