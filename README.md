# webt — YAML-Driven Web UI Test Runner

`webt` is a lightweight CLI tool for writing and running web UI tests using a simple YAML flow format. You describe user interactions in plain YAML — navigate, type, tap, assert — and `webt` drives a real browser via Playwright to execute them.

No test framework boilerplate. No TypeScript required to write tests. Just YAML flows.

---

## What It Does

- Runs one or more YAML flow files against a live web app
- Executes each command step-by-step in a Playwright-controlled browser
- Reports pass/fail per step with timing and screenshots on failure
- Outputs results to the console, an HTML report, or a Markdown report

---

## Prerequisites

- **Node.js** 18+
- **npm** 9+
- A running web app to test against (local or remote)

---

## Setup

**1. Install dependencies**

```bash
npm install
```

**2. Install Playwright browsers**

```bash
npx playwright install chromium
```

**3. Build the TypeScript source**

```bash
npm run build
```

**4. (Optional) Link the CLI globally**

```bash
npm link
```

After linking, the `webt` command is available anywhere in your terminal.

---

## Running Tests

### Basic usage

```bash
npx tsx src/cli/index.ts test <target> [options]
```

Or if you ran `npm link`:

```bash
webt test <target> [options]
```

### Target

The `<target>` can be:

- A path to a single flow file: `flows/login-happy.yaml`
- A glob pattern matching multiple files: `flows/*.yaml`
- A directory containing `.yaml` files: `flows/`

### Options

| Flag | Description |
|------|-------------|
| `--headed` | Run the browser in headed (visible) mode instead of headless |
| `--slow-mo <ms>` | Add a delay in milliseconds between each action (useful for debugging) |
| `--reporter html` | Write an HTML report to `webt-report.html` |
| `--reporter md` | Write a Markdown report to `webt-report.md` |

### Examples

```bash
# Run a single flow
webt test flows/login-happy.yaml

# Run all flows in a directory
webt test flows/

# Run headed with slow motion for debugging
webt test flows/login-happy.yaml --headed --slow-mo 500

# Run and generate an HTML report
webt test flows/ --reporter html
```

The CLI exits with code `0` if all flows pass, or `1` if any flow fails — compatible with CI pipelines.

---

## Flow YAML Format

Each flow is a `.yaml` file with two top-level keys:

```yaml
appId: <base URL of the app>
commands:
  - <command>
  - <command>
  ...
```

### Commands

#### Navigation

| Command | Description |
|---------|-------------|
| `goto: <url>` | Navigate to an absolute URL |
| `assertUrl: <path>` | Assert the current URL ends with the given path |

```yaml
- goto: http://localhost:3000/login
- assertUrl: /dashboard
```

#### Interacting with Elements

| Command | Description |
|---------|-------------|
| `tapOn: <selector>` | Click an element |
| `inputText: <text>` | Type into the last tapped/focused element |
| `inputText: { element: <selector>, text: <text> }` | Type into a specific element |
| `scroll: up\|down\|left\|right` | Scroll the page in the given direction |

```yaml
- tapOn:
    testId: "login-submit"

- inputText:
    element:
      testId: "login-username"
    text: "alice"

- scroll: down
```

#### Assertions

| Command | Description |
|---------|-------------|
| `assertVisible: <selector>` | Assert an element is visible on the page |
| `assertNotVisible: <selector>` | Assert an element is not visible |

```yaml
- assertVisible: "Welcome, Alice"
- assertNotVisible: "Login error"
```

#### Utilities

| Command | Description |
|---------|-------------|
| `wait: <ms>` | Pause for the given number of milliseconds |
| `runFlow: <path>` | Execute another flow file inline (supports nesting, prevents circular references) |

```yaml
- wait: 1000
- runFlow: flows/shared/setup.yaml
```

### Selectors

Selectors can be specified in several ways:

| Form | Matches by |
|------|-----------|
| `"some text"` | Visible text content |
| `{ text: "label" }` | Visible text content (explicit) |
| `{ testId: "my-id" }` | `data-testid` attribute |
| `{ label: "Email" }` | Associated `<label>` text |
| `{ placeholder: "Search..." }` | `placeholder` attribute |
| `{ role: "button", name: "Submit" }` | ARIA role + accessible name |

---

## Example Flows

### Happy path login (`flows/login-happy.yaml`)

```yaml
appId: http://localhost:8084/login
commands:
  - goto: http://localhost:8084/login
  - inputText:
      element:
        testId: "login-username"
      text: "alice"
  - inputText:
      element:
        testId: "login-password"
      text: "password1"
  - tapOn:
      testId: "login-submit"
  - assertUrl: "/tasks"
  - tapOn:
      text: "Buy groceries"
  - assertVisible: "2 / 3 done"
```

### Unhappy path login (`flows/login-unhappy.yaml`)

```yaml
appId: http://localhost:8084/login
commands:
  - goto: http://localhost:8084/login
  - inputText:
      element:
        testId: "login-username"
      text: "alice"
  - inputText:
      element:
        testId: "login-password"
      text: "wrongpassword"
  - tapOn:
      testId: "login-submit"
  - assertVisible: "Invalid username or password."
```

---

## Project Structure

```
src/
  cli/          Entry point, argument parsing, flow resolver, runner loop
  driver/       Playwright command implementations (goto, tapOn, inputText, etc.)
  engine/       Dispatcher (routes commands to driver) and run context
  parser/       YAML reader, command parser, selector parser, validator
  reporter/     Console output, HTML report, Markdown report, screenshot capture
  types.ts      Shared TypeScript types
flows/          YAML test flows (your test cases live here)
```

---

## Reports

### Console (default)

Steps print as they run with pass/fail icons and durations. Failed steps show the failure message and the path to a screenshot (saved to `screenshots/`).

### HTML report (`--reporter html`)

Writes `webt-report.html` — open it in any browser. Shows each flow with a collapsible step list, pass/fail badges, durations, and embedded screenshot links.

### Markdown report (`--reporter md`)

Writes `webt-report.md` — useful for committing test results or pasting into a PR description.

---

## Development

```bash
# Run unit and integration tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Rebuild after source changes
npm run build
```

## Further enhancement ideas
- add tagging to flow file and allow run by tag
- test with podman
- what is a good way to clean up the project
- generate a functional spec
