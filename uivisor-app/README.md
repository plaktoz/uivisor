# uivisor — YAML-Driven Web UI Test Runner

`uivisor` is a lightweight CLI tool for writing and running web UI tests using a simple YAML flow format. You describe user interactions in plain YAML — navigate, type, tap, assert — and `uivisor` drives a real browser via Playwright to execute them.

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

After linking, the `uivisor` command is available anywhere in your terminal.

---

## Running Tests

### Basic usage

```bash
npx tsx src/cli/index.ts test <target> [options]
```

Or if you ran `npm link`:

```bash
uivisor test <target> [options]
```

### Target

The `<target>` can be:

- A path to a single flow file: `flows/login-happy.yaml`
- A directory containing `.yaml` files: `flows/`

### Options

| Flag | Description |
|------|-------------|
| `--headed` | Run the browser in headed (visible) mode instead of headless |
| `--slow-mo <ms>` | Add a delay in milliseconds between each action (useful for debugging) |
| `--reporter html` | Write an HTML report to a timestamped `target/<YYYYMMDD-HHmm>/uivisor-report.html` |
| `--reporter md` | Write a Markdown report to a timestamped `target/<YYYYMMDD-HHmm>/uivisor-report.md` |
| `--tag <name>` | Only run flows with this tag (repeatable; multiple `--tag` flags use OR semantics) |

### Examples

```bash
# Run a single flow
uivisor test flows/login-happy.yaml

# Run all flows in a directory
uivisor test flows/

# Run headed with slow motion for debugging
uivisor test flows/login-happy.yaml --headed --slow-mo 500

# Run and generate an HTML report
uivisor test flows/ --reporter html

# Run only flows tagged "checkout"
uivisor test flows/ --tag checkout

# Run flows tagged "checkout" or "payment"
uivisor test flows/ --tag checkout --tag payment
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

### Top-level keys

| Key | Required | Description |
|-----|----------|-------------|
| `appId` or `url` | Yes | Base URL of the app under test (both are equivalent) |
| `commands` | Yes | List of commands to execute |
| `tags` | No | Array of strings for `--tag` filtering |
| `shared` | No | If `true`, the flow can only be invoked via `runFlow`, not run directly |

---

## Commands

### Navigation

#### `goto`

Navigates to an absolute URL and waits for the page to load.

```yaml
- goto: http://localhost:3000/login
- goto: https://staging.example.com/dashboard
```

#### `assertUrl`

Asserts the current URL path matches the given string. Supports `*` as a wildcard suffix.

```yaml
- assertUrl: /dashboard
- assertUrl: /singpass/authorized*    # matches any URL starting with /singpass/authorized
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

Clicks an element. Accepts a shorthand string or an explicit selector object.

```yaml
# By visible text (shorthand)
- tapOn: Sign In

# By visible text (explicit)
- tapOn:
    text: Sign In

# By ARIA role + accessible name
- tapOn:
    role: button
    name: Submit

# By associated <label> text
- tapOn:
    label: Email

# By placeholder attribute
- tapOn:
    placeholder: Search…

# By data-testid attribute
- tapOn:
    testId: submit-btn
```

#### `inputText`

Types text into an element. Two forms:

```yaml
# Shorthand: types into the element last clicked by tapOn
- tapOn:
    testId: username
- inputText: alice

# Targeted: clears the element first, then types
- inputText:
    element:
      testId: username
    text: alice

# Targeted with any selector type
- inputText:
    element:
      label: Email
    text: user@example.com
```

#### `pressKey`

Sends a keyboard key to the currently focused element.

```yaml
- pressKey: Enter
- pressKey: Tab
- pressKey: Escape
- pressKey: ArrowDown
- pressKey: a
```

#### `selectOption`

Selects an `<option>` by value in a `<select>` element.

```yaml
- selectOption:
    testId: country-select
    value: sg

- selectOption:
    label: Country
    value: my
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

# Shorthand by visible text
- hover: Help
```

#### `doubleClick`

Double-clicks an element.

```yaml
- doubleClick:
    testId: editable-cell

# Shorthand by visible text
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

Waits up to 5 s for an element to be visible on the page.

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

Asserts the number of elements matching a CSS selector.

```yaml
- assertCount:
    css: .task-item
    expected: 5

- assertCount:
    css: .error-badge
    expected: 0
```

#### `assertEnabled`

Asserts an element is not disabled.

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

#### `assertUrl`

See [Navigation → assertUrl](#asserturl) above.

---

### Waiting

#### `wait`

Pauses for the given number of milliseconds.

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

Saves a PNG screenshot to `<runDir>/<path>`. Directories are created automatically.

```yaml
- screenshot: after-login.png
- screenshot: screenshots/checkout-confirmation.png
```

---

### Flow Composition

#### `runFlow`

Runs a nested flow file inline. Path is resolved relative to the calling flow. Circular references are detected and fail with an error.

```yaml
- runFlow: ./shared/login.yaml
- runFlow: ../helpers/setup.yaml
```

---

## Selectors

All interaction and assertion commands accept these selector forms:

| Form | Matches by |
|------|-----------|
| `"some text"` | Visible text content (shorthand string) |
| `{ text: "label" }` | Visible text content (explicit) |
| `{ testId: "my-id" }` | `data-testid` attribute |
| `{ label: "Email" }` | Associated `<label>` text |
| `{ placeholder: "Search..." }` | `placeholder` attribute |
| `{ role: "button", name: "Submit" }` | ARIA role + accessible name |
| `{ css: ".class-name" }` | Raw CSS selector (assertions only) |

---

## Test Case Patterns

These templates show the recommended structure for positive and negative test cases.

### Positive test case (happy path)

A happy path test verifies that valid inputs produce the expected successful outcome. The pattern is:

1. Navigate to the starting page
2. Perform the actions with valid inputs
3. Assert the successful outcome — the right URL, a success message, or the expected UI state

```yaml
# flows/feature-name-pass.yaml
appId: http://localhost:3000
tags:
  - feature-name

commands:
  # 1. Navigate to the starting point
  - goto: http://localhost:3000/login

  # 2. Perform actions with valid inputs
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

  # 3. Assert the successful outcome
  - assertUrl: /dashboard
  - assertVisible: Welcome, Alice
  - assertNotVisible: Error
```

### Negative test case (unhappy path)

An unhappy path test verifies that invalid inputs or prohibited actions are correctly rejected. The pattern is:

1. Navigate to the starting page
2. Perform the actions with invalid or boundary-violating inputs
3. Assert the error state — an error message is shown, the user stays on the same page, and no success state appears

```yaml
# flows/feature-name-fail.yaml
appId: http://localhost:3000
tags:
  - feature-name

commands:
  # 1. Navigate to the starting point
  - goto: http://localhost:3000/login

  # 2. Perform actions with invalid inputs
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

  # 3. Assert the error state
  - assertVisible: Invalid username or password.
  - assertUrl: /login                # stayed on the same page
  - assertNotVisible: Welcome        # no success state leaked through
```

### Using shared flows

For flows that share a setup (e.g. login before every test), extract the setup into a shared flow and reference it with `runFlow`:

```yaml
# flows/shared/login.yaml
shared: true
appId: http://localhost:3000
commands:
  - goto: http://localhost:3000/login
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
  - runFlow: ./shared/login.yaml     # reuse the login setup
  - tapOn:
      text: Checkout
  - assertUrl: /checkout
  - assertVisible: Order Summary
```

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
  matcher/      Selector resolution — maps YAML selector shapes to Playwright locators
  parser/       YAML reader, command parser, selector parser, validator
  reporter/     Console output, HTML report, Markdown report, screenshot capture
  types.ts      Shared TypeScript types
flows/          YAML test flows (your test cases live here)
tests/
  unit/         Parser, args, matcher, and reporter unit tests
  integration/  Full CLI and all commands against a real headless browser
```

---

## Reports

### Console (default)

Steps print as they run with pass/fail icons and durations. Failed steps show the failure message and the path to a screenshot (saved to `screenshots/`).

### HTML report (`--reporter html`)

Writes `uivisor-report.html` to a timestamped run directory. Open it in any browser. Shows each flow with a collapsible step list, pass/fail badges, durations, and embedded screenshot links.

### Markdown report (`--reporter md`)

Writes `uivisor-report.md` to a timestamped run directory — useful for committing test results or pasting into a PR description.

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
