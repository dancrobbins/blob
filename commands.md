# Commands


| Command        | Description                                                                                                                                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **runapp**     | Rebuilds the app and runs it in the existing Cursor Browser. Uses the existing dev server if one is already running (port 3000 or 3001); otherwise starts the dev server. Refreshes the existing app tab URL when possible, or opens http://localhost:3000 (or :3001). |
| **runall**     | Alias for **runapp** (same behavior).                                                                 |
| **reloadapp**  | Alias for **runapp** (same behavior).                                                                 |
| **restartall** | Rebuilds the app, restarts the dev server, and runs the app in the existing Cursor Browser. Stops any process on ports 3000/3001, runs `npm run build`, starts the dev server, then opens the app in Cursor Browser.                    |
| **pushme**     | Commits all changes and pushes to the current branch. Uses **main** if not on a branch (e.g. detached HEAD). Optional commit message: say "pushme your message" or run `npm run pushme -- "your message"`. Default message is "Update". |
| **pushall**    | Alias for **pushme** (same behavior).                                                                 |

## Running via npm

- `npm run runapp`, `npm run runall`, or `npm run reloadapp`
- `npm run restartall`
- `npm run pushme` or `npm run pushme -- "commit message"`
- `npm run pushall` or `npm run pushall -- "commit message"`

