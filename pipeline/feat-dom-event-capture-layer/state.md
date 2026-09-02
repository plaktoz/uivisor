# Pipeline State: feat-dom-event-capture-layer

**Task:** Script injected via `page.addInitScript` + `page.exposeFunction`; capture `click`, `input`/`change`, `keydown`, `select`, navigation; translate to matching `Command` types; use selector heuristics per element; emit via caller-supplied callback; unit tests for event→command translation
**Epic:** epic-complete-recording-experience
**Started:** 2026-09-02
**Status:** pr_open
**PR:** https://github.com/plaktoz/uivisor/pull/24

**Worktree:** `.worktrees/feat-dom-event-capture-layer` on branch `feat-dom-event-capture-layer`
**Worktree Status:** active

---

## Gate 0: Execution Plan

**Classification:** Feature
**Complexity:** Large

**Standard execution sequence:**
1. Gate 0 — Execution Plan *(this document)*
2. Gate 1 — Analyst writes spec + ACs
3. Architect — Task breakdown (T1–Tn)
4. Tester Ensemble Phase 1 — Gen A + Gen B + Consolidator + Arbiter → test plan
5. Coder — implement to make tests pass *(not yet activated)*
6. Tester Phase 2 — quality gate, `tsc --noEmit` check
7. Code Review → PR → merge

**ETA estimate:** 58–90 min
**Cost estimate:** $0.28–$0.55 USD

---

## Gate 1: Spec — dom-event-capture-layer

### Summary

Export `CAPTURE_SCRIPT: string` from `packages/core/src/captureScript.ts`. This is a browser-compatible IIFE string that, when injected via `page.addInitScript(CAPTURE_SCRIPT)` and paired with `page.exposeFunction('__uivisorCapture', handler)`, listens for DOM events and emits typed `Command` objects back to Node.js via `window.__uivisorCapture(cmd)`.

The `resolveSelector` logic from `selectorHeuristics.ts` is inlined inside the IIFE as plain JS (no TypeScript annotations, no imports). No `import` or `require` appears anywhere in the script string itself.

### Acceptance Criteria

**AC1 — Export and re-export**
`CAPTURE_SCRIPT: string` is the named export of `packages/core/src/captureScript.ts`. It is also re-exported from `packages/core/src/index.ts`.

**AC2 — Click → tapOn**
A `click` event on any DOM element causes the script to emit:
```
{ type: 'tapOn', selector: resolveSelector(el) }
```
where `el` is `event.target`. `resolveSelector` follows the priority chain: `data-testid` → visible text (≤60 chars) → role+name → label → placeholder → css fallback.

**AC3 — HUD click suppressed**
A `click` whose target is an element with `id="uivisor-hud"` or whose target is a descendant of such an element does NOT invoke `window.__uivisorCapture`. Guard: `el.id === 'uivisor-hud' || el.closest('#uivisor-hud')`.

**AC4 — Text input → inputTextTargeted (debounced)**
An `input` event on an `<input>` (non-checkbox) or `<textarea>` element triggers debounce logic:
```
{ type: 'inputTextTargeted', element: resolveSelector(el), text: el.value }
```
The command is emitted on the element's `blur` event OR 500 ms after the last `input` event, whichever comes first. Multiple `input` events before the emit produce exactly one command carrying the final `el.value`. *(Note: field name is `element` per `types.ts` line 14.)*

**AC5 — Select → selectOption**
A `change` event on a `<select>` element emits:
```
{ type: 'selectOption', selector: resolveSelector(el), value: el.value }
```
*(Field names are `selector` and `value` per `types.ts` line 29 — not `element`/`option`.)*

**AC6 — Checkbox → check / uncheck**
A `change` event on `<input type="checkbox">` emits:
```
{ type: 'check',   selector: resolveSelector(el) }   // when el.checked === true
{ type: 'uncheck', selector: resolveSelector(el) }   // when el.checked === false
```
*(Field name is `selector` per `types.ts` lines 30–31.)*

**AC7 — Navigation → goto**
Both `popstate` and `hashchange` events on `window` cause the script to emit:
```
{ type: 'goto', url: window.location.href }
```

**AC8 — Special keydown → pressKey**
A `keydown` event whose `event.key` is one of `Enter`, `Tab`, `Escape` emits:
```
{ type: 'pressKey', key: event.key }
```
Any other key does NOT emit a command.

**AC9 — __uivisorCapture guard**
Every emit call is guarded:
```javascript
if (typeof window.__uivisorCapture === 'function') {
  window.__uivisorCapture(cmd);
}
```
If `window.__uivisorCapture` is undefined or not a function, the script skips emission silently with no thrown error.

**AC10 — No runtime imports**
The string value of `CAPTURE_SCRIPT` contains no `import ` statement and no `require(` call. The `resolveSelector` logic is inlined verbatim as plain JS with all TypeScript type annotations stripped.

**AC11 — Test toolchain**
Unit tests live in `packages/core/src/captureScript.test.ts`, use Vitest + jsdom. `window.__uivisorCapture` is mocked via `vi.fn()`. The script is injected once via `(new Function(CAPTURE_SCRIPT))()` in `beforeAll`. Events are dispatched via standard DOM APIs (`el.click()`, `el.dispatchEvent(...)`).

**AC12 — TypeScript clean**
`npx tsc --noEmit` executed from `packages/core/` exits 0 with `captureScript.ts` present.

---

## Feature Task Breakdown

| ID | Task | File | Depends on |
|----|------|------|-----------|
| T1 | Write `captureScript.ts` — `CAPTURE_SCRIPT` IIFE string with inlined `resolveSelector`, all event listeners, debounce via `WeakMap<Element, number>`, HUD guard, `__uivisorCapture` guard | `packages/core/src/captureScript.ts` | — |
| T2 | Re-export `CAPTURE_SCRIPT` from `index.ts` | `packages/core/src/index.ts` | T1 |
| T3 | Write `captureScript.test.ts` — 22 test cases covering all ACs (write first; tests are red until T1 done) | `packages/core/src/captureScript.test.ts` | — |

**TDD order:** T3 (red) → T1 (green) → T2 (verify CS-03 passes)

### T1 implementation notes

- `CAPTURE_SCRIPT` is a TypeScript `const` string literal whose value is a browser IIFE
- Inline the body of `resolveSelector` from `selectorHeuristics.ts` — strip the `import type` line and all `: Type` annotations; keep logic identical
- Use `document.addEventListener('click', handler, true)` (capture phase) so clicks on shadow-DOM content still bubble to document
- Debounce: `const pending = new WeakMap()` inside the IIFE; on `input`: `clearTimeout(pending.get(el)); pending.set(el, setTimeout(() => { emit(); pending.delete(el); }, 500))`; on `blur`: `clearTimeout(pending.get(el)); pending.delete(el); emit()`
- HUD guard in click handler: `const el = e.target; if (!el || el.id === 'uivisor-hud' || el.closest?.('#uivisor-hud')) return;`
- Distinguish `select` / `checkbox` inside the `change` handler: `if (el.tagName === 'SELECT') { ... } else if (el.type === 'checkbox') { ... } else { /* input/textarea input handled via 'input' event */ }`
- Every emit: `if (typeof window.__uivisorCapture === 'function') window.__uivisorCapture(cmd);`

---

## Tests — Generator A

*(Raw output — tester_generator_a / claude-haiku)*

**Test file:** `packages/core/src/captureScript.test.ts`
**Runner:** `npx vitest run` from `packages/core/`
**Injection:** `(new Function(CAPTURE_SCRIPT))()` in `beforeAll`; `vi.fn()` mock cleared in `beforeEach`

| ID | Description | AC | Setup | Action | Assert |
|----|------------|-----|-------|--------|--------|
| GA-01 | `CAPTURE_SCRIPT` is a non-empty string | AC1 | import | `typeof CAPTURE_SCRIPT` | `=== 'string'` and `length > 0` |
| GA-02 | Click on button with text emits `tapOn` with text selector | AC2 | append `<button>Submit</button>` | `btn.click()` | `{ type: 'tapOn', selector: { text: 'Submit' } }` |
| GA-03 | Click on button with `data-testid` emits `tapOn` with testId selector | AC2 | append `<button data-testid="btn">` | `btn.click()` | `{ type: 'tapOn', selector: { testId: 'btn' } }` |
| GA-04 | Click on `#uivisor-hud` does NOT emit | AC3 | append `<div id="uivisor-hud">` | `hud.click()` | `capture` not called |
| GA-05 | Input + blur emits `inputTextTargeted` once | AC4 | append `<input data-testid="f">` | set value, dispatch `input`, dispatch `blur` | `{ type: 'inputTextTargeted', element: { testId: 'f' }, text: '...' }`; called once |
| GA-06 | Select change emits `selectOption` | AC5 | `<select data-testid="s">` + option | set value, dispatch `change` | `{ type: 'selectOption', selector: { testId: 's' }, value: 'US' }` |
| GA-07 | Checking checkbox emits `check` | AC6 | `<input type="checkbox" data-testid="cb">` | `el.checked = true`; dispatch `change` | `{ type: 'check', selector: { testId: 'cb' } }` |
| GA-08 | Unchecking checkbox emits `uncheck` | AC6 | same, start checked | `el.checked = false`; dispatch `change` | `{ type: 'uncheck', selector: { testId: 'cb' } }` |
| GA-09 | `popstate` emits `goto` | AC7 | — | `window.dispatchEvent(new PopStateEvent('popstate'))` | `{ type: 'goto', url: window.location.href }` |
| GA-10 | `hashchange` emits `goto` | AC7 | — | `window.dispatchEvent(new HashChangeEvent('hashchange'))` | `{ type: 'goto', url: window.location.href }` |
| GA-11 | Enter keydown emits `pressKey` | AC8 | — | dispatch `keydown` `key: 'Enter'` | `{ type: 'pressKey', key: 'Enter' }` |
| GA-12 | Tab keydown emits `pressKey` | AC8 | — | dispatch `keydown` `key: 'Tab'` | `{ type: 'pressKey', key: 'Tab' }` |
| GA-13 | Escape keydown emits `pressKey` | AC8 | — | dispatch `keydown` `key: 'Escape'` | `{ type: 'pressKey', key: 'Escape' }` |
| GA-14 | Regular `'a'` keydown does NOT emit | AC8 | — | dispatch `keydown` `key: 'a'` | `capture` not called |
| GA-15 | Script string has no `import` or `require(` | AC10 | import | check string content | `.not.toMatch(/\bimport\b/)` and `.not.toMatch(/require\s*\()` |

**Generator A total: 15 tests**

*Gaps: HUD descendant case (AC3), debounce 500ms timer (AC4), premature-emit guard (AC4), textarea (AC4), `__uivisorCapture` guard (AC9), re-export from `index.ts` (AC1)*

---

## Tests — Generator B

*(Raw output — tester_generator_b / gpt-5.4)*

**Test file:** `packages/core/src/captureScript.test.ts`
**Runner:** `npx vitest run` from `packages/core/`
**Injection:** `(new Function(CAPTURE_SCRIPT))()` in `beforeAll`; `vi.fn()` cleared in `beforeEach`; `vi.useFakeTimers()` / `vi.useRealTimers()` inline in timer tests

| ID | Description | AC | Notes |
|----|------------|-----|-------|
| GB-01 | Script export is a non-empty string | AC1 | — |
| GB-02 | `CAPTURE_SCRIPT` re-exported from `index.ts` resolves and is a string | AC1 | import from `./index.js` |
| GB-03 | Script contains no `import` keyword | AC10 | `.not.toMatch(/\bimport\b/)` |
| GB-04 | Script contains no `require(` | AC10 | `.not.toMatch(/require\s*\()` |
| GB-05 | Click on element with text emits `tapOn` with text selector | AC2 | — |
| GB-06 | Click on element with `data-testid` emits `tapOn` with testId selector | AC2 | — |
| GB-07 | Click on `#uivisor-hud` does not emit | AC3 | — |
| GB-08 | Click on child element inside `#uivisor-hud` does not emit | AC3 | `hud > button` click |
| GB-09 | Multiple input events then blur emits `inputTextTargeted` exactly once with final value | AC4 | 5 input events before blur |
| GB-10 | Input event + advance 500ms emits command without blur | AC4 | `vi.useFakeTimers()` before dispatch; advance 500ms |
| GB-11 | Input event + advance 499ms does NOT emit prematurely | AC4 | advance only 499ms; assert not called |
| GB-12 | Textarea input + blur emits `inputTextTargeted` | AC4 | `<textarea>` element |
| GB-13 | Select change emits `selectOption` with `selector` and `value` fields | AC5 | field names confirmed against `types.ts` |
| GB-14 | Checkbox checked → `check` command with `selector` field | AC6 | — |
| GB-15 | Checkbox unchecked → `uncheck` command with `selector` field | AC6 | — |
| GB-16 | `popstate` → `goto` command | AC7 | — |
| GB-17 | `hashchange` → `goto` command | AC7 | — |
| GB-18 | Enter keydown → `pressKey` | AC8 | — |
| GB-19 | Tab keydown → `pressKey` | AC8 | — |
| GB-20 | Escape keydown → `pressKey` | AC8 | — |
| GB-21 | Regular `'a'` keydown → no emit | AC8 | negative case |
| GB-22 | ArrowUp keydown → no emit | AC8 | additional negative |
| GB-23 | `window.__uivisorCapture` undefined → click does not throw | AC9 | `delete window.__uivisorCapture`; restore after |
| GB-24 | `window.__uivisorCapture` set to non-function `42` → no throw | AC9 | set to number; restore after |

**Generator B total: 24 tests**

*Extras vs Gen A: GB-08 (HUD descendant), GB-09/GB-10/GB-11 (debounce coverage), GB-12 (textarea), GB-22 (ArrowUp), GB-23/GB-24 (guard variants), GB-02 (index re-export)*

---

## Tests

*(Final plan — Consolidator merged, Arbiter finalised)*

### Arbiter notes

1. **Merged GB-03 + GB-04 into single CS-02** — both string-content assertions belong in one test; keeping them separate adds noise with no isolation benefit.
2. **Dropped GB-22 (ArrowUp)** — low value; AC8 negative path is already fully covered by CS-21 (`'a'`). Arrow keys are not in the spec's capture list.
3. **Dropped GB-24 (non-function `42`)** — GB-23/CS-22 (`undefined`) covers the guard path; `typeof 42 === 'function'` is false by the same check, so no new code path is exercised.
4. **Critical — field name `element` in `inputTextTargeted`**: per `types.ts` line 14, the field is `element`, not `selector`. Tests CS-08, CS-09, CS-12 must assert `element`, not `selector`.
5. **Critical — field names in `selectOption`**: per `types.ts` line 29, fields are `selector` and `value`. Tests CS-13 must NOT use `element` or `option`.
6. **Critical — field name `selector` in `check`/`uncheck`**: per `types.ts` lines 30–31. Tests CS-14, CS-15 must use `selector`.
7. **Fake-timer tests (CS-10, CS-11)**: `vi.useFakeTimers()` MUST be called before dispatching the `input` event so the script's internal `setTimeout` call is intercepted. Restore with `vi.useRealTimers()` after the assertion.
8. **Injection approach**: `(new Function(CAPTURE_SCRIPT))()` in `beforeAll` is correct — the script IIFE is wrapped in another function body and called, resolving `document`/`window` against the jsdom global. Re-evaluating in every test would stack listeners; inject once and rely on `mockClear()`.

### Injection setup

```typescript
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { CAPTURE_SCRIPT } from './captureScript.js';

const capture = vi.fn();

beforeAll(() => {
  (window as any).__uivisorCapture = capture;
  (new Function(CAPTURE_SCRIPT))();
});

beforeEach(() => {
  capture.mockClear();
  document.body.innerHTML = '';
});
```

### Final test plan

| ID | Description | AC | Key assertion |
|----|------------|-----|--------------|
| CS-01 | `CAPTURE_SCRIPT` export is a non-empty string | AC1 | `typeof CAPTURE_SCRIPT === 'string'` and `CAPTURE_SCRIPT.length > 0` |
| CS-02 | Script string contains no `import` keyword and no `require(` | AC10 | `.not.toMatch(/\bimport\b/)` and `.not.toMatch(/require\s*\()` |
| CS-03 | `CAPTURE_SCRIPT` re-exported from `index.ts` resolves as a string | AC1 | `import { CAPTURE_SCRIPT } from './index.js'`; `typeof` result `=== 'string'` |
| CS-04 | Click on button with text emits `{ type: 'tapOn', selector: { text: 'Submit' } }` | AC2 | `capture` called once; full shape match |
| CS-05 | Click on button with `data-testid="btn"` emits `{ type: 'tapOn', selector: { testId: 'btn' } }` | AC2 | `capture` called once; testId selector |
| CS-06 | Click on `id="uivisor-hud"` element does NOT emit | AC3 | `capture` not called after `hud.click()` |
| CS-07 | Click on button descendant of `#uivisor-hud` does NOT emit | AC3 | `capture` not called after `hudChild.click()` |
| CS-08 | Input events + blur emit `inputTextTargeted` exactly once with final value | AC4 | `capture` called once; `{ type: 'inputTextTargeted', element: { testId: 'f' }, text: 'final' }` |
| CS-09 | Five `input` events then `blur` emit only ONE command | AC4 | `capture.mock.calls.length === 1` |
| CS-10 | `input` event + advance 500 ms emits command without `blur` (fake timers) | AC4 | `vi.useFakeTimers()` before dispatch; `vi.advanceTimersByTime(500)`; `capture` called once |
| CS-11 | `input` event + advance 499 ms does NOT emit prematurely (fake timers) | AC4 | `vi.useFakeTimers()` before dispatch; `vi.advanceTimersByTime(499)`; `capture` not called |
| CS-12 | `<textarea>` input + blur emits `inputTextTargeted` | AC4 | same debounce path; `element` field present |
| CS-13 | `<select>` change emits `{ type: 'selectOption', selector: ..., value: 'US' }` | AC5 | `selector` + `value` fields per `types.ts` |
| CS-14 | Checking checkbox emits `{ type: 'check', selector: { testId: 'cb' } }` | AC6 | `el.checked = true` before dispatch; `selector` field |
| CS-15 | Unchecking checkbox emits `{ type: 'uncheck', selector: { testId: 'cb' } }` | AC6 | `el.checked = false` before dispatch; `selector` field |
| CS-16 | `popstate` event emits `{ type: 'goto', url: window.location.href }` | AC7 | `window.dispatchEvent(new PopStateEvent('popstate'))` |
| CS-17 | `hashchange` event emits `{ type: 'goto', url: window.location.href }` | AC7 | `window.dispatchEvent(new HashChangeEvent('hashchange'))` |
| CS-18 | `Enter` keydown emits `{ type: 'pressKey', key: 'Enter' }` | AC8 | exact object match |
| CS-19 | `Tab` keydown emits `{ type: 'pressKey', key: 'Tab' }` | AC8 | exact object match |
| CS-20 | `Escape` keydown emits `{ type: 'pressKey', key: 'Escape' }` | AC8 | exact object match |
| CS-21 | Regular `'a'` keydown does NOT emit any command | AC8 | `capture` not called |
| CS-22 | `window.__uivisorCapture` undefined → click does not throw; no command emitted | AC9 | `delete (window as any).__uivisorCapture`; `expect(() => btn.click()).not.toThrow()`; restore mock after |

**Total: 22 tests across AC1–AC10.**
