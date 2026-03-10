# Plans

Plans are sorted by **Date** (last actioned) descending.

| Friendly name | Description | Status | Date |
| ------------ | ----------- | ------ | ---- |
| [Full undo and redo](plans/full-undo-and-redo.md) | Snapshot-based undo/redo in BlobsContext; Undo and Redo buttons in main menu. | Complete | 2026-03-08 |
| [Fix Google login buttons](plans/fix-google-login-buttons.md) | Make Login/Create account redirect to OAuth, add /auth/callback, show message when Supabase not configured. | Complete | 2026-03-08 |
| [Fix cloud sync](plans/fix-cloud-sync.md) | Fix race where persist overwrites cloud before login merge; always push merged result; add error logging. | Complete | 2026-03-08 |
| [Edit cue icon buttons](plans/edit-cue-icon-buttons.md) | Replace div-based edit cues with icon buttons (10 Variant Recording icons); extend EditSource and tooltips. (Different project.) | Unknown | 2026-03-08 |
| [Blob notes web app](plans/blob-notes-web-app.md) | Tap-to-create notes app (Next.js, Supabase): bullets, drag, localStorage + Google login with merge on first sign-in. | Complete | 2026-03-08 |
| [Greeking Facility](plans/greeking-facility.md) | Scale-threshold greeking in BlobCard: replace content with bar placeholders when blob is too small on screen; suppress link-preview when greeked. | Not started | 2026-03-08 |
| [Plans directory overview](plans/README.md) | How to store and commit plans in `plans/`. | Complete | 2026-03-08 |

Add new rows as you create plan files under `plans/` (e.g. `plans/feature-x.md`). Use status: **Complete**, **Not started**, or **Unknown**. Set **Date** to the last time the plan was actioned (e.g. last commit that touched it, or today when adding).
