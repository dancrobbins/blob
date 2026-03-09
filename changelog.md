# Changelog

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

## 2026-03-08
- Rebuilt all app icons (web, Android, iOS, Windows) from the new iridescent Blobby source image.
- Updated generate-icons.js to also write icons to public/assets/icons/ so Next.js serves them.
- Fixed controls overlay (`controlsOverlayInner`) intercepting all pointer events across the entire viewport — set `pointer-events: none` on the inner container and `pointer-events: auto` on `.wrapper` elements, so only drag handles and menu buttons are interactive.
- Fixed pinch-to-zoom by restoring the missing `lastPinchRef.current` update in `handlePointerMove`.
- Fixed drag handles not receiving pointer events: `.dragHandle` is absolutely positioned outside `.wrapper`'s box, so added `pointer-events: auto` directly on `.dragHandle`.
- Fixed drag: React portal event bubbling caused the canvas `handlePointerDown` to fire on drag-handle pointer-downs, stealing pointer capture from the drag handle. Added `data-blob-controls` to the controls fragment wrapper and bail checks in `handlePointerDown` and `handlePointerUp`.
- Fixed drag handle and `…` button not showing on hover: card body and controls wrapper are in separate DOM trees, so CSS `:hover` selectors don't bridge them. Added `isHovered` React state driven by `onMouseEnter`/`onMouseLeave` on both the card body and the controls wrapper, communicated via `data-hovered` attribute.
- Fixed hover gap: drag handle is outside `.wrapper`'s box, so hovering the card and then moving toward the drag handle would briefly leave both — added 80ms debounce on `onMouseLeave` and `onMouseEnter`/`onMouseLeave` directly on the drag handle element.
