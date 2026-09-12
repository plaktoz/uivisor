# uivisor-record

A browser-based interaction recorder for uivisor. It opens a real Chromium window, watches everything you do, and writes each action to a YAML flow file that `uivisor test` can replay.

## How it works

1. You run `npm run uivisor-record -- <url>` from the repo root — a headed Chromium window opens at that URL.
2. As you click, type, and navigate, every interaction is captured automatically.
3. Use keyboard shortcuts to insert assertion, wait, and screenshot commands.
4. Close the browser tab when done — the YAML flow file is ready to replay.

## Build

From the repo root:

```bash
# macOS / Linux
bash scripts/build.sh

# Windows
scripts\build.bat
```

This installs all workspace packages and builds `packages/core`, `uivisor-app`, and `recorder-app` in the correct order.

## Usage

All commands are run from the **repo root**.

```
npm run uivisor-record -- [url] [options]

Arguments:
  url                     URL to open  (default: http://localhost:5173)

Options:
  -o, --output <file>     Output YAML file path  (default: recorded.yaml)
  --base-url <url>        Override the base URL
  -h, --help              Show this help
```

### Examples

```bash
# Record interactions on the integration test page, save to a named file
npm run uivisor-record -- http://localhost:5173/integration \
  -o recorder-app/sample/test-app-integration/my-recording.yaml

# Record the login flow
npm run uivisor-record -- http://localhost:5173/login \
  -o recorder-app/sample/login-flow.yaml
```

## In-browser keyboard shortcuts

While the recorder window is open, three hotkeys let you insert commands that cannot be captured from DOM events alone:

| Shortcut | What it inserts |
|----------|-----------------|
| `Shift+A` | Opens an **assertion picker** — choose `assertVisible`, `assertText`, `assertValue`, `assertUrl`, `assertEnabled`, `assertDisabled`, `assertChecked`, or `assertUnchecked`. The focused element's `data-testid` is pre-filled as the selector. |
| `Shift+W` | Prompts for a number of milliseconds, then inserts a `wait` command. |
| `Shift+S` | Captures a `screenshot` command (`screenshots/step-N.png`). |
| `Esc`     | Closes the assertion picker without inserting anything. |

A HUD in the bottom-right corner of the browser window shows the active shortcuts.

## Replaying a recorded flow

Use `npm run uivisor` from the repo root to replay any flow:

```bash
npm run uivisor -- test <flow.yaml> --headed --slow-mo 600
```

### Recommended step delays

| `--slow-mo` value | Feel |
|-------------------|------|
| `0` (default) | Full speed — for CI |
| `300` | Brisk human pace |
| `600` | Comfortable visual review |
| `1000` | Slow, easy to follow |
| `2000` | Very slow — good for demos |

### Run all sample flows visually

```bash
npm run uivisor -- test recorder-app/sample/test-app-integration/ --headed --slow-mo 600
```

### Run a single sample flow

```bash
npm run uivisor -- test recorder-app/sample/test-app-integration/tap-on.yaml --headed --slow-mo 600
```

### Generate an HTML report

```bash
npm run uivisor -- test recorder-app/sample/test-app-integration/ --reporter html
# Report is written to target/<timestamp>/uivisor-report.html
```

## Sample flows — test-app integration suite

`sample/test-app-integration/` contains one flow per uivisor command, all targeting the test-app's `/integration` fixture page.

**Prerequisites:**

```bash
# Terminal 1 — start the test-app dev server
cd test-app && npm run dev
# Note the port in the output (typically http://localhost:5173)
```

> If Vite binds to a port other than 5173, update the `appId` and `goto` URLs in the flow files to match.

| Flow file | Command exercised |
|-----------|-------------------|
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
| `shared-int-setup.yaml` | *(shared helper — not run directly)* |

## Recording your own test-app session

```bash
# Terminal 1 — dev server
cd test-app && npm run dev

# Terminal 2 — recorder (from repo root; replace port if needed)
npm run uivisor-record -- http://localhost:5173/integration \
  -o recorder-app/sample/test-app-integration/my-session.yaml
```

Interact with the browser. Press `Shift+A` whenever you want to add an assertion. Close the tab when done, then replay:

```bash
npm run uivisor -- test recorder-app/sample/test-app-integration/my-session.yaml \
  --headed --slow-mo 600
```

## Project structure

```
src/
  cli.ts           # Entry point — launches Chromium and wires capture/overlay
  args.ts          # CLI argument parsing
  overlay.ts       # In-browser HUD + assertion picker (keyboard shortcuts)
  yamlWriter.ts    # Serialises captured commands to YAML
  *.test.ts        # Unit tests
dist/              # Compiled output (run scripts/build.sh first)
sample/
  test-app-integration/   # Integration-test sample flows for the test-app
```
