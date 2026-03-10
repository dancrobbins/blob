import type { BlobBounds } from "./blob-constants";

const CORNER_RADIUS = 12;

/** Internal padding (px) around each blob for the merge cue. */
export const MERGE_CUE_PADDING = 12;

/**
 * Minimum gap between two rect edges (0 if overlapping).
 */
export function gapBetweenRects(a: BlobBounds, b: BlobBounds): number {
  const aRight = a.left + a.width;
  const aBottom = a.top + a.height;
  const bRight = b.left + b.width;
  const bBottom = b.top + b.height;
  const gapX = Math.max(0, Math.max(a.left - bRight, b.left - aRight));
  const gapY = Math.max(0, Math.max(a.top - bBottom, b.top - aBottom));
  if (gapX > 0 && gapY > 0) {
    return Math.sqrt(gapX * gapX + gapY * gapY);
  }
  return Math.max(gapX, gapY);
}

/**
 * Area of intersection of two rects (0 if they do not overlap).
 * Used to pick the merge target when the dragging blob overlaps multiple blobs (choose the one with most overlap).
 */
export function overlapArea(a: BlobBounds, b: BlobBounds): number {
  const left = Math.max(a.left, b.left);
  const right = Math.min(a.left + a.width, b.left + b.width);
  const top = Math.max(a.top, b.top);
  const bottom = Math.min(a.top + a.height, b.top + b.height);
  if (left >= right || top >= bottom) return 0;
  return (right - left) * (bottom - top);
}

/** Expand blob bounds by padding on all sides to get the merge-cue rect. */
export function getMergeCueRect(bounds: BlobBounds, padding: number = MERGE_CUE_PADDING): BlobBounds {
  return {
    left: bounds.left - padding,
    top: bounds.top - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  };
}

/**
 * Returns an SVG path string for a single rounded rectangle (absolute coords).
 */
function roundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): string {
  const r2 = Math.min(r, w / 2, h / 2);
  return `M ${x + r2} ${y} L ${x + w - r2} ${y} Q ${x + w} ${y} ${x + w} ${y + r2} L ${x + w} ${y + h - r2} Q ${x + w} ${y + h} ${x + w - r2} ${y + h} L ${x + r2} ${y + h} Q ${x} ${y + h} ${x} ${y + h - r2} L ${x} ${y + r2} Q ${x} ${y} ${x + r2} ${y} Z`;
}

/**
 * Two separate merge cues (rounded rects) in local coordinates.
 * Origin is (originX, originY); returns path and the viewBox size.
 */
export function getSeparateMergeCuesPath(
  cueA: BlobBounds,
  cueB: BlobBounds,
  originX: number,
  originY: number,
  cornerRadius: number = CORNER_RADIUS
): string {
  const pathA = roundedRectPath(
    cueA.left - originX,
    cueA.top - originY,
    cueA.width,
    cueA.height,
    Math.min(cornerRadius, cueA.width / 2, cueA.height / 2)
  );
  const pathB = roundedRectPath(
    cueB.left - originX,
    cueB.top - originY,
    cueB.width,
    cueB.height,
    Math.min(cornerRadius, cueB.width / 2, cueB.height / 2)
  );
  return pathA + " " + pathB;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function effectiveR(rect: BlobBounds, r: number): number {
  return Math.min(r, rect.width / 2, rect.height / 2);
}

/**
 * Builds a fused boundary that literally follows each blob's cue-rect contour.
 *
 * For horizontal alignment (A left, B right):
 *   - Traces A's outer arc: top-left → top-right-corner → down to bridgeTopY
 *     then bridge curve to B.left, bridgeTopY → up to B's top-left corner
 *     → B's full outer arc (top, right side, bottom) → B's left side down to bridgeBotY
 *     → bridge curve back to A.right bridgeBotY → A's right side down → A's bottom arc
 *     → A's left side up → close.
 *
 * For vertical alignment (A top, B bottom): mirrors the same logic 90°.
 *
 * Coordinates returned are relative to (Math.min(cueA.left, cueB.left),
 * Math.min(cueA.top, cueB.top)) so the overlay can translate them by
 * adding the margin offset.
 */
export function getFusedBoundaryPath(
  cueA: BlobBounds,
  cueB: BlobBounds,
  cornerRadius: number = CORNER_RADIUS
): string {
  const originX = Math.min(cueA.left, cueB.left);
  const originY = Math.min(cueA.top, cueB.top);

  const cx1 = cueA.left + cueA.width / 2;
  const cy1 = cueA.top + cueA.height / 2;
  const cx2 = cueB.left + cueB.width / 2;
  const cy2 = cueB.top + cueB.height / 2;

  let A = cueA;
  let B = cueB;
  let rA = effectiveR(cueA, cornerRadius);
  let rB = effectiveR(cueB, cornerRadius);

  const isHorizontal = Math.abs(cx2 - cx1) >= Math.abs(cy2 - cy1);

  // Fallback to simple union rect
  function unionRect(): string {
    const r2 = Math.max(cueA.left + cueA.width, cueB.left + cueB.width);
    const b2 = Math.max(cueA.top + cueA.height, cueB.top + cueB.height);
    const w = r2 - originX;
    const h = b2 - originY;
    return roundedRectPath(0, 0, w, h, Math.min(cornerRadius, w / 2, h / 2));
  }

  // Translate absolute coords to origin-relative for the returned path
  function rel(x: number, y: number): string {
    return `${x - originX} ${y - originY}`;
  }

  if (isHorizontal) {
    // Ensure A is the left blob
    if (cx1 > cx2) {
      [A, B] = [B, A];
      [rA, rB] = [rB, rA];
    }

    // The bridges connect on A's right vertical edge and B's left vertical edge.
    // bridgeTopY / bridgeBotY must lie on the straight (non-corner) portion of both edges.
    const bridgeMinY = Math.max(A.top + rA, B.top + rB);
    const bridgeMaxY = Math.min(A.top + A.height - rA, B.top + B.height - rB);

    if (bridgeMinY >= bridgeMaxY - 1) {
      return unionRect();
    }

    const bridgeTopY = bridgeMinY;
    const bridgeBotY = bridgeMaxY;

    // midX for the concave bridge control point
    const midX = (A.left + A.width + B.left) / 2;
    // Concavity depth (inward pull)
    const rawGap = B.left - (A.left + A.width);
    const concave = Math.max(6, Math.min(20, Math.abs(rawGap) * 0.5 + 6));

    // Clamp bridge points to valid straight-edge range
    const bTopY = clamp(bridgeTopY, A.top + rA, A.top + A.height - rA);
    const bBotY = clamp(bridgeBotY, A.top + rA, A.top + A.height - rA);

    const Ar = A.left + A.width;
    const Ab = A.top + A.height;
    const Br = B.left + B.width;
    const Bb = B.top + B.height;

    const segs: string[] = [
      // A outer arc: start at top-left (after corner), go right across top
      `M ${rel(A.left + rA, A.top)}`,
      `L ${rel(Ar - rA, A.top)}`,
      `Q ${rel(Ar, A.top)} ${rel(Ar, A.top + rA)}`,
      // Down A's right side to bridge top
      `L ${rel(Ar, bTopY)}`,
      // Concave top bridge to B's left side
      `Q ${rel(midX, bTopY - concave)} ${rel(B.left, bTopY)}`,
      // Up B's left side to B's top-left corner
      `L ${rel(B.left, B.top + rB)}`,
      `Q ${rel(B.left, B.top)} ${rel(B.left + rB, B.top)}`,
      // Across B's top, B's top-right corner, down B's right, B's bottom-right, across B's bottom
      `L ${rel(Br - rB, B.top)}`,
      `Q ${rel(Br, B.top)} ${rel(Br, B.top + rB)}`,
      `L ${rel(Br, Bb - rB)}`,
      `Q ${rel(Br, Bb)} ${rel(Br - rB, Bb)}`,
      `L ${rel(B.left + rB, Bb)}`,
      `Q ${rel(B.left, Bb)} ${rel(B.left, Bb - rB)}`,
      // Down B's left side to bridge bottom
      `L ${rel(B.left, bBotY)}`,
      // Concave bottom bridge to A's right side
      `Q ${rel(midX, bBotY + concave)} ${rel(Ar, bBotY)}`,
      // Down A's right side to A's bottom-right corner
      `L ${rel(Ar, Ab - rA)}`,
      `Q ${rel(Ar, Ab)} ${rel(Ar - rA, Ab)}`,
      // Across A's bottom, A's bottom-left corner, up A's left side, A's top-left corner
      `L ${rel(A.left + rA, Ab)}`,
      `Q ${rel(A.left, Ab)} ${rel(A.left, Ab - rA)}`,
      `L ${rel(A.left, A.top + rA)}`,
      `Q ${rel(A.left, A.top)} ${rel(A.left + rA, A.top)}`,
      `Z`,
    ];

    return segs.join(" ");
  } else {
    // Vertical alignment: ensure A is the top blob
    if (cy1 > cy2) {
      [A, B] = [B, A];
      [rA, rB] = [rB, rA];
    }

    const bridgeMinX = Math.max(A.left + rA, B.left + rB);
    const bridgeMaxX = Math.min(A.left + A.width - rA, B.left + B.width - rB);

    if (bridgeMinX >= bridgeMaxX - 1) {
      return unionRect();
    }

    const bridgeLeftX = bridgeMinX;
    const bridgeRightX = bridgeMaxX;

    const midY = (A.top + A.height + B.top) / 2;
    const rawGap = B.top - (A.top + A.height);
    const concave = Math.max(6, Math.min(20, Math.abs(rawGap) * 0.5 + 6));

    const bLeftX = clamp(bridgeLeftX, A.left + rA, A.left + A.width - rA);
    const bRightX = clamp(bridgeRightX, A.left + rA, A.left + A.width - rA);

    const Ar = A.left + A.width;
    const Ab = A.top + A.height;
    const Br = B.left + B.width;
    const Bb = B.top + B.height;

    const segs: string[] = [
      // A outer arc: start top-left (after corner), across top, top-right, down right, bottom-right
      `M ${rel(A.left + rA, A.top)}`,
      `L ${rel(Ar - rA, A.top)}`,
      `Q ${rel(Ar, A.top)} ${rel(Ar, A.top + rA)}`,
      `L ${rel(Ar, Ab - rA)}`,
      `Q ${rel(Ar, Ab)} ${rel(Ar - rA, Ab)}`,
      // Across A's bottom to bridge right
      `L ${rel(bRightX, Ab)}`,
      // Concave right bridge
      `Q ${rel(bRightX + concave, midY)} ${rel(bRightX, B.top)}`,
      // Across B's top (right portion), B's top-right, down B's right, B's bottom-right, across B's bottom
      `L ${rel(Br - rB, B.top)}`,
      `Q ${rel(Br, B.top)} ${rel(Br, B.top + rB)}`,
      `L ${rel(Br, Bb - rB)}`,
      `Q ${rel(Br, Bb)} ${rel(Br - rB, Bb)}`,
      `L ${rel(B.left + rB, Bb)}`,
      `Q ${rel(B.left, Bb)} ${rel(B.left, Bb - rB)}`,
      // Up B's left side to B's top-left corner, across B top (left portion) to bridge left
      `L ${rel(B.left, B.top + rB)}`,
      `Q ${rel(B.left, B.top)} ${rel(B.left + rB, B.top)}`,
      `L ${rel(bLeftX, B.top)}`,
      // Concave left bridge
      `Q ${rel(bLeftX - concave, midY)} ${rel(bLeftX, Ab)}`,
      // Across A's bottom (left portion), A's bottom-left, up A's left, A's top-left
      `L ${rel(A.left + rA, Ab)}`,
      `Q ${rel(A.left, Ab)} ${rel(A.left, Ab - rA)}`,
      `L ${rel(A.left, A.top + rA)}`,
      `Q ${rel(A.left, A.top)} ${rel(A.left + rA, A.top)}`,
      `Z`,
    ];

    return segs.join(" ");
  }
}
