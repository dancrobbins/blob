# Commands

## Building and running commands

| Command        | Description                                                                                                                                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **runapp**     | Builds the app; starts the dev server on port 3000 only if none is running. Opens or refreshes a Cursor Browser tab to http://localhost:3000. |
| **runall**     | Alias for **runapp** (same behavior).                                                                 |
| **reloadapp**  | Alias for **runapp** (same behavior).                                                                 |
| **rerunapp**   | Alias for **runapp** (same behavior).                                                                 |
| **restartall** | Always stops 3000/3001, rebuilds, and starts a fresh dev server on 3000. Use for a full restart. Then opens or refreshes Cursor Browser to http://localhost:3000. |
| **pushme**     | Commits all changes and pushes to the current branch. Uses **main** if not on a branch (e.g. detached HEAD). Optional commit message: say "pushme your message" or run `npm run pushme -- "your message"`. Default message is "Update". |
| **pushall**    | Alias for **pushme** (same behavior).                                                                 |
| **guideMe** &lt;topic&gt; | Ask for step-by-step guidance: "Guide me, step by step, one step at a time, in plain English, how to do" the given topic. The agent gives one step per message and waits for you to say "Done" or "Next" before continuing. Example: **guideMe set up Supabase**. |

## Testing commands

| Command      | Description                                                                                                                                                                                                                             |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **takeALook** | Takes a screenshot of the app in Cursor Browser, checks for TypeScript and build errors, and reports in plain English what’s wrong and how to fix it (visual/layout issues and code errors). Chat-only: say **takeALook** or **take a look**. |
| **testSync** | Runs the two-tab Google sync E2E test: rebuilds the app, restarts the dev server, launches Playwright with two tabs, shows in-app test controls (Cancel test / Rerun test), and reports the result in plain English with recommended fixes. |

## Running via npm

- `npm run runapp`, `npm run runall`, `npm run reloadapp`, or `npm run rerunapp`
- `npm run restartall`
- `npm run testSync` (testing)
- `npm run pushme` or `npm run pushme -- "commit message"`
- `npm run pushall` or `npm run pushall -- "commit message"`

**guideMe** and **takeALook** are chat-only (no npm script): say **guideMe** &lt;topic&gt; or **takeALook** (screenshot + diagnose app and TS/build errors in plain English).

