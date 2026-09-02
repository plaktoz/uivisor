# Pipeline State: feat-in-browser-overlay

**Task:** Injected in-browser script: `Shift+A` (assertion picker, 8 types), `Shift+W` (ms prompt → `wait`), `PrintScreen`/`Shift+S` (auto-named screenshot); communicates via `page.exposeFunction('__uivisorOverlay')`; minimal fixed HUD showing shortcut hints
**Epic:** epic-complete-recording-experience
**Started:** 2026-09-02
**Status:** pr_open

## Worktree
**Path:** .worktrees/feat-in-browser-overlay
**Branch:** feat-in-browser-overlay
**Created:** 2026-09-02
**Status:** active

---

## Gate 0: Execution Plan

**Classification:** Feature
**Complexity:** Large
**Execution sequence:** Standard (Gate 0 → Gate 1 → Architect → Tester Ensemble → Coder → Quality Gate → Release Documenter)

### Role activations and ETA

| Step | Role | Est. time |
|---|---|---|
| Gate 1 | Analyst | 8 min |
| Architect | Architect | 10 min |
| Tester Ensemble Ph1 | Generator A + B (parallel) + Consolidator + Arbiter | 9 min |
| Coder | Coder | 20 min |
| Quality Gate | Quality Gate | 4 min |
| Release Documenter | Release Documenter | 4 min |
| Deployer | Deployer | 3 min |

**Total estimate:** ~58–90 min
**Cost estimate:** ~$0.28–$0.55
**Cost cap:** $5.00

### Notes
- No Designer activation needed (no visual design system work; overlay UI is functional, not brand-differentiated)
- Coder must bundle `overlay.ts` as a pure browser script — no Node.js imports, no top-level `import` statements at runtime; confirm build tooling (esbuild/vite iife mode) is wired before coding begins

---

## Gate 1: Spec — in-browser-overlay

### Overview

`recorder-app/src/overlay.ts` is a self-contained browser script injected into the recording page by the recorder CLI via `page.addInitScript()`. It surfaces three keyboard shortcuts to the tester, renders a persistent HUD, and communicates back to Node.js via `window.__uivisorOverlay(commandObj)`, which is pre-registered by the CLI using `page.exposeFunction('__uivisorOverlay', handler)`.

The overlay must contain no Node.js module imports. All command shapes are defined inline.

### Acceptance Criteria

**AC1 — HUD element**
A `<div id="uivisor-hud">` is appended to `document.body` on script init. Its CSS position is `fixed`, anchored to the bottom-right corner. Its visible text surface includes all three shortcut labels:
```
Shift+A: assert  Shift+W: wait  Shift+S: screenshot
```

**AC2 — Shift+A opens assertion picker**
A `keydown` listener on `document` detects `event.key === 'A'` AND `event.shiftKey === true`. On match, a modal element is inserted into the DOM listing 8 assertion options.

**AC3 — assertVisible command emission**
Clicking the `assertVisible` option in the picker calls:
```js
window.__uivisorOverlay({ assertVisible: <selector> })
```
where `<selector>` is derived from the element under focus/cursor at emit time. The picker closes after emission.

**AC4 — assertText command emission**
Clicking the `assertText` option calls `window.prompt` once for the expected text string, then calls:
```js
window.__uivisorOverlay({ assertText: { element: <selector>, text: <promptResult> } })
```
If the prompt is cancelled (returns `null`), no command is emitted. The picker closes after emission (or stays open if cancelled — implementation decision documented in test T-28).

**AC5 — Shift+W wait command**
A `keydown` listener detects `event.key === 'W'` AND `event.shiftKey === true`. Calls `window.prompt` for a milliseconds value. On a non-null, non-empty numeric response, calls:
```js
window.__uivisorOverlay({ wait: <ms> })   // ms is a Number, not a string
```
If prompt returns `null` or an empty string, no command is emitted.

**AC6 — PrintScreen / Shift+S screenshot command**
A `keydown` listener detects either `event.key === 'PrintScreen'` OR (`event.key === 'S'` AND `event.shiftKey === true`). On match, calls:
```js
window.__uivisorOverlay({ screenshot: "screenshots/step-N.png" })
```
`N` starts at `1` and auto-increments using a module-level `let` counter. Both triggers share one counter. Counter is not reset between picker interactions.

**AC7 — Picker container testid**
The picker modal element (the container) carries `data-testid="uivisor-picker"`.

**AC8 — Option testids**
Each of the 8 picker options carries `data-testid="uivisor-option-<type>"`:
- `uivisor-option-assertVisible`
- `uivisor-option-assertText`
- `uivisor-option-assertValue`
- `uivisor-option-assertUrl`
- `uivisor-option-assertEnabled`
- `uivisor-option-assertDisabled`
- `uivisor-option-assertChecked`
- `uivisor-option-assertUnchecked`

**AC9 — Escape dismissal**
A `keydown` listener detects `event.key === 'Escape'` while the picker is open. On match, the picker element is **removed from the DOM** (not merely hidden). No command is emitted. If no picker is open, the Escape handler is a no-op.

**AC10 — Pure browser script**
`recorder-app/src/overlay.ts` contains no top-level `import` statements and no `require()` calls referencing Node.js built-ins or npm packages. All code is self-contained. The build output is an IIFE or equivalent that runs cleanly in a browser page context.

**AC11 — Guard on __uivisorOverlay**
Every call to `window.__uivisorOverlay` is wrapped with:
```js
if (typeof window.__uivisorOverlay === 'function') {
  window.__uivisorOverlay(command);
}
```
If the function is not defined (or is a non-function value), the script runs silently without throwing.

**AC12 — Unit tests**
Tests live at `recorder-app/src/overlay.test.ts`. Test framework: Vitest + jsdom. Keyboard events are dispatched via `new KeyboardEvent('keydown', { key: '...', shiftKey: true/false, bubbles: true })`. DOM mutations are verified via `document.querySelector`/`document.getElementById`. `window.__uivisorOverlay` is mocked via `vi.fn()`. `window.prompt` is mocked via `vi.fn()`.

### Assertion types reference

| Option | Requires prompt | Command shape |
|---|---|---|
| assertVisible | No (uses selector) | `{ assertVisible: selector }` |
| assertText | Yes (expected text) | `{ assertText: { element: selector, text: input } }` |
| assertValue | Yes (expected value) | `{ assertValue: { element: selector, value: input } }` |
| assertUrl | No (uses `window.location.href`) | `{ assertUrl: currentHref }` |
| assertEnabled | No (uses selector) | `{ assertEnabled: selector }` |
| assertDisabled | No (uses selector) | `{ assertDisabled: selector }` |
| assertChecked | No (uses selector) | `{ assertChecked: selector }` |
| assertUnchecked | No (uses selector) | `{ assertUnchecked: selector }` |

### Out of scope
- The recorder CLI's `page.exposeFunction` wiring (separate feature / already planned)
- YAML serialization of the received commands
- Visual polish beyond a functional HUD `<div>`

---

## Feature Task Breakdown

| # | Task | File(s) | Blocks | Notes |
|---|---|---|---|---|
| T1 | Scaffold `overlay.ts` entry point — module-level state (screenshot counter, pickerOpen flag), HUD injection on load | `recorder-app/src/overlay.ts` | T2, T3, T4 | Must not import Node modules; use an IIFE or export-free module that executes on load |
| T2 | Implement HUD element — create `<div id="uivisor-hud">`, set fixed position bottom-right, append text showing all 3 shortcuts | `recorder-app/src/overlay.ts` | — | Inline styles are fine; no external CSS dependency |
| T3 | Implement `keydown` listener for Shift+W — call `window.prompt`, parse as number, guard null/empty, call `window.__uivisorOverlay({ wait: ms })` | `recorder-app/src/overlay.ts` | — | Convert prompt result to `Number()` not `parseInt` to catch edge cases |
| T4 | Implement `keydown` listener for PrintScreen / Shift+S — increment counter, call `window.__uivisorOverlay({ screenshot: 'screenshots/step-N.png' })` | `recorder-app/src/overlay.ts` | — | Both triggers share one `let screenshotCounter = 0` |
| T5 | Implement `keydown` listener for Shift+A — create picker modal with `data-testid="uivisor-picker"`, render 8 option elements with correct data-testids | `recorder-app/src/overlay.ts` | T6 | Guard: if picker already open, do not insert a second one |
| T6 | Implement picker option click handlers for no-prompt types (assertVisible, assertUrl, assertEnabled, assertDisabled, assertChecked, assertUnchecked) — derive selector, call `__uivisorOverlay`, close picker | `recorder-app/src/overlay.ts` | — | assertUrl uses `window.location.href`; others derive from focused element |
| T7 | Implement picker option click handlers for prompt types (assertText, assertValue) — call `window.prompt`, guard null, call `__uivisorOverlay`, close picker | `recorder-app/src/overlay.ts` | T6 | Guard null prompt; picker closes on successful emit, stays open on cancel (to match T-28 spec-deciding behavior) |
| T8 | Implement Escape handler — remove picker from DOM if present, no-op if absent | `recorder-app/src/overlay.ts` | T5 | Remove via `element.remove()`, not `display:none` |
| T9 | Wire `__uivisorOverlay` guard on all emission sites | `recorder-app/src/overlay.ts` | T3, T4, T6, T7 | Single helper `function emit(cmd) { if (typeof window.__uivisorOverlay === 'function') window.__uivisorOverlay(cmd); }` |
| T10 | Write unit tests — HUD, shortcuts, picker lifecycle, all 8 assertion types, guard, counter | `recorder-app/src/overlay.test.ts` | T1–T9 | Vitest + jsdom; see `## Tests` section |
| T11 | Build config — confirm `overlay.ts` compiles to pure browser JS | `recorder-app/vite.config.ts` or `tsconfig.json` | T1 | If a separate build target is needed for IIFE output, add it; do not pollute the main app bundle |

---

## Tests — Generator A

### HUD Injection and Rendering

**T-A-01**
Name: HUD div is injected into the document body on script initialization
AC: AC1 | Priority: P0
Setup: Load the overlay script into a jsdom document with no prior DOM state.
Action: Script executes (simulate by calling the script's init entry point or loading the module).
Assert: `document.getElementById('uivisor-hud')` returns a non-null element.

**T-A-02**
Name: HUD element uses the exact id `uivisor-hud`
AC: AC1 | Priority: P0
Setup: Load the overlay script into a clean jsdom document.
Action: Script initializes.
Assert: The injected element has `id === 'uivisor-hud'`; no other element shares that id.

**T-A-03**
Name: HUD has CSS `position: fixed`
AC: AC1 | Priority: P1
Setup: Load the overlay script into a jsdom document.
Action: Script initializes.
Assert: `document.getElementById('uivisor-hud').style.position === 'fixed'`.

**T-A-04**
Name: HUD is anchored to the bottom-right corner
AC: AC1 | Priority: P1
Setup: Load the overlay script into a jsdom document.
Action: Script initializes.
Assert: HUD element's inline styles include a non-empty `bottom` value and non-empty `right` value; `top` and `left` are not the primary anchors.

**T-A-05 / T-A-06 / T-A-07**
Name: HUD text content includes Shift+A, Shift+W, and Shift+S shortcut descriptions
AC: AC1 | Priority: P1
Setup: Load the overlay script.
Action: Script initializes.
Assert: `document.getElementById('uivisor-hud').textContent` contains references to Shift+A, Shift+W, and Shift+S (or equivalent labels for all three).

**T-A-08**
Name: HUD is not duplicated on multiple script executions
AC: AC1 | Priority: P2
Setup: Load the overlay script and call its init path twice.
Action: Second initialization attempt.
Assert: `document.querySelectorAll('#uivisor-hud').length === 1`.

### Picker Modal Appearance

**T-A-09**
Name: Shift+A keydown opens the assertion picker modal
AC: AC2 | Priority: P0
Setup: Load the overlay script; ensure no picker is present in the DOM.
Action: Dispatch `new KeyboardEvent('keydown', { key: 'A', shiftKey: true, bubbles: true })` on `document`.
Assert: An element with `data-testid="uivisor-picker"` exists in the document after the event.

**T-A-10**
Name: Picker modal container carries `data-testid="uivisor-picker"`
AC: AC7 | Priority: P0
Setup: Load the overlay script.
Action: Dispatch Shift+A keydown.
Assert: `document.querySelector('[data-testid="uivisor-picker"]')` is non-null; value is exactly `"uivisor-picker"`.

**T-A-11**
Name: Picker modal lists exactly 8 options
AC: AC2 | Priority: P0
Setup: Load the overlay script.
Action: Dispatch Shift+A keydown.
Assert: `document.querySelectorAll('[data-testid^="uivisor-option-"]').length === 8`.

**T-A-12**
Name: Each picker option carries the correct `data-testid` format
AC: AC8 | Priority: P0
Setup: Load the overlay script; dispatch Shift+A keydown.
Action: Inspect all rendered option elements.
Assert: Every option element has `data-testid` matching `uivisor-option-<type>`; no duplicates.

**T-A-13 / T-A-14**
Name: `assertVisible` and `assertText` options have correct data-testids (example spot-checks)
AC: AC8 | Priority: P0
Setup: Load the overlay script; dispatch Shift+A keydown.
Assert: `document.querySelector('[data-testid="uivisor-option-assertVisible"]')` and `document.querySelector('[data-testid="uivisor-option-assertText"]')` both non-null.

**T-A-15**
Name: Picker does not appear without Shift modifier (plain A key)
AC: AC2 | Priority: P1
Setup: Load the overlay script.
Action: Dispatch `new KeyboardEvent('keydown', { key: 'A', shiftKey: false, bubbles: true })`.
Assert: `document.querySelector('[data-testid="uivisor-picker"]')` is null.

**T-A-16**
Name: Second Shift+A does not create a duplicate picker
AC: AC2, AC7 | Priority: P2
Setup: Load the overlay script; dispatch Shift+A once.
Action: Dispatch Shift+A a second time.
Assert: `document.querySelectorAll('[data-testid="uivisor-picker"]').length === 1`.

### assertVisible Command

**T-A-17**
Name: Selecting `assertVisible` calls `window.__uivisorOverlay` with `assertVisible` key
AC: AC3 | Priority: P0
Setup: Load script; mock `window.__uivisorOverlay = vi.fn()`; mock `window.prompt` to return `'#my-button'`; dispatch Shift+A.
Action: Click element with `data-testid="uivisor-option-assertVisible"`.
Assert: `window.__uivisorOverlay` called exactly once with an object containing `assertVisible: '#my-button'`.

**T-A-18**
Name: `assertVisible` passes the selector string as the value
AC: AC3 | Priority: P0
Setup: Mock prompt to return `'.hero-section'`; mock spy; open picker.
Action: Click `uivisor-option-assertVisible`.
Assert: Called with `{ assertVisible: '.hero-section' }`; no extra keys.

**T-A-19**
Name: Cancelling selector prompt for `assertVisible` (null) does not call `__uivisorOverlay`
AC: AC3, AC11 | Priority: P1
Setup: Mock prompt to return `null`; open picker.
Action: Click `uivisor-option-assertVisible`.
Assert: `window.__uivisorOverlay` not called.

**T-A-20**
Name: Selecting `assertVisible` closes the picker modal after emission
AC: AC3 | Priority: P1
Setup: Mock prompt to return `'#el'`; open picker; click assertVisible.
Assert: `document.querySelector('[data-testid="uivisor-picker"]')` is null after click.

### assertText Command

**T-A-21**
Name: Selecting `assertText` calls `window.prompt` for expected text
AC: AC4 | Priority: P0
Setup: Mock prompt sequence: `'#heading'` then `'Hello World'`; mock spy; open picker.
Action: Click `uivisor-option-assertText`.
Assert: `window.prompt` called; spy called with `{ assertText: { element: '#heading', text: 'Hello World' } }`.

**T-A-22**
Name: Cancelling assertText prompt does not call `__uivisorOverlay`
AC: AC4, AC11 | Priority: P0
Setup: Mock prompt to return `null`; open picker.
Action: Click `uivisor-option-assertText`.
Assert: Spy not called.

### Wait Command

**T-A-26**
Name: Shift+W dispatches a prompt asking for milliseconds
AC: AC5 | Priority: P0
Setup: Load script; mock `window.prompt = vi.fn(() => '2000')`; mock spy.
Action: Dispatch `new KeyboardEvent('keydown', { key: 'W', shiftKey: true, bubbles: true })`.
Assert: `window.prompt` called exactly once.

**T-A-27**
Name: Shift+W calls `__uivisorOverlay` with `{ wait: ms }` as a number
AC: AC5 | Priority: P0
Setup: Mock prompt to return `'1500'`; mock spy.
Action: Dispatch Shift+W keydown.
Assert: Spy called with `{ wait: 1500 }` (numeric, not string).

**T-A-28**
Name: Cancelling wait prompt does not call `__uivisorOverlay`
AC: AC5, AC11 | Priority: P1
Setup: Mock prompt to return `null`; mock spy.
Action: Dispatch Shift+W keydown.
Assert: Spy not called.

**T-A-29**
Name: Plain W key does not trigger the wait prompt
AC: AC5 | Priority: P1
Setup: Mock prompt and spy.
Action: Dispatch `new KeyboardEvent('keydown', { key: 'W', shiftKey: false, bubbles: true })`.
Assert: Prompt not called; spy not called.

### Screenshot Command

**T-A-30**
Name: Shift+S calls `__uivisorOverlay` with a screenshot path
AC: AC6 | Priority: P0
Setup: Load script; mock spy.
Action: Dispatch `new KeyboardEvent('keydown', { key: 'S', shiftKey: true, bubbles: true })`.
Assert: Spy called once with `{ screenshot: /^screenshots\/step-\d+\.png$/ }`.

**T-A-31**
Name: PrintScreen key calls `__uivisorOverlay` with a screenshot path
AC: AC6 | Priority: P0
Setup: Mock spy.
Action: Dispatch `new KeyboardEvent('keydown', { key: 'PrintScreen', bubbles: true })`.
Assert: Spy called once with `{ screenshot: /^screenshots\/step-\d+\.png$/ }`.

**T-A-32**
Name: First screenshot produces `screenshots/step-1.png`
AC: AC6 | Priority: P0
Setup: Load script fresh (reset module state); mock spy.
Action: Dispatch Shift+S once.
Assert: Spy called with `{ screenshot: 'screenshots/step-1.png' }`.

**T-A-33**
Name: Screenshot counter increments with each invocation
AC: AC6 | Priority: P0
Setup: Mock spy; fresh script load.
Action: Dispatch Shift+S three times in sequence.
Assert: Three calls carry `step-1.png`, `step-2.png`, `step-3.png`.

**T-A-34**
Name: PrintScreen and Shift+S share the same counter
AC: AC6 | Priority: P1
Setup: Mock spy; fresh script load.
Action: Shift+S (step-1), PrintScreen (step-2), Shift+S (step-3).
Assert: Three calls carry `step-1.png`, `step-2.png`, `step-3.png`.

### Escape / Dismissal

**T-A-36**
Name: Pressing Escape while picker is open removes it from the DOM
AC: AC9 | Priority: P0
Setup: Load script; dispatch Shift+A to open picker; verify picker present.
Action: Dispatch `new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })`.
Assert: `document.querySelector('[data-testid="uivisor-picker"]')` is null.

**T-A-37**
Name: Pressing Escape does not call `__uivisorOverlay`
AC: AC9 | Priority: P0
Setup: Mock spy; open picker via Shift+A.
Action: Dispatch Escape keydown.
Assert: Spy never called.

**T-A-38**
Name: Pressing Escape when no picker is open does not throw
AC: AC9 | Priority: P1
Setup: Load script; do not open picker.
Action: Dispatch Escape keydown.
Assert: No exception; picker null in DOM.

**T-A-39**
Name: Picker re-opens after Escape dismissal
AC: AC9 | Priority: P2
Setup: Open picker; dismiss with Escape.
Action: Dispatch Shift+A again.
Assert: Picker reappears with `data-testid="uivisor-picker"` and 8 options.

### Guard Clause

**T-A-40**
Name: Commands not emitted when `__uivisorOverlay` is undefined
AC: AC11 | Priority: P0
Setup: Ensure `window.__uivisorOverlay` is `undefined`; open picker.
Action: Click `uivisor-option-assertVisible`; test screenshot and wait triggers similarly.
Assert: No `TypeError` thrown.

**T-A-41**
Name: Commands not emitted when `__uivisorOverlay` is a non-function value
AC: AC11 | Priority: P1
Setup: Set `window.__uivisorOverlay = 42`; open picker.
Action: Click `uivisor-option-assertVisible`.
Assert: No error thrown; the `typeof` guard prevents the call.

**T-A-42**
Name: Commands emitted normally when `__uivisorOverlay` is a proper function
AC: AC11 | Priority: P0
Setup: Set `window.__uivisorOverlay = vi.fn()`; open picker; mock prompt to return `'#btn'`.
Action: Click `uivisor-option-assertVisible`.
Assert: Spy called exactly once with the expected argument shape.

### No Node.js Imports

**T-A-43**
Name: The overlay source file contains no Node.js module imports
AC: AC10 | Priority: P0
Setup: Read source text of `recorder-app/src/overlay.ts` as a string.
Action: Scan for `require(`, `import ... from 'fs'`, `import ... from 'path'`, `import ... from 'node:'`, `@uivisor/core`.
Assert: Zero matches found.

**T-A-44**
Name: The overlay file uses no ES module `import` statements from external packages
AC: AC10 | Priority: P0
Setup: Read source text of `recorder-app/src/overlay.ts`.
Action: Scan for top-level `import` declarations.
Assert: No `import` statements present.

---

## Tests — Generator B

### HUD

**T-B-01**
Name: HUD injection is idempotent — second script run does not create a duplicate element
AC: AC1 | Priority: P0
Setup: Run init script. Run it a second time (simulate addInitScript firing twice).
Action: `document.querySelectorAll('#uivisor-hud')`.
Assertion: Length is exactly 1.

**T-B-02**
Name: HUD element has exactly the id "uivisor-hud" (no prefix/suffix)
AC: AC1 | Priority: P0
Setup: Run init script.
Action: `document.getElementById('uivisor-hud')`.
Assertion: Non-null; id attribute equals `"uivisor-hud"` verbatim.

**T-B-03**
Name: HUD is positioned fixed at bottom-right
AC: AC1 | Priority: P1
Setup: Run init script.
Action: Read style of `#uivisor-hud`.
Assertion: `position === "fixed"`, `bottom` and `right` are non-empty.

**T-B-04**
Name: HUD text surface includes all three keyboard shortcut labels
AC: AC1 | Priority: P1
Setup: Run init script.
Action: Read `textContent` of `#uivisor-hud`.
Assertion: Contains references to all three shortcuts (Shift+A, Shift+W, Shift+S or equivalent).

### Modal State Machine

**T-B-05**
Name: Shift+A when picker already open does not nest a second picker
AC: AC2, AC7 | Priority: P0
Setup: Run init script. Fire Shift+A. Confirm picker exists.
Action: Fire Shift+A again without dismissing.
Assertion: `document.querySelectorAll('[data-testid="uivisor-picker"]').length === 1`.

**T-B-06**
Name: Escape removes picker from DOM, not merely hides it
AC: AC9 | Priority: P0
Setup: Run init script. Fire Shift+A. Confirm picker present.
Action: Fire Escape keydown.
Assertion: `document.querySelector('[data-testid="uivisor-picker"]')` returns null; not `display:none`.

**T-B-07**
Name: Picker re-opens cleanly after Escape dismissal
AC: AC2, AC9 | Priority: P0
Setup: Run init script. Fire Shift+A. Fire Escape.
Action: Fire Shift+A again.
Assertion: Picker non-null and contains all 8 options.

**T-B-08**
Name: Picker closes and is removed after a successful option selection (no-prompt type)
AC: AC2 | Priority: P1
Setup: Run init script; define `window.__uivisorOverlay` as a no-op. Fire Shift+A.
Action: Click assertEnabled option element.
Assertion: `document.querySelector('[data-testid="uivisor-picker"]')` is null after click.

**T-B-09**
Name: Escape keydown when picker NOT open produces no error and does not affect HUD
AC: AC9 | Priority: P1
Setup: Run init script. Do NOT open picker.
Action: Fire Escape keydown.
Assertion: No exception thrown; HUD still present; no phantom elements.

**T-B-10**
Name: All 8 options present with their exact data-testid attributes
AC: AC8 | Priority: P0
Setup: Run init script. Fire Shift+A.
Action: Query for each of the 8 expected `data-testid` values.
Assertion: All 8 selectors return non-null elements.

### Guard Exhaustion

**T-B-11**
Name: No error when `__uivisorOverlay` is completely absent from window
AC: AC11 | Priority: P0
Setup: Run init script. Ensure `window.__uivisorOverlay` is not set.
Action: Fire PrintScreen keydown.
Assertion: No exception thrown. Call completes silently.

**T-B-12**
Name: No error when `__uivisorOverlay` is explicitly set to null
AC: AC11 | Priority: P0
Setup: Run init script. Set `window.__uivisorOverlay = null`.
Action: Fire PrintScreen keydown.
Assertion: No exception thrown.

**T-B-13**
Name: No error when `__uivisorOverlay` is set to a plain object
AC: AC11 | Priority: P0
Setup: Run init script. Set `window.__uivisorOverlay = { emit: () => {} }`.
Action: Fire PrintScreen keydown.
Assertion: No exception thrown.

**T-B-14**
Name: No error when `__uivisorOverlay` is a number
AC: AC11 | Priority: P1
Setup: Run init script. Set `window.__uivisorOverlay = 42`.
Action: Fire PrintScreen keydown.
Assertion: No exception thrown.

**T-B-15**
Name: When `__uivisorOverlay` IS a function, it is called
AC: AC11 | Priority: P0
Setup: Run init script. Set `window.__uivisorOverlay` as a vitest spy.
Action: Fire PrintScreen keydown.
Assertion: Spy called exactly once.

**T-B-16**
Name: Late binding works — `__uivisorOverlay` defined after init is still called
AC: AC11 | Priority: P1
Setup: Run init script WITHOUT defining `__uivisorOverlay`. Then define it as a spy AFTER script load.
Action: Fire PrintScreen keydown.
Assertion: Spy called once (guard evaluated per-event, not captured at init).

### Counter Semantics

**T-B-17**
Name: Screenshot counter starts at 1 on first PrintScreen
AC: AC6 | Priority: P0
Setup: Run init script. Define `__uivisorOverlay` as spy.
Action: Fire one PrintScreen keydown.
Assertion: Spy called with `{ screenshot: 'screenshots/step-1.png' }`.

**T-B-18**
Name: Screenshot counter increments with each PrintScreen
AC: AC6 | Priority: P0
Setup: Run init script. Define spy.
Action: Fire PrintScreen three times.
Assertion: Calls show counter values 1, 2, 3 in order.

**T-B-19**
Name: Shift+S and PrintScreen share the same counter
AC: AC6 | Priority: P0
Setup: Run init script. Define spy.
Action: Fire PrintScreen (→1), then Shift+S (→2).
Assertion: Second call has counter value 2, not 1.

**T-B-20**
Name: Counter does not reset when picker is opened and closed between screenshots
AC: AC6 | Priority: P1
Setup: Define spy. Fire PrintScreen (→1). Fire Shift+A then Escape.
Action: Fire PrintScreen again.
Assertion: Second screenshot call has counter 2.

### Wait Edge Cases

**T-B-21**
Name: Shift+W prompt cancel — nothing emitted
AC: AC5 | Priority: P0
Setup: Define spy. Mock `window.prompt` to return null.
Action: Fire Shift+W keydown.
Assertion: Spy NOT called.

**T-B-22**
Name: Shift+W with empty string from prompt — nothing emitted
AC: AC5 | Priority: P1
Setup: Define spy. Mock `window.prompt` to return `""`.
Action: Fire Shift+W keydown.
Assertion: Spy NOT called.

**T-B-23**
Name: Shift+W with non-numeric input — graceful handling
AC: AC5 | Priority: P1
Setup: Define spy. Mock `window.prompt` to return `"abc"`.
Action: Fire Shift+W keydown.
Assertion: No exception thrown. Spy not called (guard NaN), or if called, value is NaN-safe.

**T-B-24**
Name: Shift+W with valid numeric string emits wait command
AC: AC5 | Priority: P0
Setup: Define spy. Mock `window.prompt` to return `"500"`.
Action: Fire Shift+W keydown.
Assertion: Spy called once with `{ wait: 500 }`.

### All 8 Assertion Types

**T-B-26**
Name: assertVisible — no prompt, emits `{ assertVisible: <selector> }`
AC: AC2, AC8 | Priority: P0
Setup: Define spy. Set `document.activeElement` to a button. Fire Shift+A.
Action: Click `uivisor-option-assertVisible`.
Assertion: Spy called with `{ assertVisible: <some selector string> }`. `window.prompt` NOT called.

**T-B-27**
Name: assertText — prompt shown, emits `{ assertText: { element, text } }`
AC: AC2, AC8 | Priority: P0
Setup: Define spy. Mock `window.prompt` to return `"Hello World"`. Fire Shift+A.
Action: Click `uivisor-option-assertText`.
Assertion: `window.prompt` called; spy called with `{ assertText: { element: <selector>, text: "Hello World" } }`.

**T-B-28**
Name: assertText — prompt cancelled, nothing emitted
AC: AC2 | Priority: P0
Setup: Define spy. Mock `window.prompt` to return null. Fire Shift+A.
Action: Click `uivisor-option-assertText`.
Assertion: Spy NOT called.

**T-B-29**
Name: assertValue — prompt shown, emits `{ assertValue: { element, value } }`
AC: AC2, AC8 | Priority: P0
Setup: Define spy. Mock `window.prompt` to return `"john@example.com"`. Fire Shift+A.
Action: Click `uivisor-option-assertValue`.
Assertion: Spy called with `{ assertValue: { element: <selector>, value: "john@example.com" } }`.

**T-B-30**
Name: assertValue — prompt cancelled, nothing emitted
AC: AC2 | Priority: P0
Setup: Define spy. Mock `window.prompt` to return null. Fire Shift+A.
Action: Click `uivisor-option-assertValue`.
Assertion: Spy NOT called.

**T-B-31**
Name: assertUrl — no prompt, emits `{ assertUrl: window.location.href }`
AC: AC2, AC8 | Priority: P0
Setup: Define spy. Set jsdom URL to `"https://example.com/login"`. Fire Shift+A.
Action: Click `uivisor-option-assertUrl`.
Assertion: `window.prompt` NOT called. Spy called with `{ assertUrl: "https://example.com/login" }`.

**T-B-32**
Name: assertEnabled — no prompt, emits `{ assertEnabled: <selector> }`
AC: AC2, AC8 | Priority: P0
Setup: Define spy. Set `document.activeElement`. Fire Shift+A.
Action: Click `uivisor-option-assertEnabled`.
Assertion: Spy called with `{ assertEnabled: <selector> }`. No prompt.

**T-B-33**
Name: assertDisabled — no prompt, emits `{ assertDisabled: <selector> }`
AC: AC2, AC8 | Priority: P0
Setup: Same setup as T-B-32.
Action: Click `uivisor-option-assertDisabled`.
Assertion: Spy called with `{ assertDisabled: <selector> }`.

**T-B-34**
Name: assertChecked — no prompt, emits `{ assertChecked: <selector> }`
AC: AC2, AC8 | Priority: P0
Setup: Same setup.
Action: Click `uivisor-option-assertChecked`.
Assertion: Spy called with `{ assertChecked: <selector> }`.

**T-B-35**
Name: assertUnchecked — no prompt, emits `{ assertUnchecked: <selector> }`
AC: AC2, AC8 | Priority: P0
Setup: Same setup.
Action: Click `uivisor-option-assertUnchecked`.
Assertion: Spy called with `{ assertUnchecked: <selector> }`.

### Edge Cases

**T-B-38**
Name: Shift+A in an INPUT element — spec-deciding test
AC: AC2 | Priority: P1
Setup: Run init script. Create an `<input>` in jsdom. Focus the input.
Action: Fire Shift+A with target = the input element.
Assertion: Determines whether picker opens or is suppressed. No exception either way. Implementation must document this decision.

**T-B-42**
Name: Stale picker option element click after Escape does not call spy
AC: AC9 | Priority: P1
Setup: Define spy. Fire Shift+A. Capture reference to assertVisible option. Fire Escape.
Action: Click the stale element reference.
Assertion: Spy NOT called (element removed from DOM).

**T-B-44**
Name: assertText prompt cancel — picker state defined
AC: AC9 | Priority: P1
Setup: Define spy. Mock prompt to return null. Fire Shift+A.
Action: Click `uivisor-option-assertText` (prompt cancelled).
Assertion: Picker state after cancel is consistent (either removed or still open for retry — spec-deciding). No exception.

**T-B-45**
Name: `__uivisorOverlay` is called with a plain serializable object
AC: AC11 | Priority: P2
Setup: Capture argument passed to spy.
Action: Fire PrintScreen.
Assertion: `typeof argument === "object"` and `Object.getPrototypeOf(argument) === Object.prototype`.

---

## Tests

> Arbiter decision log:
> - Merged T-A-01/T-A-02/T-B-01/T-B-02 → single HUD injection suite (tests 1–4)
> - T-A-05/A-06/A-07 collapsed into one test covering all 3 shortcuts (test 4)
> - T-A-08/T-B-01 (idempotency) → test 5 — promoted to P0 because addInitScript can fire on every navigation
> - T-B-06 (Escape removes, not hides) promoted over T-A-36 (more precise assertion)
> - Added T-B-31 (assertUrl uses window.location.href) — not covered in A except implicitly
> - T-B-38 (Shift+A in INPUT) kept as P1 spec-deciding test — does not block Coder but must run and document outcome
> - T-B-44 (cancel leaves picker state) kept as P1 spec-deciding test
> - T-A-43/T-A-44 (no Node imports) kept as static analysis tests in their own describe block
> - Removed T-A-45 (multi-shortcut integration) — covered by individual tests; integration value low
> - Counter tests T-A-32/T-B-17 merged; T-A-33/T-B-18 merged; T-A-34/T-B-19 merged
> - Final count: **28 tests**

```
recorder-app/src/overlay.test.ts
```

### Describe: HUD

| # | Test name | AC | Priority |
|---|---|---|---|
| 1 | injects `<div id="uivisor-hud">` on init | AC1 | P0 |
| 2 | HUD position is `fixed`, bottom/right anchored | AC1 | P1 |
| 3 | HUD text contains all three shortcut labels | AC1 | P1 |
| 4 | HUD injection is idempotent (second init leaves exactly one HUD) | AC1 | P0 |

### Describe: Shift+A — Picker modal

| # | Test name | AC | Priority |
|---|---|---|---|
| 5 | Shift+A opens picker with `data-testid="uivisor-picker"` | AC2, AC7 | P0 |
| 6 | Picker lists all 8 options with correct `data-testid="uivisor-option-*"` attributes | AC2, AC8 | P0 |
| 7 | Plain A (no Shift) does not open picker | AC2 | P1 |
| 8 | Second Shift+A while picker is open does not create a duplicate picker | AC2, AC7 | P0 |
| 9 | Escape removes picker from DOM (not merely hides it) | AC9 | P0 |
| 10 | Escape when picker is not open is a no-op, no error, HUD intact | AC9 | P1 |
| 11 | Picker re-opens cleanly after Escape dismissal | AC2, AC9 | P0 |
| 12 | Escape does not call `window.__uivisorOverlay` | AC9 | P0 |

### Describe: Picker — assertion type commands

| # | Test name | AC | Priority |
|---|---|---|---|
| 13 | `assertVisible` — emits `{ assertVisible: selector }`, no prompt, picker closes | AC3, AC8 | P0 |
| 14 | `assertText` — prompts for text, emits `{ assertText: { element, text } }`, picker closes | AC4, AC8 | P0 |
| 15 | `assertText` — prompt cancel → no emission | AC4, AC11 | P0 |
| 16 | `assertValue` — prompts for value, emits `{ assertValue: { element, value } }` | AC8 | P0 |
| 17 | `assertValue` — prompt cancel → no emission | AC11 | P0 |
| 18 | `assertUrl` — no prompt, emits `{ assertUrl: window.location.href }` | AC8 | P0 |
| 19 | `assertEnabled` — no prompt, emits `{ assertEnabled: selector }` | AC8 | P0 |
| 20 | `assertDisabled` — no prompt, emits `{ assertDisabled: selector }` | AC8 | P0 |
| 21 | `assertChecked` — no prompt, emits `{ assertChecked: selector }` | AC8 | P0 |
| 22 | `assertUnchecked` — no prompt, emits `{ assertUnchecked: selector }` | AC8 | P0 |

### Describe: Shift+W — wait command

| # | Test name | AC | Priority |
|---|---|---|---|
| 23 | Shift+W prompts, emits `{ wait: ms }` as Number | AC5 | P0 |
| 24 | Shift+W — prompt cancel → no emission | AC5, AC11 | P0 |
| 25 | Shift+W — empty string prompt → no emission | AC5 | P1 |

### Describe: PrintScreen / Shift+S — screenshot command

| # | Test name | AC | Priority |
|---|---|---|---|
| 26 | First screenshot emits `{ screenshot: "screenshots/step-1.png" }` (counter starts at 1) | AC6 | P0 |
| 27 | Counter increments across calls; Shift+S and PrintScreen share one counter | AC6 | P0 |

### Describe: __uivisorOverlay guard (AC11)

| # | Test name | AC | Priority |
|---|---|---|---|
| 28 | Does not throw when `__uivisorOverlay` is undefined, null, or a non-function; does call when it is a function; late-binding works | AC11 | P0 |

### Describe: Pure browser script (AC10) — static analysis

> These run outside jsdom as Node.js file-read checks.

| # | Test name | AC | Priority |
|---|---|---|---|
| — | `overlay.ts` contains no `import` from Node.js modules or `@uivisor/core` | AC10 | P0 |
| — | `overlay.ts` contains no `require()` calls | AC10 | P0 |

> Note: the two static analysis checks are included as tests within the test file using `fs.readFileSync` in the test setup; they count toward AC10 coverage but are not numbered in the 28-test suite since they are assertion-only reads with no DOM setup. If the team wants them as numbered tests, the final count becomes **30**.

### Arbiter notes on spec-deciding tests
- **Test 12 (Escape + no emission)**: Arbiter confirms this is distinct from test 9 (DOM removal). Both must pass.
- **T-B-38 (Shift+A in INPUT)**: Included in the test file as a `todo` / labeled "spec-deciding" — the Coder documents the implementation decision in a comment.
- **T-B-44 (prompt cancel + picker state)**: Included; if prompt is cancelled, the current spec (AC4) is silent on picker state. The Coder chooses one behavior and the test documents it.
- **Test 28 (guard)**: Written as a single parametrized test covering undefined, null, non-function, function, and late-binding cases for economy.

---

## Code Artifacts

| File | Description |
|---|---|
| `recorder-app/package.json` | Package config for `@uivisor/recorder`; devDeps: vitest 3, jsdom 25, typescript 5, @types/node 22 |
| `recorder-app/tsconfig.json` | Target ES2022, module ESNext, bundler resolution, lib DOM+ES2022, strict |
| `recorder-app/vitest.config.ts` | Vitest config with jsdom environment |
| `recorder-app/src/overlay.ts` | Pure browser script: HUD injection, Shift+A picker (8 types), Shift+W wait, PrintScreen/Shift+S screenshot, Escape dismiss, emit() guard |
| `recorder-app/src/overlay.test.ts` | 31 passing tests + 1 todo (T-B-38 spec-deciding) |

### Implementation decisions
- **Selector heuristic**: `getSelector()` returns `[data-testid="<value>"]` if `document.activeElement` has a `data-testid` attribute; otherwise `''`. Full selector heuristics deferred to F6.
- **assertText/assertValue cancel (T-B-44)**: Picker stays open on prompt cancel to allow retry. Picker closes on successful emit.
- **Shift+A in INPUT (T-B-38)**: No suppression; overlay opens picker regardless of focused element type. Documented as `it.todo` with decision note.
- **root `package.json`**: Added `"recorder-app"` to the `workspaces` array.

---

## Test Results

```
 RUN  v3.2.7 recorder-app/

 ✓ src/overlay.test.ts (32 tests | 1 skipped) 42ms

 Test Files  1 passed (1)
      Tests  31 passed | 1 todo (32)
   Duration  606ms
```

`tsc --noEmit` — 0 errors.

---

## Quality Gate

**Verdict: PASS**
- Tests: 31/31 pass
- TypeScript: tsc --noEmit exits 0
- All 12 ACs satisfied

---

## PR

https://github.com/plaktoz/uivisor/pull/23
