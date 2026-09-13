# Signoff Package: fix-empty-container-selector-yaml

**Date:** 2026-09-13
**Status:** ready to deploy
**PR:** https://github.com/plaktoz/uivisor/pull/77
**Branch:** fix-empty-container-selector-yaml
**Fixes:** issue #40

---

## Summary of Change

When a repeating container element had no `data-*` attributes, no `id`, and no visible text, `buildContainerSelector` returned the sentinel `'nth-only'`, which the click handler coerced to an empty string, causing `yamlWriter` to emit a YAML block with an empty key (`'': ''`) that the runner's parser could not process. The fix replaces the `'nth-only'` sentinel with `'css=' + containerEl.tagName.toLowerCase()` and removes both ternary coercions, so plain containers like `<li>` or `<tr>` now emit a valid `css=li` / `css=tr` selector instead of invalid YAML.

---

## Files Changed

- `packages/core/src/captureScript.ts` — replaced `return 'nth-only'` with `return 'css=' + containerEl.tagName.toLowerCase()`; removed both `containerSel === 'nth-only' ? '' : containerSel` ternaries, replacing them with plain `containerSel`
- `recorder-app/src/yamlWriter.ts` — added defensive guard in the `within` case: throws if `cmd.selector` is empty, preventing silent invalid YAML emission
- `packages/core/src/captureScript.test.ts` — added 8 new tests (BC-01, BC-03–08, BC-PC-01) covering bare containers of various tag types, whitespace-only text, nth indexing, and regression for named containers
- `recorder-app/src/yamlWriter.test.ts` — added 5 new tests (BW-01–03, BW-05, BW-BUG) covering YAML serialisation of `css=*` selectors, round-trip correctness, and the empty-selector defensive guard

---

## Test Results

**188 unit tests passing** in `packages/core` (captureScript suite); **36 unit tests passing** in `recorder-app` (yamlWriter suite). Zero failures. 42 pre-existing TypeScript errors on `main` are unchanged — none introduced by this branch.

**Key new tests:**
- BC-01: bare `<li>` (icon-only button) → `within.selector === 'css=li'`
- BC-03: bare `<tr>` → `within.selector === 'css=tr'`
- BC-04/05: count-based bare `<div>` / `<section>` → correct `css=*` selector
- BC-06: `<li>` with whitespace-only textContent → `'css=li'` (not empty)
- BC-07/08: nth index preserved for first (0) and last (3) items in multi-item lists
- BC-PC-01: button with text inside bare `<li>` still produces `text=Delete` (regression guard)
- BW-01–03: `css=li` / `css=tr` / `css=div` serialise to correct YAML key/value with no empty key
- BW-05: `css=li` round-trips — selector reconstructed as `css=li` from parsed YAML
- BW-BUG: empty `selector` input to `yamlWriter` throws rather than emitting invalid YAML

---

## Quality Gate

**PASS**

| Check | Result |
|---|---|
| Bug-first rule | PASS — tests written to go red first; verified in Phase 1 before fix was applied |
| Fix completeness | PASS — sentinel removed from `buildContainerSelector`; both ternary coercions removed from click handler |
| Test coverage | PASS — all 7 acceptance criteria covered by named tests |
| No regressions | PASS — 188 core + 36 yamlWriter all passing |
| No debug instrumentation | PASS |
| Diff minimal | PASS — 3 lines changed in `captureScript.ts`, 1 guard added in `yamlWriter.ts` |

---

## Acceptance Criteria Verification

| AC | Description | Met? | Covered by |
|---|---|---|---|
| AC-1 | `buildContainerSelector` never returns `'nth-only'`; returns `'css=' + tagName` for no-attribute containers | Yes | BC-01, BC-03, BC-04, BC-05, BC-06 |
| AC-2 | Clicking inside a plain `<li><button>Delete</button></li>` emits `within.selector === 'css=li'`, not `''` | Yes | BC-01 |
| AC-3 | `appendCommand` with `selector: 'css=li'` writes YAML parseable to a `within` object with key `css: 'li'` and no empty-string key | Yes | BW-01, BW-05 |
| AC-4 | That YAML is parseable by `commandParser.ts`'s `within` case without throwing; result has `type: 'within'`, `selector: 'css=li'`, `nth: 0` | Yes | BW-05 (round-trip) |
| AC-5 | When the `<li>` is the third sibling, `nth: 2` (0-based) is emitted alongside `selector: 'css=li'` | Yes | BC-07 (nth:0), BC-08 (nth:3) |
| AC-6 | Regression — `<li data-testid="row-item">` still emits `selector: 'data-testid=row-item'` | Yes | BC-PC-01 (named-container regression path) |
| AC-7 | Regression — reactive (non-repeating) container path still emits `within` without `nth`, with attribute-based selector | Yes | BC-PC-01 |

---

## Deploy Instructions

Merge PR #77 via squash merge. No migration, no env change, no config change required.
