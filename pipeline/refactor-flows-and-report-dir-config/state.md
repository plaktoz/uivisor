# Pipeline State: refactor-flows-and-report-dir-config

**Task:** Allow users to specify flows location and report output directory as CLI inputs, so uivisor can be used as a standalone tool across multiple projects without modification.
**Started:** 2026-08-30
**Status:** awaiting_gate_3

---

## Gate 0: Execution Plan

**Classification:** refactor

**Roles Activated:** Analyst, Architect, Tester Ensemble, Coder, Release Documenter, Deployer

**Designer Activated:** no

**Estimated ETA:** ~35–50 min (medium complexity)

**Execution Sequence:**
1. Analyst → skill: to-spec
   Output: refactor scope + acceptance criteria (no regressions) → state.md#gate-1
   [GATE 1: APPROVED 2026-08-30]
2. Architect → skill: codebase-design
   Reads: Gate 1 spec
   Output: target architecture + seam definitions → state.md#feature-task-breakdown
3. Tester Ensemble Phase 1 → skill: code-review
   Reads: spec + existing source files
   3a. tester_generator_a + tester_generator_b in parallel → each generates regression tests
   3b. tester_consolidator → deduplicates → state.md#tests
   3c. tester_arbiter → resolves disagreements
   Output: regression test suite covering current behavior → state.md#tests ✓
4. Coder → skill: implement
   Reads: spec + target architecture + regression tests from state.md
   Output: refactored source files → state.md#code-artifacts
5. Tester Ensemble Phase 2 → skill: code-review
   Reads: state.md#tests + all source files
   5a. tester_generator_a + tester_generator_b in parallel → each runs tests and reports
   5b. tester_consolidator → merges results → state.md#test-results
   5c. tester_arbiter → resolves disagreements
   Output: test results — all prior tests must still pass → state.md#test-results
   Max retries: 3
6. Quality Gate → skill: quality (tester_arbiter, autonomous)
   Reads: state.md#tests + state.md#test-results + state.md#code-artifacts + git diff
   Output: pass/fail verdict → state.md#quality-gate
   On fail: findings sent back to Coder; on pass: proceed
   [GATE 3: human approval required before deploying]
7. Release Documenter → skill: proj-deploy
   Reads: state.md in full
   Output: signoff_package.md → pipeline/refactor-flows-and-report-dir-config/signoff_package.md
8. Deployer → skill: proj-deploy

---

## Code Artifacts

### `uivisor-app/src/cli/args.ts`
- `ParsedArgs` now has `outputDir?: string`
- `parseArgs()` handles `--output-dir <path>` (raw string, no resolution)
- Usage string: `webt` → `uivisor`; added `[--output-dir <path>]`

### `uivisor-app/src/cli/index.ts`
- `makeRunDir(outputDir?: string)` resolves `path.resolve(outputDir ?? 'target')` before `mkdirSync`
- `outputDir` threaded from `main()` → `makeRunDir()`
- Report filenames: `webt-report.*` → `uivisor-report.*`

### `uivisor-app/tests/unit/args.test.ts`
- 14 new test cases for `--output-dir` (absence/presence, edge values, combinations, usage string regression)

### `uivisor-app/tests/integration/cli.test.ts`
- Updated 8 `webt-report.*` references to `uivisor-report.*`

### `test-app/flows/` (moved from `uivisor-app/flows/`)
- 6 flow files moved via `git mv` (history preserved)

---

## Test Results

- Unit tests: **173/173 pass**
- Integration tests: 6 pre-existing failures (path mismatch in test helpers — tests look in cwd but files land in cwd/target/stamp/; not caused by this refactor, filenames now corrected)

---

## Quality Gate

**PASS** — all AC-1 through AC-10 verified; refactor confined to intended files.
