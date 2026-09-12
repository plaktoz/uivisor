# Retro: feat-select-by-xpath

**Run:** feat-select-by-xpath  
**Date:** 2026-09-12  
**Status:** deployed  
**PR:** https://github.com/plaktoz/uivisor/pull/63  
**State:** pipeline/feat-select-by-xpath/state.md  
**Log:** pipeline/feat-select-by-xpath/log.md (not created — single-coder run)

---

## Token & Cost by Role (estimated)

| Role | Model | Est. Input Tok | Est. Output Tok | Est. Cost (USD) |
|---|---|---|---|---|
| Orchestrator | claude-opus-4-8 | 8,000 | 2,000 | $0.27 |
| Analyst | claude-sonnet-5 | 6,000 | 2,500 | $0.055 |
| Tester Gen A | claude-haiku-4-5 | 4,000 | 3,000 | $0.015 |
| Tester Gen B | gpt-5.4 | 4,000 | 3,000 | $0.038 |
| Tester Consolidator | claude-haiku-4-5 | 5,000 | 2,000 | $0.012 |
| Tester Arbiter | claude-sonnet-5 | 6,000 | 1,500 | $0.041 |
| Coder | claude-sonnet-5 | 43,486 | ~12,000 | $0.31 |
| Quality Gate | claude-sonnet-5 | 2,000 | 500 | $0.014 |
| **Total** | | **~78K** | **~26K** | **~$0.75** |

---

## Run Totals

| Metric | Value |
|---|---|
| Duration | ~25 min (Coder: ~20 min) |
| Total tokens (est.) | ~104K |
| Total cost (est.) | ~$0.75 |
| TDD retries | 0 |
| Quality gate retries | 0 |
| Spec revisions | 0 |
| Code review cycles | 0 |

---

## Signal Summary

The xpath feature was implemented cleanly in a single Coder pass with zero retries, 0 new test failures, and full 14/14 AC coverage. The Tester Ensemble's pre-written tests served as a precise spec — the Coder had no ambiguity about expected behavior, particularly around union-conflict detection and the `first-match-wins` ordering for `selectorParser.ts`. The pre-existing 10 reporter/CLI failures were correctly quarantined and did not block the quality gate.

---

## Accuracy

| Finding | Evidence | Action |
|---|---|---|
| Arbiter note about first-match-wins ordering (xpath before css in selectorParser) prevented a bug | Coder correctly placed xpath check before css; TC-XPATH-P10 would have failed otherwise | Keep arbiter notes specific about insertion order for selectorParser tests |
| Union conflict detection (T5) triggered correctly on `xpath=//a\|//b` pipe form | TC-B-004 test passes; error message guides user to object form | Pipe-string conflict pattern (`attr === 'xpath' && segments.length > 1`) is a good template for future attrs with special chars |

---

## Speed

| Finding | Evidence | Action |
|---|---|---|
| Coder ran for ~20 min total with 78 tool uses — single-pass, no retry | state.md status=complete, 0 TDD retries | No action — single-pass is the target; this run met it |
| 4 test files (897 insertions) were written by Coder, not just 1 | Tester Ensemble covered resolveSelector, parser, matcher, within-dispatcher | Ensemble's multi-file test approach reduced Coder rework; continue this pattern |

---

## Token Efficiency

| Finding | Evidence | Action |
|---|---|---|
| Coder used 43K subagent tokens (well within budget for T1–T6 + 4 test files) | subagent_tokens: 43486 from task notification | Estimated 60–80K for this complexity; 43K is efficient; spec quality was a factor |
| No log.md was maintained for this run | log.md not found at retro time | Add log.md creation step to Orchestrator's run setup for all future runs — even single-coder runs benefit from cost tracking |

---

## Proposed Next Actions

| Priority | Finding | Action | Target |
|---|---|---|---|
| 1 | No log.md maintained | Create log.md with header row at run setup, append one row per role activation | `pipeline/feat-select-by-xpath/log.md` (missed) — fix in next run's Step 0 |
| 2 | `resolveContainerLocator` does not support xpath object form | Within-scoping for xpath containers requires `resolveContainerLocator` to handle `{ xpath }` objects — currently only handles string selectors | `uivisor-app/src/matcher/index.ts:resolveContainerLocator` |
| 3 | `pipe-syntax xpath=` is subject to `|` ambiguity at user level | Users who know xpath but not uivisor may try `xpath=//a\|//b` and get a confusing parse error | Improve the conflict error message to explicitly say "use `{ xpath: '//a \| //b' }` object form instead" — message already references object form but doesn't show the YAML syntax |
