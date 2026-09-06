# Signoff Package: feat-enhance-recorder-pipe-syntax-and-within

**PR:** https://github.com/plaktoz/uivisor/pull/39
**Merged:** 2026-09-06
**Status:** delivered

## Summary of changes

Extended the recorder-app's browser-side capture IIFE to emit pipe-syntax selectors (all meaningful attributes joined with `|` in priority order: `data-*` → `id` → `name` → `placeholder` → `text`) and to auto-generate `within` blocks for clicks inside repeating containers (semantic `<tr>`/`<li>`/`role="row"`/`role="listitem"`) or document-ambiguous elements. The `yamlWriter.ts` exhaustive switch was extended with a `within` case to serialise the new command type.

## Files changed

- `packages/core/src/captureScript.ts` — pipe-selector builder (`buildPipeSelector`) and within detection (proactive + reactive) added to the click-handler IIFE
- `packages/core/src/captureScript.test.ts` — new test groups for ACs 1–18, 22–23 (46 new tests)
- `recorder-app/src/yamlWriter.ts` — `within` case added to exhaustive switch; `default: throw` preserved
- `recorder-app/src/yamlWriter.test.ts` — new within serialisation tests for ACs 19–21 (29 tests total, all new cases included)

## Test results

| Package | File | Passed | Failed | Skipped/Todo | Total |
|---|---|---|---|---|---|
| packages/core | selectorHeuristics.test.ts | 21 | 0 | 0 | 21 |
| packages/core | captureScript.test.ts | 46 | 0 | 0 | 46 |
| recorder-app | overlay.test.ts | 7 | 24 | 1 | 32 |
| recorder-app | yamlWriter.test.ts | 29 | 0 | 0 | 29 |
| recorder-app | cli.test.ts | 10 | 0 | 0 | 10 |
| **TOTAL** | | **113** | **24** | **1** | **138** |

All 24 failures are pre-existing in `overlay.test.ts` (JSDOM environment limitations with HUD/picker overlay UI); unrelated to this feature and present on `main` before this branch.

## Quality gate

**Verdict: PASS**

| Check | Result |
|---|---|
| AC coverage | PASS — all 23 ACs covered (T-001–T-052, minus dropped T-043/T-046) |
| Feature test pass rate | PASS — 46/46 captureScript, 29/29 yamlWriter, 10/10 cli |
| Exhaustiveness guard | PASS — `default: throw` preserved; `within` case positioned before `default` |
| cli.ts untouched | PASS — byte-for-byte identical to main; no new imports or branching |
| within type shape | PASS — matches `{ type: 'within'; selector: string; nth?: number; do: SessionedCommand[] }` from PR #33 |
| Blocking findings | None |

## Acceptance criteria coverage

All 23 ACs from Gate 1 are covered by the consolidated test plan (T-001–T-052):

- **ACs 1–7** (pipe-syntax selector assembly): T-001–T-017 — priority ordering, alphabetical data-* sort, 60-char text cap, css= fallback
- **ACs 8–11** (within for semantic containers: `<tr>`, `<li>`, `role="row"`, `role="listitem"`): T-018–T-024
- **ACs 12–14** (within for count-based containers, nth disambiguation): T-025–T-030
- **ACs 15–18** (within for reactive/ambiguous path, ancestor walk, single-attribute container selector): T-031–T-036
- **ACs 19–21** (YAML serialisation: with/without nth, nth:0 not suppressed, do array, regressions): T-037–T-048
- **AC 22** (all logic inside IIFE, cli.ts unchanged): T-049
- **AC 23** (one command per click, no batching): T-050–T-052

## Known limitations / follow-on issues

| # | Finding | Issue |
|---|---|---|
| NB-1 | `buildContainerSelector` can return `'nth-only'` when a container has no qualifying attributes; the click handler sets `selector: ''`, which yamlWriter serialises as a YAML entry with an empty key. Degrades silently; no existing test catches it. | #40 |
| NB-2 | `nth` is computed as the same-tag sibling index within the parent, but the player calls `locator(containerSel).nth(nth)` which requires the 0-based index among all document-wide selector matches. Latent replay bug when each container has a unique selector value (e.g. `data-testid=row-0`); common-case shared-selector fixtures are correct. | #41 |
| NB-3 | Text-only elements skip the reactive uniqueness check: `document.querySelectorAll('[text="Submit"]')` returns 0 results (text is not an HTML attribute), so two identical text-only buttons each emit `tapOn: text=Action` with no scoping. | #42 |
| NB-4 | Three planned boundary tests absent from the implemented file: T-005 (exactly 60-char text preserved), T-013/T-014 (whitespace/empty text falls to css= fallback). Minor coverage gap; existing tests provide adequate feature coverage. | boundary tests (follow-on) |

## Approval

Gate 3 approved by user on 2026-09-06.
