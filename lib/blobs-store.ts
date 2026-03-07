import type { Blob } from "./types";

const DUPLICATE_OFFSET = 24;

export type BlobsAction =
  | { type: "SET_BLOBS"; payload: Blob[] }
  | { type: "ADD_BLOB"; payload: { x: number; y: number } }
  | { type: "UPDATE_BLOB"; payload: { id: string; content?: string } }
  | { type: "SET_POSITION"; payload: { id: string; x: number; y: number } }
  | { type: "DUPLICATE_BLOB"; payload: string }
  | { type: "DELETE_BLOB"; payload: string };

function generateId(): string {
  return `b_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function createBlob(x: number, y: number): Blob {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    x,
    y,
    content: "• ",
    createdAt: now,
    updatedAt: now,
  };
}

export function blobsReducer(state: Blob[], action: BlobsAction): Blob[] {
  switch (action.type) {
    case "SET_BLOBS":
      return action.payload;
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
    default:
      return state;
  }
}
