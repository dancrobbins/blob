---
name: Sync debug logging
overview: Add a persistent, in-memory sync event log (ring buffer) that records every significant blob-count change and sync decision, plus expose it via a developer console helper so you can reconstruct "what happened to my blobs" after the fact without needing DevTools open during the incident.
todos:
  - id: create-sync-log
    content: Create lib/sync-log.ts with ring buffer, syncLog(), getSyncLog(), and window.__blobSyncLog assignment
    status: pending
  - id: instrument-login-merge
    content: Add syncLog calls to all branches of the login merge effect in BlobsContext.tsx
    status: pending
  - id: instrument-poll
    content: Add syncLog calls to the poll function in BlobsContext.tsx, especially the remote-ahead-drop branch
    status: pending
  - id: instrument-persist-dispatch
    content: Add syncLog calls to the persist effect and the dispatch wrapper (for DELETE_BLOB, DELETE_BLOBS) in BlobsContext.tsx
    status: pending
  - id: instrument-logout
    content: Add syncLog call to the logout/account-switch effect in BlobsContext.tsx
    status: pending
  - id: instrument-persistence-errors
    content: Replace console.error calls in lib/persistence.ts with syncLog so errors appear in the ring buffer too
    status: pending
isProject: false
---

# Sync Debug Logging

## Goal

Capture enough structured data at each sync decision point that, after blobs disappear, you can open the console and read back exactly what happened: which code path ran, how many blobs were before/after, and what the triggering conditions were.

## Approach: In-Memory Ring Buffer + `window.__blobSyncLog`

A simple ring buffer (capped at ~200 entries) stored in a module-level variable inside `lib/sync-log.ts`. Each log entry is a plain object:

```ts
{ ts: string, event: string, detail: Record<string, unknown> }
```

Exposed on `window.__blobSyncLog` so you can run `copy(JSON.stringify(__blobSyncLog, null, 2))` in DevTools at any point to get the full history. No database writes, no UI, no performance impact.

## Log points to instrument

All changes are in [contexts/BlobsContext.tsx](contexts/BlobsContext.tsx) and [lib/persistence.ts](lib/persistence.ts).

**Login merge effect** (BlobsContext ~line 321):
- `login:start` — `{ cloudCount, localCount }`
- `login:merge-dialog-shown` — `{ cloudCount, localCount }`
- `login:merge-dialog-result` — `{ choice: "pull" | "discard", cloudCount, localCount }`
- `login:discard-local` — `{ cloudCount }` — the most dangerous path; this is when "use cloud only" replaces everything
- `login:merge-result` — `{ mergedCount, cloudCount, localCount, tombstoneCount }`
- `login:push-to-cloud` — `{ count }`

**Cloud poll** (BlobsContext ~line 452):
- `poll:fetch` — `{ cloudCount, localCount, cloudUpdatedAt, lastPush }`
- `poll:remote-ahead-drop` — `{ droppedIds: string[], mergedCountBefore, mergedCountAfter }` — this is the "cloud wins, drop local-only blobs" path (lines 463–470)
- `poll:merge-applied` — `{ mergedCount, localCountWas }`
- `poll:no-change` — `{ count }`

**Persist effect** (BlobsContext ~line 429–445):
- `persist:upsert` — `{ count, action: "major" | "position" | "debounce" }`
- `persist:skipped-syncing` — `{}`

**User-initiated deletions** (dispatch wrapper ~line 233):
- `dispatch:delete` — `{ id, blobCountBefore }`
- `dispatch:delete-many` — `{ ids: string[], blobCountBefore }`

**Logout/account switch** (BlobsContext ~line 395):
- `logout:clear` — `{ wasCount, reason: "logout" | "account-switch" }`

## New file: `lib/sync-log.ts`

```ts
const MAX_ENTRIES = 200;
const ring: Array<{ ts: string; event: string; detail: Record<string, unknown> }> = [];

export function syncLog(event: string, detail: Record<string, unknown> = {}): void {
  const entry = { ts: new Date().toISOString(), event, detail };
  if (ring.length >= MAX_ENTRIES) ring.shift();
  ring.push(entry);
  console.log(`[blob sync] ${event}`, detail);
}

export function getSyncLog() { return ring; }

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__blobSyncLog = ring;
}
```

The `ring` array is the same object exposed on `window.__blobSyncLog`, so it stays live without any extra wiring.

## Changes summary

- **New file:** `lib/sync-log.ts` — ring buffer + `syncLog()` + `getSyncLog()`
- **Edit:** [contexts/BlobsContext.tsx](contexts/BlobsContext.tsx) — replace/augment existing `console.log` calls with `syncLog(...)` at every branch point listed above; add `blobCountBefore` capture in dispatch wrapper before `dispatchReducer`
- **Edit:** [lib/persistence.ts](lib/persistence.ts) — replace existing `console.error` with `syncLog("error:...", ...)` so errors are also in the ring buffer

## How to use after blobs disappear

Open DevTools console and run:

```js
copy(JSON.stringify(__blobSyncLog, null, 2))
```

Paste into any text editor. Look for the last `poll:remote-ahead-drop`, `login:discard-local`, or `dispatch:delete-many` event and read its `detail` to know exactly what happened.
