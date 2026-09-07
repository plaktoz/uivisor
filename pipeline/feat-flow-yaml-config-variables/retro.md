# Sprint Retro: feat-flow-yaml-config-variables

**Run:** pipeline/feat-flow-yaml-config-variables/
**Date:** 2026-09-05
**Outcome:** delivered
**PR:** https://github.com/plaktoz/uivisor/pull/32
**state.md:** pipeline/feat-flow-yaml-config-variables/state.md
**log.md:** pipeline/feat-flow-yaml-config-variables/log.md

---

## Velocity

| Role | Tier | Planned | Activations | Retries | Status |
|---|---|---|---|---|---|
| Orchestrator | Sonnet (4-6) | 1 | 5 | 4 (Gate 1 revisions) | complete |
| Analyst | Sonnet-5 | 1 | 1 | 0 | complete |
| Architect | Opus (4-8) | 1 | 1 | 0 | complete |
| Tester Generator A | Haiku (4-5) | 1 | 1 | 0 | complete |
| Tester Generator B | gpt-5.4 (openai) | 1 | 1 | 0 | complete |
| Tester Consolidator P1 | Haiku (4-5) | 1 | 1 | 0 | complete |
| Tester Arbiter P1 | Sonnet-5 | 1 | 1 | 0 (self-corrected internally) | complete |
| Tester Consolidator+Arbiter P2 | Sonnet (4-6) | 1 | 1 | 0 | complete |
| Tester Arbiter (Quality Gate) | Sonnet (4-6) | 1 | 1 | 0 | complete |
| Build Verifier | Sonnet (4-6) | 1 | 1 | 0 | complete |
| Coder | unlogged | 1 | unlogged | — | complete (inferred from artifacts) |
| Release Documenter | unlogged | 1 | unlogged | — | complete (inferred from state) |
| Deployer | unlogged | 1 | unlogged | — | complete (inferred from state) |

**Summary:** 13 roles activated (3 unlogged) · 4 Orchestrator Gate 1 retries (cap stated as 2) · 0 roles skipped · run within cost and token estimates

---

## Cost Breakdown

| Role | Model | Input | Output | Cost (USD) | % of run |
|---|---|---|---|---|---|
| Orchestrator (×5) | claude-sonnet-4-6 | 2,000 | 830 | $0.028 | 7.3% |
| Analyst | claude-sonnet-5 | 4,800 | 1,800 | $0.040 | 10.5% |
| Architect | claude-opus-4-8 | 5,200 | 1,800 | $0.210 | 55.0% |
| Tester Generator A | claude-haiku-4-5 | 3,200 | 1,200 | $0.007 | 1.8% |
| Tester Generator B | gpt-5.4 (openai) | 3,400 | 1,300 | $0.020 | 5.2% |
| Tester Consolidator P1 | claude-haiku-4-5 | 6,800 | 2,200 | $0.014 | 3.7% |
| Tester Arbiter P1 | claude-sonnet-5 | 1,200 | 800 | $0.015 | 3.9% |
| Tester Consolidator+Arbiter P2 | claude-sonnet-4-6 | 8,000 | 1,200 | $0.025 | 6.5% |
| Tester Arbiter (Quality Gate) | claude-sonnet-4-6 | 5,000 | 800 | $0.016 | 4.2% |
| Build Verifier | claude-sonnet-4-6 | 1,000 | 400 | $0.007 | 1.8% |
| Coder | unlogged | — | — | — | — |
| Release Documenter | unlogged | — | — | — | — |
| Deployer | unlogged | — | — | — | — |
| **Total** | | **40,600** | **12,330** | **$0.382** | 100% |

**Budget utilisation:** $0.382 of $5.00 cap (7.6%)

---

## Process Signals

| Signal | Evidence | Type | Root cause hypothesis | Item # |
|---|---|---|---|---|
| Gate 1 revision cap exceeded | 4 revision passes logged (cap: 2 per state.md#gate-0) | Rework | Spec scope expanded after initial Analyst write: `config:` field addition, cascade YAML support, env prefix reservation, and delimiter change each triggered a separate revision pass; scope was not surfaced upfront | 1 |
| Architect is dominant cost centre | $0.210 of $0.382 total (55.0%); 1,800 output tokens for 7 tickets | Cost concentration | Opus-tier model applied to a structured ticket-breakdown task; output volume (7 tickets, seam notes) does not justify principal-engineer rate; Sonnet produces equivalent structured output at ~1/5 the cost | 2 |
| Coder, Release Documenter, Deployer unlogged | 3 planned roles have zero log.md entries; state.md confirms deployment and code artifacts exist | Logging gap | Logging discipline was not uniformly enforced across the run; delivery-half cost, token spend, and duration are invisible to retro analysis and will compound as a blind spot across runs | 3 |
| Spec-implementation drift: 4 non-blocking QG findings | null coercion `AC:6` (`null→""` vs `"null"`), env auto-override `AC:13/20` not implemented, error message wording diverges from spec, hyphen test absent | Spec drift | `AC:6` and `AC:13/20` were ambiguously worded or silently revised during implementation; test suite was written to match implementation behaviour rather than spec text | 4 |
| Cross-provider ensemble caught coverage gap (positive) | Generator B (gpt-5.4/openai) uniquely covered `AC:18` via TC-034; Generator A had no equivalent case | Positive | Dual-provider ensemble design is working as intended; a single-provider setup would have shipped without `AC:18` coverage | — |
| Zero blocking QG findings; all 73 new tests pass (positive) | QG verdict: PASS; 0 blocking findings; 0 pre-existing failures introduced | Positive | Functions are well-scoped with no dead code; error messages carry file path context; no regressions against the 206-test baseline | — |

---

## What slowed us down

1. **Gate 1 spec churn** — Four revision passes against a stated cap of two. Each pass was small in isolation (`config:` header, cascade YAML support, `env.` prefix reservation, delimiter switch from `|` to `:`), but they compounded into four extra Orchestrator activations and delayed the Architect handoff. A pre-spec brief covering syntax examples, priority resolution rules, reserved keywords, and external file support would have surfaced these scope gaps before token spend began.

2. **Delivery-half logging gap** — Three planned roles (Coder, Release Documenter, Deployer) have no log entries. This did not visibly delay the run, but it renders the retro blind to the cost and duration of the implementation phase. If cost or rework patterns emerge in those roles on a future run, there will be no signal to detect.

---

## Backlog Items

| # | Title | Type | Rationale | Target |
|---|---|---|---|---|
| 1 | Add pre-spec brief checklist before Analyst activation | Process | 4 Gate 1 revisions (cap: 2) indicate scope arrived incomplete; a mandatory brief covering syntax examples, edge-case inputs, reserved names, and external-file semantics would surface gaps before token spend begins | `.claude/skills/proj-new-feature.md: ## Gate 1` |
| 2 | Mandate log entries for Coder, Release Documenter, and Deployer | Process | 3 planned roles produced no log coverage in this run; retro is blind to delivery-half cost and duration; enforcement must be in the pipeline protocol or skill so it applies to every run | `.claude/skills/proj-protocol.md: ## Logging` |
| 3 | Evaluate Sonnet tier for Architect ticket-breakdown tasks | Cost | Architect consumed 55.0% of run cost at Opus rate for 1,800 output tokens across 7 tickets; Sonnet produces equivalent structured breakdowns at significantly lower cost; reserve Opus for design tasks requiring deep judgment | `agent-config.yml: architect` |
