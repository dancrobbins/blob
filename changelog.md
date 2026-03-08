# Changelog

## 2026-03-08
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
