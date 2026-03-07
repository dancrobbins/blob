import type { Blob } from "./types";

export type BlobsAction =
  | { type: "SET_BLOBS"; payload: Blob[] }
  | { type: "ADD_BLOB"; payload: { x: number; y: number } }
  | { type: "UPDATE_BLOB"; payload: { id: string; content?: string } }
  | { type: "SET_POSITION"; payload: { id: string; x: number; y: number } }
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
    case "DELETE_BLOB":
      return state.filter((b) => b.id !== action.payload);
    default:
      return state;
  }
}
