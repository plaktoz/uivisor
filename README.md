# uivisor

A YAML-driven web UI test runner. Write user flows in plain YAML — navigate, type, tap, assert, screenshot — and run them against a real browser via Playwright.

This repo is an npm workspace with four packages:

| Package | Description |
|---------|-------------|
| [`packages/core/`](./packages/core/) | Shared types, selector parser, capture script, and selector heuristics |
| [`uivisor-app/`](./uivisor-app/) | The `uivisor` CLI — the test runner |
| [`recorder-app/`](./recorder-app/) | The `uivisor-record` CLI — opens a browser and records interactions to YAML |
| [`test-app/`](./test-app/) | A sample React app to run tests against |

---

## Prerequisites

- **Node.js 24+** (use [nvm](https://github.com/nvm-sh/nvm) and run `nvm use` in each directory)
- **npm 10+**

---

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd uivisor
npm install          # installs all workspace packages
```

### 2. Build all packages

```bash
# macOS / Linux
bash scripts/build.sh

# Windows
scripts\build.bat
```

This does a clean install, builds `packages/core`, `uivisor-app`, and `recorder-app` in dependency order, and installs the Playwright Chromium browser.

---

## Running Flows

Start the test app (or point at any running web app), then run your flows from the repo root:

```bash
# Run a single flow
npm run uivisor -- test flows/login-happy.yaml

# Run all flows in a directory
npm run uivisor -- test flows/

# Run headed with slow motion (useful for watching/debugging)
npm run uivisor -- test flows/login-happy.yaml --headed --slow-mo 500

# Generate an HTML report (written to target/<timestamp>/uivisor-report.html)
npm run uivisor -- test flows/ --reporter html

# Generate a Markdown report
npm run uivisor -- test flows/ --reporter md

# Write the report to a custom directory
npm run uivisor -- test flows/ --reporter html --output-dir reports/

# Run only flows tagged "smoke"
npm run uivisor -- test flows/ --tag smoke

# Multiple tags use OR semantics
npm run uivisor -- test flows/ --tag smoke --tag login
```

The CLI exits with code `0` if all flows pass, `1` if any fail — compatible with CI.

---

## Recording Flows

Open a browser, interact with your app, and get a YAML flow written automatically:

```bash
npm run uivisor-record -- https://example.com -o my-flow.yaml
```

Close the browser window when done. The recorded YAML is written to `my-flow.yaml`.

### Continue recording after replaying existing flows

Use `--run-flow` to replay one or more flow files first, then pick up recording from that browser state:

```bash
npm run uivisor-record -- --run-flow ./flows/setup.yaml,./flows/login.yaml -o ./recordings/checkout.yaml
```

The recorder replays each flow in sequence, then enters live-recording mode. The output file starts with `runFlow:` references to the input flows so it is self-contained and re-runnable:

```yaml
appId: http://localhost:5173
commands:
  - runFlow: ../flows/setup.yaml
  - runFlow: ../flows/login.yaml
  - tapOn: ...     # newly recorded
```

- **Multiple flows** are comma-delimited and replayed in order.
- **The input flow files are never modified** — the output is always a new file.
- If `--run-flow` is given without an explicit URL, `appId` is read from the first flow file.

---

## Flow Reference

See [`uivisor-app/README.md`](./uivisor-app/README.md) for the full reference covering:

- Flow YAML format and top-level keys (`appId`, `commands`, `vars`, `config`, `tags`, `shared`)
- Variables and environment variable interpolation
- Selectors — object form, pipe-syntax, bare string cascade, wildcards, and `within` scoping
- All commands: navigation, interaction, assertions, timing, viewport, screenshots, and flow composition

---

## Reports

### Console (default)

Steps print as they run with pass/fail icons and timings. Failed steps print the error and a screenshot path.

### HTML report (`--reporter html`)

Writes `target/<YYYYMMDD-HHmm>/uivisor-report.html`. Opens in any browser — collapsible step list, pass/fail badges, and screenshots embedded inline as base64 images (including passing `screenshot` commands).

### Markdown report (`--reporter md`)

Writes `target/<YYYYMMDD-HHmm>/uivisor-report.md`. Includes `![image](filename.png)` inline for every screenshot command, using the basename relative to the run directory — ready to paste into a PR description or commit as a test artifact.

---

## Development

```bash
# Run all tests
npm test --workspace=uivisor-app

# Unit tests only
npm run test:unit --workspace=uivisor-app

# Integration tests only
npm run test:integration --workspace=uivisor-app

# Rebuild after source changes
npm run build --workspace=packages/core
npm run build --workspace=uivisor-app
```

---

## Docker / Podman

```bash
cd uivisor-app
docker compose up --build
# or: podman compose up --build
```
