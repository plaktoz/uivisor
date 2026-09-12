# Pipeline State: feat-integration-within

**Task:** Create `/integration-within` page in test-app and `flows/integration/within.yaml` covering the `within` command (basic single-container + nth variant).
**Started:** 2026-09-12
**Status:** in_progress

## Worktree
**Path:** .worktrees/feat-integration-within
**Branch:** feat-integration-within
**Created:** 2026-09-12
**Status:** active

---

## Gate 0: Execution Plan

**Classification:** feature
**Complexity:** small — one new React page + one YAML file, no auth/backend changes, follows existing patterns exactly

**Roles Activated:** Analyst, Architect, Tester Ensemble, Coder, Release Documenter, Deployer
**Designer Activated:** no — page reuses identical layout/style tokens from IntegrationTestPage.jsx

**Execution Sequence:**
1. Analyst → skill: to-spec
   Output: spec + acceptance criteria → state.md#gate-1
   [GATE 1: human approval required — revision cap: 2]
2. Architect → skill: to-tickets + codebase-design
   Reads: Gate 1 spec
   Output: feature/task breakdown table → state.md#feature-task-breakdown
3. Tester Ensemble Phase 1 → skill: tdd
   3a. tester_generator_a + tester_generator_b in parallel → generate test cases
       → state.md#tests-generator-a / state.md#tests-generator-b
   3b. tester_consolidator → deduplicates → state.md#tests (with attribution table)
   3c. tester_arbiter → resolves disagreements
4. Coder → skill: implement
   Reads: spec + tests from state.md
   Working directory: .worktrees/feat-integration-within
   Output: source files → state.md#code-artifacts
5. Tester Ensemble Phase 2 → skill: tdd + code-review
   5a. tester_generator_a + tester_generator_b run tests in parallel
   5b. tester_consolidator → merges results → state.md#test-results
   5c. tester_arbiter → resolves disagreements; escalates critical failures
   Output: test results → state.md#test-results
   Retry cap: 3 | Review cap: 2
6. Quality Gate → skill: quality (tester_arbiter, autonomous)
   Output: pass/fail verdict → state.md#quality-gate
7. Build Verifier (autonomous — after Quality Gate PASS)
   Output: pipeline/feat-integration-within/build_check.md
8. Dist Review (autonomous)
9. Release Documenter → skill: proj-deploy
   Output: signoff_package.md
10. Deployer → skill: proj-deploy
    [GATE 3: human approval required before deploying]
11. Delivery Manager (autonomous)
    Output: pipeline/feat-integration-within/retro.md

## Run Estimates

**Complexity:** small
**Duration:** ~21–30 min  (no retries: ~21 min)
**Cost:** ~$0.25–$0.45  (cap: $5.00)
**Tokens:** ~33K–78K

**Retry budgets:**
- TDD + quality gate: 3 rounds
- Spec revision: 2 rounds
- Design revision: n/a (Designer not activated)
- Code review: 2 rounds

---

## Gate 1: Spec

### Overview

This feature adds a dedicated integration test page at `/integration-within` in the `test-app` React application. The page provides two self-contained UI fixtures that exercise the `within` command — one demonstrating basic container scoping (single container, single match) and one demonstrating the `nth` variant (multiple containers sharing the same `testId`, selected by index). A companion flow file `test-app/flows/integration/within.yaml` runs both fixtures end-to-end. The page follows identical layout, class names, and structural conventions as the existing `IntegrationTestPage`.

### Files Changed

| Action | Path |
|---|---|
| Create | `test-app/src/pages/IntegrationWithinPage.jsx` |
| Modify | `test-app/src/App.jsx` |
| Create | `test-app/flows/integration/within.yaml` |

### Page Design — 5 sections

**Section 1 — within (basic)**
- Container: `<div data-testid="int-within-basic-container">`
- Inside: `<button data-testid="int-within-basic-btn">` labelled `"Click inside"`
- Inside (conditional, absent before click): `<p data-testid="int-within-basic-result">` with text `"Within result visible"`
- State: `useState(false)` (`basicClicked`) drives conditional rendering

**Section 2 — within (nth)**
- Two sibling `<div data-testid="int-within-row">` elements
- Each contains `<span data-testid="int-within-row-label">`: first `"Row A"`, second `"Row B"`
- `int-within-row` and `int-within-row-label` intentionally repeat (by design)

**Section 3 — within (input)**
- Container: `<div data-testid="int-within-input-container">`
- Inside: `<input data-testid="int-within-input-field" type="text" placeholder="Type inside…" className={inputCls} />`
- Flow taps the input, types `"scoped input"`, then `assertValue` checks the `.value` property — all scoped inside the container

**Section 4 — within (assertCount)**
- Two sibling containers: `<div data-testid="int-within-count-a">` (2 items) and `<div data-testid="int-within-count-b">` (3 items)
- Each container holds `<li data-testid="int-within-count-item">` elements (2 in `count-a`, 3 in `count-b`)
- Page-level total of `int-within-count-item` is 5; scoped to each container the counts differ (2 vs 3) — proves scoping works
- `int-within-count-item` intentionally repeats across the two containers (5× total)

**Section 5 — within (nested)**
- Outer container: `<div data-testid="int-within-outer">`
- Inner container inside it: `<div data-testid="int-within-inner">`
- Deeply nested element: `<p data-testid="int-within-deep-target">` with text `"Deep target"` (inside `int-within-inner`)
- Flow uses two nested `within` blocks to reach `int-within-deep-target`

### within.yaml (full)

```yaml
appId: ${base}/integration-within
config: config.yml
# Tests: within — container scoping (basic, nth, input, assertCount, nested)
commands:
  - goto: ${base}/integration-within

  # ── Basic within ──────────────────────────────────────────────────────
  - assertNotVisible:
      testId: int-within-basic-result
  - within:
      testId: int-within-basic-container
      do:
        - tapOn:
            testId: int-within-basic-btn
        - assertVisible:
            testId: int-within-basic-result
  - assertVisible:
      testId: int-within-basic-result

  # ── nth within ────────────────────────────────────────────────────────
  - within:
      testId: int-within-row
      nth: 0
      do:
        - assertText:
            testId: int-within-row-label
            expected: Row A
  - within:
      testId: int-within-row
      nth: 1
      do:
        - assertText:
            testId: int-within-row-label
            expected: Row B

  # ── within + inputText + assertValue ─────────────────────────────────
  - within:
      testId: int-within-input-container
      do:
        - tapOn:
            testId: int-within-input-field
        - inputText: "scoped input"
        - assertValue:
            testId: int-within-input-field
            expected: "scoped input"

  # ── within + assertCount (scoped count differs per container) ─────────
  - within:
      testId: int-within-count-a
      do:
        - assertCount:
            css: "[data-testid='int-within-count-item']"
            expected: 2
  - within:
      testId: int-within-count-b
      do:
        - assertCount:
            css: "[data-testid='int-within-count-item']"
            expected: 3

  # ── Nested within ─────────────────────────────────────────────────────
  - within:
      testId: int-within-outer
      do:
        - within:
            testId: int-within-inner
            do:
              - assertText:
                  testId: int-within-deep-target
                  expected: Deep target
```

### Acceptance Criteria

1. Navigating to `/integration-within` renders the page without authentication. `[data-testid="integration-within-page"]` is present.
2. The page `<h1>` text is `"Integration Within Test Page"`.
3. The page renders exactly five `<section>` elements with headings: `"within (basic)"`, `"within (nth)"`, `"within (input)"`, `"within (assertCount)"`, `"within (nested)"`.
4. All six Tailwind class-name constants match `IntegrationTestPage.jsx` identically. Outer wrapper uses `className="max-w-2xl mx-auto px-4 py-8"`.
5. `[data-testid="int-within-basic-container"]` is present and visible on load.
6. `[data-testid="int-within-basic-btn"]` is a DOM descendant of `int-within-basic-container`.
7. Before any click, `[data-testid="int-within-basic-result"]` is **absent from the DOM** (not CSS-hidden).
8. After clicking `int-within-basic-btn`, `int-within-basic-result` appears with text `"Within result visible"` and is a descendant of `int-within-basic-container`.
9. Exactly two `[data-testid="int-within-row"]` elements exist; each contains exactly one `[data-testid="int-within-row-label"]`. First label text is `"Row A"`, second is `"Row B"`.
10. `[data-testid="int-within-input-container"]` is present; `[data-testid="int-within-input-field"]` is a descendant input element with empty initial value.
11. `[data-testid="int-within-count-a"]` contains exactly 2 `[data-testid="int-within-count-item"]` descendants. `[data-testid="int-within-count-b"]` contains exactly 3. Page-level total is 5.
12. `[data-testid="int-within-outer"]` contains `[data-testid="int-within-inner"]` which contains `[data-testid="int-within-deep-target"]` with text `"Deep target"`.
13. `data-testid` values that intentionally repeat: `int-within-row` (×2), `int-within-row-label` (×2), `int-within-count-item` (×5). All others are unique.
14. `IntegrationWithinPage` is imported in `App.jsx` and mounted on `/integration-within` with no auth guard.
15. `test-app/flows/integration/within.yaml` exists with `appId: ${base}/integration-within` and `config: config.yml`.
16. Flow basic block: `tapOn` + `assertVisible` inside `int-within-basic-container` passes.
17. Flow pre-click `assertNotVisible` passes; post-`within` page-scope `assertVisible` passes.
18. Flow `nth:0` block asserts `"Row A"` without error; `nth:1` block asserts `"Row B"` without error.
19. Flow input block: `tapOn` + `inputText: "scoped input"` + `assertValue expected: "scoped input"` inside `int-within-input-container` passes.
20. Flow `assertCount` in `int-within-count-a` expects 2 and passes; in `int-within-count-b` expects 3 and passes.
21. Flow nested `within` block: outer scoped to `int-within-outer`, inner scoped to `int-within-inner`, `assertText` on `int-within-deep-target` expects `"Deep target"` and passes.

**Last checkpoint:** tester_arbiter at 2026-09-12

## Arbiter Notes (pre-Coder)
- All 21 ACs covered, no conflicts.
- **TC-U-07:** constants are exactly `{section, heading, note, badge, inputCls, btnCls}` — 6 constants. Do NOT copy `monoBox` from IntegrationTestPage since no fixture in this page uses it.
- **TC-I-19:** `within.yaml` must include a sixth block — `within: { testId: int-within-outer }` directly running `assertText: { testId: int-within-deep-target, expected: "Deep target" }` (no inner `within`). TC-I-19 tests this single-level fallback via flow execution.

---

## Tests

### Attribution

| Test ID | Description | Generator A | Generator B |
|---|---|---|---|
| TC-U-01 | page renders without auth guard | ✓ | ✓ |
| TC-U-02 | root wrapper has correct data-testid | ✓ | — |
| TC-U-03 | h1 text exact match | ✓ | ✓ |
| TC-U-04 | exactly five section elements | ✓ | ✓ |
| TC-U-05 | section headings in order | ✓ | ✓ |
| TC-U-06 | outer wrapper className | ✓ | ✓ |
| TC-U-07 | six Tailwind constants declared | ✓ | ✓ |
| TC-U-08 | basic-container present/visible | ✓ | ✓ |
| TC-U-09 | basic-btn descendant of container | ✓ | ✓ |
| TC-U-10 | basic-result absent before click | ✓ | ✓ |
| TC-U-11 | result absent after remount | — | ✓ |
| TC-U-12 | result appears after click | ✓ | ✓ |
| TC-U-13 | result text "Within result visible" | ✓ | ✓ |
| TC-U-14 | result descendant of container after click | ✓ | ✓ |
| TC-U-15 | exactly two int-within-row elements | ✓ | ✓ |
| TC-U-16 | each row has one label | ✓ | ✓ |
| TC-U-17 | first label "Row A" | ✓ | ✓ |
| TC-U-18 | second label "Row B" | ✓ | ✓ |
| TC-U-19 | input-container present | ✓ | ✓ |
| TC-U-20 | input-field descendant of container | ✓ | ✓ |
| TC-U-21 | input field is INPUT with empty value | ✓ | ✓ |
| TC-U-22 | count-a has 2 items | ✓ | ✓ |
| TC-U-23 | count-b has 3 items | ✓ | ✓ |
| TC-U-24 | total count-item is 5 | ✓ | ✓ |
| TC-U-25 | outer contains inner | ✓ | ✓ |
| TC-U-26 | inner contains deep-target | ✓ | ✓ |
| TC-U-27 | deep-target text "Deep target" | ✓ | ✓ |
| TC-U-28 | deep-target transitive descendant of outer | ✓ | — |
| TC-U-29 | singleton testIds appear once | ✓ | ✓ |
| TC-U-30 | duplicated testIds at expected counts | ✓ | ✓ |
| TC-U-31 | App.jsx imports IntegrationWithinPage | ✓ | — |
| TC-U-32 | route renders without auth in MemoryRouter | ✓ | — |
| TC-U-33 | existing /integration route still works | ✓ | — |
| TC-I-01 | flow navigates to page without auth | ✓ | ✓ |
| TC-I-02 | within.yaml exists | ✓ | ✓ |
| TC-I-03 | within.yaml appId correct | ✓ | ✓ |
| TC-I-04 | within.yaml config.yml reference | ✓ | ✓ |
| TC-I-05 | basic block tapOn + assertVisible | ✓ | ✓ |
| TC-I-06 | within scope isolates selector | — | ✓ |
| TC-I-07 | pre-click assertNotVisible passes | ✓ | ✓ |
| TC-I-08 | post-within page-scope assertVisible | ✓ | ✓ |
| TC-I-09 | nth:0 asserts "Row A" | ✓ | ✓ |
| TC-I-10 | nth:1 asserts "Row B" | ✓ | ✓ |
| TC-I-11 | nth:0 and nth:1 different text | — | ✓ |
| TC-I-12 | nth:2 (out of bounds) fails | ✓ | — |
| TC-I-13 | input block scoped passes | ✓ | ✓ |
| TC-I-14 | typing outside scope does not bleed | ✓ | — |
| TC-I-15 | count-a assertCount expects 2 | ✓ | ✓ |
| TC-I-16 | count-b assertCount expects 3 | ✓ | ✓ |
| TC-I-17 | page-scope assertCount is 5 | ✓ | ✓ |
| TC-I-18 | nested within passes | ✓ | ✓ |
| TC-I-19 | outer-only scope reaches deep-target | ✓ | ✓ |

**Unique to A:** 7 &nbsp; **Unique to B:** 3 &nbsp; **Shared:** 42 &nbsp; **Total after dedup:** 52

### Unit Tests

- **TC-U-01** (AC 1, 14) — `page renders without auth guard` | Render directly; no redirect; `integration-within-page` testId present.
- **TC-U-02** (AC 1) [A] — `root wrapper has correct data-testid` | `getByTestId("integration-within-page")` resolves.
- **TC-U-03** (AC 2) — `h1 text exact match` | `h1.textContent === "Integration Within Test Page"`.
- **TC-U-04** (AC 3) — `exactly five section elements` | `querySelectorAll("section").length === 5`.
- **TC-U-05** (AC 3) — `section headings match spec in order` | All five h2 texts in specified order.
- **TC-U-06** (AC 4) — `outer wrapper className` | `className === "max-w-2xl mx-auto px-4 py-8"`.
- **TC-U-07** (AC 4) — `six Tailwind constants declared and applied` | Static/snapshot check.
- **TC-U-08** (AC 5) — `int-within-basic-container present and visible` | Present, not hidden.
- **TC-U-09** (AC 6) — `int-within-basic-btn descendant of container` | `container.contains(btn)`.
- **TC-U-10** (AC 7) — `int-within-basic-result absent before click` | `queryByTestId === null`.
- **TC-U-11** (AC 7) [B] — `result stays absent after remount` | State reset guard.
- **TC-U-12** (AC 8) — `result appears after clicking btn` | `fireEvent.click`; result in DOM.
- **TC-U-13** (AC 8) — `result text "Within result visible"` | Exact `textContent` match.
- **TC-U-14** (AC 8) — `result is descendant of container after click` | `container.contains(result)`.
- **TC-U-15** (AC 9, 13) — `exactly two int-within-row elements` | `getAllByTestId.length === 2`.
- **TC-U-16** (AC 9, 13) — `each row contains exactly one label` | Per-row scoped query.
- **TC-U-17** (AC 9) — `first row label "Row A"` | `[0].textContent`.
- **TC-U-18** (AC 9) — `second row label "Row B"` | `[1].textContent`.
- **TC-U-19** (AC 10) — `int-within-input-container present` | `getByTestId` resolves.
- **TC-U-20** (AC 10) — `int-within-input-field descendant of container` | `container.contains(field)`.
- **TC-U-21** (AC 10) — `input is INPUT with empty value` | `tagName === "INPUT"` and `value === ""`.
- **TC-U-22** (AC 11, 13) — `count-a has exactly 2 items` | Scoped `querySelectorAll`.
- **TC-U-23** (AC 11, 13) — `count-b has exactly 3 items` | Scoped `querySelectorAll`.
- **TC-U-24** (AC 11, 13) — `total count-item is 5` | `getAllByTestId.length === 5`.
- **TC-U-25** (AC 12) — `outer contains inner` | `outer.contains(inner)`.
- **TC-U-26** (AC 12) — `inner contains deep-target` | `inner.contains(deep)`.
- **TC-U-27** (AC 12) — `deep-target text "Deep target"` | `textContent`.
- **TC-U-28** (AC 12) [A] — `deep-target transitive descendant of outer` | Full 3-level chain.
- **TC-U-29** (AC 13) — `singleton testIds appear exactly once` | Each non-repeated id has count 1.
- **TC-U-30** (AC 13) — `duplicated testIds at expected counts` | row×2, row-label×2, count-item×5.
- **TC-U-31** (AC 14) [A] — `App.jsx imports IntegrationWithinPage` | Static import check.
- **TC-U-32** (AC 14) [A] — `route renders without auth in MemoryRouter` | `MemoryRouter initialEntries`, no user.
- **TC-U-33** (AC 14, boundary) [A] — `existing /integration route still works` | Route collision guard.

### Integration Tests

- **TC-I-01** (AC 1, 14, 15) — `flow navigates to page without auth` | `goto` + `assertVisible` root; no redirect.
- **TC-I-02** (AC 15) — `within.yaml exists` | File system check.
- **TC-I-03** (AC 15) — `within.yaml appId references /integration-within` | Parse YAML.
- **TC-I-04** (AC 15) — `within.yaml references config.yml` | Parse YAML.
- **TC-I-05** (AC 16) — `basic block tapOn + assertVisible scoped` | Flow passes.
- **TC-I-06** (AC 16, 17) [B] — `within scope isolates selector` | Cross-container isolation guard.
- **TC-I-07** (AC 17) — `pre-click assertNotVisible passes` | Element absent before interaction.
- **TC-I-08** (AC 17) — `post-within page-scope assertVisible passes` | Cross-scope DOM mutation confirmed.
- **TC-I-09** (AC 18) — `nth:0 asserts "Row A"` | First container scoped.
- **TC-I-10** (AC 18) — `nth:1 asserts "Row B"` | Second container scoped.
- **TC-I-11** (AC 18) [B] — `nth:0 and nth:1 produce different text` | Off-by-one collision guard.
- **TC-I-12** (AC 18, boundary) [A] — `nth:2 (out of bounds) fails` | Error on invalid index.
- **TC-I-13** (AC 19) — `input block scoped: tapOn + inputText + assertValue pass` | Scoped input.
- **TC-I-14** (AC 19, boundary) [A] — `typing outside scope does not bleed` | Scope isolation.
- **TC-I-15** (AC 20) — `count-a assertCount expects 2` | Scoped count.
- **TC-I-16** (AC 20) — `count-b assertCount expects 3` | Scoped count.
- **TC-I-17** (AC 20, boundary) — `page-scope assertCount is 5` | Global total.
- **TC-I-18** (AC 21) — `nested within passes` | outer → inner → assertText.
- **TC-I-19** (AC 21, boundary) — `outer-only scope reaches deep-target` | Single-level fallback.

---

## Tests — Generator B (tester_generator_b)

### Unit Tests

- **TC-U01** (AC 1, 14) — `page renders at /integration-within without auth guard` | unit | render directly; `getByTestId("integration-within-page")` present; no ProtectedRoute.
- **TC-U02** (AC 2) — `h1 text exact match` | unit | `h1.textContent === "Integration Within Test Page"`.
- **TC-U03** (AC 3) — `exactly five section elements` | unit | `querySelectorAll("section").length === 5`.
- **TC-U04** (AC 3) — `section headings correct and in order` | unit | All five h2 texts in order.
- **TC-U05** (AC 4) — `outer wrapper exact Tailwind class string` | unit | `className` includes `"max-w-2xl mx-auto px-4 py-8"`.
- **TC-U06** (AC 4) — `six named constants match IntegrationTestPage.jsx` | unit | Static/snapshot check.
- **TC-U07** (AC 5) — `int-within-basic-container present and visible` | unit | Not hidden.
- **TC-U08** (AC 6) — `int-within-basic-btn descendant of container` | unit | `container.contains(btn)`.
- **TC-U09** (AC 7) — `int-within-basic-result absent before interaction` | unit | `queryByTestId === null`.
- **TC-U10** (AC 8) — `clicking btn mounts int-within-basic-result` | unit | `userEvent.click`, then present.
- **TC-U11** (AC 8) — `result text "Within result visible" after click` | unit | `textContent` exact.
- **TC-U12** (AC 8) — `result is descendant of container after click` | unit | `container.contains(result)`.
- **TC-U13** (AC 9, 13) — `exactly two int-within-row elements` | unit | `getAllByTestId.length === 2`.
- **TC-U14** (AC 9) — `each row contains exactly one int-within-row-label` | unit | Per-row child count.
- **TC-U15** (AC 9) — `first label text "Row A"` | unit | `[0].textContent`.
- **TC-U16** (AC 9) — `second label text "Row B"` | unit | `[1].textContent`.
- **TC-U17** (AC 10) — `int-within-input-container present` | unit | `getByTestId` resolves.
- **TC-U18** (AC 10) — `int-within-input-field descendant of container` | unit | `container.contains(field)`.
- **TC-U19** (AC 10) — `input field is INPUT tag with empty initial value` | unit | `tagName + value === ""`.
- **TC-U20** (AC 11) — `count-a has 2 int-within-count-item` | unit | Scoped `querySelectorAll`.
- **TC-U21** (AC 11) — `count-b has 3 int-within-count-item` | unit | Scoped `querySelectorAll`.
- **TC-U22** (AC 11, 13) — `total count-item across page is 5` | unit | `getAllByTestId.length === 5`.
- **TC-U23** (AC 12) — `int-within-inner descendant of int-within-outer` | unit | `outer.contains(inner)`.
- **TC-U24** (AC 12) — `int-within-deep-target descendant of int-within-inner` | unit | `inner.contains(deep)`.
- **TC-U25** (AC 12) — `int-within-deep-target text "Deep target"` | unit | `textContent`.
- **TC-U26** (AC 13) — `all non-repeated testIds appear exactly once` | unit | Enumerate all, exclude known repeats.
- **TC-U27** (AC 13) — `int-within-row-label appears exactly twice` | unit | `getAllByTestId.length === 2`.
- **TC-U28** (AC 7) — `result stays absent after remount without interaction` | unit | State reset guard.

### Integration Tests

- **TC-I01** (AC 1, 14) — `goto renders page without redirect` | integration | No auth redirect.
- **TC-I02** (AC 15) — `within.yaml exists with correct appId and config` | integration | File + parse check.
- **TC-I03** (AC 16) — `basic block: tapOn inside container reveals result` | integration | Flow passes.
- **TC-I04** (AC 17) — `pre-click assertNotVisible passes outside within scope` | integration | Pre-interaction check.
- **TC-I05** (AC 17) — `post-within page-scope assertVisible passes` | integration | Cross-scope mutation confirmed.
- **TC-I06** (AC 18) — `nth:0 asserts "Row A"` | integration | Scoped to first container.
- **TC-I07** (AC 18) — `nth:1 asserts "Row B"` | integration | Scoped to second container.
- **TC-I08** (AC 18) — `nth:0 and nth:1 produce different text` | integration | No off-by-one collision.
- **TC-I09** (AC 19) — `input block: tapOn + inputText + assertValue pass` | integration | Scoped input interaction.
- **TC-I10** (AC 20) — `count-a assertCount expects 2` | integration | Scoped count excludes count-b.
- **TC-I11** (AC 20) — `count-b assertCount expects 3` | integration | Scoped count excludes count-a.
- **TC-I12** (AC 20) — `global assertCount is 5 (no within scope)` | integration | Total boundary check.
- **TC-I13** (AC 21) — `nested within: outer → inner → assertText on deep-target` | integration | 2-level nesting.
- **TC-I14** (AC 21) — `outer-only scope still reaches deep-target` | integration | Single-level fallback check.
- **TC-I15** (AC 16, 17) — `within scope isolates selector (no cross-container match)` | integration | Scope isolation guard.

---

## Tests — Generator A (tester_generator_a)

### Unit Tests — Component Rendering and DOM Structure

- **TC-U-01** — `page renders without authentication` (AC: 1, 14) | unit | Render `<IntegrationWithinPage />` with no auth context; assert no redirect to `/login`.
- **TC-U-02** — `root wrapper has correct data-testid` (AC: 1) | unit | `getByTestId("integration-within-page")` resolves.
- **TC-U-03** — `h1 text is exactly "Integration Within Test Page"` (AC: 2) | unit | `document.querySelector("h1").textContent`.
- **TC-U-04** — `exactly five section elements are rendered` (AC: 3) | unit | `document.querySelectorAll("section").length === 5`.
- **TC-U-05** — `section headings match spec in order` (AC: 3) | unit | All five h2 texts in order.
- **TC-U-06** — `outer wrapper className matches pattern` (AC: 4) | unit | Root div has `className="max-w-2xl mx-auto px-4 py-8"`.
- **TC-U-07** — `all six Tailwind class-name constants declared and applied` (AC: 4) | unit | Static/snapshot check.
- **TC-U-08** — `int-within-basic-container present and visible on load` (AC: 5) | unit | `getByTestId("int-within-basic-container")` exists, not hidden.
- **TC-U-09** — `int-within-basic-btn is descendant of int-within-basic-container` (AC: 6) | unit | `container.contains(btn)`.
- **TC-U-10** — `int-within-basic-result absent from DOM before click` (AC: 7) | unit | `queryByTestId("int-within-basic-result") === null`.
- **TC-U-11** — `int-within-basic-result appears after clicking btn` (AC: 8) | unit | `fireEvent.click(btn)`, then assert text.
- **TC-U-12** — `int-within-basic-result is descendant of container after click` (AC: 8) | unit | `container.contains(result)`.
- **TC-U-13** — `exactly two int-within-row elements` (AC: 9, 13) | unit | `getAllByTestId("int-within-row").length === 2`.
- **TC-U-14** — `each int-within-row contains exactly one int-within-row-label` (AC: 9, 13) | unit | Per-row child count.
- **TC-U-15** — `first row label "Row A", second "Row B"` (AC: 9) | unit | `getAllByTestId("int-within-row-label")[0/1].textContent`.
- **TC-U-16** — `int-within-input-container present on load` (AC: 10) | unit | `getByTestId` resolves.
- **TC-U-17** — `int-within-input-field is descendant input of container` (AC: 10) | unit | `container.contains(field)`, tag is INPUT.
- **TC-U-18** — `int-within-input-field has empty initial value` (AC: 10) | unit | `field.value === ""`.
- **TC-U-19** — `int-within-count-a contains exactly 2 int-within-count-item` (AC: 11, 13) | unit | Scoped `querySelectorAll`.
- **TC-U-20** — `int-within-count-b contains exactly 3 int-within-count-item` (AC: 11, 13) | unit | Scoped `querySelectorAll`.
- **TC-U-21** — `total int-within-count-item across page is 5` (AC: 11, 13) | unit | `getAllByTestId(...).length === 5`.
- **TC-U-22** — `int-within-outer contains int-within-inner` (AC: 12) | unit | `outer.contains(inner)`.
- **TC-U-23** — `int-within-inner contains int-within-deep-target` (AC: 12) | unit | `inner.contains(deep)`.
- **TC-U-24** — `int-within-deep-target text is "Deep target"` (AC: 12) | unit | `textContent`.
- **TC-U-25** — `int-within-deep-target is transitive descendant of int-within-outer` (AC: 12) | unit | Full 3-level chain.
- **TC-U-26** — `all singleton testIds appear exactly once` (AC: 13) | unit | Each unique testId asserted `.length === 1`.
- **TC-U-27** — `intentionally duplicated testIds appear expected count` (AC: 13) | unit | row×2, row-label×2, count-item×5.

### Unit Tests — App Routing

- **TC-U-28** — `App.jsx imports IntegrationWithinPage` (AC: 14) | unit | Static import check.
- **TC-U-29** — `/integration-within` route renders without auth` (AC: 14) | unit | `MemoryRouter` at `/integration-within`, no user, page renders.
- **TC-U-30** — `existing /integration route still works` (AC: 14, boundary) | unit | Route collision guard.

### Integration Tests — Flow File

- **TC-I-01** — `within.yaml exists` (AC: 15) | integration | File system check.
- **TC-I-02** — `within.yaml appId references /integration-within` (AC: 15) | integration | Parse YAML.
- **TC-I-03** — `within.yaml references config.yml` (AC: 15) | integration | Parse YAML.

### Integration Tests — Flow Execution (E2E)

- **TC-I-04** — `flow basic block passes` (AC: 16) | integration | tapOn + assertVisible scoped to container.
- **TC-I-05** — `pre-click assertNotVisible passes` (AC: 17) | integration | Element absent before interaction.
- **TC-I-06** — `post-within page-scope assertVisible passes` (AC: 17) | integration | DOM mutation confirmed globally.
- **TC-I-07** — `flow nth:0 asserts "Row A"` (AC: 18) | integration | First container scoped.
- **TC-I-08** — `flow nth:1 asserts "Row B"` (AC: 18) | integration | Second container scoped.
- **TC-I-09** — `flow nth:2 (out of bounds) fails` (AC: 18, boundary) | integration | Error on invalid index.
- **TC-I-10** — `flow input block passes` (AC: 19) | integration | tapOn + inputText + assertValue scoped.
- **TC-I-11** — `typing outside scope does not bleed to other inputs` (AC: 19, boundary) | integration | Scope isolation.
- **TC-I-12** — `flow assertCount in count-a expects 2` (AC: 20) | integration | Scoped count.
- **TC-I-13** — `flow assertCount in count-b expects 3` (AC: 20) | integration | Scoped count.
- **TC-I-14** — `page-scope assertCount sees all 5 items` (AC: 20, boundary) | integration | Global count.
- **TC-I-15** — `flow nested within passes` (AC: 21) | integration | outer → inner → assertText.
- **TC-I-16** — `outer-only scope can still reach deep-target` (AC: 21, boundary) | integration | Single-level fallback.
- **TC-I-17** — `flow navigates to page without auth` (AC: 1, 15) | integration | goto + assertVisible, no login.

---

## Feature & Task Breakdown

| ID | Task | File | Dependencies | Status |
|---|---|---|---|---|
| T-01 | Create `IntegrationWithinPage.jsx` skeleton — wrapper div, `h1`, description, style constants, `useState` import | `test-app/src/pages/IntegrationWithinPage.jsx` | — | open |
| T-02 | Add Section 1 (within basic) — `basicClicked` state, `int-within-basic-container`, `int-within-basic-btn`, conditional `int-within-basic-result` | `test-app/src/pages/IntegrationWithinPage.jsx` | T-01 | open |
| T-03 | Add Section 2 (within nth) — two `int-within-row` divs each with `int-within-row-label` span (`"Row A"` / `"Row B"`) | `test-app/src/pages/IntegrationWithinPage.jsx` | T-01 | open |
| T-04 | Add Section 3 (within input) — `int-within-input-container` with `int-within-input-field` text input | `test-app/src/pages/IntegrationWithinPage.jsx` | T-01 | open |
| T-05 | Add Section 4 (within assertCount) — `int-within-count-a` (2 items) and `int-within-count-b` (3 items) each with `int-within-count-item` list items | `test-app/src/pages/IntegrationWithinPage.jsx` | T-01 | open |
| T-06 | Add Section 5 (within nested) — `int-within-outer` → `int-within-inner` → `int-within-deep-target` (`"Deep target"`) | `test-app/src/pages/IntegrationWithinPage.jsx` | T-01 | open |
| T-07 | Register route in `App.jsx` — import + `<Route path="/integration-within">` (no auth guard) | `test-app/src/App.jsx` | T-01 | open |
| T-08 | Create `within.yaml` — all five `within` blocks end-to-end | `test-app/flows/integration/within.yaml` | T-02, T-03, T-04, T-05, T-06 | open |

---

## Test Results

**Flow run:** `test-app/flows/integration/within.yaml`
**Result:** PASSED — 11/11 commands

| Command | Status |
|---|---|
| goto: /integration-within | ✓ |
| assertNotVisible: int-within-basic-result | ✓ |
| within(basic-container) → tapOn + assertVisible | ✓ |
| assertVisible: int-within-basic-result (page scope) | ✓ |
| within(row, nth:0) → assertText "Row A" | ✓ |
| within(row, nth:1) → assertText "Row B" | ✓ |
| within(input-container) → tapOn + inputText + assertValue | ✓ |
| within(count-a) → assertCount 2 | ✓ |
| within(count-b) → assertCount 3 | ✓ |
| within(outer) → within(inner) → assertText "Deep target" | ✓ |
| within(outer) → assertText "Deep target" (TC-I-19) | ✓ |

**Note:** Flow selector bug fixed — within container selectors must use `data-testid:` key (not `testId:` or `css:`). The `within` parser builds `key=value` strings; `data-testid` matches the `isValidAttr` pattern `/^data-[a-zA-Z0-9-]+$/` and resolves to `[data-testid="..."]` CSS via `buildAttrCss`.

---

## Quality Gate

**Verdict:** PASS
**Timestamp:** 2026-09-12

All 21 ACs verified:
- Page structure (ACs 1–13): confirmed against IntegrationWithinPage.jsx source
- Route registration (AC 14): confirmed in App.jsx, no ProtectedRoute wrapper
- YAML existence + metadata (AC 15): confirmed
- Flow execution (ACs 16–21): 11/11 commands passed

Blocking findings: 0

---

## Build Check

**Verdict:** PASS
**Manifest:** test-app/package.json (found)
**Smoke tests:** 3/3 passed
**Blocking findings:** 0

Full report: `pipeline/feat-integration-within/build_check.md`

---

## PR

**URL:** https://github.com/plaktoz/uivisor/pull/58
**Branch:** feat-integration-within
**Status:** merged (2026-09-12T09:05:48Z)

---

## Worktree (updated)

**Status:** removed (post-merge cleanup)
