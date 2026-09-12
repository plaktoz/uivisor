# Pipeline State: feat-select-by-xpath

**Task:** Add XPath selector support so users can target elements with `tapOn`, `assertVisible`, etc. using an XPath expression (e.g. `tapOn: { xpath: '//button[@type="submit"]' }`).
**Started:** 2026-09-12
**Status:** complete

## Worktree
**Path:** .worktrees/feat-select-by-xpath
**Branch:** feat-select-by-xpath
**Created:** 2026-09-12
**Status:** removed

## Gate 1: Feature Spec (approved)

- Object form `{ xpath: string }` added to Selector union
- Pipe form `xpath=...` supported for XPath without `|`
- XPath union `|` in pipe form → actionable conflict error
- Affects 3 files: `packages/core/src/types.ts`, `packages/core/src/selectorParser.ts`, `uivisor-app/src/matcher/index.ts`
- 14 acceptance criteria approved by user

## Feature & Task Breakdown

| ID | Task | File(s) | Depends on | Status |
|---|---|---|---|---|
| T1 | Add `{ xpath: string }` to Selector union | `packages/core/src/types.ts` | — | open |
| T2 | Add xpath case in parseSelector | `packages/core/src/selectorParser.ts` | T1 | open |
| T3 | Add 'xpath' to PLAIN_VALID_ATTRS | `uivisor-app/src/matcher/index.ts` | T1 | open |
| T4 | Add xpath case in buildLocatorForAttr | `uivisor-app/src/matcher/index.ts` | T3 | open |
| T5 | Add XPath union conflict detection in parsePipeString | `uivisor-app/src/matcher/index.ts` | T3 | open |
| T6 | Add xpath object-form branch in resolveSelector with count validation + error wrapping | `uivisor-app/src/matcher/index.ts` | T1, T3 | open |

## Tests — Arbiter Verdict

**Verdict:** APPROVED — proceed to Coder
**AC coverage:** 14/14
**True failing count:** 41 (TC-XPATH-R10 misclassified — belongs in PASSING)
**Notes for Coder:**
- Remove TC-XPATH-P6 (AC13 extra-key tension — use permissive first-match-wins for T2)
- TC-B-004 union detection: trigger on `attr === 'xpath' && segments.length > 1`
- 3 stale tests in matcher.test.ts (~lines 126-148) need description updates only
- parser.test.ts ~line 130-134 stale test: replace with first-match-wins assertion

## Code Artifacts

**PR:** https://github.com/plaktoz/uivisor/pull/63
**Branch:** feat-select-by-xpath
**Commit:** c4dae0b feat-select-by-xpath: add xpath object selector support

### Files changed

| File | Change |
|---|---|
| `packages/core/src/types.ts` | T1: added `\| { xpath: string }` to Selector union |
| `packages/core/src/selectorParser.ts` | T2: xpath branch before css (first-wins order) |
| `uivisor-app/src/matcher/index.ts` | T3–T6: PLAIN_VALID_ATTRS, buildLocatorForAttr, parsePipeString union-conflict, resolveSelector xpath branch |
| `uivisor-app/tests/unit/parser.test.ts` | TC-XPATH-P1–P5, P7–P11, CMD1–CMD5; stale test replaced |
| `uivisor-app/tests/unit/resolveSelector.test.ts` | TC-XPATH-R1–R25, TC-B-008–017 (4 new describe blocks) |
| `uivisor-app/tests/unit/matcher.test.ts` | Updated 2 stale xpath stubs |
| `uivisor-app/tests/unit/within-dispatcher.test.ts` | TC-B-W-001–005 (xpath container selector tests) |

### Test results

```
Test Files  3 failed | 15 passed (18)
      Tests  10 failed | 510 passed (520)
```

All 10 failures are pre-existing (reporter-md-screenshot.test.ts × 3, reporter.test.ts × 1, cli.test.ts reporter-files × 6) — none related to xpath. All new xpath tests pass.

## Quality Gate

**Verdict:** PASS
**New failures introduced:** 0
**AC coverage:** 14/14
**Pre-existing failures:** 10 (reporter/cli — unrelated to xpath)
**Code changes verified:** T1–T6 across 3 source files, 897 net insertions in 4 test files
**Blocking findings:** none
