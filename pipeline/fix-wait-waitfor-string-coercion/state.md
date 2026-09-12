# Pipeline State: fix-wait-waitfor-string-coercion

**Task:** `wait` and `waitFor` commands throw "must be an integer" when the ms value comes from a variable via `${varName}` interpolation. Fix: coerce string integers in the `wait`/`waitFor` parsers in `uivisor-app/src/parser/commandParser.ts`.
**Started:** 2026-09-12
**Status:** complete

## Deploy

**Status:** deployed
**PR:** https://github.com/plaktoz/uivisor/pull/62
**Merged:** 2026-09-12
**Branch deleted:** fix-wait-waitfor-string-coercion
**Worktree removed:** .worktrees/fix-wait-waitfor-string-coercion

## Summary

- Fix: added `/^\d+$/` coercion in `wait` (line 43) and `waitFor` (line 140) of `commandParser.ts`
- Also merged: improved error message for duplicate pipe selectors in `matcher/index.ts`
- Tests: 18 new coercion tests added to `parser.test.ts` — all pass
- Quality gate: PASS (10/10 ACs, 0 new failures, `interpolate.ts` unchanged)
- PR squash-merged to main on 2026-09-12
