# Retro: feat-appid-goto-refactor

**Run:** feat-appid-goto-refactor
**Date:** 2026-09-12
**Status:** complete
**PR:** https://github.com/plaktoz/uivisor/pull/64
**State:** pipeline/feat-appid-goto-refactor/state.md
**Log:** pipeline/feat-appid-goto-refactor/log.md

## Token & Cost by Role

| Role | Model | Est. Input | Est. Output | Est. Cost | Notes |
|---|---|---|---|---|---|
| Orchestrator | claude-sonnet-4-6 | 1,200 | 420 | $0.024 | Worktree setup + plan |
| Analyst | claude-sonnet-5 | 4,800 | 1,200 | $0.032 | 1 spec revision (scope expansion) |
| Architect | claude-opus-4-8 | 5,200 | 1,100 | $0.160 | Most expensive single role; 6-task breakdown |
| tester_generator_a | claude-haiku-4-5 | 3,200 | 800 | $0.006 | Miscounted w3schools.yaml commands (12 vs 13) |
| tester_generator_b | gpt-5.4 | 3,200 | 900 | $0.015 | Cross-provider ensemble; all counts correct |
| tester_consolidator | claude-haiku-4-5 | 3,000 | 800 | $0.006 | Deduplicated to 20 final TCs |
| tester_arbiter (Phase 1) | claude-sonnet-5 | 4,000 | 900 | $0.026 | FAIL — type ambiguity TC-5/6/14, TC-4 fixture |
| tester_arbiter (Quality Gate) | claude-sonnet-5 | 5,000 | 1,000 | $0.030 | PASS on first attempt |
| Coder | claude-sonnet-5 | 12,000 | 3,000 | $0.081 | Largest output; updated test counts to match actual |

## Run Totals

| Metric | Estimated | Actual | Variance |
|---|---|---|---|
| Total cost | $0.34–$0.54 | ~$0.38 | within range |
| Duration | 21–36 min | ~35 min | within range |
| Tester retries | cap: 3 | 0 | — |
| Quality gate retries | cap: 3 | 0 | — |
| Spec revisions | cap: 2 | 1 | scope expansion (recorder-app + runner added) |

## Signal Summary

The run was clean end-to-end: one spec revision to expand scope, one tester arbiter FAIL that was corrected in-cycle without triggering a full retry, and no regressions introduced. The dominant pattern was small estimation errors upstream (Generator A's command count, initial spec missing recorder-app scope) that each required a downstream correction but none escalated — the ensemble model and arbiter caught them before code was written. Cost and duration landed in the lower third of the projected range.

## Recommendations

### Accuracy

| Finding | Evidence | Action |
|---|---|---|
| Generator A miscounted YAML command length (12 vs actual 13 for w3schools.yaml) | state.md#code-artifacts Coder note; TC-7a assertion had to be updated | Add instruction to tester_generator prompts: "read the target file and count existing commands before asserting `commands.length`" |
| Tester arbiter (Phase 1) returned FAIL due to `yaml.load .appId` vs `loadAndParse .baseUrl` type ambiguity in TC-5/6/14 | state.md#tests consolidated plan, arbiter corrections section | Seam descriptions in Architect output should explicitly label the data access path (raw YAML key vs parsed FlowFile field); add this as a seam-note convention to the Architect prompt |
| Gate 1 spec required revision to include recorder-app and runner.ts (initially scoped to 4 YAML files only) | state.md#gate-1 status "APPROVED (revision 1 of max 2)"; log.md Analyst row | Analyst prompt should explicitly check whether related source files (emitters, consumers) need parallel changes when a YAML schema usage is being refactored |

### Speed

| Finding | Evidence | Action |
|---|---|---|
| Tester Phase 1 arbiter FAIL added one in-cycle correction round but did not consume a full retry slot | log.md; state.md#tests consolidation notes | Current flow is adequate; no change needed. Correction within the arbiter turn is the right design |
| T2–T6 ran in parallel (Phase 1) with T1 held until after — execution plan was optimal for this topology | state.md#feature-task-breakdown parallel execution plan | No change needed; document this as a reference pattern for refactors with dependent removal tasks |

### Token Efficiency

| Finding | Evidence | Action |
|---|---|---|
| Architect (Opus) consumed $0.160 — 42% of total run cost — for a 6-task small refactor | log.md cost column | For refactors classified as "small" with no new interfaces or design decisions, pilot Sonnet for Architect and reserve Opus for medium/large or design-heavy runs |
| Three integration tests (TC-4, TC-9, TC-19) were spec'd but not implemented; Quality Gate accepted their absence | state.md#quality-gate | Tester consolidator should tag integration TCs as `optional` vs `required` so the Coder skips them by default on small runs and the Quality Gate threshold is pre-agreed, avoiding spec-vs-delivery ambiguity |

## Proposed Next Actions

| Priority | Finding | Target | Action |
|---|---|---|---|
| 1 | Generator A counted from memory rather than file read | `pipeline/` Tester Generator A system prompt | Add: "Before asserting `commands.length`, read the target YAML file and count existing commands." |
| 2 | Architect seam notes omit data-access path type (raw key vs FlowFile field) | `pipeline/` Architect system prompt, seam notes section | Add: "For each test seam, specify whether the accessor is raw `yaml.load` (YAML key names) or `loadAndParse` (FlowFile field names) and annotate with the field name used at that layer." |
| 3 | Opus used for Architect on small refactors with no interface design work | `agent-config.yml` Architect role config | Add a model-selection rule: use `claude-sonnet-5` when run complexity is `small` and Architect output is task-breakdown-only (no codebase-design skill invoked). |
