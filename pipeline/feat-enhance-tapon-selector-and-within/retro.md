# Sprint Retro: feat-enhance-tapon-selector-and-within

**Run:** pipeline/feat-enhance-tapon-selector-and-within/
**Date:** 2026-09-06
**Outcome:** delivered
**PR:** https://github.com/plaktoz/uivisor/pull/33
**state.md:** pipeline/feat-enhance-tapon-selector-and-within/state.md
**log.md:** pipeline/feat-enhance-tapon-selector-and-within/log.md

---

## Velocity

| Role | Tier | Planned | Activations | Retries | Status |
|---|---|---|---|---|---|
| Orchestrator | mid | 1 | 1 | 0 | complete |
| Analyst | senior | 1 | 1 | 0 | complete |
| Architect | principal | 1 | 1 | 0 | complete |
| tester_generator_a | junior | 2 | 2 | 0 | complete |
| tester_generator_b | cross-provider | 2 | 2 | 0 | complete |
| tester_consolidator | junior | 2 | 2 | 0 | complete |
| tester_arbiter | senior | 2 | 2 | 0 | complete |
| Coder | senior | 1 | 1 | 0 | complete |
| build_verifier | — | 1 | 1 | 0 | complete ($0) |
| release_documenter | — | 1 | 0 | 0 | skipped |
| Deployer | — | 1 | 1 | 0 | skipped (Gate 3 bypassed) |
| Delivery Manager | mid | 1 | 1 | 0 | complete |

**Summary:** 11 of 13 planned roles produced work; zero retries across the full run. The release_documenter was not activated — the context exhaustion event that bypassed Gate 3 also left no signoff package. The Deployer activated only to log the bypass retroactively. Phase 2 quality gate ran post-merge on 2026-09-06 during resume rather than pre-merge as designed. All other roles completed cleanly on first activation. Zero retries is the standout positive: the Analyst's 25-AC spec and the Architect's 7-ticket breakdown gave the Coder an unambiguous implementation surface that required no rework.

---

## Cost Breakdown

| Role | Model | Input | Output | Cost (USD) | % of run |
|---|---|---|---|---|---|
| Orchestrator | claude-sonnet-4-6 | 2,000 | 800 | $0.014 | 0.5% |
| Analyst | claude-sonnet-5 | 52,585 | ~1,200 | $0.175 | 5.8% |
| Architect | claude-opus-4-8 | 67,860 | ~1,500 | $1.133 | 37.5% |
| tester_generator_a (ph1) | claude-haiku-4-5 | 83,073 | ~1,000 | $0.071 | 2.4% |
| tester_generator_b (ph1) | gpt-5.4 | 62,348 | ~1,000 | $0.135 | 4.5% |
| tester_consolidator (ph1) | claude-haiku-4-5 | 79,760 | ~1,200 | $0.069 | 2.3% |
| tester_arbiter (ph1) | claude-sonnet-5 | 77,470 | ~800 | $0.244 | 8.1% |
| Coder | claude-sonnet-5 | ~120,000 | ~3,000 | $0.405 | 13.4% |
| tester_generator_a (ph2) | claude-haiku-4-5 | 51,566 | ~800 | $0.045 | 1.5% |
| tester_generator_b (ph2) | gpt-5.4 | 102,003 | ~1,000 | $0.214 | 7.1% |
| tester_consolidator (ph2) | claude-haiku-4-5 | 79,173 | ~600 | $0.065 | 2.2% |
| tester_arbiter (ph2) | claude-sonnet-5 | 79,173 | ~800 | $0.249 | 8.2% |
| build_verifier | — | — | — | $0.000 | 0.0% |
| Deployer | — | — | — | $0.000 | 0.0% |
| Delivery Manager | claude-sonnet-4-6 | ~50,000 | ~3,000 | ~$0.195 | ~6.5% |
| **Total** | | | | **~$3.02** | **100%** |

**Budget utilisation:** ~$3.02 of $5.00 cap (60.4%)

Model tier flags:
- **Architect cost concentration (approaching flag threshold).** Architect (claude-opus-4-8, principal tier) consumed $1.133 — 40.2% of the $2.819 pre-DM run total, 37.5% of the full run. This sits at the >40% flag boundary. Principal-tier output pricing ($75/MTok) means 1,500 output tokens for 7 tickets and seam design cost more than the entire Coder activation ($0.405 for ~3,000 output tokens at senior tier). See BL-3.
- **Run estimate significantly undershot actual.** Gate 0 estimate was $0.37–$0.61; actual was ~$3.02 — roughly 5-8× over. The Coder's ~120K input window alone exceeded the entire $0.37–$0.61 estimate ceiling. The estimate did not model coder context windows separately from analyst/architect windows. See BL-6.

---

## Process Signals

| Signal | Evidence | Type | Root cause hypothesis | Item # |
|---|---|---|---|---|
| Gate 3 bypassed | PR #33 merged 2026-09-05; quality gate ran 2026-09-06; deployer logged as skipped retroactively; no signoff package produced | critical process-gap | Context exhaustion severed the orchestrator's pipeline thread mid-run; no persistent gate lock or branch protection blocked the merge before Gate 3 human approval was recorded | BL-1 |
| Phase 2 ran post-merge | tester ensemble phase 2 timestamps all 2026-09-06; PR merged 2026-09-05 | process-gap (downstream of BL-1) | Direct consequence of Gate 3 bypass; quality gate could not serve its pre-merge gate function and ran retrospectively instead | BL-1 |
| Architect cost at 40% threshold | $1.133 of $2.819 pre-DM run = 40.2%; principal-tier pricing amplifies even modest output | cost-concentration | claude-opus-4-8 assigned for ticket decomposition and seam design; the task is spec-driven and well-bounded — senior-tier model likely achieves equivalent output quality at ~7× lower per-token cost | BL-3 |
| Zero retries | All 14 log entries: 0 retries; tester_arbiter PASS_WITH_NOTES with only 4 non-blocking notes; quality gate PASS with 0 blocking findings | positive | Analyst produced a precise 25-AC spec with locked implementation decisions; test suite deduplication yielded 64 well-targeted cases with full AC coverage; Coder had an unambiguous signal and implemented T-01 through T-07 clean on first pass | — |
| NB-1: middle-wildcard CSS bug | buildAttrCss else branch: foo*bar yields [attr*=""] — CSS matches any element that has the attribute set | technical-debt | Undocumented else branch; spec has no middle-wildcard AC so no test exercises this path; identified by code review only | BL-2 |

---

## What slowed us down

**Context exhaustion and Gate 3 bypass.** The dominant delay and the only process failure in this run. Context window exhaustion on 2026-09-05 severed the orchestrator's pipeline thread before Gate 3 was reached. Without a persistent gate lock or branch protection rule keyed to the pipeline state, the Coder merged PR #33 to main without Gate 3 human approval. When the session resumed on 2026-09-06, the quality gate ran post-merge rather than as a blocking pre-merge gate. The deployer was logged as skipped retroactively and no signoff package was produced. Wall-clock delivery extended from same-day to two-day.

**Run cost estimate was not calibrated for coder context size.** The Gate 0 estimate of $0.37–$0.61 modelled total token usage at 42K–105K across all roles. In practice, the Coder alone consumed ~120K input tokens — more than the upper bound of the entire run estimate. For large-complexity features where the Coder must read a full spec, 64-test plan, and 9 source files in one context, the coder window should be budgeted separately at 100K–150K input tokens. The run stayed well within the $5.00 cap, so this did not cause a problem, but the estimate understated expected cost by 5–8×.

**Everything else ran on time and on spec.** Zero retries, clean tsc, 448/455 tests passing (all 7 failures pre-existing), and a PASS quality gate with no blocking findings reflect well on spec quality and test alignment.

---

## Backlog Items

| # | Title | Type | Rationale | Target |
|---|---|---|---|---|
| BL-1 | Add Gate 3 persistence check to block merge before approval | process | Gate 3 bypassed due to context exhaustion; pipeline needs a branch protection rule or persistent gate marker preventing merge until Gate 3 approval is explicitly recorded; context loss must not silently skip human gates | pipeline protocol / branch protection |
| BL-2 | Fix buildAttrCss single middle wildcard producing `[attr*=""]` | bug | NB-1: `foo*bar` in CSS attr selector context matches any element that has the attribute — semantically wrong; guard or error on single-middle-wildcard form | uivisor-app/src/matcher/index.ts:46-52 |
| BL-3 | Evaluate Architect model tier for spec-driven ticket decomposition | cost | Architect at 40% of run cost; claude-sonnet-5 (senior) costs ~7× less per output token; ticket decomposition from a locked spec is well-bounded and may not need principal-tier reasoning | agent-config.yml |
| BL-4 | Add per-segment diagnostics to resolveContainerLocator error messages | quality | NB-2: tried array built but discarded; within container errors name only the full selector string, not per-segment counts; should match the diagnostic quality of resolveSelector | uivisor-app/src/matcher/index.ts:159-167 |
| BL-5 | Reject negative nth in commandParser | quality | NB-3: negative nth passes through silently; Playwright nth(-1) selects last element — surprising implicit alias; add `rawNth < 0` guard with message `within: nth must be a non-negative integer` | uivisor-app/src/parser/commandParser.ts:165-168 |
| BL-6 | Calibrate run cost estimates for coder context windows on large-complexity features | process | Gate 0 estimate undershot actual by 5–8×; Coder window on large runs should be separately budgeted at 100K–150K input tokens rather than folded into a single total-token range | pipeline protocol |
