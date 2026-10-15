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
# macOS / Linux
bash scripts/build.sh

# Windows
scripts\build.bat
```

The build script installs all workspace packages, builds `packages/core`, `uivisor-app`, and `recorder-app` in the correct order, and installs the Playwright Chromium browser.

---

## Running Tests

### Basic usage

From the repo root:

```bash
npm run uivisor -- test <target> [options]
```

### Target

- A single flow file: `flows/login-happy.yaml`
- A directory of `.yaml` files: `flows/`

### Options

| Flag | Description |
|------|-------------|
| `--headed` | Run the browser in headed (visible) mode |
| `--slow-mo <ms>` | Delay in milliseconds between each action |
| `--reporter html` | Write an HTML report to `<output-dir>/<YYYYMMDD-HHmm>/uivisor-report.html` |
| `--reporter md` | Write a Markdown report to `<output-dir>/<YYYYMMDD-HHmm>/uivisor-report.md` |
| `--reporter live` / `--reporter plain` | Force the live checklist or the append-only console output (default: live on a terminal, plain otherwise). Combines with `html`/`md`: `--reporter md --reporter live` |
| `--output-dir <path>` | Base directory for report output (default: `target/`) |
| `--tag <name>` | Only run flows with this tag (repeatable; multiple flags use OR semantics) |
| `--timeout <ms>` | Element-command timeout for this run (overrides flow/config `defaultTimeout`; see [Timeouts](#timeouts)) |
| `--navigation-timeout <ms>` | Timeout for `goto`/`reload`/`goBack`/`goForward`/`waitForPageLoad` for this run (overrides flow/config `navigationTimeout`) |

### Examples

```bash
# Run a single flow
npm run uivisor -- test flows/login-happy.yaml

# Run all flows in a directory
npm run uivisor -- test flows/

# Run headed with slow motion for debugging
npm run uivisor -- test flows/login-happy.yaml --headed --slow-mo 500

# Generate an HTML report (written to target/<timestamp>/uivisor-report.html)
npm run uivisor -- test flows/ --reporter html

# Write the report to a custom folder
npm run uivisor -- test flows/ --reporter html --output-dir reports/

# Write the report to an absolute path
npm run uivisor -- test flows/ --reporter md --output-dir /tmp/ci-results

# Generate both HTML and MD reports in CI, separate from source
npm run uivisor -- test flows/ --reporter html --output-dir /artifacts/uivisor

# Run only flows tagged "checkout"
npm run uivisor -- test flows/ --tag checkout

# Run flows tagged "checkout" or "payment"
npm run uivisor -- test flows/ --tag checkout --tag payment

# Tag filtering combined with a custom output directory
npm run uivisor -- test flows/ --tag smoke --reporter html --output-dir test-results/
```

The CLI exits with code `0` if all flows pass, `1` if any fail — compatible with CI pipelines.

### Compacting recorded flows

The recorder can emit multiple consecutive `within` blocks targeting the same container. `uivisor compact` merges them into a single block, making recorded flows easier to read and edit.

```bash
# Compact in place (overwrites the input file)
npm run uivisor -- compact flows/recorded.yaml

# Write to a new file
npm run uivisor -- compact flows/recorded.yaml --output flows/cleaned.yaml
```

Consecutive `within` blocks that share the same selector key, value, and `nth` are merged into one block with their `do` arrays concatenated. Non-`within` commands between blocks act as separators and are left unchanged.

Exits `0` on success, `1` if the file is not found, cannot be parsed, or has no `commands` array.

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
| `vars` | No | Inline variable definitions; values are interpolated with `${varName}` |
| `config` | No | Path to an external YAML config file; keys override inline `vars` |
| `tags` | No | Array of strings for `--tag` filtering |
| `sessions` | No | Array of named browser sessions for multi-tab tests; each entry has an `id:` field |
| `defaultTimeout` | No | Element-command timeout for this flow, in ms (see [Timeouts](#timeouts)) |
| `navigationTimeout` | No | Navigation-command timeout for this flow, in ms (see [Timeouts](#timeouts)) |

---

## Variables & Config

### Inline vars

Define reusable values in a `vars` block. Reference them anywhere in the flow with `${varName}`. Nested objects use dot notation.

```yaml
appId: http://localhost:${port}
vars:
  port: 3000
  username: alice
  timeout:
    short: 500
    long: 2000
commands:
  - inputText:
      element:
        testId: username
      text: ${username}
  - wait: ${timeout.short}
```

All variable values are coerced to strings. `wait` and `waitFor` accept whole-number strings (e.g. `"500"`) so they work naturally with vars.

### External config file

Move shared values (like a base URL) to a separate YAML file and reference it with `config:`. Config file values override any inline `vars` with the same name.

```yaml
# flows/login.yaml
appId: ${base}/login
config: config.yml
commands:
  - goto: ${base}/login
```

```yaml
# flows/config.yml
base: http://localhost:5173
```

### Environment variables

Use `${env.VAR_NAME}` to read from the environment. Add a default after `:` in case the variable is not set:

```yaml
appId: ${env.APP_URL:http://localhost:3000}
vars:
  apiKey: ${env.API_KEY}
```

### Variables in included flows

A flow included with [`runFlow`](#runflow) keeps its own `vars:` and `config:` as defaults, so it runs the same way standalone or included. The caller declares only what it changes:

```yaml
# flows/shared/login.yaml (runs standalone with its defaults)
appId: ${base}/login
config: ../config.yml
vars:
  userNric: S0000000Z
  waitForLandingPageInMills: 3000
commands:
  - inputText:
      element:
        testId: nric
      text: ${userNric}
  - wait: ${waitForLandingPageInMills}
```

```yaml
# flows/main.yaml
appId: ${base}
config: config.yml
vars:
  adminNric: S9999999X
commands:
  - runFlow: ./shared/login.yaml          # uses the child's defaults
  - runFlow:
      file: ./shared/login.yaml
      vars:
        userNric: ${adminNric}             # override one value for this call
```

Inside the included flow, a name resolves in this order:

1. The call site's `runFlow.vars:` (highest).
2. Values already in the variable map: the top-level flow's `vars:` and `config:`, earlier `setVar` calls, and the defaults of any enclosing included flow.
3. The included flow's own `config:`, then its `vars:` (fill-in only).

`${...}` in `runFlow.vars:` values is resolved against the calling flow's variables before the child starts. Child defaults are used as written, exactly as when the file runs on its own.

Scoping rules:

- Call-site `vars:` last for one call. When the child returns, the caller's previous value, or its absence, comes back. Calling the same flow twice with different `vars:` works.
- Child defaults that were not already in the map are removed when the child returns.
- `setVar` inside the child writes to the shared map and survives the return. The exception is a name passed in the call site's `vars:`: that write ends with the call.
- `unsetVar` of a call-site var hides it for the rest of the call, and the caller's value comes back on return. `unsetVar` of any other name behaves as it does in the top-level flow and survives the return.
- When a flow includes another flow, the outer flow's defaults win over the inner flow's defaults for the same name.

An undefined variable fails the step with the flow that used it and every call site that led there:

```
Variable "otp" is not defined in flow "otp", included from flow "login" via runFlow: ./otp.yaml, included from flow "main" via runFlow: ./login.yaml (userNric=S1234567A)
```

An undefined variable in the call site's own `vars:` names the calling flow and the step:

```
Variable "adminNric" is not defined in flow "main" at runFlow: ./shared/login.yaml (userNric=${adminNric})
```

Any other failure inside an included flow gets the same `, included from flow ...` suffix.

---

## Timeouts

Element commands and page navigations wait for their target instead of failing instantly. Each command gets **one deadline** — covering finding its target and the interaction itself — resolved from (highest wins):

1. a per-command `timeout:` sibling key
2. the CLI flag (`--timeout` / `--navigation-timeout`)
3. the flow's own top-level header (`defaultTimeout` / `navigationTimeout`)
4. the shared `config:` file
5. built-in default — **5000 ms** for element commands, **30000 ms** for navigation

A header value beats the shared config for these two keys. A timeout is a maximum, not a delay: a command continues as soon as its condition is met, and only waits the full budget right before failing.

### Flow header and shared config

`defaultTimeout` and `navigationTimeout` can be set once for a flow, or shared across every flow via `config:`:

```yaml
# flows/config.yml
defaultTimeout: 15000
navigationTimeout: 45000
```

```yaml
# my-flow.yaml
appId: http://localhost:3000
config: ./config.yml
defaultTimeout: 20000   # overrides the shared config, for this flow only
commands:
  - tapOn: Submit
```

`${var}` inside a header or shared-config value is resolved at **parse time**, from config vars and the environment — a runtime `setVar` has no effect on these.

### Per-command `timeout:`

Add `timeout:` as a sibling key, next to the command (not inside the selector) — the same way `session:` works:

```yaml
- tapOn: text=Book now
  timeout: 30000
```

`${var}` in a sibling `timeout:` is resolved at **run time**, so a runtime `setVar` can change it per step.

Only commands that wait for something accept `timeout:`. Commands with nothing to wait for — `wait`, `waitFor`, `scroll`, `setViewport`, `screenshot`, `setVar`, `testVarSet`, `unsetVar`, `runFlow`, `pressKey` — reject it at parse time: `timeout is not supported on <command>`.

`within`'s `timeout:` bounds only finding the container; commands inside its `do:` block keep their own budgets, the same way steps inside a `runFlow` do.

`waitForPageLoad` accepts its timeout either inside the object or as the sibling key, never both — giving both is a parse error.

### Which timeout a command uses

| Timeout | Commands |
|---|---|
| `defaultTimeout` | `tapOn`, `doubleClick`, `hover`, `inputText`, `inputTextTargeted`, `clearText`, `selectOption`, `check`, `uncheck`, every `assert*` command, `within` (container lookup only) |
| `navigationTimeout` | `goto`, `reload`, `goBack`, `goForward`, `waitForPageLoad` (unless it has its own `timeout:`) |
| n/a (rejected at parse time) | `wait`, `waitFor`, `scroll`, `setViewport`, `screenshot`, `setVar`, `testVarSet`, `unsetVar`, `runFlow`, `pressKey` |

### Child flows (`runFlow`)

A child flow run via `runFlow` inherits the top-level flow's timeouts. If the child file sets its own `defaultTimeout`/`navigationTimeout` (header or shared config), that value is ignored while it runs as a child, and the console prints a notice once per file:

```
login-flow-v1.yaml: defaultTimeout ignored (inherited from my-flow.yaml)
```

The notice only prints when the child's value actually differs from the one in effect. The same file's own settings apply normally when it's run as a top-level flow.

### Errors

A command whose target never resolves fails with:

```
Element not found after 15000ms: text=Book now
```

If the target is found but the interaction itself (click, fill, check, …) doesn't complete within the remaining budget, the error is:

```
Element not actionable after 15000ms: text=Book now
```

---

## Selectors

All interaction and assertion commands accept a selector. There are three forms. Every form **waits** for a unique match, up to the command's [timeout](#timeouts) — string selectors (bare and pipe syntax) included.

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
| `{ xpath: "//button[@type='submit']" }` | XPath expression |

### Pipe-syntax selector

A string containing `=` is treated as a pipe-syntax selector: `attr=value`. Chain multiple segments with `|` for left-to-right fallback — the first segment that finds exactly one matching element wins. uivisor retries every segment until one wins, up to the command's timeout; if a later segment wins before the first segment's element has rendered, it's re-checked 100 ms later and only accepted if it still wins (see the cascade note below).

```yaml
- tapOn: text=Sign In
- tapOn: id=submit-btn
- tapOn: data-state=active
- tapOn: id=main-nav|text=Menu     # tries id first, then falls back to text
```

Supported attributes: `id`, `name`, `placeholder`, `label`, `role`, `text`, `xpath`, and any `data-*` attribute.

> **XPath and `|`:** XPath union expressions contain `|` which conflicts with the pipe-syntax segment separator. Use the object form for unions: `tapOn: { xpath: '//a | //button' }`. Simple XPath expressions without `|` work fine in pipe syntax: `tapOn: xpath=//button[@type="submit"]`.

Wildcard matching is supported for all attributes except `label` and `role`:

| Pattern | Matches |
|---------|---------|
| `prefix*` | Starts with prefix |
| `*suffix` | Ends with suffix |
| `*contains*` | Substring match |
| `prefix*suffix` | Starts with prefix AND ends with suffix |
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

uivisor retries this cascade until one level finds exactly one match, up to the command's timeout. If a lower-priority level (e.g. `name=`) wins before a higher-priority element (e.g. `data-testid=`) has had a chance to render, the winner is re-checked 100 ms later and only accepted if it still wins — so a `data-testid` element that appears a moment later isn't missed by a weaker match. The first level to win never needs this check, since nothing can outrank it.

If the string still matches zero or more than one element at every level once the timeout runs out, the command fails with `Element not found after <timeout>ms: <selector>`, followed by the match count at each level — use that to pick a more specific pipe-syntax form.

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
- tapOn:
    xpath: "//button[@type='submit']"
- tapOn:
    xpath: "//table//tr[td='Alice']"   # XPath with union: use object form
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

Waits for an element to be visible, up to `defaultTimeout` (5 s by default; see [Timeouts](#timeouts)).

```yaml
- assertVisible: Welcome, Alice
- assertVisible:
    testId: success-banner
```

#### `assertNotVisible`

Waits for an element to be hidden or absent, up to `defaultTimeout`. **Passes immediately once the element is absent** (zero matches) — it doesn't wait out the full timeout just because nothing was ever there.

```yaml
- assertNotVisible: Error message
- assertNotVisible:
    testId: loading-spinner
```

#### `assertUrl`

Asserts the current URL path (including query string and hash) matches the given string. Supports `*` as a wildcard. Retries until it matches or `defaultTimeout` runs out — a passing check still passes immediately, but a failing one now takes up to the timeout to report as failed.

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

Asserts the number of elements matching a CSS selector. Note: this command takes a `css` key directly — not a standard selector object. Retries until the count matches or `defaultTimeout` runs out.

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

Pauses for the given number of milliseconds. Accepts an integer literal or a variable that resolves to a whole-number string.

```yaml
- wait: 500
- wait: ${timeout.short}   # works when vars.timeout.short is e.g. 500
```

#### `waitFor`

Pauses for the given number of milliseconds. Value must be a positive integer (> 0). Also accepts a variable resolving to a whole-number string.

```yaml
- waitFor: 3000
- waitFor: ${pollInterval}
```

#### `waitForPageLoad`

Waits for the page to finish loading. Optionally waits for the URL to match a path pattern first.

```yaml
# Bare — wait for network idle (30 s default timeout)
- waitForPageLoad:

# Short — wait for URL to reach /dashboard, then network idle
- waitForPageLoad: /dashboard

# Long — custom timeout in ms (0 = no timeout, wait indefinitely)
- waitForPageLoad:
    path: /dashboard
    timeout: 5000

# No timeout — wait forever
- waitForPageLoad:
    timeout: 0
```

The path is matched as a glob: `/dashboard` matches `https://any.host/dashboard`.
A negative timeout is a parse error.

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

The object form passes variables to the included flow for this call only:

```yaml
- runFlow:
    file: ./shared/login.yaml
    vars:
      userNric: S1234567A
      password: ${adminPassword}   # interpolated against the calling flow's variables
```

`file` is required and must be a non-empty string. `vars` is optional and follows the same rules as a top-level `vars:` block: nested keys become dotted names, values are coerced to strings, and `env.*` names are reserved. Any other key is a parse error. The included flow's own `vars:` and `config:` act as defaults. See [Variables in included flows](#variables-in-included-flows) for the resolution order and scoping rules.

Reports label the step with the resolved call-site values, for example `runFlow: ./shared/login.yaml (userNric=S1234567A, password=hunter2)`, so two calls to the same flow can be told apart. Every value passed in `vars:` appears in console output and reports, secrets included.

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

Finding the container retries until it matches or `defaultTimeout` runs out. A `timeout:` sibling key on `within` bounds only this container lookup — commands inside `do:` keep their own budgets (see [Timeouts](#timeouts)):

```yaml
- within:
    id: booking-card
    timeout: 10000       # only the container lookup gets this budget
    do:
      - tapOn: text=Book now   # uses defaultTimeout, not the 10000ms above
```

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

**Supported selector keys for `within`:** `id`, `text`, `name`, `placeholder`, `label`, `role`, `data-*`, `css`, `xpath`

```yaml
# Scope to a dialog by XPath
- within:
    xpath: "//div[@role='dialog']"
    do:
      - tapOn:
          role: button
          name: Confirm
```

---

### Sessions

Run commands across multiple browser tabs in a single flow. Declare named sessions at the top level, then route individual commands to a session with a `session:` field.

```yaml
appId: http://localhost:3000
sessions:
  - id: alice
  - id: bob
commands:
  - session: alice
    goto: http://localhost:3000/chat
  - session: bob
    goto: http://localhost:3000/chat
  - session: alice
    inputText:
      element:
        testId: message-input
      text: hello
  - session: alice
    tapOn:
      testId: send-btn
  - session: bob
    assertVisible: hello
```

**Rules:**
- Each `id:` in `sessions:` gets its own browser tab.
- Commands without a `session:` field go to the **first declared session** by default.
- A `session:` field can be added to any command, including `within` and nested commands inside `runFlow`.
- Flows without a `sessions:` block use a single unnamed session (existing behaviour unchanged).

---

## Reports

### Console (default)

On a terminal, each flow is shown as a live checklist: every step is listed as `○` before the first one runs, the running step shows a spinner and elapsed time, and finished steps show `✓`/`✗` with their duration. Steps after a failure show `–`. A `runFlow` expands into its child steps when it starts; `within` steps are listed nested from the start. When the flow ends, the finished checklist stays on screen.

When output is not a terminal (CI, a pipe, `> log.txt`), each flow prints after it finishes as append-only lines with pass/fail icons. Failed steps show the error and a path to an auto-captured screenshot. `--reporter plain` or `--reporter live` overrides the choice.

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

### Reusable setup with `runFlow`

```yaml
# flows/shared/login.yaml
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
