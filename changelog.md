# Changelog

## 2026-03-10 (Remove empty lines shortens blob)
- **Remove empty lines** (blob "..." menu and multi-select menu) now shrinks the blob card height when the text gets shorter, so the card no longer leaves empty space below. Works in both Preview and Raw view.

## 2026-03-10 (Desktop: Blobby chat from upper-right)
- In **desktop** mode, the Blobby messages/chat bubble is now positioned from Blobby’s **upper-right corner**: the top of the chat aligns with the top of the Blobby container, and the chat extends to the right (and down as needed).

## 2026-03-10 (Desktop: vertical scrollbar when blob height is reduced)
- On **desktop**, when the user resizes a blob so its height is fixed and not all content fits (e.g. many bullet lines), the blob card now shows a **vertical scrollbar** so the content can be scrolled. The same behavior applies whenever the card has a fixed height (user-resized or mobile focus).

## 2026-03-10 (Mobile: Blobby chat at bottom-right of Blobby)
- In **Mobile** mode, the Blobby messages/chat bubble is positioned at the **bottom-right** of Blobby (below the top bar and to the right of the character). Left is anchored to Blobby’s right edge + gap; clamping keeps the box on screen.

## 2026-03-10 (Fix blob text disappearing)
- **Root cause:** When the cloud fetch failed at login (network/RLS) and local storage was empty, the app pushed empty state to the cloud and overwrote real data. A later tab or refresh would then see 0 blobs.
- **Fix:** When fetch fails, we only push local to the cloud if local has blobs; we never overwrite the cloud with empty when we didn’t successfully read it. A `cloudKnownRef` ensures we don’t persist empty state until we’ve either read cloud or pushed local data. Sync log: `persist:skipped-empty-unknown-cloud` and `login:no-cloud-push-local` now includes `willPush`.

## 2026-03-09 (Mobile: hide Blobby size slider)
- In **Mobile** platform mode, the **Blobby size** percentage slider is hidden in the main menu (Blobby is fixed to the top bar height).

## 2026-03-09 (Mobile: white top bar, Blobby in bar without backer)
- In **Mobile** mode: a **white horizontal bar** spans the top of the app (same height as the main menu button / avatar row). The bar does **not** capture pointer events (clicks pass through). The **Blobby backer is hidden** and **Blobby** (the character) is **resized to fit the bar height** and centered in it; an invisible tap target keeps Blobby tappable.

## 2026-03-09 (Blobby word box follows Blobby, on-screen)
- The Blobby messages/chat bubble (and "..." menu) now **follow Blobby** wherever it is placed (top in mobile, bottom on desktop). The box is positioned above Blobby on desktop and below Blobby on mobile, and its position is **clamped** so it stays fully on screen (no overflow off top, bottom, or sides).

## 2026-03-09 (Sync debug log from menu)
- Main menu now has **Copy sync debug log**: copies the in-memory sync event log to the clipboard so you can paste it into a file or support ticket without opening DevTools or a terminal.

## 2026-03-09 (Blobby size range and default)
- **Blobby size** slider range is now 25%–100% (was 50%–100%); default is 50% (was 75%).

## 2026-03-09 (Blobby size slider value width)
- Main menu **Blobby size** slider value field now has a fixed minimum width (4ch) so it fits three digits (e.g. 100%) without the layout shifting when the value changes from 99 to 100.

## 2026-03-09 (Sync debug logging)
- Sync debug log: in-memory ring buffer exposed as `window.__blobSyncLog`; logs login merge, poll (including remote-ahead drop), persist, delete, and content counts for diagnosing missing blob text. In DevTools run `copy(JSON.stringify(__blobSyncLog, null, 2))` to export.

## 2026-03-09 (Mobile: Blobby at top, blob fills height)
- In **Mobile** mode, the Blobby unit (character + backer) is now positioned at the **top** of the app (below the header) instead of the bottom. When you tap into a blob (focus-on-blob), the blob is resized vertically to **fill the available height** (the space below the header and below Blobby).

## 2026-03-09 (Mobile: no rectangle drag select)
- In **Mobile** platform mode, one-finger drag on the canvas no longer starts rectangle selection; pan and rectangle select are both disabled.

## 2026-03-09 (Blobby size slider: percentage of backer)
- The main menu **Blobby backer** slider is now **Blobby size**: a percentage of the blobby backer (50%–100%, default 75%). The backer (container) size is unchanged; only the character size relative to it is adjusted.

## 2026-03-09 (Desktop restore: blob width + height fit content)
- When switching from **Mobile** back to **Desktop**, the blob that had been focused in mobile is restored: its width is set back to the pre-mobile desktop width, then its height is set so no vertical scrollbar is needed (height fits content).

## 2026-03-09 (Blobby + backer in one container)
- Blobby and the blobby backer are now inside a single container. Only that container is resized: by **Platform** (mobile = half size) and by the **Blobby backer** slider in the main menu. No separate sizing of Blobby vs backer, so they stay centered with each other.

## 2026-03-09 (Mobile mode: no one-finger pan)
- In **Mobile** platform mode, panning the canvas with one finger is disabled. A one-finger drag on empty canvas starts rectangle selection instead of pan. Two-finger pinch zoom is unchanged.

## 2026-03-09 (Mobile mode: wheel scrolls blob content)
- When **Platform** is set to **Mobile** (even on a desktop with a mouse), mouse wheel over a blob with scrollable content (mobile-fill) now scrolls that blob’s content instead of zooming the canvas.

## 2026-03-09 (Mobile focus: pan top-left then resize)
- In **Mobile** mode, when you tap into a blob the sequence is now: (1) zoom the view to default font size, (2) pan so the blob’s **upper-left corner** is at the **upper-left corner** of the app (with padding), (3) then resize the blob (width to screen, height to viewport). Previously the view was centered on the blob before resize.

## 2026-03-09 (Blobby centered in backer)
- Blobby (the character and its back circle) is now always vertically and horizontally centered in the blobby backer. Position is computed from the backer size so the two stay aligned at any backer or platform size.

## 2026-03-09 (Mobile: Blobby and backer half size)
- In **Mobile** platform mode, Blobby (the character) and the blobby backer circle are rendered at half their desktop size (50px and half the backer slider value respectively). Blob control overlay still avoids the smaller blobby region.

## 2026-03-09 (Platform toggle and mobile focus-on-blob)
- Main menu: **Platform** toggle with **Mobile** and **Desktop**. Default is sniffed from the device (coarse pointer = mobile); user can override and choice is persisted.
- In **Mobile** mode, when the user taps into a blob to edit it, the view zooms so the blob text is at default readable size (16px) and the blob width is set to the screen width (with padding), centering the blob for single-blob focus.

## 2026-03-09 (iOS Safari: menu and avatar stay visible)
- On iOS Safari, the app no longer zooms or moves as a whole: viewport scale is locked (canvas keeps its own pinch-zoom), and overscroll/bounce is prevented so the main menu and avatar bubble stay on screen. Header uses safe-area insets for notched devices.

## 2026-03-09 (Blob click selects; Zoom to selection)
- Clicking a blob (or its controls) now selects it, so the main menu \"Zoom to selection\" is enabled. Tapping \"Zoom to selection\" pans and zooms the view to fit the selection. Ctrl/Cmd+click on a blob toggles it in the selection (multi-select).

## 2026-03-09 (Phantom blobs fix)
- Phantom blobs fixed: blobs with positions far off-screen (e.g. canvas at -430, -305) no longer show hover buttons (⋮⋮ and …) in the viewport. The controls overlay is only portaled and clamped when the blob’s card is at least partially in view; otherwise the card and controls stay in canvas space so they are both off-screen.

## 2026-03-09 (Merge margin slider on its own row)
- Main menu: the Merge margin slider is now on its own row, separate from the Merging (Strict/Loose) row.

## 2026-03-09 (Remove empty lines disabled when none)
- \"Remove empty lines\" in the blob \"...\" menu and in the multi-select menu is now disabled when the blob (or all selected blobs) have no empty lines (blank or bullet-only lines).

## 2026-03-09 (Copy debug info in blob menu for danrobbins@gmail.com)
- Renamed \"CopyID\" to \"Copy debug info\". It now copies a full debug block: blob id (GUID), canvas (x,y), size, hidden, locked, selected, partOfMultiSelection, createdAt, updatedAt, contentLength, and contentPreview (first 80 chars).

## 2026-03-09 (Blobby look animations while summary loading)
- While the LLM summary is loading after tapping Blobby, Blobby randomly cycles through the \"look\" animations (from `assets/animations/look/` or `public/assets/animations/look/`). When the summary returns, Blobby switches back to idle animations.

## 2026-03-09 (Strict merge insert position by cursor)
- In **Strict** merging mode, whether the dragged blob merges at the top or bottom of the target is now based on the **cursor** position relative to the target blob's vertical halfway line: cursor above the center → insert at top; at or below → insert at bottom. Loose mode still uses the dragging blob's center vs target center.

## 2026-03-09 (Merge margin slider)
- Main menu: **Merge margin** slider (10–200 px, default 50) controls the padding around each blob used for merge regions. The merge cue outlines and merge-on-release logic (Strict and Loose) now use this value instead of a fixed 12 px margin. Preference is saved when logged in.

## 2026-03-09 (Blobby tap = new summary, no stored chat while loading)
- Tapping Blobby always requests a new LLM summary. While the summary is loading, the previously stored chat is not shown (only a loading state). When the new summary returns, it becomes the latest entry in the Blobby log.

## 2026-03-09 (Enter at start of line inserts above)
- In blob preview editing, when the caret is at the start of a line (e.g. after pressing Home) and you press Enter, a new line is now inserted **above** the current line and the caret moves into it. Previously the new line was incorrectly inserted below the first line.

## 2026-03-09 (merge region = card rect + margin, overlay from live DOM only)
- Merge region for every blob is now the **card element** (`[data-blob-card-inner]` — the visible rounded rectangle) plus the fixed 12px margin. The overlay only renders when live DOM bounds are available (no stale store fallback), so the cue outline can never be the wrong size (e.g. showing `DEFAULT_BLOB_W × DEFAULT_BLOB_H` for blobs with no explicit size).

## 2026-03-09 (merge region = blob shape + fixed margin, always)
- In Strict merging mode, the **static** blob’s merge region is now computed from its **visible shape** (the content area, `[data-testid="blob-content"]`) plus the margin, with a fixed margin on all sides, for every blob in both modes. So “size of the blob” for merging is the visible shape; the merge region is that shape + margin, and the cursor must be inside that to trigger merge cues.

## 2026-03-09 (Merging toggle and save-when-logged-in)
- Main menu: new **Merging** toggle with **Strict** (default) and **Loose**. Strict: merge cues and merge-on-release only when the cursor (pointer) is inside the other blob's merge region (12px-padded rect). Loose: previous behavior (blob rects overlap or touch).
- Preferences (including Merging) are now saved only when you are logged in; when logged out, preferences are session-only and reset on refresh.

## 2026-03-09 (Remove empty lines menu option)
- Added "Remove empty lines" to the blob "..." menu (single blob and multi-select). When chosen, it removes any lines that are blank or only a bullet from the blob(s).

## 2026-03-09 (merge cues fully DOM-driven, no React lag)
- Merge cue computation (target selection, fused outline, insertion bar) is now done entirely from live DOM `getBoundingClientRect()` readings every animation frame. Previously the merge target was computed from React state/store positions which lagged behind the pointer, causing cues to not appear or to pick the wrong blob when the dragging blob overlapped multiple blobs. Both the dragging blob's position and all stationary blobs' positions are now read from the DOM so detection and rendering are always in sync with what's on screen.

## 2026-03-09 (drag-past-edge hard boundary fix)
- When dragging a blob past the right (or any) window edge, Chromium clamps `clientX` to `innerWidth - 1` on a captured pointer, so `pointermove` stops carrying new cursor positions. The auto-pan RAF was running but `BlobCard.handlePointerMove` only fires on pointer events, so the blob appeared frozen at the edge while the view scrolled. Fix: the RAF tick now also updates the blob position on every pan frame using the stored world-space pick offset and the clamped cursor position plus the newly-applied pan. Edge detection thresholds widened from `>= w` / `<= 0` to `>= w - 1` / `<= 1` to ensure the clamped value triggers panning.

## 2026-03-09 (merge target by most overlap)
- When the dragging blob is near or overlapping multiple blobs, the merge target (and thus merge cues) now uses the blob with the **largest overlap** with the dragging blob instead of the first one in list order. So if more of the dragging blob is over the blob on its left, that one gets the cues.

## 2026-03-09 (drag pick-correlation fix)
- Fixed pick-correlation drift during edge auto-pan: drag now stores a world-space pick offset (cursor world position minus blob world position at drag start) and on every move computes the blob's new position as `worldCursor - pickOffset` using the live panRef/scaleRef. This means when auto-pan shifts the view, the blob immediately tracks the cursor correctly with no slippage. The same fix was applied to multi-blob drag in SelectionOverlay.

## 2026-03-09 (drag blob edge auto-pan)
- When dragging a blob, if the cursor reaches the viewport edge (top, bottom, left, or right), the canvas now auto-pans in that direction so the dragged blob stays in view. Panning starts as soon as the cursor touches the edge and continues at a fixed speed while at the edge.

## 2026-03-09 (hardened user number for multiple sessions)
- User numbers ("Name 1", "Name 2") are now assigned at first arrival and stored in a stable map. Numbers no longer change when presence sync events fire or when sessions reconnect. React state updates when the roster or any label changes (not just session IDs), so the displayed number is always correct. Teardown clears the arrival map so the next channel reconnect starts fresh.

## 2026-03-09 (user number from full presence state)
- The "Name 2" suffix for multiple tabs of the same account was never shown because we built the presence list from *others only*, so each tab only ever saw one other presence and the per-user count was always 1. We now build displayLabels from the *full* presence state (including our own session), assign "Name 1" / "Name 2" by userId, then filter to others and attach the precomputed label. So the other tab's cursor shows "Daniel 2" (or "Daniel 1") correctly.

## 2026-03-09 (remote cursor real-time and user number)
- Remote cursor moves were slow because the hot-path DOM callback was only invoked on join/leave; Supabase delivers cursor updates via **sync** events. Sync now also invokes the callback so cursor position updates apply directly to the DOM every time. React state (otherPresences) is only updated when the set of session IDs changes (someone joins or leaves), so we don't re-render on every move.

## 2026-03-09 (single tap to create blob — root cause fixed)
- Removed accidental setSelectedIds([blob.id]) call from onFocus that was added during the insertion-point fix. It caused the blob to become "selected" whenever it was focused, so the selection-guard in handlePointerUp always blocked the next canvas tap. Single tap on empty canvas now reliably creates a new blob.

## 2026-03-09 (single tap to create blob fixed)
- Removed the document.activeElement DOM check that was blocking new-blob creation. The previously created/focused blob kept DOM focus at pointer-down time, so the check always blocked the tap. The focusedBlobIdRef alone is sufficient: it's set on manual focus and cleared on blur or after auto-focus completes.

## 2026-03-09 (single tap to create blob on canvas)
- Single tap on empty canvas again creates a new blob. The insertion-point guard was treating the newly created (auto-focused) blob as \"user had focus,\" so the next tap was incorrectly skipped. We now clear focusedBlobIdRef in onAutoFocusDone so only manually focused blobs block create-on-tap.

## 2026-03-09 (remote cursor avatar position)
- Avatar bubble and name tag now sit beside the bottom of the pointer icon (right of bottom-right of arrow body), matching the design sketch. Previously they were offset from the hotspot/tip area.

## 2026-03-09 (remote cursor near-real-time DOM update)
- Remote cursors no longer cause a React re-render on every move. Cursor positions are now applied directly to DOM elements via refs (no setState on the hot path). A document-level pointermove listener tracks the local cursor everywhere (including over blob cards, not just the canvas). The rAF double-delay was removed so positions send immediately on move then are throttled at 33ms on the wire.

## 2026-03-09 (cursor icon and near-real-time presence)
- Other users' cursor now uses a standard default pointer icon (inline SVG with notch) instead of a custom path. Cursor presence updates made more real-time: throttle reduced to 33ms and pointer moves batched with requestAnimationFrame so we send at most once per frame (~60/sec) then throttle to 33ms on the wire.

## 2026-03-09 (tap in existing blob activates insertion point again)
- Tapping in an existing blob again activates the insertion point. User focus is now tracked in a ref (focusedBlobIdRef) instead of state so we do not set focusBlobId and trigger the autoFocus effect when the user taps an existing blob; autoFocus remains only for newly created blobs.

## 2026-03-09 (merge cues use live drag position from DOM)
- Merge cues (outline and insertion bar) were not showing when a blob was dragged near or over another because the merge target was computed from React state, which can lag behind the pointer. The dragging blob’s position is now read from the DOM every frame during drag, so the closest blob and “merge possible” state match what’s on screen and cues appear as soon as the blobs overlap.

## 2026-03-09 (merge and overlay only when merge bounds touch)
- Blobs merge on release only when their merge-cue rects (padded blob bounds) touch or overlap, not when merely within 12px. The overlay fused outline and the top/bottom insertion bar now appear only when merge is possible (cue rects touch or overlap).

## 2026-03-09 (pointer cue layout match screenshot)
- Other users' cursor cue adjusted to match design: standard pointer icon (tip at cursor position, base down-right), with avatar and name bubble directly below and to the right of the pointer base with a small gap; avatar and label side-by-side.

## 2026-03-09 (pointer from avatar to cursor tip)
- Other users' (and multiple tabs') cursors now show a pointer line and arrowhead whose tip is at the actual cursor position; the avatar bubble sits directly below and to the right of the pointer base. On mobile, the pointer is shown at the last touch or hover location (already sent via pointer events).

## 2026-03-09 (no new blob when tapping empty canvas with insertion point)
- Tap on empty canvas no longer creates a new blob when a blob already has the text insertion point (cursor). Fix: track which blob has focus via onFocus/onBlur and also check document.activeElement at pointer down so clicking into a blob then clicking empty canvas does not create a new blob.

## 2026-03-09 (near real-time pointer/cursor updates)
- Other users' and multiple tabs' cursors now update in near real time. Throttle reduced from 80ms to 50ms; the first cursor move is sent immediately instead of waiting for the throttle window; the throttle timeout now sends the latest position so the final position is not lost. Presence join and leave events also refresh cursor state so pointer positions stay in sync.

## 2026-03-09 (Undo/Redo tooltips)
- Hovering over the Undo or Redo menu items shows a tooltip with a short description of the action that will be undone or redone (e.g. "Undo: Merge blobs", "Redo: Add blob").

## 2026-03-09 (selection bounds from DOM)
- Selection bounds were previously computed from blob store data (x, y, width, height), which could be out of sync with rendered positions or include corrupted/outlier values and produce an oversized or wrong dashed rectangle. They are now computed from the DOM: each selected blob card's on-screen rect is read and converted to world coordinates, then unioned. The selection rectangle now matches the visible blob shapes and still moves with pan/scale.

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
