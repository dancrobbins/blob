# Changelog

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
