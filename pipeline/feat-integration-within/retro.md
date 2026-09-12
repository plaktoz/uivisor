# Sprint Retro: feat-integration-within

**Run:** pipeline/feat-integration-within/
**Date:** 2026-09-12
**Outcome:** delivered
**PR:** https://github.com/plaktoz/uivisor/pull/58
**state.md:** pipeline/feat-integration-within/state.md
**log.md:** pipeline/feat-integration-within/log.md

---

## Velocity

| Role | Tier | Planned | Activations | Retries | Status |
|---|---|---|---|---|---|
| Orchestrator | principal | 1 | 1 | 0 | on plan |
| Analyst | senior | 1 | 1 | 0 | on plan |
| Architect | senior | 1 | 0 | 0 | skipped (log gap — work completed in prior session) |
| Tester Ensemble Phase 1 | senior/junior | 1 | 0 | 0 | skipped (log gap — work completed in prior session) |
| Coder | senior | 1 | 0 | 0 | skipped (log gap — work completed in prior session) |
| Tester Ensemble Phase 2 | senior | 1 | 1 | 0 | on plan |
| Quality Gate | senior | 1 | 1 | 0 | on plan |
| Build Verifier | senior | 1 | 1 | 0 | on plan |
| Deployer | senior | 1 | 1 | 0 | on plan |

**Summary:** 6 roles logged · 0 retried · 3 not captured in log (prior session) · run within estimate

---

## Cost Breakdown

| Role | Model | Input | Output | Cost (USD) | % of run |
|---|---|---|---|---|---|
| Orchestrator | claude-opus-4-8 | 2000 | 340 | $0.056 | 46.3% |
| Analyst | claude-sonnet-5 | 4800 | 1800 | $0.041 | 33.9% |
| Tester Ensemble Phase 2 | claude-sonnet-4-6 | 2000 | 400 | $0.012 | 9.9% |
| Quality Gate | claude-sonnet-4-6 | 1500 | 200 | $0.006 | 5.0% |
| Build Verifier | claude-sonnet-4-6 | 800 | 150 | $0.003 | 2.5% |
| Deployer | claude-sonnet-4-6 | 500 | 100 | $0.002 | 1.7% |
| Architect | — | — | — | not logged | — |
| Tester Ensemble Phase 1 | — | — | — | not logged | — |
| Coder | — | — | — | not logged | — |
| **Total (logged)** | | **11600** | **2990** | **$0.121** | 100% |

**Budget utilisation:** $0.121 logged of $5.00 cap (2.4%) — substantial portion of run not captured in log.

**Model tier flags:**
- Orchestrator used `claude-opus-4-8` and produced 340 output tokens — principal-tier cost for a planning task that follows a fixed template. Consider downtiering to Sonnet.
- Architect, Tester Ensemble Phase 1, and Coder activations are absent from log.md — cost for these roles is unaccounted.

---

## Process Signals

| Signal | Evidence | Type | Root cause hypothesis | Item # |
|---|---|---|---|---|
| Context boundary mid-run: Architect, Tester Phase 1, Coder not in log | log.md rows 3–6 jump from Analyst (00:01) to Tester Phase 2 (16:30) | risk | These roles ran in a prior session whose log rows were never written to log.md; log was only resumed in the continuation session | #1 |
| `within` selector format bug caused one test run failure before fix | state.md#test-results note; YAML used `testId:` / `css:` keys not valid in pipe-syntax | risk | `within` parser builds `key=value` strings; `isValidAttr` only accepts `data-*` and `text/label/role/id/name/placeholder` — not `testId` or `css` | #2 |
| Orchestrator used Opus for a templated Gate 0 task (340 output tokens) | log.md row 1; $0.056 = 46% of logged cost | risk | Gate 0 follows a fixed template from proj-new-feature skill — Sonnet would produce equivalent output at ~10× lower cost | #3 |
| Zero retries in logged Phase 2 through deploy | log.md rows 7–10 all status=complete, no retry rows | positive | Spec + fixture implementation were well-aligned; no rework after initial selector fix | — |
| All 21 ACs passed at Quality Gate on first attempt | state.md#quality-gate | positive | Coder correctly implemented all five within sections and YAML structure | — |

---

## What slowed us down

1. **YAML selector format bug** — The `within` command's `testId:` YAML key produced `testId=foo` which failed `isValidAttr`. One failed flow run + manual source code investigation to identify the correct `data-testid:` key format. Estimated cost: ~5–10 min + one wasted Playwright browser launch. A note in the flow authoring skill or parser error message would prevent this.

2. **Log gap across session boundary** — Architect, Tester Phase 1, and Coder activations are missing from log.md, making cost attribution incomplete. This is structural: `log.md` is only writable from the main session, and when a session is compacted and resumed, prior log entries aren't re-written. Impact: cost and velocity reporting is incomplete for this run.

---

## Backlog Items

| # | Title | Type | Rationale | Target |
|---|---|---|---|---|
| 1 | Document valid `within` selector keys in flow authoring guidance | skills | Signal #2: `testId:` and `css:` keys silently parse but fail at runtime; `data-testid:` must be spelled out — one sentence in the YAML authoring skill would prevent recurrence | `.claude/skills/proj-new-feature`: within YAML examples section |
| 2 | Append a parser error hint for unknown `within` selector keys | roles | Signal #2: `resolveContainerLocator` error message says "Unknown attribute 'testId'" but doesn't hint at the correct `data-testid:` alternative — updating the error in `commandParser.ts` / `matcher/index.ts` would surface the fix without needing to read source | `uivisor-app/src/matcher/index.ts`: `parsePipeString` error message |
| 3 | Downtier Orchestrator from Opus to Sonnet for Gate 0 planning | config | Signal #3: Gate 0 produced 340 output tokens at $0.056 (46% of logged spend) — the task is template-driven and Sonnet would produce equivalent quality at ~$0.005 | `agent-config.yml`: `roles.orchestrator.model` |
