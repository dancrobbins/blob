import type { Blob } from "./types";

export const DEFAULT_BLOB_W = 280;
export const DEFAULT_BLOB_H = 200;

/** Screen pixels to the left of each blob used by dragger + "..." (SCREEN_GAP + CONTROLS_COLUMN_WIDTH in BlobCard). Used by Zoom to fit so that fit includes room for controls. */
export const SHOW_ALL_CONTROLS_LEFT_PX = 8 + 28;

export type BlobBounds = { left: number; top: number; width: number; height: number };

export function getBlobBounds(blob: Blob): BlobBounds {
  const width = blob.width ?? DEFAULT_BLOB_W;
  const height = blob.height ?? DEFAULT_BLOB_H;
  return {
    left: blob.x,
    top: blob.y,
    width,
    height,
  };
}
