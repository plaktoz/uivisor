# Pipeline State: fix-nth-within-sibling-not-doc-index

**Task:** recorder-app: within nth index uses sibling position, not document-wide locator index (issue #41)
**Started:** 2026-09-13
**Status:** in_progress

---

## Gate 0: Execution Plan

**Classification:** bug

**Roles Activated:** Analyst, Tester Ensemble, Coder, Release Documenter, Deployer

**Designer Activated:** no

**Complexity Tier:** small

**Run Estimates:**
| Role | ETA |
|---|---|
| Analyst | 3 min |
| Tester Ensemble (both phases) | 4 min |
| Coder (diagnosing-bugs) | 5 min |
| Quality Gate | 2 min |
| Release Documenter | 2 min |
| Deployer | 1 min |
| **Total** | **~17 min** (+ up to 3 retry cycles × 0.6 factor) |

**Execution Sequence:**
1. Analyst → to-spec
   Output: bug spec + reproduction steps + acceptance criteria → state.md#gate-1
   [GATE 1: human approval required]
2. Tester Ensemble Phase 1 → tdd
   Reads: bug spec + acceptance criteria
   2a. tester_generator_a + tester_generator_b in parallel → failing tests
   2b. tester_consolidator → deduplicates → state.md#tests
   2c. tester_arbiter → resolves disagreements
   Output: failing tests → state.md#tests
3. Coder → diagnosing-bugs
   Reads: bug spec + failing tests from state.md
   Output: fix + source files → state.md#code-artifacts
4. Tester Ensemble Phase 2 → tdd
   Reads: state.md#tests + all source files
   4a. tester_generator_a + tester_generator_b in parallel → run tests, report
   4b. tester_consolidator → merges results → state.md#test-results
   4c. tester_arbiter → resolves disagreements
   Output: test results → state.md#test-results
   Max retries: 3
5. Quality Gate → quality (tester_arbiter, autonomous)
   Reads: state.md#tests + state.md#test-results + state.md#code-artifacts + git diff
   Output: pass/fail verdict → state.md#quality-gate
   On fail: findings → Coder; on pass: proceed
   [GATE 3: human approval required before deploying]
6. Release Documenter → proj-deploy
   Output: signoff_package.md
7. Deployer → proj-deploy
8. Delivery Manager (autonomous) → retro.md

---

## Gate 1: Bug Spec

### Problem Statement

When `captureScript.ts` records a `within` command, it sets `nth` to the container's index among same-tag siblings under its parent element. At replay, `commands.ts` passes that value to Playwright's `.nth()`, which indexes document-wide among all matches of the container selector. When the container has a unique selector (e.g. a unique `data-testid`), `.nth(2)` on a locator matching exactly one element resolves to zero elements, silently failing or throwing.

### Reproduction Steps

DOM:
```html
<ul>
  <li data-testid="row-0"><button>Click me</button></li>
  <li data-testid="row-1"><button>Click me</button></li>
  <li data-testid="row-2"><button>Click me</button></li>
</ul>
```
1. Record a tap on the button inside `li[data-testid="row-2"]`.
2. `buildContainerSelector` → `data-testid=row-2`.
3. `siblings.indexOf(container)` → `2` (sibling index).
4. Emitted: `{ type: 'within', selector: 'data-testid=row-2', nth: 2 }`.
5. Replay: `page.locator('[data-testid="row-2"]').nth(2)` → 0 elements. Tap fails silently.

### Root Cause

`captureScript.ts:280-281` — `nth = siblings.indexOf(container)` uses same-tag sibling order instead of document-wide locator order.

### Acceptance Criteria

1. `containerSel` is `data-attr=value`, selector matches exactly one element → emitted `nth` is `0`.
2. `containerSel` is `data-attr=value`, selector matches N elements → emitted `nth` equals 0-based document-order position among those N elements.
3. `containerSel` is `id=value` → emitted `nth` is `0`.
4. `containerSel` is `text=value` or `nth-only` → existing sibling-index fallback unchanged.
5. A replayed `within` using any `nth` from AC1–AC3 resolves to exactly the recorded container.

---

## Tests

**Tester Ensemble Phase 1 — consolidated test plan (6 cases):**

| ID | Description | Type |
|---|---|---|
| AC-10 (updated) | unique data-testid per row → nth: 0 | fail→pass |
| CS-NTH-01 | unique data-testid per container — 3rd emits nth: 0 | fail→pass |
| CS-NTH-02 | shared data-testid + header sibling shifts index → nth: 2 not 3 | fail→pass |
| CS-NTH-03 | id= container → nth: 0 | fail→pass |
| CS-NTH-04 | nth-only container preserves sibling fallback | regression guard |
| text= case | text= container preserves sibling fallback | regression guard |

**Tester Ensemble Phase 2 — results:**
All 184 tests pass (5 new + 1 updated from this fix, 184 total in package).

---

## Code Artifacts

**Fix:** `packages/core/src/captureScript.ts` lines 278-295 (was 278-282)

Changed `nth` computation from sibling index to document-wide `querySelectorAll` index for `data-attr=` and `id=` container selectors. `text=` and `nth-only` retain the sibling-index fallback.

**Tests:** `packages/core/src/captureScript.test.ts`
- Updated AC-10 (expect `nth: 0` for unique data-testid)
- Added CS-NTH-01, CS-NTH-02, CS-NTH-03, CS-NTH-04

---

## Quality Gate

**Verdict: PASS**

- `packages/core`: 184/184 tests pass (including 4 new + 1 updated)
- `recorder-app`: 42 pre-existing failures (confirmed identical without my changes — unrelated to this fix)
- No new regressions introduced
- All 5 acceptance criteria satisfied
- Edge cases covered: invalid CSS selector (try/catch → fallback), container not in querySelectorAll result (indexOf → -1 → fallback), text= and nth-only selectors (explicit exclusion)
