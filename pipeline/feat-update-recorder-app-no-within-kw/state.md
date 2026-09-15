# Pipeline State: feat-update-recorder-app-no-within-kw

**Task:** update recorder-app to not record using within keyword
**Started:** 2026-09-15
**Status:** in_progress

## Worktree
**Path:** .worktrees/feat-update-recorder-app-no-within-kw
**Branch:** feat-update-recorder-app-no-within-kw
**Created:** 2026-09-15
**Status:** active

## Gate 0: Execution Plan

**Classification:** feature
**Complexity:** small

**Roles Activated:** Analyst, Architect, Tester Ensemble, Coder, Release Documenter, Deployer
**Designer Activated:** no

### Context

The `within` command is a YAML DSL construct that wraps a nested action inside a scoped container. The recorder in `packages/core/src/captureScript.ts` currently emits `within` via two distinct paths:

**Path 1 — proactive (removed by this task):** Detects "repeating containers" (tr, li, role=row/listitem, or a parent with ≥2 same-tag children) and wraps the tapOn in a `within` block with an `nth` index, regardless of whether the inner selector is unique.

**Path 2 — reactive (preserved by this task):** When no repeating container is found but the clicked element's pipe selector matches more than one element in the document, walks up the ancestor tree to find the first ancestor that scopes the selector to exactly one match. If found, emits `within` without `nth`. If not found, falls back to `buildCssFallback`.

**What changes:**
- Remove `isSemanticRepeater`, `countBasedSiblings`, `findSemanticContainer`, `findCountBasedContainer`, `findRepeatingContainer` from `captureScript.ts`
- Remove the `findRepeatingContainer(el)` call and `nth` calculation from the click handler
- Reactive path (`countMatchingElements` → `findAncestorThatUniquesEl` → `within` without `nth`) stays exactly as-is
- CSS fallback for unresolvable duplicates stays exactly as-is

**Files in scope:**
- `packages/core/src/captureScript.ts` — remove path-1 functions and path-1 branch from click handler
- `packages/core/src/captureScript.test.ts` — update path-1 tests (AC-8a/b/c/d, AC-9a, AC-10, CS-NTH-01–04, AC-11, AC-16, AC-17, BC-01–08, BC-PC-01) from `type: 'within'` to `type: 'tapOn'`; reactive-path tests (AC-13, AC-15, AC-28, AC-29) unchanged

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
       → copy generator_a raw output to state.md#tests-generator-a
       → copy generator_b raw output to state.md#tests-generator-b
   3b. tester_consolidator → reads both sections, deduplicates → state.md#tests
   3c. tester_arbiter → resolves any generator disagreements
4. Coder → skill: implement
   Reads: spec + tests from state.md
   Working directory: .worktrees/feat-update-recorder-app-no-within-kw
   Output: source files → state.md#code-artifacts
5. Orchestrator — commit pipeline state into worktree (autonomous, no gate)
6. Tester Ensemble Phase 2 → skill: tdd + code-review
   Reads: state.md#tests + all source files
   6a. tester_generator_a + tester_generator_b in parallel → each runs tests and reports
   6b. tester_consolidator → merges results → state.md#test-results
   6c. tester_arbiter → resolves disagreements; escalates critical failures to human
7. Quality Gate → skill: quality (tester_arbiter, autonomous)
   Output: pass/fail verdict → state.md#quality-gate
8. Release Documenter → skill: proj-deploy
   Output: signoff_package.md
9. Deployer → skill: proj-deploy
10. Delivery Manager (autonomous) → pipeline/feat-update-recorder-app-no-within-kw/retro.md

**Gate 0 Status:** APPROVED 2026-09-15

## Gate 1: Spec

### Summary

Remove the five "proactive repeating container" (path-1) helper functions and the corresponding branch from the click handler in `captureScript.ts`, leaving the "reactive duplicate-selector" path (path 2) as the sole `within`-emission logic. Update all path-1-triggered tests to reflect the new behavior; path-2 tests and all non-click tests are unchanged.

### Acceptance Criteria

**AC-R1:** `captureScript.ts` no longer contains the functions `isSemanticRepeater`, `countBasedSiblings`, `findSemanticContainer`, `findCountBasedContainer`, or `findRepeatingContainer`.

**AC-R2:** The click handler in `captureScript.ts` no longer calls `findRepeatingContainer`, computes an `nth` index, or constructs or emits a `within` command that includes an `nth` field. The path-2 duplicate-selector check (`countMatchingElements` → `findAncestorThatUniquesEl`) is now the first and only logic for deciding whether to emit `within`.

**AC-R3:** When a clicked element's pipe selector matches more than one element in the document and a document-unique ancestor is found by walking up the DOM, the recorder emits a `within` command whose `selector` is the ancestor's pipe selector and whose `do` array contains a `tapOn` with the element's pipe selector — with no `nth` field — identical to the existing path-2 behavior.

**AC-R4:** When a clicked element's pipe selector is non-unique and no document-unique ancestor exists, the recorder falls back to `buildCssFallback(el)` and emits a plain `tapOn` with a `css=tag:nth-child(N)` selector — unchanged from the current fallback behavior.

**AC-R5:** Tests AC-8a, AC-8b, AC-8c, AC-8d, AC-9a, AC-11, AC-16, AC-17, BC-01, BC-03, BC-04, BC-05, BC-06, BC-07, BC-08, and BC-PC-01 are updated from asserting `type: 'within'` to asserting `type: 'tapOn'` with the clicked element's own unique pipe selector (e.g., `data-testid=tr-btn`, `text=Delete`). No `within` wrapper or `nth` field is present in any of these results.

**AC-R6:** Tests AC-10, CS-NTH-01, and CS-NTH-03 remain `type: 'within'` but are updated to remove the `nth` field. The `selector` on the `within` command is the unique `data-testid` or `id` of the containing row element found by path 2. The inner `do` array contains a `tapOn` with the shared button selector (`data-testid=action` or `text=Action`).

**AC-R7:** Test CS-NTH-02 remains `type: 'within'` but is updated to remove the `nth` field. Although the container's `data-testid=shared-row` appears on multiple `<li>` elements, path 2 still finds it as the first ancestor within which `text=Action` resolves to exactly one match, so `within selector: data-testid=shared-row` is emitted without `nth`.

**AC-R8:** Test CS-NTH-04 remains `type: 'within'` but is updated to remove the `nth` field. The DOM constructs 3 bare `<div>` rows (loop `i = 0..2`) each containing `<button data-testid=nth-action>`, so `data-testid=nth-action` matches 3 elements and is non-unique. Path 2 fires, walks up to the immediate parent bare `<div>` (no attrs, no text → `css=div`), and emits `within { selector: 'css=div', do: [tapOn { selector: 'data-testid=nth-action' }] }` with `nth` ABSENT.

**AC-R9:** Tests AC-12, AC-13, AC-14, AC-15, AC-28, AC-29, and all tests in the AC-24–AC-34 duplicate-text-disambiguation group are unchanged in both expected type and selector. These tests exercise path 2 directly and must continue to pass without modification.

**AC-R10:** All non-click event tests — covering `input`, `blur`, `change`, `keydown`, navigation events, and cross-origin iframe detection — are unchanged and must continue to pass.

**AC-R11:** No changes are made to `flowReplayer.ts`, `yamlWriter.ts`, `types.ts`, or `playwrightLocator.ts`. The `within` command type and its schema remain in place for path-2 use; only the recorder's path-1 emission is removed.

**Gate 1 Status:** APPROVED 2026-09-15

## Run Estimates

**Complexity:** small
**Duration:** ~21–36 min  (no retries: ~21 min)
**Cost:** ~$0.22–$0.42  (cap: $5.00)
**Tokens:** ~30K–75K

**Retry budgets:**
- TDD + quality gate: 3 rounds
- Spec revision: 2 rounds
- Design revision: n/a (Designer not activated)
- Code review: 2 rounds

## Feature & Task Breakdown

| Task ID | Description | File | Dependencies | Status |
|---------|-------------|------|--------------|--------|
| T1 | Remove path-1 functions (`isSemanticRepeater`, `countBasedSiblings`, `findSemanticContainer`, `findCountBasedContainer`, `findRepeatingContainer`) and simplify the click handler: remove the `findRepeatingContainer(el)` call, remove the `reactiveContainer` boolean and its guard, remove the nth-calculation block and `within`-with-nth emission. Promote path-2 logic (currently nested inside `if (!container)`) to be the first and only check. | `packages/core/src/captureScript.ts` | none | open |
| T2 | Update test expectations per spec AC-R5 through AC-R8: change path-1-triggered tests (AC-8a/b/c/d, AC-9a, AC-10, CS-NTH-01–04, AC-11, AC-16, AC-17, BC-01–08, BC-PC-01) to assert `type: 'tapOn'` or updated `within` without `nth` as specified. Path-2 tests (AC-12, AC-13, AC-14, AC-15, AC-28, AC-29) and all non-click tests are unchanged. | `packages/core/src/captureScript.test.ts` | T1 | open |

## Tests — Generator A (tester_generator_a)

**TG-A-01** AC-R5 | DOM: tr>td>button[data-testid=tr-btn] | click button | UPDATE AC-8a → tapOn { selector: 'data-testid=tr-btn' }
**TG-A-02** AC-R5 | DOM: ul>li[data-testid=list-row]>button[data-testid=li-btn] | click button | UPDATE AC-8b → tapOn { selector: 'data-testid=li-btn' }
**TG-A-03** AC-R5 | DOM: div[role=row][data-testid=role-row]>button[data-testid=row-btn] | click button | UPDATE AC-8c → tapOn { selector: 'data-testid=row-btn' }
**TG-A-04** AC-R5 | DOM: div[role=listitem][data-testid=role-listitem]>button[data-testid=li-inner-btn] | click button | UPDATE AC-8d → tapOn { selector: 'data-testid=li-inner-btn' }
**TG-A-05** AC-R5 | DOM: div>div>button[data-testid=count-btn] + sibling div | click button | UPDATE AC-9a → tapOn { selector: 'data-testid=count-btn' }
**TG-A-06** AC-R5 | DOM: ul>li[data-testid=the-row]>button[data-testid=inner-action] | click button | UPDATE AC-11 → tapOn { selector: 'data-testid=inner-action' }
**TG-A-07** AC-R5 | DOM: div[role="row grid"][data-testid=multi-role]>button[data-testid=multi-role-btn] | click button | UPDATE AC-16 → tapOn { selector: 'data-testid=multi-role-btn' }
**TG-A-08** AC-R5 | DOM: ul>li[data-testid=direct-li] | click li directly | UPDATE AC-17 → tapOn { selector: 'data-testid=direct-li' }
**TG-A-09** AC-R5 | DOM: ul>li>button[data-testid=icon-action] (bare li) | click button | UPDATE BC-01 → tapOn { selector: 'data-testid=icon-action' }
**TG-A-10** AC-R5 | DOM: table>tbody>tr>td>button[data-testid=tr-action] (bare tr) | click button | UPDATE BC-03 → tapOn { selector: 'data-testid=tr-action' }
**TG-A-11** AC-R5 | DOM: section>div>button[data-testid=div-action] + sibling div | click button | UPDATE BC-04 → tapOn { selector: 'data-testid=div-action' }
**TG-A-12** AC-R5 | DOM: div>section>button[data-testid=sec-btn] + sibling section | click button | UPDATE BC-05 → tapOn { selector: 'data-testid=sec-btn' }
**TG-A-13** AC-R5 | DOM: ul>li(whitespace text)>button[data-testid=ws-only-btn] | click button | UPDATE BC-06 → tapOn { selector: 'data-testid=ws-only-btn' }
**TG-A-14** AC-R5 | DOM: ul>3 bare li each with button[data-testid=icon-btn-{i}] | click first button | UPDATE BC-07 → tapOn { selector: 'data-testid=icon-btn-0' }
**TG-A-15** AC-R5 | DOM: ul>4 bare li each with button[data-testid=last-icon-{i}] | click last button | UPDATE BC-08 → tapOn { selector: 'data-testid=last-icon-3' }
**TG-A-16** AC-R5 | DOM: ul>li>button{Delete} (bare li, text-only button) | click button | UPDATE BC-PC-01 → tapOn { selector: 'text=Delete' }
**TG-A-17** AC-R6 | DOM: ul>3 li[data-testid=row-{i}] each with button[data-testid=action] | click 3rd button | UPDATE AC-10 → within { selector: 'data-testid=row-2', do: [tapOn data-testid=action] } — nth ABSENT
**TG-A-18** AC-R6 | DOM: ul>3 li[data-testid=unique-row-{i}] each with button{Action} | click 3rd button | UPDATE CS-NTH-01 → within { selector: 'data-testid=unique-row-2', do: [tapOn text=Action] } — nth ABSENT
**TG-A-19** AC-R6 | DOM: ul>3 li[id=id-row-{i}] each with button{Action} | click 3rd button | UPDATE CS-NTH-03 → within { selector: 'id=id-row-2', do: [tapOn text=Action] } — nth ABSENT
**TG-A-20** AC-R7 | DOM: ul>header-li + 3 li[data-testid=shared-row] each with button{Action} | click 3rd shared-row button | UPDATE CS-NTH-02 → within { selector: 'data-testid=shared-row', do: [tapOn text=Action] } — nth ABSENT
**TG-A-21** AC-R8 | DOM: parent div > 1 child div > button[data-testid=nth-action] (unique) | click button | UPDATE CS-NTH-04 → tapOn { selector: 'data-testid=nth-action' } [NOTE: describes 1-row DOM; see discrepancy with TG-B-13]
**TG-A-22** AC-R9 | DOM: section[id=section-a]>button[data-testid=shared-action] + footer>same | click section button | VERIFY UNCHANGED AC-13 → within { selector: 'id=section-a' }
**TG-A-23** AC-R9 | DOM: div[data-unique=yes]>button[data-testid=reactive-btn] + footer>same | click div button | VERIFY UNCHANGED AC-15 → within, nth ABSENT
**TG-A-24** AC-R9 | DOM: 2 button[data-testid=bare-dup] at body level | click first | VERIFY UNCHANGED AC-14 → tapOn css= fallback
**TG-A-25** AC-R1/R2 | DOM: none | inspect CAPTURE_SCRIPT string | NEW → CAPTURE_SCRIPT must NOT contain: isSemanticRepeater, countBasedSiblings, findSemanticContainer, findCountBasedContainer, findRepeatingContainer

## Tests — Generator B (tester_generator_b)

**TG-B-01** AC-R5 | DOM: ul>li[data-testid=direct-row] | click li directly | UPDATE AC-17 → tapOn { selector: 'data-testid=direct-row' }
**TG-B-02** AC-R5/R8 | DOM: div>div[row1]>button[data-testid=unique-btn] + div[row2] | click button | UPDATE AC-9a → tapOn { selector: 'data-testid=unique-btn' }
**TG-B-03** AC-R5 | DOM: table>tbody>tr>td>button[data-testid=tr-btn] | click button | UPDATE AC-8a → tapOn { selector: 'data-testid=tr-btn' }
**TG-B-04** AC-R5 | DOM: div[role=row][data-testid=role-row]>button[data-testid=row-btn] | click button | UPDATE AC-8c → tapOn { selector: 'data-testid=row-btn' }
**TG-B-05** AC-R5 | DOM: div[role="row grid"][data-testid=multi-role]>button[data-testid=multi-role-btn] | click button | UPDATE AC-16 → tapOn { selector: 'data-testid=multi-role-btn' }
**TG-B-06** AC-R5 | DOM: ul>li>button[data-testid=icon-action] (bare li) | click button | UPDATE BC-01 → tapOn { selector: 'data-testid=icon-action' }
**TG-B-07** AC-R5 | DOM: div>section>button[data-testid=sec-btn] + sibling section | click button | UPDATE BC-05 → tapOn { selector: 'data-testid=sec-btn' }
**TG-B-08** AC-R5 | DOM: ul>li(whitespace)>button[data-testid=ws-only-btn] | click button | UPDATE BC-06 → tapOn { selector: 'data-testid=ws-only-btn' }
**TG-B-09** AC-R5 | DOM: ul>li>button{Delete} | click button | UPDATE BC-PC-01 → tapOn { selector: 'text=Delete' }
**TG-B-10** AC-R6 | DOM: 3×li[data-testid=row-N] each with button[data-testid=action] | click 3rd | UPDATE AC-10/CS-NTH-01 → within { selector: 'data-testid=row-2', do: [tapOn data-testid=action] } — no nth
**TG-B-11** AC-R6 | DOM: 3×li[id=id-row-N] each with button{Action} | click 3rd | UPDATE CS-NTH-03 → within { selector: 'id=id-row-2', do: [tapOn text=Action] } — no nth
**TG-B-12** AC-R7 | DOM: header-li + 3×li[data-testid=shared-row]>button{Action} | click 3rd | UPDATE CS-NTH-02 → within { selector: 'data-testid=shared-row', do: [tapOn text=Action] } — no nth
**TG-B-13** AC-R7 | DOM: parent>3×bare div each with button[data-testid=nth-action] | click 3rd | UPDATE CS-NTH-04 → within { selector: 'css=div', do: [tapOn data-testid=nth-action] } — no nth [DISAGREES with TG-A-21: B says within-without-nth because data-testid=nth-action is non-unique (3 matches), path-2 fires and finds bare div ancestor]
**TG-B-14** AC-R1/R2 | static string inspection | NEW → CAPTURE_SCRIPT must NOT contain findRepeatingContainer, isSemanticRepeater, findCountBasedContainer, countBasedSiblings
**TG-B-15** AC-R9 | VERIFY UNCHANGED AC-13 → within { selector: 'id=section-a' }
**TG-B-16** AC-R9 | VERIFY UNCHANGED AC-15 → within, nth absent
**TG-B-17** AC-R9/R4 | VERIFY UNCHANGED AC-14 → tapOn css= fallback
**TG-B-18** AC-R9 | VERIFY UNCHANGED AC-28 → within { selector: 'id=form-a', do: [tapOn text=Cancel] } — no nth
**TG-B-19** AC-R10 | DOM: ul>li[role=listitem]>select[data-testid=sel] | fire change event | NEW → selectOption { selector: {testId:'sel'}, value:'X' } — change handler unaffected
**TG-B-20** AC-R5 edge | DOM: ul>li (no attrs, no text) | click li directly | NEW → tapOn { selector: 'css=li:nth-child(1)' } — bare li, no pipe attrs, css= fallback
**TG-B-21** AC-R5 | DOM: div>2 sibling divs, each with distinct unique button | click each | NEW → both tapOn with unique selector; no within emitted

## Tests

### Attribution Table

| AC | Generator A | Generator B |
|---|---|---|
| AC-R1 (no path-1 functions in source) | ✓ (TG-A-25) | ✓ (TG-B-14) |
| AC-R2 (no nth emission in click handler) | ✓ (TG-A-25) | ✓ (TG-B-14) |
| AC-R5 (16 tapOn flips: AC-8a/b/c/d, AC-9a, AC-11, AC-16, AC-17, BC-01, BC-03–08, BC-PC-01) | ✓ all 16 (TG-A-01–16) | ✓ partial — 8 of 16: TG-B-01–09 (AC-8a/8c/9a/16/17/BC-01/BC-05/BC-06/BC-PC-01) |
| AC-R6 (AC-10, CS-NTH-01, CS-NTH-03 → within no nth) | ✓ (TG-A-17–19) | ✓ (TG-B-10–11) |
| AC-R7 (CS-NTH-02 → within no nth) | ✓ (TG-A-20) | ✓ (TG-B-12) |
| AC-R8 (CS-NTH-04 update) | ✓ (TG-A-21) — **CONFLICT** | ✓ (TG-B-13) — **CONFLICT** |
| AC-R9 (AC-13, AC-14, AC-15, AC-28, AC-29 unchanged) | ✓ partial: AC-13/14/15 (TG-A-22–24) | ✓ partial: AC-13/14/15/28 (TG-B-15–18) |
| AC-R10 (non-click events unchanged) | — | ✓ (TG-B-19) |
| AC-R11 (no changes to other files) | — | — |

### Consolidated Test List

**TC-01** | AC-R1/R2 | NEW | Inspect the compiled CAPTURE_SCRIPT string — must NOT contain `isSemanticRepeater`, `countBasedSiblings`, `findSemanticContainer`, `findCountBasedContainer`, or `findRepeatingContainer`; no `nth` field or `within`-with-nth block present in the click handler

**TC-02** | AC-R5 | UPDATE AC-8a | `tapOn { selector: 'data-testid=tr-btn' }` — path-1 `within` wrapper removed; button selector is document-unique

**TC-03** | AC-R5 | UPDATE AC-8b | `tapOn { selector: 'data-testid=li-btn' }` — path-1 `within` wrapper removed; button selector is document-unique

**TC-04** | AC-R5 | UPDATE AC-8c | `tapOn { selector: 'data-testid=row-btn' }` — path-1 `within` wrapper removed; button selector is document-unique

**TC-05** | AC-R5 | UPDATE AC-8d | `tapOn { selector: 'data-testid=li-inner-btn' }` — path-1 `within` wrapper removed; button selector is document-unique

**TC-06** | AC-R5 | UPDATE AC-9a | `tapOn { selector: 'data-testid=count-btn' }` — count-based sibling container check removed; button selector is document-unique

**TC-07** | AC-R5 | UPDATE AC-11 | `tapOn { selector: 'data-testid=inner-action' }` — path-1 `within` wrapper removed; button selector is document-unique despite container li having multiple attrs

**TC-08** | AC-R5 | UPDATE AC-16 | `tapOn { selector: 'data-testid=multi-role-btn' }` — path-1 multi-role container check removed; button selector is document-unique

**TC-09** | AC-R5 | UPDATE AC-17 | `tapOn { selector: 'data-testid=direct-li' }` — path-1 `within` wrapper removed; li clicked directly, selector is document-unique

**TC-10** | AC-R5 | UPDATE BC-01 | `tapOn { selector: 'data-testid=icon-action' }` — bare li no longer triggers path-1; button selector is document-unique

**TC-11** | AC-R5 | UPDATE BC-03 | `tapOn { selector: 'data-testid=tr-action' }` — bare tr no longer triggers path-1; button selector is document-unique

**TC-12** | AC-R5 | UPDATE BC-04 | `tapOn { selector: 'data-testid=div-action' }` — sibling-count div no longer triggers path-1; button selector is document-unique

**TC-13** | AC-R5 | UPDATE BC-05 | `tapOn { selector: 'data-testid=sec-btn' }` — sibling section no longer triggers path-1; button selector is document-unique

**TC-14** | AC-R5 | UPDATE BC-06 | `tapOn { selector: 'data-testid=ws-only-btn' }` — whitespace-only li text no longer triggers path-1; button selector is document-unique

**TC-15** | AC-R5 | UPDATE BC-07 | `tapOn { selector: 'data-testid=icon-btn-0' }` — first of 3 bare-li buttons; path-1 removed; selector is document-unique

**TC-16** | AC-R5 | UPDATE BC-08 | `tapOn { selector: 'data-testid=last-icon-3' }` — last of 4 bare-li buttons; path-1 removed; selector is document-unique

**TC-17** | AC-R5 | UPDATE BC-PC-01 | `tapOn { selector: 'text=Delete' }` — bare li text-only button; path-1 removed; text selector is document-unique

**TC-18** | AC-R6 | UPDATE AC-10 | `within { selector: 'data-testid=row-2', do: [tapOn { selector: 'data-testid=action' }] }` — nth field ABSENT; path-2 fires because `data-testid=action` matches 3 elements; `data-testid=row-2` is document-unique ancestor

**TC-19** | AC-R6 | UPDATE CS-NTH-01 | `within { selector: 'data-testid=unique-row-2', do: [tapOn { selector: 'text=Action' }] }` — nth field ABSENT; path-2 fires; per-row data-testid is document-unique

**TC-20** | AC-R6 | UPDATE CS-NTH-03 | `within { selector: 'id=id-row-2', do: [tapOn { selector: 'text=Action' }] }` — nth field ABSENT; path-2 fires; row id is document-unique

**TC-21** | AC-R7 | UPDATE CS-NTH-02 | `within { selector: 'data-testid=shared-row', do: [tapOn { selector: 'text=Action' }] }` — nth field ABSENT; `data-testid=shared-row` appears on multiple lis but is the first ancestor within which `text=Action` resolves to exactly 1 match

**TC-22** | AC-R8 | UPDATE CS-NTH-04 | `within { selector: 'css=div', do: [tapOn { selector: 'data-testid=nth-action' }] }` — nth field ABSENT; DOM has 3 buttons sharing `data-testid=nth-action` (non-unique); path-2 fires and walks up to the bare div ancestor; `css=div` is emitted because the ancestor has no attrs and no text

**TC-23** | AC-R9 | VERIFY UNCHANGED AC-13 | `within { selector: 'id=section-a', do: [tapOn { selector: 'data-testid=shared-action' }] }` — path-2 already handles this; no change

**TC-24** | AC-R9 | VERIFY UNCHANGED AC-14 | `tapOn { selector: 'css=...' }` — duplicate buttons at body level with no unique ancestor; CSS fallback path unchanged

**TC-25** | AC-R9 | VERIFY UNCHANGED AC-15 | `within { ... }` with no nth — path-2 unchanged

**TC-26** | AC-R9 | VERIFY UNCHANGED AC-28 | `within { selector: 'id=form-a', do: [tapOn { selector: 'text=Cancel' }] }` — path-2 unchanged; nth absent

**TC-27** | AC-R10 | NEW (from TG-B-19) | Bare li containing select; fire `change` event → recorder emits `selectOption` (or appropriate non-click command); change handler is entirely unaffected by path-1 removal

**TC-28** | AC-R5 edge | NEW (from TG-B-20) | Bare `<li>` with no attrs, no text; click li directly → `tapOn { selector: 'css=li:nth-child(1)' }` — CSS fallback fires; no path-1 or path-2 trigger

**TC-29** | AC-R5 | NEW (from TG-B-21) | Two sibling divs each containing a button with a distinct unique data-testid; click each button → both emit `tapOn` with their own unique selector; no `within` emitted for either

### Disagreement for Arbiter

**CS-NTH-04 (TC-22): Generator A (TG-A-21) vs Generator B (TG-B-13)**

- **Generator A says:** UPDATE CS-NTH-04 → `tapOn { selector: 'data-testid=nth-action' }` — argues the button's selector is document-unique and path-2 does not trigger
- **Generator B says:** UPDATE CS-NTH-04 → `within { selector: 'css=div', do: [tapOn { selector: 'data-testid=nth-action' }] }` — argues 3 buttons share `data-testid=nth-action`, so path-2 fires and scopes to the bare-div ancestor

**Actual DOM** (`packages/core/src/captureScript.test.ts` lines 568–586): The test uses `for (let i = 0; i < 3; i++)` to create 3 child rows each containing `btn.setAttribute('data-testid', 'nth-action')`. Three elements therefore match `data-testid=nth-action` in the document, making it non-unique. **Generator B is correct**: path-2 fires (`countMatchingElements` returns 3), `findAncestorThatUniquesEl` walks up to the immediate parent bare `<div>` (no attrs, no text → `css=div`), and emits `within { selector: 'css=div', do: [tapOn data-testid=nth-action] }` without nth. The current test already asserts `cmd.selector === 'css=div'` (line 584) and `cmd.nth === 2` (line 585); the update removes nth, not type.

**Implication for spec:** **AC-R8 is incorrect.** It currently states CS-NTH-04 should be updated to `type: 'tapOn'` with `selector: 'data-testid=nth-action'`. The correct update is `type: 'within'` with `selector: 'css=div'`, `do: [tapOn { selector: 'data-testid=nth-action' }]`, and `nth` ABSENT. The arbiter should revise AC-R8 (and the corresponding Task T2 description) before the Coder implements the test changes.

## Arbiter Verdict

**Dispute:** CS-NTH-04 (TC-22) — Generator A (TG-A-21) vs Generator B (TG-B-13)

**Verdict: Generator B (TG-B-13) is correct.**

**Ground truth from `captureScript.test.ts` lines 568–586:**

The CS-NTH-04 test constructs its DOM via `for (let i = 0; i < 3; i++)`, creating 3 child `<div>` rows each containing a `<button>` with `data-testid=nth-action`. This means `data-testid=nth-action` matches 3 elements in the document — the selector is non-unique.

Generator A described a single-row DOM, which does not reflect the actual test. Its claim that the selector is document-unique is factually wrong.

**How the code will behave after path-1 removal:**

With path-1 removed, path-2 becomes the first check in the click handler. Because `countMatchingElements('data-testid=nth-action')` returns 3, path-2 fires and calls `findAncestorThatUniquesEl`. Walking up from the clicked button: its immediate parent `<div>` row has no attributes and no text content, so its pipe selector is `css=div`. Within that ancestor, `data-testid=nth-action` resolves to exactly 1 match. The recorder therefore emits:

```
within { selector: 'css=div', do: [tapOn { selector: 'data-testid=nth-action' }] }
```

with `nth` **absent** (path-1 is the source of nth; path-2 never emits nth).

The current test already asserts `cmd.type === 'within'` (line 582), `cmd.selector === 'css=div'` (line 584), and `cmd.nth === 2` (line 585). The only change needed is to remove the `expect(cmd.nth).toBe(2)` assertion (or replace it with `expect(cmd.nth).toBeUndefined()`).

**Corrections applied:**

- **AC-R8** updated: CS-NTH-04 stays `type: 'within'`, selector `css=div`, inner `tapOn { selector: 'data-testid=nth-action' }`, `nth` absent.
- **TC-22** updated: reflects the correct `within` result without `nth`.
