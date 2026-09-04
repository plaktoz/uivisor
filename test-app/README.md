# Task List App

A simple React demo app with login, user profile, and task management. Two users are pre-loaded with hardcoded data.

## Tech stack

- React 19 + Vite
- React Router v7 (client-side routing)
- Tailwind CSS v4

## Getting started

```bash
npm install
npm run dev
```

Then open the URL printed in your terminal (typically `http://localhost:5173`) in your browser.

## Sample accounts

| Username | Password |
|----------|----------|
| alice    | password1 |
| bob      | password2 |

Each user has their own task list. Sessions are not persisted — refreshing the page returns you to the login screen.

## Integration tests

The `flows/integration/` directory contains one flow file per uivisor command. Each flow targets the `/integration` page, which is a purpose-built fixture page with labeled sections for every command.

**Start the dev server first:**

```bash
npm run dev
```

**Run a single flow:**

```bash
npx uivisor run flows/integration/tap-on.yaml
```

**Run all integration flows:**

```bash
for f in flows/integration/*.yaml; do
  [[ "$f" == *shared* ]] && continue
  echo "--- $f ---"
  npx uivisor run "$f"
done
```

**Available flow files:**

| File | Command tested |
|------|----------------|
| `goto.yaml` | `goto` |
| `tap-on.yaml` | `tapOn` |
| `input-text-shorthand.yaml` | `inputText` (shorthand) |
| `input-text-targeted.yaml` | `inputText` (targeted) |
| `assert-visible.yaml` | `assertVisible` |
| `assert-not-visible.yaml` | `assertNotVisible` |
| `assert-url.yaml` | `assertUrl` |
| `wait.yaml` | `wait` |
| `wait-for.yaml` | `waitFor` |
| `scroll.yaml` | `scroll` |
| `assert-text.yaml` | `assertText` |
| `assert-value.yaml` | `assertValue` |
| `assert-count.yaml` | `assertCount` |
| `assert-enabled.yaml` | `assertEnabled` |
| `assert-disabled.yaml` | `assertDisabled` |
| `assert-checked.yaml` | `assertChecked` |
| `assert-unchecked.yaml` | `assertUnchecked` |
| `press-key.yaml` | `pressKey` |
| `select-option.yaml` | `selectOption` |
| `check.yaml` | `check` |
| `uncheck.yaml` | `uncheck` |
| `hover.yaml` | `hover` |
| `double-click.yaml` | `doubleClick` |
| `clear-text.yaml` | `clearText` |
| `reload.yaml` | `reload` |
| `go-back.yaml` | `goBack` |
| `go-forward.yaml` | `goForward` |
| `set-viewport.yaml` | `setViewport` |
| `screenshot.yaml` | `screenshot` |
| `run-flow.yaml` | `runFlow` |

> **Note:** The flows assume the dev server is on `http://localhost:5173` (Vite's default). If it binds to a different port — shown in the `npm run dev` output — update the `appId` and `goto` URLs in the flow files to match.

## Project structure

```
src/
  data.js                    # All hardcoded users and tasks (single source of truth)
  context/AuthContext.jsx    # Login state, task toggling, profile updates
  components/NavBar.jsx      # Top navigation bar
  pages/
    LoginPage.jsx            # Username + password login form
    ProfilePage.jsx          # Editable name and email
    TasksPage.jsx            # Per-user task list with done/undone toggle
    IntegrationTestPage.jsx  # Fixture page for integration tests (/integration)
  App.jsx                    # React Router setup and protected routes
flows/
  integration/               # One flow file per uivisor command (integration tests)
  login-happy.yaml           # Sample flows for the login feature
  login-unhappy.yaml
  shared-login.yaml
  submit-task-check-pass.yaml
  submit-task-check-fail.yaml
```

## Other commands

```bash
npm run build    # Production build → dist/
npm run preview  # Preview the production build locally
```
