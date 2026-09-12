# Retro: feat-continue-recording-after-flow

**Delivered:** 2026-09-12
**PRs:** #65 (feature), #66 (README docs)

## What went well

- Clean separation of concerns held throughout: extension validation in `parseArgs`, existence/collision checks in `validateRunFlowPaths` (cli.ts), replay logic fully encapsulated in `flowReplayer.ts`.
- No new external dependencies required — `js-yaml`, `playwright`, and `@uivisor/core` were already present in the manifest. TypeScript build passed with 0 errors and no manifest changes.
- Architect's OQ1 decision was clearly reasoned, documented in state.md, and paired with a `// TODO(arch)` comment in the implementation — long-term path preserved without blocking the PR.
- Quality gate and build check both passed on the first attempt with no retry rounds.
- Tester ensemble produced 48 deduplicated tests across three files, covering all 14 acceptance criteria. The two-generator approach surfaced a real design ambiguity (appendCommand responsibility) that the arbiter caught and resolved before the coder started.
- Circular-reference guard and progress logging (`[replay] <file>: n/total commands`) were included without being called out as explicit ACs — proactive defensive coding.

## What was rough

- OQ2 (`vars:/config:` interpolation in replayed flows) was flagged as ambiguous in the spec but received no explicit resolution entry in state.md or log.md. The implementation implicitly chose raw-value replay. This leaves a silent correctness hole with no decision record.
- Generator A incorrectly assumed `replayFlows` would call `appendCommand` (T-A-019 vs T-B-024 contradiction), revealing that the spec's module responsibility boundary between `cli.ts` and `flowReplayer.ts` was not immediately legible. The arbiter caught it, but it added resolution work.
- Gate 1 (spec approval) is logged as "awaiting human approval" with no explicit approval entry in log.md. The run proceeded past it, but the gate status was never closed in writing.
- Trailing comma edge case (T13) was not implemented as a dedicated check — it falls through to the extension validator, which rejects the empty string. Correct behaviour, but there is no test that explicitly names the trailing-comma scenario, and the coverage gap was noted as a minor finding at the quality gate.

## Findings (prioritised)

### P1 — Duplicated Playwright dispatch will diverge

`flowReplayer.ts` inlines a self-contained implementation of Playwright command dispatch covering all 25+ command types. An identical (but independently maintained) implementation already exists in `uivisor-app/src/engine/`. Every time a new command type is added to uivisor-app, `flowReplayer.ts` must be updated separately. The `// TODO(arch): migrate shared dispatch to @uivisor/core` comment documents the intent, but without a ticket it will be deferred indefinitely.

**Recommendation:** Create a tracked task to move the shared dispatch layer to `@uivisor/core` before the next command type is added. The migration is mechanical (the Architect's OQ1 rationale already scoped it) and is lowest-risk when done while the two implementations are still identical.

### P2 — Silent failure for flows containing variable interpolation

The replayer uses raw `js-yaml.load` values with no `vars:/config:` substitution. A flow such as `goto: "{{baseUrl}}/login"` will cause Playwright to attempt to navigate to the literal string `{{baseUrl}}/login` — no error is thrown, the command silently uses the wrong value.

**Recommendation:** Add a pre-flight scan in `replayFlows` that detects `{{...}}` patterns in command values and either resolves them from a passed-in vars map or exits with a clear message: `--run-flow: flow contains variable interpolation which is not supported in replay mode: <path>`. Alternatively, document the limitation in the HELP text so users are not surprised.

### P3 — Open questions need explicit resolution records

OQ2 reached the implementation phase without a written decision. The replayer made a choice (raw values, no interpolation), but there is no log entry, state.md section, or code comment that says "OQ2 resolved: vars/config substitution out of scope for this release." Future maintainers cannot distinguish a deliberate decision from an overlooked requirement.

**Recommendation:** Add an "OQ resolution" section to state.md in the Architect phase. Every open question must be closed before the Coder phase starts, even if the resolution is explicitly "deferred / out of scope."

### P4 — Module responsibility boundaries should be stated at the top of each file

The test generator contradiction (T-A-019 vs T-B-024) traced back to the spec not making the `cli.ts` / `flowReplayer.ts` boundary explicit enough. Generator A read the spec and inferred the wrong owner for `appendCommand`. A one-line module-purpose comment at the top of each new file (e.g., `// flowReplayer.ts: executes flow YAML commands through Playwright; never writes to the output file`) would have prevented the contradiction and serves as permanent documentation for future contributors.

**Recommendation:** Adopt a convention of a module-purpose comment on the first line of every non-trivial new source file. Include what the module does NOT do when the boundary is non-obvious.

## Process metrics

- Roles activated: 6 (Analyst, Architect, Tester Ensemble — generator_a + generator_b + consolidator + arbiter, Coder, Release Documenter, Deployer)
- Retry rounds: 0
- Spec revisions: 0
- Test cases generated: 48 (18 unique to Generator A, 24 unique to Generator B, 6 shared; deduplicated by Consolidator + Arbiter)
- Tests passing: 48/48 (all 14 ACs covered per Quality Gate verdict)
- Quality gate: PASS on first attempt
- Build check: PASS on first attempt (0 TypeScript errors)

## One-line summary

The duplicated Playwright dispatch in `flowReplayer.ts` is the run's main debt — cut a ticket to migrate it to `@uivisor/core` before the next command type lands.
