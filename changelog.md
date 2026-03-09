# Changelog

## 2026-03-09 (multi-select menu button theme)
- The \"…\" button on the multi-selection overlay now uses the same styling as the blob \"…\" button in dark theme (dark background and matching hover), instead of appearing in the opposite theme.

## 2026-03-09 (no per-blob hover UI during multi-select)
- When two or more blobs are selected, individual blobs no longer show their on-hover UI (drag handle and \"…\" menu); only the selection overlay's controls are shown.

## 2026-03-09 (selection overlay moves with pan)
- During press-and-drag canvas (pan), the multi-selection dashed rectangle and its controls now move with the canvas. Selection bounds are computed in world coordinates and the overlay is rendered inside the transformed canvas layer.

## 2026-03-09 (press-and-drag does not deselect)
- The press-and-drag canvas action (drawing a selection rectangle) no longer clears the current selection when you press; the selection updates only when you release to the blobs enclosed by the new rectangle.

## 2026-03-09 (multi-select controls outside rect, hover-only)
- The \"…\" and drag buttons for the multi-selection rectangle are now outside the upper left corner of the selection (like blob cards) and appear only when hovering over any part of the selection rectangle.

## 2026-03-09 (camera zoom-to-fit and last-write-wins)
- Zoom-to-fit now saves camera to the cloud immediately so refresh rehydrates it.
- Camera uses last-write-wins by timestamp so another tab or device does not overwrite a newer view.

## 2026-03-09 (theme in cloud, rehydrate on load)
- Theme is persisted in the cloud and rehydrated on app load; login merge no longer overwrites cloud theme with local.

## 2026-03-09 (undo merge restores blob position)
- After undoing a merge, the blob that was dragged is put back exactly where it was on the canvas before the drag (single- or multi-blob drag).

## 2026-03-09 (Escape deselects blobs)
- Pressing the Escape key deselects any selected blobs.

## 2026-03-09 (undo for structure editing and cut/paste)
- Undo and redo now apply to bullet structure editing: Ctrl+Up / Ctrl+Down (move line), Tab and Shift+Tab (indent/outdent) in both Raw and Preview, and to cut from and paste into a blob.

## 2026-03-09 (multi-selection rect blob shape only)
- Multi-selection dashed rectangle is based on the blob shape bounds (the card) only; it no longer includes the on-hover controls (drag handle and \"…\" menu), which live in a separate overlay.

## 2026-03-09 (Blobby chat hide on leave after action)
- After doing any action with the Blobby chat (e.g. Copy or opening the \"...\" menu), moving the mouse or finger off the chat output now hides the output.

## 2026-03-09 (link preview hit area and event handling)
- Link preview no longer disappears when moving the mouse from the link toward the thumbnail; extended 16px hit area around the preview so it is easier to mouse onto.
- Link preview closes on click outside (like blob menu) and on mouse leave of the preview only; z-order and event handling aligned with popup menus.

## 2026-03-09 (camera position in cloud)
- Zoom and pan (camera position) are now saved to the cloud and restored on refresh when logged in.

## 2026-03-09 (cursor down after move line to top)
- Fixed: after moving a bullet line to the topmost position (Ctrl+Up), pressing the Down arrow to move to lower lines failed. The selectionchange handler was moving the caret to the first line whenever it was at the start of any line; it now moves the caret only to \"after the bullet\" within the same line.

## 2026-03-09 (link hover preview thumbnail)
- Hover over a URL in Preview for 3 seconds to show a thumbnail preview of the destination (og:image); tap the preview to open the URL in a new tab; mouse out of the preview to hide it; preview is clamped to stay fully on-screen.

## 2026-03-09 (URL tap opens new tab only)
- Tapping a URL in Preview opens it in a new tab only; the app tab is no longer replaced (pointerdown + click both prevent default).

## 2026-03-09 (merge insertion bar)
- On merge, a subtle horizontal insertion bar appears in the target blob: at the top of the target's content area when the dragged blob is above its midpoint, at the bottom when below, spanning the width of the target blob's text area.

## 2026-03-09 (no localStorage when logged in)
- When you are logged in, nothing is stored in local storage; data is kept only in memory and in the cloud to reduce security risk on shared devices.

## 2026-03-09 (Blobby log in cloud)
- Blobby chat log is now saved to the cloud with your account (Supabase user_notes.data.blobbyLog); anonymous users continue to use localStorage.

## 2026-03-09 (Preview mode clickable links)
- Preview mode: markdown links [text](url) now render as clickable links; clicking opens the URL in a new tab.

## 2026-03-09 (paste URL as markdown link)
- Pasting a URL into a blob inserts it as a markdown link [url](url) so it is clickable in markdown view and when copied.

## 2026-03-09 (Blobby hover recall and log)
- Hover over Blobby for at least 3 seconds to show the last displayed output again, with the \"...\" button.
- All Blobby (AI) output is logged in markdown with date/time metadata and saved with the project (localStorage).

## 2026-03-09 (Blobby copy provenance)
- Copy from Blobby's chat now appends \"-- Blobby the AI said this on <date and time>\" so pasted text has simple provenance.

## 2026-03-09 (Blobby options button position)
- Blobby output: \"...\" button is now in the upper-left outside the chat bubble, with a large hit area so it stays tappable as the mouse or finger moves toward it.

## 2026-03-09 (merge content by drop position)
- Blob merge content order: when you drag a blob onto another, the dragged blob's text is merged at the top of the stationary blob if the dragged blob is above the stationary blob's vertical midpoint, and at the bottom if below.

## 2026-03-09 (zoom to fit)
- Renamed Show all to Zoom to fit; the command always changes pan and zoom so visible blobs fill the screen; the button is always enabled.

## 2026-03-09 (dragger to menu button hit region)
- Fixed \"…\" button disappearing or not tappable when moving cursor from dragger to the button: portaled controls wrapper now has explicit size so hover stays active and the button stays visible and clickable.
- Fixed \"…\" button disappearing when hovering it: menu button and menu wrap now reinforce hover (onMouseEnter) so the button stays visible and tappable.

## 2026-03-09 (merge in Raw no resize)
- When merging blobs in Raw mode, the merged blob keeps the target blob's current size: we capture the target's size from the DOM before merging so it doesn't resize after the merge.

## 2026-03-09 (show all full extent)
- Show all now uses each blob's actual rendered size (measured from the DOM) so the full extent of every blob is on screen; blobs that grew with content are no longer cropped.

## 2026-03-09 (show all controls on screen)
- Show all now reserves space on the left so draggers and \"...\" buttons for all visible blobs stay on screen when you hover each blob.

## 2026-03-09 (merge on fused cue release)
- Releasing (mouse up or finger lift) while the joined/fused merge cue is shown now merges the two blobs; previously merge required an even closer threshold.

## 2026-03-09 (merge cue inner card bounds)
- Merge cue outline now measures the blob card shape only (excludes hover controls like drag handle and "..." button); fused outline traces each blob's actual contour with concave bridge curves at the overlap zone.

## 2026-03-09 (merge outline contours)
- Merge outlines when overlapping now follow each blob's contour and form one continuous path with no discontinuities.

## 2026-03-09 (raw switch no resize)
- When switching to Raw, all blobs keep their current size: we now capture every blob's size from the DOM (not only blobs without stored size) so none resize.

## 2026-03-09 (raw view fill)
- Raw markdown view: textarea now fills the full blob card so text uses the whole blob instead of a small scrollable region.

## 2026-03-09 (merge cue fixes)
- Merge cues: dragging blob uses live position (with measured size) so its cue stays aligned with the card; fused shared outline appears when cue rects are within 12px, not only when overlapping.

## 2026-03-09 (preview no scrollbars)
- Preview mode: blob cards no longer use fixed height; height follows content so no scrollbars or empty vertical space.

## 2026-03-09 (preferences sync on poll)
- Preferences (theme, blobby color, etc.) now sync when polling the cloud so other tabs see changes without re-login.

## 2026-03-09 (resize fit content)
- Resize blobs to fit content: horizontal resize adjusts height (wider → shorter, narrower → taller); vertical resize adjusts width (taller → narrower, shorter → wider).

## 2026-03-09 (deletion sync)
- Blob deletions are synced via Supabase so other logged-in clients see deletions (poll applies remote deletions when cloud is ahead).

## 2026-03-09 (tap to create)
- Fixed tap on canvas no longer creating a blob (removed check that blocked create when focus had been in a blob).

## 2026-03-09 (raw view size)
- When switching to Markdown Raw, blob sizes are preserved (current size is captured from DOM so no blobs resize).

## 2026-03-09 (show all fit)
- Show all now fits the full bounds of every visible blob (uses actual blob width/height instead of a fixed small box) so none are cropped.

## 2026-03-09 (show all robustness)
- Show all button is now enabled whenever any blob is partially or fully off screen (derived from viewport and blob bounds).

## 2026-03-09 (blob menu commands)
- Blob \"...\" menu: Duplicate, Lock, Hide, Delete now take effect (data-popup-menu pointer-events, onPointerDown + onClick with dedupe, Hide uses onHide).

## 2026-03-09 (blob proximity merge)
- When two blobs are dragged close, a dynamic SVG boundary wraps both; when very close, release to merge the dragged blob's content into the other and remove the dragged blob.
- Merge boundary is visual only (pointer-events: none) and does not affect selection or hover.

## 2026-03-09 (merge cue states)
- Merge cues: each blob gets a 12px-padded rounded rectangle; when cues overlap they fuse into one melted boundary.
- Three states: separate cues, then fused/melted outline when dragged blob is close enough for cues to overlap.

## 2026-03-09 (merge cue size)
- Merge cues now follow each blob's actual rendered size (measured from the DOM) with 12px padding instead of default 280×200.

## 2026-03-08 (blob menu)
- Move bullet up/down changed to Ctrl+↑/↓ (same on Windows and Mac) — safest cross-platform arrow shortcut with no OS, browser, or Electron intercept.
- Fixed blob \"...\" menu: Duplicate, Lock, Hide, Delete work; popup layer no longer blocks canvas (portal container pointer-events: none, menu pointer-events: auto).

## 2026-03-09 (build fix)
- Removed pages directory (was only _document.tsx) so the build no longer fails with "Cannot find module for page: /_document" or missing pages-manifest; app is App Router only.

## 2026-03-09 (mobile pinch zoom)
- Move bullet up/down changed to Ctrl+Shift+↑/↓ (Cmd+Shift+↑/↓ on Mac) — Alt+Arrow was intercepted by Electron/Windows menu bar before reaching the app.
- Fixed two-finger pinch zoom on iOS Safari.

## 2026-03-09 (blob view)
- Bullet conversion: parse and serialize only use markdown; leading list markers stripped from line text so bullets never double on login/sync.
- Move line up/down (Alt+↑/↓) and Tab/Shift+Tab indent work in both Raw and Preview; document-level capture; Raw moves/indents by line in markdown.
- On logout or switch account: clear all blobs from the scene and remove blob data from local cache for security and privacy.
- Main menu: Blob text toggle (Raw / Preview). Raw shows markdown source in an editable textarea; Preview shows the line-based editor (bullets, todos). Both modes editable; preference persisted.
- Preview mode: fixed typing by not rebuilding DOM on every keystroke; only sync from blob.content when content came from outside (e.g. sync) or when switching blob/view.

## 2026-03-09 (multi-cursor)
- Multi-cursor presence on canvas: when logged in with Google, other sessions (same user on other tabs or devices) show a cursor with display name and avatar; same user on multiple sessions gets disambiguated labels (e.g. \"Name 1\", \"Name 2\").
- Board owner id in BlobsContext for presence channel; design allows shared boards later (viewers join owner's channel).
- Presence via Supabase Realtime; cursor position in world coordinates, throttled updates; OtherCursors component with pointer, avatar circle, and label.

## 2026-03-08 (later)
- Blob internal representation is now standard Markdown; content stored as markdown string. Migration: old blobs with lines or legacy • content are converted to markdown on load.
- Copy/paste uses markdown; in-app paste round-trips bullets, todos, numbered lists, strikeout. Summarize and title APIs use plain text derived from markdown.
- Paste from web: use full plain text when HTML only had a short snippet so large pastes are no longer truncated.

## 2026-03-09
- testSync fixture: complete rewrite — uses launchPersistentContext directly without a broken browser wrapper; isolated temp profile deleted after each run.
- testSync login detection: polls Supabase localStorage token (sb-*-auth-token) instead of waiting for toast to hide; reloads tabs every 5s until session is detected, handles OAuth redirects that open in extra tabs.
- Fixed build error in blob-markdown.ts: token.raw access now uses (token as any).raw with split('\n')[0] instead of /s regex flag (not supported at current TS target).
- Fixed build error in page.tsx: UPDATE_BLOB dispatch now converts BlobLine[] to markdown string via linesToMarkdown() to match the action type.

## 2026-03-08
- Fixed Backspace on empty line: caret now moves to end of previous line (deferred with rAF); placeCaretInLine supports multiple text nodes per line.
- Raw and Preview: locked blobs are read-only in both modes; Preview-only effects run only in Preview; Undo snapshot when focusing Raw so Undo works after editing in Raw.
- Backspace on an empty bullet line deletes that line and moves the caret to the end of the previous line; if it's the only line, caret stays after the bullet.
- Move bullet up/down now Alt+↑ and Alt+↓ (Option+↑/↓ on Mac) so they work on Windows; keyboard-shortcuts.md updated.
- Fixed Login: when OAuth redirects to / with ?code=... (instead of /auth/callback), redirect to callback so the session is established.
- Move line up/down (Ctrl+Alt+↑/↓) now handled in capture phase so they work like OneNote; also accept Up/Down key names.
- When Gemini rate limit (429) is hit, Blobby shows: \"The AI limit has been reached. Try again tomorrow.\"
- Keyboard shortcuts when editing a blob: Ctrl+Alt+↑/↓ move bullet before/after adjacent; Tab indents, Shift+Tab unindents (Mac: Ctrl+Option+↑/↓).
- Bullet indent levels (0–5) with Tab/Shift+Tab; new lines inherit current line indent.
- keyboard-shortcuts.md lists all blob-editing shortcuts for Windows and Mac.
- Bullets in blobs are now a line style, not deletable text; cursor cannot be placed to the left of a bullet.
- Extensible line model: each line has text plus style (bullet, indent, todo, strikeout) and optional checked flag for todo.
- Copy/paste within blob preserves line styles; paste from other apps detects lists and indentation.
- Copy to external apps uses structured HTML when possible and plain text with bullet characters as fallback.
- Added testSync command: runs two-tab Google sync E2E test (rebuild, restart dev server, Playwright), reports result in plain English with recommended fixes.
- Test mode (?e2eSync=1): overlay toast prompts to log in to Google in both tabs; toast hides when both are logged in. Lower-right test control button: Cancel test / Rerun test.
- Playwright E2E: tests sync of text edits, blob create/delete, theme, lock/unlock across two tabs. CI support via PLAYWRIGHT_STORAGE_STATE_BASE64.
- Blobby chat word box uses blobby chat background.svg as its background.
- Tap Blobby to get a short prose summary of all blob text via Gemini (optional GEMINI_API_KEY in .env.local).
- Silent: Blobby says nothing. Comments: Blobby shows test phrases on timer (unchanged rules).
- Widened main menu and Silent/Comments toggles so label text fits fully.
- Renamed Blobby menu label from Commenting to Comments.
- Added Silent / Commenting toggle in main menu (Blobby); controls preference for proactive talking (no behavior yet).
- Blobby backer is the same in light and dark and always visible when switching themes.
- Blobby backer fully removed in light mode: CSS hide by data-theme plus back circle transparent.
- Blobby backer is shown only in dark mode; removed from light mode.
- Reverted: Blobby back circle again uses dark-theme override (light tint in dark mode).
- Blobby and blobby backer now look the same in light and dark mode (removed dark theme override).
- Blobby backer slider default is now 200 (was 100).
- Blobby backer: S/M/L replaced with 100–500 px slider; single graphic (blobby backer L.svg); default 100.
- Blobby backer default size is now S (was M).
- Login/account dropdown menu now uses dark background, border, and shadow in dark mode.
- Removed single blobby backer; added S/M/L toggle in main menu to choose blobby backer size (SMALL, MEDIUM, LARGE).
- Replaced solid circle behind Blobby with assets/graphics/blobby backer 01.svg; sync script now copies graphics to public.
- Smallest filled circle around Blobby in bottom-band color (#FDFDFD), behind Blobby and in front of blobs.
- Undo/redo keyboard shortcuts: Ctrl+Z and Ctrl+Shift+Z (Windows/Linux), Cmd+Z and Cmd+Shift+Z (Mac); Ctrl+Y redo on Windows.
- Typing undo is by word: one undo step per word (space/punctuation/Enter) or per Ctrl+Backspace word delete, not per character.
- Bottom band in light and dark mode is now #FDFDFD.
- Dark mode background: bottom band is white (same as light); gradient above goes from white to deep dark blue.
- Fixed dark mode background: bottom band is now black and gradient goes from black to deep dark blue (no longer white band).
- App background is now a gradient (light blue-gray to white in light mode; dark blue-gray to black in dark mode) with a solid band behind Blobby at the bottom.
- Undo and Redo moved to the top of the main menu with curved-arrow icons.
- Full undo and redo for blob state (add, delete, move, edit, lock, hide, etc.); one undo step per drag.
- Undo and Redo buttons added to the main menu; disabled when there is nothing to undo or redo.
- Locked blobs now have no drop shadow instead of a lock icon or opacity change.

## 2026-03-08
- App error boundary: TypeScript or runtime errors now show a 'Something went wrong' screen with Reload instead of a blank page.
- Connectivity guard: if the server is unreachable, an orange banner tells you to start the dev server and reload.
- Blobby and main menu Blobby preview no longer show broken image icons when assets fail to load; they show a fallback or 'Preview unavailable'.
- Added Lock and Unlock to the '...' menu on every blob.
- Added 'Unlock all' to the main menu (disabled when no blobs are locked).
- Locked blobs show a lock icon and subtle visual cue; Delete moved to bottom of blob menu with red text.

## 2026-03-07 (latest)
- Fixed broken app caused by stale dev server: runapp now always kills and restarts the dev server after every build.
- Added port guards for 3000, 3001, 3002, 3003 in runapp.js to prevent asset hash mismatches.

## 2026-03-07
- Build version tooltip shows what's new; hover (desktop) or tap (mobile) the build date in the main menu.
- Build tooltip now updates after runapp without restarting the dev server.
- Build number increments automatically on every build.
- Post-feature rule: update version.json with current-build bullets, run runapp, refresh with cache-bust.
- Show all button in main menu pans and zooms the view to fit all blobs.
- Use updated character graphics; Blobby color scheme choice updates bottom character and shows selection highlight in menu.
- Persist character (Blobby) selection with user account; restore on sign-in.
- Added pushme, pushall, runapp, restartall commands.
- Auto-generate build tooltip bullets from git commits when version.json updates are empty.
- Fixed production/deployed error: Cannot find module './276.js' by copying server chunks so the runtime can load them.
- When sign-in redirects to the home page with tokens in the URL, the app now sends you to the callback page and cleans the URL so the UI stays correct.
- Fixed JSX parse error in TypeScript errors debug panel so the app builds.
- When the TypeScript check fails to load (network/500), an amber "Could not check TypeScript errors" button appears so you know something is wrong.
- Red "TypeScript errors" button is preserved when a later fetch fails; previous errors stay visible until a successful check clears them.
- Sign-in no longer sends deployed users to localhost: OAuth redirect URL is rewritten to the current site when Supabase returns localhost.
- Supabase dashboard: add https://blobapp.vercel.app and https://blobapp.vercel.app/auth/callback to Redirect URLs so post-login redirect stays on production.
pp.vercel.app and https://blobapp.vercel.app/auth/callback to Redirect URLs so post-login redirect stays on production.

## 2026-03-09
- Merge boundary outline now extends leftward to include the drag handle and … button so controls no longer protrude outside the boundary during a drag-to-merge.
- Replaced the organic fused merge boundary path (complex arc-tracing algorithm) with a clean single rounded-rect outline encompassing both blobs.
- Removed ~130 lines of dead arc-tracing helper code from blob-boundary-path.ts.
- Blobby word box now caps its height (min(260px, 40vh)) with vertical scroll so a long AI summary cannot cover the canvas.

## 2026-03-09
- Blobby output box: hover shows a subtle ring and a '...' button; clicking '...' opens a menu with a Copy option.
- Blobby output box: scrollbar is now fully interactive (pointer events enabled on the word box).
- Blobby output box: hovering over the output pauses the auto-hide timer so the text stays visible.

## 2026-03-08
- Rebuilt all app icons (web, Android, iOS, Windows) from the new iridescent Blobby source image.
- Updated generate-icons.js to also write icons to public/assets/icons/ so Next.js serves them.
- Fixed controls overlay (`controlsOverlayInner`) intercepting all pointer events across the entire viewport — set `pointer-events: none` on the inner container and `pointer-events: auto` on `.wrapper` elements, so only drag handles and menu buttons are interactive.
- Fixed pinch-to-zoom by restoring the missing `lastPinchRef.current` update in `handlePointerMove`.
- Fixed drag handles not receiving pointer events: `.dragHandle` is absolutely positioned outside `.wrapper`'s box, so added `pointer-events: auto` directly on `.dragHandle`.
- Fixed drag: React portal event bubbling caused the canvas `handlePointerDown` to fire on drag-handle pointer-downs, stealing pointer capture from the drag handle. Added `data-blob-controls` to the controls fragment wrapper and bail checks in `handlePointerDown` and `handlePointerUp`.
- Fixed drag handle and `…` button not showing on hover: card body and controls wrapper are in separate DOM trees, so CSS `:hover` selectors don't bridge them. Added `isHovered` React state driven by `onMouseEnter`/`onMouseLeave` on both the card body and the controls wrapper, communicated via `data-hovered` attribute.
- Fixed hover gap: drag handle is outside `.wrapper`'s box, so hovering the card and then moving toward the drag handle would briefly leave both — added 80ms debounce on `onMouseLeave` and `onMouseEnter`/`onMouseLeave` directly on the drag handle element.
