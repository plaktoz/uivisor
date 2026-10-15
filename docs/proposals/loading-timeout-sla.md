# Proposal: Loading-aware waits, configurable timeouts, and action response-time SLA

**Status:** Revised after review, ready for implementation
**Date:** 2026-10-13
**Scope:** `packages/core`, `uivisor-app` (parser, engine, reporters, CLI), `test-app`
**Evidence:** three manual walk-throughs of NS Hub QA2 (Appendix A). The measurement tool is [`assets/assess-loading.mjs`](assets/assess-loading.mjs). §7 is the spec; where the tool differs from it, §7.9 lists the difference and the decision.

---

## 1. Background

The run below failed because data was still loading:

```
✓ tapOn: "text=N3-3 Test-Room-Change"
✗ tapOn: "css=h6:nth-child(2)" — FAILED      ← page still showing "Loading..."
```

> The error itself (`Unknown attribute 'css'`) is a separate syntax problem: the `css=` string shorthand isn't
> supported, so use the object form `tapOn: { css: "h6:nth-child(2)" }`. Once that's fixed, the loading problem
> below is what you hit next.

What we have today:

- **String selectors don't wait at all.** `resolveLocator` (`packages/core/src/playwrightLocator.ts`) counts matches once and throws if there isn't exactly one. This happens before Playwright's own wait starts. Measured on the test-app: `assertVisible: data-testid=int-tap-result` on an absent element fails in 0.66 s of wall time; `assertVisible: { testId: int-tap-result }` fails after 5.63 s. Hand-written flows mostly use string selectors. Recorded flows use object selectors (`selectorHeuristics.ts`), so they already wait.
- **`assertNotVisible` with a string selector fails when the element is absent.** The same resolution step throws `No element found for pipe selector …`. Every integration flow uses the object form, which is why it hasn't shown up.
- **Object selectors have a hard-coded 5000 ms timeout** (`packages/core/src/commands.ts`). It can't be changed.
- **Fixed sleeps** (`wait: 10000`, `wait: 30000`) are slow on fast pages and still flaky on slow ones.
- **There's no way to declare a loading indicator once.** Each flow would need `waitFor`/`assertNotVisible` after every action.
- **There's no performance signal.** `durationMs` is recorded per command, but it doesn't reflect how long the app took to respond to an action.

## 2. Goals

1. Every element command waits for its target, whatever the selector form.
2. Make timeouts configurable: a project default, a flow default and a per-command override.
3. Wait for loading automatically, declared once per project, so flows don't need lots of `waitFor` steps.
4. Measure each action's **response time**, from the action (e.g. a click) until the app is ready for the next action.
5. **Warn** when an action's response time is over the project SLA (e.g. 3000 ms). A breach never fails the test.

## 3. Non-goals

- Load or performance testing. These are timings from one browser session, not benchmarks.
- Failing a run on an SLA breach. v1 warns only (§9).
- Measuring when a page *looks* finished (images, animations). uivisor measures **data ready** (§7.2, Q10).
- Replacing explicit `waitFor` completely. It stays as an escape hatch.
- Changing the selector syntax. The `css=` shorthand is out of scope.
- A machine-readable `timings.json` (Q7, deferred).

## 4. Design summary

| Part | What it does | Section |
|---|---|---|
| Waiting selector resolution | String selectors retry until a unique match, like object selectors | §6.1 |
| Configurable timeouts | `defaultTimeout` for element commands, `navigationTimeout` for page loads, `timeout:` per command. One budget per command covers every wait inside it | §5, §6 |
| Loading auto-wait | Before and after commands, waits until the app isn't busy. Busy = **any** of: a loader indicator showing, an app API call running, or app JS code downloading/starting up | §7 |
| Response time | Per action: from the interaction until the last real activity ends (or the next target appears) | §8 |
| SLA warning | ⚠ on the action's line and in the end-of-run summary when response time > `sla` | §9 |

The loading rule was chosen by comparing five candidate rules on the real app (Appendix A, session 3).

---

## 5. Configuration

All settings can go in the shared config file (`config:` in the flow header, loaded by `uivisor-app/src/parser/index.ts`) so every flow for the app inherits them.

```yaml
# employees-uitest/nshub.config.yaml   (shared by all flows)
defaultTimeout: 15000          # element commands: budget per command (ms)
navigationTimeout: 30000       # goto / reload / goBack / goForward: budget per command (ms)

loading:
  indicators:                  # busy while ANY is in its busy state
    - data-testid=overlay-loader              # removed from the page when loading is done
    - selector: text=Loading...               # the loader most NS Hub pages actually use
      state: visible
  network:
    urlPattern: "*/nshub/api/*"               # app API calls that count as busy
    ignore: ["*/bell-notification*"]          # background polling that never goes idle
    chunks: "*/nshub/*.js*"                   # app JS downloads (micro-app code), with or without ?query; false = off
    chunkQuietMs: 1000                        # code counts as busy for 1000ms after download (start-up)
  quietMs: 200                 # ready only after NO busy signal for this long
  appearWindow: 300            # after an action, watch this long for loading to start
  appearWindowAfterNav: 1000   # …this long if the action changed the URL or hash

sla: 3000                      # project SLA per action (ms); warn only
```

```yaml
# my-flow.yaml
appId: https://employees-nshub-qa2.digitalfactory.gov.sg/nshub
config: ./nshub.config.yaml
defaultTimeout: 20000          # optional: override for this flow only
commands:
- runFlow: ./login-flow-v1.yaml
- tapOn: text=N3-3 Test-Room-Change
- tapOn: { css: "h6:nth-child(2)" }    # no wait: needed
- pressKey: Enter
  timeout: 60000               # per-command override (sibling key)
  sla: 10000                   # this step has a known-longer SLA
```

The values above are the ones measured for NS Hub (Appendix A). The built-in defaults are in §5.2.

### 5.1 Per-command options use sibling keys

Per-command options sit **next to** the command key, not inside the selector:

```yaml
- tapOn: text=Book now
  timeout: 30000
  sla: 5000
  waitForLoading: false
```

This follows the existing `session:` sibling key, which `parseSessionedCommand` in `uivisor-app/src/parser/commandParser.ts` extracts the same way. It works with string selectors, object selectors and non-selector commands like `pressKey`, so selector objects don't need any reserved keys.

| Sibling key | Type | Meaning |
|---|---|---|
| `timeout` | int ms (`${var}` allowed) | Overrides `defaultTimeout` / `navigationTimeout` for this command |
| `sla` | int ms, or `false` | Overrides `sla` for this action; `false` turns the SLA check off for it |
| `waitForLoading` | `false`, or `{ network: false }` | `false` skips the loading auto-wait for this command; `{ network: false }` skips only the network/chunk part (§7.6) |

Sibling keys travel with the command all the way to execution. Today the runner and `within` hand only `sc.command` to `dispatch`, and `dispatch` interpolates only the `Command`. Both change: `dispatch` takes the whole step (command plus options), and interpolates `${var}` in the options at dispatch time, like `waitForPageLoad`'s `timeout` today.

A `timeout:` sibling on a command whose timeout trait is `none` (§6.2: `wait`, `waitFor: <ms>`, `scroll`, `setViewport`, `screenshot`, `setVar`, `testVarSet`, `unsetVar`, `runFlow`) is a parse error: `timeout is not supported on runFlow`. A stray key would otherwise do nothing silently.

`timeout:` on a container (`within`) bounds only the container lookup; commands in its `do:` block keep their own budgets, as steps inside a `runFlow` do. On `waitForPageLoad`, the timeout may be given inside its object or as a sibling key, but not both (parse error). In phase 1, `pressKey` has nothing to wait for, so its timeout trait is `none` and `timeout:` on it is a parse error; phase 2 switches it to `element` when the loading settle gives it a wait. The `pressKey` example in §5 is phase 2 syntax.

### 5.2 Precedence and built-in defaults

From highest to lowest. The first one that's set wins.

| Setting | 1 | 2 | 3 | 4 | Built-in default |
|---|---|---|---|---|---|
| Timeout | command `timeout:` | CLI `--timeout` | top-level flow header `defaultTimeout` | shared config | **5000** |
| Navigation timeout | command `timeout:` | CLI `--navigation-timeout` | top-level flow header `navigationTimeout` | shared config | **30000** |
| SLA | command `sla:` | CLI `--sla` | top-level flow header `sla` | shared config | **off** |
| Loading | command `waitForLoading:` | (none) | top-level flow header `loading` | shared config | **off** |

Built-in defaults within `loading` when it is set: `indicators: []`, `network` off (`chunks` off), `chunkQuietMs: 1000`, `quietMs: 200`, `appearWindow: 300`, `appearWindowAfterNav: 1000`.

With no `loading`/`sla` configured, existing flows behave as today except for two deliberate changes: string selectors now wait (§6.1), and `assertUrl`, `assertCount` and `within` now retry (§6, Q1). A flow that passes today still passes.

**Nested flows (`runFlow`):** a child flow inherits every setting in this section from the top-level flow. If a child flow's header or config sets one of these keys, it is ignored while the file runs via `runFlow`, and the console prints one notice per file: `login-flow-v1.yaml: defaultTimeout ignored (inherited from my-flow.yaml)`. The notice only prints when the child's value differs from the one in effect, so a child that shares the caller's config stays quiet. A grandchild's notice names the top-level flow, where the setting comes from. The same keys apply normally when that file runs as a top-level flow. Commands inside `within` inherit the settings that apply around them. Per-command sibling keys work everywhere, including inside child flows and `within`.

This differs on purpose from vars. Since #100, a child flow's `vars` (including its own `config:` vars) apply as defaults unless the caller set them, and `runFlow: { file, vars }` overrides them per call. Timeouts and `loading` stay inherit-only: a run has one timing policy, set by the top-level flow, its config and the CLI. A child that needs more time for one step uses a per-command `timeout:`.

### 5.3 Where the keys live

- **Shared config file.** `defaultTimeout`, `navigationTimeout`, `loading` and `sla` become reserved top-level names, like `workingSchedule`, `holidays` and `functions` today (`FLOW_CONFIG_KEYS` in `uivisor-app/src/parser/interpolate.ts`). They are no longer turned into vars, so `${sla}` stops resolving and fails with the usual missing-variable error.
- **Flow header.** The same four keys are added to `VALID_HEADER_KEYS` in `uivisor-app/src/parser/validator.ts`.
- **`${var}` in config and header values** is resolved at parse time, from config vars and the environment, as with every other header value. Runtime values from `setVar` aren't available there. Only per-command sibling keys see runtime vars (§5.1).

---

## 6. Which commands `defaultTimeout` applies to

`defaultTimeout` covers every command that **waits for an element**. Navigation has its own timeout because page loads are usually slower than element waits. Fixed sleeps and instant commands aren't affected.

| Group | Commands | Timeout used | Today |
|---|---|---|---|
| **Element actions** | `tapOn`, `doubleClick`, `hover`, `inputTextTargeted`, `clearText`, `selectOption`, `check`, `uncheck` | `defaultTimeout` | 5000 for object selectors; string selectors don't wait |
| **Element assertions** | `assertVisible`, `assertNotVisible`, `assertText`, `assertValue`, `assertEnabled`, `assertDisabled`, `assertChecked`, `assertUnchecked` | `defaultTimeout` | 5000 for object selectors; string selectors don't wait |
| **`inputText` shorthand** | `inputText` (fills the last tapped element) | `defaultTimeout` | Playwright default (30000), not passed |
| **Become waiting** ⚠ | `assertUrl`, `assertCount`, `within` (finding the container) | `defaultTimeout` | Checks once, no waiting |
| **Navigation** | `goto`, `reload`, `goBack`, `goForward` | `navigationTimeout` | Playwright default (30000) |
| **Own explicit value** | `waitForPageLoad` | its own `timeout:`, otherwise `navigationTimeout` | its own `timeout:`, otherwise 30000 |
| **Keyboard action** | `pressKey` | `defaultTimeout`, used only by the loading settle after it (§7.4) | n/a |
| **Not affected** | `wait`, `waitFor: <ms>` (sleeps), `scroll`, `setViewport`, `screenshot`, `setVar`, `testVarSet`, `unsetVar`, `runFlow` | n/a | n/a |

⚠ **Behaviour change:** `assertUrl`, `assertCount` and `within` *keep checking* until they match or the timeout runs out, instead of checking once. Then `wait: 30000` followed by `assertUrl` (as in `login-flow-v1.yaml`) can become just `assertUrl`. A passing check still passes; a failing one now takes up to `defaultTimeout` to fail (Q1, decided).

**The timeout is a maximum, not a delay.** A command continues as soon as its condition is met. It only waits the full timeout when it's about to fail.

**One budget per command.** A command's timeout is the deadline for everything it waits on: the loading pre-check (§7.5), finding its target (§6.1), the interaction, and for actions the loading settle (§7.4). There is no separate loading timeout. When the deadline passes, the error names the wait that was running, e.g. `Loading did not finish within 15000ms — still busy: …` or `Element not found after 15000ms: text=Book now`.

### 6.1 Selector resolution waits

`resolveLocator` and `resolveContainerLocator` (`packages/core/src/playwrightLocator.ts`) become retry loops bounded by the command's deadline:

1. Run the cascade (bare string) or the pipe segments (`a=x|b=y`) as today. The first step with exactly one match wins (`within`: at least one match).
2. **Stability check.** If the winning step is not the first step, run the whole resolution again 100 ms later and accept only if the same step wins again. This stops a lower-priority match (e.g. `text=Submit` on a heading) winning while the higher-priority element (e.g. `data-testid=Submit`) is still rendering. If the first step wins, no check is needed, because nothing can outrank it. Object selectors and single-segment strings (`text=Foo`) have one step and never need the check.
3. No winner yet, or the check failed: retry every 100 ms until the deadline.
4. At the deadline, throw `Element not found after <timeout>ms: <selector>` followed by the per-step match counts from the last attempt (the detail lines shown today). "More than one match" also retries, because a list that is still loading can briefly contain duplicates.
5. The `xpath` object form, which also counts once today, uses the same loop.
6. If resolution succeeds but the interaction (click, fill, check, …) runs out of the remaining budget, the error is `Element not actionable after <timeout>ms: <selector>`, so the message says which half failed.

**Not-visible commands.** `assertNotVisible` and `waitFor: { notVisible }` pass as soon as the target is absent (zero matches on every step) or present but hidden. Absent counts as not visible. With duplicates, the first step that has any match decides: the command passes when every one of its matches is hidden. This fixes the string-selector failure described in §1.

### 6.2 Command traits live in one table

§6, §7.5 and §8.1 each classify commands: which timeout applies, whether the loading pre-check runs, whether it is an action, and whether it is a checkpoint. These four facts live in one table in `packages/core`, keyed by command type, instead of in branches of `dispatcher.ts`:

```ts
type CommandTraits = {
  timeout: 'element' | 'navigation' | 'none';
  preCheck: boolean;     // §7.5
  action: boolean;       // §8.1
  checkpoint: boolean;   // §8.2
};

export const COMMAND_TRAITS: Record<Command['type'], CommandTraits> = { /* one entry per command */ };
```

Typed as `Record<Command['type'], …>`, so adding a command without declaring its traits fails `tsc`.

---

## 7. Loading auto-wait

When `loading` is set, the runner waits around commands automatically.

### 7.1 Busy signals: OR

The app is **busy** if **any** of these is true. It's **ready** only when **none** has been true for `quietMs` (200 ms) in a row:

| Signal | Busy while | Quiet period after it ends | Section |
|---|---|---|---|
| **Indicator** | any declared indicator is in its busy state | `quietMs` | §7.2 |
| **API** | any request matching `network.urlPattern` (and not `ignore`) is in flight | `quietMs` | §7.3 |
| **Chunk** | any JS download matching `network.chunks` (and not `ignore`) is in flight | **`chunkQuietMs`** (1000 ms) | §7.3 |

- **OR** is what makes the fallbacks work. A page with only `Loading...` is caught without `overlay-loader`, and a page with no loader at all is caught by its API calls.
- **`quietMs`** absorbs loader flicker: on Resource Booking, `Loading...` hid and re-appeared **2 ms later** for another 717 ms (A2). With the quiet period, that's one loading period, not two.
- **`chunkQuietMs`** covers micro-app start-up. NS Hub's sections are separate micro-apps downloaded on first visit. After the code arrives, the app takes **70–470 ms** to start before showing a loader or calling APIs, and during that time no signal is active (A7). Without the longer quiet period, the runner declares ready during start-up. This was the only rule that measured IT Services' first visit correctly (A12).

### 7.2 Indicators: detected from page events, not periodic checks

**Why not just check the page now and then:** a check only sees the page at that moment. A loader that appears and disappears between two checks (a "blink") is missed, which gives wrong timings and hides loaders that appear late.

**Design:** each session page gets an init script (`page.addInitScript`; every session is a separate `browser.newPage()` and therefore its own browser context) that runs before the app's own scripts on every new document. It uses a `MutationObserver` on `document` (`childList`, `subtree`, `characterData`, `attributes: class/style/hidden`), so the browser reports every relevant change, however brief.

- **Events are pushed to Node** through `page.exposeBinding`, as the measurement tool does. Each event carries its page timestamp, converted to epoch time with `performance.timeOrigin + performance.now()`. An in-page log would be lost whenever navigation replaces the document; pushed events are not.
  ```js
  { kind: 'appear' | 'disappear' | 'init', indicator: 0, t: 1760342400123.4 }   // t = epoch ms
  ```
- **A blink can't be missed**, and loader durations come from the page's own timestamps.
- **"Is anything busy right now?"** is answered in Node from the accumulated events. No `page.evaluate` round trip.
- **Main frame only.** The script returns immediately when `window.top !== window`. Iframes are not observed (§7.2 Limits).
- **New document resets state.** When the init script starts on a new document it sends `init` with the indicators currently busy. Node drops that page's previous indicator state, because the old document is gone.
- **Indicators are fixed for the whole top-level flow** (§5.2). Init scripts can't be removed, so the list is installed once per session page, when the page is created.

**Indicator states:**

| `state` | Busy when | Use for |
|---|---|---|
| `present` (**default**) | a matching element is in the DOM | `overlay-loader`, which is removed from the page when loading finishes |
| `visible` | a matching element is in the DOM *and* rendered (`checkVisibility({ visibilityProperty: true })`: not `display:none`, `visibility:hidden`, `hidden`, or zero size) | text-based or CSS-toggled loaders, e.g. `Loading...` |

A plain string is short for `{ selector: <string>, state: present }`.

**Evaluating selectors inside the page:**
- Allowed: single-segment strings `data-*=`, `id=`, `name=`, `text=`, `xpath=`, and the objects `{ css }`, `{ testId }`, `{ text }`, `{ xpath }`. Attribute selectors use `document.querySelectorAll`, with the same `*` wildcard rules as `buildAttrCss`. `xpath` uses `document.evaluate`.
- Rejected at parse time with a clear error: bare strings (the cascade has no single meaning in the page), multi-segment pipe strings, `role=`, `label=`, `placeholder`.
- **Text matching mirrors uivisor's locator semantics**, not the measurement tool's. `text=Loading...` matches an element whose whole text, with whitespace collapsed, is exactly `Loading...`; `*` is a wildcard. `{ text: 'Loading' }` is a substring match. The tool used a substring match, so if a page's loader text has extra words, declare `text=*Loading...*`.
- `text` must be efficient on large pages. A full-document XPath scan per DOM change measured up to **21 ms** on heavy pages (A10). Instead, keep the set of currently matching elements. On each mutation batch, (a) re-check that the tracked elements are still connected and visible, and (b) scan only the **added or changed subtrees** for new matches.

**Limits** (documented, not solved in v1):
- Loaders inside **shadow DOM** aren't observed.
- Loaders inside **any iframe** aren't observed.
- A loader that hides itself only by an `opacity` fade isn't seen as gone until it's removed or set to `display:none`. This doesn't matter for `overlay-loader`, which is removed.

### 7.3 Network and chunks

- Uses the session page's `request`, `requestfinished` and `requestfailed` events. These are reported for every request, so none can be missed.
- **API:** requests with `resourceType` `xhr`/`fetch` whose full URL matches `urlPattern`.
- **Chunks:** requests with `resourceType` `script` matching `chunks`. NS Hub's code lives at `/nshub/<micro-app>/static/*.js`, which `urlPattern` (`*/nshub/api/*`) would not match; that's why it's a separate pattern.
- **Patterns** use uivisor's existing `matchesPattern`: `*` matches any run of characters, including `/`, and the pattern must match the whole URL. `**` works but means the same as `*`.
- `ignore` applies to both. Third-party traffic (e.g. Dynatrace on `activegate…`) is excluded by the patterns already.
- A request that **fails** counts as finished, so it doesn't keep the app busy forever. A `500` does not hang the wait.
- WebSockets aren't counted (they don't produce request events). Long-polling and other background polling **must** be listed in `ignore`, otherwise the app never looks idle and the command's deadline passes. The error lists the requests still in flight, so a missing `ignore` entry is easy to spot.
- Off by default; enable per project. **NS Hub needs it:** Home and Discover have no loader at all, and only network tracking caught Home's 4.5 s response (A4).

### 7.4 After an action (settle)

Around every **action** command (§8.1):

1. **Before** performing it: note the current URL and the time.
2. Perform the action.
3. **Watch window:** wait up to `appearWindow` (300 ms), or **`appearWindowAfterNav` (1000 ms) if the URL or hash changed**, for any busy signal to start.
   - Why: loading usually starts 50–200 ms after a click, but after a page change it can take **~520 ms** even with no new code to download (Home, A13).
   - The window ends early as soon as a busy signal starts.
4. **Settle:** if anything became busy (or was already busy), wait until the app is ready (§7.1), within the action's budget (§6). "Already over" counts too: a loader that blinked inside the window is in the event stream.
5. If the deadline passes, the action fails with a message naming the cause:
   `Loading did not finish within 15000ms — still busy: text=Loading... (visible 14800ms); GET /nshub/api/.../rooms (in flight 14600ms)`.

**Cost:** the watch window and quiet periods add test run time (up to ~1.2 s after a page change, plus 1 s after a first-visit code download). They are **not** counted in the response time (§8.2).

### 7.5 Before an element command (pre-check)

Before every command whose traits have `preCheck` (§6.2; the *Element actions*, *Element assertions*, *`inputText` shorthand* and *Become waiting* groups):

1. If nothing is busy and no quiet period is still running, continue straight away.
2. Otherwise, wait until ready (§7.1), within the command's budget (§6).

This catches loading that starts after the watch window ended, or that was triggered by something other than the last action (timers, background refresh). Any busy time seen here is attributed to the previous action in the same session (§8.2).

### 7.6 When it's skipped

- The command has `waitForLoading: false`.
- `waitForLoading: { network: false }` skips only API/chunk tracking for that command, e.g. a step where a known slow request runs in the background.
- The command's selector is one of the declared indicators (e.g. `assertVisible: data-testid=overlay-loader`), so asserting on the loader doesn't block on itself.
- Commands whose traits have `preCheck: false` and `action: false`.

### 7.7 Explicit condition wait (escape hatch)

For the rare spot that auto-wait doesn't cover, `waitFor` also accepts a condition. A plain number keeps its current meaning, a sleep:

```yaml
- waitFor: 2000                                                  # unchanged: sleep
- waitFor: { notVisible: "data-testid=skeleton-row", timeout: 30000 }
- waitFor: { visible: { css: "h6:nth-child(2)" } }               # timeout → defaultTimeout
```

### 7.8 Coverage across NS Hub

| Page behaviour | Covered by |
|---|---|
| Uses `data-testid=overlay-loader` (seen only on the login callback) | Indicator, `state: present` |
| Shows `Loading...` (most pages) | Indicator, `state: visible` |
| No loader; data loads from the API (Home, Discover) | `network` API tracking |
| First visit to a section (micro-app code download + start-up) | `network.chunks` + `chunkQuietMs` |
| Page change whose loading starts ~0.5 s later | `appearWindowAfterNav` |
| No loader and no matching request; content appears late | Waiting resolution (§6.1): the next command keeps retrying until its target exists |
| Something matching the selector exists before the data (skeletons, headers) | One explicit `waitFor: { notVisible: ... }` |

Each explicit `waitFor` that's left points to a page where developers should add `overlay-loader`.

### 7.9 Differences from the measurement tool

`assets/assess-loading.mjs` produced the numbers in Appendix A. It is not code to port line by line. The portable part is about 60 lines: the observer, the in-flight request map, and the R3 readiness check. Everything else (F2 marks, rule scoring, long-task and DOM signals, summaries) is assessment scaffolding.

| Tool | This spec | Why |
|---|---|---|
| `Loading...` found by a full-document `contains(text(), …)` XPath scan | uivisor text semantics, subtree-only scanning | Consistent with locators; A10 scan cost |
| Indicators hard-coded | Declared in config | Per project |
| `ignore` is a substring match | `matchesPattern` globs | Same matcher as `assertUrl` |
| All xhr/fetch/script requests count, minus `ignore` | Only `urlPattern` / `chunks` matches count | Third-party traffic excluded by default |
| One appear window (300 ms) | 300 ms, or 1000 ms after a URL/hash change | A13 |
| Disappear time taken when Node receives the event | Page timestamp carried in the event | Precise `readyAt` |
| Main frame only; state reset on new document | Same | Matches what was measured |

---

## 8. Action response time

### 8.1 Which commands are "actions"

Response time is measured for and attached to **actions**, the commands that change app state (traits `action: true`):

`tapOn`, `doubleClick`, `inputText`, `inputTextTargeted`, `clearText`, `pressKey`, `selectOption`, `check`, `uncheck`, `goto`, `reload`, `goBack`, `goForward`

Assertions and waits are not actions. They are where the measurement **ends** (§8.2). `hover` is left out (Q4).

### 8.2 Definition

> **responseMs(A) = readyAt − startedAt(A)**, where `startedAt` is when action A's interaction is dispatched
> (e.g. the click), and **`readyAt` is the latest of:**
>
> 1. the end of A's interaction itself;
> 2. the end of the **last real busy activity** seen while waiting after A (loader disappeared, API request
>    finished, chunk finished). This includes requests that started *before* A but were still running;
> 3. the moment the **next checkpoint's condition first held**, if it didn't already hold when the app went
>    ready.
>
> **Not counted:** the watch window, `quietMs`, `chunkQuietMs`, fixed sleeps, and instant commands in between.
> Those are how long the runner waits *to be sure*, not how long the app took.

A **checkpoint** is the next command in the **same session** whose traits have `checkpoint: true`: an element command (its target found and visible, or for `assertNotVisible` gone), or `assertUrl`, `assertCount`, `waitForPageLoad` or a `waitFor` condition passing. Commands in other sessions don't end the measurement. If A is the last action in its session, the measurement ends with A's settle phase.

This is the definition that matched reality in session 3: on IT Services' first visit it gave exactly the time the loader disappeared (2,132 ms), not the time the runner finished waiting (A12).

```
 click "IT Services"                                                   next command
 │◄perform►│◄ chunks ►│◄ start-up ►│◄──── Loading... ────►│◄ quiet (not counted) ►│
 │  10 ms  │  ~900 ms │   268 ms   │       948 ms         │      200–1000 ms      │
 └───────────── responseMs = 2,132 ms ──────────────────┘
                                                        ↑ readyAt = last activity end
```

### 8.3 Breakdown recorded

| Field | Meaning |
|---|---|
| `performMs` | Time for the interaction itself (click, fill, key press, navigation) |
| `busyMs` | Time from the end of the interaction to the end of the last busy activity |
| `targetWaitMs` | Extra time until the next checkpoint's condition held (0 if it already did) |
| `excludedMs` | Waiting that was not counted: watch window, quiet periods, sleeps, instant commands |
| `signals` | Which signals were involved, e.g. `{ indicators: ['text=Loading...'], api: 2, chunks: 6 }` |
| `responseMs` | `readyAt − startedAt` (§8.2) |

### 8.4 Implementation notes

- **Separating "wait for target" from "perform":** Playwright's `click()` waits and clicks in one call. To measure them separately, element actions first resolve the target (§6.1) and run `locator.waitFor({ state: 'visible' })` within the deadline, recording when the target became visible, and then call `click()`, timed as `performMs`. The remaining actionability checks inside `click()` (stable, enabled) are short and counted in `performMs`.
- **Timeline lives in `RunContext`, one per session:** `pendingActions: Map<sessionId, PendingAction>`, where `PendingAction = { result, startedAt, lastActivityEnd, excludedMs }`. Each session's loading tracker updates its own entry; the next checkpoint in that session finalises it. Because it's on the shared context, measurement continues across `runFlow` and `within` boundaries.
- **Tracking `lastActivityEnd`:** loader `disappear` events (page timestamps, §7.2), and `requestfinished`/`requestfailed` times for API and chunk requests.
- **The timing is written onto A's `CommandResult`** after the checkpoint passes. The console prints results once the flow finishes (`uivisor-app/src/cli/runner.ts`), so the timing is already there when the action's line prints (Q6).
- **Navigation detection** for `appearWindowAfterNav`: compare `page.url()` before and after the action, and listen to `framenavigated` on the main frame (it fires for hash changes too, which NS Hub uses for routing).

### 8.5 Edge cases

| Case | Behaviour |
|---|---|
| **Fixed sleep between A and the checkpoint** | With `loading` configured, settle finishes *before* the sleep starts, so the timing is unaffected. The sleep is pure waste, so the report adds a hint to remove it. Without `loading`, the app may have been ready during the sleep: record a **lower bound**, mark it `masked: { byMs }`, and **don't check the SLA**. |
| **Checkpoint fails (timeout)** | The flow fails as it does today. A's response is recorded as `> <timeout>ms`. Reported as a failure, not an SLA warning. |
| **`--slow-mo` > 0** | Playwright adds a delay to every operation, so timings are inflated. Timings are still recorded, but **SLA checks are turned off** with a notice: `SLA checks disabled: --slow-mo 500 distorts timings`. |
| **Two actions in a row in the same session with no checkpoint between** (e.g. `tapOn` then `pressKey`) | The second action acts as the checkpoint for the first: its target-ready moment (or its start, for `pressKey`) ends the first measurement. |
| **Action in session A, next command in session B** | A's measurement stays open until the next checkpoint or action in session A. |
| **Action fails** | No response time is recorded. The failure is reported as usual. |
| **`--headed`** | Timings are recorded and the SLA is checked, with a footnote in the report that a headed browser is a bit slower (Q3). |

---

## 9. SLA warnings

When `responseMs` is over the SLA that applies (§5.2), the action gets an **SLA breach**.

- A breach is always a **warning**. The flow still passes and the exit code isn't affected.
- It shows on the action's console line and in the SLA summary at the end of the run, and the same way in the HTML and Markdown reports.
- Masked timings (§8.5) and runs with `--slow-mo` are never checked.

### 9.1 Console

```
▶ Running: my-flow.yaml
  ✓ runFlow: ./login-flow-v1.yaml
  ✓ tapOn: "text=N3-3 Test-Room-Change"           4210ms  ⚠ SLA 3000ms (busy 3900ms: Loading..., 3 api)
  ✓ tapOn: {"css":"h6:nth-child(2)"}               180ms
  ✓ tapOn: "text=12"                                95ms
  ...
PASSED — 22/22 commands passed

SLA 3000ms — 1 of 14 measured actions exceeded:
  ⚠ my-flow.yaml step 2  tapOn "text=N3-3 Test-Room-Change"  4210ms  (perform 40 / busy 3900 / target 270)
  ℹ 2 fixed waits (wait:) can be removed — loading auto-wait already covers them
```

The console doesn't print durations today. With this change it prints `responseMs` for measured actions only.

### 9.2 HTML and Markdown reports

- Add a **Response** column next to the existing duration column (`renderCommandRows` in `uivisor-app/src/reporter/html.ts`, `renderCommandTable` in `markdown.ts`). Show `responseMs` for actions and `—` for everything else.
- Highlight breaches (e.g. amber row or ⚠ icon). Hovering or expanding shows the breakdown from §8.3.
- Add an **SLA summary** section at the end: the threshold, number of actions measured, breaches, the slowest 5 actions, and masked actions.

### 9.3 Result model (`packages/core/src/types.ts`)

```ts
export interface ActionTiming {
  responseMs: number;
  performMs: number;
  busyMs: number;
  targetWaitMs: number;
  excludedMs: number;
  signals: { indicators: string[]; api: number; chunks: number };
  masked?: { byMs: number };            // fixed sleep hid the real response time (no `loading` configured)
  sla?: { limitMs: number; breached: boolean };
}

export interface CommandResult {
  // ...existing fields
  timing?: ActionTiming;                // present only on action commands
}
```

`FlowResult` and `RunResult` don't change. Reporters count breaches by walking the command results, including nested ones.

### 9.4 Validation at parse time

- `timeout`, `defaultTimeout`, `navigationTimeout` and `sla` must be positive integers (`sla` may also be `false` per command). `${var}` placeholders are allowed (§5.3 says when they resolve).
- `loading.quietMs`, `appearWindow`, `appearWindowAfterNav` and `network.chunkQuietMs` must be integers ≥ 0. `0` turns that wait off.
- `network.urlPattern`, `network.chunks` (or `false`) and `ignore` entries must be non-empty strings.
- Indicator selectors must be one of the forms allowed in §7.2.
- **Warning** if an action's timeout is ≤ its SLA. A slow action would then *fail* before it could *warn*. Recommend timeout ≥ 3× SLA.

---

## 10. Implementation map

| Area | File(s) | Change |
|---|---|---|
| Types | `packages/core/src/types.ts` | `timeout`/`sla`/`waitForLoading` on `SessionedCommand` (next to `session`); `FlowConfig` gets `defaultTimeout`, `navigationTimeout`, `loading`, `sla`; `RunContext` gets the resolved settings and `pendingActions` per session; `ActionTiming` |
| Command traits (new) | `packages/core/src/commandTraits.ts` | `COMMAND_TRAITS` table (§6.2) |
| Selector resolution | `packages/core/src/playwrightLocator.ts` | `resolveLocator` / `resolveContainerLocator` retry until the deadline, with the stability check and not-visible mode (§6.1) |
| Core commands | `packages/core/src/commands.ts` | Every `execute*` takes a deadline in place of the hard-coded `5000`; navigation commands use `navigationTimeout`; `assertUrl` and `assertCount` retry; `executeWithin` passes whole steps to its dispatch callback; `executeWaitFor` accepts a condition; separate target-wait and perform steps for element actions |
| Loading tracker (new) | `packages/core/src/loading.ts` | `installLoadingObserver(page, indicators)` (init script + binding, §7.2); `NetworkTracker` (API + chunk requests, §7.3); `waitForAppIdle(tracker, deadline)` implementing §7.1/§7.4/§7.5 and returning `lastActivityEnd`. One tracker per session page |
| Errors | `packages/core/src/commands.ts`, `playwrightLocator.ts` | `Element not found.` → `Element not found after 15000ms: <selector>` plus per-step counts |
| Parser | `uivisor-app/src/parser/commandParser.ts` | `parseSessionedCommand` also extracts `timeout`, `sla` and `waitForLoading`; `waitFor` accepts an object; indicator selector forms validated |
| Header and config | `uivisor-app/src/parser/index.ts`, `interpolate.ts`, `validator.ts` | Reserve the four keys in `FLOW_CONFIG_KEYS` and `VALID_HEADER_KEYS`; validate (§9.4); apply precedence (§5.2) |
| CLI | `uivisor-app/src/cli/args.ts` | `--timeout`, `--navigation-timeout`, `--sla` |
| Session pages | `uivisor-app/src/driver/browser.ts`, `cli/runner.ts` | Install the observer and network tracker on each session page when it is created |
| Engine | `uivisor-app/src/engine/index.ts`, `dispatcher.ts`, `context.ts` | `dispatch` takes the whole step and interpolates its options; work out the effective settings per command from traits and precedence; run settle and pre-check within one deadline; detect navigation; maintain the per-session timeline; attach `timing` to action results; check the SLA; print the ignored-key notice for child flows |
| Reporters | `uivisor-app/src/reporter/console.ts`, `html.ts`, `markdown.ts` | Response column and inline ⚠, SLA summary, masked notes, removable-`wait:` hint, slow-mo notice, headed footnote |
| Recorder | `recorder-app/` | No change needed; recorded flows benefit automatically |

### Suggested phases

1. **Waiting resolution and timeouts:** §5.1, §5.2, §5.3, §6 (including §6.1 and §6.2). Fixes string selectors and `assertNotVisible`, and removes most `wait:` steps. Low risk.
2. **Loading auto-wait and conditional `waitFor`:** §7.
3. **Response time and SLA:** §8, §9. Needs phase 2.

Each phase is its own `/proj-new-feature` run.

---

## 11. Test plan

### Unit (`packages/core`, `uivisor-app/tests/unit`)

- Resolution (§6.1): an element added after 500 ms is found by a bare string, a pipe string and an object selector; a lower-priority cascade match that appears before the testid element doesn't win when the testid element follows within 100 ms; duplicates that collapse to one match resolve; the timeout error carries per-step counts.
- `assertNotVisible` passes for an absent element with a string selector.
- `COMMAND_TRAITS` has an entry for every command type.
- One budget: a loader lasting 3 s with `timeout: 2000` fails with `Loading did not finish within 2000ms`; with `timeout: 5000` it passes.
- Precedence across command, CLI, top-level flow, config and built-in, for each setting. Child flow keys ignored with a notice.
- Parser: sibling keys on string, object and non-selector commands; sibling keys inside `within`; `${var}` in a sibling resolved from a runtime `setVar`; invalid values rejected; reserved config keys no longer become vars.
- `waitFor` with a number vs. an object.
- Busy rule (§7.1) with simulated signal timelines: OR across signals; `quietMs` absorbs a 2 ms re-show; `chunkQuietMs` bridges a 268 ms start-up gap; `appearWindowAfterNav` used only when the URL changed; indicator state reset on a new document.
- `readyAt` (§8.2): last activity end, not detection time; quiet periods excluded; a request started before the action still counts; target-visible time used only when later than idle.
- Timeline across `runFlow` and `within`; last action in a flow; action followed directly by another action; a checkpoint in another session doesn't end the measurement.
- SLA: breach and no breach; `sla: false`; breach doesn't change pass/fail or exit code; turned off under `--slow-mo`; warning when timeout ≤ SLA.

### Integration (required by CLAUDE.md)

Each phase must ship a passing flow under `test-app/flows/integration/`, run against the live test-app with `node uivisor-app/dist/cli/index.js test <flow>`. The test-app needs pages that reproduce what was measured on NS Hub:

| Page | Reproduces | Phase |
|---|---|---|
| Content rendered after a set delay (e.g. `?delay=1500`), no loader | waiting resolution (§6.1) | 1 |
| A heading with text `Submit` renders first, the `data-testid="Submit"` button 50 ms later | cascade stability check (§6.1) | 1 |
| Button shows `data-testid="overlay-loader"` for a set delay, then renders content | basic indicator, `present` | 2 |
| Shows only the text `Loading...`, no test id | `visible` text indicator (A3) | 2 |
| Loader hides and re-shows after 2 ms, then hides for good | flicker / `quietMs` (A2) | 2 |
| Loader added and removed within ~10 ms | blink detection | 2 |
| No loader; fetches `/api/...` with a delay, plus a background polling endpoint | `network`, `ignore` (A4, A5) | 2 |
| Click lazy-loads a JS chunk; after ~300 ms of "start-up" it shows a loader and calls the API | micro-app gap / `chunkQuietMs` (A7, A12) | 2 |
| Hash route change whose API calls start ~500 ms later, no chunk | `appearWindowAfterNav` (A13) | 2 |
| Loader starts ~1500 ms after the click (after every window) | pre-check (§7.5) | 2 |
| A skeleton element matches the selector before the real content loads | `waitFor` escape hatch | 2 |

Example flows:

- `timeouts.yaml` (phase 1): a delayed element found with string and object selectors; a slow element passes with `timeout: 8000`; `assertNotVisible` with a string selector on an absent element; `assertUrl` after a delayed redirect without `wait:`. A separate negative flow checks the same slow step fails at the default 5000.
- `loading-autowait.yaml` (phase 2): no `wait:` steps; passes on every loader page above.
- `sla-warning.yaml` (phase 3): SLA 1000, delay 1500 → the console and report show a breach; the flow passes and exits 0. Also asserts the micro-app page's `responseMs` is within ±200 ms of the simulated loading end (quiet periods not counted).

---

## 12. Decisions

| # | Question | Decision |
|---|---|---|
| Q1 | Should `assertUrl`/`assertCount` start polling (behaviour change), or should that be opt-in? | **Decided:** retry by default, and `within` too (§6). Passing flows aren't affected. |
| Q2 | Should the watch window / quiet periods count towards `responseMs`? | **Decided:** no. `readyAt` = last real activity (§8.2), validated in session 3 (A12). |
| Q3 | Should SLA checks run in `--headed` mode? | Yes, with a footnote in the report. Proposed default, not contested in review. |
| Q4 | Should `hover` count as an action? | No. Proposed default, not contested in review. |
| Q5 | Should the SLA allow different limits by action type (e.g. `goto` 5000, `tapOn` 3000)? | Not in v1. Use per-command `sla:` for exceptions. Proposed default, not contested in review. |
| Q6 | Should the console print the timing on the action's line or on a follow-up line? | **Decided:** on the action's line. Results already print after the flow finishes, so no delay logic is needed (§8.4). |
| Q7 | Should we also write a machine-readable `timings.json` per run? | **Decided:** deferred past v1. |
| Q8 | What are NS Hub's `urlPattern`/`ignore` values? | **Answered** (A5, A12): see §5. |
| Q9 | Is in-page scanning fast enough? | **Answered** (A10): yes, with subtree-only text scanning (§7.2). |
| Q10 | Should image loading be an optional "looks ready" signal? Users waited for images on Discover (A11). | Not in v1. Measure data ready only. Proposed default, not contested in review. |
| Q11 | Is the extra run time acceptable (up to ~1.2 s after page changes, +1 s after first-visit code downloads)? | Yes, as a correctness trade-off. Settings are per project. Proposed default, not contested in review. |
| Q12 | How should retrying resolution handle a lower-priority cascade match that appears first? | **Decided:** stability check, only when the winning step isn't the first (§6.1). |
| Q13 | What may a child flow override? | **Decided:** nothing. Child flows inherit every setting; their own values apply only when run top-level (§5.2). Re-confirmed after #100 made child `vars` act as defaults: timeouts deliberately don't follow that model. |
| Q14 | How do the new settings live in the config file? | **Decided:** reserved top-level names (§5.3). |
| Q15 | Should an SLA breach ever fail the run? | **Decided:** no. Warning on the action's line and in the end-of-run summary. `failOnBreach` and `--sla-strict` are dropped, and `sla` is a plain number (§9). |
| Q16 | How do the pre-check, element wait and settle timeouts combine? | **Decided:** one budget per command, the command's timeout. `loading.timeout` is dropped (§6). |
| Q17 | What does `timeout:` do on a command with no timeout (`runFlow`, `wait`, …)? | **Decided:** parse error (§5.1). |
| Q18 | Does `timeout:` on `within` apply to its `do:` commands? | **Decided:** no, container lookup only (§5.1). |
| Q19 | `pressKey` in phase 1 and `waitForPageLoad` with two timeouts? | **Decided:** `pressKey` rejects `timeout:` until phase 2; `waitForPageLoad` accepts inner or sibling, both is a parse error (§5.1). |
| Q20 | Notice noise, interaction-timeout wording, grandchild notice, hidden duplicates? | **Decided:** notice only when values differ; `Element not actionable after …` for interaction timeouts; grandchild notice names the top-level flow; hidden duplicates pass in not-visible mode (§5.2, §6.1). |

---

## Appendix A: Assessment findings, NS Hub QA2 (2026-10-13)

Three manual walk-throughs, using an assessment browser that records loader events (in-page `MutationObserver`), API/JS requests and clicks, with the tester pressing **F2** when each page *looked* ready. The session-3 version of the tool is kept at [`assets/assess-loading.mjs`](assets/assess-loading.mjs); it writes its logs to the gitignored `target/assess/`. Raw logs were kept locally only; they contain user names from the test environment.

Findings are numbered **A1–A14** (not "F…", to avoid confusion with the F2 key).

### Session 1: loaders and API calls only

| # | Finding | Impact on design |
|---|---|---|
| A1 | **Loading started late after route changes:** 0.8–1.5 s after the click on Discover, IT Services, Building and Facilities. The tool reported "ready 0 ms". Cause confirmed in session 2 (A7). | Superseded by A7, A12 and A13. |
| A2 | **Loader flicker:** on Resource Booking, `Loading...` hid and re-appeared **2 ms later** for another 717 ms. | `quietMs` (§7.1). |
| A3 | **`overlay-loader` is rare:** seen only on the login callback. Every other page used `Loading...` text. | The text indicator is the main signal in practice; keep both (§5). |
| A4 | **Pages without any loader:** Home and Discover. Only network tracking caught Home's **4,481 ms** response (`suggested-action` took 4.2 s). | Network tracking is required for NS Hub (§7.3). |
| A5 | **Background traffic:** Dynatrace monitoring beacons (`activegate.ca-sit.defcloud.gov.sg`, about 1 per second) and notification polling (`…/bell-notification`, `/refresh`, `/service-workspace-task-info`). | `urlPattern` excludes Dynatrace (different host); `ignore: ["*/bell-notification*"]`. |
| A6 | **Environment issues at the time:** many `500`s (`ems-ms`, `rbs-ms`, `iqr`, `fms-ms`) and duplicate calls. Fixed before session 2. | A failed request counts as finished (§7.3). |

### Session 2: JS chunks tracked (86 actions, 10 F2 marks)

| # | Finding | Impact on design |
|---|---|---|
| A7 | **NS Hub sections are micro-frontends** (`ems-web`, `iqr-microapp-web`, `fms-web`, `rbs-microapp-web`), each downloading `remoteEntry.js` plus chunks on first visit. After the last chunk there's a **70–470 ms start-up gap** with no detectable activity before the loader/API calls start. The tool declared ready inside the gap (Discover: 727 ms reported vs ~3.5 s real; IT Services: loader appeared 70 ms after "ready"). Second visits (code cached) were correct. | Track chunks (§7.3) with a longer quiet period (§7.1, A12). |
| A8 | **Human reaction time** after a page is ready is ~300–500 ms at best. Of 4 actions where the tool was >500 ms ahead of the F2 mark, none was a confirmed detection miss (a script attribution bug, reaction time, an animation, and one unexplained). | Use F2 marks as a rough guide; decide on per-action timelines. |
| A9 | **SLA breaches (>3,000 ms):** booking Confirm 3,839 ms; opening Submit feedback 5,334 ms; Home ~3.3 s; Discover first visit ~3.5 s. Slowest APIs: `rbs/rooms/bookings/start-time-slots` up to **7,424 ms**, `rbs/rooms` avg 3,375 / max 6,999 ms. | The cases the SLA warning should surface. Shared with the app team. |
| A10 | **In-page scan cost:** avg 1.3 ms, worst **21 ms** per DOM change batch with a full-document XPath scan for `Loading...`. | Subtree-only text scanning (§7.2). |

### Session 3: five candidate rules compared (35 F2 marks)

| Rule | Ready when quiet for… | Missed loading (>700 ms before F2) | Avg responseMs |
|---|---|---|---|
| R1 | loader + API (200 ms) | 19 | 979 ms |
| R2 | + chunks (200 ms) | 18 | 1,047 ms |
| **R3** | **+ chunks (1000 ms)** ← **adopted** | 18 | 1,069 ms |
| R4 | R2 + no long tasks (300 ms) | 18 | 1,016 ms |
| R5 | R2 + no DOM changes (300 ms) | 17 | 1,129 ms |

| # | Finding | Impact on design |
|---|---|---|
| A11 | **F2 marks lag "data ready" by ~0.7 s on median, and 1.5–4 s on some pages**, with no measurable activity in between: perceiving, judging, pressing, and on image-heavy pages (Discover news) waiting for images. So the "missed" counts above mostly measure human latency, which is why the rules score similarly. | uivisor measures data ready, not looks ready (Non-goals, Q10). The rule choice rests on A12 and A13. |
| A12 | **R3 is the rule that gets first visits right.** IT Services, first visit: chunks done → loader appears **268 ms later** → loader gone 2,132 ms after the click. R3 reported **exactly 2,132 ms**; R2/R4 reported 915 ms (before the loader even appeared); R5 2,341 ms (correct plus ~200 ms of rendering). Long tasks (R4) added nothing. DOM-quiet (R5) slows every action and may never settle on animated pages (Discover has a carousel). | Adopt R3: `chunkQuietMs: 1000` (§7.1). Report `readyAt` = last activity end (§8.2). |
| A13 | **Page changes without new code also have a gap:** Home, click → **~520 ms** with no activity → API calls start. Every rule said 0 ms. | `appearWindowAfterNav: 1000` (§7.4). |
| A14 | **Slow APIs this session:** `ems-ms/cms/news/aggregated` and `cms/news/list` up to **~7.0 s**, `alert-banner` 5.9 s, `whats-on-today` 5.9 s, `fms-ms/code` 5.3 s, `rbs/rooms` avg 2.8 s. Discover's first visit took 7.3 s. | More SLA breaches for the app team. |

**Conclusion:** busy = loader indicator OR app API call (200 ms quiet) OR app JS chunk (1000 ms quiet), with a 1000 ms watch window after page changes and 300 ms otherwise. Response time = end of the last real activity. No further walk-through is needed.
