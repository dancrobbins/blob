# blob

Tap anywhere to create a blob. Type bulleted lists, drag blobs around. Blobs persist in the browser; sign in with Google to sync to the cloud.

## Setup

1. **Install and run**
   - `npm install`
   - `npm run dev` — app at [http://localhost:3000](http://localhost:3000)

2. **Supabase (optional, for login and sync)**
   - Create a project at [supabase.com](https://supabase.com).
   - In Authentication → Providers, enable Google and add your OAuth credentials.
   - In **Authentication → URL Configuration**, add these URLs to the **Redirect URLs** allow list:
     - Local: `http://localhost:3000/auth/callback`
     - Production: `https://your-domain.com/auth/callback` (replace with your app URL).
   - In SQL Editor, run the statements in `supabase-schema.sql` to create the `user_notes` table and RLS.
   - Create `.env.local`:
     - `NEXT_PUBLIC_SUPABASE_URL=` your project URL
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY=` your anon key

3. **Assets**
   - App uses `public/assets` (icons, Blobby graphics). To refresh from source: copy from `assets/` into `public/assets/`. Favicon: `public/assets/icons/web/icon-32.png` or similar.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — run production build
- `npm run generate-icons` — generate app icons from `assets/blob.png`

## Version

Edit `version.json` to bump the app version (shown in the hamburger menu). Build date/time is set at build time and shown in the user’s timezone.
