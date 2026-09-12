# uivisor — YAML-Driven Web UI Test Runner

`uivisor` is a lightweight CLI tool for writing and running web UI tests using a simple YAML flow format. You describe user interactions in plain YAML — navigate, type, tap, assert, screenshot — and `uivisor` drives a real browser via Playwright to execute them.

No test framework boilerplate. No TypeScript required. Just YAML flows.

---

## Prerequisites

- **Node.js 24+**
- **npm 10+**

---

## Setup

From the repo root:

```bash
bash scripts/build.sh
npx playwright install chromium   # run once after first install
```

`scripts/build.sh` installs all workspace packages and builds `packages/core`, `uivisor-app`, and `recorder-app` in the correct order.

---

## Running Tests

### Basic usage

From the repo root:

```bash
npx uivisor test <target> [options]
```

### Target

- A single flow file: `flows/login-happy.yaml`
- A directory of `.yaml` files: `flows/`

### Options

| Flag | Description |
|------|-------------|
| `--headed` | Run the browser in headed (visible) mode |
| `--slow-mo <ms>` | Delay in milliseconds between each action |
| `--reporter html` | Write an HTML report to `target/<YYYYMMDD-HHmm>/uivisor-report.html` |
| `--reporter md` | Write a Markdown report to `target/<YYYYMMDD-HHmm>/uivisor-report.md` |
| `--tag <name>` | Only run flows with this tag (repeatable; multiple flags use OR semantics) |

### Examples

```bash
# Run a single flow
npx uivisor test flows/login-happy.yaml

# Run all flows in a directory
npx uivisor test flows/

# Run headed with slow motion for debugging
npx uivisor test flows/login-happy.yaml --headed --slow-mo 500

# Generate an HTML report
npx uivisor test flows/ --reporter html

# Run only flows tagged "checkout"
npx uivisor test flows/ --tag checkout

# Run flows tagged "checkout" or "payment"
npx uivisor test flows/ --tag checkout --tag payment
```

The CLI exits with code `0` if all flows pass, `1` if any fail — compatible with CI pipelines.

---

## Flow YAML Format

```yaml
appId: <base URL of the app>
commands:
  - <command>
  - <command>
```

The runner navigates to `appId` before executing the first command.

### Top-level keys

| Key | Required | Description |
|-----|----------|-------------|
| `appId` | Yes | Base URL — the browser navigates here before the first command runs |
| `commands` | Yes | List of commands to execute |
| `tags` | No | Array of strings for `--tag` filtering |
| `shared` | No | If `true`, the flow can only be invoked via `runFlow`, not run directly |

---

## Selectors

All interaction and assertion commands accept a selector. There are three forms.

### Object selector

Use an object with exactly one (or two) keys:

| Form | Matches by |
|------|-----------|
| `{ text: "Sign In" }` | Visible text content |
| `{ testId: "submit-btn" }` | `data-testid` attribute |
| `{ label: "Email" }` | Associated `<label>` text |
| `{ placeholder: "Search..." }` | `placeholder` attribute |
| `{ role: "button", name: "Submit" }` | ARIA role + accessible name (both required) |
| `{ css: "ul > li:has-text('Home')" }` | Raw CSS / Playwright extended CSS selector |

### Pipe-syntax selector

A string containing `=` is treated as a pipe-syntax selector: `attr=value`. Chain multiple segments with `|` for left-to-right fallback — the first segment that finds exactly one matching element wins.

```yaml
- tapOn: text=Sign In
- tapOn: id=submit-btn
- tapOn: data-state=active
- tapOn: id=main-nav|text=Menu     # tries id first, then falls back to text
```

Supported attributes: `id`, `name`, `placeholder`, `label`, `role`, `text`, and any `data-*` attribute.

Wildcard matching is supported for all attributes except `label` and `role`:

| Pattern | Matches |
|---------|---------|
| `prefix*` | Starts with prefix |
| `*suffix` | Ends with suffix |
| `*contains*` | Substring match |
| `value` | Exact match |

```yaml
- tapOn: data-status=active*      # starts with "active"
- tapOn: id=*-submit              # ends with "-submit"
- tapOn: text=*Welcome*           # contains "Welcome"
```

### Bare string (cascade mode)

A string with no `=` is tried against attributes in this order, stopping at the first that finds exactly one match: `data-testid` → `text` (exact) → `name` → `id` → `placeholder`.

```yaml
- tapOn: Sign In        # finds the element with text "Sign In"
- tapOn: submit-btn     # finds by data-testid, name, or id
```

If the string matches zero or more than one element at every level, an error is thrown suggesting the more specific pipe-syntax form.

---

## Commands

### Navigation

#### `goto`

Navigates to an absolute URL and waits for the page to load.

```yaml
- goto: http://localhost:3000/login
- goto: https://staging.example.com/dashboard
```

#### `reload`

Reloads the current page and waits for load.

```yaml
- reload:
```

#### `goBack`

Goes back one step in browser history. Fails if there is no previous page.

```yaml
- goBack:
```

#### `goForward`

Goes forward one step in browser history. Fails if there is no next page.

```yaml
- goForward:
```

---

### Interaction

#### `tapOn`

Clicks an element.

```yaml
# Bare string — cascade mode
- tapOn: Sign In

# Pipe syntax
- tapOn: text=Sign In
- tapOn: id=submit-btn

# Object selector
- tapOn:
    text: Sign In
- tapOn:
    role: button
    name: Submit
- tapOn:
    testId: submit-btn
- tapOn:
    label: Email
- tapOn:
    css: "#main-nav > a:has-text('Home')"
```

#### `inputText`

Types text into a field. Two forms:

```yaml
# Shorthand — types into the element last clicked by tapOn
- tapOn:
    testId: username
- inputText: alice

# Targeted — clears the field first, then types
- inputText:
    element:
      testId: username
    text: alice

- inputText:
    element:
      label: Email
    text: user@example.com
```

#### `pressKey`

Sends a keyboard key to the currently focused element. Accepts any [Playwright key name](https://playwright.dev/docs/api/class-keyboard).

```yaml
- pressKey: Enter
- pressKey: Tab
- pressKey: Escape
- pressKey: ArrowDown
```

#### `selectOption`

Selects an `<option>` by value in a `<select>` element.

```yaml
- selectOption:
    testId: country-select
    value: sg

- selectOption:
    label: Country
    value: Canada
```

#### `check`

Checks a checkbox.

```yaml
- check:
    testId: terms-checkbox

# Shorthand by visible text
- check: Accept terms
```

#### `uncheck`

Unchecks a checkbox.

```yaml
- uncheck:
    testId: newsletter-checkbox
```

#### `hover`

Moves the pointer over an element (triggers hover/tooltip states).

```yaml
- hover:
    role: button
    name: More options

- hover: Help
```

#### `doubleClick`

Double-clicks an element.

```yaml
- doubleClick:
    testId: editable-cell

- doubleClick: Edit
```

#### `clearText`

Clears the value of an input or textarea.

```yaml
- clearText:
    testId: search-input

- clearText:
    placeholder: Enter email
```

#### `scroll`

Scrolls the page by one viewport in the given direction.

```yaml
- scroll: down
- scroll: up
- scroll: left
- scroll: right
```

---

### Assertions

#### `assertVisible`

Waits up to 5 s for an element to be visible.

```yaml
- assertVisible: Welcome, Alice
- assertVisible:
    testId: success-banner
```

#### `assertNotVisible`

Waits up to 5 s for an element to be hidden or absent.

```yaml
- assertNotVisible: Error message
- assertNotVisible:
    testId: loading-spinner
```

#### `assertUrl`

Asserts the current URL path (including query string and hash) matches the given string. Supports `*` as a wildcard.

```yaml
- assertUrl: /dashboard
- assertUrl: /auth/callback*    # matches any URL starting with /auth/callback
```

#### `assertText`

Asserts the exact trimmed text content of an element.

```yaml
- assertText:
    testId: item-count
    expected: "3 items"

- assertText:
    label: Status
    expected: Active
```

#### `assertValue`

Asserts the current value of an input element.

```yaml
- assertValue:
    testId: email-field
    expected: user@example.com
```

#### `assertCount`

Asserts the number of elements matching a CSS selector. Note: this command takes a `css` key directly — not a standard selector object.

```yaml
- assertCount:
    css: .task-item
    expected: 5

- assertCount:
    css: .error-badge
    expected: 0
```

#### `assertEnabled`

Asserts an element is enabled (not disabled).

```yaml
- assertEnabled:
    testId: submit-btn
```

#### `assertDisabled`

Asserts an element is disabled.

```yaml
- assertDisabled:
    testId: submit-btn
```

#### `assertChecked`

Asserts a checkbox is checked.

```yaml
- assertChecked:
    testId: agree-checkbox
```

#### `assertUnchecked`

Asserts a checkbox is unchecked.

```yaml
- assertUnchecked:
    testId: agree-checkbox
```

---

### Timing

#### `wait`

Pauses for the given number of milliseconds. Value must be an integer.

```yaml
- wait: 500
```

#### `waitFor`

Pauses for the given number of milliseconds. Value must be a positive integer (> 0).

```yaml
- waitFor: 3000
```

---

### Viewport & Screenshots

#### `setViewport`

Sets the browser window size. Named presets or explicit dimensions.

```yaml
- setViewport: mobile     # 390 × 844
- setViewport: tablet     # 768 × 1024
- setViewport: desktop    # 1280 × 800

- setViewport:
    width: 1920
    height: 1080
```

#### `screenshot`

Saves a PNG screenshot to `<runDir>/<path>`. Parent directories are created automatically. The screenshot path appears inline in HTML and Markdown reports.

```yaml
- screenshot: after-login.png
- screenshot: shots/checkout-confirmation.png
```

---

### Flow Composition

#### `runFlow`

Runs a nested flow file inline. The path is resolved relative to the calling flow. Circular references are detected and fail with an error.

```yaml
- runFlow: ./shared/login.yaml
- runFlow: ../helpers/setup.yaml
```

#### `within`

Scopes all nested commands to a matched container element. Useful for disambiguating selectors when the same text or attribute appears in multiple places.

```yaml
- within:
    <selector-key>: <value>
    do:
      - <command>
      - <command>
```

The selector is specified as a single key-value pair using any pipe-syntax attribute (`id`, `text`, `name`, `placeholder`, `data-*`). The `do` list accepts any commands that would be valid at the top level.

Optional `nth` (0-based) selects which container to use when multiple match:

```yaml
# Scope to the nav bar
- within:
    id: main-nav
    do:
      - tapOn: text=Dashboard
      - assertVisible: text=Profile

# Scope to the second card on the page
- within:
    css: .card
    nth: 1
    do:
      - tapOn: text=Edit
      - assertVisible: text=Save
```

**Supported selector keys for `within`:** `id`, `text`, `name`, `placeholder`, `label`, `role`, `data-*`, `css`

---

## Reports

### Console (default)

Steps print as they run with pass/fail icons and durations. Failed steps show the error and a path to an auto-captured screenshot.

### HTML report (`--reporter html`)

Writes `target/<YYYYMMDD-HHmm>/uivisor-report.html`. Open in any browser. Shows each flow with pass/fail badges, durations, and screenshots embedded inline as base64 images — including passing `screenshot` commands.

### Markdown report (`--reporter md`)

Writes `target/<YYYYMMDD-HHmm>/uivisor-report.md`. Renders `![image](filename.png)` inline for every screenshot command using the basename relative to the run directory — paste directly into a PR description or commit as a test artifact.

---

## Test Case Patterns

### Happy path

```yaml
# flows/login-pass.yaml
appId: http://localhost:3000
tags:
  - login

commands:
  - inputText:
      element:
        testId: username
      text: alice
  - inputText:
      element:
        testId: password
      text: correct-password
  - tapOn:
      testId: submit-btn
  - assertUrl: /dashboard
  - assertVisible: Welcome, Alice
  - assertNotVisible: Error
```

### Unhappy path

```yaml
# flows/login-fail.yaml
appId: http://localhost:3000
tags:
  - login

commands:
  - inputText:
      element:
        testId: username
      text: alice
  - inputText:
      element:
        testId: password
      text: wrong-password
  - tapOn:
      testId: submit-btn
  - assertVisible: Invalid username or password.
  - assertUrl: /login
  - assertNotVisible: Welcome
```

### Shared setup with `runFlow`

```yaml
# flows/shared/login.yaml
shared: true
appId: http://localhost:3000
commands:
  - inputText:
      element:
        testId: username
      text: alice
  - inputText:
      element:
        testId: password
      text: correct-password
  - tapOn:
      testId: submit-btn
  - assertUrl: /dashboard
```

```yaml
# flows/checkout-pass.yaml
appId: http://localhost:3000
tags:
  - checkout

commands:
  - runFlow: ./shared/login.yaml
  - tapOn:
      text: Checkout
  - assertUrl: /checkout
  - assertVisible: Order Summary
```

---

## Project Structure

```
src/
  cli/          Entry point, argument parsing, flow resolver, runner loop
  driver/       Playwright command implementations
  engine/       Dispatcher (routes commands to driver) and run context
  matcher/      Selector resolution — maps YAML selectors to Playwright locators
  parser/       YAML reader, command parser, selector parser, validator
  reporter/     Console, HTML report, Markdown report, screenshot capture
  utils/        Shared utilities (pattern matching, etc.)
flows/          YAML test flows
tests/
  unit/         Parser, matcher, and reporter unit tests
  integration/  Full CLI and all commands against a real headless browser
```

---

## Development

From the repo root:

```bash
# Run unit and integration tests
npm test --workspace=uivisor-app

# Run only unit tests
npm run test:unit --workspace=uivisor-app

# Run only integration tests
npm run test:integration --workspace=uivisor-app

# Rebuild after source changes (build core first, then app)
npm run build --workspace=packages/core
npm run build --workspace=uivisor-app
```
