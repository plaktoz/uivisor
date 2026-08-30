# Pipeline State: feat-assertion-commands

**Task:** Add assertText, assertValue, assertCount, assertEnabled, assertDisabled, assertChecked, assertUnchecked commands
**Epic:** epic-add-more-ui-test-capability
**Started:** 2026-08-30
**Status:** complete

---

## Gate 1: Spec

### Overview

This feature extends the uivisor YAML DSL with seven new assertion commands covering text content, form field values, element counts, enabled/disabled state, and checkbox checked/unchecked state. Each command follows the existing throw-and-catch pattern established by `assertVisible`: the executor throws a structured `Expected: …\nGot: …` error on failure, which the dispatcher parses into `CommandResult.expected` and `CommandResult.got`.

### YAML Syntax

```yaml
- assertText:    { testId: "heading",        expected: "Welcome, user" }
- assertValue:   { testId: "email-input",    expected: "user@example.com" }
- assertCount:   { css: ".list-item",        expected: 3 }
- assertEnabled:   { testId: "submit-btn" }
- assertDisabled:  { testId: "disabled-input" }
- assertChecked:   { testId: "terms-checkbox" }
- assertUnchecked: { testId: "newsletter-checkbox" }
```

`assertText`, `assertValue`, `assertEnabled`, `assertDisabled`, `assertChecked`, `assertUnchecked` accept the full existing `Selector` union (string, `{ text }`, `{ role, name }`, `{ label }`, `{ placeholder }`, `{ testId }`). `assertCount` takes a raw CSS string via `{ css, expected }` because it targets multiple elements.

### Playwright API Mapping

| Command | Playwright call |
|---|---|
| `assertText` | `locator.waitFor()` → `locator.textContent()`, trimmed, exact equality |
| `assertValue` | `locator.waitFor()` → `locator.inputValue()`, exact equality |
| `assertCount` | `page.locator(css).count()` (no waitFor — returns 0 for no matches) |
| `assertEnabled` | `locator.waitFor()` → `locator.isEnabled()` |
| `assertDisabled` | `locator.waitFor()` → `locator.isDisabled()` |
| `assertChecked` | `locator.waitFor()` → `locator.isChecked()` |
| `assertUnchecked` | `locator.waitFor()` → `!locator.isChecked()` |

### Type / Parser / Dispatcher Contracts

**`types.ts` additions:**
```typescript
| { type: 'assertText';      selector: Selector; expected: string }
| { type: 'assertValue';     selector: Selector; expected: string }
| { type: 'assertCount';     css: string; expected: number }
| { type: 'assertEnabled';   selector: Selector }
| { type: 'assertDisabled';  selector: Selector }
| { type: 'assertChecked';   selector: Selector }
| { type: 'assertUnchecked'; selector: Selector }
```

**Throw patterns (all parsed by the dispatcher's `Expected:`/`Got:` splitter):**

| Command | Scenario | Error message |
|---|---|---|
| `assertText` | element not found | `Expected: <expected>\nGot: element not found` |
| `assertText` | text mismatch | `Expected: <expected>\nGot: <actual trimmed>` |
| `assertValue` | element not found | `Expected: <expected>\nGot: element not found` |
| `assertValue` | value mismatch | `Expected: <expected>\nGot: <actual value>` |
| `assertCount` | count mismatch | `Expected: <n>\nGot: <actual count>` |
| `assertEnabled` | not found | `Expected: enabled\nGot: element not found` |
| `assertEnabled` | is disabled | `Expected: enabled\nGot: disabled` |
| `assertDisabled` | not found | `Expected: disabled\nGot: element not found` |
| `assertDisabled` | is enabled | `Expected: disabled\nGot: enabled` |
| `assertChecked` | not found | `Expected: checked\nGot: element not found` |
| `assertChecked` | unchecked | `Expected: checked\nGot: unchecked` |
| `assertUnchecked` | not found | `Expected: unchecked\nGot: element not found` |
| `assertUnchecked` | checked | `Expected: unchecked\nGot: checked` |

### Test Fixture Additions (`tests/fixtures/test-page.html`)

Add after the existing `#show-error-btn` section:

```html
<input id="prefilled-input"   type="text"     value="hello world"    data-testid="prefilled-input"   readonly>
<input id="disabled-input"    type="text"     placeholder="Disabled" data-testid="disabled-input"    disabled>
<input id="checked-checkbox"  type="checkbox" checked                data-testid="checked-checkbox">
<input id="unchecked-checkbox"type="checkbox"                        data-testid="unchecked-checkbox">
<ul id="item-list">
  <li class="list-item" data-testid="list-item-1">Item 1</li>
  <li class="list-item" data-testid="list-item-2">Item 2</li>
  <li class="list-item" data-testid="list-item-3">Item 3</li>
</ul>
```

**Fixture invariants:** none of these elements are mutated by other tests. Each test gets a fresh page via `beforeEach`.

### Acceptance Criteria

**assertText**
- AC1: selector → `#welcome-heading`, expected `"Welcome, user"` → `passed: true`, `command.type = 'assertText'`, `durationMs > 0`
- AC2: selector → nonexistent element, any expected → `passed: false`, `got = "element not found"`
- AC3: selector → `#welcome-heading`, expected `"Wrong text"` → `passed: false`, `expected = "Wrong text"`, `got = "Welcome, user"`
- AC4: text comparison uses trimmed `textContent()`, exact equality (no partial match)

**assertValue**
- AC5: `testId: "prefilled-input"`, expected `"hello world"` → `passed: true`
- AC6: nonexistent selector → `passed: false`, `got = "element not found"`
- AC7: `testId: "prefilled-input"`, expected `"wrong value"` → `passed: false`, `got = "hello world"`
- AC8: uses `inputValue()`, exact equality

**assertCount**
- AC9: `css: ".list-item"`, expected `3` (3 elements present) → `passed: true`
- AC10: `css: ".list-item"`, expected `5` → `passed: false`, `expected = "5"`, `got = "3"`
- AC11: `css: ".nonexistent-xyz"`, expected `1` → `passed: false`, `got = "0"`
- AC12: `css: ".nonexistent-xyz"`, expected `0` → `passed: true`
- AC13: parser throws `/assertCount expected must be an integer/i` for float or string `expected`

**assertEnabled**
- AC14: `#email-input` (enabled) → `passed: true`
- AC15: nonexistent selector → `passed: false`, `expected = "enabled"`, `got = "element not found"`
- AC16: `#disabled-input` → `passed: false`, `expected = "enabled"`, `got = "disabled"`

**assertDisabled**
- AC17: `#disabled-input` → `passed: true`
- AC18: nonexistent selector → `passed: false`, `expected = "disabled"`, `got = "element not found"`
- AC19: `#email-input` → `passed: false`, `expected = "disabled"`, `got = "enabled"`

**assertChecked**
- AC20: `testId: "checked-checkbox"` → `passed: true`
- AC21: nonexistent selector → `passed: false`, `expected = "checked"`, `got = "element not found"`
- AC22: `testId: "unchecked-checkbox"` → `passed: false`, `expected = "checked"`, `got = "unchecked"`

**assertUnchecked**
- AC23: `testId: "unchecked-checkbox"` → `passed: true`
- AC24: nonexistent selector → `passed: false`, `expected = "unchecked"`, `got = "element not found"`
- AC25: `testId: "checked-checkbox"` → `passed: false`, `expected = "unchecked"`, `got = "checked"`

**CommandResult shape (all 7 commands)**
- AC26: passing invocation → `message` is `undefined`
- AC27: failing invocation → `passed: false`, `expected` non-empty, `got` non-empty, `durationMs > 0`
- AC28: failing invocation → `message` contains `"Expected:"` and `"Got:"`

**Parser unit tests**
- AC29: `{ assertText: { testId: 'welcome-heading', expected: 'Welcome, user' } }` → `{ type: 'assertText', selector: { testId: 'welcome-heading' }, expected: 'Welcome, user' }`
- AC30: `{ assertValue: { placeholder: 'Enter email', expected: 'user@example.com' } }` → `{ type: 'assertValue', selector: { placeholder: 'Enter email' }, expected: 'user@example.com' }`
- AC31: `{ assertCount: { css: '.list-item', expected: 3 } }` → `{ type: 'assertCount', css: '.list-item', expected: 3 }`
- AC32: `{ assertCount: { css: '.list-item', expected: 2.5 } }` → throws
- AC33: `{ assertEnabled: { testId: 'email-input' } }` → `{ type: 'assertEnabled', selector: { testId: 'email-input' } }` (same for assertDisabled, assertChecked, assertUnchecked)
- AC34: `{ assertEnabled: 'Submit' }` → `{ type: 'assertEnabled', selector: 'Submit' }`

**Spec revision: 0 of max 2**

---

## Feature & Task Breakdown

| # | Ticket | Files | Depends On | Status |
|---|---|---|---|---|
| T1 | Extend `Command` union in types.ts | `src/types.ts` | — | open |
| T2 | Add parser cases (7 commands) | `src/engine/commandParser.ts` | T1 | open |
| T3 | Add executor functions (7 commands) | `src/driver/commands.ts` | T1 | open |
| T4 | Wire dispatcher (7 commands) | `src/engine/dispatcher.ts` | T2, T3 | open |
| T5 | Add fixture HTML elements | `tests/fixtures/test-page.html` | — | open |
| T6 | Add parser unit tests | `tests/unit/parser.test.ts` | T1, T2 | open |
| T7 | Add integration tests + fix freshCtx | `tests/integration/commands.test.ts` | T4, T5 | open |

**Seam flag (Coder must not miss):** `assertCount` uses `{ css: string; expected: number }` — dispatcher must call `executeAssertCount(page, cmd.css, cmd.expected)`, NOT `cmd.selector`. Every other command uses `cmd.selector`. TypeScript will catch a mistake at compile time — run `tsc --noEmit` before committing.

---

## Tests

**Phase 1 complete — red phase confirmed**

- Parser unit tests added: 9 new cases (ACs 29–34) — all failing `Unknown command: assertXxx` ✓
- Integration tests added: 21 new cases (3 per command × 7) — pending implementation ✓
- `freshCtx()` fixed: added `runDir: process.cwd()` ✓
- Fixture updated: 8 new HTML elements added to `test-page.html` ✓

---

## Code Artifacts

**Commit:** `0fa0abb` on branch `feat-assertion-commands`

Files changed (7):
- `src/types.ts` — 7 new `Command` union members
- `src/engine/commandParser.ts` — 7 new parser cases
- `src/driver/commands.ts` — 7 new executor functions + `Locator` import
- `src/engine/dispatcher.ts` — 7 new dispatch cases + imports
- `src/reporter/console.ts` — exhaustiveness fix (7 new cases in `_cmdSummary` switch)
- `src/reporter/html.ts` — exhaustiveness fix (7 new cases in `cmdLabel`)
- `src/reporter/markdown.ts` — exhaustiveness fix (7 new cases in `cmdLabel`)

---

## Test Results

**Phase 2 — green**

| Suite | Passed | Failed | Notes |
|---|---|---|---|
| `tests/unit/parser.test.ts` | 62 | 0 | All 9 new cases pass |
| `tests/integration/commands.test.ts` | 59 | 0 | All 21 new cases pass |
| `tests/integration/cli.test.ts` | 16 | 6 | Pre-existing failures (reporter ACs 57–62); confirmed same in main checkout |
| **Total** | **219** | **6** | No regressions |

**Pre-existing failures confirmed:** same 6 reporter tests fail in main checkout before this feature. Not a regression.

---

## Quality Gate

**PASS**

- All 30 new tests green (9 unit + 21 integration)
- Zero regressions in existing 189 passing tests
- TypeScript: `tsc --noEmit` clean (exhaustiveness errors in reporters fixed)
- Reporter exhaustiveness fix is correct: new command types are handled in all 3 reporter label switches

---

Files written to `.worktrees/feat-assertion-commands/uivisor-app/`:
- `tests/unit/parser.test.ts`
- `tests/integration/commands.test.ts`
- `tests/fixtures/test-page.html`

**Seam flag (Coder must not miss):** `assertCount` uses `{ css: string; expected: number }` — dispatcher must call `executeAssertCount(page, cmd.css, cmd.expected)`, NOT `cmd.selector`. Every other command uses `cmd.selector`. TypeScript will catch a mistake at compile time — run `tsc --noEmit` before committing.

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
   4a. tester_generator_a + tester_generator_b in parallel → generate test cases
   4b. tester_consolidator → deduplicates → state.md#tests
   4c. tester_arbiter → resolves disagreements
4. Coder → skill: implement
   Working directory: .worktrees/feat-assertion-commands
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
**Duration:** ~44–80 min  (no retries: ~44 min)
**Cost:** ~$0.29–$0.49  (cap: $5.00)
**Tokens:** ~30K–75K

**Retry budgets:**
- TDD + quality gate: 3 rounds
- Spec revision: 2 rounds
- Design revision: n/a (Designer not activated)
- Code review: 2 rounds

## Worktree
**Path:** .worktrees/feat-assertion-commands
**Branch:** feat-assertion-commands
**Created:** 2026-08-30
**Status:** removed
