# Pipeline State: feat-interaction-commands

**Task:** Add pressKey, selectOption, check, uncheck, hover, doubleClick, clearText commands
**Epic:** epic-add-more-ui-test-capability
**Started:** 2026-08-30
**Status:** complete

## Worktree
**Path:** .worktrees/feat-interaction-commands
**Branch:** feat-interaction-commands
**Created:** 2026-08-30
**Status:** removed

---

## Gate 1: Spec

### Overview

This feature extends the uivisor YAML DSL with seven new interaction commands: keyboard key press, dropdown selection, checkbox check/uncheck, hover, double-click, and field clear. Each command follows the existing `tapOn`/`assertVisible` patterns — selector-resolved locators, 5000ms timeouts, and a simple `'Element not found.'` throw on failure that the dispatcher converts to `CommandResult.passed = false`.

### YAML Syntax

```yaml
- pressKey: Enter
- pressKey: Tab
- pressKey: Escape
- pressKey: ArrowDown
- selectOption: { testId: "country-select", value: "sg" }
- selectOption: { label: "Country", value: "my" }
- check:        { testId: "terms-checkbox" }
- check:        "Accept terms"
- uncheck:      { testId: "newsletter-checkbox" }
- hover:        { testId: "tooltip-trigger" }
- hover:        "Sign In"
- doubleClick:  { testId: "editable-cell" }
- clearText:    { testId: "search-input" }
- clearText:    { placeholder: "Enter email" }
```

`pressKey` accepts a plain string key name (the value of the YAML key) — not a selector object. All other six commands accept the full existing `Selector` union (string, `{ text }`, `{ role, name }`, `{ label }`, `{ placeholder }`, `{ testId }`). `selectOption` additionally requires a `value` property alongside the selector keys.

### Playwright API Mapping

| Command | Playwright call |
|---|---|
| `pressKey` | `page.keyboard.press(key)` — no selector, fires globally |
| `selectOption` | `resolveSelector` → `locator.waitFor({state:'attached', timeout:5000})` → `locator.selectOption(value, {timeout:5000})` |
| `check` | `resolveSelector` → `locator.check({timeout:5000})` |
| `uncheck` | `resolveSelector` → `locator.uncheck({timeout:5000})` |
| `hover` | `resolveSelector` → `locator.hover({timeout:5000})` |
| `doubleClick` | `resolveSelector` → `locator.dblclick({timeout:5000})` |
| `clearText` | `resolveSelector` → `locator.clear({timeout:5000})` |

### Type / Parser / Dispatcher Contracts

**`types.ts` additions:**
```typescript
| { type: 'pressKey';     key: string }
| { type: 'selectOption'; selector: Selector; value: string }
| { type: 'check';        selector: Selector }
| { type: 'uncheck';      selector: Selector }
| { type: 'hover';        selector: Selector }
| { type: 'doubleClick';  selector: Selector }
| { type: 'clearText';    selector: Selector }
```

**Parser rules:**

| YAML key | Value shape | Notes |
|---|---|---|
| `pressKey` | plain string | `value as string` → `key` |
| `selectOption` | object with `value` + selector keys | extract `value`, pass rest to `parseSelector` |
| `check` | selector (any form) | `parseSelector(value)` |
| `uncheck` | selector (any form) | `parseSelector(value)` |
| `hover` | selector (any form) | `parseSelector(value)` |
| `doubleClick` | selector (any form) | `parseSelector(value)` |
| `clearText` | selector (any form) | `parseSelector(value)` |

`selectOption` parser must extract the `value` key from the object before passing the remainder to `parseSelector` — same pattern as `assertText`/`assertValue`.

### Error Messages

| Command | Failure scenario | Message |
|---|---|---|
| `pressKey` | (cannot fail — `page.keyboard.press` is always safe) | — |
| `selectOption` | element not found | `'Element not found.'` |
| `selectOption` | option value not present in the select | `'Option not found.'` |
| `check` | element not found | `'Element not found.'` |
| `uncheck` | element not found | `'Element not found.'` |
| `hover` | element not found | `'Element not found.'` |
| `doubleClick` | element not found | `'Element not found.'` |
| `clearText` | element not found | `'Element not found.'` |

`selectOption` uses two separate try-catch blocks: the first wraps `waitFor` (throws `Element not found.`); the second wraps `selectOption` (throws `Option not found.`). This lets tests distinguish between a missing element and a valid element with no matching option.

### Test Fixture Additions (`tests/fixtures/test-page.html`)

Add after the `#show-error-btn` / `#hide-error-btn` section:

```html
<!-- interaction-commands fixture -->
<select id="country-select" data-testid="country-select">
  <option value="">Please select</option>
  <option value="sg">Singapore</option>
  <option value="my">Malaysia</option>
</select>
<input id="check-box"   type="checkbox"         data-testid="check-box">
<input id="uncheck-box" type="checkbox" checked  data-testid="uncheck-box">
<input id="prefilled-text" type="text" value="clear me" data-testid="prefilled-text">
```

For `hover` and `doubleClick` tests, use existing elements (`submit-btn`, `Sign In` link) — no new elements required.

**Fixture invariants:** `check-box` starts unchecked; `uncheck-box` starts checked; `prefilled-text` starts with value `"clear me"`. Each test uses a fresh page via `beforeEach`.

### Acceptance Criteria

**pressKey**
- AC1: dispatch `{ type: 'pressKey', key: 'Tab' }` → `passed: true`, `command.type = 'pressKey'`, `durationMs ≥ 0`
- AC2: after tapping `email-input` and dispatching `pressKey: 'a'`, the field value includes `'a'` (key was delivered to focused element)
- AC3: `passed: true` is returned even if no element has focus (keyboard.press fires globally)

**selectOption**
- AC4: `{ testId: "country-select" }` + `value: "sg"` → `passed: true`; verify selected value is `"sg"` via `page.evaluate`
- AC5: nonexistent selector → `passed: false`, `message` matches `/Element not found/i`
- AC6: valid select element + nonexistent value `"xx"` → `passed: false`, `message` matches `/Option not found/i`

**check**
- AC7: `testId: "check-box"` (starts unchecked) → `passed: true`; verify `isChecked()` is `true` after
- AC8: nonexistent selector → `passed: false`, `message` matches `/Element not found/i`

**uncheck**
- AC9: `testId: "uncheck-box"` (starts checked) → `passed: true`; verify `isChecked()` is `false` after
- AC10: nonexistent selector → `passed: false`, `message` matches `/Element not found/i`

**hover**
- AC11: `testId: "submit-btn"` → `passed: true`
- AC12: nonexistent selector → `passed: false`, `message` matches `/Element not found/i`

**doubleClick**
- AC13: `testId: "submit-btn"` → `passed: true`
- AC14: nonexistent selector → `passed: false`, `message` matches `/Element not found/i`

**clearText**
- AC15: `testId: "prefilled-text"` (starts with `"clear me"`) → `passed: true`; verify `inputValue()` is `""` after
- AC16: nonexistent selector → `passed: false`, `message` matches `/Element not found/i`

**CommandResult shape (all 7 commands)**
- AC17: passing invocation → `passed: true`, `message` is `undefined`
- AC18: failing invocation → `passed: false`, `durationMs > 0`

**Parser unit tests**
- AC19: `{ pressKey: 'Enter' }` → `{ type: 'pressKey', key: 'Enter' }`
- AC20: `{ pressKey: 'ArrowDown' }` → `{ type: 'pressKey', key: 'ArrowDown' }`
- AC21: `{ selectOption: { testId: 'country-select', value: 'sg' } }` → `{ type: 'selectOption', selector: { testId: 'country-select' }, value: 'sg' }`
- AC22: `{ selectOption: { placeholder: 'Choose…', value: 'my' } }` → `{ type: 'selectOption', selector: { placeholder: 'Choose…' }, value: 'my' }`
- AC23: `{ check: { testId: 'terms' } }` → `{ type: 'check', selector: { testId: 'terms' } }`
- AC24: `{ check: 'Accept terms' }` → `{ type: 'check', selector: 'Accept terms' }` (string shorthand)
- AC25: `{ uncheck: { testId: 'newsletter' } }` → `{ type: 'uncheck', selector: { testId: 'newsletter' } }`
- AC26: `{ hover: { role: 'button', name: 'Submit' } }` → `{ type: 'hover', selector: { role: 'button', name: 'Submit' } }`
- AC27: `{ doubleClick: 'Sign In' }` → `{ type: 'doubleClick', selector: 'Sign In' }`
- AC28: `{ clearText: { placeholder: 'Enter email' } }` → `{ type: 'clearText', selector: { placeholder: 'Enter email' } }`

**Spec revision: 0 of max 2**

---

## Feature & Task Breakdown

| # | Ticket | Files | Depends On | Status |
|---|---|---|---|---|
| T1 | Extend `Command` union in types.ts | `src/types.ts` | — | open |
| T2 | Add parser cases (7 commands) | `src/parser/commandParser.ts` | T1 | open |
| T3 | Add executor functions (7 commands) | `src/driver/commands.ts` | T1 | open |
| T4 | Wire dispatcher (7 commands) | `src/engine/dispatcher.ts` | T2, T3 | open |
| T5 | Reporter exhaustiveness (7 commands) | `src/reporter/console.ts`, `html.ts`, `markdown.ts` | T1 | open |
| T6 | Add fixture HTML elements | `tests/fixtures/test-page.html` | — | open |
| T7 | Add parser unit tests | `tests/unit/parser.test.ts` | T1, T2 | open |
| T8 | Add integration tests | `tests/integration/commands.test.ts` | T4, T6 | open |

**Seam flags (Coder must not miss):**
1. `pressKey` has NO selector — dispatcher must call `executePressKey(page, cmd.key)`, NOT `cmd.selector`. TypeScript will catch at compile time.
2. `selectOption` carries BOTH `selector` AND `value` — dispatcher must call `executeSelectOption(page, cmd.selector, cmd.value)`. Parser must extract `value` before calling `parseSelector` (same pattern as `assertText`/`assertValue`).
3. All other 5 commands use only `cmd.selector`.

---

## Tests

**Phase 1 complete — red phase confirmed**

- Parser unit tests added: 10 new cases (ACs 19–28) — all failing `Unknown command: xxx` ✓
- Integration tests added: 12 failing (side-effect + `passed:false` assertions); 5 pass spuriously (dispatcher falls through for unknown types) ✓
- `freshCtx()` fixed: added `runDir: process.cwd()` ✓
- Fixture updated: 4 new HTML elements added to `test-page.html` ✓

---

## Code Artifacts

**Commit:** `edb37a2` on branch `feat-interaction-commands`

Files changed (10):
- `src/types.ts` — 7 new `Command` union members
- `src/parser/commandParser.ts` — 7 new parser cases
- `src/driver/commands.ts` — 7 new executor functions
- `src/engine/dispatcher.ts` — 7 new dispatch cases + imports
- `src/reporter/console.ts` — exhaustiveness fix (7 new cases)
- `src/reporter/html.ts` — exhaustiveness fix (7 new cases)
- `src/reporter/markdown.ts` — exhaustiveness fix (7 new cases)
- `tests/fixtures/test-page.html` — 4 new fixture elements
- `tests/unit/parser.test.ts` — 10 new parser unit tests
- `tests/integration/commands.test.ts` — 17 new integration tests + freshCtx runDir fix

---

## Test Results

**Phase 2 — green**

| Suite | Passed | Failed | Notes |
|---|---|---|---|
| `tests/unit/parser.test.ts` | 63 | 0 | All 10 new cases pass |
| `tests/integration/commands.test.ts` | 54 | 0 | All 17 new cases pass |
| `tests/integration/cli.test.ts` | 16 | 6 | Pre-existing failures; confirmed same in main checkout |
| **Total** | **133** | **6** | No regressions |

**Pre-existing failures confirmed:** same 6 reporter tests fail in main checkout before this feature. Not a regression.

---

## Quality Gate

**PASS**

- All 27 new tests green (10 unit + 17 integration)
- Zero regressions in existing 106 passing tests
- TypeScript: `tsc --noEmit` clean (exhaustiveness errors in all 3 reporters fixed)
- Seam flags respected: `pressKey` calls `executePressKey(page, cmd.key)`, `selectOption` calls `executeSelectOption(page, cmd.selector, cmd.value)`, all others use `cmd.selector`

---

## Gate 0: Execution Plan

**Classification:** feature
**Complexity:** medium

**Roles Activated:** Analyst, Architect, Tester Ensemble, Coder, Release Documenter, Deployer
**Designer Activated:** no

**Execution Sequence:**
1. Analyst → skill: to-spec
   Output: spec + acceptance criteria → state.md#gate-1
   [GATE 1: human approval required — revision cap: 2]
2. Architect → skill: to-tickets + codebase-design
   Reads: Gate 1 spec
   Output: task breakdown → state.md#feature-task-breakdown
3. Tester Ensemble Phase 1 → skill: tdd
   3a. tester_generator_a + tester_generator_b in parallel → generate test cases
   3b. tester_consolidator → deduplicates → state.md#tests
   3c. tester_arbiter → resolves disagreements
4. Coder → skill: implement
   Working directory: .worktrees/feat-interaction-commands
   Output: source files → state.md#code-artifacts
5. Tester Ensemble Phase 2 → skill: tdd + code-review
   Output: test results → state.md#test-results
   Retry cap: 3 | Review cap: 2
6. Quality Gate → skill: quality (autonomous)
   Output: pass/fail verdict → state.md#quality-gate
   [GATE 3: human approval required before deploying]
7. Release Documenter → skill: proj-deploy
8. Deployer → skill: proj-deploy

## Run Estimates

**Complexity:** medium
**Duration:** ~44–80 min  (no retries: ~38 min)
**Cost:** ~$0.29–$0.49  (cap: $5.00)
**Tokens:** ~30K–75K

**Retry budgets:**
- TDD + quality gate: 3 rounds
- Spec revision: 2 rounds
- Design revision: n/a (Designer not activated)
- Code review: 2 rounds
