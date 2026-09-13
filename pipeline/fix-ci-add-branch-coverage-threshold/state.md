# Pipeline State: fix-ci-add-branch-coverage-threshold

**Task:** ci: add branch-coverage threshold for packages/core/src (issue #73)
**Started:** 2026-09-13
**Status:** in_progress

---

## Gate 0: Execution Plan

**Classification:** CI configuration improvement (treated as bug-fix pipeline)

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
| **Total** | **~17 min** |

**Execution Sequence:**
1. Analyst → to-spec
   Output: spec + acceptance criteria → state.md#gate-1
   [GATE 1: human approval required]
2. Tester Ensemble Phase 1 → tdd
   2a. tester_generator_a + tester_generator_b in parallel → failing tests
   2b. tester_consolidator → deduplicates → state.md#tests
   2c. tester_arbiter → resolves disagreements
3. Coder → diagnosing-bugs
   Output: config changes → state.md#code-artifacts
4. Tester Ensemble Phase 2 → tdd
   4a. tester_generator_a + tester_generator_b → run tests, report
   4b. tester_consolidator → merges → state.md#test-results
   4c. tester_arbiter → resolves
   Max retries: 3
5. Quality Gate → pass/fail → state.md#quality-gate
   [GATE 3: human approval required before deploying]
6. Release Documenter → signoff_package.md
7. Deployer
8. Delivery Manager (autonomous) → retro.md

---

## Gate 1: Spec

### Problem Statement

`packages/core` has no enforced coverage threshold, so regressions in test coverage can be merged silently. Branch coverage currently sits at 91.66% across `src/**` and should be locked in to prevent future decline.

### Proposed Change

**`packages/core/vitest.config.ts`** — add a `coverage` block:
- `provider: 'v8'`
- `include: ['src/**']`
- `thresholds: { branches: 90 }` (floor just below current 91.66%)
- `reportOnFailure: true`

**`packages/core/package.json`** — update `test` script from `vitest run` to `vitest run --coverage` so threshold is enforced on every `npm test`.

No new dependencies. `@vitest/coverage-v8` already in devDependencies.

### Acceptance Criteria

1. `npm test` inside `packages/core` executes coverage collection without extra flags.
2. When branch coverage ≥ 90%, `npm test` exits 0.
3. When branch coverage drops below 90%, `npm test` exits non-zero with a threshold-failure message.
4. Coverage report only covers `src/**` (no dist, node_modules, or test files).
5. `vitest.config.ts` compiles without TypeScript errors (`npm run build` passes).
6. No new dependencies added to `package.json`.

---

## Tests

**Phase 1 — consolidated verification plan (6 ACs):**
Both generators agreed on the same verification commands for all 6 ACs. AC-3 is a manual negative test requiring a test file to be temporarily removed.

**Phase 2 — results:**

| AC | Result |
|---|---|
| AC-1: `npm test` collects coverage automatically | ✓ PASS — output includes `% Coverage report from v8` |
| AC-2: ≥90% branch coverage → exit 0 | ✓ PASS — 91.66% branches, exit 0 |
| AC-3: <90% → exit non-zero | ✓ PASS — removing selectorHeuristics.test.ts → 36.75%, `ERROR: Coverage for branches (36.75%) does not meet global threshold (90%)`, npm exit code 1 |
| AC-4: only `src/**` files counted | ✓ PASS — report shows only captureScript.ts, commands.ts, index.ts, playwrightLocator.ts, selectorHeuristics.ts, selectorParser.ts, types.ts |
| AC-5: `vitest.config.ts` compiles without TS errors | ✓ PASS — `tsc --noEmit` exits 0 |
| AC-6: no new dependencies | ✓ PASS — only `test` script changed; version bumps are pre-existing on working tree |

**Pre-fix:** CS-NTH-04 test was stale (PR #77 changed `nth-only` → `css=div`). Updated assertion from `toBe('')` to `toBe('css=div')`.

---

## Code Artifacts

**`packages/core/vitest.config.ts`** — added `test.coverage` block: `provider: 'v8'`, `include: ['src/**']`, `thresholds: { branches: 90 }`, `reportOnFailure: true`

**`packages/core/package.json`** — `test` script: `vitest run` → `vitest run --coverage`

**`packages/core/src/captureScript.test.ts`** — CS-NTH-04: updated stale `toBe('')` → `toBe('css=div')`

---

## Quality Gate

**Verdict: PASS**

- 192/192 tests pass
- Branch coverage 91.66% ≥ 90% threshold
- Threshold enforcement verified (exit 1 on violation)
- No new dependencies
- TS compiles cleanly
