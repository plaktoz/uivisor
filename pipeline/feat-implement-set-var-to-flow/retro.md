# Sprint Retro: feat-implement-set-var-to-flow

**Run:** pipeline/feat-implement-set-var-to-flow/
**Date:** 2026-09-17
**Outcome:** delivered
**PR:** https://github.com/plaktoz/uivisor/pull/94
**state.md:** pipeline/feat-implement-set-var-to-flow/state.md
**log.md:** pipeline/feat-implement-set-var-to-flow/log.md

---

## Velocity

| Role | Tier | Planned | Activations | Retries | Status |
|---|---|---|---|---|---|
| Orchestrator | principal | 1 | 1 | 0 | on plan |
| Analyst | senior | 1 | 1 | 0 | on plan |
| Architect | principal | 1 | 1 | 0 | on plan |
| tester_generator_a | junior | 2 (P1+P2) | 2 | 0 | on plan |
| tester_generator_b | senior¹ | 2 (P1+P2) | 2 | 0 | on plan — wrong provider |
| tester_consolidator | junior | 2 (P1+P2) | 1 | 0 | skipped Phase 2 |
| tester_arbiter | senior | 2 (P1+P2) | 2 | 0 | on plan |
| coder | senior | 1 | 1 | 0 | on plan |
| release_documenter | senior | 1 | 0 | — | skipped |
| deployer | junior | 1 | 0 | — | skipped |

¹ agent-config.yml specifies provider: openai / model: gpt-5.4 for tester_generator_b. Both log rows show provider: anthropic / model: claude-sonnet-5 — cross-provider fallback occurred silently.

**Summary:** 10 roles activated (11 rows) · 0 Coder retries · 2 roles skipped (release_documenter, deployer) · tester_consolidator skipped Phase 2 · run within cost cap but 7× over token estimate

---

## Cost Breakdown

| Role | Model | Input | Output | Cost (USD) | % of run |
|---|---|---|---|---|---|
| Orchestrator | claude-opus-4-8 | 2,000 | 800 | $0.09 | 3.1% |
| Analyst | claude-sonnet-5 | 49,449 | 2,000 | $0.18 | 6.1% |
| Architect | claude-opus-4-8 | 72,196 | 3,000 | $1.31 | 44.7% |
| tester_generator_a (P1) | claude-haiku-4-5 | 28,515 | 2,000 | $0.03 | 1.0% |
| tester_generator_b (P1) | claude-sonnet-5 | 70,722 | 2,500 | $0.25 | 8.5% |
| tester_consolidator | claude-haiku-4-5 | 48,260 | 2,000 | $0.05 | 1.7% |
| tester_arbiter (P1) | claude-sonnet-5 | 38,498 | 1,000 | $0.13 | 4.4% |
| coder | claude-sonnet-5 | 103,569 | 5,000 | $0.39 | 13.3% |
| tester_generator_a (P2) | claude-haiku-4-5 | 49,979 | 1,500 | $0.05 | 1.7% |
| tester_generator_b (P2) | claude-sonnet-5 | 51,129 | 1,500 | $0.18 | 6.1% |
| tester_arbiter (P2/QG) | claude-sonnet-5 | 79,741 | 2,000 | $0.27 | 9.2% |
| **Total** | | **594,058** | **23,300** | **$2.93** | 100% |

**Budget utilisation:** $2.93 of $5.00 cap (58.6%)

**Model tier flags:**
- Architect used claude-opus-4-8 and consumed 72,196 input tokens — dominant cost centre at 44.7% of run. The task (decompose spec into tickets) does not require Opus reasoning depth. Candidate for downtiering to claude-sonnet-5.
- tester_generator_b logged as claude-sonnet-5/anthropic on both activations. agent-config.yml specifies openai/gpt-5.4. Cross-provider perspective was silently lost — both generators ran on the same provider/model, reducing test ensemble diversity to a single perspective.

---

## Process Signals

| Signal | Evidence | Type | Root cause hypothesis | Item # |
|---|---|---|---|---|
| tester_generator_b wrong provider | log.md rows 5, 10: provider=anthropic model=claude-sonnet-5; config says openai/gpt-5.4 | risk | OPENAI_API_KEY absent or provider fallback not logged; config check_providers.py not run pre-flight | #1 |
| Architect dominant cost centre | log.md row 3: $1.31 = 44.7% of run; 72K input tokens vs 3K baseline | risk | Opus assigned to a large-context codebase read with no per-role complexity scaling; ticket-writing doesn't require Opus | #2 |
| Gate 0 token estimate 7× off | Estimate 36K–90K; actual 617K (617,358 tokens) | risk | Estimate formula (2K+1K per activation) ignores codebase depth and large-spec input sizes | #3 |
| Phase 2 blocking issues fixed in-band | state.md#test-results-p2: 2 blockers (RunContext freshCtx + html.ts double-escape) fixed by arbiter, not formal Coder retry | risk | Test plan covered functionality but not integration test context helper freshCtx(); reporter label escaping not in pre-written tests | — |
| release_documenter and deployer skipped | log.md: no rows for these roles; PR merged by Orchestrator directly | risk | Pipeline reached Gate 3 approval mid-session; signoff_package.md artifact absent | — |
| tester_consolidator skipped in Phase 2 | log.md: 1 consolidator row (P1 only); P2 results merged directly by arbiter | risk | Deviation from planned ensemble order; arbiter carried extra load | — |
| Zero Coder retries | log.md row 8: coder status=complete; no retry rows | positive | Spec quality high; 49 pre-written tests gave Coder a clear success target; lazy interpolation boundary seam note was precise | — |
| Parallel generators confirmed | log.md rows 4–5: generator_a + generator_b same phase, both complete | positive | Parallel execution working; wall-clock saved vs sequential | — |
| All 39 ACs at Quality Gate | state.md#quality-gate: 39/39 ✓, PASS first pass | positive | Analyst extraction was complete and accurate; tester ensemble covered the spec | — |

---

## What slowed us down

1. **Architect codebase read depth** — 72K input tokens, $1.31 cost. The large spec (docs/set-var-to-flow.yaml) plus full codebase exploration before ticket writing drove the Architect to its highest observed input token count. No mitigation was applied; the 15-task breakdown produced was high quality but could have come from Sonnet-5 at 1/5 the cost.

2. **Phase 2 in-band fixes** — Two blocking issues (RunContext integration test wiring; html.ts double-escape) were discovered by the Phase 2 ensemble and required the arbiter to apply fixes and rerun. This added an unplanned fix cycle. The root cause was that the pre-written tests covered the new commands but not the integration test helper setup (freshCtx), and the html reporter escaping path was only exercised by the html reporter's own output, not a dedicated test.

3. **Test-app server misconfiguration (post-pipeline)** — When running the integration flow, the Vite dev server had been started from the repo root (not test-app/), serving 404 for all routes. All tapOn/assertVisible commands failed silently as "Element not found" until the server was restarted from the correct directory. This is not tracked in pipeline log.md but added real wall-clock time.

---

## Backlog Items

| # | Title | Type | Rationale | Target |
|---|---|---|---|---|
| 1 | Enforce tester_generator_b cross-provider or log fallback explicitly | config | tester_generator_b ran as anthropic/claude-sonnet-5 on both activations; single-perspective tests defeat the ensemble design (Signal row 1) | `agent-config.yml → roles.tester_generator_b`; add pre-flight provider check in `scripts/check_providers.py` |
| 2 | Downtier Architect from claude-opus-4-8 to claude-sonnet-5 | config | Architect consumed $1.31 (44.7% of run) on a ticket-decomposition task; Sonnet-5 is sufficient for spec reading and task breakdown, saving ~$1.09 per large-feature run (Signal row 2) | `agent-config.yml → roles.architect.model` |
| 3 | Add large-feature token multiplier to Gate 0 estimate formula | process | 36K–90K estimate vs 617K actual (7× off) makes ETA and cost projections unreliable for large-complexity features with deep codebase reads; Gate 0 estimates should scale with complexity tier (Signal row 3) | `CLAUDE.md → Run Estimates` or `.claude/skills/proj-new-feature/SKILL.md → Step 2 Run Estimates` |
