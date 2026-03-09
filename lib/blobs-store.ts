import type { Blob } from "./types";
import { normalizeBlob } from "./blob-lines";

const DUPLICATE_OFFSET = 24;

export type BlobsAction =
  | { type: "SET_BLOBS"; payload: Blob[] }
  | { type: "ADD_BLOB"; payload: { x: number; y: number } }
  | { type: "UPDATE_BLOB"; payload: { id: string; content?: string } }
  | { type: "SET_POSITION"; payload: { id: string; x: number; y: number } }
  | { type: "DUPLICATE_BLOB"; payload: string }
  | { type: "DELETE_BLOB"; payload: string }
  | { type: "DELETE_BLOBS"; payload: string[] }
  | { type: "DUPLICATE_BLOBS"; payload: string[] }
  | { type: "SET_LOCKED"; payload: { ids: string[]; locked: boolean } }
  | { type: "SET_HIDDEN"; payload: { ids: string[]; hidden: boolean } }
  | { type: "UNHIDE_ALL" }
  | { type: "SET_BLOB_SIZE"; payload: { id: string; width: number; height: number } }
  | { type: "MERGE_BLOBS"; payload: { sourceId: string; targetId: string; prependSource?: boolean; sourcePosition?: { x: number; y: number } } };

function generateId(): string {
  return `b_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function createBlob(x: number, y: number): Blob {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    x,
    y,
    content: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function blobsReducer(state: Blob[], action: BlobsAction): Blob[] {
  switch (action.type) {
    case "SET_BLOBS":
      return action.payload.map(normalizeBlob);
    case "ADD_BLOB": {
      const blob = createBlob(action.payload.x, action.payload.y);
      return [...state, blob];
    }
    case "UPDATE_BLOB": {
      const { id, content } = action.payload;
      if (content === undefined) return state;
      const now = new Date().toISOString();
      return state.map((b) =>
        b.id === id ? { ...b, content, updatedAt: now } : b
      );
    }
    case "SET_POSITION": {
      const { id, x, y } = action.payload;
      const blob = state.find((b) => b.id === id);
      if (!blob || blob.locked) return state;
      const now = new Date().toISOString();
      return state.map((b) =>
        b.id === id ? { ...b, x, y, updatedAt: now } : b
      );
    }
    case "DUPLICATE_BLOB": {
      const source = state.find((b) => b.id === action.payload);
      if (!source) return state;
      const now = new Date().toISOString();
      const duplicate: Blob = {
        ...source,
        id: generateId(),
        x: source.x + DUPLICATE_OFFSET,
        y: source.y + DUPLICATE_OFFSET,
        createdAt: now,
        updatedAt: now,
      };
      return [...state, duplicate];
    }
    case "DELETE_BLOB":
      return state.filter((b) => b.id !== action.payload);
    case "DELETE_BLOBS": {
      const ids = new Set(action.payload);
      return state.filter((b) => !ids.has(b.id));
    }
    case "DUPLICATE_BLOBS": {
      const ids = new Set(action.payload);
      const toDuplicate = state.filter((b) => ids.has(b.id));
      const now = new Date().toISOString();
      const duplicates: Blob[] = toDuplicate.map((b) => ({
        ...b,
        id: generateId(),
        x: b.x + DUPLICATE_OFFSET,
        y: b.y + DUPLICATE_OFFSET,
        createdAt: now,
        updatedAt: now,
      }));
      return [...state, ...duplicates];
    }
    case "SET_LOCKED": {
      const { ids, locked } = action.payload;
      const idSet = new Set(ids);
      const now = new Date().toISOString();
      return state.map((b) =>
        idSet.has(b.id) ? { ...b, locked, updatedAt: now } : b
      );
    }
    case "SET_HIDDEN": {
      const { ids, hidden } = action.payload;
      const idSet = new Set(ids);
      const now = new Date().toISOString();
      return state.map((b) =>
        idSet.has(b.id) ? { ...b, hidden, updatedAt: now } : b
      );
    }
    case "UNHIDE_ALL": {
      const hasHidden = state.some((b) => b.hidden);
      if (!hasHidden) return state;
      const now = new Date().toISOString();
      return state.map((b) => (b.hidden ? { ...b, hidden: false, updatedAt: now } : b));
    }
    case "SET_BLOB_SIZE": {
      const { id, width, height } = action.payload;
      const blob = state.find((b) => b.id === id);
      if (!blob || blob.locked) return state;
      const now = new Date().toISOString();
      return state.map((b) =>
        b.id === id ? { ...b, width, height, updatedAt: now } : b
      );
    }
    case "MERGE_BLOBS": {
      const { sourceId, targetId, prependSource } = action.payload;
      const source = state.find((b) => b.id === sourceId);
      const target = state.find((b) => b.id === targetId);
      if (!source || !target || sourceId === targetId || source.hidden || target.hidden) return state;
      const parts = prependSource
        ? [source.content, target.content]
        : [target.content, source.content];
      const mergedContent = parts.filter((s) => s != null && s !== "").join("\n\n");
      const now = new Date().toISOString();
      return state
        .filter((b) => b.id !== sourceId)
        .map((b) =>
          b.id === targetId ? { ...b, content: mergedContent, updatedAt: now } : b
        );
    }
    default:
      return state;
  }
}
