# Pipeline State: feat-wait-for-dynamic-page-load

**Task:** Add a `waitForLoad` command — waits for a dynamically loaded page to reach a stable state, with a hard 30-second timeout. From GitHub issue #71 (plaktoz/uivisor).
**Started:** 2026-09-13
**Status:** in_progress

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
   Output: feature/task breakdown table → state.md#feature-task-breakdown
3. Tester Ensemble Phase 1 → skill: tdd
   Reads: spec + acceptance criteria
   3a. tester_generator_a + tester_generator_b in parallel → each generates test cases
   3b. tester_consolidator → deduplicates → state.md#tests
   3c. tester_arbiter → resolves disagreements
   Output: unit tests + integration tests → state.md#tests
4. Coder → skill: implement
   Reads: spec + tests from state.md
   Working directory: .worktrees/feat-wait-for-dynamic-page-load
   Output: source files → state.md#code-artifacts
5. Tester Ensemble Phase 2 → skill: tdd + code-review
   Runs tests, reports results → state.md#test-results
6. Quality Gate → skill: quality (tester_arbiter, autonomous)
   Output: pass/fail verdict → state.md#quality-gate
7. Release Documenter → skill: proj-deploy
   Output: signoff_package.md
8. Deployer → skill: proj-deploy
9. Delivery Manager (autonomous) → pipeline/feat-wait-for-dynamic-page-load/retro.md

## Run Estimates

**Complexity:** medium
**Duration:** ~38–74 min  (no retries: ~38 min)
**Cost:** ~$0.29–$0.59  (cap: $5.00)
**Tokens:** ~36K–90K

**Retry budgets:**
- TDD + quality gate: 3 rounds
- Spec revision: 2 rounds
- Design revision: n/a (Designer not activated)
- Code review: 2 rounds

---

**Lessons from knowledge base injected:** reporter-exhaustiveness-required-for-new-commands

---

## Gate 1: Spec — feat-wait-for-dynamic-page-load

### Problem
Playwright's `waitUntil: 'load'` fires when the initial HTML document and its synchronous resources have loaded, but Single Page Applications (SPAs) and dynamically-rendered pages continue populating the DOM well after that event. Flow authors currently have no way to express "wait until this page is actually usable" without resorting to arbitrary `waitFor` delays, which are brittle and slow. The `waitForLoad` command fills that gap by offering either a network-idle heuristic or a concrete DOM-presence check.

### Solution
Add a `waitForLoad` command to the YAML flow schema with two operating modes:

- **Selector mode** (when `selector` is provided): calls Playwright's `page.waitForSelector(selector, { state: 'visible', timeout: 30000 })`. The flow proceeds once the element is visible in the DOM.
- **Network-idle mode** (when `selector` is omitted): calls `page.waitForLoadState('networkidle', { timeout: 30000 })`. The flow proceeds once there have been no network requests for 500 ms.

A hard 30 000 ms timeout applies to both modes; exceeding it throws a Playwright `TimeoutError` and fails the step. The command accepts any CSS or XPath selector string (consistent with existing `tapOn`, `within`, etc.).

YAML syntax:
```yaml
- waitForLoad:                    # network-idle mode
- waitForLoad:
    selector: "#main-content"     # selector mode (CSS)
- waitForLoad:
    selector: "//h1[@id='title']" # selector mode (XPath)
```

### Acceptance Criteria

| ID | Criterion |
|---|---|
| AC1 | `- waitForLoad:` (no selector) parses to `{ type: 'waitForLoad' }` and resolves via `networkidle` with a 30 000 ms timeout |
| AC2 | `- waitForLoad: { selector: "..." }` parses to `{ type: 'waitForLoad', selector: string }` and resolves via `waitForSelector` with `state: 'visible'` and a 30 000 ms timeout |
| AC3 | If the timeout is exceeded in either mode, the step throws (propagating Playwright's `TimeoutError`) and the flow fails with a clear error message |
| AC4 | Reporter output labels the step as `waitForLoad` (networkidle) or `waitForLoad: #selector` (selector mode) in all three reporter formats (console, html, markdown) |
| AC5 | Both modes are exercised by integration tests: one flow that uses networkidle after a `goto`, one that uses selector mode, and one that verifies timeout failure behavior |

### Files to change

| File | Change |
|---|---|
| `packages/core/src/types.ts` | Add `{ type: 'waitForLoad'; selector?: string }` to the `Command` union |
| `packages/core/src/commands.ts` | Add `executeWaitForLoad(page, selector?)` — branches on selector presence; wraps `page.waitForSelector` or `page.waitForLoadState('networkidle')`, both with `timeout: 30000` |
| `packages/core/src/index.ts` | Export `executeWaitForLoad` |
| `recorder-app/src/flowReplayer.ts` | Add `case 'waitForLoad'` in `parseCommand` (parse optional `selector` string); add `case 'waitForLoad'` in `dispatchCommand` calling `executeWaitForLoad`; import `executeWaitForLoad` |
| `uivisor-app/src/reporter/console.ts` | Add `case 'waitForLoad'` returning `waitForLoad` or `waitForLoad: ${cmd.selector}` |
| `uivisor-app/src/reporter/html.ts` | Add `case 'waitForLoad'` with same label logic |
| `uivisor-app/src/reporter/markdown.ts` | Add `case 'waitForLoad'` with same label logic |

### Out of scope
- Configurable timeout (the 30 000 ms cap is fixed; no per-command `timeout` field)
- Recording `waitForLoad` steps automatically during browser capture (authoring-only command)
- Support for Playwright load states other than `networkidle`
- Any changes to `goto` or `reload` default `waitUntil` behavior

---

## Feature & Task Breakdown

| ID | Task | File(s) | Depends on | Status |
|---|---|---|---|---|
| T1 | Add `waitForLoad` to Command union (before `within`) | `packages/core/src/types.ts` | — | open |
| T2 | Add `executeWaitForLoad` executor | `packages/core/src/commands.ts` | T1 | open |
| T3 | Export `executeWaitForLoad` from core | `packages/core/src/index.ts` | T2 | open |
| T4 | Wire `parseCommand` case + `dispatchCommand` case + import in flowReplayer | `recorder-app/src/flowReplayer.ts` | T3 | open |
| T5 | Update reporter labels (all 3 files) | `uivisor-app/src/reporter/console.ts`, `uivisor-app/src/reporter/html.ts`, `uivisor-app/src/reporter/markdown.ts` | T1 | open |
| T6 | Write unit tests for `executeWaitForLoad` | `packages/core/src/commands.test.ts` (new) | T2 | open |
| T7 | Add `waitForLoad` cases to flowReplayer unit tests | `recorder-app/src/flowReplayer.test.ts` | T4 | open |

**Architect note:** `dispatchCommand` in flowReplayer.ts DOES have an exhaustiveness guard (`default: { const _exhaustive: never = cmd; … }`), so TypeScript will error there too until T4 is done. Integration test file already exists at `recorder-app/src/flowReplayer.test.ts` — append cases there.

---

## Tests — Generator A (tester_generator_a)

### Unit tests

#### UT1: executeWaitForLoad — no selector calls page.waitForLoadState with networkidle and 30s timeout
**AC:** AC1 | **File:** `packages/core/src/commands.test.ts`
Mock `page.waitForLoadState`. Assert called once with `('networkidle', { timeout: 30_000 })`. Assert `page.waitForSelector` not called.

#### UT2: executeWaitForLoad — with selector calls page.waitForSelector with state:visible and 30s timeout
**AC:** AC2 | **File:** `packages/core/src/commands.test.ts`
Mock `page.waitForSelector`. Assert called with `('#main-content', { state: 'visible', timeout: 30_000 })`. Assert `page.waitForLoadState` not called.

#### UT3: executeWaitForLoad — no-selector timeout propagates as thrown error
**AC:** AC3 | **File:** `packages/core/src/commands.test.ts`
`waitForLoadState` rejects with `'Timeout 30000ms exceeded.'`. Assert `executeWaitForLoad` re-throws and error matches `/30000|timeout/i`.

#### UT4: executeWaitForLoad — selector timeout propagates as thrown error
**AC:** AC3 | **File:** `packages/core/src/commands.test.ts`
`waitForSelector` rejects. Assert error matches `/30000|timeout/i`.

#### UT5: parseCommand — `{ waitForLoad: null }` → `{ type: 'waitForLoad' }` (no selector field)
**AC:** AC1 | **File:** `recorder-app/src/flowReplayer.test.ts`

#### UT6: parseCommand — `{ waitForLoad: { selector: '#main-content' } }` → `{ type: 'waitForLoad', selector: '#main-content' }`
**AC:** AC2 | **File:** `recorder-app/src/flowReplayer.test.ts`

#### UT7: parseCommand — `{ waitForLoad: { selector: '' } }` round-trips without error
**AC:** AC2 | **File:** `recorder-app/src/flowReplayer.test.ts`

### Integration tests

#### IT1: networkidle mode — completes on a normally-loading page (passed: true)
**AC:** AC5 | **File:** `recorder-app/src/flowReplayer.test.ts` — mock page, `waitForLoadState` resolves

#### IT2: selector mode — element visible on fixture page (passed: true)
**AC:** AC5 | **File:** `recorder-app/src/flowReplayer.test.ts` — mock page, `waitForSelector` resolves

#### IT3: timeout failure — selector never appears → passed: false, message mentions timeout
**AC:** AC3, AC5 | **File:** `recorder-app/src/flowReplayer.test.ts` — `waitForSelector` rejects with TimeoutError

### Reporter tests

#### RT1-RT7: All three reporters (console, html, markdown) render `waitForLoad` and `waitForLoad: #selector` correctly
**AC:** AC4 | **File:** `uivisor-app/tests/unit/reporter.test.ts`

---

## Tests — Generator B (tester_generator_b)

### Unit tests

#### UT1 (B): `{ waitForLoad: null }` dispatches networkidle, waitForSelector not called
**AC:** AC1 | **File:** `recorder-app/src/flowReplayer.test.ts`
Extend `makeMockPage()` with `waitForLoadState` + `waitForSelector`. YAML `{ waitForLoad: null }`.

#### UT2 (B): `{ waitForLoad: {} }` (empty object, no selector key) → networkidle branch
**AC:** AC1 | **File:** `recorder-app/src/flowReplayer.test.ts`
Edge case: `{}` vs `null` in YAML — both should produce no-selector result.

#### UT3 (B): `{ waitForLoad: { selector: 42 } }` (non-string) coerces to `"42"` via String(val)
**AC:** AC2 | **File:** `recorder-app/src/flowReplayer.test.ts`

#### UT4 (B): `{ waitForLoad: { selector: "" } }` (empty string) → networkidle branch (falsy guard)
**AC:** AC1/AC2 | **File:** `recorder-app/src/flowReplayer.test.ts`

#### UT5 (B): Selector mode does NOT call `waitForLoadState`
**AC:** AC2 | **File:** `recorder-app/src/flowReplayer.test.ts`

#### UT6 (B): `waitForLoadState` rejection → error includes `[replay] FAILED` + `waitForLoad` + filename
**AC:** AC3 | **File:** `recorder-app/src/flowReplayer.test.ts`

#### UT7 (B): `waitForSelector` rejection → same error wrapping as UT6
**AC:** AC3 | **File:** `recorder-app/src/flowReplayer.test.ts`

#### UT8 (B): Command after failed `waitForLoad` is never dispatched (goto not called)
**AC:** AC3 | **File:** `recorder-app/src/flowReplayer.test.ts`

#### UT9 (B): Timeout value is exactly 30000 — pinned via `expect.objectContaining({ timeout: 30000 })`
**AC:** AC1/AC2 | **File:** `recorder-app/src/flowReplayer.test.ts`

### Integration tests

#### IT1 (B): networkidle mode resolves on static page (real browser)
**AC:** AC5 | Note: can be mocked in flowReplayer.test.ts

#### IT2 (B): Selector mode — pre-existing element resolves immediately
**AC:** AC5

#### IT3 (B): Selector added by JS after 400ms delay resolves before 30s
**AC:** AC5

#### IT4 (B): Element never appears → passed: false, message matches `/timeout|TimeoutError/i` (30s, @slow)
**AC:** AC3/AC5

#### IT5 (B): `waitForLoad` failure halts subsequent commands — only 1 CommandResult
**AC:** AC3/AC5

### Reporter tests (B)

**RT1-RT6:** Console/HTML/Markdown render `waitForLoad` correctly, with negative guards:
- No `"waitForLoad: undefined"` for no-selector case
- HTML-special chars (e.g. `div>p`) are HTML-escaped
- Pipe `|` in selector is escaped for Markdown tables

---

## Tests

### Attribution

| Test ID | Description | Generator A | Generator B |
|---|---|---|---|
| T49 | `executeWaitForLoad` no selector → networkidle, not waitForSelector | ✓ | ✓ |
| T50 | `executeWaitForLoad` with selector → waitForSelector, not waitForLoadState | ✓ | ✓ |
| T51 | no-selector timeout propagates matching `/timeout/i` | ✓ | — |
| T52 | selector timeout propagates matching `/timeout/i` | ✓ | — |
| T53 | empty object `{}` payload → networkidle (falsy guard) | — | ✓ |
| T54 | numeric selector `42` coerced to `"42"` via String() | — | ✓ |
| T55 | empty-string selector `""` → networkidle falsy branch | — | ✓ |
| T56 | parseCommand `{waitForLoad:null}` → `{type:'waitForLoad'}`, no selector key | ✓ | — |
| T57 | parseCommand `{waitForLoad:{selector:'#main-content'}}` → selector set | ✓ | — |
| T58 | parseCommand `{waitForLoad:{selector:''}}` round-trips without throwing | ✓ | — |
| T59 | replayFlows networkidle mock path → passed:true | ✓ | — |
| T60 | replayFlows selector mock path → passed:true | ✓ | — |
| T61 | waitForLoadState rejection → error contains `[replay] FAILED` + filename + `/timeout/i` | ✓ | ✓ |
| T62 | waitForSelector rejection → same error wrapping | — | ✓ |
| T63 | failed waitForLoad aborts flow; next command never dispatched | — | ✓ |
| T64 | Console: passed no-selector → `"waitForLoad"`, not `"waitForLoad: undefined"` | ✓ | guard |
| T65 | Console: passed with selector → `"waitForLoad: #selector"` | ✓ | — |
| T66 | Console: failed → `✗` + error message | ✓ | — |
| T67 | HTML: no-selector → `"waitForLoad"`, not `"waitForLoad: undefined"` | ✓ | guard |
| T68 | HTML: with selector → `"waitForLoad: #main-content"` | ✓ | — |
| T69 | HTML: selector with `<>&` → HTML-escaped | — | ✓ |
| T70 | Markdown: no-selector → `"waitForLoad"`, not `"waitForLoad: undefined"` | ✓ | guard |
| T71 | Markdown: with selector → `"waitForLoad: #main-content"` | ✓ | — |
| T72 | Markdown: selector with `|` → pipe escaped | — | ✓ |

**Unique to A:** 11  **Unique to B:** 7  **Shared:** 6  **Total after dedup:** 24

### Consolidated test plan

#### `packages/core/src/commands.test.ts` (new file) — T49–T55

| ID | Seam | Assertion |
|---|---|---|
| T49 | `executeWaitForLoad(page)` — `waitForLoadState` mock resolves | `waitForLoadState` called `('networkidle',{timeout:30000})`; `waitForSelector` not called |
| T50 | `executeWaitForLoad(page,'#btn')` — `waitForSelector` mock resolves | `waitForSelector` called `('#btn',{state:'visible',timeout:30000})`; `waitForLoadState` not called |
| T51 | `waitForLoadState` rejects `'Timeout 30000ms'` | `executeWaitForLoad` rejects; message matches `/timeout/i` |
| T52 | `waitForSelector` rejects `'Timeout 30000ms'` | `executeWaitForLoad` rejects; message matches `/timeout/i` |
| T53 | `executeWaitForLoad(page, undefined)` | same as T49 (validates empty-object parse path) |
| T54 | `executeWaitForLoad(page, String(42))` | `waitForSelector` called with `'42'` |
| T55 | `executeWaitForLoad(page, '')` — falsy guard | `waitForLoadState` called; `waitForSelector` not called |

#### `recorder-app/src/flowReplayer.test.ts` (append) — T56–T63

**Setup change:** add `waitForLoadState: vi.fn().mockResolvedValue(undefined)` and `waitForSelector: vi.fn().mockResolvedValue(undefined)` to `makeMockPage()`.

| ID | Seam | Assertion |
|---|---|---|
| T56 | `parseCommand({waitForLoad:null})` | deep-equals `{type:'waitForLoad'}`; no `selector` key |
| T57 | `parseCommand({waitForLoad:{selector:'#main-content'}})` | deep-equals `{type:'waitForLoad',selector:'#main-content'}` |
| T58 | `parseCommand({waitForLoad:{selector:''}})` | result deep-equals `{type:'waitForLoad'}` (empty string normalised to no-selector; no `selector` key) |
| T59 | `replayFlows` with `{waitForLoad:null}` | `page.waitForLoadState` called once; no throw |
| T60 | `replayFlows` with `{waitForLoad:{selector:'#main'}}` | `page.waitForSelector` called once with `'#main'` |
| T61 | `waitForLoadState` rejects timeout error | thrown `.message` contains `[replay] FAILED`, `waitForLoad`, filename, `/timeout/i` |
| T62 | `waitForSelector` rejects | thrown `.message` contains `[replay] FAILED`, `waitForLoad`, filename |
| T63 | `waitForLoad` then `tapOn`; `waitForLoadState` rejects | `page._loc.click` never called (arbiter fix: `page.locator` spy is vacuous for text selectors; use `page._loc.click` which executeTapOn always calls) |

#### `uivisor-app/tests/unit/reporter.test.ts` (append) — T64–T72

Add helper: `waitForLoadCmd(selector?: string): Command`

| ID | Seam | Assertion |
|---|---|---|
| T64 | `passedResult(waitForLoadCmd())` → Console | contains `"waitForLoad"`; does NOT contain `"waitForLoad: undefined"` |
| T65 | `passedResult(waitForLoadCmd('#selector'))` → Console | contains `"waitForLoad: #selector"` |
| T66 | `failedResult(waitForLoadCmd())` → Console | contains `✗` and error message |
| T67 | `waitForLoadCmd()` → `generateHtmlReport` | HTML contains `"waitForLoad"`; no `"waitForLoad: undefined"` |
| T68 | `waitForLoadCmd('#main-content')` → `generateHtmlReport` | HTML contains `"waitForLoad: #main-content"` |
| T69 | `waitForLoadCmd('<b>&</b>')` → `generateHtmlReport` | does NOT contain raw `<b>&</b>`; contains escaped form |
| T70 | `waitForLoadCmd()` → `generateMarkdownReport` | contains `"waitForLoad"`; no `"waitForLoad: undefined"` |
| T71 | `waitForLoadCmd('#main-content')` → `generateMarkdownReport` | contains `"waitForLoad: #main-content"` |
| T72 | `waitForLoadCmd('td\|th')` → `generateMarkdownReport` | does NOT contain unescaped `td\|th` in table; contains `\|` |

**Last checkpoint:** tester_consolidator complete at 2026-09-13

---

## Test Results

| Suite | File | Tests | Status |
|---|---|---|---|
| Core unit | `packages/core/src/commands.test.ts` | 169/169 (T49–T55 new) | ✓ PASS |
| Replayer unit | `recorder-app/src/flowReplayer.test.ts` | 22/22 (T56–T63 new) | ✓ PASS |
| Reporter unit | `uivisor-app/tests/unit/reporter.test.ts` | 38/39 (T64–T72 new) | 1 pre-existing fail (AC61) |

**New tests:** 24 total — T49–T72 all pass
**Pre-existing failures:** AC61 (screenshot path) — verified on main before this PR; overlay.test.ts failures also pre-existing

---

## Quality Gate

**Verdict:** PASS
**New failures introduced:** 0
**All 5 ACs verified:** ✓
- AC1: networkidle mode dispatched with 30s timeout ✓
- AC2: selector mode dispatched with 30s timeout ✓
- AC3: timeout propagates as thrown error ✓
- AC4: all 3 reporters label correctly ✓
- AC5: 24 tests across 3 files covering both modes + timeout path ✓

---

## Build Check

**Verdict:** PASS
**Manifests found:** packages/core/package.json, recorder-app/package.json, uivisor-app/package.json
**Smoke tests:** N/A (TypeScript project — compiled at test time by Vitest)
**TypeScript:** Clean on packages/core; one pre-existing error in recorder-app/src/cli.test.ts:141 (confirmed on main before this PR)
**All 7 required locations updated:** ✓ types.ts, commands.ts, index.ts, flowReplayer.ts (parse+dispatch+import), console.ts, html.ts, markdown.ts
**Blocking findings:** none

**Last checkpoint:** quality gate + build verifier PASS at 2026-09-13

## Worktree
**Path:** .worktrees/feat-wait-for-dynamic-page-load
**Branch:** feat-wait-for-dynamic-page-load
**Created:** 2026-09-13
**Status:** active
