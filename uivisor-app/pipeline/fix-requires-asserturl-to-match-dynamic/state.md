# Pipeline State: fix-requires-asserturl-to-match-dynamic

**Task:** requires assertUrl to match dynamically
**Started:** 2026-08-18
**Status:** in_progress

## Gate 1: Bug Spec

**Bug:** `executeAssertUrl` uses strict string equality (`!==`) to compare the current URL path against the expected path. When a flow YAML uses a glob pattern like `/singpass/authorized*`, the `*` is treated as a literal character, so the assertion always fails.

**Reproduction:**
- File: `flows/mex-login-happy.yaml`
- Step: `assertUrl: "/singpass/authorized*"`
- Current behavior: throws `Expected: /singpass/authorized*\nGot: /singpass/authorized?callback=...`
- Expected behavior: passes when the actual path starts with `/singpass/authorized`

**Root cause:** `src/driver/commands.ts` lines 65–67 — `if (actual !== expectedPath)`

**Acceptance criteria:**
1. A pattern with `*` matches any URL path that satisfies the glob (e.g., `/singpass/authorized*` matches `/singpass/authorized`, `/singpass/authorized?foo=bar`, `/singpass/authorized/callback`)
2. A pattern without `*` still performs exact equality (backward-compatible)
3. Error message when a wildcard pattern fails still shows `Expected: <pattern>\nGot: <actual>`

**Gate 1 status:** approved (via plan mode)

---

## Gate 0: Execution Plan

**Classification:** bug

**Roles Activated:** Analyst, Tester, Coder, Deployer

**Designer Activated:** no

**Execution Sequence:**
1. Analyst → skill: to-spec
   Output: bug spec + reproduction steps + acceptance criteria → state.md#gate-1
   [GATE 1: human approval required]
2. Tester Phase 1 → skill: tdd
   Reads: bug spec + acceptance criteria
   Output: failing tests that reproduce the bug → state.md#tests
3. Coder → skill: diagnosing-bugs
   Reads: bug spec + failing tests from state.md
   Output: fix + source files → state.md#code-artifacts
4. Tester Phase 2 → skill: tdd
   Reads: state.md#tests + all source files
   Output: test results → state.md#test-results
   Max retries: 3
   [GATE 3: human approval required before deploying]
5. Deployer → skill: proj-deploy

## Tests

**Tester Phase 1 — failing tests written (red):**
- `assertUrl > wildcard: returns passed: true when path matches glob pattern with query string` — FAILED (expected `true`, got `false`) ✓ confirmed red
- `assertUrl > wildcard: returns passed: true when path matches glob pattern exactly (no trailing chars)` — FAILED ✓ confirmed red

**Coder fix applied:**
- Added `matchesPattern(pattern, actual)` helper to `src/driver/commands.ts`
- Updated `executeAssertUrl` to use `!matchesPattern(...)` instead of `!==`

## Code Artifacts

**Modified:** `src/driver/commands.ts`
- Added `matchesPattern` helper (lines before `executeAssertUrl`): converts `*` to `.*` regex, escapes other special chars, anchors with `^...$`
- Updated `executeAssertUrl`: replaced `if (actual !== expectedPath)` with `if (!matchesPattern(expectedPath, actual))`

**Modified:** `tests/integration/commands.test.ts`
- Added `describe('assertUrl')` block with 5 tests covering exact-match pass/fail and wildcard pass/fail

## Test Results

**Tester Phase 2 — 38/38 integration tests pass (green):**
- All 5 new `assertUrl` tests pass
- All 33 pre-existing integration tests pass
- Pre-existing failures in `cli.test.ts > reporter files` (6 tests) are unrelated — confirmed to pre-date this fix via `git stash` check

**Gate 3 status:** awaiting approval
