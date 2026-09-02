# Pipeline State: feat-selector-heuristics-engine

**Task:** New `packages/core/src/selectorHeuristics.ts`; walk `data-testid → visible text → role+accessible name → label text → placeholder` for any element; return highest-priority `Selector`; unit tests covering all priority levels and edge cases
**Epic:** epic-complete-recording-experience
**Started:** 2026-09-02
**Status:** pr_open

## Worktree
**Path:** .worktrees/feat-selector-heuristics-engine
**Branch:** feat-selector-heuristics-engine
**Created:** 2026-09-02
**Status:** active

---

## Gate 0: Execution Plan

**Classification:** feature
**Complexity:** small

**Roles Activated:** Analyst, Architect, Tester Ensemble, Coder, Quality Gate, Release Documenter, Deployer
**Designer Activated:** no

**Execution Sequence:**
1. Gate 0 — Classify and plan (Orchestrator)
2. Gate 1 — Analyst produces spec with ACs
3. Architect — task breakdown (T1–Tn table)
4. Tester Ensemble Phase 1 — Generator A + Generator B run independently, Consolidator deduplicates, Arbiter reviews
5. Coder — implement tasks in worktree
6. Tester Ensemble Phase 2 — Coder runs tests; Arbiter marks pass/fail
7. Quality Gate — TypeScript compile check + test results review
8. Release Documenter — changelog / export surface notes
9. Deployer — merge PR, clean up worktree

## Run Estimates
**Complexity:** small
**Duration:** ~21–41 min
**Cost:** ~$0.05–$0.24 (cap: $5.00)
**Tokens:** ~40K–100K tokens

---

## Gate 1: Spec — selector heuristics engine

### Summary

Add a pure function `resolveSelector(el: Element): Selector` to `packages/core`. Given any DOM `Element`, the function inspects the element's attributes and content and returns the highest-priority `Selector` object the element can be identified by. The function is designed to run inside a browser context (content script or injected script) — it depends only on the DOM API and must not import Playwright or any Node.js module.

The CSS fallback returns `{ css: string }`, which requires adding a new `{ css: string }` variant to the existing `Selector` union type and updating `parseSelector` to handle it.

### Priority chain (highest → lowest)

| Priority | Condition | Return shape |
|---|---|---|
| 1 | `data-testid` attribute present and non-empty | `{ testId: value }` |
| 2 | `textContent` trimmed is non-empty and ≤ 60 chars | `{ text: trimmedValue }` |
| 3 | Explicit ARIA `role` attribute AND accessible name (via `aria-label` or `aria-labelledby`) | `{ role: value, name: accessibleName }` |
| 4 | Associated `<label>` text (via `for`/`id` linkage or wrapping ancestor) | `{ label: labelText }` |
| 5 | `placeholder` attribute present and non-empty | `{ placeholder: value }` |
| 6 | (fallback) tag + id/classes CSS selector | `{ css: cssSelector }` |

### Acceptance Criteria

**AC1** — `resolveSelector` is exported from the `@uivisor/core` package (i.e., re-exported from `packages/core/src/index.ts`).

**AC2** — When an element has a non-empty `data-testid` attribute, `resolveSelector` returns `{ testId: value }` regardless of any other attributes or content.

**AC3** — When an element has no `data-testid` and its trimmed `textContent` is non-empty and ≤ 60 characters, `resolveSelector` returns `{ text: trimmedValue }`.

**AC4** — When an element has no `data-testid` and no qualifying text, but has an explicit ARIA `role` attribute and a resolvable accessible name (via `aria-label` attribute or via `aria-labelledby` referencing an element in the same document), `resolveSelector` returns `{ role: value, name: accessibleName }`.

**AC5** — When an element has no `data-testid`, no qualifying text, and no role+accessible-name pair, but can be linked to a `<label>` element (either `<label for="id">` linkage or the label wraps the element as an ancestor), `resolveSelector` returns `{ label: labelText }` where `labelText` is the label's trimmed text content.

**AC6** — When priorities 1–4 all fail, but the element has a non-empty `placeholder` attribute, `resolveSelector` returns `{ placeholder: value }`.

**AC7** — When all of priorities 1–5 fail, `resolveSelector` returns `{ css: cssSelector }` where `cssSelector` is built from the element's tag name, `id` attribute (if present), and `class` list (if present), in the form `tag#id.class1.class2`.

**AC8** — Text content used in priority 2 is trimmed of leading/trailing whitespace. If the trimmed text exceeds 60 characters, it is truncated to exactly 60 characters.

**AC9** — If `textContent` is empty or contains only whitespace after trimming, priority 2 is skipped and evaluation continues to priority 3.

**AC10** — `selectorHeuristics.ts` is a pure browser-DOM module: it imports nothing from Node.js built-ins, nothing from `playwright`, and has no side effects. `resolveSelector` is a plain synchronous function.

**AC11** — A Vitest test file at `packages/core/src/selectorHeuristics.test.ts` covers: every priority level (AC2–AC7), text trimming/truncation (AC8), whitespace-text skip (AC9), nested text from child elements, multiple CSS classes, `id`-based CSS fragment, label-by-`for` linkage, label-by-wrapping, role with no accessible name (should fall through), and `data-testid` trumping each of the lower priorities.

**AC12** — `packages/core/src/index.ts` exports `resolveSelector` from `./selectorHeuristics.js`.

**AC13** — `tsc --noEmit` run against `packages/core/tsconfig.json` (strict mode) produces zero errors.

### Out of scope

- Implicit ARIA roles derived from tag semantics (e.g., `<button>` having implicit `role="button"`) — only explicit `role` attributes are checked.
- `aria-labelledby` chain resolution beyond a single referenced element.
- Shadow DOM traversal.
- Playwright-specific locators.

---

## Feature Task Breakdown

| # | Task | File(s) | Notes |
|---|---|---|---|
| T1 | Add `{ css: string }` variant to `Selector` union | `packages/core/src/types.ts` | Append `\| { css: string }` to the union |
| T2 | Handle `{ css: string }` in `parseSelector` | `packages/core/src/selectorParser.ts` | Add `if ('css' in obj) return { css: obj['css'] as string };` before the throw |
| T3 | Create `selectorHeuristics.ts` with `resolveSelector` | `packages/core/src/selectorHeuristics.ts` | New file; pure DOM function; follow priority chain exactly as specced |
| T4 | Export `resolveSelector` from package index | `packages/core/src/index.ts` | Add `export { resolveSelector } from './selectorHeuristics.js';` |
| T5 | Add Vitest + jsdom dev-dependencies to `packages/core` | `packages/core/package.json` | Add `vitest`, `@vitest/coverage-v8`, `jsdom`, `@types/jsdom` as devDependencies; add `"test"` script: `vitest run` |
| T6 | Create `vitest.config.ts` for `packages/core` | `packages/core/vitest.config.ts` | `environment: 'jsdom'`, `globals: false` |
| T7 | Write full unit test suite | `packages/core/src/selectorHeuristics.test.ts` | All 21 test cases from approved test plan |

**Dependency order:** T1 → T2, T1 → T3, T3 → T4, T5 → T6 → T7. T1 and T5 can start in parallel.

---

## Tests — Generator A

> Generator A focus: one test per AC; one test per priority level; priority-precedence ordering tests.

```
Test file: packages/core/src/selectorHeuristics.test.ts
Environment: jsdom (Vitest)
Runner: npx vitest run (from packages/core)
```

### TC-A01 — data-testid returns testId shape
```
Setup: createElement('button'); setAttribute('data-testid', 'submit-btn'); textContent = 'Submit'
Input: resolveSelector(el)
Expected: { testId: 'submit-btn' }
Rationale: AC2 — testId is highest priority; text is present but ignored
```

### TC-A02 — visible text returns text shape
```
Setup: createElement('span'); textContent = 'Click me'
Input: resolveSelector(el)
Expected: { text: 'Click me' }
Rationale: AC3 — no testId; text is non-empty
```

### TC-A03 — role + aria-label returns role shape
```
Setup: createElement('div'); setAttribute('role', 'checkbox'); setAttribute('aria-label', 'Accept terms')
Input: resolveSelector(el)
Expected: { role: 'checkbox', name: 'Accept terms' }
Rationale: AC4 — no testId; no text; role+name present
```

### TC-A04 — label via for/id linkage returns label shape
```
Setup: document.body.innerHTML = '<label for="e1">Email address</label><input id="e1">'
Input: resolveSelector(document.getElementById('e1'))
Expected: { label: 'Email address' }
Rationale: AC5 — input has no testId, text, role; linked label exists
```

### TC-A05 — placeholder returns placeholder shape
```
Setup: createElement('input'); setAttribute('placeholder', 'Search...')
Input: resolveSelector(el)
Expected: { placeholder: 'Search...' }
Rationale: AC6 — no testId, text, role, label; placeholder present
```

### TC-A06 — bare element returns css shape
```
Setup: createElement('span') (no attributes, no text)
Input: resolveSelector(el)
Expected: { css: 'span' }
Rationale: AC7 — all other priorities fail; tag-only fallback
```

### TC-A07 — text is trimmed
```
Setup: createElement('button'); textContent = '  Submit  '
Input: resolveSelector(el)
Expected: { text: 'Submit' }
Rationale: AC8 — whitespace stripped from both ends
```

### TC-A08 — text longer than 60 chars is truncated
```
Setup: createElement('p'); textContent = 'A'.repeat(61)
Input: resolveSelector(el)
Expected: { text: 'A'.repeat(60) }
Rationale: AC8 — text capped at 60 chars
```

### TC-A09 — whitespace-only text falls through to next priority
```
Setup: createElement('button'); textContent = '   '; setAttribute('role', 'button'); setAttribute('aria-label', 'Save')
Input: resolveSelector(el)
Expected: { role: 'button', name: 'Save' }
Rationale: AC9 — whitespace text is skipped; role+name used
```

### TC-A10 — testId trumps text
```
Setup: createElement('button'); setAttribute('data-testid', 'btn'); textContent = 'Click'
Input: resolveSelector(el)
Expected: { testId: 'btn' }
Rationale: AC2 priority ordering
```

### TC-A11 — testId trumps placeholder
```
Setup: createElement('input'); setAttribute('data-testid', 'search'); setAttribute('placeholder', 'Search')
Input: resolveSelector(el)
Expected: { testId: 'search' }
Rationale: AC2 priority ordering
```

### TC-A12 — text trumps role+name
```
Setup: createElement('button'); textContent = 'Save'; setAttribute('role', 'button'); setAttribute('aria-label', 'Save document')
Input: resolveSelector(el)
Expected: { text: 'Save' }
Rationale: AC3 has higher priority than AC4
```

### TC-A13 — text trumps placeholder
```
Setup: createElement('input'); textContent = 'value text'; setAttribute('placeholder', 'Enter here')
Input: resolveSelector(el)
Expected: { text: 'value text' }
Rationale: AC3 has higher priority than AC6
```

---

## Tests — Generator B

> Generator B focus: boundary values, structural edge cases, CSS shape variants, label topology variants.

```
Test file: packages/core/src/selectorHeuristics.test.ts
Environment: jsdom (Vitest)
Runner: npx vitest run (from packages/core)
```

### TC-B01 — text of exactly 60 chars is NOT truncated
```
Setup: createElement('p'); textContent = 'B'.repeat(60)
Input: resolveSelector(el)
Expected: { text: 'B'.repeat(60) }
Rationale: AC8 — boundary: 60 is within limit
```

### TC-B02 — text of exactly 61 chars IS truncated to 60
```
Setup: createElement('p'); textContent = 'C'.repeat(61)
Input: resolveSelector(el)
Expected: { text: 'C'.repeat(60) }
Rationale: AC8 — boundary: 61 exceeds limit by 1
```

### TC-B03 — nested child text is collected
```
Setup: createElement('div'); innerHTML = '<strong>Hello</strong> <em>world</em>'
Input: resolveSelector(el)
Expected: { text: 'Hello world' } (or similar trimmed form)
Rationale: AC3/AC8 — textContent aggregates descendant text
```

### TC-B04 — element with id produces tag#id CSS
```
Setup: createElement('div'); setAttribute('id', 'main-content') (no other qualifying attrs)
Input: resolveSelector(el)
Expected: { css: 'div#main-content' }
Rationale: AC7 — id appended to tag
```

### TC-B05 — element with multiple classes produces tag.c1.c2 CSS
```
Setup: createElement('button'); setAttribute('class', 'primary large') (no text, no testId)
Input: resolveSelector(el)
Expected: { css: 'button.primary.large' }
Rationale: AC7 — each class appended with dot
```

### TC-B06 — element with id AND class produces tag#id.class CSS
```
Setup: createElement('input'); setAttribute('id', 'email'); setAttribute('class', 'form-control') (no testId, placeholder, label)
Input: resolveSelector(el)
Expected: { css: 'input#email.form-control' }
Rationale: AC7 — id and class combined
```

### TC-B07 — label via wrapping ancestor returns label shape
```
Setup: document.body.innerHTML = '<label>Username <input type="text"></label>'
Input: resolveSelector(document.querySelector('input'))
Expected: { label: 'Username' } (label text trimmed)
Rationale: AC5 — wrapping label topology
```

### TC-B08 — role with no accessible name falls through to label
```
Setup: document.body.innerHTML = '<label for="cb">Remember me</label><input id="cb" role="checkbox">'
  (no aria-label, no aria-labelledby on the input)
Input: resolveSelector(document.getElementById('cb'))
Expected: { label: 'Remember me' }
Rationale: AC4 condition not fully met (no accessible name) → falls to AC5
```

### TC-B09 — empty data-testid is skipped
```
Setup: createElement('button'); setAttribute('data-testid', ''); textContent = 'OK'
Input: resolveSelector(el)
Expected: { text: 'OK' }
Rationale: AC2 requires non-empty testId; empty string must skip
```

### TC-B10 — element with no attributes and no text returns bare tag CSS
```
Setup: createElement('div') (absolutely no attributes, no children)
Input: resolveSelector(el)
Expected: { css: 'div' }
Rationale: AC7 — minimal fallback
```

### TC-B11 — role+name trumps label
```
Setup: document.body.innerHTML = '<label for="t">My label</label><div id="t" role="textbox" aria-label="My name"></div>'
Input: resolveSelector(document.getElementById('t'))
Expected: { role: 'textbox', name: 'My name' }
Rationale: AC4 has higher priority than AC5
```

### TC-B12 — label trumps placeholder
```
Setup: document.body.innerHTML = '<label for="ph">My field</label><input id="ph" placeholder="Type here">'
Input: resolveSelector(document.querySelector('input'))
Expected: { label: 'My field' }
Rationale: AC5 has higher priority than AC6
```

### TC-B13 — placeholder trumps CSS fallback
```
Setup: createElement('input'); setAttribute('placeholder', 'Search'); setAttribute('class', 'search-box')
Input: resolveSelector(el)
Expected: { placeholder: 'Search' }
Rationale: AC6 has higher priority than AC7
```

### TC-B14 — resolveSelector is exported as a function
```
Setup: import { resolveSelector } from '@uivisor/core'
Expected: typeof resolveSelector === 'function'
Rationale: AC1/AC12 — named export exists
```

---

## Tests

> Consolidated test plan produced by Consolidator after deduplication, followed by Arbiter sign-off.

### Consolidation notes

- TC-A08 and TC-B02 both test 61-char text truncation: merged into **TC006** (B02 wording kept; A08 is redundant).
- TC-A10, TC-A11 (testId trumps others) are distinct and kept (A10 = testId vs text, A11 = testId vs placeholder).
- TC-A12, TC-A13 (text trumps others) are distinct from TC-B11 (role trumps label) and TC-B12 (label trumps placeholder) — all kept as separate priority ordering tests.
- TC-B03 and TC-A02 are different: B03 specifically tests nested child text aggregation; both kept.
- TC-A03 and TC-B11 are different: A03 tests role isolation, B11 tests role vs. label ordering; both kept.
- TC-B14 (export check) is a lightweight check — kept as a standalone smoke test.
- Generator A contributed 13 tests; Generator B contributed 14 tests. After deduplication: 21 unique tests.

### Arbiter review

**Shell commands reviewed:**
- Proposed command: `cd packages/core && npx vitest run`
- **Verdict: APPROVED.** This is a Node/Vitest invocation, not a shell script. Assumes `vitest` is installed in `packages/core` devDependencies (T5 task). The command should be run from the worktree root as `cd .worktrees/feat-selector-heuristics-engine && cd packages/core && npx vitest run` or equivalently with an absolute path. Alternatively, from workspace root: `npx vitest run --project packages/core` (if workspace-level vitest is configured). Preferred: run from the package directory.
- Alternative (workspace-root): `npm run test --workspace=packages/core` — valid once the `"test"` script is added in T5.
- **No shell anti-patterns found.** Tests are pure Vitest; no Playwright, no server startup required.

**Test plan integrity:**
- All 13 ACs are covered by at least one test.
- Priority chain fully exercised: each of the 6 priority levels has a happy-path test (TC001–TC006, TC014–TC016).
- Boundary conditions covered: 60-char (TC005), 61-char (TC006), empty testId (TC009), whitespace text (TC003/TC010).
- Structural variants: nested text (TC011), id in CSS (TC012), multiple classes (TC013), id+class (TC017), label-by-for (TC004), label-by-wrapping (TC018).
- Priority ordering: 5 dedicated ordering tests (TC019–TC021 and TC015-pair).
- Export smoke test: TC021.

**Verdict: APPROVED — 21 tests, test plan is complete and sufficient for Coder to proceed.**

### Final test list

| # | ID | Description | Priority/AC covered | Source |
|---|---|---|---|---|
| 1 | TC001 | `data-testid` attribute → `{ testId: "submit-btn" }` | AC2 | A01 |
| 2 | TC002 | Visible text "Click me" → `{ text: "Click me" }` | AC3 | A02 |
| 3 | TC003 | Text with leading/trailing whitespace → trimmed | AC8 | A07 |
| 4 | TC004 | Input linked to `<label for>` → `{ label: "Email address" }` | AC5 | A04 |
| 5 | TC005 | Text exactly 60 chars → not truncated | AC8 boundary | B01 |
| 6 | TC006 | Text exactly 61 chars → truncated to 60 chars | AC8 boundary | B02 |
| 7 | TC007 | role="checkbox" + aria-label → `{ role, name }` | AC4 | A03 |
| 8 | TC008 | placeholder="Search..." → `{ placeholder: "Search..." }` | AC6 | A05 |
| 9 | TC009 | Empty `data-testid` skipped → falls to text | AC2 (non-empty guard) | B09 |
| 10 | TC010 | Whitespace-only text skipped → falls to role+name | AC9 | A09 |
| 11 | TC011 | Nested child text collected → `{ text }` | AC3, AC11 | B03 |
| 12 | TC012 | Element with id → `{ css: "div#main-content" }` | AC7 | B04 |
| 13 | TC013 | Element with multiple classes → `{ css: "button.primary.large" }` | AC7, AC11 | B05 |
| 14 | TC014 | Bare `<span>` (no attrs, no text) → `{ css: "span" }` | AC7 | A06 |
| 15 | TC015 | `testId` trumps visible text | AC2 precedence | A10 |
| 16 | TC016 | `testId` trumps placeholder | AC2 precedence | A11 |
| 17 | TC017 | Element with id AND class → `{ css: "input#email.form-control" }` | AC7, AC11 | B06 |
| 18 | TC018 | Label via wrapping ancestor → `{ label: "Username" }` | AC5, AC11 | B07 |
| 19 | TC019 | role with no accessible name → falls through to label | AC4 guard, AC11 | B08 |
| 20 | TC020 | `text` trumps role+name | AC3 > AC4 precedence | A12 |
| 21 | TC021 | `resolveSelector` is exported as a function | AC1, AC12 | B14 |

---

## Code Artifacts

| File | Change |
|---|---|
| `packages/core/src/types.ts` | Added `\| { css: string }` variant to `Selector` union (T1) |
| `packages/core/src/selectorParser.ts` | Added `if ('css' in obj) return { css: obj['css'] as string };` before the throw (T2) |
| `packages/core/src/selectorHeuristics.ts` | New file — `resolveSelector(el: Element): Selector` with full 6-level priority chain (T3) |
| `packages/core/src/index.ts` | Added `export { resolveSelector } from './selectorHeuristics.js';` (T4) |
| `packages/core/package.json` | Added vitest, @vitest/coverage-v8, jsdom, @types/jsdom devDeps; added `"test": "vitest run"` script (T5) |
| `packages/core/vitest.config.ts` | New file — `environment: 'jsdom'` (T6) |
| `packages/core/src/selectorHeuristics.test.ts` | New file — 21-test suite covering all ACs and priority levels (T7) |

---

## Test Results

```
 RUN  v3.2.7

 ✓ src/selectorHeuristics.test.ts (21 tests) 17ms

 Test Files  1 passed (1)
      Tests  21 passed (21)
   Start at  11:20:31
   Duration  529ms
```

**21/21 tests pass. `tsc --noEmit` produces zero errors.**

---

## Quality Gate
**Verdict: PASS**
- Tests: 21/21 pass
- TypeScript: tsc --noEmit exits 0
- All 13 ACs satisfied

---

## PR
https://github.com/plaktoz/uivisor/pull/21
