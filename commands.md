# Commands

## Building and running commands

| Command        | Description                                                                                                                                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **runapp**     | Builds the app; starts the dev server on port 3000 only if none is running. Opens or refreshes a Cursor Browser tab to http://localhost:3000. |
| **runall**     | Alias for **runapp** (same behavior).                                                                 |
| **reloadapp**  | Alias for **runapp** (same behavior).                                                                 |
| **rerunapp**   | Alias for **runapp** (same behavior).                                                                 |
| **restartall** | Always stops 3000/3001, rebuilds, and starts a fresh dev server on 3000. Use for a full restart. Then opens or refreshes Cursor Browser to http://localhost:3000. |
| **killAll**    | Stops all dev servers started by Cursor (processes on ports 3000, 3001, 3002, 3003). Does not build or start anything. Use when you want to free the ports without restarting. |
| **pushme**     | Commits all changes and pushes to the current branch. Uses **main** if not on a branch (e.g. detached HEAD). Optional commit message: say "pushme your message" or run `npm run pushme -- "your message"`. Default message is "Update". |
| **pushall**    | Alias for **pushme** (same behavior).                                                                 |
| **guideMe** &lt;topic&gt; | Ask for step-by-step guidance: "Guide me, step by step, one step at a time, in plain English, how to do" the given topic. The agent gives one step per message and waits for you to say "Done" or "Next" before continuing. Example: **guideMe set up Supabase**. |

## Testing commands

| Command      | Description                                                                                                                                                                                                                             |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **takeALook** | Takes a screenshot of the app in Cursor Browser, checks for TypeScript and build errors, and reports in plain English what’s wrong and how to fix it (visual/layout issues and code errors). Chat-only: say **takeALook** or **take a look**. |
| **explainIt** | Asks the agent to explain the issue, bug fix, or how the feature was implemented in plain English. Chat-only: say **explainIt** or **explain it**. |
| **testSync** | Runs the two-tab Google sync E2E test: rebuilds the app, restarts the dev server, launches Playwright with two tabs, shows in-app test controls (Cancel test / Rerun test), and reports the result in plain English with recommended fixes. |
| **testSimpleSync** | Standalone test (no app): writes test blobs and preferences to Supabase `user_notes`, then reads them back. Verifies the backend store round-trip. Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Run with `npm run testSimpleSync`. |

## Auditing

| Command      | Description                                                                                                                                                                                                                             |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **fixMobile** | Audits all app interactions for mobile: resizes Cursor Browser to a mobile viewport, exercises menus and primary actions, checks touch targets and layout, then reports in plain English what works, what’s wrong, and how to fix it. Chat-only: say **fixMobile** or **fix mobile**. |
| **auditMobile** | Alias for **fixMobile** (same behavior). Chat-only: say **auditMobile** or **audit mobile**. |

## Running via npm

- `npm run runapp`, `npm run runall`, `npm run reloadapp`, or `npm run rerunapp`
- `npm run restartall`
- `npm run killAll`
- `npm run testSync` (testing), `npm run testSimpleSync` (backend sync round-trip, no app)
- `npm run pushme` or `npm run pushme -- "commit message"`
- `npm run pushall` or `npm run pushall -- "commit message"`
