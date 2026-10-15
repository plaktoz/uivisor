# Signoff Package: feat-selector-waits-and-timeouts

**PR:** https://github.com/plaktoz/uivisor/pull/122 (`feat-selector-waits-and-timeouts` → `main`, open)
**Gate 3:** approved by human, 2026-10-15.
**Recommendation:** approve and merge.

## 1. What was built

Phase 1 of `docs/proposals/loading-timeout-sla.md`: selector waits and configurable timeouts for uivisor flows.

- Every element command now waits for its target, for any selector form (bare string, pipe string, object selectors, `{ xpath }`). Before this change, string selectors and `{ xpath }` counted matches once and failed immediately; only the `{ testId }` object form waited. A lower-priority cascade/pipe match must win twice, 100 ms apart, before it is accepted (stability check), so a slower, higher-priority match can still beat it.
- `assertNotVisible` now passes when the element is absent (previously failed for string selectors).
- `assertUrl`, `assertCount` and `within` (container lookup) retry until their deadline instead of checking once.
- Timeouts are configurable: `defaultTimeout` (element commands) and `navigationTimeout` (navigation commands), settable via a per-command sibling `timeout:` key, CLI flags `--timeout`/`--navigation-timeout`, the flow header, or the shared config file. Precedence: command > CLI > header > config > built-in (5000 ms / 30000 ms).
- One timeout budget covers both resolving the target and performing the action/wait — errors say which half ran out: `Element not found after <T>ms: <selector>` (resolution) vs. `Element not actionable after <T>ms: <selector>` (interaction).
- `timeout:` on a command with nothing to wait on (`runFlow`, `wait`, `pressKey`, etc.) is a parse error.
- Child flows inherit the caller's timeouts; their own header/config timeout keys are ignored, with a one-line notice when the ignored value would have differed.
- `COMMAND_TRAITS` (new, exported from `@uivisor/core`) declares each command's timeout kind; `tsc` fails if a command is missing from it.
- `defaultTimeout`/`navigationTimeout` are now reserved header/config names (no longer usable as plain vars).
- New test-app fixtures and flows: `test-app/flows/integration/timeouts.yaml` (new positive flow, 20 steps), a negative flow, and two nav-timeout variant flows.
- `uivisor-app/README.md` "Timeouts" section documents all of the above for flow authors.

Explicitly out of scope (deferred to phase 2/3): `loading` auto-wait (§7), response timing/SLA (§8–§9), `waitFor` condition form.

## 2. Diff summary

`git diff --stat origin/main...HEAD -- . ':!pipeline'` (worktree `.worktrees/feat-selector-waits-and-timeouts`):

**67 files changed, 6922 insertions(+), 615 deletions(-)**

| Area | Files | Notes |
|---|---|---|
| `packages/core/src/` | 7 | `commandTraits.ts`/`.test.ts`/`.typecheck.ts` (new), `deadline.ts`/`.test.ts` (new), `commands.ts`/`.test.ts`, `playwrightLocator.ts`/`.test.ts`, `types.ts`, `index.ts` |
| `uivisor-app/src/` | 15 | CLI (`args.ts`, `index.ts`), engine (`context.ts`, `dispatcher.ts`, `index.ts`, new `timeouts.ts`), parser (`commandParser.ts`, `index.ts`, `interpolate.ts`, `validator.ts`), reporter (`checklist.ts`, `console.ts`, `live.ts`, `run-reporter.ts`, `screenshot.ts`), new `utils/positiveInt.ts` |
| `uivisor-app/tests/` | 24 | 7 new fixture HTML pages, new `integration/timeouts.test.ts` (1492 lines), 3 new unit files (`sibling-timeout-parser`, `timeout-config`, `timeouts-precedence`), 14 existing files edited for the new `dispatch(page, step, …)` signature or new behaviour |
| `test-app/` | 6 | new `IntegrationTimeoutsPage.jsx`, route registration, 4 new flow YAMLs |
| `recorder-app/` | 1 | `flowReplayer.test.ts` call-shape updates |
| `docs/` | 2 | the phase-1 proposal doc and its measurement script (pre-existing, carried from the base commits) |
| `uivisor-app/README.md` | 1 | new Timeouts section + flag/key documentation |

Not counted above: `pipeline/feat-selector-waits-and-timeouts/{state.md,log.md,build_check.md}` (4107 lines of pipeline process record, excluded per the `:!pipeline` filter).

## 3. Human decisions

| ID | Decision |
|---|---|
| Q1 | `assertUrl`, `assertCount`, `within` retry until timeout (behaviour change); with no new keys set, every flow that passes today still passes. |
| Q12–Q16 (spec, Gate 1) | Built-in defaults 5000 ms / 30000 ms; precedence order (command > CLI > header > config > built-in; header beats config, opposite of vars); one budget per command covers resolution + interaction/wait. |
| Q13 | Child flows inherit timeouts only (not override); re-confirmed after the base-update rebase. |
| Q17 | `timeout:` on a `none`-trait command (incl. `runFlow`) is a parse error. |
| Q18 | `timeout:` on `within` bounds only the container lookup, never the inner `do:` steps. |
| Q19 | `pressKey` rejects `timeout:` (trait `none`, phase 1); `waitForPageLoad` accepts its inner `timeout` or the sibling key, never both. |
| Q20 / Gate 1 Rev 1, decision 1 | Child ignored-key notice fires per key only when the child's own value differs from the effective value (not on every set key). |
| Gate 1 Rev 1, decision 2 | Interaction timeout gets its own message, `Element not actionable after <T>ms: …`, distinct from the resolution `Element not found after <T>ms: …`. |
| Gate 1 Rev 1, decision 3 | Grandchild notice names the top-level flow, not the immediate caller (AC62). |
| Gate 1 Rev 1, decision 5 | AC79 flow count corrected to 37 (36 existing + new `timeouts.yaml`). |
| E1–E4 (Gate 1 Errata, Architect escalations) | E1: AC11 mock input revised so no lower-step winner is confirmed twice running. E2: Coder may edit exact `goto`/`reload` call-shape assertions in 3 existing test files to the new call shape, plus one explicit vitest timeout and resolver "no unique match" tests. E3: `selectOption` keeps the existing `Option not found.` message on timeout (carve-out from the generic "not actionable" message). E4: AC57(c) "AC63" means AC68. |
| dispatch API (Errata) | `dispatch` takes only a step (`SessionedCommand`), not a dual `SessionedCommand \| Command` shape; 99 call sites converted. |
| Model overrides | Analyst run on opus after 3× sonnet 429s. `tester_generator_a`/`tester_consolidator`/`deployer`/`delivery_manager` run on sonnet after haiku returned 403 (account restricted to global models). Standing rule: on any sonnet 429, retry once on opus, then continue (no stop). |
| Cost-cap raises | $5.00 → $15.00 (coder execution plan) → $20.00 (recorder-app baseline, mid-coding) → $30.00 → $40.00 (merge-with-main escalation). |
| Merge with main | `origin/main` was 22 commits ahead (`48b345c`) with 10 conflicting files when the branch was pushed. Human chose: merge `main` into the feature branch (merge commit, no force-push), resolve on opus, re-verify against the new main baseline, short arbiter re-review. |

## 4. Test results vs. the main baseline

| Suite | main baseline (`48b345c`) | This branch, post-merge (final, `ac04302`) |
|---|---|---|
| `packages/core` vitest | 552 passed (276 unique; dist double-counted) | 820 passed (phase-1's 674 + main's 146, same double-count pattern) |
| `packages/core` branch coverage | 63.66% (gate fails on main itself, pre-existing) | 80.95% (still below the 90% gate, but improved; gate failure is pre-existing, not introduced) |
| `uivisor-app` vitest | 799 passed, 4 expected fail | 1003 passed, 4 expected fail |
| `uivisor-app` tsc | clean | clean |
| `recorder-app` vitest | 179 passed, 1 todo, 0 failed | 179 passed, 1 todo, 0 failed (unchanged) |
| `recorder-app` tsc | pre-existing error at `src/cli.test.ts(141,7)` | same pre-existing error, unchanged |
| `test-app/flows/integration/timeouts.yaml` (new) | n/a | 20/20 passed |
| negative flow (default 5000 ms) | n/a | fails at 5006 ms, as designed |
| `test-app/flows/integration/` full sweep | 36 passed, 1 failed of 37 (only `sessions.yaml`) | 37 passed, 1 failed of 38 (only `sessions.yaml`) — same single pre-existing failure, now against one more flow in the directory |

Net: no regression against main on any suite; `packages/core` and `uivisor-app` both gained tests and passed strictly more than the main baseline; the one integration-flow failure (`sessions.yaml`) is identical before and after this change.

## 5. Defects found and fixed

| ID | Found by | Issue | Fix | Commit |
|---|---|---|---|---|
| B1 | tester_generator_a (Phase 2 review) | AC77 case (1) required `int-delayed` to be found via a true bare string among the four selector forms; the flow instead used `data-testid=int-delayed` (a single-segment pipe/attr string, not bare). | Changed the flow step to `assertVisible: int-delayed`. Also stripped stale task-number comments (`(S7, T9)` style) from `dispatcher.ts`/`timeouts.ts`/the precedence test. | `5f03ba4` |
| B2 | tester_generator_b (Phase 2 adversarial review) | `executeAssertText`/`executeAssertValue`/`executeAssertEnabled`/`executeAssertDisabled`/`executeAssertChecked`/`executeAssertUnchecked` called Playwright's state-reading methods with no timeout after resolution succeeded, letting them run past the command's deadline (violates the "one budget per command" rule). Reproduced at 2311 ms vs. a 300 ms budget. | Passed `{ timeout: d.pwTimeout() }` (remaining budget) into each state-read call; a timeout there now raises the standard `Element not found after <T>ms: <selector>` message. 6 new unit tests added. | `504af05` |
| F1 | Orchestrator (during T11 coding) | A hung navigation took ~31.5 s to fail even with `navigationTimeout: 1500`, because the failure-case duration was measured after the failure screenshot (itself unbounded). | Duration is now measured before the failure screenshot; the screenshot itself is bounded to 5 s. | part of T11b, folded into Wave 3b/3c commits |
| F2 | Orchestrator (post-merge-with-main re-review) | The child-flow timeout-ignored notice was written straight to `process.stdout`; under main's live-checklist reporter (default on a TTY, added by main after this branch forked), the next checklist redraw erased the notice line. | Added a new `ProgressEvent` kind (`notice`); the dispatcher emits it instead of writing stdout directly; the live reporter flushes it above the redraw region, the plain reporter prints one line. Verified under a real TTY (`script`) and in `--reporter plain`. | `ac04302` |

All four are confirmed fixed in code (direct diff inspection, not just commit messages) and are test-backed, per the Quality Gate's re-review.

## 6. Known items not fixed (carried forward)

- **`test-app/flows/integration/sessions.yaml`** fails on both main and this branch — a pre-existing cross-session `storage`-event timing issue, unrelated to this feature. Not a regression.
- **`packages/core`'s 90% branch-coverage gate** fails on both main (63.66%) and this branch (80.95%, improved but still short). Pre-existing gate, not introduced or worsened by this change.
- **`packages/core` vitest double-counts** compiled `dist/*.test.js` copies alongside the source tests, inflating the "passed" count on both main and this branch. Pre-existing, cosmetic.
- **`recorder-app` `tsc --noEmit`** reports one pre-existing error at `src/cli.test.ts(141,7)` (TS2769), unchanged by this run.
- **14 non-blocking review follow-ups (N2–N13, N15, N16; 3 of the original 17 — N1, N14, N17 — were accepted as already resolved or correct-per-spec)**, listed in full under `## Quality Gate` → `### Quality Gate — Non-blocking rulings` in `state.md`. Summary of themes: stale/narrating code comments and test titles (bundle into a future hygiene PR); a few integration tests that assert a weaker claim than their name implies, each backed by a stronger unit-level test elsewhere; `AC72`'s and `AC68`'s coverage could be made more exhaustive/self-syncing; `AC76`'s fixture-render test was planned but never committed (flagged as a dropped commitment, not a functional defect); a few redundant/double-parsed timeout values with no behavioral effect; one pre-existing flaky-timing mitigation (fixture delay shortened, assertion margin widened) carried over from this run itself. None of the 14 point to an undetected functional defect — each is independently covered by a different test layer.
- Separately, `run-flow-override-child.yaml` was flagged failing on the pre-merge quality gate (pre-existing, unrelated to this feature — it has no `goto`/`appId` of its own and fails identically on main when run outside its parent flow); the merge with `origin/main` (`48b345c`) picked up a fix for it from main, so it no longer appears in the post-merge failure list — only `sessions.yaml` remains.
- Process gap, not a defect: Tester Ensemble Phase 2's review output (which produced B1/B2) was not written into `state.md` under `## Test Results` before the arbiter's first quality-gate pass, forcing a later N1–N17 ruling pass against reconstructed records. Recorded as follow-up #2 in the Quality Gate section.

## 7. Cost total vs. cap

**Actual spend: $28.78** (summed from `log.md`'s Cost (USD) column, 43 logged activations), against a cap raised over the run from **$5.00 → $40.00** (see §3, "Cost-cap raises"). Under cap by $11.22. The run's own estimate at Gate 0 was ~$0.39–$2.93; actual cost ran well above that estimate, driven mainly by three 429-retry cycles, the opus Architect activation ($4.43), one opus Analyst activation ($2.78), one opus Tester-generator-a review activation ($5.63), and the opus merge-conflict-resolution Coder activation ($2.96).
