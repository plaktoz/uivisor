# Pipeline State: feat-tag-flow-and-shareable-flow

**Task:** tag flow and shareable flow
**Started:** 2026-08-17
**Status:** in_progress

## Gate 1: Spec

### Overview

Two new features for `uivisor` (the `webt` CLI):

1. **Tag Flow** — flows can declare string tags in their YAML header; the CLI gains a `--tag` flag to run only matching flows.
2. **Shared Flow** — flows can declare themselves as shared fragments via a `shared: true` header field; shared flows may not be run as top-level targets (only callable via `runFlow`).

---

### Feature 1: Tag Flow

#### YAML syntax

```yaml
url: https://example.com
tags: [smoke, auth]
commands:
  - goto: /login
```

- `tags` is an optional list of strings in the flow header.
- `tags` may be an empty list or omitted; either means the flow is untagged.
- Each tag must be a non-empty string. Whitespace-only strings are invalid.

#### CLI syntax

```
webt test <target> [--tag <name>] [--tag <name> ...]
```

- `--tag` may be repeated: `--tag smoke --tag auth` means "run flows that match **any** of the listed tags" (OR semantics).
- When no `--tag` flag is given, all flows run (existing behavior preserved).
- When `--tag` is given, only flows whose `tags` array contains at least one of the specified values are run.
- A flow with no `tags` field is **excluded** when `--tag` is given.
- If `--tag` filtering results in zero flows, exit with a non-zero code and print:
  `No flows matched tag(s): <tag1>, <tag2>`

#### Acceptance criteria

- AC1: Flow YAML with `tags: [smoke]` parses without error; `FlowFile.tags` is `["smoke"]`.
- AC2: Flow YAML without `tags` parses without error; `FlowFile.tags` is `[]`.
- AC3: `webt test ./flows/ --tag smoke` runs only flows tagged `smoke`; untagged and other-tagged flows are skipped.
- AC4: `webt test ./flows/ --tag smoke --tag auth` runs flows tagged `smoke` OR `auth`.
- AC5: `webt test ./flows/` (no `--tag`) runs all flows regardless of their `tags` field.
- AC6: A `tags` value that is not a list, or contains non-string/whitespace-only entries, causes a parse error with a descriptive message.
- AC7: `--tag` with zero matching flows exits non-zero and prints a "no flows matched" message.

---

### Feature 2: Shared Flow

#### YAML syntax

```yaml
url: https://example.com
shared: true
commands:
  - goto: /login
  - tapOn: { role: button, name: "Submit" }
```

- `shared` is an optional boolean header field (default `false`).
- A shared flow is a reusable fragment intended to be called only via `runFlow:`.

#### Runtime behavior

- When the CLI resolves a target (file or directory), any flow with `shared: true` is **silently skipped** as a top-level run candidate.
- If the user passes a **single shared flow** as the explicit target (e.g. `webt test ./shared/login.yml`), exit with a non-zero code and print:
  `Cannot run shared flow directly: ./shared/login.yml`
- A shared flow called via `runFlow:` executes normally (no change to existing `runFlow` behavior).

#### Acceptance criteria

- AC8: Flow YAML with `shared: true` parses without error; `FlowFile.shared` is `true`.
- AC9: Flow YAML with `shared: false` or without `shared` parses without error; `FlowFile.shared` is `false`.
- AC10: When a directory is scanned, shared flows are excluded from the execution list silently.
- AC11: Running a single shared flow as direct CLI target prints an error message and exits non-zero.
- AC12: A shared flow invoked via `runFlow:` from a non-shared flow executes and its result is captured normally.
- AC13: An invalid `shared` value (e.g. `shared: "yes"`) causes a parse error.

---

### Files to change

| File | Change |
|---|---|
| `src/types.ts` | Add `tags: string[]` and `shared: boolean` to `FlowFile`; add `tags: string[]` to `RunOptions` |
| `src/parser/validator.ts` | Add `tags` and `shared` to `VALID_HEADER_KEYS`; add validation for both |
| `src/parser/index.ts` | Extract `tags` and `shared` from parsed YAML into `FlowFile` |
| `src/cli/args.ts` | Add `tags: string[]` to `ParsedArgs`; parse repeated `--tag` flags |
| `src/cli/resolver.ts` | Filter out shared flows from directory scans; reject single shared-flow target |
| `src/cli/index.ts` | Pass `tags` in `RunOptions`; handle "no flows matched" case |
| `src/cli/runner.ts` | Filter targets by `tags` before running |

---

## Feature & Task Breakdown

| ID | Task | File(s) | Dependencies | Status |
|---|---|---|---|---|
| T1 | Add `tags` and `shared` to `FlowFile`; add `tags` to `RunOptions` | `src/types.ts` | — | open |
| T2 | Accept `tags`/`shared` in validator; validate shapes | `src/parser/validator.ts` | — | open |
| T3 | Extract `tags` and `shared` in parser; default both | `src/parser/index.ts` | T1, T2 | open |
| T4 | Parse repeated `--tag` flags in CLI args | `src/cli/args.ts` | T1 | open |
| T5 | Filter flows by shared/tags after resolution; handle error exits | `src/cli/index.ts` | T3, T4 | open |

**Architecture note:** tag + shared filtering happens in `cli/index.ts` after `resolveTarget` and before `runAll`. Files are loaded with `loadAndParse` for filtering, then the matching path list is passed to `runAll` unchanged. `resolver.ts` and `runner.ts` require no changes.

---

## Code Artifacts

| File | Change |
|---|---|
| `src/types.ts` | Added `tags: string[]`, `shared: boolean` to `FlowFile`; `tags: string[]` to `RunOptions` |
| `src/parser/validator.ts` | Added `tags`, `shared` to valid header keys; validation for both |
| `src/parser/index.ts` | Extracts `tags` (default `[]`) and `shared` (default `false`) from YAML |
| `src/cli/args.ts` | Added `tags: string[]` to `ParsedArgs`; parses repeated `--tag` flags |
| `src/cli/filter.ts` | New: pure `filterFlows()` and `isSingleSharedFlowTarget()` |
| `src/cli/index.ts` | Wires tags + shared filtering, error exits for zero-match and direct-shared-flow |

---

## Test Results

**Unit tests:** 131 passed / 4 failed
- 4 failures are pre-existing in `reporter.test.ts` (unrelated to this feature — `runDir` undefined bug)
- All 14 new tests for tags and shared flow pass

**Build:** TypeScript compiles cleanly (`tsc` exits 0)

---

## Tests

- `tests/unit/parser.test.ts` — added tags/shared tests (AC-tag-1/2/6, AC-shared-8/9/13)
- `tests/unit/args.test.ts` — added `--tag` flag tests
- `tests/unit/flow-filter.test.ts` — new; tests `filterFlows` and `isSingleSharedFlowTarget` (AC3–5, 7, 10–11)

---

## Gate 0: Execution Plan

**Classification:** feature

**Roles Activated:** Analyst, Designer, Architect, Tester, Coder, Deployer

**Designer Activated:** no

**Execution Sequence:**
1. Analyst → skill: to-spec
   Output: spec + acceptance criteria → state.md#gate-1
   [GATE 1: human approval required]
2. Architect → skill: to-tickets + codebase-design
   Reads: Gate 1 spec
   Output: feature/task breakdown table → state.md#feature-task-breakdown
3. Tester Phase 1 → skill: tdd
   Reads: spec + acceptance criteria
   Output: unit tests + integration tests → state.md#tests
4. Coder → skill: implement
   Reads: spec + tests from state.md
   Output: source files → state.md#code-artifacts
   Parallel execution: true
5. Tester Phase 2 → skill: tdd + code-review
   Reads: state.md#tests + all source files
   Output: test results → state.md#test-results
   Max retries: 3
   [GATE 3: human approval required before deploying]
6. Deployer → skill: proj-deploy
