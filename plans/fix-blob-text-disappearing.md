---
name: Fix blob text disappearing
overview: Prevent cloud from being overwritten with empty state when the cloud fetch fails at login (network/RLS) and local storage is empty — the previously missing root cause of "blob text disappeared."
todos:
  - id: no-push-when-fetch-fails-and-local-empty
    content: When fetchUserBlobs returns null, only push local to cloud if local.length > 0; set state from local either way
    status: completed
  - id: cloud-known-ref
    content: Add cloudKnownRef; set true after successful cloud read or after pushing local; skip persist when blobs empty and !cloudKnownRef
    status: completed
  - id: persist-skip-empty-unknown
    content: In persist effect and position timeout, skip upsert when blobs.length === 0 && !cloudKnownRef
    status: completed
isProject: false
---

# Fix: Blob text disappearing (root cause)

## Root cause (from sync debug logs)

When **cloud fetch fails** at login (network error, Supabase RLS, timeout, etc.), the app treated "no cloud" as "cloud is empty" and pushed **local** to the cloud. If local was empty (e.g. localStorage had been cleared on a previous login), the app **overwrote the cloud with 0 blobs**, wiping real data. A later tab or refresh would then fetch that empty cloud and show no blobs/text.

Sequence:

1. Tab A has 4 blobs in the cloud.
2. User opens Tab B (or refreshes). Tab B’s `fetchUserBlobs` fails (e.g. transient network).
3. Tab B has `local = []` (localStorage was cleared when they last logged in).
4. Code hit `if (!cloud)` and did `upsertUserBlobs(userId, current, ...)` with `current = []`.
5. Cloud was overwritten with empty. Tab A (or a later load) then saw 0 blobs.

## Fix

1. **When fetch fails (`!cloud`):** Still set state from local. Only call `upsertUserBlobs` if `current.length > 0`. Never overwrite the cloud with empty when we didn’t successfully read the cloud.

2. **`cloudKnownRef`:** True once we’ve successfully read cloud (or pushed local after a failed fetch). In the persist effect, if `blobs.length === 0` and `!cloudKnownRef`, skip the upsert so we don’t later push empty state (e.g. from a debounced run) before the next poll succeeds.

3. **Poll:** When a poll successfully fetches cloud, set `cloudKnownRef.current = true` so persist is allowed again (e.g. after user deletes all blobs).

4. **New sync log:** `persist:skipped-empty-unknown-cloud` when we skip the persist for this reason; and `login:no-cloud-push-local` now includes `willPush: current.length > 0`.

## Files changed

- `contexts/BlobsContext.tsx`: cloudKnownRef, login no-cloud path, persist skip, poll set cloudKnownRef, logout reset.
