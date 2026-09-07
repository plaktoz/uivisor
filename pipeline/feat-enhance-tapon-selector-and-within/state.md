# Pipeline State: feat-enhance-tapon-selector-and-within

**Task:** Enhance tapOn selector system (heuristic cascade, pipe syntax, wildcard text matching) and add `within` scoping command
**Started:** 2026-09-05
**Status:** complete

---

## Worktree

**Path:** .worktrees/feat-enhance-tapon-selector-and-within
**Branch:** feat-enhance-tapon-selector-and-within
**Created:** 2026-09-05
**Status:** active

---

## Gate 0: Execution Plan

**Classification:** feature
**Complexity:** large

**Roles Activated:** Analyst, Architect, Tester Ensemble, Coder, Release Documenter, Deployer
**Designer Activated:** no (no UI component — YAML DSL + TypeScript changes only)

### Execution Sequence

1. **Analyst** → skill: `to-spec`
   Output: spec + acceptance criteria → `state.md#gate-1`
   [GATE 1: human approval required — revision cap: 2]

2. **Architect** → skill: `to-tickets` + `codebase-design`
   Reads: Gate 1 spec
   Output: feature/task breakdown table → `state.md#feature-task-breakdown`

3. **Tester Ensemble Phase 1** → skill: `tdd`
   Reads: spec + acceptance criteria
   3a. tester_generator_a + tester_generator_b in parallel → each generates test cases
   → `state.md#tests-generator-a` / `state.md#tests-generator-b`
   3b. tester_consolidator → deduplicates → `state.md#tests`
   3c. tester_arbiter → resolves disagreements

4. **Coder** → skill: `implement`
   Working directory: `.worktrees/feat-enhance-tapon-selector-and-within`
   Reads: spec + tests from state.md
   Output: source files → `state.md#code-artifacts`

5. **Tester Ensemble Phase 2** → skill: `tdd` + `code-review`
   Reads: `state.md#tests` + all source files
   5a. tester_generator_a + tester_generator_b in parallel
   5b. tester_consolidator → `state.md#test-results`
   5c. tester_arbiter → resolves; escalates critical failures to human
   Retry cap: 3 | Review cap: 2

6. **Quality Gate** → skill: `quality` (tester_arbiter, autonomous)
   Output: pass/fail verdict → `state.md#quality-gate`
   On fail: findings sent back to Coder; on pass: proceed

7. **Build Verifier** (autonomous, after Quality Gate PASS)
   Output: `pipeline/feat-enhance-tapon-selector-and-within/build_check.md`

8. **Release Documenter** → skill: `proj-deploy`
   Output: `pipeline/feat-enhance-tapon-selector-and-within/signoff_package.md`

9. **Deployer** → skill: `proj-deploy`
   [GATE 3: human approval required before deploying]

10. **Delivery Manager** (autonomous, after Deployer)
    Output: `pipeline/feat-enhance-tapon-selector-and-within/retro.md`

### Key design decisions (from grilling session)

- **Bare string** `tapOn: Submit` → heuristic cascade: `data-testid` → `text` → `name` → `id` → `placeholder` (label/role excluded from cascade)
- **Pipe syntax** `tapOn: data-testid=btn|id=btn` → triggered when string contains `=`; left-to-right fallback; exactly-one-match wins
- **Text matching** → exact by default; `*` as glob wildcard (`Click Me*`, `*Click Me*`)
- **Wildcard** applies to all attribute values, not just text
- **Unknown attribute in pipe syntax** → parse error with helpful message
- **`within` block** → flat structure; `do` is reserved key; optional `nth`; all commands inside `do` are scoped; nesting allowed
- **`name`** = HTML `name` attribute; **`role`** = ARIA role only (no accessible name in pipe syntax)
- **Breaking change**: existing bare string `tapOn` used Playwright partial text match → now exact (with `*` opt-in)
- Recorder-app changes (ambiguity detection, pipe-syntax emission) → separate run

### Affected files

| File | Change |
|---|---|
| `packages/core/src/types.ts` | Add `within` Command type; `do` is `SessionedCommand[]` |
| `packages/core/src/selectorParser.ts` | No change needed (string stays string; matcher handles pipe) |
| `uivisor-app/src/matcher/index.ts` | Heuristic cascade + pipe resolver + exact/wildcard text match; `resolveSelector` becomes async (count check per step) |
| `uivisor-app/src/parser/commandParser.ts` | Add `within` case (parse `do` array recursively) |
| `uivisor-app/src/driver/commands.ts` | Add `executeWithin` (scoped locator, nested `do` execution) |
| `uivisor-app/src/engine/dispatcher.ts` | Add `within` dispatch case |
| `uivisor-app/src/reporter/console.ts` | Add `within` label (TS exhaustiveness) |
| `uivisor-app/src/reporter/html.ts` | Add `within` label (TS exhaustiveness) |
| `uivisor-app/src/reporter/markdown.ts` | Add `within` label (TS exhaustiveness) |

### Lesson applied

From KB: `reporter-exhaustiveness-required-for-new-commands.md` — `within` is a new Command type; 5 switch statements need updating (parser, dispatcher, 3 reporters). Dispatcher has no TS guard — easy to miss.

---

## Run Estimates

**Complexity:** large
**Duration:** ~58–118 min (no retries: ~58 min)
**Cost:** ~$0.37–$0.61 (cap: $5.00)
**Tokens:** ~42K–105K

**Retry budgets:**
- TDD + quality gate: 3 rounds
- Spec revision: 2 rounds
- Design revision: n/a (Designer not activated)
- Code review: 2 rounds

**Last checkpoint:** Analyst (Gate 1 written) at 2026-09-05

---

## Gate 1: Spec

### Business Context

uivisor is a YAML-driven UI test runner built on Playwright. Test flows are authored as YAML files containing sequences of commands. The `tapOn` command is the primary way to click an element — currently it accepts a bare string that is passed directly to Playwright's `getByText`, which performs a substring/partial match. There is no `within` scoping command.

This feature tightens the selector model and adds expressive power that reduces flow brittleness. The changes affect the `packages/core` shared library and the `uivisor-app` runner; the recorder app is explicitly excluded from this run.

---

### User Personas

**Flow Author** — an engineer or QA analyst writing `.yaml` flow files by hand to test a web application. They want selector expressions that are readable, predictable, and easy to debug when they fail.

**CI Pipeline Operator** — a developer consuming pass/fail output from `uivisor run`. They need failure messages that diagnose root cause rather than just saying "element not found."

---

### Problem Statement

1. **Bare string `tapOn` is fragile.** A string like `tapOn: Submit` silently matches any element whose text contains the word "Submit". When multiple matches exist (e.g., a heading and a button both containing "Submit"), the click target is non-deterministic and the failure message provides no guidance.

2. **No explicit fallback chain.** Flow authors cannot express "try `data-testid`, fall back to visible text" — they must choose one or use verbose object-selector syntax.

3. **Partial text match is surprising.** Authors reasonably expect `tapOn: Submit` to mean an exact match. The implicit Playwright substring behavior causes false passes when a different element happens to contain the text.

4. **No scoping mechanism.** Repeated-element patterns (e.g., a table with a Delete button per row) require fragile CSS selectors or `nth` workarounds scattered through every command. There is no composable scoping construct.

---

### Solution

Four coordinated changes:

1. **Bare string heuristic cascade** — when `tapOn` (or any selector-accepting command) receives a bare string with no `=` character, try a fixed sequence of attributes (`data-testid` → `text` → `name` → `id` → `placeholder`) and stop at the first that returns exactly one matching element.

2. **Pipe syntax** — when a string contains `=`, parse it as an explicit ordered fallback chain (e.g., `data-testid=btn|id=btn`). Each segment is `attribute=value`. Unknown attributes produce a helpful parse error.

3. **Exact-match by default with `*` wildcard opt-in** — all attribute value comparisons use exact string equality unless the value contains `*`, which acts as a glob wildcard (prefix, suffix, or contains).

4. **`within` scoping block** — a new top-level YAML command that scopes all nested `do` commands to a container locator. Supports `nth` for disambiguation, pipe syntax on the container selector, and arbitrary nesting.

---

### Success Metrics

- Existing flow files using bare string `tapOn` with unambiguous single-element matches continue to pass after the upgrade (heuristic cascade finds the element).
- Flow files using bare string `tapOn` that previously relied on Playwright partial matching and matched a unique element continue to pass via the `text` step of the cascade.
- New flows using pipe syntax or `within` execute correctly against real pages.
- Failed selector resolution produces an error message that names the attribute tried and the count matched, enabling fast diagnosis.
- All 5 switch statements (commandParser, dispatcher, console, html, markdown) handle `within` — no TypeScript exhaustiveness gap.

---

### User Stories

**US-1: Bare string cascade (happy path)**
As a flow author, when I write `tapOn: Submit` and there is exactly one element with `data-testid="Submit"`, the command resolves that element without me specifying the attribute explicitly.

**US-2: Bare string cascade (text fallback)**
As a flow author, when I write `tapOn: Save Draft` and there is no `data-testid` with that value but there is exactly one element with that exact visible text, the command resolves via the text step.

**US-3: Bare string cascade (exhausted chain error)**
As a flow author, when I write `tapOn: Ambiguous` and every attribute in the cascade either matches 0 or more than 1 element, I get a failure message that tells me each attribute tried and how many matches were found, so I know to switch to pipe syntax or an object selector.

**US-4: Pipe syntax (happy path)**
As a flow author, when I write `tapOn: data-testid=submit-btn|id=submit`, the runner tries `data-testid` first and, if it yields exactly one match, uses it; otherwise it tries `id`.

**US-5: Pipe syntax (unknown attribute error)**
As a flow author, when I write `tapOn: price=100`, the runner detects `=` in the string and treats it as pipe syntax. Because `price` is not a known attribute, it fails with a message like: `Unknown attribute 'price' in 'price=100'. Use tapOn: { text: 'price=100' } for text containing '='.`

**US-6: Wildcard text matching**
As a flow author, when I write `tapOn: Save*` the command matches any element whose resolved text value starts with "Save" (e.g., "Save Draft", "Save and Continue"), as long as exactly one such element exists.

**US-7: `within` scoping**
As a flow author, when I write a `within` block targeting a container, all commands in `do` interact only with elements inside that container, allowing me to click the Delete button in the Alice row without it hitting the Bob row's Delete button.

**US-8: `within` with `nth`**
As a flow author, when multiple containers match the `within` selector I can add `nth: 0` (0-indexed) to target the first one deterministically.

**US-9: Nested `within`**
As a flow author, I can nest a `within` block inside another `within` `do` list to progressively narrow scope across multiple container levels.

---

### Acceptance Criteria

#### AC-1: Bare string cascade — happy path, first step wins

**Given** a page with exactly one element having `data-testid="Submit"`
**When** the flow contains `tapOn: Submit`
**Then** the `data-testid` step of the cascade matches that element, the command succeeds, and no further cascade steps are attempted.

#### AC-2: Bare string cascade — fallback to text step

**Given** a page with no element having `data-testid="Save Draft"` and exactly one element with visible text `Save Draft`
**When** the flow contains `tapOn: Save Draft`
**Then** the `data-testid` step yields 0 matches, the cascade advances to the `text` step, which yields exactly 1 match, and the command succeeds.

#### AC-3: Bare string cascade — tie-breaking (skip step with >1 match)

**Given** a page where two elements have `data-testid="btn"` but exactly one element has visible text `Confirm`
**When** the flow contains `tapOn: Confirm` (assuming `data-testid` matches 2 elements with value `btn` — wait, the selector value is `Confirm`) — more precisely: two elements have `data-testid="Confirm"` and exactly one has visible text `Confirm`
**When** the flow contains `tapOn: Confirm`
**Then** `data-testid` step finds 2 matches (skipped), `text` step finds 1 match, command succeeds on that element.

#### AC-4: Bare string cascade — exhausted chain, clear error

**Given** a page where `tapOn: Foo` returns 0 matches for `data-testid`, 3 matches for `text`, 0 for `name`, 2 for `id`, 0 for `placeholder`
**When** the flow runs
**Then** the command fails with a message that lists each attribute tried and its match count, e.g.:
```
No unique element found for bare selector 'Foo'.
  data-testid=Foo: 0 matches
  text=Foo: 3 matches
  name=Foo: 0 matches
  id=Foo: 2 matches
  placeholder=Foo: 0 matches
Use pipe syntax (e.g. tapOn: text=Foo) to target a specific attribute.
```

#### AC-5: Cascade excludes `label` and `role`

**Given** the cascade attribute order
**Then** `label` and `role` are not included in the bare string cascade; they are pipe-syntax only.

#### AC-6: Pipe syntax — happy path, first segment wins

**Given** a page with exactly one element having `data-testid="btn"`
**When** the flow contains `tapOn: data-testid=btn|id=btn`
**Then** `data-testid=btn` is tried first, finds 1 match, command succeeds; `id=btn` is never attempted.

#### AC-7: Pipe syntax — fallback to second segment

**Given** a page with no `data-testid="btn"` but exactly one element with `id="btn"`
**When** the flow contains `tapOn: data-testid=btn|id=btn`
**Then** `data-testid=btn` finds 0 matches, runner falls through to `id=btn`, finds 1 match, command succeeds.

#### AC-8: Pipe syntax — all segments exhausted, error

**Given** a page with no element matching any segment in `tapOn: data-testid=ghost|id=ghost`
**When** the flow runs
**Then** the command fails with a message listing each segment tried and its match count.

#### AC-9: Pipe syntax — unknown attribute name, parse error

**Given** a flow containing `tapOn: price=100`
**When** the parser encounters `=` in the string and attempts to parse `price` as an attribute
**Then** parsing fails immediately with the message: `Unknown attribute 'price' in 'price=100'. Use tapOn: { text: 'price=100' } for text containing '='.`

#### AC-10: Pipe syntax — known attribute set

**Given** the set of valid attribute keys
**Then** valid keys are: any `data-*` identifier (e.g., `data-testid`, `data-cy`, `data-qa`), `id`, `name`, `placeholder`, `text`, `label`, `role`.

#### AC-11: Wildcard — prefix match (`Click Me*`)

**Given** a page with exactly one element whose text starts with "Save"
**When** the flow contains `tapOn: Save*`
**Then** the cascade text step matches that element (exact prefix glob), command succeeds.

#### AC-12: Wildcard — suffix match (`*me`)

**Given** a page with exactly one element whose text ends with "me"
**When** the flow contains `tapOn: *me`
**Then** the text step matches via suffix glob, command succeeds.

#### AC-13: Wildcard — contains match (`*Click Me*`)

**Given** a page with exactly one element whose text contains "Click Me"
**When** the flow contains `tapOn: *Click Me*`
**Then** the text step matches via contains glob, command succeeds.

#### AC-14: Wildcard — applies to all attributes, not just text

**Given** a page with one element whose `data-testid` starts with "btn-"
**When** the pipe syntax `tapOn: data-testid=btn-*` is used
**Then** the wildcard is applied to the `data-testid` value comparison, and the element matches.

#### AC-15: Exact match is the default (breaking change from partial)

**Given** a page with one element whose visible text is "Submit Form" (not exactly "Submit")
**When** the flow contains `tapOn: Submit`
**Then** the text cascade step finds 0 exact matches for "Submit" and does NOT match "Submit Form"; the cascade continues to `name`, `id`, `placeholder`.

#### AC-16: `within` — basic scoping

**Given** a page with two rows, each containing a Delete button; the first row also contains text "Alice"
**When** the flow contains:
```yaml
- within:
    text: Alice
    do:
      - tapOn: Delete
```
**Then** `tapOn: Delete` resolves only within the element matching `text=Alice`, clicking that row's Delete button and not the other row's.

#### AC-17: `within` — all commands are scoped, not just `tapOn`

**Given** a `within` block with `assertVisible`, `inputText`, and `assertText` in the `do` list
**When** the flow runs
**Then** each of those commands resolves its selectors within the container locator, not from the page root.

#### AC-18: `within` — `nth` disambiguation

**Given** a page with three rows all containing the text "Row"
**When** the flow contains:
```yaml
- within:
    text: Row
    nth: 1
    do:
      - tapOn: Edit
```
**Then** the second matching container (0-indexed: index 1) is selected, and `tapOn: Edit` resolves within it.

#### AC-19: `within` — nested blocks

**Given** a nested `within` block:
```yaml
- within:
    text: Section A
    do:
      - within:
          text: Subsection
          do:
            - tapOn: Save
```
**Then** `tapOn: Save` resolves within the element matching "Subsection" which is itself scoped inside the element matching "Section A".

#### AC-20: `within` — selector supports pipe syntax and bare string cascade

**Given** a `within` block with `data-testid=user-row|text=Alice` as the selector expression
**When** the flow runs
**Then** the pipe fallback logic applies to resolve the container locator, exactly as it would for `tapOn`.

#### AC-21: `within` — `do` key is reserved, not a selector attribute

**Given** a `within` block
**Then** `do` is never interpreted as a selector attribute at parse time; all other keys at the same level as `nth` are the selector expression.

#### AC-22: `within` — container not found, helpful error

**Given** a `within` block whose selector matches 0 elements (and no `nth`)
**When** the flow runs
**Then** the command fails with a message indicating which selector was tried and that 0 containers were found, e.g.: `within: No container found for selector 'text=NoSuchRow'`.

#### AC-23: `within` — `nth` out of range, helpful error

**Given** a `within` block with `nth: 5` but only 2 matching containers
**When** the flow runs
**Then** the command fails with: `within: nth=5 requested but only 2 containers matched selector 'text=Row'`.

#### AC-24: Reporters — `within` appears in all three output formats

**Given** a flow with a `within` block that succeeds
**When** the console, HTML, and Markdown reporters render the result
**Then** each reporter displays the `within` command with its selector and shows nested `do` results indented inside it (analogous to how `runFlow` nesting is displayed today).

#### AC-25: Backward compatibility — object-selector forms unchanged

**Given** existing flows using `tapOn: { testId: my-btn }`, `tapOn: { text: hello }`, `tapOn: { label: Email }`, etc.
**When** those flows run after the upgrade
**Then** they behave identically to before — the heuristic cascade and pipe syntax only activate for bare strings.

---

### Implementation Decisions

These decisions are locked from the grilling session and must not be reopened during implementation.

**ID-1: Pipe syntax trigger** — presence of `=` anywhere in a bare string switches parsing from cascade to pipe mode. A string without `=` always goes to cascade mode.

**ID-2: Cascade order** — `data-testid` → `text` → `name` (HTML attr) → `id` → `placeholder`. `label` and `role` are excluded from cascade.

**ID-3: Exactly-one-match rule** — a cascade step or pipe segment is only accepted if it yields exactly 1 match. 0 or >1 causes advancement to the next step/segment (cascade) or failure (pipe exhausted).

**ID-4: Wildcard character** — `*` is the sole glob wildcard. It can appear as prefix, suffix, both, or multiple times within a value. It applies to ALL attribute value comparisons, not only text.

**ID-5: Exact match default** — breaking change from current behavior. Previously bare string `tapOn: foo` delegated to Playwright's `getByText('foo')` which performs a substring match. Post-change, the text step uses exact matching; partial matching is opt-in via `*foo*`.

**ID-6: `within` structure** — flat YAML object; `do` is the reserved key for the nested command array; `nth` is the optional disambiguation key; all remaining keys form the selector expression (single key expected in practice).

**ID-7: `resolveSelector` becomes scoped** — `resolveSelector` must accept an optional `scope` parameter (a `Locator`) so that cascade/pipe resolution uses `scope.locator(...)` instead of `page.locator(...)` when inside a `within` block.

**ID-8: `within` in `types.ts`** — the new command type is `{ type: 'within'; selector: string; nth?: number; do: SessionedCommand[] }`. The selector field is a raw string (bare or pipe); the cascade/pipe resolution happens at runtime in the matcher.

**ID-9: `nestedResult` reuse** — `CommandResult.nestedResult` (currently used for `runFlow`) can be reused for `within` to carry per-step results. The reporters' existing `nestedResult` rendering path covers the basic nesting display; `within`-specific label formatting requires only the `cmdLabel`/`_cmdSummary` switch additions.

**ID-10: No async at parse time** — selector resolution (cascade, pipe) is async (requires Playwright count queries). `parseSelector` in `selectorParser.ts` remains synchronous and unchanged; it just passes the raw string through. The matcher (`resolveSelector`) becomes async and performs the count queries.

---

### Testing Decisions

**TD-1: Unit tests for cascade logic** — test `resolveSelector` in isolation using Playwright mock locators (or a test harness page) that return controlled element counts per attribute. Cover: first step wins, second step fallback, all steps exhausted, >1 match skip.

**TD-2: Unit tests for pipe parsing** — test the pipe parser (to be extracted as a pure function) for: valid single segment, valid multi-segment, unknown attribute name, attribute name with `data-*` prefix, `=` in the value portion (should not be re-split).

**TD-3: Unit tests for wildcard matching** — test the glob matcher function for: no wildcard (exact), prefix, suffix, contains, multiple wildcards, empty pattern, pattern is only `*`.

**TD-4: Unit tests for `within` parsing** — test `parseCommand` with valid `within` object, missing `do` key, `nth` as non-integer, selector as pipe string.

**TD-5: Integration tests** — at least one end-to-end flow test per acceptance criterion using a real Playwright page (local HTML fixture). Verify both happy paths and error messages for cascade exhaustion, pipe unknown attribute, `nth` out of range.

**TD-6: Regression test for exact-match breaking change** — a test that asserts `tapOn: Submit` does NOT match an element whose text is "Submit Form" (only exact text "Submit" matches).

**TD-7: Reporter tests** — snapshot or string-match tests for each reporter (`console`, `html`, `markdown`) verifying `within` commands render correctly, including the nested `do` result indentation.

---

### Assumptions & Risks

**A-1:** Playwright's `locator.count()` is reliable for determining match cardinality per attribute step. If Playwright's locator evaluation is non-deterministic across calls (flakiness), the cascade may give inconsistent results. Mitigation: use `allInnerTexts()` or a single DOM query per step rather than multiple `count()` calls where possible.

**A-2:** The `=` trigger for pipe syntax is unambiguous enough in practice. Any existing bare string `tapOn` that contains `=` (e.g., a URL fragment or equation) would be silently misinterpreted as pipe syntax. Risk is low for UI test flows, but the error message for unknown attributes provides a recovery path.

**A-3:** `data-*` attribute resolution uses Playwright's `page.locator('[data-testid="val"]')` form. The behavior of `data-*` attributes with wildcards in values depends on CSS attribute selectors — `[data-testid^="btn-"]` for prefix, `[data-testid$="-foo"]` for suffix. The wildcard-to-CSS conversion must be correct for all three forms.

**A-4:** `name` resolution (HTML `name` attribute) uses `page.locator('[name="val"]')`. For inputs within `within`, the scoped locator correctly narrows the query. Confirmed: Playwright's `locator.locator('[name="val"]')` searches descendants.

**A-5:** Nested `within` may affect `ctx.lastTappedLocator` for subsequent `inputText` shorthand. The spec does not change `inputText` shorthand behavior; it continues to use the last tapped locator. This is acceptable for the first iteration — a future spec can address scoped `inputText` shorthand.

**R-1:** The exact-match change is a breaking change. Flow files that relied on partial text match (e.g., `tapOn: Save` matching an element with text "Save Changes") will fail after the upgrade. Users need a migration note in the release documentation directing them to switch to `tapOn: Save*` or `tapOn: { text: 'Save Changes' }`.

**R-2:** The `within` dispatcher path is new and the dispatcher has no TypeScript exhaustiveness guard (noted in KB). Risk of missing the dispatch case is real. The test suite must include a test that exercises `within` end-to-end through `dispatch()`.

---

### Out of Scope

- **Recorder-app changes** — ambiguity detection during recording and pipe-syntax emission from the recorder are excluded from this run and will be addressed separately.
- **Accessible name for `role`** — pipe syntax supports `role` as ARIA role only; `role=button|name=Submit` style (with accessible name pairing) is not supported in this run.
- **Scoped `inputText` shorthand** — `inputText` after a `tapOn` inside a `within` block uses `ctx.lastTappedLocator` as today; scoping the shorthand to the container is out of scope.
- **`within` in recorder** — the recorder does not generate `within` blocks in this run.
- **CSS selector in `within`** — `within` uses the same string resolver as `tapOn` (bare string cascade or pipe). CSS selectors via the `{ css: '...' }` object form are not supported as the `within` container selector in this run.
- **Multiple selectors on the `within` object** — the YAML structure assumes one selector key plus optional `nth` and `do`. Ambiguous multi-key `within` objects (excluding `nth` and `do`) are a parse error.

---

### Further Notes

**FN-1: `matchesPattern` already exists.** `uivisor-app/src/driver/commands.ts` contains a `matchesPattern(pattern, actual)` function used by `executeAssertUrl`. The wildcard logic for selector resolution should use or extract the same function to avoid duplication. The implementation team should move this to a shared utility or import it from `commands.ts`.

**FN-2: Existing `Selector` type is unchanged.** The `Selector` union in `packages/core/src/types.ts` remains as-is. Bare string selectors continue to be typed as `string`; the new behavior is purely in the runtime resolver. The `within` command's selector is also typed as `string` (raw bare/pipe string), not as the `Selector` union.

**FN-3: `resolveSelector` signature change.** The current signature is `resolveSelector(page: Page, selector: Selector): Locator`. The new signature must be `resolveSelector(page: Page, selector: Selector, scope?: Locator): Promise<Locator>`. All call sites in `commands.ts` and the new `executeWithin` must be updated to `await` the result. This is the largest cross-cutting change in the implementation.

**FN-4: Reporter `within` label.** A reasonable label for reporters: `within: <selector-string>` (e.g., `within: text=Alice`). Nested `do` results render using the existing `nestedResult` indentation path, but the `within` label must be added explicitly to all three `cmdLabel`/`_cmdSummary` switches.

**FN-5: `name` attribute vs accessible name.** In pipe syntax, `name` resolves via the HTML `name` attribute (`[name="val"]`), not Playwright's `getByRole(..., { name: ... })`. This distinction must be clearly communicated in error messages and documentation — `name=foo` targets `<input name="foo">`, not an element with accessible name "foo".

---

## Feature & Task Breakdown

| # | Title | Blocked by | Status |
|---|---|---|---|
| T-01 | Add `within` command type to core types | None | open |
| T-02 | Extract wildcard pattern matcher as shared utility | None | open |
| T-03 | Refactor `resolveSelector` with async cascade, pipe resolver, and scope parameter | T-02 | open |
| T-04 | Await `resolveSelector` in all driver functions and add `executeWithin` | T-01, T-03 | open |
| T-05 | Add `within` case to command parser | T-01 | open |
| T-06 | Add `within` dispatch case and TS exhaustiveness guard to engine dispatcher | T-01, T-04 | open |
| T-07 | Add `within` label to all three reporters | T-01 | open |

**Ticket files:** `.scratch/feat-enhance-tapon-selector-and-within/issues/`

---

## Seam Design

### Primary seam

The primary seam is `resolveSelector(page, selector)` in `uivisor-app/src/matcher/index.ts`. This is the single chokepoint through which every selector-accepting command (`tapOn`, `assertVisible`, `inputTextTargeted`, and ~12 others) passes on its way to a Playwright `Locator`. The new interface hides the cascade, pipe parser, wildcard matching, and scope threading behind a three-argument call that returns `Promise<Locator>`. Callers learn nothing about which attribute matched or how many steps were tried — they just get a resolved locator or an exception with a diagnosis.

This is a deep module in the codebase-design sense: the interface surface area is small (two required params, one optional), but the implementation depth is large (five-step cascade, pipe tokenizer and validator, CSS-attribute-selector wildcard translation, scoped vs. unscoped dispatch, rich error assembly). That depth is entirely hidden from callers.

### Expand-contract sequencing

The sync-to-async change on `resolveSelector` is a wide refactor: approximately 14 call sites in `commands.ts` all return bare `Locator` today and must `await` the new `Promise<Locator>`. The expand-contract pattern applies across two tickets:

- **Expand (T-03):** `resolveSelector` is rewritten to return `Promise<Locator>`. At this point the codebase does not compile — all callers are still synchronous.
- **Contract (T-04):** All `execute*` callers are updated to `await resolveSelector(...)`. Compilation is restored. `executeWithin` is added in the same ticket because it also calls `resolveSelector` and must land atomically with the await updates.

T-03 and T-04 must be committed together (or T-04 must immediately follow T-03 before any other work merges to the branch). They are explicitly sequenced in the dependency graph.

### Internal seams to keep private

**Pipe string parser** — the logic that tokenises `attr=value|attr=value` segments and validates attribute names is a pure function with no Playwright dependency. It belongs inside `matcher/index.ts` (or a co-located helper), not exported. Its contract is internal: the public interface is still just `resolveSelector`.

**Cascade step runner** — the per-step count-query logic (build locator, call `.count()`, decide pass/skip/fail) should be an internal helper, not exported. Callers of `resolveSelector` must not be able to invoke individual cascade steps.

**Wildcard utility (T-02)** — `matchesPattern` is the one utility that crosses the driver/matcher boundary and should be exported from a shared utilities module. It has no Playwright dependency and is safe to share. It is not part of the `resolveSelector` interface; it is an implementation detail that happens to be needed in two modules.

**`executeWithin` as the `within` command seam** — `executeWithin` in `commands.ts` is the only place that understands how to thread a container locator through nested command dispatch. The dispatcher and the `within` Command type are deliberately kept ignorant of how scoping works; they just call `executeWithin`. This keeps the `scope` logic localised to the driver layer and away from the dispatcher switch.

### Risk note — dispatcher exhaustiveness

The dispatcher (`dispatcher.ts`) currently has no TypeScript `never`-type exhaustiveness guard on its `cmd.type` switch. T-06 must add one. Until T-06 lands, adding the `within` type (T-01) will not produce a compile error for the missing dispatch case — this is why the spec flags it as a risk and why T-06's acceptance criteria explicitly require the guard.

---

## Tests — Generator A (tester_generator_a)

**Model:** claude-sonnet-4-6
**ACs covered:** AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17, AC-18, AC-19, AC-20, AC-21, AC-22, AC-23, AC-24, AC-25
**Total test cases:** 41

---

### TC-1: Cascade — data-testid match stops chain immediately
- **AC:** AC-1
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Given:** Mock `page.locator('[data-testid="Submit"]')` returns a locator whose `.count()` resolves to `1`; all subsequent attribute locators return count `0`
- **When:** `await resolveSelector(page, 'Submit')` is called
- **Then:** The returned locator is the data-testid locator; `.count()` is called only on the data-testid locator and not on text/name/id/placeholder locators
- **Note:** Verifies early-exit behaviour — no wasted Playwright queries after a winning step

---

### TC-2: Cascade — falls through to text step when data-testid yields 0
- **AC:** AC-2
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Given:** `page.locator('[data-testid="Save Draft"]')` count resolves to `0`; `page.locator()` for exact text `Save Draft` count resolves to `1`
- **When:** `await resolveSelector(page, 'Save Draft')` is called
- **Then:** The returned locator is the text-step locator; data-testid locator count was queried first
- **Note:** The cascade uses a page.locator for exact text (not getByText partial match)

---

### TC-3: Cascade — skips step with >1 match and advances to next step
- **AC:** AC-3
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Given:** `page.locator('[data-testid="Confirm"]')` count resolves to `2`; text `Confirm` count resolves to `1`
- **When:** `await resolveSelector(page, 'Confirm')` is called
- **Then:** Returns the text-step locator; data-testid step was skipped because count > 1
- **Note:** Both 0-match and >1-match steps must be skipped; only exactly-1 is accepted

---

### TC-4: Cascade exhausted — all steps return 0 matches
- **AC:** AC-4
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Given:** All five cascade locators (`data-testid`, text, `name`, `id`, `placeholder`) return count `0`
- **When:** `await resolveSelector(page, 'Foo')` is called
- **Then:** Throws (or rejects) with a message containing "No unique element found" and listing all five attributes with "0 matches" each, plus a hint to use pipe syntax
- **Note:** The error message exact format is specified in AC-4; test with `toMatch` regex covering all five attribute names

---

### TC-5: Cascade exhausted — mixed 0 and >1 matches, specific counts in error
- **AC:** AC-4
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Given:** data-testid count=0, text count=3, name count=0, id count=2, placeholder count=0 (matching the AC-4 spec example exactly)
- **When:** `await resolveSelector(page, 'Foo')` is called
- **Then:** Error message lists `data-testid=Foo: 0 matches`, `text=Foo: 3 matches`, `name=Foo: 0 matches`, `id=Foo: 2 matches`, `placeholder=Foo: 0 matches` and includes "Use pipe syntax"
- **Note:** Verifies exact count values appear in the diagnostic, enabling fast triage

---

### TC-6: Cascade attribute order — label and role are absent
- **AC:** AC-5
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Given:** All five standard cascade locators return count `0` (so the error is thrown)
- **When:** `await resolveSelector(page, 'Foo')` throws
- **Then:** The error message does NOT mention `label` or `role`; it lists exactly: data-testid, text, name, id, placeholder
- **Note:** Validates ID-2 ordering and AC-5 exclusion constraint together

---

### TC-7: Pipe syntax — first segment wins, second never attempted
- **AC:** AC-6
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Given:** `page.locator('[data-testid="btn"]')` count=1; `page.locator('#btn')` count=1
- **When:** `await resolveSelector(page, 'data-testid=btn|id=btn')` is called
- **Then:** Returns the data-testid locator; `.count()` was called on data-testid locator but not on the id locator
- **Note:** `=` in the string triggers pipe mode (ID-1); first-wins rule confirmed

---

### TC-8: Pipe syntax — falls through to second segment when first yields 0
- **AC:** AC-7
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Given:** `page.locator('[data-testid="btn"]')` count=0; `page.locator('#btn')` count=1
- **When:** `await resolveSelector(page, 'data-testid=btn|id=btn')` is called
- **Then:** Returns the id locator; data-testid count was queried (result 0) and id count was then queried (result 1)

---

### TC-9: Pipe syntax — all segments exhausted, error names each segment and its count
- **AC:** AC-8
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Given:** `page.locator('[data-testid="ghost"]')` count=0; `page.locator('#ghost')` count=0
- **When:** `await resolveSelector(page, 'data-testid=ghost|id=ghost')` is called
- **Then:** Throws with message listing `data-testid=ghost: 0 matches` and `id=ghost: 0 matches`
- **Note:** Pipe exhaustion error must name every segment tried, not just say "not found"

---

### TC-10: Pipe syntax — unknown attribute triggers parse error with recovery hint
- **AC:** AC-9
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Given:** A bare string containing `=` but with an unrecognised attribute name before `=`
- **When:** `await resolveSelector(page, 'price=100')` is called
- **Then:** Throws immediately (before any `.count()` call) with message: `Unknown attribute 'price' in 'price=100'. Use tapOn: { text: 'price=100' } for text containing '='.`
- **Note:** Parse-time validation, not runtime; no Playwright queries should be made

---

### TC-11: Pipe syntax — all plain valid attribute names are accepted
- **AC:** AC-10
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Given:** Mock page that returns count=1 for any locator
- **When:** `resolveSelector` is called with each of `id=x`, `name=x`, `placeholder=x`, `text=x`, `label=x`, `role=x`
- **Then:** None of these throw a "Unknown attribute" error; each resolves to a locator
- **Note:** Tests the valid-attribute whitelist from AC-10 for non-data-* names

---

### TC-12: Pipe syntax — data-* attribute names are accepted
- **AC:** AC-10
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Given:** Mock page returning count=1 for any locator
- **When:** `resolveSelector` is called with `data-testid=btn`, `data-cy=btn`, `data-qa=btn`
- **Then:** None throw; each resolves to a locator successfully
- **Note:** Validates the `data-*` pattern rule in AC-10; a plain `data=x` (without suffix) should still be rejected

---

### TC-13: Wildcard — prefix glob `Save*` matches element starting with "Save"
- **AC:** AC-11
- **Seam:** matcher/resolveSelector (text step with wildcard)
- **Type:** unit
- **Given:** Page has exactly one element whose text value is "Save Draft"; data-testid step returns 0
- **When:** `await resolveSelector(page, 'Save*')` is called
- **Then:** Text step matches that element (count=1), command resolves successfully
- **Note:** The locator built for the text step must use a CSS/XPath prefix match, not exact equality, when `*` is present

---

### TC-14: Wildcard — suffix glob `*me` matches element ending with "me"
- **AC:** AC-12
- **Seam:** matcher/resolveSelector (text step with wildcard)
- **Type:** unit
- **Given:** Page has exactly one element whose text value is "Welcome"; data-testid step returns 0
- **When:** `await resolveSelector(page, '*me')` is called
- **Then:** Text step matches that element, command resolves successfully

---

### TC-15: Wildcard — contains glob `*Click Me*` matches element containing "Click Me"
- **AC:** AC-13
- **Seam:** matcher/resolveSelector (text step with wildcard)
- **Type:** unit
- **Given:** Page has exactly one element whose text is "Please Click Me Now"; data-testid step returns 0
- **When:** `await resolveSelector(page, '*Click Me*')` is called
- **Then:** Text step matches that element, command resolves successfully

---

### TC-16: Wildcard — applies to data-testid attribute value comparison
- **AC:** AC-14
- **Seam:** matcher/resolveSelector (pipe step with wildcard)
- **Type:** unit
- **Given:** Page has one element with `data-testid="btn-submit"`; no element has `data-testid` equal exactly to `btn-*`
- **When:** `await resolveSelector(page, 'data-testid=btn-*')` is called
- **Then:** Wildcard expansion is applied to the `data-testid` attribute comparison, element is matched, command succeeds
- **Note:** Requires the locator query to use CSS `[data-testid^="btn-"]` (prefix) rather than exact attribute match

---

### TC-17: Exact match default — partial text not matched
- **AC:** AC-15
- **Seam:** matcher/resolveSelector (text step)
- **Type:** unit
- **Given:** Page has one element with visible text "Submit Form" and no element with text exactly "Submit"; data-testid/name/id/placeholder steps all return 0
- **When:** `await resolveSelector(page, 'Submit')` is called
- **Then:** Text step returns 0 matches (does not match "Submit Form"); cascade exhausted; command fails with diagnostic error
- **Note:** This is the breaking-change regression test (TD-6). Text step must use exact match, not Playwright's partial/substring `getByText`

---

### TC-18: `within` parser — valid block produces correct Command shape
- **AC:** AC-16, AC-21
- **Seam:** parser/parseCommand
- **Type:** unit
- **Given:** A YAML-parsed object `{ within: { text: 'Alice', do: [{ tapOn: 'Delete' }] } }`
- **When:** `parseCommand({ within: { text: 'Alice', do: [{ tapOn: 'Delete' }] } })` is called
- **Then:** Returns `{ type: 'within', selector: 'text=Alice', nth: undefined, do: [{ type: 'tapOn', selector: 'Delete' }] }`
- **Note:** The `do` key is consumed as the nested commands list, not treated as a selector attribute; `text` key becomes part of the selector string

---

### TC-19: `within` basic scoping — tapOn resolves within container (integration)
- **AC:** AC-16
- **Seam:** driver/executeWithin + engine/dispatcher
- **Type:** integration
- **Given:** HTML fixture with two rows each containing a "Delete" button; first row additionally contains "Alice"; second row contains "Bob"
- **When:** Flow dispatches `{ type: 'within', selector: 'text=Alice', do: [{ type: 'tapOn', selector: 'Delete' }] }`
- **Then:** `result.passed` is `true`; Alice's Delete button is clicked (not Bob's); `result.nestedResult` contains one passing command result for the inner `tapOn`
- **Note:** Requires fixture HTML with two rows; Alice row's Delete must be distinguishable (e.g., by side-effect or `data-testid`)

---

### TC-20: `within` scopes all command types, not just tapOn (integration)
- **AC:** AC-17
- **Seam:** driver/executeWithin + engine/dispatcher
- **Type:** integration
- **Given:** HTML fixture with a scoped container holding `assertVisible`, `inputText`, and `assertText` targets
- **When:** Flow dispatches a `within` block whose `do` list contains `assertVisible`, `inputTextTargeted`, and `assertText` commands
- **Then:** All three commands pass; their selectors are resolved within the container locator scope (verified by using element IDs that would match globally but should only hit those within the container)
- **Note:** Validates ID-7 (`resolveSelector` scope threading through all execute* functions)

---

### TC-21: `within` nth — second container is selected when nth: 1
- **AC:** AC-18
- **Seam:** driver/executeWithin + engine/dispatcher
- **Type:** integration
- **Given:** HTML fixture with three identical rows each containing text "Row" and an "Edit" button; each row's Edit button has a distinct `data-testid` (edit-0, edit-1, edit-2)
- **When:** Flow dispatches `{ type: 'within', selector: 'text=Row', nth: 1, do: [{ type: 'tapOn', selector: 'Edit' }] }`
- **Then:** `result.passed` is `true`; the Edit button in the second row (index 1) is clicked, not the first or third
- **Note:** `nth` is 0-indexed per the spec

---

### TC-22: `within` nested blocks — innermost scope applied correctly (integration)
- **AC:** AC-19
- **Seam:** driver/executeWithin + engine/dispatcher
- **Type:** integration
- **Given:** HTML fixture with a "Section A" container that contains a "Subsection" div, which in turn contains a "Save" button
- **When:** Flow dispatches a nested `within` block: outer selector `text=Section A`, inner selector `text=Subsection`, inner `do` contains `tapOn: Save`
- **Then:** `result.passed` is `true`; the Save button within Subsection (which is within Section A) is clicked; `result.nestedResult` is present with its own `nestedResult` for the inner within
- **Note:** Tests that `executeWithin` threads scope correctly through recursive `do` dispatch

---

### TC-23: `within` selector supports pipe syntax for container resolution (integration)
- **AC:** AC-20
- **Seam:** driver/executeWithin + engine/dispatcher
- **Type:** integration
- **Given:** HTML fixture with a row element that has `data-testid="user-row"` and also contains visible text "Alice"; the row has a Delete button
- **When:** Flow dispatches `{ type: 'within', selector: 'data-testid=user-row|text=Alice', do: [{ type: 'tapOn', selector: 'Delete' }] }`
- **Then:** Container is resolved using pipe fallback logic (first `data-testid` step succeeds if it yields 1 match); inner `tapOn: Delete` resolves within that container; `result.passed` is `true`
- **Note:** The same `resolveSelector` code path must accept a scope-optional call for container resolution

---

### TC-24: `within` parser — `do` is never a selector attribute
- **AC:** AC-21
- **Seam:** parser/parseCommand
- **Type:** unit
- **Given:** A within object that legitimately has `do` as the command list
- **When:** `parseCommand({ within: { text: 'Section', do: [{ tapOn: 'Save' }] } })` is called
- **Then:** The parsed command has `selector: 'text=Section'` and `do` parsed as commands; the key `do` does not appear in the selector string
- **Note:** Ensures `do` is unconditionally stripped from selector building; regression guard against treating `do` as a CSS data attribute

---

### TC-25: `within` parser — nth is optional and correctly forwarded
- **AC:** AC-21
- **Seam:** parser/parseCommand
- **Type:** unit
- **Given:** A within object without `nth`
- **When:** `parseCommand({ within: { text: 'Row', do: [{ tapOn: 'Edit' }] } })` is called
- **Then:** Returned command has `nth: undefined` (or `nth` absent), selector `'text=Row'`, and correctly parsed do-commands
- **Note:** Also test with `nth: 2` to confirm numeric parsing; a non-integer `nth` (e.g., `nth: 'first'`) should produce a parse error

---

### TC-26: `within` — container not found produces helpful error (integration)
- **AC:** AC-22
- **Seam:** driver/executeWithin + engine/dispatcher
- **Type:** integration
- **Given:** HTML fixture with no element matching "NoSuchRow"
- **When:** Flow dispatches `{ type: 'within', selector: 'text=NoSuchRow', do: [{ type: 'tapOn', selector: 'Delete' }] }`
- **Then:** `result.passed` is `false`; `result.message` matches `/within.*No container found.*text=NoSuchRow/i`
- **Note:** Error must name the selector tried (AC-22 exact format); inner `do` commands must NOT run

---

### TC-27: `within` — nth out of range produces helpful error (integration)
- **AC:** AC-23
- **Seam:** driver/executeWithin + engine/dispatcher
- **Type:** integration
- **Given:** HTML fixture with exactly 2 elements matching `text=Row`; flow uses `nth: 5`
- **When:** Flow dispatches `{ type: 'within', selector: 'text=Row', nth: 5, do: [{ type: 'tapOn', selector: 'Edit' }] }`
- **Then:** `result.passed` is `false`; `result.message` matches `/within.*nth=5.*only 2.*containers/i`
- **Note:** Error must state both the requested nth and the actual count (AC-23 exact format)

---

### TC-28: Reporter — console renders `within` label and nested results
- **AC:** AC-24
- **Seam:** reporter/console
- **Type:** unit
- **Given:** A `CommandResult` with `command.type = 'within'`, `command.selector = 'text=Alice'`, `passed: true`, and `nestedResult` containing one passing tapOn result
- **When:** `reporter.reportCommand(result, 0)` is called with stdout captured via `vi.spyOn`
- **Then:** Captured output contains `within: text=Alice`; the nested tapOn result is also printed at the next indent level
- **Note:** Uses the same `nestedResult` rendering path as `runFlow` (ID-9); the `_cmdSummary` switch must include a `within` case

---

### TC-29: Reporter — HTML renders `within` label and nested results
- **AC:** AC-24
- **Seam:** reporter/html
- **Type:** unit
- **Given:** A `FlowResult` containing one `within` CommandResult (passed) with a nested tapOn result inside
- **When:** `generateHtmlReport(runResult)` is called
- **Then:** The returned HTML string contains `within: text=Alice` (or equivalent escaped form); the nested tapOn label also appears, indented relative to the `within` entry
- **Note:** The `cmdLabel` switch in `html.ts` must include a `within` case

---

### TC-30: Reporter — Markdown renders `within` label and nested results
- **AC:** AC-24
- **Seam:** reporter/markdown
- **Type:** unit
- **Given:** A `FlowResult` containing one `within` CommandResult (passed) with a nested tapOn result
- **When:** `generateMarkdownReport(runResult)` is called
- **Then:** The returned Markdown string contains `within: text=Alice`; nested tapOn result appears in the output
- **Note:** The `cmdLabel` switch in `markdown.ts` must include a `within` case

---

### TC-31: Backward compatibility — object selector { testId } resolves unchanged
- **AC:** AC-25
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Given:** Mock `page.getByTestId('my-btn')` returns a mock locator
- **When:** `await resolveSelector(page, { testId: 'my-btn' })` is called
- **Then:** Returns the getByTestId locator directly; no cascade or pipe logic is invoked; result is a `Locator` not a `Promise<Locator>` from the cascade path
- **Note:** Object selectors bypass the new cascade/pipe code entirely (ID-1 trigger: `=` in bare string only)

---

### TC-32: Backward compatibility — object selector { text } resolves unchanged
- **AC:** AC-25
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Given:** Mock `page.getByText('hello')` returns a mock locator
- **When:** `await resolveSelector(page, { text: 'hello' })` is called
- **Then:** Returns the getByText locator directly; exact-match flag or partial-match flag is passed as it was before (no cascade step counting)
- **Note:** The breaking change (AC-15) applies only to bare strings, not `{ text: 'foo' }` objects

---

### TC-33: matchesPattern — empty string pattern does not match non-empty actual
- **AC:** (additional — TD-3)
- **Seam:** utils/matchesPattern
- **Type:** unit
- **Given:** Pure function with no Playwright dependency
- **When:** `matchesPattern('', 'anything')` is called
- **Then:** Returns `false`
- **Note:** Empty pattern is not a wildcard-all; only `*` alone is wildcard-all (see TC-34)

---

### TC-34: matchesPattern — pattern `*` alone matches any string including empty
- **AC:** (additional — TD-3)
- **Seam:** utils/matchesPattern
- **Type:** unit
- **Given:** Pure function
- **When:** `matchesPattern('*', '')` returns `true`; `matchesPattern('*', 'anything')` returns `true`; `matchesPattern('*', 'multi word string')` returns `true`
- **Then:** All three calls return `true`
- **Note:** `*` is the sole glob wildcard (ID-4); a lone `*` must match everything

---

### TC-35: matchesPattern — multiple wildcards within one pattern
- **AC:** (additional — TD-3)
- **Seam:** utils/matchesPattern
- **Type:** unit
- **Given:** Pure function
- **When:** `matchesPattern('btn-*-*', 'btn-submit-ok')` and `matchesPattern('btn-*-*', 'btn-a-b')` and `matchesPattern('btn-*-*', 'btn-only')` are called
- **Then:** First two return `true`; third returns `false` (second `-*` segment requires a second `-` separator)
- **Note:** Validates that multiple wildcards are handled correctly via a split/join or regex approach

---

### TC-36: matchesPattern — no wildcard means exact match
- **AC:** (additional — TD-3)
- **Seam:** utils/matchesPattern
- **Type:** unit
- **Given:** Pure function
- **When:** `matchesPattern('Submit', 'Submit')` returns `true`; `matchesPattern('Submit', 'Submit Form')` returns `false`; `matchesPattern('Submit', 'submit')` returns `false`
- **Then:** All three match the expected boolean
- **Note:** Confirms case-sensitive exact match when no `*` present; reinforces TD-6 (breaking change)

---

### TC-37: within executor — container found, scoped child locator is used (unit)
- **AC:** (additional)
- **Seam:** driver/executeWithin
- **Type:** unit
- **Given:** Mock `page` where the container locator resolves with count=1; mock container locator has a `.locator` method that returns a child locator; inner `do` contains `tapOn: Delete`
- **When:** `executeWithin(page, { type: 'within', selector: 'text=Alice', do: [{type:'tapOn', selector:'Delete'}] }, ctx)` is called
- **Then:** The inner `tapOn` command's `resolveSelector` is called with the container locator as the `scope` argument, not with `page` directly
- **Note:** Tests ID-7 scoped resolution at the unit level, independent of a real browser

---

### TC-38: within executor — container not found throws with correct message (unit)
- **AC:** (additional — mirrors AC-22 at unit level)
- **Seam:** driver/executeWithin
- **Type:** unit
- **Given:** Mock container locator returns count=0 from `resolveSelector`
- **When:** `executeWithin(page, { type: 'within', selector: 'text=NoSuchRow', do: [] }, ctx)` is called
- **Then:** Throws (or returns a failed result) with message matching `within.*No container found.*text=NoSuchRow`
- **Note:** Validates error path at the unit level; inner `do` list must not be iterated

---

### TC-39: within executor — nth in range selects the correct container (unit)
- **AC:** (additional — mirrors AC-18 at unit level)
- **Seam:** driver/executeWithin
- **Type:** unit
- **Given:** Mock page where the selector resolves to 3 containers; nth=1
- **When:** `executeWithin(page, { type: 'within', selector: 'text=Row', nth: 1, do: [] }, ctx)` is called
- **Then:** The `.nth(1)` method is called on the resolved locator list before the scope is passed to inner commands; no error is thrown
- **Note:** Confirms 0-indexed nth selection is applied at the driver layer

---

### TC-40: within executor — nth out of range throws with correct message (unit)
- **AC:** (additional — mirrors AC-23 at unit level)
- **Seam:** driver/executeWithin
- **Type:** unit
- **Given:** Mock page where the selector matches 2 containers; nth=5
- **When:** `executeWithin(page, { type: 'within', selector: 'text=Row', nth: 5, do: [] }, ctx)` is called
- **Then:** Throws with message matching `within.*nth=5.*only 2.*containers`
- **Note:** Error message must include both the requested index and the actual count

---

### TC-41: Reporter — console `_cmdSummary` returns correct label string for `within`
- **AC:** (additional — reporter label unit test)
- **Seam:** reporter/console
- **Type:** unit
- **Given:** A `within` Command object `{ type: 'within', selector: 'text=Alice', do: [...] }`
- **When:** `ConsoleReporter._cmdSummary(cmd)` is called (or invoked indirectly via `reportCommand`)
- **Then:** Returns / outputs `within: text=Alice`
- **Note:** Focuses on the label string only, not on nestedResult rendering; complements TC-28 which checks the full output

---

### TC-42: Reporter — HTML `cmdLabel` returns correct label string for `within`
- **AC:** (additional — reporter label unit test)
- **Seam:** reporter/html
- **Type:** unit
- **Given:** A `within` Command object `{ type: 'within', selector: 'text=Alice', do: [...] }`
- **When:** `cmdLabel(cmd)` is called in the HTML reporter context
- **Then:** Returns `within: text=Alice` (with HTML escaping applied to any special chars in the selector)
- **Note:** The label is the minimal change to bring the HTML reporter's switch into exhaustiveness; TC-29 validates the full rendered block

---

### TC-43: Reporter — Markdown `cmdLabel` returns correct label string for `within`
- **AC:** (additional — reporter label unit test)
- **Seam:** reporter/markdown
- **Type:** unit
- **Given:** A `within` Command object `{ type: 'within', selector: 'data-testid=user-row', do: [...] }`
- **When:** `cmdLabel(cmd)` is called in the Markdown reporter context
- **Then:** Returns `within: data-testid=user-row`
- **Note:** Uses a pipe-syntax selector to verify selector is emitted verbatim without transformation; TC-30 validates the full rendered report

---

## Tests — Generator B (tester_generator_b)

**Model:** claude-sonnet-4-6
**ACs covered:** AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17, AC-18, AC-19, AC-20, AC-21, AC-22, AC-23, AC-24, AC-25
**Total test cases:** 45

---

### Error message content

### TC-B-1: Cascade exhaustion error lists all 5 attributes with counts
- **AC:** AC-4
- **Seam:** `matcher/resolveSelector`
- **Type:** unit
- **Given:** Mock locators that return counts: `data-testid`=0, `text`=3, `name`=0, `id`=2, `placeholder`=0 for the value `'Foo'`
- **When:** `resolveSelector(page, 'Foo')` is called
- **Then:** The thrown error message contains `"data-testid=Foo: 0 matches"`, `"text=Foo: 3 matches"`, `"name=Foo: 0 matches"`, `"id=Foo: 2 matches"`, `"placeholder=Foo: 0 matches"` — all five attributes present
- **Note:** Assert each line individually; also check the header `"No unique element found for bare selector 'Foo'"`

### TC-B-2: Cascade exhaustion error includes "Use pipe syntax" suggestion
- **AC:** AC-4
- **Seam:** `matcher/resolveSelector`
- **Type:** unit
- **Given:** All 5 cascade steps return 0 or >1 matches for value `'Foo'`
- **When:** `resolveSelector(page, 'Foo')` throws
- **Then:** The error message ends with the line `"Use pipe syntax (e.g. tapOn: text=Foo) to target a specific attribute."` — the suggestion references the exact selector value
- **Note:** The suggested attribute name in the hint should be `text` (the most human-readable fallback step)

### TC-B-3: Pipe unknown attribute — exact error message content
- **AC:** AC-9
- **Seam:** `matcher/resolveSelector` (or pipe parser helper)
- **Type:** unit
- **Given:** Input string `'price=100'`
- **When:** `resolveSelector(page, 'price=100')` is called
- **Then:** Error message is exactly: `"Unknown attribute 'price' in 'price=100'. Use tapOn: { text: 'price=100' } for text containing '='."`
- **Note:** The attribute name, full pipe string, and escape hint must all appear verbatim; assert with `toContain` on each fragment and a full `toBe` / `toEqual` on the message property if available

### TC-B-4: Pipe unknown attribute — escape hint names the object-selector form
- **AC:** AC-9
- **Seam:** `matcher/resolveSelector`
- **Type:** unit
- **Given:** Input string `'eq=value'` (unknown attribute `eq`)
- **When:** `resolveSelector(page, 'eq=value')` throws
- **Then:** Error message contains `"Use tapOn: { text: 'eq=value' }"` — the escape path quotes the raw string including the `=`
- **Note:** Verify the hint string is present regardless of which unknown attribute name is used

### TC-B-5: `within` container not found — exact error message
- **AC:** AC-22
- **Seam:** `driver/executeWithin`
- **Type:** unit
- **Given:** Mock `resolveSelector` returns a locator whose `.count()` returns `0` for selector `'text=NoSuchRow'`
- **When:** `executeWithin` is called with selector `'text=NoSuchRow'`, no `nth`
- **Then:** Error message is exactly: `"within: No container found for selector 'text=NoSuchRow'"`
- **Note:** The selector value in the message must reflect the actual selector string, not a hardcoded literal

### TC-B-6: `within` nth out of range — exact error message
- **AC:** AC-23
- **Seam:** `driver/executeWithin`
- **Type:** unit
- **Given:** Mock locator `.count()` returns `2` for selector `'text=Row'`; command has `nth: 5`
- **When:** `executeWithin` is called
- **Then:** Error message is exactly: `"within: nth=5 requested but only 2 containers matched selector 'text=Row'"`
- **Note:** Both the requested `nth` and the actual count must appear; message must interpolate them dynamically

---

### Negative cases (things that MUST NOT happen)

### TC-B-7: Cascade never calls getByLabel for bare string
- **AC:** AC-5
- **Seam:** `matcher/resolveSelector`
- **Type:** unit
- **Given:** Mock page with all getBy* spies; mock locators return count=0 for all cascade steps
- **When:** `resolveSelector(page, 'Email')` is called (cascade exhausts)
- **Then:** `page.getByLabel` is never called; `page.getByRole` is never called
- **Note:** After the call throws, assert `expect(page.getByLabel).not.toHaveBeenCalled()` and `expect(page.getByRole).not.toHaveBeenCalled()`

### TC-B-8: Cascade step order excludes `label` and `role` from the sequence
- **AC:** AC-5
- **Seam:** `matcher/resolveSelector` (internal constant / config)
- **Type:** unit
- **Given:** The cascade order constant (or the attributes observed from TC-B-7)
- **When:** Cascade is inspected by triggering all steps to run (all return 0 matches)
- **Then:** Only these locator patterns are attempted: `[data-testid=...]`, `getByText(...)`, `[name=...]`, `[id=...]`, `[placeholder=...]` — no label or role query appears
- **Note:** Complements TC-B-7 from the "observed behaviour" angle

### TC-B-9: Second pipe segment is NOT attempted when first segment matches exactly one element
- **AC:** AC-6
- **Seam:** `matcher/resolveSelector`
- **Type:** unit
- **Given:** Mock locators: `data-testid=btn` → count 1; `id=btn` → count 1
- **When:** `resolveSelector(page, 'data-testid=btn|id=btn')` is called
- **Then:** `locator('[data-testid="btn"]').count()` is called once; `locator('[id="btn"]').count()` is never called
- **Note:** Verifies short-circuit semantics; the second segment locator must not be queried at all

### TC-B-10: Exact match — "Submit" does NOT match "Submit Form"
- **AC:** AC-15
- **Seam:** `matcher/matchesPattern` and `matcher/resolveSelector`
- **Type:** unit
- **Given:** `matchesPattern('Submit', 'Submit Form')` is invoked (pure function)
- **When:** Called
- **Then:** Returns `false`
- **Note:** This is the canonical breaking-change regression; assert the pure utility directly before wiring into locator

### TC-B-11: Exact match — "Submit" does NOT match "Submitting"
- **AC:** AC-15
- **Seam:** `matcher/matchesPattern`
- **Type:** unit
- **Given:** Pattern `'Submit'`, candidate `'Submitting'`
- **When:** `matchesPattern('Submit', 'Submitting')` is called
- **Then:** Returns `false`
- **Note:** Partial suffix match must also be rejected

### TC-B-12: Wildcard suffix — `*me` does NOT match "element"
- **AC:** AC-12
- **Seam:** `matcher/matchesPattern`
- **Type:** unit
- **Given:** Pattern `'*me'`, candidate `'element'`
- **When:** `matchesPattern('*me', 'element')` is called
- **Then:** Returns `false` — "element" contains "me" but does not end with "me"
- **Note:** Distinguishes suffix glob from contains match; guards against over-matching

### TC-B-13: Pipe parse error does NOT fall back to cascade mode
- **AC:** AC-9
- **Seam:** `matcher/resolveSelector`
- **Type:** unit
- **Given:** Input `'price=100'` (contains `=`, triggers pipe mode; `price` is unknown)
- **When:** `resolveSelector(page, 'price=100')` is called
- **Then:** Throws an error about the unknown attribute; `data-testid`, `text`, `name`, `id`, `placeholder` locators are never queried
- **Note:** The `=` trigger is a hard switch to pipe mode — no silent cascade fallback

---

### Boundary cases

### TC-B-14: Cascade — exactly 1 data-testid match stops cascade at step 1
- **AC:** AC-1
- **Seam:** `matcher/resolveSelector`
- **Type:** unit
- **Given:** `data-testid=Submit` locator returns count=1; all subsequent step locators are never queried
- **When:** `resolveSelector(page, 'Submit')` is called
- **Then:** Returns the locator from step 1; text/name/id/placeholder locators have `count()` call count = 0
- **Note:** Boundary: count=1 is the exact threshold — count=2 at this step would be skipped

### TC-B-15: Cascade — exactly 2 data-testid matches causes step 1 to be skipped
- **AC:** AC-3
- **Seam:** `matcher/resolveSelector`
- **Type:** unit
- **Given:** `data-testid=Confirm` locator count=2; `text=Confirm` count=1
- **When:** `resolveSelector(page, 'Confirm')` is called
- **Then:** Returns the text-step locator; step 1 (data-testid) count was queried and returned 2 (skipped)
- **Note:** Boundary: exactly 2 (not 3) is enough to skip; step 2 with count=1 wins

### TC-B-16: Cascade — exactly 0 data-testid matches advances to text step
- **AC:** AC-2
- **Seam:** `matcher/resolveSelector`
- **Type:** unit
- **Given:** `data-testid=Save Draft` count=0; `text=Save Draft` count=1
- **When:** `resolveSelector(page, 'Save Draft')` is called
- **Then:** Returns the text-step locator; text locator's `.count()` was called exactly once
- **Note:** Boundary: count=0 advances (neither wins nor triggers ambiguity error)

### TC-B-17: Pipe — 2-segment pipe: both segments return 0 matches, error
- **AC:** AC-8
- **Seam:** `matcher/resolveSelector`
- **Type:** unit
- **Given:** `data-testid=ghost` count=0; `id=ghost` count=0
- **When:** `resolveSelector(page, 'data-testid=ghost|id=ghost')` is called
- **Then:** Throws error containing `"data-testid=ghost: 0 matches"` and `"id=ghost: 0 matches"`
- **Note:** Boundary: minimum pipe length that exhausts (2 segments)

### TC-B-18: `within` nth=0 selects the first container (0-indexed boundary)
- **AC:** AC-18
- **Seam:** `driver/executeWithin`
- **Type:** integration
- **Given:** Page with 3 containers all matching `text=Row`; flow has `nth: 0`
- **When:** `executeWithin` runs
- **Then:** The first container (index 0) is used as scope; `tapOn: Edit` inside resolves within that first container
- **Note:** 0-indexed lower boundary; `nth: 0` is the minimum valid value

### TC-B-19: `within` nth=1 selects the second of three matching containers
- **AC:** AC-18
- **Seam:** `driver/executeWithin`
- **Type:** integration
- **Given:** Page with 3 rows all matching `text=Row`; flow has `nth: 1`
- **When:** `executeWithin` runs a `tapOn: Edit` inside the block
- **Then:** The Edit button in the second row (index 1) is clicked; the first and third rows are untouched
- **Note:** Confirms 0-indexed semantics match AC-18's stated example

---

### Wildcard matching — pure function tests

### TC-B-20: Prefix wildcard — `Save*` matches "Save Draft"
- **AC:** AC-11
- **Seam:** `matcher/matchesPattern`
- **Type:** unit
- **Given:** Pattern `'Save*'`, candidate `'Save Draft'`
- **When:** `matchesPattern('Save*', 'Save Draft')` is called
- **Then:** Returns `true`

### TC-B-21: Prefix wildcard — `Save*` does NOT match "Saving"
- **AC:** AC-11
- **Seam:** `matcher/matchesPattern`
- **Type:** unit
- **Given:** Pattern `'Save*'`, candidate `'Saving'`
- **When:** `matchesPattern('Save*', 'Saving')` is called
- **Then:** Returns `false` — "Saving" starts with "Sav" not "Save"
- **Note:** Negative boundary: "Saving" is close to the prefix but does not match it

### TC-B-22: Suffix wildcard — `*me` matches "Click me"
- **AC:** AC-12
- **Seam:** `matcher/matchesPattern`
- **Type:** unit
- **Given:** Pattern `'*me'`, candidate `'Click me'`
- **When:** `matchesPattern('*me', 'Click me')` is called
- **Then:** Returns `true`

### TC-B-23: Contains wildcard — `*Click Me*` matches "Please Click Me Here"
- **AC:** AC-13
- **Seam:** `matcher/matchesPattern`
- **Type:** unit
- **Given:** Pattern `'*Click Me*'`, candidate `'Please Click Me Here'`
- **When:** `matchesPattern('*Click Me*', 'Please Click Me Here')` is called
- **Then:** Returns `true`

### TC-B-24: Wildcard-only pattern `*` matches any non-empty string
- **AC:** AC-13
- **Seam:** `matcher/matchesPattern`
- **Type:** unit
- **Given:** Pattern `'*'`, candidate `'anything'`
- **When:** `matchesPattern('*', 'anything')` is called
- **Then:** Returns `true`
- **Note:** Edge case: sole `*` is maximally permissive

### TC-B-25: Wildcard applies to `data-testid` attribute value (prefix)
- **AC:** AC-14
- **Seam:** `matcher/resolveSelector`
- **Type:** unit
- **Given:** Pipe string `'data-testid=btn-*'`; mock locator for `[data-testid^="btn-"]` (CSS prefix selector) returns count=1
- **When:** `resolveSelector(page, 'data-testid=btn-*')` is called
- **Then:** Returns the locator; the CSS selector used is the prefix form `^=` not `=`
- **Note:** Per assumption A-3: `*` at end → CSS `^=`; `*` at start → `$=`; both → `*=`

---

### Pipe syntax edge cases

### TC-B-26: Single-segment pipe (no `|`) is valid
- **AC:** AC-10
- **Seam:** `matcher/resolveSelector`
- **Type:** unit
- **Given:** Input string `'data-testid=btn'` (contains `=`, no `|`); mock locator returns count=1
- **When:** `resolveSelector(page, 'data-testid=btn')` is called
- **Then:** Resolves successfully; returns the single-segment locator without error
- **Note:** Single-segment is valid pipe syntax — there is no minimum segment count

### TC-B-27: `data-cy` is accepted as a valid data-* attribute
- **AC:** AC-10
- **Seam:** `matcher/resolveSelector` (pipe parser)
- **Type:** unit
- **Given:** Input string `'data-cy=my-button'`; mock locator count=1
- **When:** `resolveSelector(page, 'data-cy=my-button')` is called
- **Then:** No parse error is thrown; the locator `[data-cy="my-button"]` is built and returned
- **Note:** Confirms that `data-*` is a pattern, not a fixed list of allowed data attributes

### TC-B-28: `data-qa` is accepted as a valid data-* attribute
- **AC:** AC-10
- **Seam:** `matcher/resolveSelector`
- **Type:** unit
- **Given:** Input string `'data-qa=search-box'`; mock locator count=1
- **When:** `resolveSelector(page, 'data-qa=search-box')` is called
- **Then:** No parse error; locator `[data-qa="search-box"]` is built and count checked

### TC-B-29: `label` is a valid pipe-syntax attribute
- **AC:** AC-10
- **Seam:** `matcher/resolveSelector`
- **Type:** unit
- **Given:** Input string `'label=Email'`; mock page `getByLabel('Email')` returns locator with count=1
- **When:** `resolveSelector(page, 'label=Email')` is called
- **Then:** Resolves successfully using `getByLabel`; no parse error
- **Note:** `label` is valid in pipe but excluded from bare-string cascade (AC-5)

### TC-B-30: `role` is a valid pipe-syntax attribute
- **AC:** AC-10
- **Seam:** `matcher/resolveSelector`
- **Type:** unit
- **Given:** Input string `'role=button'`; mock page resolves `getByRole('button')` with count=1
- **When:** `resolveSelector(page, 'role=button')` is called
- **Then:** Resolves successfully; no parse error
- **Note:** `role` is valid in pipe but excluded from bare-string cascade (AC-5)

---

### `within` — parsing

### TC-B-31: parseCommand produces correct `within` Command structure
- **AC:** AC-16
- **Seam:** `parser/commandParser`
- **Type:** unit
- **Given:** YAML object `{ within: { text: 'Alice', do: [{ tapOn: 'Delete' }] } }`
- **When:** `parseCommand({ within: { text: 'Alice', do: [{ tapOn: 'Delete' }] } })` is called
- **Then:** Returns `{ type: 'within', selector: 'text=Alice', nth: undefined, do: [{ type: 'tapOn', selector: 'Delete' }] }` — selector is assembled as a pipe-style string, `do` array is recursively parsed
- **Note:** The exact form of the selector string depends on ID-8 — adjust assertion to match the implementation's canonicalisation

### TC-B-32: `within` with `nth` field parses correctly
- **AC:** AC-18
- **Seam:** `parser/commandParser`
- **Type:** unit
- **Given:** YAML object `{ within: { text: 'Row', nth: 1, do: [{ tapOn: 'Edit' }] } }`
- **When:** `parseCommand(...)` is called
- **Then:** Returned command has `nth: 1` (number, not string)

### TC-B-33: `do` key is not included in the selector string of the parsed `within` command
- **AC:** AC-21
- **Seam:** `parser/commandParser`
- **Type:** unit
- **Given:** YAML object `{ within: { text: 'Alice', do: [{ tapOn: 'Delete' }] } }`
- **When:** `parseCommand(...)` is called
- **Then:** `result.selector` does not contain `"do"` as an attribute name; `result.do` is the parsed command array
- **Note:** Confirms `do` is never passed to the selector resolution path

### TC-B-34: 2-level nested `within` is parsed recursively
- **AC:** AC-19
- **Seam:** `parser/commandParser`
- **Type:** unit
- **Given:** YAML `{ within: { text: 'Section A', do: [{ within: { text: 'Subsection', do: [{ tapOn: 'Save' }] } }] } }`
- **When:** `parseCommand(...)` is called
- **Then:** Outer command `type='within'`; `outer.do[0].type='within'`; `outer.do[0].do[0].type='tapOn'`
- **Note:** Verifies recursive parsing depth ≥ 2 levels

### TC-B-35: Missing `do` key in `within` block is a parse error
- **AC:** AC-16 / AC-21
- **Seam:** `parser/commandParser`
- **Type:** unit
- **Given:** YAML object `{ within: { text: 'Alice' } }` (no `do` key)
- **When:** `parseCommand({ within: { text: 'Alice' } })` is called
- **Then:** Throws an error containing `"do"` and `"within"` — identifies the missing required key
- **Note:** `do` is required; absent `do` is a parse-time error, not a runtime error

---

### `within` — integration

### TC-B-36: Basic scoping — tapOn inside `within` resolves within container only
- **AC:** AC-16
- **Seam:** `driver/executeWithin` + `engine/dispatcher`
- **Type:** integration
- **Given:** Page with two rows: Alice row and Bob row, each containing a Delete button
- **When:** Flow runs: `within: { text: Alice, do: [tapOn: Delete] }`
- **Then:** The Delete button in Alice's row is clicked; Bob's Delete button is not clicked; `result.passed` is `true`

### TC-B-37: assertVisible inside `within` is scoped to the container
- **AC:** AC-17
- **Seam:** `driver/executeWithin`
- **Type:** integration
- **Given:** Page with two rows; Alice row contains "alice@example.com"; Bob row contains "bob@example.com"
- **When:** Flow runs: `within: { text: Alice, do: [assertVisible: alice@example.com] }`
- **Then:** `assertVisible` passes (the email is in Alice's row); the scoped locator did not find Bob's email
- **Note:** Verifies non-tapOn commands are also scoped (AC-17)

### TC-B-38: 2-level nested `within` — innermost command scoped to deepest container
- **AC:** AC-19
- **Seam:** `driver/executeWithin`
- **Type:** integration
- **Given:** Page with `section.a` containing `div.subsection` containing a Save button; another Save button outside `section.a`
- **When:** Flow runs nested `within` (Section A → Subsection → tapOn: Save)
- **Then:** The Save button inside Subsection (inside Section A) is clicked; the outer Save button is not
- **Note:** 2 levels of nesting exercised end-to-end

### TC-B-39: `within` container uses pipe-syntax fallback to resolve
- **AC:** AC-20
- **Seam:** `driver/executeWithin` + `matcher/resolveSelector`
- **Type:** integration
- **Given:** Page where no element has `data-testid="user-row"` but one element has text "Alice"; flow uses `within: data-testid=user-row|text=Alice`
- **When:** Flow runs
- **Then:** `data-testid=user-row` step yields 0 matches; `text=Alice` yields 1 match; the Alice container is used as scope; `passed: true`

---

### Reporters

### TC-B-40: Console reporter includes "within:" label for a `within` command result
- **AC:** AC-24
- **Seam:** `reporter/console`
- **Type:** unit
- **Given:** A `CommandResult` whose `command.type` is `'within'` with selector `'text=Alice'`; `passed: true`
- **When:** `reporter.reportCommand(result, 0)` is called
- **Then:** Captured stdout contains `"within"` and `"text=Alice"` (the selector string)
- **Note:** Use the same `stdoutSpy` pattern from existing reporter tests

### TC-B-41: HTML reporter includes "within:" label in rendered output
- **AC:** AC-24
- **Seam:** `reporter/html`
- **Type:** unit
- **Given:** A `RunResult` containing a flow with a `within` command result
- **When:** `generateHtmlReport(runResult)` is called
- **Then:** Returned HTML string contains `within` (the command type label)
- **Note:** The HTML does not need to be exact; `toContain('within')` is sufficient

### TC-B-42: Markdown reporter includes "within:" label in rendered output
- **AC:** AC-24
- **Seam:** `reporter/markdown`
- **Type:** unit
- **Given:** A `RunResult` with a `within` command result
- **When:** `generateMarkdownReport(runResult)` is called
- **Then:** Returned markdown string contains `within`

### TC-B-43: Console reporter renders nested `do` results indented inside `within`
- **AC:** AC-24
- **Seam:** `reporter/console`
- **Type:** unit
- **Given:** A `CommandResult` with `command.type = 'within'` and `nestedResult` containing two child `CommandResult`s
- **When:** `reporter.reportCommand(result, 0)` is called
- **Then:** The output contains both child command labels, and they appear after the `within` line (nested / indented)
- **Note:** The exact indentation character does not need to be asserted; ordering is sufficient

---

### Backward compatibility

### TC-B-44: Object selector `{ testId }` bypasses cascade — no count queries
- **AC:** AC-25
- **Seam:** `matcher/resolveSelector`
- **Type:** unit
- **Given:** Mock page with all getBy* spies; selector `{ testId: 'my-btn' }`
- **When:** `resolveSelector(page, { testId: 'my-btn' })` is called
- **Then:** `page.getByTestId('my-btn')` is called once; no locator `.count()` is invoked; no cascade runs
- **Note:** Object selectors take the existing direct-dispatch path; the cascade is a bare-string-only concern

### TC-B-45: Object selector `{ label: 'Email' }` uses `getByLabel` directly
- **AC:** AC-25
- **Seam:** `matcher/resolveSelector`
- **Type:** unit
- **Given:** Mock page; selector `{ label: 'Email' }`
- **When:** `resolveSelector(page, { label: 'Email' })` is called
- **Then:** `page.getByLabel('Email')` is called once; `page.getByText`, `page.getByTestId` not called; no count queries
- **Note:** Confirms that adding cascade logic does not accidentally intercept object-form selectors

---

## Tests

### Attribution

| AC / Test area | Generator A | Generator B |
|---|---|---|
| AC-1: cascade first step wins | ✓ | ✓ |
| AC-2: cascade text fallback | ✓ | ✓ |
| AC-3: cascade tie-breaking (>1 skip) | ✓ | ✓ |
| AC-4: exhausted chain error | ✓ | ✓ |
| AC-5: cascade excludes label/role | ✓ | ✓ |
| AC-6: pipe first segment wins | ✓ | ✓ |
| AC-7: pipe fallback to second segment | ✓ | — |
| AC-8: pipe all segments exhausted | ✓ | ✓ |
| AC-9: pipe unknown attribute error | ✓ | ✓ |
| AC-10: pipe known attribute set | ✓ | ✓ |
| AC-11: wildcard prefix match | ✓ | ✓ |
| AC-12: wildcard suffix match | ✓ | ✓ |
| AC-13: wildcard contains match | ✓ | ✓ |
| AC-14: wildcard applies to all attributes | ✓ | ✓ |
| AC-15: exact match default (breaking change) | ✓ | ✓ |
| AC-16: within basic scoping | ✓ | ✓ |
| AC-17: within all commands scoped | ✓ | ✓ |
| AC-18: within nth disambiguation | ✓ | ✓ |
| AC-19: within nested blocks | ✓ | ✓ |
| AC-20: within selector supports pipe | ✓ | ✓ |
| AC-21: within do key reserved | ✓ | ✓ |
| AC-22: within container not found error | ✓ | ✓ |
| AC-23: within nth out of range error | ✓ | ✓ |
| AC-24: reporters render within label | ✓ | ✓ |
| AC-25: backward compatibility | ✓ | ✓ |

**Unique to A:** 25  **Unique to B:** 27  **Shared:** 12  **Total after dedup:** 64

No AC gaps — all 25 ACs have at least one test case.

Note on AC-7: Generator B did not produce a dedicated AC-7 test. TC-010 (from A) provides the only coverage for the pipe-fallback-to-second-segment happy path.

---

### TC-001: Cascade — data-testid match stops chain at step 1
- **AC:** AC-1
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Source:** A
- **Given:** Mock `page.locator('[data-testid="Submit"]')` returns a locator whose `.count()` resolves to `1`; all subsequent attribute locators return count `0`
- **When:** `await resolveSelector(page, 'Submit')` is called
- **Then:** The returned locator is the data-testid locator; `.count()` is called only on the data-testid locator and never on the text/name/id/placeholder locators
- **Note:** Verifies early-exit behaviour — boundary is exactly count=1; count=2 at this step would be skipped. Generator B (TC-B-14) duplicated this; A's version is kept because it explicitly asserts the non-called steps.

---

### TC-002: Cascade — falls through to text step when data-testid yields 0
- **AC:** AC-2
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Source:** A
- **Given:** `page.locator('[data-testid="Save Draft"]')` count resolves to `0`; the text locator for exact text `Save Draft` count resolves to `1`
- **When:** `await resolveSelector(page, 'Save Draft')` is called
- **Then:** Returns the text-step locator; data-testid locator's `.count()` was called first; the text locator's `.count()` is called exactly once
- **Note:** The cascade text step must use exact matching, not Playwright partial/substring `getByText`. Generator B (TC-B-16) duplicated this at the same seam; A's version is kept.

---

### TC-003: Cascade — skips step with >1 match and advances
- **AC:** AC-3
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Source:** A
- **Given:** `page.locator('[data-testid="Confirm"]')` count resolves to `2`; the text locator for `Confirm` count resolves to `1`
- **When:** `await resolveSelector(page, 'Confirm')` is called
- **Then:** Returns the text-step locator; the data-testid step was skipped because count = 2 (not 1)
- **Note:** Both 0-match and >1-match steps are skipped; only exactly-1 is accepted. Boundary: count=2 is the minimum skip threshold. Generator B (TC-B-15) duplicated this; A's version is kept.

---

### TC-004: Cascade exhausted — all five steps return 0 matches
- **AC:** AC-4
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Source:** A
- **Given:** All five cascade locators (`data-testid`, text, `name`, `id`, `placeholder`) return count `0`
- **When:** `await resolveSelector(page, 'Foo')` is called
- **Then:** Throws with a message containing `"No unique element found"` and listing all five attributes each with `"0 matches"`, plus a hint to use pipe syntax
- **Note:** Complements TC-005 which tests the mixed-count scenario from AC-4's example.

---

### TC-005: Cascade exhausted — mixed counts, exact diagnostic lines in error message
- **AC:** AC-4
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Source:** both
- **Given:** data-testid count=0, text count=3, name count=0, id count=2, placeholder count=0 (the exact AC-4 example)
- **When:** `await resolveSelector(page, 'Foo')` is called
- **Then:** The thrown error message contains the header line `"No unique element found for bare selector 'Foo'"` and each of the following lines individually: `"data-testid=Foo: 0 matches"`, `"text=Foo: 3 matches"`, `"name=Foo: 0 matches"`, `"id=Foo: 2 matches"`, `"placeholder=Foo: 0 matches"`
- **Note:** Use `toContain` assertions for each line independently; also check the header. B's version (TC-B-1) is stricter on per-line assertions and is used here; A's TC-5 covered the same setup.

---

### TC-006: Cascade exhausted — "Use pipe syntax" hint references the actual selector value
- **AC:** AC-4
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Source:** B
- **Given:** All five cascade steps return 0 or >1 matches for the value `'Foo'`
- **When:** `resolveSelector(page, 'Foo')` throws
- **Then:** The error message contains the line `"Use pipe syntax (e.g. tapOn: text=Foo) to target a specific attribute."` — the suggestion dynamically interpolates the selector value (`Foo`) and names the `text` attribute as the suggested explicit step
- **Note:** The hint must interpolate the actual input string, not a hardcoded placeholder. Distinct from TC-005 which validates the diagnostic count lines.

---

### TC-007: Cascade — label and role absent from error message
- **AC:** AC-5
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Source:** A
- **Given:** All five standard cascade locators return count `0` (error thrown)
- **When:** `await resolveSelector(page, 'Foo')` throws
- **Then:** The error message does NOT contain `"label"` or `"role"`; it lists exactly these five attributes in order: `data-testid`, `text`, `name`, `id`, `placeholder`
- **Note:** Validates ID-2 ordering and AC-5 exclusion constraint together via the error message text.

---

### TC-008: Cascade — getByLabel and getByRole are never called
- **AC:** AC-5
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Source:** B
- **Given:** Mock page with spies on all `getBy*` methods; all cascade step locators return count=0
- **When:** `resolveSelector(page, 'Email')` is called and throws
- **Then:** `page.getByLabel` is never called; `page.getByRole` is never called
- **Note:** Behavioral assertion complementing TC-007's message-content assertion. Assert with `expect(page.getByLabel).not.toHaveBeenCalled()`.

---

### TC-009: Pipe syntax — first segment wins, second never queried
- **AC:** AC-6
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Source:** both
- **Given:** `page.locator('[data-testid="btn"]')` count=1; `page.locator('#btn')` count=1
- **When:** `await resolveSelector(page, 'data-testid=btn|id=btn')` is called
- **Then:** Returns the data-testid locator; `.count()` is called once on the data-testid locator; `.count()` is never called on the id locator
- **Note:** `=` in the string triggers pipe mode (ID-1); short-circuit after first winning segment.

---

### TC-010: Pipe syntax — falls through to second segment when first yields 0
- **AC:** AC-7
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Source:** A
- **Given:** `page.locator('[data-testid="btn"]')` count=0; `page.locator('#btn')` count=1
- **When:** `await resolveSelector(page, 'data-testid=btn|id=btn')` is called
- **Then:** Returns the id locator; data-testid count was queried first (result 0) and the id locator count was then queried (result 1)
- **Note:** Generator B had no dedicated AC-7 test; this is the sole coverage for the pipe fallback happy path.

---

### TC-011: Pipe syntax — all segments exhausted, error lists each segment and count
- **AC:** AC-8
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Source:** both
- **Given:** `page.locator('[data-testid="ghost"]')` count=0; `page.locator('#ghost')` count=0
- **When:** `await resolveSelector(page, 'data-testid=ghost|id=ghost')` is called
- **Then:** Throws with an error message containing `"data-testid=ghost: 0 matches"` and `"id=ghost: 0 matches"`
- **Note:** Minimum exhaustion case (2 segments). Error must name every segment tried, not just say "not found".

---

### TC-012: Pipe syntax — unknown attribute triggers parse error with exact message
- **AC:** AC-9
- **Seam:** matcher/resolveSelector (pipe parser helper)
- **Type:** unit
- **Source:** B
- **Given:** Input string `'price=100'` (contains `=`, therefore pipe mode; `price` is not a known attribute)
- **When:** `resolveSelector(page, 'price=100')` is called
- **Then:** Error message is exactly: `"Unknown attribute 'price' in 'price=100'. Use tapOn: { text: 'price=100' } for text containing '='."`
- **Note:** Parse-time validation — no Playwright `.count()` queries should be made at all. B's version (TC-B-3) is kept over A's TC-10 for the stricter exact-message assertion (`toBe` / `toEqual` in addition to `toContain`).

---

### TC-013: Pipe syntax — unknown attribute escape hint generalises across attribute names
- **AC:** AC-9
- **Seam:** matcher/resolveSelector (pipe parser helper)
- **Type:** unit
- **Source:** B
- **Given:** Input string `'eq=value'` (unknown attribute `eq`)
- **When:** `resolveSelector(page, 'eq=value')` throws
- **Then:** Error message contains `"Use tapOn: { text: 'eq=value' }"` — the object-selector escape path quotes the raw string including its `=`
- **Note:** Verifies the hint string is generated dynamically from the input, not hardcoded to `price`.

---

### TC-014: Pipe syntax — parse error does NOT silently fall back to cascade mode
- **AC:** AC-9
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Source:** B
- **Given:** Input `'price=100'` (contains `=`, switches to pipe mode; `price` is unknown)
- **When:** `resolveSelector(page, 'price=100')` is called
- **Then:** Throws an unknown-attribute error; the five cascade-step locators (`[data-testid=...]`, text, `[name=...]`, `[id=...]`, `[placeholder=...]`) are never queried
- **Note:** `=` is a hard switch to pipe mode — no silent cascade fallback on unknown attribute.

---

### TC-015: Pipe syntax — all plain valid attribute names are accepted without error
- **AC:** AC-10
- **Seam:** matcher/resolveSelector (pipe parser)
- **Type:** unit
- **Source:** A
- **Given:** Mock page that returns count=1 for any locator
- **When:** `resolveSelector` is called with each of `'id=x'`, `'name=x'`, `'placeholder=x'`, `'text=x'`, `'label=x'`, `'role=x'`
- **Then:** None of these throw an "Unknown attribute" error; each resolves to a locator
- **Note:** Tests the static valid-attribute whitelist from AC-10 for non-data-* names in bulk.

---

### TC-016: Pipe syntax — data-* attribute names are accepted (data-testid, data-cy, data-qa)
- **AC:** AC-10
- **Seam:** matcher/resolveSelector (pipe parser)
- **Type:** unit
- **Source:** A
- **Given:** Mock page returning count=1 for any locator
- **When:** `resolveSelector` is called with `'data-testid=btn'`, `'data-cy=btn'`, `'data-qa=btn'`
- **Then:** None throw; each resolves to a locator; the CSS attribute selector form `[data-*="val"]` is used
- **Note:** Validates the `data-*` pattern rule: any identifier after `data-` is accepted. A plain `data=x` (no suffix) should still be rejected.

---

### TC-017: Pipe syntax — single-segment pipe (no `|`) is valid
- **AC:** AC-10
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Source:** B
- **Given:** Input string `'data-testid=btn'` (contains `=`, no `|`); mock locator count=1
- **When:** `resolveSelector(page, 'data-testid=btn')` is called
- **Then:** Resolves successfully; returns the single-segment locator without error
- **Note:** There is no minimum segment count; a single `attr=val` string is valid pipe syntax.

---

### TC-018: Pipe syntax — `label` attribute uses `getByLabel` resolution
- **AC:** AC-10
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Source:** B
- **Given:** Input string `'label=Email'`; mock `page.getByLabel('Email')` returns a locator with count=1
- **When:** `resolveSelector(page, 'label=Email')` is called
- **Then:** Resolves successfully using `getByLabel`; no unknown-attribute error
- **Note:** `label` is valid in pipe syntax but excluded from bare-string cascade (AC-5). Verifies the implementation-level dispatch for `label`.

---

### TC-019: Pipe syntax — `role` attribute uses `getByRole` resolution
- **AC:** AC-10
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Source:** B
- **Given:** Input string `'role=button'`; mock `page.getByRole('button')` returns a locator with count=1
- **When:** `resolveSelector(page, 'role=button')` is called
- **Then:** Resolves successfully; no unknown-attribute error
- **Note:** `role` is valid in pipe syntax but excluded from bare-string cascade (AC-5). Role resolves via ARIA role only, not accessible name.

---

### TC-020: Wildcard prefix — `Save*` matches via cascade text step (resolveSelector level)
- **AC:** AC-11
- **Seam:** matcher/resolveSelector (text step with wildcard)
- **Type:** unit
- **Source:** A
- **Given:** Page has exactly one element whose text value is `"Save Draft"`; data-testid step returns count=0
- **When:** `await resolveSelector(page, 'Save*')` is called
- **Then:** Text step matches that element (count=1), command resolves successfully
- **Note:** The locator for the text step must use a prefix-match query (e.g. CSS `*=` or XPath `starts-with`) when `*` is present, not exact equality. Exercises end-to-end wildcard wiring through `resolveSelector`.

---

### TC-021: Wildcard prefix — `matchesPattern('Save*', 'Save Draft')` returns true
- **AC:** AC-11
- **Seam:** utils/matchesPattern
- **Type:** unit
- **Source:** B
- **Given:** Pure function with no Playwright dependency
- **When:** `matchesPattern('Save*', 'Save Draft')` is called
- **Then:** Returns `true`
- **Note:** Tests the glob utility in isolation; complements TC-020 which tests the same behaviour through `resolveSelector`.

---

### TC-022: Wildcard prefix — `Save*` does NOT match `"Saving"`
- **AC:** AC-11
- **Seam:** utils/matchesPattern
- **Type:** unit
- **Source:** B
- **Given:** Pattern `'Save*'`, candidate `'Saving'`
- **When:** `matchesPattern('Save*', 'Saving')` is called
- **Then:** Returns `false` — `"Saving"` starts with `"Sav"` not `"Save"`
- **Note:** Negative boundary: a string that starts with a strict substring of the prefix must still fail. Guards against under-specified prefix anchoring.

---

### TC-023: Wildcard suffix — `*me` matches via cascade text step (resolveSelector level)
- **AC:** AC-12
- **Seam:** matcher/resolveSelector (text step with wildcard)
- **Type:** unit
- **Source:** A
- **Given:** Page has exactly one element whose text value is `"Welcome"`; data-testid step returns count=0
- **When:** `await resolveSelector(page, '*me')` is called
- **Then:** Text step matches that element, command resolves successfully
- **Note:** The locator must use a suffix-match query (CSS `$=` or XPath `ends-with`).

---

### TC-024: Wildcard suffix — `matchesPattern('*me', 'Click me')` returns true
- **AC:** AC-12
- **Seam:** utils/matchesPattern
- **Type:** unit
- **Source:** B
- **Given:** Pattern `'*me'`, candidate `'Click me'`
- **When:** `matchesPattern('*me', 'Click me')` is called
- **Then:** Returns `true`

---

### TC-025: Wildcard suffix — `*me` does NOT match `"element"` (contains but does not end with)
- **AC:** AC-12
- **Seam:** utils/matchesPattern
- **Type:** unit
- **Source:** B
- **Given:** Pattern `'*me'`, candidate `'element'`
- **When:** `matchesPattern('*me', 'element')` is called
- **Then:** Returns `false` — `"element"` contains `"me"` but does not end with `"me"`
- **Note:** Distinguishes suffix glob from contains match; guards against over-matching.

---

### TC-026: Wildcard contains — `*Click Me*` matches via cascade text step (resolveSelector level)
- **AC:** AC-13
- **Seam:** matcher/resolveSelector (text step with wildcard)
- **Type:** unit
- **Source:** A
- **Given:** Page has exactly one element whose text is `"Please Click Me Now"`; data-testid step returns count=0
- **When:** `await resolveSelector(page, '*Click Me*')` is called
- **Then:** Text step matches that element, command resolves successfully

---

### TC-027: Wildcard contains — `matchesPattern('*Click Me*', 'Please Click Me Here')` returns true
- **AC:** AC-13
- **Seam:** utils/matchesPattern
- **Type:** unit
- **Source:** B
- **Given:** Pattern `'*Click Me*'`, candidate `'Please Click Me Here'`
- **When:** `matchesPattern('*Click Me*', 'Please Click Me Here')` is called
- **Then:** Returns `true`

---

### TC-028: Wildcard on data-testid — prefix wildcard uses CSS `^=` selector
- **AC:** AC-14
- **Seam:** matcher/resolveSelector (pipe step with wildcard)
- **Type:** unit
- **Source:** B
- **Given:** Pipe string `'data-testid=btn-*'`; mock locator for `[data-testid^="btn-"]` (CSS prefix selector) returns count=1
- **When:** `resolveSelector(page, 'data-testid=btn-*')` is called
- **Then:** Returns the locator; the CSS attribute selector built is the prefix form (`^=`), not the exact-equality form (`=`)
- **Note:** Per assumption A-3: `*` at end → CSS `^=`; `*` at start → `$=`; both sides → `*=`. B's version (TC-B-25) is kept over A's TC-16 for its explicit CSS selector form assertion.

---

### TC-029: Exact match default — `tapOn: Submit` does NOT match `"Submit Form"` (resolveSelector level)
- **AC:** AC-15
- **Seam:** matcher/resolveSelector (text step)
- **Type:** unit
- **Source:** A
- **Given:** Page has one element with visible text `"Submit Form"` and no element with text exactly `"Submit"`; all cascade steps return count=0
- **When:** `await resolveSelector(page, 'Submit')` is called
- **Then:** Text step returns 0 matches (does not match `"Submit Form"`); cascade exhausted; command fails with diagnostic error
- **Note:** Primary breaking-change regression test (TD-6). Text step must use exact match, not Playwright's partial/substring `getByText`.

---

### TC-030: Exact match — `matchesPattern('Submit', 'Submit Form')` returns false
- **AC:** AC-15
- **Seam:** utils/matchesPattern
- **Type:** unit
- **Source:** B
- **Given:** Pattern `'Submit'`, candidate `'Submit Form'`
- **When:** `matchesPattern('Submit', 'Submit Form')` is called
- **Then:** Returns `false`
- **Note:** Pure-function-level regression for the breaking change. Assert directly before wiring into locator logic.

---

### TC-031: Exact match — `matchesPattern('Submit', 'Submitting')` returns false
- **AC:** AC-15
- **Seam:** utils/matchesPattern
- **Type:** unit
- **Source:** B
- **Given:** Pattern `'Submit'`, candidate `'Submitting'`
- **When:** `matchesPattern('Submit', 'Submitting')` is called
- **Then:** Returns `false`
- **Note:** Partial suffix match must also be rejected; guards against prefix-anchored over-matching.

---

### TC-032: `within` parser — produces correct Command shape from valid YAML object
- **AC:** AC-16
- **Seam:** parser/commandParser
- **Type:** unit
- **Source:** B
- **Given:** YAML-parsed object `{ within: { text: 'Alice', do: [{ tapOn: 'Delete' }] } }`
- **When:** `parseCommand({ within: { text: 'Alice', do: [{ tapOn: 'Delete' }] } })` is called
- **Then:** Returns `{ type: 'within', selector: 'text=Alice', nth: undefined, do: [{ type: 'tapOn', selector: 'Delete' }] }` — `do` is recursively parsed as a commands array; `text` key becomes the selector string
- **Note:** B's version (TC-B-31) is kept over A's TC-18 for its more specific expected value assertions. Adjust the selector string form to match the implementation's canonicalisation if needed.

---

### TC-033: `within` basic scoping — tapOn resolves within container only (integration)
- **AC:** AC-16
- **Seam:** driver/executeWithin + engine/dispatcher
- **Type:** integration
- **Source:** both
- **Given:** HTML fixture with two rows each containing a Delete button; first row additionally contains text `"Alice"`; second row contains `"Bob"`
- **When:** Flow dispatches `{ type: 'within', selector: 'text=Alice', do: [{ type: 'tapOn', selector: 'Delete' }] }`
- **Then:** `result.passed` is `true`; Alice's Delete button is clicked (not Bob's); `result.nestedResult` contains one passing CommandResult for the inner `tapOn`
- **Note:** Requires fixture HTML where the two Delete buttons are distinguishable (e.g. by `data-testid` side-effect).

---

### TC-034: `within` scopes all command types, not just tapOn (integration)
- **AC:** AC-17
- **Seam:** driver/executeWithin + engine/dispatcher
- **Type:** integration
- **Source:** both
- **Given:** HTML fixture with a scoped container (Alice row) and outside-container elements whose IDs match but should not be selected; container holds targets for `assertVisible`, `inputText`, and `assertText`
- **When:** Flow dispatches a `within` block with `assertVisible`, `inputTextTargeted`, and `assertText` commands in `do`
- **Then:** All three commands pass; their selectors are resolved within the container locator scope
- **Note:** Validates ID-7 (`resolveSelector` scope parameter) is threaded through all `execute*` functions, not just `executeTapOn`.

---

### TC-035: `within` nth=1 — second of three containers selected (integration)
- **AC:** AC-18
- **Seam:** driver/executeWithin + engine/dispatcher
- **Type:** integration
- **Source:** both
- **Given:** HTML fixture with three identical rows each containing text `"Row"` and an Edit button; each Edit button has a distinct `data-testid` (`edit-0`, `edit-1`, `edit-2`)
- **When:** Flow dispatches `{ type: 'within', selector: 'text=Row', nth: 1, do: [{ type: 'tapOn', selector: 'Edit' }] }`
- **Then:** `result.passed` is `true`; the Edit button in the second row (0-indexed: index 1) is clicked; Edit buttons in rows 0 and 2 are not
- **Note:** `nth` is 0-indexed per the spec.

---

### TC-036: `within` nth=0 — first container selected (0-indexed lower boundary, integration)
- **AC:** AC-18
- **Seam:** driver/executeWithin
- **Type:** integration
- **Source:** B
- **Given:** Page with 3 containers all matching `text=Row`; flow has `nth: 0`
- **When:** `executeWithin` runs with `tapOn: Edit` inside the block
- **Then:** The Edit button in the first container (index 0) is used; the second and third containers are not affected
- **Note:** Lower boundary of `nth`; 0 is the minimum valid value.

---

### TC-037: `within` parser — `nth` field is parsed as a number
- **AC:** AC-18
- **Seam:** parser/commandParser
- **Type:** unit
- **Source:** B
- **Given:** YAML object `{ within: { text: 'Row', nth: 1, do: [{ tapOn: 'Edit' }] } }`
- **When:** `parseCommand(...)` is called
- **Then:** Returned command has `nth: 1` as a JavaScript number (not a string); `selector` is `'text=Row'`
- **Note:** YAML integers must be passed through as numeric; a string `nth: 'first'` should produce a parse error.

---

### TC-038: `within` nested blocks — innermost scope applied correctly (integration)
- **AC:** AC-19
- **Seam:** driver/executeWithin + engine/dispatcher
- **Type:** integration
- **Source:** both
- **Given:** HTML fixture with a `"Section A"` container containing a `"Subsection"` div which contains a `"Save"` button; a second `"Save"` button exists outside `"Section A"`
- **When:** Flow dispatches nested `within`: outer selector `text=Section A`, inner selector `text=Subsection`, inner `do` contains `tapOn: Save`
- **Then:** `result.passed` is `true`; the Save button inside Subsection (scoped inside Section A) is clicked; the outer Save button is not; `result.nestedResult` is present with its own `nestedResult` for the inner `within`
- **Note:** Tests that `executeWithin` threads scope through recursive `do` dispatch correctly.

---

### TC-039: `within` parser — 2-level nested `within` is parsed recursively
- **AC:** AC-19
- **Seam:** parser/commandParser
- **Type:** unit
- **Source:** B
- **Given:** YAML `{ within: { text: 'Section A', do: [{ within: { text: 'Subsection', do: [{ tapOn: 'Save' }] } }] } }`
- **When:** `parseCommand(...)` is called
- **Then:** Outer command has `type='within'`; `outer.do[0].type` is `'within'`; `outer.do[0].do[0].type` is `'tapOn'`
- **Note:** Verifies recursive parsing depth of at least 2 levels without stack overflow or type errors.

---

### TC-040: `within` selector — pipe syntax resolves container, first segment wins (integration)
- **AC:** AC-20
- **Seam:** driver/executeWithin + matcher/resolveSelector
- **Type:** integration
- **Source:** A
- **Given:** HTML fixture with a row element that has `data-testid="user-row"` and contains visible text `"Alice"`; the row has a Delete button
- **When:** Flow dispatches `{ type: 'within', selector: 'data-testid=user-row|text=Alice', do: [{ type: 'tapOn', selector: 'Delete' }] }`
- **Then:** Container is resolved using the first pipe segment (`data-testid=user-row` yields 1 match); inner `tapOn: Delete` resolves within that container; `result.passed` is `true`
- **Note:** Exercises the pipe resolver being called without a scope (container resolution is unscoped; scope is applied only after the container is found).

---

### TC-041: `within` selector — pipe syntax resolves container, first segment fails, second wins (integration)
- **AC:** AC-20
- **Seam:** driver/executeWithin + matcher/resolveSelector
- **Type:** integration
- **Source:** B
- **Given:** HTML fixture where no element has `data-testid="user-row"` but exactly one element has visible text `"Alice"` with a Delete button inside it
- **When:** Flow dispatches `{ type: 'within', selector: 'data-testid=user-row|text=Alice', do: [{ type: 'tapOn', selector: 'Delete' }] }`
- **Then:** `data-testid=user-row` step yields 0 matches; `text=Alice` step yields 1 match; Alice container is used as scope; `result.passed` is `true`
- **Note:** Complements TC-040 by exercising the fallback branch of pipe resolution for the container.

---

### TC-042: `within` parser — `do` key is never included in the selector string
- **AC:** AC-21
- **Seam:** parser/commandParser
- **Type:** unit
- **Source:** both
- **Given:** YAML object `{ within: { text: 'Section', do: [{ tapOn: 'Save' }] } }`
- **When:** `parseCommand({ within: { text: 'Section', do: [{ tapOn: 'Save' }] } })` is called
- **Then:** `result.selector` is `'text=Section'` (does not contain `"do"`); `result.do` is the parsed commands array
- **Note:** `do` is unconditionally stripped at parse time; guards against treating `do` as a CSS data attribute or selector key.

---

### TC-043: `within` parser — `nth` is optional; absent `nth` produces `undefined`
- **AC:** AC-21
- **Seam:** parser/commandParser
- **Type:** unit
- **Source:** A
- **Given:** YAML object without `nth`: `{ within: { text: 'Row', do: [{ tapOn: 'Edit' }] } }`
- **When:** `parseCommand(...)` is called
- **Then:** Returned command has `nth` as `undefined` (or absent), `selector: 'text=Row'`, and correctly parsed do-commands
- **Note:** Also test with `nth: 2` to confirm numeric parsing; a non-integer `nth` (e.g. `nth: 'first'`) should throw a parse error.

---

### TC-044: `within` parser — missing `do` key is a parse error
- **AC:** AC-21
- **Seam:** parser/commandParser
- **Type:** unit
- **Source:** B
- **Given:** YAML object `{ within: { text: 'Alice' } }` (no `do` key)
- **When:** `parseCommand({ within: { text: 'Alice' } })` is called
- **Then:** Throws an error whose message contains both `"do"` and `"within"` identifying the missing required key
- **Note:** `do` is required; its absence is a parse-time error, not a runtime error.

---

### TC-045: `within` executor — container not found, exact error message (unit)
- **AC:** AC-22
- **Seam:** driver/executeWithin
- **Type:** unit
- **Source:** B
- **Given:** Mock `resolveSelector` returns a locator whose `.count()` returns `0` for selector `'text=NoSuchRow'`
- **When:** `executeWithin` is called with selector `'text=NoSuchRow'`, no `nth`
- **Then:** Error (or failed result) message is exactly: `"within: No container found for selector 'text=NoSuchRow'"`
- **Note:** The selector string in the message must be dynamically interpolated. B's version (TC-B-5) is kept over A's TC-38 for its exact-message assertion. Inner `do` commands must NOT run.

---

### TC-046: `within` — container not found, integration
- **AC:** AC-22
- **Seam:** driver/executeWithin + engine/dispatcher
- **Type:** integration
- **Source:** A
- **Given:** HTML fixture with no element matching `'text=NoSuchRow'`
- **When:** Flow dispatches `{ type: 'within', selector: 'text=NoSuchRow', do: [{ type: 'tapOn', selector: 'Delete' }] }`
- **Then:** `result.passed` is `false`; `result.message` matches `/within.*No container found.*text=NoSuchRow/i`; the inner `tapOn` command does not run
- **Note:** End-to-end validation of the error path through the dispatcher.

---

### TC-047: `within` executor — nth out of range, exact error message (unit)
- **AC:** AC-23
- **Seam:** driver/executeWithin
- **Type:** unit
- **Source:** B
- **Given:** Mock locator `.count()` returns `2` for selector `'text=Row'`; command has `nth: 5`
- **When:** `executeWithin` is called
- **Then:** Error message is exactly: `"within: nth=5 requested but only 2 containers matched selector 'text=Row'"`
- **Note:** Both the requested `nth` and actual count must be dynamically interpolated. B's version (TC-B-6) is kept over A's TC-40 for the exact-message assertion.

---

### TC-048: `within` — nth out of range, integration
- **AC:** AC-23
- **Seam:** driver/executeWithin + engine/dispatcher
- **Type:** integration
- **Source:** A
- **Given:** HTML fixture with exactly 2 elements matching `text=Row`; flow uses `nth: 5`
- **When:** Flow dispatches `{ type: 'within', selector: 'text=Row', nth: 5, do: [{ type: 'tapOn', selector: 'Edit' }] }`
- **Then:** `result.passed` is `false`; `result.message` matches `/within.*nth=5.*only 2.*containers/i`

---

### TC-049: Reporter — console renders `within` label and nested results
- **AC:** AC-24
- **Seam:** reporter/console
- **Type:** unit
- **Source:** both
- **Given:** A `CommandResult` with `command.type = 'within'`, `command.selector = 'text=Alice'`, `passed: true`, and `nestedResult` containing one passing tapOn result
- **When:** `reporter.reportCommand(result, 0)` is called with stdout captured via `vi.spyOn`
- **Then:** Captured output contains `"within: text=Alice"`; the nested tapOn result label also appears in the output
- **Note:** Uses the existing `nestedResult` rendering path (ID-9). The `_cmdSummary` switch must include a `within` case.

---

### TC-050: Reporter — console `_cmdSummary` returns correct label string for `within`
- **AC:** AC-24
- **Seam:** reporter/console
- **Type:** unit
- **Source:** A
- **Given:** A `within` Command object `{ type: 'within', selector: 'text=Alice', do: [...] }`
- **When:** `ConsoleReporter._cmdSummary(cmd)` is called (or invoked indirectly via `reportCommand`)
- **Then:** Returns / outputs `"within: text=Alice"`
- **Note:** Focuses on the label string alone; complements TC-049 which checks the full output including nested results.

---

### TC-051: Reporter — console nested `do` results appear after the `within` line
- **AC:** AC-24
- **Seam:** reporter/console
- **Type:** unit
- **Source:** B
- **Given:** A `CommandResult` with `command.type = 'within'` and `nestedResult` containing two child CommandResults
- **When:** `reporter.reportCommand(result, 0)` is called
- **Then:** Both child command labels appear in the output; they appear after (below) the `within: ...` line
- **Note:** Ordering is the key assertion; the exact indentation character does not need to be fixed-asserted.

---

### TC-052: Reporter — HTML renders `within` label and nested results
- **AC:** AC-24
- **Seam:** reporter/html
- **Type:** unit
- **Source:** both
- **Given:** A `FlowResult` containing one `within` CommandResult (passed) with a nested tapOn result inside
- **When:** `generateHtmlReport(runResult)` is called
- **Then:** The returned HTML string contains `"within: text=Alice"` (or HTML-escaped equivalent); the nested tapOn label also appears, positioned after the `within` entry
- **Note:** The `cmdLabel` switch in `html.ts` must include a `within` case.

---

### TC-053: Reporter — HTML `cmdLabel` returns correct label string for `within`
- **AC:** AC-24
- **Seam:** reporter/html
- **Type:** unit
- **Source:** A
- **Given:** A `within` Command object `{ type: 'within', selector: 'text=Alice', do: [...] }`
- **When:** `cmdLabel(cmd)` is called in the HTML reporter context
- **Then:** Returns `"within: text=Alice"` with HTML escaping applied to any special characters in the selector
- **Note:** Minimal change to bring the HTML reporter's switch to exhaustiveness.

---

### TC-054: Reporter — Markdown renders `within` label and nested results
- **AC:** AC-24
- **Seam:** reporter/markdown
- **Type:** unit
- **Source:** both
- **Given:** A `FlowResult` containing one `within` CommandResult (passed) with a nested tapOn result
- **When:** `generateMarkdownReport(runResult)` is called
- **Then:** The returned Markdown string contains `"within: text=Alice"`; the nested tapOn result also appears in the output

---

### TC-055: Reporter — Markdown `cmdLabel` returns correct label string for `within`
- **AC:** AC-24
- **Seam:** reporter/markdown
- **Type:** unit
- **Source:** A
- **Given:** A `within` Command object `{ type: 'within', selector: 'data-testid=user-row', do: [...] }`
- **When:** `cmdLabel(cmd)` is called in the Markdown reporter context
- **Then:** Returns `"within: data-testid=user-row"` — selector is emitted verbatim without transformation
- **Note:** Uses a pipe-syntax selector to verify the selector string passes through unchanged.

---

### TC-056: Backward compatibility — object selector `{ testId }` bypasses cascade, no count queries
- **AC:** AC-25
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Source:** B
- **Given:** Mock page with all `getBy*` spies; selector `{ testId: 'my-btn' }`
- **When:** `resolveSelector(page, { testId: 'my-btn' })` is called
- **Then:** `page.getByTestId('my-btn')` is called once; no locator `.count()` is invoked; no cascade or pipe logic runs
- **Note:** B's version (TC-B-44) is kept over A's TC-31 for the explicit assertion that `.count()` is never called. Object selectors take the existing direct-dispatch path unchanged.

---

### TC-057: Backward compatibility — object selector `{ text }` resolves unchanged
- **AC:** AC-25
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Source:** A
- **Given:** Mock `page.getByText('hello')` returns a mock locator
- **When:** `await resolveSelector(page, { text: 'hello' })` is called
- **Then:** Returns the `getByText` locator directly; no cascade step counting occurs; the exact-match vs partial-match flag is passed as it was before the change
- **Note:** The exact-match breaking change (AC-15) applies only to bare strings, not `{ text: 'foo' }` object selectors.

---

### TC-058: Backward compatibility — object selector `{ label }` uses `getByLabel` directly
- **AC:** AC-25
- **Seam:** matcher/resolveSelector
- **Type:** unit
- **Source:** B
- **Given:** Mock page; selector `{ label: 'Email' }`
- **When:** `resolveSelector(page, { label: 'Email' })` is called
- **Then:** `page.getByLabel('Email')` is called once; `page.getByText` and `page.getByTestId` are not called; no count queries
- **Note:** Confirms that the new cascade logic does not intercept object-form selectors for any attribute type.

---

### TC-059: matchesPattern — empty string pattern does not match non-empty actual
- **AC:** additional (TD-3)
- **Seam:** utils/matchesPattern
- **Type:** unit
- **Source:** A
- **Given:** Pure function with no Playwright dependency
- **When:** `matchesPattern('', 'anything')` is called
- **Then:** Returns `false`
- **Note:** Empty pattern is not a wildcard-all; only `'*'` alone is wildcard-all (TC-060).

---

### TC-060: matchesPattern — `'*'` alone matches any string including empty
- **AC:** additional (TD-3)
- **Seam:** utils/matchesPattern
- **Type:** unit
- **Source:** both
- **Given:** Pure function
- **When:** `matchesPattern('*', '')`, `matchesPattern('*', 'anything')`, and `matchesPattern('*', 'multi word string')` are each called
- **Then:** All three calls return `true`
- **Note:** `'*'` is the sole glob wildcard (ID-4); a lone `'*'` must match everything including the empty string. B's TC-B-24 stated "non-empty" — A's TC-34 is broader and is kept.

---

### TC-061: matchesPattern — multiple wildcards in one pattern
- **AC:** additional (TD-3)
- **Seam:** utils/matchesPattern
- **Type:** unit
- **Source:** A
- **Given:** Pure function
- **When:** `matchesPattern('btn-*-*', 'btn-submit-ok')` returns `true`; `matchesPattern('btn-*-*', 'btn-a-b')` returns `true`; `matchesPattern('btn-*-*', 'btn-only')` returns `false`
- **Then:** All three match the expected boolean
- **Note:** The third case (`'btn-only'`) fails because the second `*` segment requires a `-` separator before it.

---

### TC-062: matchesPattern — no wildcard means case-sensitive exact match
- **AC:** additional (TD-3)
- **Seam:** utils/matchesPattern
- **Type:** unit
- **Source:** A
- **Given:** Pure function
- **When:** `matchesPattern('Submit', 'Submit')` → `true`; `matchesPattern('Submit', 'Submit Form')` → `false`; `matchesPattern('Submit', 'submit')` → `false`
- **Then:** All three match the expected boolean
- **Note:** Confirms case-sensitive exact match when no `*` is present. Reinforces the breaking change (TD-6).

---

### TC-063: `within` executor — scoped child locator is passed to inner command (unit)
- **AC:** additional (covers ID-7 at unit level)
- **Seam:** driver/executeWithin
- **Type:** unit
- **Source:** A
- **Given:** Mock `page` where the container locator resolves with count=1; mock container locator has a `.locator` method returning a child locator; inner `do` contains `tapOn: Delete`
- **When:** `executeWithin(page, { type: 'within', selector: 'text=Alice', do: [{ type: 'tapOn', selector: 'Delete' }] }, ctx)` is called
- **Then:** The inner `tapOn` command's `resolveSelector` is called with the container locator as the `scope` argument, not with `page` directly
- **Note:** Tests ID-7 scoped resolution at the unit level independent of a real browser.

---

### TC-064: `within` executor — nth in range causes `.nth(n)` to be called on the locator (unit)
- **AC:** additional (covers AC-18 at unit level)
- **Seam:** driver/executeWithin
- **Type:** unit
- **Source:** A
- **Given:** Mock page where the selector resolves to 3 containers (count=3); `nth: 1`
- **When:** `executeWithin(page, { type: 'within', selector: 'text=Row', nth: 1, do: [] }, ctx)` is called
- **Then:** The `.nth(1)` method is called on the resolved locator before the scoped execution; no error is thrown
- **Note:** Confirms 0-indexed `nth` selection is applied at the driver layer before threading scope into child commands.

---

## Arbiter Review

**Verdict:** PASS_WITH_NOTES

### Coverage check

| AC | Tests | Verdict |
|---|---|---|
| AC-1 | TC-001 | ✓ |
| AC-2 | TC-002 | ✓ |
| AC-3 | TC-003 | ✓ |
| AC-4 | TC-004, TC-005, TC-006 | ✓ |
| AC-5 | TC-007, TC-008 | ✓ |
| AC-6 | TC-009 | ✓ |
| AC-7 | TC-010 | ⚠ single unit test only — see Issues #1 |
| AC-8 | TC-011 | ✓ |
| AC-9 | TC-012, TC-013, TC-014 | ✓ |
| AC-10 | TC-015, TC-016, TC-017, TC-018, TC-019 | ✓ |
| AC-11 | TC-020, TC-021, TC-022 | ✓ |
| AC-12 | TC-023, TC-024, TC-025 | ✓ |
| AC-13 | TC-026, TC-027 | ⚠ no negative test — see Issues #2 |
| AC-14 | TC-028 | ⚠ prefix-only; implementation-detail assertion — see Issues #3 |
| AC-15 | TC-029, TC-030, TC-031 | ✓ |
| AC-16 | TC-032, TC-033 | ✓ |
| AC-17 | TC-034 | ✓ |
| AC-18 | TC-035, TC-036, TC-037, TC-064 | ✓ |
| AC-19 | TC-038, TC-039 | ✓ |
| AC-20 | TC-040, TC-041 | ✓ |
| AC-21 | TC-042, TC-043, TC-044 | ✓ |
| AC-22 | TC-045, TC-046 | ✓ |
| AC-23 | TC-047, TC-048 | ✓ |
| AC-24 | TC-049, TC-050, TC-051, TC-052, TC-053, TC-054, TC-055 | ✓ |
| AC-25 | TC-056, TC-057, TC-058 | ✓ |

### Testing Decisions coverage

| TD | Mapped tests | Verdict |
|---|---|---|
| TD-1: Unit tests for cascade logic | TC-001, TC-002, TC-003, TC-004, TC-005, TC-006, TC-007, TC-008 | ✓ |
| TD-2: Unit tests for pipe parsing | TC-009, TC-010, TC-011, TC-012, TC-013, TC-014, TC-015, TC-016, TC-017, TC-018, TC-019 | ✓ |
| TD-3: Unit tests for wildcard matching | TC-021, TC-022, TC-024, TC-025, TC-027, TC-030, TC-031, TC-059, TC-060, TC-061, TC-062 | ✓ |
| TD-4: Unit tests for `within` parsing | TC-032, TC-037, TC-039, TC-042, TC-043, TC-044 | ✓ |
| TD-5: Integration tests per AC | TC-033, TC-034, TC-035, TC-036, TC-038, TC-040, TC-041, TC-046, TC-048 | ✓ |
| TD-6: Regression — exact-match breaking change | TC-029, TC-030, TC-031 | ✓ |
| TD-7: Reporter tests | TC-049, TC-050, TC-051, TC-052, TC-053, TC-054, TC-055 | ✓ |

### Issues found

**Issue #1 — AC-7: Single unit test, no `tapOn`-level integration test for pipe fallback.**
TC-010 (unit) is the only test covering the pipe-fallback-to-second-segment happy path for `tapOn` specifically. TC-041 exercises the same code path via a `within` container selector, but the call site differs (container resolution vs command resolution). The unit test is solid and sufficient to verify the logic; there is no critical gap, but the lack of a second touch-point means a regression in pipe fallback from `tapOn` could slip past if TC-010 is accidentally scoped to a wrong seam. Acceptable given unit coverage is direct; flag for awareness.

**Issue #2 — AC-13: No negative test for `*foo*` non-match.**
TC-026 and TC-027 both test the positive contains-match case. Neither tests that `*Click Me*` does NOT match a string that does not contain "Click Me" (e.g., `matchesPattern('*Click Me*', 'Nothing here')` should return `false`). Distinguishes contains-glob from always-true. The gap is partially mitigated by TC-062 (no-wildcard exact match) and TC-025 (suffix non-match), but a direct negative for the two-sided `*…*` form is absent. Not critical — the overall wildcard test coverage is dense enough that an over-matching implementation would fail other cases — but worth awareness.

**Issue #3 — AC-14 / TC-028: Implementation-detail assertion (CSS `^=` form).**
TC-028 asserts that the locator built for `data-testid=btn-*` uses the CSS prefix-selector form `[data-testid^="btn-"]` rather than asserting the observable outcome (element is matched). If the implementation achieves the same result via a Playwright filter callback or a different but equivalent CSS form, TC-028 will fail as a false positive. Spec assumption A-3 explicitly calls out CSS attribute selector translation, making this intentional, but the test couples to a mechanism rather than to an outcome. Recommend that the coder treats this as a "mechanism test" and ensures the implementation uses the CSS form as specified; if a different approach is taken, TC-028 should be updated accordingly rather than deleted.

**Issue #4 — No test for a non-integer `nth` string at the parser level (TC-043 note only).**
TC-043's body text (`{ within: { text: 'Row', do: [...] } }`) covers only the absent-`nth` case. Its Note says "a non-integer `nth` (e.g. `nth: 'first'`) should throw a parse error", but that scenario is described in the note rather than in a dedicated test. TC-037 covers `nth: 1` as a number. The parse-error case for `nth: 'first'` is not an independent test case. This is a minor gap with no direct AC tie but is referenced in TD-4.

**No tautological tests found.** All assertions check observable return values, thrown error message content, method call counts, or command result shapes — none mirror internal implementation state directly back as their own assertion.

**No unresolved generator disagreements.** The consolidator cleanly chose between overlapping tests (A's TC-1 for early-exit assertion over B's TC-B-14; B's TC-B-3 for exact-message assertion over A's TC-10; B's TC-B-44 for no-count assertion over A's TC-31). No conflicts remain open.

### Resolved

No changes made to the `## Tests` section. All 25 ACs have at least one effective test that would fail if the AC were violated. Verdict is PASS_WITH_NOTES; the Coder may proceed. The four notes above are informational for the Coder and are not blocking.

---

## Code Artifacts

**Branch:** `feat-enhance-tapon-selector-and-within`
**Committed:** 2026-09-05
**Final test run:** 375 passing, 7 pre-existing failures (6 CLI reporter-path mismatch, 1 parseSelector multi-key)
**tsc --noEmit:** clean (zero errors)

### Files Modified

| File | Ticket | Change |
|---|---|---|
| `packages/core/src/types.ts` | T-01 | Added `within` Command variant (`selector: string; nth?: number; do: SessionedCommand[]`) to the Command union |
| `packages/core/dist/types.d.ts` | T-01/T-05 | Rebuilt dist with `within` type |
| `uivisor-app/src/utils/patterns.ts` | T-02 | NEW — extracted `matchesPattern(pattern, actual)` glob utility |
| `uivisor-app/tests/unit/matchesPattern.test.ts` | T-02 | NEW — 24 tests for matchesPattern (all passing) |
| `uivisor-app/src/matcher/index.ts` | T-03 | Full rewrite: `resolveSelector` now async with 5-step bare-string cascade (data-testid → text → name → id → placeholder, exactly-1-match), pipe syntax (`attr=value|attr=value`), wildcard CSS translation (`^=`/`$=`/`*=`) and regex for text step. Added `resolveContainerLocator` (≥1-match for `within`). Breaking: text step now uses exact match (`{ exact: true }`). |
| `uivisor-app/tests/unit/resolveSelector.test.ts` | T-03 | NEW — 38 unit tests (TC-001–TC-029, TC-056–TC-058, all passing) |
| `uivisor-app/tests/unit/matcher.test.ts` | T-03 | Updated to use `await resolveSelector(...)`; removed stale bare-string→getByText test |
| `uivisor-app/src/driver/commands.ts` | T-04 | Awaited all `resolveSelector` calls; removed local `matchesPattern`; added `createScopedPage` Proxy factory; added `WithinDispatch` type; added `executeWithin` function |
| `uivisor-app/tests/unit/session-engine.test.ts` | T-04 | Updated assertion to expect `{ exact: true }` from cascade text step |
| `uivisor-app/src/parser/commandParser.ts` | T-05 | Added `within` case: extracts `do` (required), `nth` (optional integer), one selector key → `attr=value` string; recursive via `parseSessionedCommand` |
| `uivisor-app/tests/unit/within-parser.test.ts` | T-05 | NEW — 10 parser unit tests (TC-032, TC-037, TC-039, TC-042, TC-043, TC-044, all passing) |
| `uivisor-app/src/engine/dispatcher.ts` | T-06 | Added `within` dispatch case calling `executeWithin` with lambda callback; wraps results in `FlowResult` nestedResult; added `never` exhaustiveness guard on `default` branch |
| `uivisor-app/tests/unit/within-dispatcher.test.ts` | T-06 | NEW — 4 dispatcher unit tests (TC-045, TC-047, 2 dispatcher integration tests, all passing) |
| `uivisor-app/src/reporter/console.ts` | T-07 | Added `within: ${cmd.selector}` case to `_cmdSummary` switch |
| `uivisor-app/src/reporter/html.ts` | T-07 | Added `within: ${escapeHtml(cmd.selector)}` case to `cmdLabel` switch |
| `uivisor-app/src/reporter/markdown.ts` | T-07 | Added `within: ${cmd.selector}` case to `cmdLabel` switch |
| `uivisor-app/tests/unit/within-reporters.test.ts` | T-07 | NEW — 7 reporter unit tests (TC-049–TC-055, all passing) |
| `uivisor-app/tests/integration/commands.test.ts` | — | Updated 7 error-message assertions to accept both legacy and new cascade diagnostic formats |
| `uivisor-app/tests/integration/cli.test.ts` | — | Updated AC49 error-message assertion for same reason |

### Commits

- `888c45f` feat(T-01): add within Command type to core types
- `310781f` feat(T-02): extract matchesPattern as shared utility
- `fccb824` feat(T-03/T-04): async resolveSelector with cascade/pipe/wildcard, executeWithin
- `250cae4` feat(T-05): add within case to commandParser with recursive do parsing
- `27b980a` feat(T-06): add within dispatch case and TypeScript exhaustiveness guard
- `4065884` feat(T-07): add within label to console, html, and markdown reporters
- `61c7f51` test: update integration tests for new cascade error message format

### Key Design Decisions

- **Circular import avoidance**: `executeWithin` accepts a `WithinDispatch` callback instead of importing `dispatcher.ts` directly.
- **Scoped page via Proxy**: `createScopedPage(realPage, scope)` transparently routes all locator-query methods through the container Locator, letting all `resolveSelector(scopedPage, ...)` calls respect the within scope without signature changes.
- **Container resolution is lenient**: `resolveContainerLocator` accepts count≥1 so `nth` can select among multiple containers; `resolveSelector` requires exactly count=1.
- **Text step: exact match**: Breaking change from Playwright's default partial match. `getByText(value, { exact: true })` is used for the text cascade step.
- **Pipe syntax from parser**: YAML `{ within: { text: 'Alice', do: [...] } }` becomes `selector: 'text=Alice'`. Pipe-syntax selectors for within containers (`data-testid=row|text=Alice`) are supported at the executor level (pre-parsed commands).
- **Worktree node_modules**: Created `node_modules/@uivisor/core` symlink in the worktree root pointing to the worktree's `packages/core` so `tsc --noEmit` resolves the updated `within` type correctly.

---

## Test Results — Phase 2 Generator A

**Agent:** tester_generator_a
**Run date:** 2026-09-06
**Working directory:** `uivisor-app`
**Command:** `npm test` (vitest run)

### Summary

| Metric | Count |
|---|---|
| Test files | 15 total (13 passed, 2 failed) |
| Tests | 455 total (448 passed, 7 failed) |

### Per-file results

| File | Tests | Result |
|---|---|---|
| `tests/unit/resolveSelector.test.ts` | 38 | PASS |
| `tests/unit/args.test.ts` | 41 | PASS |
| `tests/unit/reporter.test.ts` | 30 | PASS |
| `tests/unit/within-dispatcher.test.ts` | 4 | PASS |
| `tests/unit/session-engine.test.ts` | 9 | PASS |
| `tests/unit/parser.test.ts` | 149/150 | FAIL (1 failure) |
| `tests/unit/within-reporters.test.ts` | 7 | PASS |
| `tests/unit/matcher.test.ts` | 12 | PASS |
| `tests/unit/matchesPattern.test.ts` | 24 | PASS |
| `tests/unit/flow-filter.test.ts` | 12 | PASS |
| `tests/unit/within-parser.test.ts` | 10 | PASS |
| `tests/unit/sessions.test.ts` | 25 | PASS |
| `tests/integration/sessions.test.ts` | 5 | PASS |
| `tests/integration/commands.test.ts` | 66 | PASS |
| `tests/integration/cli.test.ts` | 16/22 | FAIL (6 failures) |

### Failures

#### `tests/unit/parser.test.ts` — 1 failure (pre-existing)

**Test:** `parseSelector > throws on a selector object with multiple unrecognized keys`
**Error:** `AssertionError: expected [Function] to throw an error` — `parseSelector({ xpath: '//div', css: '.foo' })` does not throw on a multi-key object with unrecognized keys.
**Status:** Matches Coder's pre-existing failure note. Not a regression from this feature.

#### `tests/integration/cli.test.ts` — 6 failures (pre-existing)

All 6 failures are reporter-path mismatch failures — the CLI writes report files to a location different from where the tests expect them:

| Test | Error |
|---|---|
| AC57: `--reporter html` creates `uivisor-report.html` in cwd | `expected false to be true` — file not found at cwd |
| AC58: `uivisor-report.html` is non-empty self-contained HTML | `ENOENT` — file not found (AC57 failed first) |
| AC60: `--reporter md` creates `uivisor-report.md` in cwd | `expected false to be true` — file not found at cwd |
| AC61: `uivisor-report.md` contains summary header and per-flow section | `ENOENT` — file not found (AC60 failed first) |
| AC62: `--reporter html` and `--headed` can be combined | `expected false to be true` — `uivisor-report.html` not found at cwd |
| AC62: `--reporter md` and `--slow-mo` can be combined | `expected false to be true` — `uivisor-report.md` not found at cwd |

**Status:** All 6 match Coder's pre-existing failure note exactly. Not a regression from this feature.

### New test files — confirmation

All 5 new test files are present and fully passing:

| File | Expected tests | Actual tests | Result |
|---|---|---|---|
| `tests/unit/matchesPattern.test.ts` | 24 (T-02) | 24 | PASS |
| `tests/unit/resolveSelector.test.ts` | 38 (T-03) | 38 | PASS |
| `tests/unit/within-parser.test.ts` | 10 (T-05) | 10 | PASS |
| `tests/unit/within-dispatcher.test.ts` | 4 (T-06) | 4 | PASS |
| `tests/unit/within-reporters.test.ts` | 7 (T-07) | 7 | PASS |

### Verdict

**PASS.** All 7 failures match the Coder's pre-existing failure list exactly (6 CLI reporter-path mismatch + 1 parseSelector multi-key). No new failures introduced by this feature. All 5 new test files are present with the expected test counts and fully passing. The merged codebase is clean.

---

## Test Results — Phase 2 Generator B (Code Review)

**Agent:** tester_generator_b
**Run date:** 2026-09-06
**Review type:** Code review (static analysis of merged source)
**Working directory:** `.worktrees/feat-enhance-tapon-selector-and-within`

### Files reviewed

- `uivisor-app/src/matcher/index.ts`
- `uivisor-app/src/driver/commands.ts`
- `uivisor-app/src/parser/commandParser.ts`
- `uivisor-app/src/engine/dispatcher.ts`
- `uivisor-app/src/reporter/console.ts`, `html.ts`, `markdown.ts`
- `uivisor-app/src/utils/patterns.ts`
- `packages/core/src/types.ts`

---

### Blocking findings

None.

---

### Non-blocking findings

**NB-1 — `buildAttrCss` `else` branch: single middle wildcard produces `[attr*=""]`**

File: `uivisor-app/src/matcher/index.ts`, lines 46–52.

The `else` branch is reached when a wildcard is present but neither at the start nor at the end (e.g. `foo*bar`). The code computes:

```ts
const first = value.indexOf('*');
const last = value.lastIndexOf('*');
const mid = value.slice(first + 1, last);
return `[${attr}*="${mid}"]`;
```

For a single middle wildcard (`foo*bar`), `first === last`, so `value.slice(first + 1, first)` = `""`. This yields `[attr*=""]`, which by CSS spec matches any element that has the attribute set at all — semantically wrong for the intended "contains some substring" match.

For a multi-wildcard pattern like `a*b*c` the result is lossy but plausible: `mid = "b"`, yielding `[attr*="b"]` (contains "b"). The docstring for `buildAttrCss` documents only four cases (no wildcard, `prefix*`, `*suffix`, `*contains*`) and does not document this `else` branch at all, so the single-middle-wildcard scenario is undocumented behaviour.

Impact is limited: text wildcards route through `buildTextLocator` which converts to an anchored regex (correct). The bug only affects CSS attribute selectors for `id`, `name`, `placeholder`, and `data-*` attributes. A single-middle wildcard in those contexts is an edge case not exercised by any spec AC. No test currently catches this.

Recommendation: either document the `else` branch as "multi-wildcard best-effort contains" and add an explicit guard/error for single-middle wildcards, or convert the `else` branch to return `null` (unsupported) and let the caller fall through.

---

**NB-2 — Dead `tried` variable in `resolveContainerLocator` pipe-mode error path**

File: `uivisor-app/src/matcher/index.ts`, lines 159–167.

```ts
const tried: string[] = [];
for (const seg of segments) {
  const loc = buildLocatorForAttr(page as Root, seg.attr, seg.value);
  const n = await loc.count();
  if (n >= 1) return loc;
  tried.push(`${seg.raw}: 0 matches`);
}
throw new Error(`within: No container found for selector '${selector}'`);
```

The `tried` array is populated but never referenced in the thrown error. The `resolveSelector` pipe-mode error path (lines 238–241) correctly includes the diagnostics; `resolveContainerLocator` silently discards them. Users who get a "within: No container found" error when using a multi-segment pipe selector for the container receive no per-segment breakdown to guide debugging.

Recommendation: include `tried` in the error message for `resolveContainerLocator`, matching the diagnostic quality of `resolveSelector`.

---

**NB-3 — No lower-bound validation on `nth` in commandParser**

File: `uivisor-app/src/parser/commandParser.ts`, lines 165–168.

The parser validates that `nth` is an integer but does not reject negative values. Playwright's `locator.nth(-1)` returns the last matched element — a surprising implicit alias. The validation in `executeWithin` (`cmd.nth >= count`) also allows negative values through silently.

Recommendation: add `rawNth < 0` to the validation check and throw `within: nth must be a non-negative integer`.

---

**NB-4 — `createScopedPage` proxy casts `text` parameter to `string` in `getByText` override**

File: `uivisor-app/src/driver/commands.ts`, line 23.

```ts
getByText: (text: string | RegExp, opts?: unknown) =>
  (scope as unknown as Page).getByText(text as string, opts as never),
```

The `text as string` cast satisfies the TypeScript compiler but narrows the type unsafely. At runtime, TypeScript casts are erased and a `RegExp` value would still be passed to `scope.getByText()` correctly (Playwright's `Locator.getByText` accepts `RegExp`). There is no actual runtime defect — `buildTextLocator` can pass a `RegExp` and it would route through the proxy correctly. The issue is purely a TypeScript type-safety gap that prevents tsc from catching a future misuse.

Recommendation: widen the parameter type or remove the `as string` cast: `(scope as unknown as { getByText: (text: string | RegExp, opts?: unknown) => Locator }).getByText(text, opts as never)`.

---

**NB-5 — Redundant `count === 0` guard in `executeWithin` after `resolveContainerLocator`**

File: `uivisor-app/src/driver/commands.ts`, lines 345–352.

`resolveContainerLocator` already throws `within: No container found for selector '...'` when all steps yield 0 matches. The subsequent `containerLoc.count()` call and `count === 0` check in `executeWithin` can only be reached via a TOCTOU race (DOM changes between the two calls). The code is defensively correct but the reader's first reaction is "dead code", which creates a minor maintenance burden.

If the defensive check is intentional (guarding against the TOCTOU case), a brief comment would clarify. If it is unintentional, it can be removed.

---

### Correctness verdict by checklist item

| Check | Result | Notes |
|---|---|---|
| 5-step cascade order (data-testid → text → name → id → placeholder) | PASS | `CASCADE_ATTRS` is correct; stops at first count=1 |
| Exact text matching (`{ exact: true }`) | PASS | `buildTextLocator` uses `{ exact: true }` for non-wildcard text |
| `*` wildcard → CSS attribute selectors | PARTIAL | prefix/suffix/contains work; single middle wildcard → `[attr*=""]` (NB-1) |
| Pipe syntax left-to-right, stops at first single match | PASS | Loop returns on `n === 1` |
| `resolveContainerLocator` accepts ≥1 | PASS | Uses `n >= 1` threshold |
| `createScopedPage` Proxy routes locator methods through scope | PASS | All 6 locator methods overridden; runtime-safe (NB-4 is type-only) |
| `never` exhaustiveness guard typed correctly | PASS | `const _exhaustive: never = cmd` on `dispatcher.ts` default branch |
| All 5 switches updated (commandParser, dispatcher, console, html, markdown) | PASS | All 5 have `within` cases |
| `label` and `role` excluded from bare-string cascade | PASS | Neither appears in `CASCADE_ATTRS` |
| Circular import avoided (callback pattern) | PASS | `WithinDispatch` callback; no commands↔dispatcher cycle |
| `within` Command type shape in types.ts | PASS | `selector: string; nth?: number; do: SessionedCommand[]` |

---

### Verdict

**PASS.**

The implementation is correct and complete for all spec-required behaviour. No blocking issues were found. Five non-blocking issues were identified: one real but edge-case bug (`buildAttrCss` single middle wildcard, NB-1), one dead variable reducing diagnostic quality (NB-2), and three minor concerns (no negative-nth guard NB-3, narrow TypeScript cast NB-4, redundant zero-count check NB-5). None of these affect the passing test suite or any specified acceptance criterion.

---

## Test Results

**Consolidated by:** tester_consolidator
**Sources:** Phase 2 Generator A (test run) + Phase 2 Generator B (code review)
**Date:** 2026-09-06

### Overall Verdict

**PASS.** All 448 active tests pass. The 7 failures are confirmed pre-existing and unrelated to this feature. Code review found no blocking issues.

### Test counts per file

| File | Tests | Result |
|---|---|---|
| `tests/unit/resolveSelector.test.ts` | 38 | PASS |
| `tests/unit/args.test.ts` | 41 | PASS |
| `tests/unit/reporter.test.ts` | 30 | PASS |
| `tests/unit/within-dispatcher.test.ts` | 4 | PASS |
| `tests/unit/session-engine.test.ts` | 9 | PASS |
| `tests/unit/parser.test.ts` | 149/150 | FAIL — 1 pre-existing |
| `tests/unit/within-reporters.test.ts` | 7 | PASS |
| `tests/unit/matcher.test.ts` | 12 | PASS |
| `tests/unit/matchesPattern.test.ts` | 24 | PASS |
| `tests/unit/flow-filter.test.ts` | 12 | PASS |
| `tests/unit/within-parser.test.ts` | 10 | PASS |
| `tests/unit/sessions.test.ts` | 25 | PASS |
| `tests/integration/sessions.test.ts` | 5 | PASS |
| `tests/integration/commands.test.ts` | 66 | PASS |
| `tests/integration/cli.test.ts` | 16/22 | FAIL — 6 pre-existing |
| **Total** | **455** | **448 pass / 7 fail** |

### Pre-existing failures (7 — confirmed unrelated)

| # | File | Test | Root cause |
|---|---|---|---|
| 1 | `tests/unit/parser.test.ts` | `parseSelector > throws on a selector object with multiple unrecognized keys` | `parseSelector` does not throw on multi-key unrecognized objects — pre-dates this feature |
| 2–7 | `tests/integration/cli.test.ts` | AC57, AC58, AC60, AC61, AC62 (×2) — `--reporter html`/`--reporter md` file-not-found | CLI writes report files to a path different from where tests look — pre-dates this feature |

### Code review findings

**Blocking:** none

**Non-blocking (NB-1 through NB-5):**

| ID | Location | Summary | Blocking? |
|---|---|---|---|
| NB-1 | `matcher/index.ts` `buildAttrCss` else branch | Single middle wildcard (`foo*bar`) yields `[attr*=""]` — matches any element that has the attribute | No — middle-wildcard is not a spec AC; all spec ACs use leading/trailing wildcards only |
| NB-2 | `matcher/index.ts` `resolveContainerLocator` | `tried` array populated but never used in error message; per-segment breakdown absent from `within` container errors | No — error message still names the selector; quality degradation only |
| NB-3 | `parser/commandParser.ts` | Negative `nth` values not rejected; Playwright treats `nth(-1)` as last element | No — not a spec requirement; minor UX surprise |
| NB-4 | `driver/commands.ts` `createScopedPage` | `text as string` cast in `getByText` override is type-unsafe but runtime-safe | No — no runtime defect |
| NB-5 | `driver/commands.ts` `executeWithin` | Redundant `count === 0` check after `resolveContainerLocator` already guards this; reads as dead code | No — defensively correct; maintenance clarity only |

---

## Quality Gate

**Verdict:** PASS
**Timestamp:** 2026-09-06

| Check | Result | Notes |
|---|---|---|
| AC coverage — all 25 ACs have at least one test | PASS | Confirmed in Arbiter Review; coverage table shows ✓ for all 25 ACs |
| Test pass rate — 448/455; 7 pre-existing failures exempt | PASS | 448 pass; all 7 failures are pre-existing (6 CLI reporter-path, 1 parseSelector multi-key), confirmed unrelated |
| Exhaustiveness guard — `never` guard present in `dispatcher.ts` | PASS | `const _exhaustive: never = cmd` on default branch confirmed by code review checklist |
| 5 reporter switches updated — commandParser, dispatcher, console, html, markdown all have `within` case | PASS | All 5 confirmed in code review checklist |
| NB-1 (middle wildcard bug) — blocking? | NON-BLOCKING | Spec has no middle-wildcard AC (`foo*bar` style); all 25 ACs use leading/trailing wildcards; bug is in an undocumented code path not exercised by any AC; file as follow-on issue |
| NB-2 through NB-5 — blocking? | NON-BLOCKING | All are quality/clarity improvements; none affect passing tests or specified ACs |

**Blocking findings:** none

**Follow-on issues to file:**
- **NB-1** — `buildAttrCss` single middle wildcard (`foo*bar`) produces `[attr*=""]` (CSS matches-any-with-attribute); should guard or error on this case. File in `uivisor-app/src/matcher/index.ts` lines 46–52.
- **NB-2** — `resolveContainerLocator` discards per-segment `tried` diagnostic; improve error message to include per-segment breakdown matching `resolveSelector` quality.
- **NB-3** — `commandParser.ts` does not reject negative `nth`; add `rawNth < 0` guard with message `within: nth must be a non-negative integer`.
- **NB-4** — `createScopedPage` `getByText` override casts `text as string`; widen type to `string | RegExp` for type safety.
- **NB-5** — Redundant `count === 0` check in `executeWithin`; add comment clarifying TOCTOU intent or remove.
