# blob

Tap anywhere to create a blob. Type bulleted lists, drag blobs around. Blobs persist in the browser; sign in with Google to sync to the cloud.

**Live app:** [https://blobapp.vercel.app/](https://blobapp.vercel.app/)

## Setup

1. **Install and run**
   - `npm install`
   - `npm run dev` — app at [http://localhost:3000](http://localhost:3000)

2. **Supabase (optional, for login and sync)**
   - Create a project at [supabase.com](https://supabase.com).
   - In Authentication → Providers, enable Google and add your OAuth credentials.
   - In **Authentication → URL Configuration**, add these URLs to the **Redirect URLs** allow list:
     - Local: `http://localhost:3000/auth/callback`
     - Production: `https://blobapp.vercel.app/auth/callback`
   - In SQL Editor, run the statements in `supabase-schema.sql` to create the `user_notes` table and RLS.
   - Create `.env.local`:
     - `NEXT_PUBLIC_SUPABASE_URL=` your project URL
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY=` your anon key

3. **LLM summary (optional)**
   - Tap Blobby to get a short prose summary of all blob text. Add to `.env.local`:
     - `GEMINI_API_KEY=` your key from [Google AI Studio](https://aistudio.google.com/apikey)
   - If omitted, the app runs normally; tapping Blobby when no key is set will not show a summary.

4. **Assets**
   - App uses `public/assets` (icons, Blobby graphics). To refresh from source: copy from `assets/` into `public/assets/`. Favicon: `public/assets/icons/web/icon-32.png` or similar.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — run production build
- `npm run generate-icons` — generate app icons from `assets/blob.png`

## Testing

- **`npm run testSync`** — Two-tab Google sync E2E test. Rebuilds the app, restarts the dev server, then runs Playwright **only in the built-in Cursor Browser** (no new browser window). The test connects via CDP and ensures two **tabs** exist at the app URL (`?e2eSync=1`), opening or navigating them if they’re not already open. You must log in to Google in **both** tabs; the toast disappears when both are logged in, then the test runs sync checks (text edits, blob create/delete, theme, lock/unlock). Results are printed in plain English with suggested fixes.
- **Cursor Browser required:** The test never launches a new browser. It connects to an existing browser at `http://127.0.0.1:9222` (override with `PLAYWRIGHT_CDP_URL`). Ensure the Cursor Browser (or Chrome with `--remote-debugging-port=9222`) is open before running `npm run testSync`; the test will attach, open any necessary tabs at the correct URL if they’re not already open, and run in those tabs only.
- **First-time / manual run:** Open the Cursor Browser (or Chrome with remote debugging on port 9222), then run `npm run testSync`. The test opens two tabs in that browser; sign in with Google in both. When the toast disappears, the test continues automatically.
- **CI with saved auth:** Set `PLAYWRIGHT_STORAGE_STATE_BASE64` (or `E2E_STORAGE_STATE_BASE64`) to a base64-encoded JSON of a Playwright storage state from a real Google login. Run `node scripts/write-playwright-auth-state.js` then `npx playwright test tests/e2e/google-sync-two-tab.spec.ts --project=ci`. CI must provide a browser with CDP on the configured port, or run in an environment that does.
- **Sync timing:** Cloud poll runs every 10s; the test waits up to 12s after each change before asserting in the other tab.

## Version

Edit `version.json` to bump the app version (shown in the Main menu). Build date/time is set at build time and shown in the user’s timezone.
