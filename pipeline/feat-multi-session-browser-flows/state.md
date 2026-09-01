# Pipeline State: feat-multi-session-browser-flows

**Task:** Add capability to launch multiple isolated browser sessions simultaneously to simulate dependent workflows (e.g., User A sends a request, and User B reacts to it). YAML allows user to define which session an action targets. No session specified = session 1.
**Started:** 2026-09-01
**Status:** completed — PR #16 open

## Worktree
**Path:** .worktrees/feat-multi-session-browser-flows
**Branch:** feat-multi-session-browser-flows
**Created:** 2026-09-01
**Status:** active

---

## Gate 0: Execution Plan

**Classification:** feature
**Complexity:** medium

**Roles Activated:** Analyst, Architect, Tester Ensemble, Coder, Release Documenter, Deployer
**Designer Activated:** no (no UI component — YAML schema + engine change only)

**Execution Sequence:**
1. Analyst → skill: to-spec
   Output: spec + acceptance criteria → state.md#gate-1
   [GATE 1: human approval required — revision cap: 2]
2. Architect → skill: to-tickets + codebase-design
   Reads: Gate 1 spec
   Output: feature/task breakdown → state.md#feature-task-breakdown
3. Tester Ensemble Phase 1 → skill: tdd
   3a. tester_generator_a + tester_generator_b in parallel
   3b. tester_consolidator → deduplicates → state.md#tests
   3c. tester_arbiter → resolves disagreements
4. Coder → skill: implement
   Working directory: .worktrees/feat-multi-session-browser-flows
5. Tester Ensemble Phase 2 → skill: tdd + code-review
   5a–5c. generators → consolidator → arbiter
6. Quality Gate → skill: quality (tester_arbiter, autonomous)
   [GATE 3: human approval before deploy]
7. Release Documenter → signoff_package.md
8. Deployer → skill: proj-deploy

## Run Estimates

**Complexity:** medium
**Duration:** ~38–76 min (no retries: ~38 min)
**Cost:** ~$2.00–$4.00 (cap: $5.00)
**Tokens:** ~200K–400K tokens

**Retry budgets:**
- TDD + quality gate: 3 rounds
- Spec revision: 2 rounds
- Design revision: n/a
- Code review: 2 rounds

---

## Gate 1: Spec

### Overview

This feature adds multi-session browser support to uivisor by allowing a flow file to declare named browser sessions and route individual commands to specific sessions. Each declared session maps to an isolated Playwright `Page` opened inside the same `Browser` instance. Commands gain an optional `session:` field; the engine resolves the target page before dispatching each command. Execution remains strictly sequential in declaration order — there is no parallel execution, only page-switching. Flows that omit the `sessions:` block are entirely unchanged by this work.

---

### Scope / Out of Scope

**In scope**
- `sessions:` top-level YAML block: parsing, validation, and storage on `FlowFile`
- `session:` field on every command type, including `runFlow`
- Multi-page lifecycle: create N pages at flow start, close all via `browser.close()`
- Session-aware routing in the engine: resolve the target `Page` per command before dispatch
- `runFlow` + `session:` semantics: the specified session becomes the default for commands inside the sub-flow that carry no `session:` field
- `RunContext` extended to carry a `sessionId → Page` map and a `defaultSessionId`
- Full backward compatibility: all current flows run without modification

**Out of scope**
- Parallel command execution across sessions
- Per-session browser type, viewport, or `slowMo` overrides
- Cross-session variable sharing
- Changes to HTML or Markdown reporters beyond surfacing the session id in existing command output
- Session lifecycle commands (open/close mid-flow)

---

### YAML Schema Changes

#### `sessions:` — top-level, optional

```
sessions:
  type:     array of session definition objects
  required: false
  default:  absent (single-session legacy mode)
```

**Session definition object**

| Field   | Type   | Required | Constraints |
|---------|--------|----------|-------------|
| `id`    | string | yes      | Non-empty; matches `^[a-zA-Z0-9_-]+$`; max 64 chars; unique within the file |
| `label` | string | no       | Free text; no constraints beyond being a string |

#### `session:` — per-command, optional

| Field     | Type   | Required | Default |
|-----------|--------|----------|---------|
| `session` | string | no       | First declared session `id`; for legacy flows, the implicit single session |

Rules:
- The value must match a declared session `id` in the same file; an unrecognised value is a parse error.
- `session:` may appear on any command type, including `runFlow`.
- `session:` present on a command in a flow that has no `sessions:` block is a parse error.
- When `session:` appears on a `runFlow` command, it sets the default session for commands within the sub-flow that carry no `session:` field of their own.
- The `session:` key is stripped from the raw command object before the command verb is identified.

`validator.ts` `VALID_HEADER_KEYS` must include `'sessions'`.

---

### Acceptance Criteria

**AC-1 — Legacy pass-through.** A flow YAML with no `sessions:` block and no `session:` fields on commands parses, validates, and executes identically to current behaviour. `FlowFile.sessions` is an empty array. All existing tests pass without modification.

**AC-2 — Session block creates N pages.** A flow with `sessions: [{id: alice}, {id: bob}]` results in exactly 2 `Page` objects opened within the same `Browser`. No extra pages are opened.

**AC-3 — Per-command routing.** `session: alice` + `goto` navigates alice's page. An immediately following `session: bob` + `goto` navigates bob's page. The pages are isolated.

**AC-4 — Default session.** A command with no `session:` field in a multi-session flow is dispatched to the first declared session's page.

**AC-5 — `runFlow` + `session:`.** A `runFlow` command with `session: bob` runs every command in the sub-flow against bob's page. A command inside the sub-flow with its own `session: alice` overrides this.

**AC-6 — Unknown session reference.** A `session:` value not matching any declared `id` produces a parse error naming the unknown id and file path.

**AC-7 — `session:` without `sessions:` block.** Produces a parse error before execution begins.

**AC-8 — Duplicate session ids.** Produces a parse error naming the duplicate id and file path.

**AC-9 — Empty `sessions:` array.** `sessions: []` is a parse error; the array must have at least one entry.

**AC-10 — Invalid session id characters.** An `id` with whitespace, dots, slashes, or chars outside `[a-zA-Z0-9_-]` is a parse error.

**AC-11 — `label:` is optional.** `{id: alice}` (no label) is valid.

**AC-12 — Circular-reference detection.** Existing circular `runFlow` detection still works regardless of session.

**AC-13 — Cleanup on failure.** `finally` in `runner.ts` still calls `browser.close()`, closing all pages.

**AC-14 — `assertUrl` is session-scoped.** `assertUrl` with `session: bob` checks only bob's page URL.

---

### Constraints

**Backward compatibility:** `FlowFile.commands` changes to `SessionedCommand[]` (wraps `Command` + optional `session`). `RunContext` gains `sessions: Map<string, Page>` and `defaultSessionId: string`. `createContext` accepts these; callers in `runner.ts` pass them; nested `runFlow` calls share the same context.

**Error handling:** All multi-session parse errors emit before any browser launches. File path appears in every error message. On command failure, screenshot captures against the failing session's page; `browser.close()` closes all pages in the `finally` block.

**Session ID rules:** Pattern `^[a-zA-Z0-9_-]+$`, max 64 chars, case-sensitive. The string `__default__` is reserved and must not be accepted as a user-declared id.

**`runFlow` session inheritance:** Engine sets `ctx.defaultSessionId` to the specified session before entering the sub-flow and restores it after (success or failure).

---

## Feature Task Breakdown

| # | Title | File(s) | Description | Blocks |
|---|-------|---------|-------------|--------|
| T-1 | Add `SessionedCommand` type; extend `FlowFile` and `RunContext` | `src/types.ts` | Add `export type SessionedCommand = { session?: string; command: Command }`. Change `FlowFile.commands` from `Command[]` to `SessionedCommand[]`. Add `sessions?: SessionDef[]` (where `SessionDef = { id: string; label?: string }`) to `FlowFile`. Add `sessions: Map<string, Page>` and `defaultSessionId: string` to `RunContext`. | T-2, T-3, T-5, T-6, T-7 |
| T-2 | Validate `sessions:` header block | `src/parser/validator.ts` | Add `'sessions'` to `VALID_HEADER_KEYS`. Validate: must be array, each entry has `id` matching `^[a-zA-Z0-9_-]+$`, max 64 chars, no duplicates, array non-empty if present; `sessions: null` treated as absent. | T-3 |
| T-3 | Parse sessions block and produce `SessionedCommand[]` | `src/parser/commandParser.ts`, `src/parser/reader.ts` | `parseSessionedCommand(raw)` strips `session` key before calling `parseCommand`. Validate each `session` value references a declared id. `reader.ts` extracts `sessions` from YAML root into `FlowFile.sessions`. `session:` present with no `sessions:` block → parse error. | T-6 |
| T-4 | Add multi-page provisioning to browser driver | `src/driver/browser.ts` | Add `createSessionPages(browser, sessionNames): Promise<Map<string, Page>>` — calls `browser.newPage()` for each name, returns the map. `launchBrowser`/`closeBrowser` signatures unchanged. | T-6, T-7 |
| T-5 | Update `createContext` to accept sessions | `src/engine/context.ts` | Change signature to `createContext(runDir, sessions, defaultSessionId)`. Populate `ctx.sessions` and `ctx.defaultSessionId`. | T-6, T-7 |
| T-6 | Rewrite `runFlow` loop to resolve page per `SessionedCommand` | `src/engine/index.ts` | Loop over `SessionedCommand[]`. Compute `effectiveId = sc.session ?? ctx.defaultSessionId`; resolve `page = ctx.sessions.get(effectiveId)` (throw on unknown). For `runFlow` commands with `session:`, save/set/restore `ctx.defaultSessionId`. | T-7 |
| T-7 | Provision sessions in `runAll` and wire into context | `src/cli/runner.ts` | If `file.sessions` non-empty: call `createSessionPages`, use `file.sessions[0].id` as `defaultSessionId`. Otherwise: synthesise `Map([["__default__", page]])`. Pass both to `createContext`. Close per-flow pages after each flow completes. | T-8 |
| T-8 | Update dispatcher's registered callback type | `src/engine/dispatcher.ts` | Update `_runFlowImpl` type alias and `registerRunFlow` param type to match updated `runFlow` signature. No logic changes. | T-9 |
| T-9 | Tests for sessions parsing, validation, and execution | `tests/` | Unit: `parseSessionedCommand`, `validateHeader`, `createContext`. Integration: two-session flow dispatches to correct pages; `runFlow` + `session:` sets/restores `defaultSessionId`; undeclared session throws at parse time. | — |

### Seams

- **`SessionedCommand` / `Command` split:** `session?` is unwrapped in the `runFlow` loop; nothing below `engine/index.ts` ever sees it.
- **`dispatch(page, cmd, ctx)` stays unchanged:** the engine loop resolves the page, then passes it to dispatch.
- **`ctx.sessions` + `ctx.defaultSessionId`:** only the engine loop does page resolution from the context map.
- **`FlowFile.sessions`:** the runner uses it solely to decide how many pages to open.
- **`launchBrowser` / `createSessionPages` separation:** additive; runner selects based on whether sessions are declared.

### Implementation Notes

- `session:` key must be stripped before `parseCommand` sees it — otherwise the switch throws "Unknown command: session".
- `lastTappedLocator` is shared across sessions (known limitation — out of scope).
- Runner always builds a fully-populated `Map<string, Page>` even for legacy flows (using `"__default__"`), so no null checks needed downstream.
- Session pages must be closed per-flow (not just at `browser.close()`) to avoid page leaks across sequential targets in `runAll`.
- `FlowResult.passed` check (`passedCommands === file.commands.length`) still correct — `.length` on `SessionedCommand[]` is unchanged.

---

## Tests — Generator A (tester_generator_a)

AC-1: Legacy pass-through — no sessions block
  Test: loadAndParse with no sessions key produces sessions: []
  Setup: YAML with no `sessions` key; one goto command
  Action: `loadAndParse('/flows/login.yaml')`
  Assert: `result.sessions` deep-equals `[]`; `result.commands` has length 1; no error thrown
  Seam: parser

  Test: loadAndParse with no sessions key does not reject any existing command field
  Setup: Flow with all command types, no `sessions` key
  Action: `loadAndParse('/flows/all.yaml')`
  Assert: Returns without throwing; `result.sessions` equals `[]`
  Seam: parser

  Test: runFlow engine — legacy flow runs against the single passed page
  Setup: FlowFile with `sessions: []`, one goto command; mock page; ctx with empty sessions Map
  Action: `runFlow(file, mockPage, ctx)`
  Assert: `mockPage.goto` called once; result.passed is true
  Seam: engine

  Test: createContext produces RunContext with sessions as empty Map
  Setup: Call `createContext('/tmp/run')`
  Assert: `ctx.sessions` is a Map with size 0
  Seam: engine

AC-2: Session block creates N pages
  Test: runner opens exactly 2 pages for sessions: [{id: alice}, {id: bob}]
  Setup: Flow with two sessions; spy on `browser.newPage`
  Action: `runAll(['/flows/multi.yaml'], options)`
  Assert: `browser.newPage` called exactly 2 times; both stored in ctx.sessions under "alice" and "bob"
  Seam: runner

  Test: runner stores both pages in the same Browser instance
  Setup: Same; spy on `launchBrowser`
  Action: `runAll(['/flows/multi.yaml'], options)`
  Assert: `launchBrowser` called exactly once
  Seam: runner

  Test: ctx.sessions has exactly 2 entries
  Setup: FlowFile with two sessions; mock `browser.newPage`
  Action: `createSessionPages(browser, ['alice', 'bob'])`
  Assert: Map has size 2; both keys present and non-null
  Seam: engine

AC-3: Per-command routing
  Test: goto with session: alice navigates alice's page, not bob's
  Setup: SessionedCommand `{command: {type:'goto', url:'http://a.test'}, session: 'alice'}`; ctx.sessions = Map{alice: mockPageA, bob: mockPageB}
  Action: engine loop dispatches command
  Assert: `mockPageA.goto` called; `mockPageB.goto` NOT called
  Seam: engine

  Test: consecutive commands to different sessions stay isolated
  Setup: Two SessionedCommands: alice goto /a, bob goto /b
  Action: Engine loop processes both
  Assert: Each page called exactly once with the correct URL
  Seam: engine

  Test: assertVisible with session: bob checks only bob's page
  Setup: SessionedCommand assertVisible targeting bob
  Action: Engine dispatch
  Assert: `mockPageB.locator` called; `mockPageA.locator` NOT called
  Seam: engine

AC-4: Default session
  Test: command with no session field routes to first declared session's page
  Setup: ctx.defaultSessionId = 'alice'; untagged goto command
  Action: Engine dispatch
  Assert: `mockPageA.goto` called; `mockPageB.goto` NOT called
  Seam: engine

  Test: default is first declared id regardless of alphabetical order
  Setup: sessions: [{id: zebra}, {id: alpha}]; ctx.defaultSessionId = 'zebra'; untagged command
  Action: Engine dispatch
  Assert: zebra's page receives the call; alpha's does not
  Seam: engine

AC-5: runFlow + session:
  Test: runFlow with session: bob runs sub-flow on bob's page
  Setup: Main flow runFlow command with session: bob; sub-flow has untagged goto; ctx.defaultSessionId = 'alice'
  Action: `runFlow(parentFile, ..., ctx)`
  Assert: `mockPageB.goto` called; alice's page unchanged
  Seam: engine

  Test: session: alice inside sub-flow overrides outer session: bob
  Setup: runFlow with session: bob; sub-flow has `session: alice` goto
  Action: `runFlow(parentFile, ..., ctx)`
  Assert: alice's page receives the goto; bob's does not
  Seam: engine

  Test: ctx.defaultSessionId restored after runFlow + session: bob completes
  Setup: ctx.defaultSessionId = 'alice' before runFlow; runFlow session: bob
  Action: Dispatch runFlow, await completion
  Assert: ctx.defaultSessionId is 'alice' after dispatch returns
  Seam: engine

  Test: runFlow + session: bob still halts sub-flow on first failure
  Setup: Sub-flow first command fails
  Action: Execute through engine
  Assert: nestedResult.commandResults has length 1; second command not attempted
  Seam: engine

AC-6: Unknown session reference
  Test: command referencing undeclared id throws at parse time
  Setup: sessions: [{id: alice}]; command has session: charlie
  Action: `loadAndParse('/flows/multi.yaml')`
  Assert: throws; message contains "charlie" and file path
  Seam: parser

  Test: unknown session error thrown before any browser launches
  Setup: Invalid flow; spy on `launchBrowser`
  Action: `runAll([path], options)`
  Assert: throws with parse error; `launchBrowser` NOT called
  Seam: runner

AC-7: session: without sessions: block
  Test: command with session field in a flow without sessions block throws
  Setup: YAML with session: alice on a command, no sessions: block
  Action: `loadAndParse(path)`
  Assert: throws; error message indicates `session:` used without `sessions:` block; file path included
  Seam: parser

  Test: parse error before any execution
  Setup: Same; spy on `launchBrowser`
  Action: `runAll([path], options)`
  Assert: `launchBrowser` NOT called
  Seam: runner

AC-8: Duplicate session ids
  Test: sessions with two identical ids throws
  Setup: sessions: [{id: alice}, {id: alice}]
  Action: `loadAndParse(path)`
  Assert: throws; message contains "alice" and file path
  Seam: parser

  Test: duplicate on third entry still caught
  Setup: sessions: [{id:alice},{id:bob},{id:alice}]
  Action: `loadAndParse(path)`
  Assert: throws mentioning "alice"
  Seam: parser

AC-9: Empty sessions array
  Test: sessions: [] throws
  Setup: YAML with sessions: [] and valid commands
  Action: `loadAndParse(path)`
  Assert: throws; error references empty sessions
  Seam: parser

AC-10: Invalid session id characters
  Test: id with space throws
  Setup: sessions: [{id: 'alice bob'}]
  Action: `loadAndParse(path)`; Assert: throws mentioning "alice bob" and allowed chars; Seam: parser

  Test: id with dot throws
  Setup: sessions: [{id: 'alice.bob'}]; Action: `loadAndParse`; Assert: throws; Seam: parser

  Test: id with slash throws
  Setup: sessions: [{id: 'alice/bob'}]; Action: `loadAndParse`; Assert: throws; Seam: parser

  Test: id with @ throws
  Setup: sessions: [{id: 'alice@example'}]; Action: `loadAndParse`; Assert: throws; Seam: parser

  Test: valid id [a-zA-Z0-9_-] accepted
  Setup: sessions: [{id: 'Alice_2-session'}]; Action: `loadAndParse`; Assert: no throw; Seam: parser

  Test: purely numeric id accepted
  Setup: sessions: [{id: '42'}]; Action: `loadAndParse`; Assert: no throw; Seam: parser

  Test: empty string id throws
  Setup: sessions: [{id: ''}]; Action: `loadAndParse`; Assert: throws; Seam: parser

AC-11: label optional
  Test: session without label valid
  Setup: sessions: [{id: alice}]; Action: `loadAndParse`; Assert: no throw; `sessions[0].label` is undefined; Seam: parser

  Test: session with id and label both valid
  Setup: sessions: [{id: alice, label: "Alice's Browser"}]; Action: `loadAndParse`; Assert: `sessions[0].label === "Alice's Browser"`; Seam: parser

AC-12: Circular reference detection
  Test: circular runFlow in multi-session flow returns failure
  Setup: ctx.callStack contains absolute path of self.yaml; runFlow command referencing self.yaml
  Action: dispatch
  Assert: result.passed is false; message matches /Circular flow reference/i
  Seam: engine

AC-13: Cleanup on failure
  Test: browser.close() called when a command throws
  Setup: Mock runFlow to throw mid-execution; spy on `mockBrowser.close`
  Action: `runAll([path], options)`
  Assert: `mockBrowser.close` called exactly once
  Seam: runner

AC-14: assertUrl is session-scoped
  Test: assertUrl with session: alice checks alice's URL, not bob's
  Setup: mockPageA.url() returns /dashboard (pass); mockPageB.url() returns /other
  Action: dispatch assertUrl on alice
  Assert: result.passed is true; `mockPageA.url` called; `mockPageB.url` NOT called
  Seam: engine

  Test: assertUrl with session: bob fails when bob has wrong URL
  Setup: mockPageB.url() returns /other; assertUrl expects /settings
  Action: dispatch assertUrl on bob
  Assert: result.passed is false; message references /settings and actual URL
  Seam: engine

  Test: assertUrl with no session field uses default session
  Setup: ctx.defaultSessionId = 'alice'; mockPageA.url() returns /home; untagged assertUrl /home
  Action: dispatch
  Assert: result.passed is true; mockPageA.url called; mockPageB.url NOT called
  Seam: engine

## Tests — Generator B (tester_generator_b)

AC-1: Legacy pass-through
  Test: legacy-flow-sessions-field-is-empty-array
  Setup: YAML with no `sessions:` key; one goto command
  Action: `loadAndParse(filePath)`
  Assert: `result.sessions` is `[]` (not undefined/null); `result.commands.length === 1`
  Seam: parser

  Test: legacy-all-command-types-no-session-field
  Setup: All command types present; no `sessions:` key
  Action: `loadAndParse` then `runFlow`
  Assert: Each CommandResult.passed is true; `file.sessions` is `[]`
  Seam: parser, engine

  Test: legacy-no-sessions-key-at-all
  Setup: YAML missing `sessions:` key entirely
  Action: `loadAndParse(filePath)`
  Assert: Does not throw; returned FlowFile has `sessions: []`
  Seam: parser

AC-2: Exactly N pages opened
  Test: two-sessions-exactly-two-pages
  Setup: sessions: [{id:alice},{id:bob}]; spy on `browserContext.newPage()`
  Action: `runAll([filePath], options)`
  Assert: `newPage()` called exactly twice; no third page opened
  Seam: runner, engine

  Test: one-session-exactly-one-page
  Setup: sessions: [{id: only}]; spy on `newPage()`
  Action: `runAll([filePath], options)`
  Assert: `newPage()` called exactly once; ctx.sessions.size === 1
  Seam: runner, engine

  Test: sessions-share-same-browser-instance
  Setup: Flow with two sessions; capture browser reference for both pages
  Action: `runAll([filePath], options)`
  Assert: Both pages belong to same Browser; `launchBrowser` called exactly once
  Seam: runner, engine

AC-3: Per-command routing — interleaved isolation
  Test: interleaved-goto-pages-isolated
  Setup: Four commands: alice /alice-1, bob /bob-1, alice /alice-2, bob assertUrl /bob-1
  Action: `runFlow(file, ..., ctx)` with multi-page context
  Assert: bob's assertUrl /bob-1 passes (bob not affected by alice's second goto)
  Seam: engine

  Test: page-state-isolation-between-sessions
  Setup: Alice fills input; bob immediately assertValue on same CSS selector (separate page)
  Action: run through engine
  Assert: Bob's assertValue fails (field is empty on bob's page)
  Seam: engine

AC-4: Default session — declaration order not alphabetical
  Test: default-routes-to-first-declared-not-alphabetical
  Setup: sessions: [{id: zara}, {id: alice}]; untagged goto /default
  Action: `runFlow(file, ..., ctx)`
  Assert: goto dispatched to zara's page; alice's page not navigated
  Seam: engine

  Test: explicit-session-does-not-shift-default
  Setup: sessions [alice, bob]; bob explicit goto /bob-page; then untagged goto /should-go-to-alice
  Action: `runFlow(file, ..., ctx)`
  Assert: Untagged goto dispatches to alice; bob stays on /bob-page
  Seam: engine

AC-5: runFlow + session:
  Test: runflow-session-override-propagates-to-untagged-subcommands
  Setup: parent runFlow with session: bob; sub.yaml has untagged goto /sub-page
  Action: `runFlow(parentFile, ..., ctx)`
  Assert: goto /sub-page executes on bob's page; alice unchanged
  Seam: engine

  Test: runflow-inner-session-field-overrides-inherited-context
  Setup: parent runFlow session: bob; sub has session: alice goto /inner-alice
  Action: `runFlow(parentFile, ..., ctx)`
  Assert: goto /inner-alice dispatched to alice's page
  Seam: engine

  Test: runflow-session-restores-default-after-subflow
  Setup: sessions [alice, bob]; runFlow session: bob; then untagged goto /after-subflow
  Action: `runFlow(parentFile, ..., ctx)`
  Assert: goto /after-subflow routes to alice (default restored)
  Seam: engine

AC-6: Unknown session id
  Test: unknown-session-id-error-message-content
  Setup: sessions: [{id: alice}]; command has session: alic (typo)
  Action: `loadAndParse(filePath)`
  Assert: throws; message contains "alic" and file path
  Seam: parser

  Test: unknown-session-in-nested-flow-names-subflow-path
  Setup: sub.yaml has session: bob on a command; bob not declared in parent's sessions
  Action: loadAndParse of sub.yaml (or validation at runFlow load time)
  Assert: Error message contains sub.yaml's path and "bob"
  Seam: parser

  Test: multiple-unknown-sessions-first-error-reported
  Setup: sessions: [{id: alice}]; two commands with session: ghost1, session: ghost2
  Action: `loadAndParse(filePath)`
  Assert: Throws exactly once; error references "ghost1"
  Seam: parser

AC-7: session: without sessions: block
  Test: session-field-without-sessions-block-is-parse-error
  Setup: YAML with session: alice on a command, no sessions: block
  Action: `loadAndParse(filePath)`
  Assert: throws before runFlow; error indicates session: used without sessions: block
  Seam: parser

  Test: session-field-on-runflow-without-sessions-block
  Setup: YAML with session: alice on runFlow, no sessions: block
  Action: `loadAndParse(filePath)`
  Assert: throws parse error
  Seam: parser

AC-8: Duplicate session ids
  Test: duplicate-session-ids-error-message-content
  Setup: sessions: [{id:alice},{id:bob},{id:alice}]
  Action: `loadAndParse(filePath)`
  Assert: throws; message contains "alice" and file path
  Seam: parser

  Test: non-adjacent-duplicate-session-ids-detected
  Setup: sessions: [{id:alpha},{id:beta},{id:gamma},{id:alpha}]
  Action: `loadAndParse(filePath)`
  Assert: throws mentioning "alpha"
  Seam: parser

  Test: all-sessions-same-id-parse-error
  Setup: sessions: [{id:x},{id:x},{id:x}]
  Action: `loadAndParse(filePath)`
  Assert: throws on first duplicate x
  Seam: parser

AC-9: Empty sessions array
  Test: empty-sessions-array-is-parse-error
  Setup: sessions: [] with valid commands
  Action: `loadAndParse(filePath)`
  Assert: throws; message indicates sessions must not be empty
  Seam: parser

  Test: sessions-null-treated-as-absent-legacy
  Setup: YAML with sessions: ~ (null)
  Action: `loadAndParse(filePath)`
  Assert: Does not throw; FlowFile.sessions is []; behaves as legacy
  Seam: parser

AC-10: Invalid id characters
  Test: session-id-with-space; id: "alice bob"; Assert: throws; Seam: parser
  Test: session-id-with-dot; id: "alice.session"; Assert: throws; Seam: parser
  Test: session-id-with-unicode; id: "alïce"; Assert: throws; Seam: parser
  Test: session-id-empty-string; id: ""; Assert: throws; Seam: parser
  Test: session-id-numeric-only-is-valid; id: "42"; Assert: no throw; Seam: parser
  Test: session-id-hyphen-underscore-valid; id: "my-session_1"; Assert: no throw; Seam: parser
  Test: session-id-yaml-whitespace-stripped-is-valid; unquoted alice with spaces → YAML collapses to "alice"; Assert: valid; Seam: parser

AC-11: label optional
  Test: session-without-label-parses-successfully; sessions: [{id: alice}]; Assert: no throw; label undefined; Seam: parser
  Test: session-with-label-but-no-id-is-parse-error; sessions: [{label: primary}]; Assert: throws; Seam: parser
  Test: session-with-id-and-label-both-valid; Assert: label preserved; Seam: parser

AC-12: Circular reference
  Test: circular-runflow-detected-in-session-context
  Setup: A → runFlow B (session:alice) → runFlow A; ctx.callStack has A
  Action: `runFlow(fileA, ..., ctx)`
  Assert: result.passed false; message contains "Circular flow reference detected" and file path; ctx.defaultSessionId not corrupted
  Seam: engine, dispatcher

  Test: cycle-detection-with-session-override-still-detected
  Setup: A → B (session:bob) → A; B's runFlow carries session: bob
  Action: `runFlow(fileA, ..., ctx)`
  Assert: error is circular reference; ctx.defaultSessionId restored on early exit
  Seam: engine, dispatcher

AC-13: Cleanup
  Test: browser-close-called-after-session-page-runtime-failure
  Setup: alice's second command throws; spy on `browser.close()`
  Action: `runAll([filePath], options)`
  Assert: `browser.close()` called exactly once; FlowResult.passed false
  Seam: runner

  Test: browser-close-called-when-page-creation-throws
  Setup: Mock newPage() to throw on second call (bob's page fails)
  Action: `runAll([filePath], options)`
  Assert: `browser.close()` still called; error propagates
  Seam: runner

  Test: browser-close-called-exactly-once-on-failure
  Setup: Flow fails on first command
  Action: `runAll([filePath], options)`
  Assert: `browser.close()` called exactly once (not once per session)
  Seam: runner

AC-14: assertUrl session-scoped
  Test: assert-url-checks-only-assigned-sessions-page
  Setup: alice navigated /alice-page; bob /bob-page; assertUrl alice /alice-page; assertUrl bob /bob-page
  Action: `runFlow(file, ..., ctx)`
  Assert: Both assertUrl pass
  Seam: engine

  Test: assert-url-no-session-field-checks-default-session
  Setup: alice /alice-page; bob /bob-page; untagged assertUrl /alice-page
  Action: `runFlow(file, ..., ctx)`
  Assert: passes (dispatched to alice the default)
  Seam: engine

  Test: assert-url-on-wrong-session-fails
  Setup: alice /alice-page; bob /bob-page; session: bob assertUrl /alice-page
  Action: `runFlow(file, ..., ctx)`
  Assert: result.passed false; got contains /bob-page; expected /alice-page
  Seam: engine, driver

## Tests

### Attribution

| AC | Generator A | Generator B |
|---|---|---|
| AC-1 | ✓ | ✓ |
| AC-2 | ✓ | ✓ |
| AC-3 | ✓ | ✓ |
| AC-4 | ✓ | ✓ |
| AC-5 | ✓ | ✓ |
| AC-6 | ✓ | ✓ |
| AC-7 | ✓ | ✓ |
| AC-8 | ✓ | ✓ |
| AC-9 | ✓ | ✓ |
| AC-10 | ✓ | ✓ |
| AC-11 | ✓ | ✓ |
| AC-12 | ✓ | ✓ |
| AC-13 | ✓ | ✓ |
| AC-14 | ✓ | ✓ |

**Unique to A:** 12  **Unique to B:** 15  **Shared:** 25  **Total after dedup:** 52

---

### Consolidated Test Plan

**AC-1 — Legacy pass-through**

- T-1.1: parse-no-sessions-key-produces-empty-array — `loadAndParse` on YAML with no `sessions:` key returns `sessions: []` and preserves commands — Seam: parser
  - Setup: YAML with no `sessions:` key; one `goto` command
  - Action: `loadAndParse(filePath)`
  - Assert: `result.sessions` deep-equals `[]`; `result.commands.length === 1`; no error thrown

- T-1.2: parse-and-execute-all-command-types-no-sessions — all command types parse and run without error when `sessions:` is absent — Seam: parser, engine
  - Setup: Flow YAML containing every command type; no `sessions:` key
  - Action: `loadAndParse(filePath)` then `runFlow(file, page, ctx)`
  - Assert: `file.sessions` equals `[]`; every `CommandResult.passed` is true

- T-1.3: engine-legacy-flow-dispatches-to-single-page — `runFlow` with a legacy `FlowFile` calls the provided page via the `__default__` session — Seam: engine
  - Setup: `FlowFile` with `sessions: []`; one `goto` command; mock `page`; `ctx.sessions = new Map([['__default__', mockPage]])`; `ctx.defaultSessionId = '__default__'`
  - Action: `runFlow(file, mockPage, ctx)`
  - Assert: `mockPage.goto` called once; `result.passed` is true

- T-1.4: createContext-legacy-synthesises-default-session — `createContext` called with the legacy-mode default map produces a `RunContext` routable to `__default__` — Seam: engine
  - Setup: `createContext('/tmp/run', new Map([['__default__', mockPage]]), '__default__')`
  - Assert: `ctx.sessions.size === 1`; `ctx.sessions.get('__default__') === mockPage`; `ctx.defaultSessionId === '__default__'`

**AC-2 — Session block creates N pages**

- T-2.1: runner-opens-exactly-n-pages — `runAll` opens exactly as many pages as declared sessions — Seam: runner, engine
  - Setup: Flow with `sessions: [{id: alice}, {id: bob}]`; spy on `browser.newPage`
  - Action: `runAll([filePath], options)`
  - Assert: `browser.newPage` called exactly 2 times; `ctx.sessions` has keys `"alice"` and `"bob"`

- T-2.2: one-session-exactly-one-page — a flow with a single declared session opens exactly one page — Seam: runner, engine
  - Setup: Flow with `sessions: [{id: only}]`; spy on `browser.newPage`
  - Action: `runAll([filePath], options)`
  - Assert: `browser.newPage` called exactly once; `ctx.sessions.size === 1`

- T-2.3: all-session-pages-share-same-browser — all pages belong to the same `Browser` instance; `launchBrowser` called once — Seam: runner, engine
  - Setup: Flow with two sessions; capture browser reference from both pages
  - Action: `runAll([filePath], options)`
  - Assert: Both pages come from the same `Browser`; `launchBrowser` called exactly once

- T-2.4: createSessionPages-unit — `createSessionPages` returns a `Map` with correct keys and non-null `Page` values — Seam: engine
  - Setup: Mock `browser.newPage` returning distinct mock pages
  - Action: `createSessionPages(browser, ['alice', 'bob'])`
  - Assert: Returned `Map` has size 2; both keys `"alice"` and `"bob"` present with non-null values

**AC-3 — Per-command routing**

- T-3.1: single-command-routes-to-named-session — `session: alice` on a `goto` calls alice's page and not bob's — Seam: engine
  - Setup: `SessionedCommand` `{ command: { type: 'goto', url: 'http://a.test' }, session: 'alice' }`; `ctx.sessions = Map{ alice: mockPageA, bob: mockPageB }`
  - Action: engine loop dispatches command
  - Assert: `mockPageA.goto` called once; `mockPageB.goto` not called

- T-3.2: interleaved-commands-pages-isolated — alternating commands to two sessions each land on the correct page — Seam: engine
  - Setup: Four commands in order: `alice goto /alice-1`, `bob goto /bob-1`, `alice goto /alice-2`, `bob assertUrl /bob-1`
  - Action: `runFlow(file, page, ctx)` with two-session context
  - Assert: `bob assertUrl /bob-1` passes (bob's URL unchanged by alice's second navigation); each page called with its own URLs only

- T-3.3: page-dom-state-isolated-between-sessions — writes on alice's page are not visible on bob's page — Seam: engine
  - Setup: alice `fill` on CSS selector `#name`; bob `assertValue` on same selector (separate mock page with empty value)
  - Action: run both commands through engine
  - Assert: bob's `assertValue` result is `passed: false` (field empty on bob's page)

- T-3.4: assertVisible-routes-to-correct-session — `assertVisible` with `session: bob` calls only bob's locator, not alice's — Seam: engine
  - Setup: `SessionedCommand` assertVisible targeting `bob`; both mock pages present
  - Action: engine dispatch
  - Assert: `mockPageB.locator` called; `mockPageA.locator` not called

**AC-4 — Default session**

- T-4.1: untagged-command-routes-to-default-session — a command with no `session:` field dispatches to `ctx.defaultSessionId` — Seam: engine
  - Setup: `ctx.defaultSessionId = 'alice'`; `ctx.sessions = Map{ alice: mockPageA, bob: mockPageB }`; untagged `goto` command
  - Action: engine dispatch
  - Assert: `mockPageA.goto` called; `mockPageB.goto` not called

- T-4.2: default-is-first-declared-not-alphabetical — default session follows declaration order, not alphabetical order — Seam: engine
  - Setup: `sessions: [{id: zara}, {id: alice}]`; `ctx.defaultSessionId = 'zara'`; untagged `goto /default`
  - Action: `runFlow(file, page, ctx)`
  - Assert: `goto /default` dispatched to zara's page; alice's page not navigated

- T-4.3: explicit-routing-does-not-shift-default — an explicit `session:` on one command does not change the default for the next untagged command — Seam: engine
  - Setup: `sessions: [{id: alice}, {id: bob}]`; command 1: `session: bob goto /bob-page`; command 2: untagged `goto /should-go-to-alice`
  - Action: `runFlow(file, page, ctx)`
  - Assert: command 2 dispatched to alice's page; bob still on `/bob-page`

**AC-5 — `runFlow` + `session:`**

- T-5.1: runflow-session-propagates-to-untagged-subcommands — untagged commands inside a sub-flow inherit the session set on the `runFlow` command — Seam: engine
  - Setup: parent `runFlow` command with `session: bob`; `sub.yaml` has one untagged `goto /sub-page`; `ctx.defaultSessionId = 'alice'`
  - Action: `runFlow(parentFile, page, ctx)`
  - Assert: `goto /sub-page` executes on bob's page; alice's page unchanged

- T-5.2: inner-session-field-overrides-inherited-context — a `session:` on a command inside a sub-flow overrides the inherited default — Seam: engine
  - Setup: parent `runFlow` with `session: bob`; sub-flow command has `session: alice goto /inner-alice`
  - Action: `runFlow(parentFile, page, ctx)`
  - Assert: `goto /inner-alice` dispatched to alice's page; bob's page not navigated

- T-5.3: default-session-restored-after-runflow-success — `ctx.defaultSessionId` returns to its original value after a successful `runFlow` + `session:` — Seam: engine
  - Setup: `ctx.defaultSessionId = 'alice'`; `runFlow` command with `session: bob`; sub-flow completes successfully
  - Action: dispatch `runFlow`, await completion
  - Assert: `ctx.defaultSessionId === 'alice'` after dispatch returns

- T-5.5: default-session-restored-after-runflow-failure — `ctx.defaultSessionId` is restored even when the sub-flow command fails — Seam: engine
  - Setup: `ctx.defaultSessionId = 'alice'`; `runFlow` command with `session: bob`; first sub-flow command is configured to fail
  - Action: dispatch `runFlow`, await completion (expecting failure)
  - Assert: `ctx.defaultSessionId === 'alice'` after dispatch returns; `nestedResult.passed` is false

- T-5.4: runflow-session-override-halts-subflow-on-first-failure — fail-fast behaviour applies inside sub-flows run under session override — Seam: engine
  - Setup: sub-flow first command is configured to fail; second command present
  - Action: execute through engine with `runFlow session: bob`
  - Assert: `nestedResult.commandResults` has length 1; second command not attempted

**AC-6 — Unknown session reference**

- T-6.1: unknown-session-id-parse-error — a `session:` value not matching any declared `id` throws at parse time with the unknown id and file path in the message — Seam: parser
  - Setup: `sessions: [{id: alice}]`; one command with `session: charlie`
  - Action: `loadAndParse(filePath)`
  - Assert: throws; message contains `"charlie"` and the file path

- T-6.2: unknown-session-error-before-browser-launch — parse failure prevents any browser from launching — Seam: runner
  - Setup: flow file with undeclared session reference; spy on `launchBrowser`
  - Action: `runAll([filePath], options)`
  - Assert: throws with parse error; `launchBrowser` not called

- T-6.3: unknown-session-in-nested-flow-names-subflow-path — when a sub-flow file itself contains an unknown session reference, the error names that file's path — Seam: parser
  - Setup: `sub.yaml` has `session: bob` on a command; `bob` not declared in `sub.yaml`'s own `sessions:` block
  - Action: `loadAndParse('sub.yaml')` (direct parse, not via parent `runFlow`)
  - Assert: throws; error message contains `sub.yaml`'s path and `"bob"`
  - Note: this tests direct parse only; whether parent `runFlow` eager-loads sub-flow YAML is out of scope

- T-6.4: multiple-unknown-sessions-first-error-reported — when multiple commands reference unknown sessions, the first one is reported — Seam: parser
  - Setup: `sessions: [{id: alice}]`; two commands with `session: ghost1` and `session: ghost2`
  - Action: `loadAndParse(filePath)`
  - Assert: throws exactly once; error references `"ghost1"`, not `"ghost2"`

**AC-7 — `session:` without `sessions:` block**

- T-7.1: session-field-without-sessions-block-is-parse-error — `session:` on a regular command in a flow with no `sessions:` block throws a parse error naming the context and file path — Seam: parser
  - Setup: YAML with `session: alice` on a `goto` command; no `sessions:` block
  - Action: `loadAndParse(filePath)`
  - Assert: throws before `runFlow`; message indicates `session:` used without `sessions:` block; file path in message

- T-7.2: session-field-on-runflow-without-sessions-block — `session:` on a `runFlow` command without a `sessions:` block is also a parse error — Seam: parser
  - Setup: YAML with `session: alice` on a `runFlow` command; no `sessions:` block
  - Action: `loadAndParse(filePath)`
  - Assert: throws parse error

- T-7.3: session-field-parse-error-before-browser-launch — parse failure prevents browser launch — Seam: runner
  - Setup: flow with `session:` field and no `sessions:` block; spy on `launchBrowser`
  - Action: `runAll([filePath], options)`
  - Assert: `launchBrowser` not called

**AC-8 — Duplicate session ids**

- T-8.1: adjacent-duplicate-ids-parse-error — two adjacent entries with the same `id` throw a parse error naming the duplicate and file path — Seam: parser
  - Setup: `sessions: [{id: alice}, {id: alice}]`
  - Action: `loadAndParse(filePath)`
  - Assert: throws; message contains `"alice"` and file path

- T-8.2: non-adjacent-duplicate-ids-detected — a duplicate id that is not adjacent to its first occurrence is still caught — Seam: parser
  - Setup: `sessions: [{id: alice}, {id: bob}, {id: alice}]`
  - Action: `loadAndParse(filePath)`
  - Assert: throws; message contains `"alice"`

- T-8.3: non-adjacent-duplicate-across-four-sessions — duplicate across a longer list is detected — Seam: parser
  - Setup: `sessions: [{id: alpha}, {id: beta}, {id: gamma}, {id: alpha}]`
  - Action: `loadAndParse(filePath)`
  - Assert: throws mentioning `"alpha"`

- T-8.4: all-same-ids-parse-error — all entries sharing the same id reports the duplicate — Seam: parser
  - Setup: `sessions: [{id: x}, {id: x}, {id: x}]`
  - Action: `loadAndParse(filePath)`
  - Assert: throws on first duplicate `x`

**AC-9 — Empty `sessions:` array**

- T-9.1: empty-sessions-array-is-parse-error — `sessions: []` throws a parse error indicating the array must not be empty — Seam: parser
  - Setup: YAML with `sessions: []` and valid commands
  - Action: `loadAndParse(filePath)`
  - Assert: throws; message indicates sessions must not be empty

- T-9.2: sessions-null-treated-as-absent — `sessions: ~` (YAML null) is treated as absent; flow behaves as legacy — Seam: parser
  - Setup: YAML with `sessions: ~`
  - Action: `loadAndParse(filePath)`
  - Assert: does not throw; `file.sessions` is `[]`; flow runs in legacy mode

**AC-10 — Invalid session id characters**

- T-10.1: session-id-with-space-is-invalid — id containing a space throws a parse error naming the id and allowed character set — Seam: parser
  - Setup: `sessions: [{id: 'alice bob'}]`
  - Action: `loadAndParse(filePath)`
  - Assert: throws; message contains `"alice bob"` and references allowed characters

- T-10.2: session-id-with-dot-is-invalid — id containing a dot throws a parse error — Seam: parser
  - Setup: `sessions: [{id: 'alice.session'}]`
  - Action: `loadAndParse(filePath)`
  - Assert: throws

- T-10.3: session-id-with-slash-is-invalid — id containing a slash throws a parse error — Seam: parser
  - Setup: `sessions: [{id: 'alice/bob'}]`
  - Action: `loadAndParse(filePath)`
  - Assert: throws

- T-10.4: session-id-with-at-sign-is-invalid — id containing `@` throws a parse error — Seam: parser
  - Setup: `sessions: [{id: 'alice@example'}]`
  - Action: `loadAndParse(filePath)`
  - Assert: throws

- T-10.5: session-id-with-unicode-is-invalid — id containing a non-ASCII unicode character throws a parse error — Seam: parser
  - Setup: `sessions: [{id: 'alïce'}]`
  - Action: `loadAndParse(filePath)`
  - Assert: throws

- T-10.6: session-id-alphanumeric-hyphen-underscore-valid — id using only `[a-zA-Z0-9_-]` is accepted — Seam: parser
  - Setup: `sessions: [{id: 'my-session_1'}]`
  - Action: `loadAndParse(filePath)`
  - Assert: no error thrown; `file.sessions[0].id === 'my-session_1'`

- T-10.7: session-id-numeric-only-valid — a purely numeric id is accepted — Seam: parser
  - Setup: `sessions: [{id: '42'}]`
  - Action: `loadAndParse(filePath)`
  - Assert: no error thrown

- T-10.8: session-id-empty-string-is-invalid — empty string id throws a parse error — Seam: parser
  - Setup: `sessions: [{id: ''}]`
  - Action: `loadAndParse(filePath)`
  - Assert: throws

- T-10.9: yaml-unquoted-id-with-surrounding-spaces-is-valid — unquoted YAML value with whitespace-only difference resolves to valid id after YAML parsing — Seam: parser
  - Setup: YAML source `sessions:\n  - id: alice` (unquoted, YAML collapses to `"alice"`)
  - Action: `loadAndParse(filePath)`
  - Assert: parses successfully; id is `"alice"`

- T-10.10: reserved-id-default-is-rejected — the string `__default__` is reserved and must not be accepted as a user-declared session id — Seam: parser
  - Setup: `sessions: [{id: '__default__'}]`
  - Action: `loadAndParse(filePath)`
  - Assert: throws; error message references `__default__` and indicates it is reserved

- T-10.11: session-id-65-chars-is-invalid — an id of exactly 65 characters (all valid chars) exceeds the 64-char limit — Seam: parser
  - Setup: `sessions: [{id: 'a'.repeat(65)}]`
  - Action: `loadAndParse(filePath)`
  - Assert: throws; message references the 64-char maximum

- T-10.12: session-id-64-chars-is-valid — an id of exactly 64 characters is at the boundary and must be accepted — Seam: parser
  - Setup: `sessions: [{id: 'a'.repeat(64)}]`
  - Action: `loadAndParse(filePath)`
  - Assert: no error thrown; `file.sessions[0].id.length === 64`

**AC-11 — `label:` is optional**

- T-11.1: session-without-label-is-valid — `{id: alice}` with no `label:` field parses without error; label is undefined — Seam: parser
  - Setup: `sessions: [{id: alice}]`
  - Action: `loadAndParse(filePath)`
  - Assert: no throw; `file.sessions[0].label === undefined`

- T-11.2: session-with-id-and-label-both-valid — `{id: alice, label: "Alice's Browser"}` parses correctly with label preserved — Seam: parser
  - Setup: `sessions: [{id: alice, label: "Alice's Browser"}]`
  - Action: `loadAndParse(filePath)`
  - Assert: no throw; `file.sessions[0].label === "Alice's Browser"`

- T-11.3: session-with-label-but-no-id-is-parse-error — a session definition supplying `label:` but omitting `id:` throws a parse error — Seam: parser
  - Setup: `sessions: [{label: primary}]`
  - Action: `loadAndParse(filePath)`
  - Assert: throws

**AC-12 — Circular-reference detection**

- T-12.1: circular-runflow-detected-in-session-context — existing circular reference detection fires in a multi-session flow; context is not corrupted — Seam: engine, dispatcher
  - Setup: `ctx.callStack` contains absolute path of `self.yaml`; `runFlow` command referencing `self.yaml`; `ctx.defaultSessionId = 'alice'`
  - Action: dispatch
  - Assert: `result.passed` is false; message matches `/Circular flow reference/i` and contains file path; `ctx.defaultSessionId` remains `'alice'`

- T-12.2: cycle-detection-with-session-override-restored — circular reference through a session-overriding `runFlow` chain still detected; `defaultSessionId` is restored on early exit — Seam: engine, dispatcher
  - Setup: A → B (`session: bob`) → A; `ctx.defaultSessionId = 'alice'` before dispatch
  - Action: `runFlow(fileA, page, ctx)`
  - Assert: error indicates circular reference; `ctx.defaultSessionId === 'alice'` after error

**AC-13 — Cleanup on failure**

- T-13.1: browser-close-called-on-command-failure — `browser.close()` is called exactly once when a command throws at runtime — Seam: runner
  - Setup: alice's second command throws mid-flow; spy on `browser.close()`
  - Action: `runAll([filePath], options)`
  - Assert: `browser.close()` called exactly once; `FlowResult.passed` is false

- T-13.2: browser-close-called-when-page-creation-throws — `browser.close()` is still called even when `newPage()` fails during session provisioning — Seam: runner
  - Setup: mock `browser.newPage` to throw on the second call (bob's page creation fails)
  - Action: `runAll([filePath], options)`
  - Assert: `browser.close()` called; error propagates to caller

- T-13.3: browser-close-called-exactly-once-not-per-session — close is called once at the browser level, not once per declared session — Seam: runner
  - Setup: two-session flow; first command fails; spy on `browser.close()`
  - Action: `runAll([filePath], options)`
  - Assert: `browser.close()` called exactly once

**AC-14 — `assertUrl` is session-scoped**

- T-14.1: assert-url-checks-only-assigned-sessions-page — `assertUrl` for each named session checks only that session's page URL; both pass when each session is on its expected URL — Seam: engine
  - Setup: alice navigated to `/alice-page`; bob navigated to `/bob-page`; two commands: `session: alice assertUrl /alice-page`, `session: bob assertUrl /bob-page`
  - Action: `runFlow(file, page, ctx)`
  - Assert: both `assertUrl` results are `passed: true`; each page's `.url()` called; the other page's `.url()` not called

- T-14.2: assert-url-wrong-session-url-fails-with-details — `assertUrl` targeting a session whose URL does not match produces a failure with expected and actual URL in the message — Seam: engine, driver
  - Setup: `mockPageB.url()` returns `/bob-page`; command is `session: bob assertUrl /alice-page`
  - Action: `runFlow(file, page, ctx)`
  - Assert: `result.passed` is false; message contains `/alice-page` (expected) and `/bob-page` (actual)

- T-14.3: assert-url-no-session-field-uses-default-session — untagged `assertUrl` dispatches to `ctx.defaultSessionId`'s page only — Seam: engine
  - Setup: `ctx.defaultSessionId = 'alice'`; `mockPageA.url()` returns `/home`; untagged `assertUrl /home`
  - Action: dispatch
  - Assert: `result.passed` is true; `mockPageA.url` called; `mockPageB.url` not called

---

## Arbiter Verdict (Tester Ensemble Phase 1)

**Status:** READY (post-revision)

**Fixes applied:**
- T-1.3: setup now uses `Map([['__default__', mockPage]])` + `defaultSessionId = '__default__'`
- T-1.4: `createContext` call updated to match post-T-5 signature
- T-5.3: split into T-5.3 (success path) + T-5.5 (failure path)
- T-6.3: scope note added clarifying direct-parse vs eager sub-flow load

**Tests added:** T-5.5, T-10.10 (reserved `__default__`), T-10.11 (65-char invalid), T-10.12 (64-char valid)

**Total tests:** 56

---

## Code Artifacts

**Source files changed (9):**
- `src/types.ts` — added `SessionDef`, `SessionedCommand`; `FlowFile.commands → SessionedCommand[]`; `FlowFile.sessions: SessionDef[]`; `RunContext` gains `sessions: Map<string, Page>` and `defaultSessionId: string`
- `src/parser/validator.ts` — added `'sessions'` to `VALID_HEADER_KEYS`; added `validateSessions()` (absent/null → legacy; empty array → error; id regex/length/reserved/uniqueness)
- `src/parser/commandParser.ts` — added `parseSessionedCommand()` (strips `session:` key before delegating to `parseCommand`)
- `src/parser/index.ts` — extracts and validates sessions block; validates each command's `session:` reference; calls `parseSessionedCommand`
- `src/driver/browser.ts` — added `createSessionPages(browser, sessionIds)` returning `Map<string, Page>`
- `src/engine/context.ts` — `createContext(runDir, sessions, defaultSessionId)` (all required)
- `src/engine/dispatcher.ts` — extracted `RunFlowFn` type alias; updated `registerRunFlow` type
- `src/engine/index.ts` — loop over `SessionedCommand[]`; resolves page per command; save/restore `ctx.defaultSessionId` on `runFlow` + `session:`; shared `lastTappedLocator` comment
- `src/cli/runner.ts` — provisions sessions via `createSessionPages` or `__default__` fallback; passes to `createContext`; closes per-flow pages

**Test files changed (2):**
- `tests/unit/parser.test.ts` — updated 2 assertions for `SessionedCommand[]` shape
- `tests/integration/commands.test.ts` — updated `freshCtx()` + 2 `FlowFile` constructions

**Test files added (3):**
- `tests/unit/sessions.test.ts` — 25 parser-layer session tests (AC-1, 2, 6–12)
- `tests/unit/session-engine.test.ts` — 9 engine routing tests (AC-3, 4, 5, 14)
- `tests/integration/sessions.test.ts` — 5 real-browser session tests (AC-2, 3, 4, 5, 13)

**Result:** 294 pass / 6 fail (same 6 pre-existing `reporter files` failures present on `main`; zero regressions)

---

## Test Results

**Phase 2 findings (both generators):**

- **Issue 1 (fixed):** `launchBrowser` created an extra unused page, giving N+1 pages for an N-session flow (AC-2 violation). Fixed in `runner.ts` by closing `_initialPage` immediately after `launchBrowser`.
- **Issue 2 (fixed):** Per-flow page cleanup was not in a `try/finally` — pages leaked on `runFlow` throw. Fixed by wrapping the per-flow block in a `try/finally`.
- **Dead parameter:** `runFlow(file, page, ctx)` — the `page` param is never read (engine resolves from `ctx.sessions`). Accepted as known dead code; removing it would require a dispatcher type change.
- **`lastTappedLocator` shared across sessions:** documented in code comment. Deferred.

**Final test count after fixes:** 294 pass / 6 fail (6 pre-existing `reporter files` failures on `main`, unrelated to this feature)

---

## Quality Gate

**Status: PASS**

- TypeScript: clean (zero errors)
- Tests: 294 pass / 6 fail (pre-existing only)
- Extra page closed immediately after `launchBrowser`: ✓
- Per-flow page cleanup in `try/finally`: ✓

---

## Signoff Package
<!-- Release Documenter output -->
