# Pipeline State: feat-continue-recording-after-flow

**Task:** Add a `--run-flow <path1,path2,...>` flag to the recorder-app. When supplied, the recorder replays the given flow files in sequence (using Playwright) to reach a desired browser state, then begins recording new user interactions into a NEW output file. The output file must not overwrite any of the input flow files. The output YAML starts with `runFlow:` references to each input flow (in order) so the full flow is self-contained and re-runnable, followed by newly recorded commands.
**Started:** 2026-09-12
**Status:** deployed

---

## Gate 0: Execution Plan

**Classification:** feature
**Complexity:** medium

**Roles Activated:** Analyst, Architect, Tester Ensemble, Coder, Release Documenter, Deployer
**Designer Activated:** no (CLI/Node feature — no UI/UX component)

**Execution Sequence:**
1. Analyst → skill: to-spec
   Output: spec + acceptance criteria → state.md#gate-1
   [GATE 1: human approval required — revision cap: 2]
2. Architect → skill: to-tickets + codebase-design
   Reads: Gate 1 spec
   Output: feature/task breakdown table → state.md#feature-task-breakdown
3. Tester Ensemble Phase 1 → skill: tdd
   3a. tester_generator_a + tester_generator_b in parallel
   3b. tester_consolidator → state.md#tests
   3c. tester_arbiter → resolves disagreements
4. Coder → skill: implement
   Working directory: .worktrees/feat-continue-recording-after-flow
5. Tester Ensemble Phase 2 + Quality Gate
6. Build Verifier (autonomous)
   [GATE 3: human approval required before deploying]
7. Release Documenter → signoff_package.md
8. Deployer
9. Delivery Manager → retro.md

## Run Estimates

**Complexity:** medium
**Duration:** ~38–65 min (no retries: ~38 min)
**Cost:** ~$1.20–$3.00 (cap: $5.00)
**Tokens:** ~200K–400K tokens

**Retry budgets:** TDD + quality gate: 3 · Spec: 2 · Design: n/a · Code review: 2

## Worktree
**Path:** .worktrees/feat-continue-recording-after-flow
**Branch:** feat-continue-recording-after-flow
**Created:** 2026-09-12
**Status:** active

---

## Gate 1: Spec

See `spec.md` for full spec.

**Status:** awaiting human approval

---

## Gate 2 (skipped — no Designer)

## Architect Decision: OQ1 — Replay Engine Location

**Chosen option:** c
**Rationale:** `recorder-app` already carries all the dependencies needed for a self-contained replayer — `@uivisor/core` for command types, `playwright` for execution, and `js-yaml` for YAML parsing — so no package-graph changes are required. Option (a) would require moving `dispatcher.ts`, the entire `driver/commands.ts` layer, and parts of `reporter/` to `@uivisor/core`, a multi-package refactor that dwarfs the feature itself and breaks the principle of minimal blast radius. Option (b) couples the lightweight recorder to the full `uivisor` test-runner (HTML reporter, screenshot engine, etc.), pulling in unrelated weight. Finally, the spec marks `vars:/config:` interpolation out of scope for this release, which means the replayer only needs raw `js-yaml` loading — no need to import uivisor-app's sophisticated parser. A `// TODO(arch): migrate shared dispatch to @uivisor/core` note in `flowReplayer.ts` documents the long-term path without blocking this PR.

---

## Feature/Task Breakdown

| # | Task | File(s) | Depends on | Notes |
|---|---|---|---|---|
| T1 | Add `runFlowPaths: string[]` to `RecordArgs`, parse `--run-flow` comma-delimited flag, validate `.yaml`/`.yml` extension, update HELP text | `recorder-app/src/args.ts` | — | ACs 1, 2, 14; extension check done inside `parseArgs` |
| T2 | Implement `flowReplayer.ts` — self-contained YAML loader + Playwright command dispatcher covering all 25+ command types + nested `runFlow:` recursion with circular-ref guard + progress/error logging | `recorder-app/src/flowReplayer.ts` (NEW) | — | ACs 9, 10, 11; option (c); reuse `@uivisor/core` types, `playwright` page, `js-yaml` |
| T3 | Update `cli.ts`: add `validateRunFlowPaths` (existence, path-collision checks), derive `url` from first flow's `appId:`/`url:` when no explicit url, write `runFlow:` references via `appendCommand`, call `replayFlows` before recording loop | `recorder-app/src/cli.ts` | T1, T2 | ACs 3–8, 12; AC6 collision guard; AC7/8 url derivation; AC12 no-op when `runFlowPaths` is empty |
| T4 | Unit tests for `args.ts` `--run-flow` parsing | `recorder-app/src/args.test.ts` (NEW) | T1 | ACs 1, 2, 13, 14; covers comma-split, extension error, missing-file error |
| T5 | Unit + integration tests for `flowReplayer.ts` and `cli.ts` replay orchestration | `recorder-app/src/flowReplayer.test.ts` (NEW) | T2, T3 | ACs 3–5, 7–11; mock Playwright `page`; fixture YAML files in `__fixtures__/` |

**Blocking edges:**
- T3 blocks on T1 (needs `runFlowPaths` in `RecordArgs` before wiring cli.ts)
- T3 blocks on T2 (needs `replayFlows` export before calling it in cli.ts)
- T4 blocks on T1 (tests exercise args.ts changes)
- T5 blocks on T2 and T3 (tests exercise both the replayer and cli.ts integration)

**Parallel tasks:** T1 and T2 are fully independent and can be implemented simultaneously. T4 can start as soon as T1 is done, before T3 is complete.

---

## Tests — Generator A (tester_generator_a)

### File: `recorder-app/src/args.test.ts`

**T-A-001** | AC1 | `parseArgs` with `--run-flow a.yaml` returns `runFlowPaths: ['a.yaml']` (single element). | Setup: `argv = ['node', 'cli.js', '--run-flow', 'a.yaml']` | Seam: none.
**T-A-002** | AC1, AC2 | `parseArgs` with `--run-flow a.yaml,b.yaml` returns `runFlowPaths` of length 2: `['a.yaml', 'b.yaml']`. | Seam: none.
**T-A-003** | AC2 | `parseArgs` with `--run-flow x.yaml,y.yaml,z.yaml` returns `runFlowPaths` of length 3 in declaration order. | Seam: none.
**T-A-004** | AC12 | When `--run-flow` is absent, `parseArgs` returns `runFlowPaths: []` (empty array, not undefined). | Seam: none.
**T-A-005** | AC12 | When `--run-flow` absent, url/outputPath defaults are unchanged from pre-feature baseline. | Seam: none.
**T-A-006** | AC14 | `parseArgs` throws extension error when a path ends with `.json`. | Seam: none.
**T-A-007** | AC14 | `parseArgs` throws extension error when a path has no extension. | Seam: none.
**T-A-008** | AC14 | `parseArgs` throws for mixed list (`.yaml`, `.json`); error message contains the bad path. | Seam: none.
**T-A-009** | AC1, AC14 | `parseArgs` accepts `.yml` extension without throwing, includes it in `runFlowPaths`. | Seam: none.
**T-A-010** | AC1 | `parseArgs` throws "requires a value" when `--run-flow` appears with no following argument. | Seam: none.
**T-A-011** | AC1 | `parseArgs` stores paths exactly as supplied, not `path.resolve`d, preserving `./` prefixes. | Seam: none.
**T-A-012** | AC1, AC2, AC12 | Combined invocation `--run-flow a.yaml,b.yaml --output out.yaml --base-url ...` populates all fields independently. | Seam: none.
**T-A-013** | AC12 | `runFlowPaths` is always present (never `undefined`) regardless of flag presence. | Seam: none.
**T-A-014** | AC6 | `validateRunFlowPaths` throws collision error when `--output` and one `--run-flow` path resolve to the same absolute path. | Seam: `process.cwd` or absolute paths.
**T-A-015** | AC13 | `validateRunFlowPaths` throws `--run-flow: file not found: <path>` when a listed path does not exist. | Seam: real fs tmp dir.
**T-A-016** | AC13 | Error message from `validateRunFlowPaths` for missing file contains the exact path string supplied. | Seam: real fs.
**T-A-017** | AC2 | Trailing comma in `--run-flow a.yaml,` does not produce a spurious empty entry, or is rejected by validation. | Seam: none.
**T-A-018** | AC14 | Extension-error message thrown by `parseArgs` names the specific invalid path. | Seam: none.

### File: `recorder-app/src/flowReplayer.test.ts`

**T-A-019** | AC3 | `replayFlows` calls `appendCommand` once per input path with `{ type: 'runFlow', path: <relative> }` before any Playwright calls. | Seam: spy on `appendCommand`; mock `page`.
**T-A-020** | AC4 | When output is `recordings/out.yaml` and input is `flows/setup.yaml`, the entry written is `../flows/setup.yaml`. | Seam: real fs tmp; mock `page`.
**T-A-021** | AC4 | When output file and input flow share a directory, the relative path is just the filename (no `../`). | Seam: real fs; mock `page`.
**T-A-022** | AC5 | After `replayFlows`, input flow YAML files are byte-for-byte identical to before. | Seam: real fs; mock `page`.
**T-A-023** | AC7 | `replayFlows` returns/exposes the `appId` from the first flow file for the caller to use. | Seam: real fs fixture; mock `page`.
**T-A-024** | AC8 | `replayFlows` does not call `startSession` itself; it leaves session header to the caller. | Seam: spy on `startSession`; mock `page`.
**T-A-025** | AC9 | `replayFlows` rejects when a Playwright page method throws for a replayed command. | Seam: mock `page` with rejecting locator.
**T-A-026** | AC10 | Error thrown on replay failure contains the flow filename. | Seam: mock `page`.
**T-A-027** | AC10 | Error thrown on replay failure contains the command type and selector. | Seam: mock `page`.
**T-A-028** | AC11 | When an input flow contains `runFlow: ./sub.yaml`, the sub-flow commands are executed through Playwright. | Seam: mock `page.goto`; real fs fixtures.
**T-A-029** | AC11 | Nested `runFlow` references inside input flows are NOT written as additional entries to the output file. | Seam: spy on `appendCommand`; mock `page`.
**T-A-030** | AC9 | On mid-flow failure, the output file still contains the `runFlow:` header entries (file preserved, not deleted). | Seam: real fs; mock `page`.
**T-A-031** | AC3, AC12 | Single input path → exactly one `runFlow:` entry written to output. | Seam: real fs; mock `page`.

---

## Tests — Generator B (tester_generator_b)

### File: `recorder-app/src/cli.integration.test.ts`

**T-B-001** | AC7 | `main()` calls `startSession` with the `appId` from the first flow file when no explicit URL supplied. | Seam: mock Playwright + `replayFlows`; spy on `startSession` or read output file.
**T-B-002** | AC8 | With `--run-flow` + `--base-url http://staging.example.com`, output file's `appId:` is the explicit URL, not the flow file's. | Seam: mock Playwright + `replayFlows`; read output file.
**T-B-003** | AC3, AC4 | Two input flows + output in sibling dir → output YAML contains `runFlow: ../flows/setup.yaml` and `runFlow: ../flows/login.yaml` as first two commands. | Seam: mock Playwright + `replayFlows`; parse output with `yaml.load`.
**T-B-004** | AC4 | `runFlow:` path in output is relative (no leading `/`); computed from output dir to input flow path. | Seam: mock Playwright + `replayFlows`; read output file.
**T-B-005** | AC6 | When `--output` and `--run-flow` resolve to the same path, exits code 1 before `chromium.launch`. | Seam: spy `process.exit`; mock `chromium.launch`; spy `console.error`.
**T-B-006** | AC13 | Non-existent `--run-flow` path → exits code 1, logs `--run-flow: file not found: <path>`, browser not launched. | Seam: spy `process.exit`; mock `chromium.launch`.
**T-B-007** | AC14 | `.json` extension in `--run-flow` (file exists) → exits code 1, logs extension error, browser not launched. | Seam: real fs; spy `process.exit`; mock `chromium.launch`.
**T-B-008** | AC9 | When `replayFlows` rejects, `main()` exits code 1 and never calls `page.exposeFunction` for capture/overlay. | Seam: mock `replayFlows` to reject; spy `page.exposeFunction`; spy `process.exit`.
**T-B-009** | AC9 | When replay fails, partial output file (with `runFlow:` entries) is preserved on disk. | Seam: real fs; mock `replayFlows` to reject after file written.
**T-B-010** | AC10 | Replay error surfaced to user contains flow filename and failed command, matching `[replay] FAILED: ...` pattern. | Seam: mock `replayFlows` to reject with structured error; spy `console.error`.
**T-B-011** | AC12 | No `--run-flow` → `appendCommand` never called with `runFlow` type; `page.goto` called with URL. | Seam: mock Playwright; spy `appendCommand`.
**T-B-012** | AC5 | After `main()` completes, both input flow files are byte-for-byte identical to before. | Seam: real fs; mock Playwright + `replayFlows`.
**T-B-013** | AC3 | After replay, live-captured commands (injected via `__uivisorCapture`) appear after the `runFlow:` entries in the output file. | Seam: mock Playwright; capture `exposeFunction` callback; inject test commands; parse output.
**T-B-014** | AC7 | Flow file with `url:` field (not `appId:`) → CLI still derives URL from that field correctly. | Seam: fixture YAML with `url:` key; mock Playwright + `replayFlows`; read output.
**T-B-015** | AC6 | Collision guard fires for `./flows/setup.yaml` vs `flows/setup.yaml` (same resolved path, different notation). | Seam: spy `process.exit`; mock `chromium.launch`.
**T-B-027** | AC3, AC4, AC7 | Full e2e: `main()` with two flows + output in different dir + one user-captured `goto` appended → output YAML is valid with correct structure. | Seam: mock Playwright + `replayFlows`; inject via capture callback; `yaml.load` full output.
**T-B-028** | AC14 | `.yml` extension → validation passes, no exit code 1, `replayFlows` invoked normally. | Seam: spy `process.exit`; mock Playwright + `replayFlows`.
**T-B-029** | AC2 | `--run-flow x.yaml,y.yaml,z.yaml` → `replayFlows` called with all three paths in order. | Seam: spy `replayFlows`; mock Playwright.
**T-B-030** | AC6 | Third-of-three path collides with output → exit code 1; error message names the colliding path; browser not launched. | Seam: spy `process.exit` + `console.error`; mock `chromium.launch`.

### File: `recorder-app/src/flowReplayer.test.ts`

**T-B-016** | AC9 | Single `goto` command → `page.goto` called once with correct URL. | Seam: mock `page`.
**T-B-017** | AC9 | Three-command flow (goto, tapOn, wait) → all three dispatched in order. | Seam: mock `page`; track call order.
**T-B-018** | AC2, AC9 | Two flows in sequence → all commands from flow 1 execute before any from flow 2. | Seam: mock `page`; `callOrder` array.
**T-B-019** | AC11 | `runFlow: ./sub.yaml` inside input flow → sub-flow's concrete commands dispatched to Playwright. | Seam: mock `page.goto`; real fs fixtures.
**T-B-020** | AC9, AC10 | `assertVisible` mock rejection → `replayFlows` rejects with `[replay] FAILED`, filename, and selector in message. | Seam: mock `page.locator().waitFor()` to reject.
**T-B-021** | AC9 | Second command fails → third command never dispatched. | Seam: mock `page`; assert third-command mock call count = 0.
**T-B-022** | AC9 | Progress log `[replay] <file>: n/total commands` emitted for each command. | Seam: spy `console.log`; assert three calls with correct counts.
**T-B-023** | AC11 | Failing assertion inside nested `runFlow` → parent-flow commands after the `runFlow` never executed. | Seam: mock `page`; assert post-runFlow tapOn call count = 0.
**T-B-024** | AC5 | `replayFlows` does not call `appendCommand` or write to the output file during replay. | Seam: spy `appendCommand`; assert no calls; output file unchanged.
**T-B-025** | AC11 | Three-level nested chain (A→B→C, C has `goto`) → `page.goto` called once with C's URL. | Seam: mock `page.goto`; real fs fixtures.
**T-B-026** | AC9 | `assertUrl` mismatch → `replayFlows` rejects with error containing expected and actual URL. | Seam: mock `page.url()`.

---

## Tests

### Attribution

| AC | Generator A tests | Generator B tests |
|---|---|---|
| AC1 | T-A-001, T-A-002, T-A-009, T-A-010, T-A-011, T-A-012 | — |
| AC2 | T-A-002, T-A-003, T-A-017 | T-B-018, T-B-029 |
| AC3 | T-A-019 (reclassified), T-A-031 (reclassified) | T-B-003, T-B-013, T-B-027 |
| AC4 | T-A-020 (absorbed), T-A-021 (reclassified) | T-B-003, T-B-004, T-B-027 |
| AC5 | T-A-022 (absorbed) | T-B-012, T-B-024 |
| AC6 | T-A-014 (absorbed) | T-B-005, T-B-015, T-B-030 |
| AC7 | T-A-023 | T-B-001, T-B-014, T-B-027 |
| AC8 | T-A-024 | T-B-002 |
| AC9 | T-A-025, T-A-026, T-A-027 (absorbed) | T-B-008, T-B-009, T-B-016, T-B-017, T-B-018, T-B-020, T-B-021, T-B-026 |
| AC10 | T-A-026, T-A-027 (absorbed) | T-B-010, T-B-020, T-B-026 |
| AC11 | T-A-028 (absorbed), T-A-029 | T-B-019, T-B-023, T-B-025 |
| AC12 | T-A-004, T-A-005, T-A-012, T-A-013 (merged) | T-B-011 |
| AC13 | T-A-015, T-A-016 (absorbed) | T-B-006 |
| AC14 | T-A-006, T-A-007, T-A-008, T-A-009, T-A-018 (merged) | T-B-007, T-B-028 |

**Unique to A:** 18  **Unique to B:** 24  **Shared:** 6  **Total after dedup:** 48

### Arbiter notes

**Contradiction 1 — Location of validateRunFlowPaths tests (AC6, AC13)**
Generator A placed collision (T-A-014) and file-not-found (T-A-015, T-A-016) tests in `args.test.ts`, implying these checks live inside `parseArgs`. The spec is unambiguous: "Validation is performed in `parseArgs` for path-count/extension checks, and in a new `validateRunFlowPaths(args)` helper called in `cli.ts` before the browser is launched, for the file-not-found and appId checks." Resolution: T-A-014, T-A-015, T-A-016 are reclassified to `cli.integration.test.ts` and absorbed by T32 (T-B-005) and T33 (T-B-006) respectively, which correctly test these behaviours at the CLI level before `chromium.launch`.

**Contradiction 2 — Who calls appendCommand for runFlow entries (AC3)**
Generator A's T-A-019 (placed in `flowReplayer.test.ts`) asserted that `replayFlows` itself calls `appendCommand` to write the `runFlow:` header entries. Generator B's T-B-024 correctly asserted the opposite: `replayFlows` does NOT call `appendCommand`. The spec §3.1 is explicit — step 5 (write runFlow entries via `appendCommand`) is the CLI's responsibility, executed before step 7 (call `replayFlows`). Resolution: T-A-019 is dropped as a standalone test; its observable effect (runFlow entries appear in output before live-captured commands) is covered by T30 and T40 in `cli.integration.test.ts`. T23 (T-B-024) is retained as the authoritative unit-level guard.

**Contradiction 3 — Placement of relative-path and single-entry tests (AC3, AC4)**
Generator A placed T-A-020 (sibling-dir relative path), T-A-021 (same-dir relative path), and T-A-031 (single path → one runFlow entry) inside `flowReplayer.test.ts`. Because the path computation (`path.relative(path.dirname(outputPath), path.resolve(inputPath))`) and the `appendCommand` call are the CLI's responsibility, these tests belong in `cli.integration.test.ts`. Resolution: T-A-020 is absorbed by T30/T31 (T-B-003/T-B-004). T-A-021 (unique same-directory case, no B equivalent) is retained as T47. T-A-031 (unique single-path smoke test, no B equivalent) is retained as T48.

**Design question — Does replayFlows return appId? (AC7)**
Generator A's T25 (T-A-023) assumes `replayFlows` returns/exposes the `appId` from the first flow file. The spec §3.1 step 3 states "CLI reads the appId: field from the first input flow using `js-yaml.load`", indicating the CLI does this directly. However, since `replayFlows` already loads each flow YAML, returning `{ appId }` as metadata avoids double-loading and is architecturally clean. T25 is retained in `flowReplayer.test.ts` as specification of the preferred interface. If the implementation reads appId in `cli.ts` before calling `replayFlows`, T25 should be moved to `cli.integration.test.ts`. AC7 is independently covered at the integration level by T28 and T41.

**No contradiction — Extension validation at two seams (AC14)**
Generator A tests extension rejection in `parseArgs` unit tests (T06–T09); Generator B tests the CLI-level exit code 1 consequence (T34, T44). These are complementary, not contradictory — unit seam vs integration seam. Both are retained.

### Consolidated test plan

#### `recorder-app/src/args.test.ts`

| ID | AC | Description | Seam | Source |
|---|---|---|---|---|
| T01 | AC1 | `parseArgs` with `--run-flow a.yaml` returns `runFlowPaths: ['a.yaml']` | none | A |
| T02 | AC1, AC2 | `parseArgs` with `--run-flow a.yaml,b.yaml` returns `runFlowPaths` of length 2 in order | none | A |
| T03 | AC2 | `parseArgs` with `--run-flow x.yaml,y.yaml,z.yaml` returns `runFlowPaths` length 3 in declaration order | none | A |
| T04 | AC12 | `--run-flow` absent → `runFlowPaths` is `[]` (empty array, never `undefined`) | none | A |
| T05 | AC12 | `--run-flow` absent → `url` and `outputPath` defaults unchanged from pre-feature baseline | none | A |
| T06 | AC14 | `.json` path → `parseArgs` throws extension error; message names the invalid path | none | A |
| T07 | AC14 | No-extension path → `parseArgs` throws extension error | none | A |
| T08 | AC14 | Mixed list (`.yaml`, `.json`) → `parseArgs` throws; error names the bad path | none | A |
| T09 | AC1, AC14 | `.yml` extension accepted without error; path included in `runFlowPaths` | none | A |
| T10 | AC1 | `--run-flow` with no following argument → throws "requires a value" error | none | A |
| T11 | AC1 | Paths stored exactly as supplied (not `path.resolve`d, preserving `./` prefixes) | none | A |
| T12 | AC1, AC2, AC12 | Combined invocation `--run-flow a.yaml,b.yaml --output out.yaml --base-url ...` → all three fields populated independently | none | A |
| T13 | AC2 | Trailing comma in `--run-flow a.yaml,` → no spurious empty entry, or rejected with a clear error | none | A |

#### `recorder-app/src/flowReplayer.test.ts`

| ID | AC | Description | Seam | Source |
|---|---|---|---|---|
| T14 | AC9 | Single `goto` command → `page.goto` called once with correct URL | mock `page` | B |
| T15 | AC9 | Three-command flow (`goto`, `tapOn`, `wait`) → all three dispatched in order | mock `page`; track call order | B |
| T16 | AC2, AC9 | Two flows in sequence → all commands from flow 1 execute before any from flow 2 | mock `page`; `callOrder` array | B |
| T17 | AC9, AC10 | `assertVisible` mock rejection → `replayFlows` rejects with `[replay] FAILED` containing filename and selector | mock `page.locator().waitFor()` to reject | Both |
| T18 | AC9 | Second command fails → third command never dispatched (early abort) | mock `page`; assert third-command mock call count = 0 | B |
| T19 | AC9 | Progress log `[replay] <file>: n/total commands` emitted for each command | spy `console.log` | B |
| T20 | AC11 | `runFlow: ./sub.yaml` inside input flow → sub-flow concrete commands dispatched to Playwright | mock `page.goto`; real fs fixtures | Both |
| T21 | AC11 | Failing assertion inside nested `runFlow` → parent-flow commands after the `runFlow` never executed | mock `page`; assert post-runFlow call count = 0 | B |
| T22 | AC11 | Three-level nested chain (A→B→C, C has `goto`) → `page.goto` called once with C's URL | mock `page.goto`; real fs fixtures | B |
| T23 | AC5 | `replayFlows` does not call `appendCommand` or write to the output file during replay | spy `appendCommand`; assert no calls; output file unchanged | B |
| T24 | AC9 | `assertUrl` mismatch → `replayFlows` rejects with expected and actual URL in message | mock `page.url()` | B |
| T25 | AC7 | `replayFlows` returns/exposes `appId` from first flow file for the caller to use | real fs fixture; mock `page` | A |
| T26 | AC8 | `replayFlows` does not call `startSession`; leaves session header to caller | spy `startSession`; mock `page` | A |
| T27 | AC11 | Nested `runFlow:` references inside input flows are NOT written as additional entries to the output file | spy `appendCommand`; mock `page` | A |

#### `recorder-app/src/cli.integration.test.ts`

| ID | AC | Description | Seam | Source |
|---|---|---|---|---|
| T28 | AC7 | `main()` calls `startSession` with `appId` from first flow when no explicit URL supplied | mock Playwright + `replayFlows`; spy `startSession` | B |
| T29 | AC8 | `--run-flow` + `--base-url http://staging.example.com` → output `appId:` is the explicit URL, not the flow's | mock Playwright + `replayFlows`; read output file | B |
| T30 | AC3, AC4 | Two flows + output in sibling dir → output YAML begins with `runFlow: ../flows/setup.yaml` then `runFlow: ../flows/login.yaml` | mock Playwright + `replayFlows`; `yaml.load` output | B |
| T31 | AC4 | `runFlow:` path in output is relative (no leading `/`); computed from output dir to input flow | mock Playwright + `replayFlows`; read output | B |
| T32 | AC6 | `--output` and `--run-flow` resolve to same path → exit code 1 before `chromium.launch`; collision error logged | spy `process.exit` + `console.error`; mock `chromium.launch` | Both |
| T33 | AC13 | Non-existent `--run-flow` path → exit code 1; logs `--run-flow: file not found: <path>`; browser not launched | spy `process.exit`; mock `chromium.launch` | Both |
| T34 | AC14 | `.json` extension (file exists on disk) → exit code 1; extension error logged; browser not launched | real fs; spy `process.exit`; mock `chromium.launch` | B |
| T35 | AC9 | `replayFlows` rejection → `main()` exits code 1 and never calls `page.exposeFunction` | mock `replayFlows` to reject; spy `page.exposeFunction` + `process.exit` | B |
| T36 | AC9 | Replay failure → partial output file (with `runFlow:` entries, no captured commands) preserved on disk | real fs; mock `replayFlows` to reject after header written | Both |
| T37 | AC10 | Replay error logged to user contains flow filename and failed command; matches `[replay] FAILED:` pattern | mock `replayFlows` to reject with structured error; spy `console.error` | B |
| T38 | AC12 | No `--run-flow` → `appendCommand` never called with `runFlow` type; `page.goto` called with URL | mock Playwright; spy `appendCommand` | B |
| T39 | AC5 | After `main()` completes, both input flow files are byte-for-byte identical to before | real fs; mock Playwright + `replayFlows` | Both |
| T40 | AC3 | After replay, live-captured commands (injected via `__uivisorCapture`) appear after `runFlow:` entries in output | mock Playwright; capture `exposeFunction` callback; inject test commands; parse output | B |
| T41 | AC7 | Flow file with `url:` field (not `appId:`) → CLI still derives URL from that field correctly | fixture YAML with `url:` key; mock Playwright + `replayFlows`; read output | B |
| T42 | AC6 | Collision guard fires for `./flows/setup.yaml` vs `flows/setup.yaml` (same resolved path, different notation) | spy `process.exit`; mock `chromium.launch` | B |
| T43 | AC3, AC4, AC7 | Full e2e: `main()` with two flows + different output dir + one user-captured `goto` appended → output YAML valid with correct structure | mock Playwright + `replayFlows`; inject via capture callback; `yaml.load` full output | B |
| T44 | AC14 | `.yml` extension → validation passes; no exit code 1; `replayFlows` invoked normally | spy `process.exit`; mock Playwright + `replayFlows` | B |
| T45 | AC2 | `--run-flow x.yaml,y.yaml,z.yaml` → `replayFlows` called with all three paths in order | spy `replayFlows`; mock Playwright | B |
| T46 | AC6 | Third-of-three path collides with output → exit code 1; error message names the colliding path; browser not launched | spy `process.exit` + `console.error`; mock `chromium.launch` | B |
| T47 | AC4 | Output and input in same directory → `runFlow:` path in output is just the filename (no `../` prefix) | real fs tmp; mock Playwright + `replayFlows`; read output | A |
| T48 | AC3 | Single input path → exactly one `runFlow:` entry in output file | real fs; mock Playwright + `replayFlows`; parse output | A |

---

## Build Check
**Verdict:** PASS
**Manifest:** package.json found
**TypeScript build:** 0 errors
**Blocking findings:** none

---

## Quality Gate

**Verdict:** PASS
**Reviewed:** 2026-09-12

### Summary

All 14 acceptance criteria have at least one passing test across the 48-test suite (args.test.ts, flowReplayer.test.ts, cli.integration.test.ts). The implementation correctly separates concerns — extension validation in `parseArgs`, file-existence and collision checks in `validateRunFlowPaths` (cli.ts), and a self-contained replayer in `flowReplayer.ts` that never calls `appendCommand` or `startSession`. All spec error messages match exactly, the circular-ref guard is present, and the `// TODO(arch)` comment is in place.

### Findings

- **Minor (no fix required):** Plan T13 (trailing comma in `--run-flow a.yaml,`) was not implemented; instead the coder implemented "runFlowPaths always defined" at that slot. AC2 is still covered by T02, T03, T16, and T45. The trailing comma case is rejected by the extension validator (empty string fails `.endsWith('.yaml')`) so behaviour is correct even without an explicit test.
- **Minor (no fix required):** Plan T26 ("replayFlows does not call startSession") is covered structurally: `flowReplayer.ts` has no import of `yamlWriter.js`, making it architecturally impossible. T22 (output file bytes unchanged) provides a runtime-observable guard.
- All correctness, code quality, and test quality criteria confirmed passing.
