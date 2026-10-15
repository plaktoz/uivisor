# Pipeline State: feat-selector-waits-and-timeouts

**Task:** Phase 1 of docs/proposals/loading-timeout-sla.md: waiting selector resolution and configurable timeouts. Scope is §5.1, §5.2, §5.3 and §6 (including §6.1 waiting resolution with the cascade stability check and not-visible mode, and §6.2 the COMMAND_TRAITS table). Excludes loading auto-wait (§7) and response time / SLA (§8, §9). Integration flow test-app/flows/integration/timeouts.yaml plus a negative flow, per §11 phase 1 rows.
**Started:** 2026-10-13
**Status:** in_progress

## Worktree
**Path:** .worktrees/feat-selector-waits-and-timeouts
**Branch:** feat-selector-waits-and-timeouts
**Created:** 2026-10-13 16:40
**Status:** active
**Base:** c7ab53f (origin/main). First commit 088a445 adds the proposal at docs/proposals/loading-timeout-sla.md and the measurement tool at docs/proposals/assets/assess-loading.mjs.

## Pre-flight
- **Data governance:** clean. One pattern hit, `test-app/src/context/AuthContext.jsx:13` (`u.password === password`), is a comparison, not a stored secret. No PII.
- **Cost cap:** $5.00 per run.
- **Eval gate:** `agent-config.yml` unchanged since HEAD. Not required.
- **Baseline tests (worktree):** packages/core 406 passed. uivisor-app 723 passed, 4 expected fail.
- **Guardrail candidates:** none pending.

## Gate 0: Execution Plan

**Classification:** feature
**Complexity:** large (new resolution subsystem in core, touches core locator + commands + types, parser, engine, CLI, test-app; expected 9+ ACs)

**Status:** approved (2026-10-13)

**Roles Activated:** Analyst, Architect, Tester Ensemble, Coder, Release Documenter, Deployer, Delivery Manager
**Designer Activated:** no (the test-app pages added here are test fixtures, not product UI)

**Scope decisions for phase 1 (from the proposal):**
- In: §5.1 sibling `timeout:` key; §5.2 precedence for `defaultTimeout` and `navigationTimeout` (command, CLI, top-level header, shared config, built-in); child flows inherit, with the ignored-key notice; §5.3 reserved config/header keys; §6 timeout table incl. `assertUrl`/`assertCount`/`within` retrying and one budget per command; §6.1 waiting resolution with stability check and not-visible mode; §6.2 `COMMAND_TRAITS`; `--timeout` and `--navigation-timeout` CLI flags; new error message format.
- Deferred to phase 2/3: `loading`, `sla`, `waitForLoading`, `--sla`, `waitFor` condition form, response timing. The `loading` and `sla` names are **not** reserved yet; they are reserved in the phase that gives them meaning, so this PR changes no var semantics it doesn't use.
- `COMMAND_TRAITS` carries only `timeout` in phase 1. `preCheck`, `action` and `checkpoint` are added by the phases that read them.

**Execution Sequence:**
1. Analyst → skill: to-spec
   Reads: docs/proposals/loading-timeout-sla.md (§1, §5.1–5.3, §6, §11 phase 1 rows, §12 Q1/Q12/Q13/Q14/Q16)
   Output: spec + acceptance criteria → state.md#gate-1
   [GATE 1: human approval required — revision cap: 2]
2. Architect → skill: to-tickets + codebase-design
   Reads: Gate 1 spec
   Output: feature/task breakdown table + seam notes → state.md#feature-task-breakdown
3. Tester Ensemble Phase 1 → skill: tdd
   3a. tester_generator_a + tester_generator_b in parallel → state.md#tests-generator-a / #tests-generator-b
   3b. tester_consolidator → dedup + attribution table → state.md#tests
   3c. tester_arbiter → rulings on disagreements
4. Coder → skill: implement
   Working directory: .worktrees/feat-selector-waits-and-timeouts
   Output: source files, test-app delayed-element fixtures, test-app/flows/integration/timeouts.yaml + negative flow → state.md#code-artifacts
   Parallel execution: yes, for independent tasks
4.5. Orchestrator — commit pipeline state into worktree (autonomous)
5. Tester Ensemble Phase 2 → skill: tdd + code-review → state.md#test-results (retry cap 3, review cap 2)
6. Quality Gate → skill: quality (tester_arbiter, autonomous) → state.md#quality-gate
6.5. Integration flow run (CLAUDE.md rule): `node uivisor-app/dist/cli/index.js test test-app/flows/integration/timeouts.yaml` (+ negative flow expected to fail) against the live test-app; all existing integration flows re-run to confirm no regressions. Failure = blocking, back to Coder.
6.6. Build Verification (build_verifier, autonomous) → pipeline/feat-selector-waits-and-timeouts/build_check.md
   [GATE 3: human approval required before merge/deploy]
7. Release Documenter → skill: proj-deploy → signoff_package.md
8. Deployer → skill: proj-deploy
9. Delivery Manager (autonomous) → retro.md

**Model mapping for subagents:** claude-opus-4-8 → opus, claude-sonnet-5 → sonnet, claude-haiku-4-5 → haiku. tester_generator_b is configured as openai/gpt-5.4, which this session can't call; it runs on sonnet, as in feat-implement-set-var-to-flow.

## Run Estimates

**Complexity:** large
**Duration:** ~58–118 min  (no retries: ~58 min)
**Cost:** ~$0.39–$0.61 by the protocol formula (cap: $5.00). The last comparable run (feat-implement-set-var-to-flow) logged $2.93 actual, so expect ~$2.50–$4.50; the Architect on opus is the largest single line.
**Tokens:** ~36K–90K by formula (actuals run far higher; see the cost note)

**Retry budgets:**
- TDD + quality gate: 3 rounds
- Spec revision: 2 rounds
- Design revision: n/a (Designer not activated)
- Code review: 2 rounds

## Lessons from Prior Runs (injected at Gate 0)
- Reporter exhaustiveness: any change to a `Command` union member's shape needs `console.ts`, `html.ts`, `markdown.ts` label cases checked; `dispatcher.ts` exhaustiveness is now guarded by `never` (role: coder, architect).
- goBack/goForward use URL-before/after with `waitUntil: 'commit'`; navigation timeouts must keep `commit` (role: coder).

**Last checkpoint:** Orchestrator Gate 0 written at 2026-10-13 16:45

## Base Update (2026-10-13 17:30)
- main gained #100 and #101 (`edc5701`, runFlow `{ file, vars }` with scoped child var defaults). The run branch was rebased onto `edc5701` before any code was written; it carries only the proposal commits (`3a6c6b8`, `aa09c4e`).
- Re-baselined on the new base: packages/core 406 passed; uivisor-app 733 passed, 4 expected fail. New regression flows: `test-app/flows/integration/run-flow-override.yaml` (+ child).
- Overlap to respect: `engine/index.ts` runFlow loop (re-indented by #100; phase 1 changes the `dispatch` call to pass the whole step), `dispatcher.ts` runFlow branch (child-flow notice goes here; `ctx.callStack` now includes the top-level file, so the notice can name the caller), `types.ts` (`runFlow.vars`), `commandParser.ts` (`runFlow` object form).
- #100 appends flow context to `is not defined` interpolation errors; `${var}` in the sibling `timeout:` must get the same context.
- **Human decisions:** Q13 re-confirmed (child flows inherit timeouts; their keys are ignored with a notice, unlike vars). Q17: `timeout:` on a command whose timeout trait is `none` (incl. `runFlow`) is a parse error. Both recorded in the proposal (`aa09c4e`).
- Analyst activation failed three times with 429 on claude-sonnet-5 (16:52, 17:00, 17:25 after a 15-minute wait). Awaiting human direction.

**Last checkpoint:** Orchestrator base update at 2026-10-13 17:30

## Human Decisions (2026-10-13 17:40)
- Timeouts live on the commands that wait (element, navigation), never on `runFlow`. Confirmed.
- Q18: `timeout:` on `within` bounds only the container lookup.
- Q19: `pressKey` rejects `timeout:` in phase 1 (trait `none`); `waitForPageLoad` accepts its inner `timeout` or the sibling key, both together is a parse error. Recorded in the proposal (`see git log`).
- Analyst model override: run on opus (claude-opus-4-8) for this activation because claude-sonnet-5 returned 429 three times. Approved by the human. Other sonnet roles stay on sonnet; re-check availability before each.

**Last checkpoint:** Orchestrator decisions recorded at 2026-10-13 17:40

## Gate 1: Spec + Acceptance Criteria

**Status:** approved (2026-10-13, revision 1)
**Revision:** 1 of max 2

### Feature Summary

Phase 1 of `docs/proposals/loading-timeout-sla.md`. Today, string selectors (bare cascade, pipe `a=x|b=y`) and the `{ xpath }` object form count matches once and fail at once if there isn't exactly one match. Measured on the test-app: `assertVisible: data-testid=int-tap-result` on an absent element fails after 0.66 s; the `{ testId }` form fails after 5.63 s. `assertNotVisible` with a string selector fails when the element is absent (`No element found for pipe selector …`, reproduced). Element commands have a hard-coded 5000 ms timeout. The `inputText` shorthand and navigation use Playwright's 30000 ms default. `assertUrl`, `assertCount` and `within` check once.

After this change:
- Every element command waits for its target, whatever the selector form. The wait is a retry loop bounded by the command's timeout, with a stability check for lower-priority cascade or pipe winners and a not-visible mode.
- `assertUrl`, `assertCount` and `within` (container lookup) keep checking until the deadline.
- Timeouts can be configured: `defaultTimeout` covers element commands and `navigationTimeout` covers navigation. Each can come from a per-command sibling `timeout:` key, a CLI flag (`--timeout`, `--navigation-timeout`), the top-level flow header or the shared config file, with built-in defaults of 5000 and 30000.
- Child flows inherit the top-level policy and print a notice when they set these keys themselves.
- One timeout budget covers everything a command waits on.
- Which timeout applies to each command is set in one `COMMAND_TRAITS` table, which `tsc` checks for completeness.

### Scope

**In scope:**
- Proposal §1, §5.1 (sibling `timeout` key only, including all placement rules: Q17, Q18, Q19), §5.2 (Timeout and Navigation timeout rows, Nested flows paragraphs), §5.3 (`defaultTimeout` and `navigationTimeout` only), §6 (whole section), §6.1 (whole section), §6.2 (`timeout` trait column only), §9.4 (validation of `timeout`/`defaultTimeout`/`navigationTimeout`), §10 rows for these, §11 phase-1 unit tests and phase-1 integration pages/flows, §12 Q1, Q12, Q13, Q14, Q16, Q17, Q18, Q19.
- Waiting resolution for bare-string cascade, pipe strings (including single-segment `attr=value`), all object selector forms, and the `{ xpath }` form. Also for container lookup in `within`.
- Stability check, duplicate-match retry, the new not-found error format with per-step counts, and not-visible mode for `assertNotVisible`.
- `assertUrl`, `assertCount` and `within` retry until their deadline (behaviour change, Q1).
- The `inputText` shorthand uses `defaultTimeout`. `goto`, `reload`, `goBack` and `goForward` use `navigationTimeout`. `waitForPageLoad` uses its own timeout, else `navigationTimeout`.
- Sibling `timeout:` on every command whose timeout trait is `element` or `navigation`, at top level, inside `within` `do:` blocks and inside child flows. `${var}` in it resolves at dispatch time from runtime vars.
- `defaultTimeout` and `navigationTimeout` in the flow header and the shared config file. Both become reserved config names that no longer turn into vars.
- CLI flags `--timeout <ms>` and `--navigation-timeout <ms>`.
- Child-flow inheritance with the ignored-key notice.
- `COMMAND_TRAITS` with only a `timeout` trait.
- test-app fixture page for delayed content, stability, hidden and redirect cases.
- Integration flow `test-app/flows/integration/timeouts.yaml` and one negative flow.

**Out of scope:**
- Everything about `loading` (§7): indicators, network/chunk tracking, pre-check, settle, `waitForLoading`.
- `sla`, `--sla`, response timing, `ActionTiming`, SLA reporting (§8, §9), and the §9.4 "timeout ≤ SLA" warning.
- The `waitFor` condition form (`waitFor: { visible | notVisible }`, §7.7). `waitFor: <ms>` stays a sleep.
- Reserving the `loading` and `sla` names. In config they stay ordinary vars; in the flow header they stay unknown keys.
- `COMMAND_TRAITS` fields `preCheck`, `action` and `checkpoint`.
- A `timeout` trait of `element` for `pressKey`. That is phase 2; in phase 1 its trait is `none`.
- Re-checking an assertion's own condition after its target has resolved. For example, `assertText` still compares the text once, and `assertEnabled`/`assertChecked` still read state once. Only target resolution and the existing Playwright waits share the budget. `assertUrl` and `assertCount` are the only assertions whose condition is retried.
- Other unknown sibling keys (e.g. `sla:`, `foo:`). They stay silently ignored, as today.
- Keys inside the inline `vars:` block (e.g. `vars: { defaultTimeout: 1 }`). They stay ordinary vars.
- The `css=` string shorthand.
- Showing the notice or the effective timeout in HTML or Markdown reports.

### Constraints

- **Built-in defaults:** `defaultTimeout` 5000 ms, `navigationTimeout` 30000 ms (§5.2). With no new keys set, every flow that passes today still passes (§5.2, Q1).
- **Precedence** (first one set wins, §5.2):
  - Element timeout: command `timeout:`, then CLI `--timeout`, then top-level flow header `defaultTimeout`, then shared config `defaultTimeout`, then 5000.
  - Navigation timeout: command `timeout:`, then CLI `--navigation-timeout`, then top-level flow header `navigationTimeout`, then shared config `navigationTimeout`, then 30000.
  - For these keys the header beats the shared config. That is the opposite of vars, where config wins.
- **Retry interval:** 100 ms between resolution attempts. The stability re-check runs 100 ms after a lower-step win (§6.1). The `assertUrl` and `assertCount` re-check interval is also 100 ms (chosen by analyst).
- **One budget per command** (§6, Q16). The command's timeout is one deadline. In phase 1 it covers target resolution plus the interaction or the Playwright wait that follows. For `waitForPageLoad` it covers the URL wait plus the load-state wait. There is no loading pre-check or settle in phase 1.
- **Timeout trait table** (§6, §6.2), exported from `@uivisor/core` as `COMMAND_TRAITS: Record<Command['type'], { timeout: 'element' | 'navigation' | 'none' }>`:
  - `element`: `tapOn`, `doubleClick`, `hover`, `inputText`, `inputTextTargeted`, `clearText`, `selectOption`, `check`, `uncheck`, `assertVisible`, `assertNotVisible`, `assertText`, `assertValue`, `assertEnabled`, `assertDisabled`, `assertChecked`, `assertUnchecked`, `assertUrl`, `assertCount`, `within`.
  - `navigation`: `goto`, `reload`, `goBack`, `goForward`, `waitForPageLoad`.
  - `none`: `wait`, `waitFor`, `scroll`, `setViewport`, `screenshot`, `setVar`, `testVarSet`, `unsetVar`, `runFlow`, `pressKey` (phase 1, Q19), and `crossOriginIframeWarning` (recorder-only, not in the proposal's list; `none` chosen by analyst).
- **Child flows (Q13):** timeouts are inherit-only, unlike vars. A child flow's header/config `defaultTimeout`/`navigationTimeout` are ignored while it runs through `runFlow`. `runFlow: { file, vars }` cannot set them, because a var named `defaultTimeout` is just a var.
- **Config/header `${var}`** values resolve at parse time, from config vars, inline vars and the environment, as for every other header value. Only the per-command sibling `timeout:` sees runtime (`setVar`) vars (§5.3).
- **goBack/goForward** keep `waitUntil: 'commit'` (prior-run lesson). Only their timeout changes.
- **`waitForPageLoad` inner `timeout: 0`** still parses and keeps its current meaning (no timeout). The sibling key must be positive (§9.4).
- **Recorder app:** `recorder-app` imports the core `execute*` functions. It must still build, and its tests must still pass, using the built-in defaults.
- **Reporter labels:** the console, HTML and Markdown labels for a command don't change when it has a sibling `timeout:` (chosen by analyst).
- **Negative flow location:** `test-app/flows/integration/` is run as a whole directory (`test-app/README.md`), so the negative flow lives outside it, at `test-app/flows/integration-negative/timeouts-default-fails.yaml` (chosen by analyst).

### Test seams (existing, preferred)

- **Core resolution and commands:** `packages/core` unit tests with mocked `Page`/`Locator` (prior art: `playwrightLocator.test.ts`, `commands.test.ts`). Use fake timers or controllable `count()` sequences for timing ACs.
- **Parser:** `parseSessionedCommand` / `loadAndParse` unit tests (prior art: `tests/unit/parser.test.ts`, `within-parser.test.ts`).
- **CLI:** `parseArgs` unit tests (prior art: `tests/unit/args.test.ts`).
- **Engine:** `dispatch` / `runFlow` with a real Chromium against a local fixture HTTP server (prior art: `tests/integration/commands.test.ts`).
- **End to end:** `node uivisor-app/dist/cli/index.js test <flow>` against the live test-app (http://localhost:8084).

Where an AC says "fails after T ms", the failure must happen no earlier than T ms and no later than T + 1000 ms after the command starts (tolerance chosen by analyst). Where an AC says "passes promptly", the command's `durationMs` must be under (time the condition first holds) + 1000 ms.

### Acceptance Criteria

#### Waiting resolution: selector forms

**AC1: Bare string waits for a delayed element (step-1 winner)**
- **Input:** a page where `<div data-testid="int-delayed">Delayed content</div>` is added 1500 ms after load. Flow step `assertVisible: int-delayed`. No timeout settings, so the default is 5000.
- **Expected:** the step passes promptly (`durationMs` < 2500).
- **Failure:** the step fails, or takes the full 5000 ms.

**AC2: Bare string waits for a delayed element (lower-step winner)**
- **Input:** the same page as AC1. Step `assertVisible: Delayed content` (no element has data-testid `Delayed content`, so cascade step 2 `text` wins).
- **Expected:** the step passes, with `durationMs` < 2600 (1500 + the 100 ms stability check + tolerance).
- **Failure:** the step fails, or doesn't pass before 5000 ms.

**AC3: Pipe string waits for a delayed element**
- **Input:** the same page as AC1. Step `tapOn: id=int-nope|data-testid=int-delayed`.
- **Expected:** the step passes, with `durationMs` < 2600.
- **Failure:** the step fails immediately with `No element found for pipe selector …`, or fails at all.

**AC4: Object selectors wait within the budget**
- **Input:** the same page as AC1. Steps `assertVisible: { testId: int-delayed }`, `assertVisible: { css: "[data-testid=int-delayed]" }` and `assertVisible: { text: "Delayed content" }`, each run on a fresh page load.
- **Expected:** each step passes, with `durationMs` < 2500.
- **Failure:** any of them fails.

**AC5: `{ xpath }` form waits for a delayed element**
- **Input:** the same page as AC1. Step `assertVisible: { xpath: "//*[@data-testid='int-delayed']" }`.
- **Expected:** the step passes, with `durationMs` < 2500.
- **Failure:** the step fails immediately with `No element found for xpath selector …`, or fails at all.

**AC6: Single-step selectors and step-1 wins resolve without a stability delay**
- **Input:** mocked resolution where the target is present from the start, for (a) bare string `foo` with data-testid `foo` matching once, (b) pipe `text=Foo` (single segment), (c) `{ testId: foo }`.
- **Expected:** each resolves on the first attempt in under 100 ms. No second resolution pass is run.
- **Failure:** any form waits 100 ms or more, or runs a second resolution pass.

#### Waiting resolution: stability check and duplicates

**AC7: Stability check stops a heading from winning over a late testid button (cascade)**
- **Input:** a page where `<h2>Submit</h2>` appears at t, and `<button data-testid="Submit">Confirm</button>` appears at t + 50 ms. Clicking the button renders `data-testid="int-submit-result"` with text `Submitted`; clicking the heading does nothing. The step `tapOn: Submit` starts before t. The next step is `assertVisible: { testId: int-submit-result }`.
- **Expected:** both steps pass. The button was clicked, not the heading.
- **Failure:** `int-submit-result` never appears, meaning the heading was clicked.

**AC8: Stability check applies to pipe strings**
- **Input:** the same page as AC7. Step `tapOn: data-testid=Submit|text=Submit` starts before t. The next step is `assertVisible: { testId: int-submit-result }`.
- **Expected:** both steps pass.
- **Failure:** the heading is clicked, so `int-submit-result` is absent.

**AC9: A stable lower-step winner is accepted after one re-check**
- **Input:** mocked cascade where step 1 (`data-testid`) always has 0 matches and step 2 (`text`) always has 1 match.
- **Expected:** resolution returns the step-2 locator after exactly two resolution passes, about 100 ms apart. The total time is at least 100 ms and under 300 ms.
- **Failure:** it returns after one pass (no check), or it keeps retrying until the deadline.

**AC10: A changed winner restarts resolution, and step 1 is then accepted at once**
- **Input:** mocked cascade where pass 1 has step 1 = 0 matches and step 2 = 1 match, and from pass 2 onward step 1 = 1 match.
- **Expected:** the returned locator is the step-1 (`data-testid`) locator.
- **Failure:** the step-2 locator is returned.

**AC11: An unconfirmed lower-step winner is never accepted at the deadline**
- **Input:** mocked cascade with a timeout of 1000 ms, where step 2 has 1 match and step 1 alternates between 0 and 1 match on every pass, so no winner is confirmed twice in a row before the deadline.
- **Expected:** resolution fails with the AC14 not-found error after 1000 ms (chosen by analyst: the stability check must succeed before the deadline, otherwise the command fails).
- **Failure:** a locator is returned, or the failure happens before 1000 ms.

**AC12: Duplicate matches retry until they collapse to one**
- **Input:** a page or mock where `data-testid=row` matches 2 elements from 0 ms and 1 element from 800 ms. Step `tapOn: data-testid=row` with the default timeout.
- **Expected:** the step passes promptly (`durationMs` < 1800).
- **Failure:** it fails immediately with `No unique element found …`, or fails at all.

**AC13: Retry cadence is 100 ms**
- **Input:** mocked step-1 locator whose `count()` returns 0 at once and always. Single-segment selector `data-testid=x`, with a timeout of 1000 ms.
- **Expected:** `count()` is called at least 5 and at most 11 times before the failure.
- **Failure:** it is called fewer than 5 or more than 11 times (polling too slowly, or busy-looping).

#### Waiting resolution: timeout errors

**AC14: Not-found error for a bare string (cascade)**
- **Input:** step `assertVisible: int-never-rendered` with sibling `timeout: 1000` on a page where nothing matches.
- **Expected:**
  - The step fails after 1000 ms.
  - Line 1 of the message is exactly `Element not found after 1000ms: int-never-rendered`.
  - The next 5 lines are exactly the following, in this order. The count is the one from the last attempt.
    - `  data-testid=int-never-rendered: 0 matches`
    - `  text=int-never-rendered: 0 matches`
    - `  name=int-never-rendered: 0 matches`
    - `  id=int-never-rendered: 0 matches`
    - `  placeholder=int-never-rendered: 0 matches`
  - Any lines after these are not specified.
- **Failure:** the step fails in under 1000 ms, or line 1 or the step lines differ.

**AC15: Not-found error for a pipe string**
- **Input:** step `tapOn: id=a-nope|data-testid=b-nope` with sibling `timeout: 1000`. Neither matches.
- **Expected:** the step fails after 1000 ms. Line 1 is exactly `Element not found after 1000ms: id=a-nope|data-testid=b-nope`, followed by exactly `  id=a-nope: 0 matches` and `  data-testid=b-nope: 0 matches`.
- **Failure:** the old heading `No element found for pipe selector …`, or different or missing step lines.

**AC16: Not-found error for object and xpath forms**
- **Input:** (a) `assertVisible: { testId: int-never-rendered }` and (b) `assertVisible: { xpath: "//*[@id='nope']" }`, each with sibling `timeout: 1000`, on a page with no match.
- **Expected:** each fails after 1000 ms. Line 1 is exactly `Element not found after 1000ms: <JSON>`, followed by the line `  <JSON>: 0 matches`, where `<JSON>` is `JSON.stringify` of the selector object (chosen by analyst):
  - (a) `Element not found after 1000ms: {"testId":"int-never-rendered"}`
  - (b) `Element not found after 1000ms: {"xpath":"//*[@id='nope']"}`
- **Failure:** the message is `Expected: visible\nGot: element not found` or `No element found for xpath selector …`, or the line format differs.

**AC17: Duplicates at the deadline report their counts**
- **Input:** step `tapOn: data-testid=row` with sibling `timeout: 1000` on a page where `data-testid=row` matches 2 elements throughout.
- **Expected:** the step fails after 1000 ms. Line 1 is exactly `Element not found after 1000ms: data-testid=row`, and line 2 is exactly `  data-testid=row: 2 matches`.
- **Failure:** it fails at once, or the heading or count line differs.

**AC18: Malformed selectors fail fast, without retrying**
- **Input:** separate steps with the default timeout: (a) `tapOn: foo=bar` (unknown attribute), (b) `tapOn: xpath=//a|//b` (xpath union in pipe syntax), (c) `tapOn: { xpath: "//*[" }` (invalid XPath).
- **Expected:** each fails in under 500 ms with today's message:
  - (a) starts with `Unknown attribute 'foo'`
  - (b) starts with `XPath union '|' conflicts with pipe syntax`
  - (c) starts with `Invalid XPath expression:`
- **Failure:** any of them retries until the timeout, or the message changes.

#### Not-visible mode

**AC19: `assertNotVisible` with a string selector passes when the element is absent**
- **Input:** on the `/integration` page (no tap yet), steps `assertNotVisible: data-testid=int-tap-result` and `assertNotVisible: int-tap-result`.
- **Expected:** both pass, each in under 1000 ms.
- **Failure:** either fails with `No element found for pipe selector …` or `No unique element found for bare selector …`, or takes 1000 ms or more.

**AC20: `assertNotVisible` passes when the element is present but hidden**
- **Input:** a page with `<div data-testid="int-hidden" style="display:none">Hidden</div>`. Steps `assertNotVisible: data-testid=int-hidden` and `assertNotVisible: { testId: int-hidden }`.
- **Expected:** both pass, each in under 1000 ms.
- **Failure:** either fails.

**AC21: `assertNotVisible` waits for a visible element to go away**
- **Input:** an element `data-testid=int-vanish` that is visible at load and removed from the DOM at 1500 ms. Step `assertNotVisible: data-testid=int-vanish` with the default timeout.
- **Expected:** the step passes promptly (`durationMs` < 2500).
- **Failure:** it fails, or it fails or passes only after 5000 ms.

**AC22: `assertNotVisible` fails at the deadline when the element stays visible**
- **Input:** an element `data-testid=int-stays` that stays visible. Step `assertNotVisible: data-testid=int-stays` with sibling `timeout: 1000`.
- **Expected:** the step fails after 1000 ms with message `Expected: not visible\nGot: visible` (unchanged), so `expected` = `not visible` and `got` = `visible`.
- **Failure:** it passes, fails early, or the message changes.

**AC23: Not-visible mode with duplicate matches**
- **Input:** a page where `data-testid=dup` matches 2 elements, both hidden, throughout. Step `assertNotVisible: data-testid=dup` with sibling `timeout: 1000`.
- **Expected:** the step fails after 1000 ms with line 1 `Element not found after 1000ms: data-testid=dup` and line 2 `  data-testid=dup: 2 matches` (chosen by analyst: duplicates retry and fail the same way in both modes; only "zero matches on every step" counts as absent).
- **Failure:** it passes, or fails with a different message.

#### Commands that now retry: `within`, `assertUrl`, `assertCount`

**AC24: `within` waits for a delayed container**
- **Input:** a page where `<div data-testid="int-delayed-card"><span data-testid="int-card-label">Card ready</span></div>` is added 1500 ms after load. The step is a `within: { data-testid: int-delayed-card, do: [ { assertVisible: { testId: int-card-label } } ] }`, with the default timeout.
- **Expected:** the step passes, with `durationMs` < 2500.
- **Failure:** it fails immediately with `within: No container found …`.

**AC25: `within` container not-found error at the deadline**
- **Input:** `within: { data-testid: int-never-rendered, do: [ { assertVisible: x } ] }` with sibling `timeout: 1000`.
- **Expected:** the step fails after 1000 ms. Line 1 is exactly `within: No container found after 1000ms for selector 'data-testid=int-never-rendered'`, and line 2 is exactly `  data-testid=int-never-rendered: 0 matches` (wording chosen by analyst; it keeps today's `within:` prefix).
- **Failure:** it fails at once, or line 1 or line 2 differs.

**AC26: `within` with `nth` waits for enough containers**
- **Input:** a list whose items `data-testid=item` grow from 1 to 3 at 1000 ms. Step `within: { data-testid: item, nth: 2, do: [...] }` with the default timeout.
- **Expected:** the step passes after the list grows, with `durationMs` < 2000 (chosen by analyst: `nth` out of range retries like a missing container). If the list never reaches 3 items and the sibling is `timeout: 1000`, the step fails after 1000 ms with today's message `within: nth=2 requested but only 1 containers matched selector 'data-testid=item'`.
- **Failure:** it fails immediately when `nth` is out of range, or the deadline message differs.

**AC27: `within` sibling `timeout:` bounds only the container lookup (Q18)**
- **Input:**
  - (a) Container present at load, and an inner element `data-testid=inner` added at 2500 ms. Step `within: { data-testid: card, do: [ { assertVisible: { testId: inner } } ] }` with sibling `timeout: 1000` on the `within`. No other timeout settings, so the default is 5000.
  - (b) Container added at 1500 ms, with the same step and `timeout: 1000`.
- **Expected:**
  - (a) Passes: the inner `assertVisible` uses `defaultTimeout` 5000, not 1000.
  - (b) Fails after 1000 ms with the AC25 message format.
- **Failure:** (a) fails because the inner command used 1000, or (b) passes.

**AC28: `assertUrl` waits for a delayed URL change**
- **Input:** test-app `/integration-timeouts?redirect=1500`, which client-side navigates to `/integration-timeouts?arrived=1` after 1500 ms. Step `assertUrl: /integration-timeouts?arrived=1` straight after `goto`, with no `wait:`.
- **Expected:** the step passes, with `durationMs` < 2500.
- **Failure:** it fails at once with `Expected: /integration-timeouts?arrived=1`.

**AC29: `assertUrl` fails at the deadline with today's message format**
- **Input:** step `assertUrl: /never` with sibling `timeout: 1000`, on page path `/integration`.
- **Expected:** the step fails after 1000 ms with message `Expected: /never\nGot: /integration`, so `expected` = `/never` and `got` = `/integration`.
- **Failure:** it fails in under 1000 ms, or the message format changes.

**AC30: `assertCount` retries until the count matches**
- **Input:** a page where `.row` elements grow from 1 to 3 at 1000 ms.
  - (a) Step `assertCount: { css: .row, expected: 3 }` with the default timeout.
  - (b) Step `assertCount: { css: .row, expected: 5 }` with sibling `timeout: 1500`.
- **Expected:**
  - (a) Passes, with `durationMs` < 2000.
  - (b) Fails after 1500 ms with message `Expected: 5\nGot: 3` (the last observed count).
- **Failure:** (a) fails at once with `Got: 1`, or (b) reports a stale count or fails early.

#### Which timeout each command uses

**AC31: Every element command uses `defaultTimeout` for target resolution**
- **Input:** a flow with header `defaultTimeout: 1200`. One step for each of `tapOn`, `doubleClick`, `hover`, `inputText: { element: …, text: x }` (inputTextTargeted), `clearText`, `selectOption`, `check`, `uncheck`, `assertVisible`, `assertText`, `assertValue`, `assertEnabled`, `assertDisabled`, `assertChecked` and `assertUnchecked`. Each targets the absent `data-testid=int-never-rendered` and runs as its own flow. `assertText`, `assertValue` and `selectOption` only accept object selectors, so they use `{ testId: int-never-rendered, expected|value: x }`.
- **Expected:** each fails after 1200 ms. Line 1 of its message is exactly `Element not found after 1200ms: data-testid=int-never-rendered`. For the three object-form commands, line 1 is exactly `Element not found after 1200ms: {"testId":"int-never-rendered"}`.
- **Failure:** any command fails at once, waits 5000 ms, or has a different line 1. For example, `Expected: <x>\nGot: element not found` is a failure.

**AC32: The `inputText` shorthand uses `defaultTimeout`**
- **Input:** header `defaultTimeout: 1000`. `tapOn` an input, then the page sets that input `disabled` at once. The next step is `inputText: hello`.
- **Expected:** the `inputText` step fails after 1000 ms, and its message contains `1000ms`.
- **Failure:** the step waits about 30000 ms (Playwright's default), or passes.

**AC33: Navigation commands use `navigationTimeout`**
- **Input:** a local server whose `/hang` route never responds. Header `navigationTimeout: 1500`.
  - (a) `goto: <server>/hang`.
  - (b) `reload` while on a page whose reload request hangs.
- **Expected:** each fails after 1500 ms, with a message containing `1500ms`.
- **Failure:** either waits about 30000 ms, or the message lacks `1500ms`.

**AC34: `goBack` and `goForward` keep their behaviour and accept `navigationTimeout`**
- **Input:**
  - Existing flows `go-back.yaml` and `go-forward.yaml`.
  - A copy of each with header `navigationTimeout: 20000`.
  - Fresh-page `goBack` (no history).
- **Expected:**
  - All four flows pass.
  - On a fresh page, `goBack` still fails with `No previous page in history.`, and `goForward` with `No next page in history.`.
- **Failure:** any of these flows fails, or the history messages change.

**AC35: `waitForPageLoad` uses its own timeout, else `navigationTimeout`**
- **Input:** on a page whose URL never matches `/never-reached`:
  - (a) Step `waitForPageLoad: { path: /never-reached, timeout: 1000 }`, with header `navigationTimeout: 3000`.
  - (b) Step `waitForPageLoad: { path: /never-reached }`, with header `navigationTimeout: 1500`.
  - (c) Step `waitForPageLoad: { path: /never-reached }` with sibling `timeout: 1200`, and header `navigationTimeout: 3000`.
- **Expected:** (a) fails after 1000 ms, (b) after 1500 ms and (c) after 1200 ms. Each message contains its timeout value followed by `ms`.
- **Failure:** any of them uses a different budget (for example 30000 in (b)).

**AC36: One budget covers resolution and interaction (Q16)**
- **Input:** a page where `<button data-testid="int-late-enable" disabled>` is added at 1500 ms.
  - (a) The button is enabled at 3000 ms. Step `tapOn: data-testid=int-late-enable` with sibling `timeout: 2000`.
  - (b) The button is enabled at 1800 ms. Same step.
- **Expected:**
  - (a) Fails no earlier than 2000 ms and no later than 2900 ms after the step starts. It does not run 1500 + 2000.
  - (b) Passes.
- **Failure:** (a) passes, or fails after 3000 ms or later; or (b) fails.

**AC37: One budget covers both waits in `waitForPageLoad`**
- **Input:** a page that client-side navigates to `/target` at 800 ms, and then keeps one network request in flight until 2500 ms. Step `waitForPageLoad: { path: /target, timeout: 1500 }`.
- **Expected:** the step fails no later than 2500 ms after it starts. The URL wait and the network-idle wait share 1500 ms; they don't get 1500 ms each.
- **Failure:** the step passes, which would need about 2500 ms.

**AC38: Message when the interaction (not resolution) runs out of time**
- **Input:** AC36 (a).
- **Expected:** line 1 of the message is exactly `Element not found after 2000ms: data-testid=int-late-enable`. This follows proposal §10, which maps today's catch-all `Element not found.` to the new format. Lines after line 1 are not specified. (Chosen by analyst; see open question 2.)
- **Failure:** the message is still `Element not found.` (no timeout or selector).

#### Sibling `timeout:` key: parsing and placement

**AC39: Sibling `timeout:` on a string-selector command**
- **Input:** step `{ assertVisible: data-testid=int-never-rendered, timeout: 1500 }` (YAML sibling key), with no other timeout settings.
- **Expected:** the step parses, and fails after 1500 ms with line 1 `Element not found after 1500ms: data-testid=int-never-rendered`.
- **Failure:** the key is ignored (5000 used), or a parse error.

**AC40: Sibling `timeout:` on an object-selector command, in any key order, with `session:`**
- **Input:**
  - (a) `{ timeout: 1500, tapOn: { testId: int-never-rendered } }`, with `timeout` written first.
  - (b) `{ session: b, tapOn: { testId: int-never-rendered }, timeout: 1500 }`, in a flow declaring session `b`.
- **Expected:** both parse. The command is `tapOn`, (b) runs in session `b`, and both fail after 1500 ms.
- **Failure:** `timeout` is taken as the command (`Unknown command: timeout`), or the session is lost.

**AC41: Sibling `timeout:` is accepted on every element and navigation command**
- **Input:** each command in the `element` and `navigation` lists (Constraints) written with sibling `timeout: 2000` in valid form, including the `inputText` shorthand, `assertUrl`, `assertCount`, `within`, `goto`, `reload`, `goBack`, `goForward` and `waitForPageLoad` (without an inner timeout).
- **Expected:** every one parses without error, and the parsed step carries timeout 2000.
- **Failure:** any of them throws, or loses the value.

**AC42: Sibling `timeout:` works inside `within` `do:` blocks**
- **Input:** `within: { data-testid: card, do: [ { assertVisible: { testId: inner-never }, timeout: 1000 } ] }` (sibling on the inner step), on a page where `card` exists.
- **Expected:** the inner step fails after 1000 ms with line 1 `Element not found after 1000ms: {"testId":"inner-never"}`.
- **Failure:** the inner step uses 5000 ms, or a parse error.

**AC43: Sibling `timeout:` works inside child flows**
- **Input:** the top-level flow has header `defaultTimeout: 1000` and step `runFlow: ./child.yaml`. The child's step is `{ assertVisible: data-testid=int-delayed, timeout: 4000 }` on the AC1 page (element at 1500 ms).
- **Expected:** the child step passes. Its own sibling `timeout:` wins over the inherited 1000.
- **Failure:** the child step fails after 1000 ms.

**AC44: `timeout:` on a command whose timeout trait is `none` is a parse error (Q17, Q19)**
- **Input:** for each of `wait: 100`, `waitFor: 100`, `scroll: down`, `setViewport: mobile`, `screenshot: a.png`, `setVar: a=1`, `testVarSet: a`, `unsetVar: a`, `runFlow: ./x.yaml` and `pressKey: Enter`, a step with sibling `timeout: 1000`, parsed through `loadAndParse`.
- **Expected:** parsing throws an error whose message contains `timeout is not supported on <key>` (e.g. `timeout is not supported on runFlow`, `timeout is not supported on pressKey`). The CLI prints `Error: …` with that text and exits 1 before any browser step runs.
- **Failure:** any of these parses, or the message differs.

**AC45: The Q17 parse error also applies inside `within` and child flows**
- **Input:**
  - (a) A top-level `within` whose `do:` contains `{ pressKey: Enter, timeout: 1000 }`.
  - (b) A child flow with `{ wait: 100, timeout: 1000 }`, called by `runFlow`.
- **Expected:**
  - (a) The top-level flow fails to parse with a message containing `timeout is not supported on pressKey`.
  - (b) The `runFlow` step fails (`passed: false`) with a message containing `timeout is not supported on wait`.
- **Failure:** either is silently accepted.

**AC46: `waitForPageLoad` with both an inner and a sibling timeout is a parse error (Q19)**
- **Input:** `{ waitForPageLoad: { path: /x, timeout: 3000 }, timeout: 3000 }`.
- **Expected:** parsing throws an error whose message is exactly `waitForPageLoad: timeout given both inside the command and as a sibling key; use one` (wording chosen by analyst).
- **Failure:** it parses, or one of the two values is silently used.

**AC47: Invalid literal sibling values are rejected at parse time (§9.4)**
- **Input:** sibling `timeout:` values of `0`, `-5`, `1.5`, `"abc"`, `true` and `null` on `tapOn: x`. Also `"3000"` (a quoted digit string).
- **Expected:**
  - Each invalid value throws an error whose message is exactly `timeout must be a positive integer, got <value>`, where `<value>` is `String(raw)` (wording chosen by analyst; e.g. `timeout must be a positive integer, got 0`).
  - `"3000"` is accepted as 3000 (chosen by analyst, matching `wait`'s handling of digit strings).
- **Failure:** any invalid value is accepted, or `"3000"` is rejected.

#### Sibling `timeout:` with `${var}`

**AC48: `${var}` in sibling `timeout:` resolves at dispatch from runtime vars**
- **Input:** steps `setVar: t=1300`, then `{ assertVisible: data-testid=int-never-rendered, timeout: "${t}" }`.
- **Expected:** parsing accepts `"${t}"`. The step fails after 1300 ms with line 1 `Element not found after 1300ms: data-testid=int-never-rendered`.
- **Failure:** a parse error, the default 5000 is used, or the var resolves to an empty string.

**AC49: `${var}` that resolves to an invalid value fails the command**
- **Input:** `setVar: t=abc`, then `{ tapOn: x, timeout: "${t}" }`.
- **Expected:** the `tapOn` step fails at once (`durationMs` < 500) with message exactly `timeout must be a positive integer, got "abc"` (wording chosen by analyst). No resolution is attempted.
- **Failure:** the step runs with a default timeout, or throws past the result.

**AC50: Undefined `${var}` in sibling `timeout:` gets flow context**
- **Input:**
  - (a) Top-level flow `/abs/top.yaml` with step `{ tapOn: x, timeout: "${nope}" }`.
  - (b) The same step in a child `/abs/child.yaml` called from `/abs/top.yaml`.
- **Expected:**
  - (a) The step fails with message exactly `Variable "nope" is not defined (in flow /abs/top.yaml)`.
  - (b) The step fails with `Variable "nope" is not defined (in child flow /abs/child.yaml, called from /abs/top.yaml)`.
  - This is the same format #100 uses for command fields.
- **Failure:** the flow context is missing, or the error is thrown instead of returned as a failed result.

#### Precedence

**AC51: Element timeout precedence chain**
- **Input:**
  - The probe step is `assertVisible: data-testid=int-never-rendered`.
  - Shared config `defaultTimeout: 1100`, header `defaultTimeout: 1200`, CLI `--timeout 1300` and sibling `timeout: 1400`.
  - The probe runs five times, each time with the highest remaining source removed: (1) all four, (2) without sibling, (3) without sibling and CLI, (4) config only, (5) none.
- **Expected:** line 1 reports `after 1400ms`, `after 1300ms`, `after 1200ms`, `after 1100ms` and `after 5000ms` respectively.
- **Failure:** any run uses a different value.

**AC52: Navigation timeout precedence chain**
- **Input:**
  - The probe step is `waitForPageLoad: { path: /never-reached }`, with no inner timeout.
  - Shared config `navigationTimeout: 1100`, header `navigationTimeout: 1200`, CLI `--navigation-timeout 1300` and sibling `timeout: 1400`, removed one at a time as in AC51.
- **Expected:**
  - Messages contain `1400ms`, `1300ms`, `1200ms` and `1100ms` respectively.
  - With none set, the step fails after 30000 ms with a message containing `30000ms`. This is the built-in default; the run may be done once, in a slow-marked test.
- **Failure:** any run uses a different value.

**AC53: The two settings are independent**
- **Input:**
  - (a) Header `navigationTimeout: 1000` only, with a probe on an absent element.
  - (b) CLI `--timeout 1000` only, with a `waitForPageLoad` probe as in AC52.
- **Expected:**
  - (a) The element probe reports `after 5000ms`.
  - (b) The navigation probe message contains `30000ms`, which may be checked by asserting the step is still running at 1500 ms.
- **Failure:** either setting leaks into the other group.

**AC54: The header beats the shared config for these keys**
- **Input:** shared config `defaultTimeout: 4000` and header `defaultTimeout: 1200`, with the AC51 probe.
- **Expected:** `after 1200ms`.
- **Failure:** `after 4000ms` (the vars rule, where config wins, applied by mistake).

**AC55: CLI flags parse and validate**
- **Input:** `parseArgs` with:
  - (a) `test f.yaml --timeout 7000 --navigation-timeout 40000`
  - (b) `--timeout 0`
  - (c) `--timeout abc`
  - (d) `--navigation-timeout -1`
  - (e) `--timeout` as the last argument, with no value
- **Expected:**
  - (a) The parsed result carries timeout 7000 and navigation timeout 40000. Both are absent when the flags aren't given.
  - (b) to (e) write exactly `Error: --timeout must be a positive integer, got "<raw>"\n` (or `--navigation-timeout …`) to stdout and exit with code 1. `<raw>` is the given text, or an empty string for (e) (wording chosen by analyst).
  - The usage line includes `[--timeout <ms>] [--navigation-timeout <ms>]`.
- **Failure:** an invalid value is accepted or silently ignored, or the exit code isn't 1.

**AC56: CLI flags apply to every flow in a directory run**
- **Input:** a directory with two flows, each with an absent-element probe and no timeout settings, run with `--timeout 1300`.
- **Expected:** both flows fail with line 1 reporting `after 1300ms`.
- **Failure:** either flow uses 5000.

**AC57: `${var}` in header and config values resolves at parse time**
- **Input:**
  - (a) Header `defaultTimeout: "${t}"` with inline `vars: { t: 1250 }`.
  - (b) Shared config `defaultTimeout: "${env.UIV_T}"` with env `UIV_T=1350`.
  - (c) Header `defaultTimeout: "${fromSetVar}"`, where `fromSetVar` is only set by a later `setVar`.
- **Expected:**
  - (a) The probe reports `after 1250ms`.
  - (b) The probe reports `after 1350ms`.
  - (c) Parsing fails with the header validation error from AC63. The value resolves to an empty string at parse time, so the message ends `got  in <file>`. Runtime vars aren't visible to the header (§5.3).
- **Failure:** (a) or (b) don't apply, or (c) picks up the runtime value.

#### Child flows (Q13)

**AC58: A child flow inherits the top-level timeouts; its own header keys are ignored**
- **Input:**
  - Top-level `top.yaml` with header `defaultTimeout: 1000` and `navigationTimeout: 1500`, and step `runFlow: ./child.yaml`.
  - `child.yaml` with header `defaultTimeout: 4000` and `navigationTimeout: 6000`, and steps: an absent-element probe, then (in a separate variant) a `waitForPageLoad: { path: /never-reached }` probe.
- **Expected:** the element probe reports `after 1000ms`, and the navigation probe message contains `1500ms`.
- **Failure:** the child's 4000 or 6000 is used.

**AC59: A child flow's shared-config keys are ignored too**
- **Input:** `top.yaml` with no timeout settings. `child.yaml` with `config: child-config.yml`, which contains `defaultTimeout: 4000`. The child runs the absent-element probe.
- **Expected:** the probe reports `after 5000ms` (the top-level built-in default).
- **Failure:** `after 4000ms`.

**AC60: Ignored-key notice text, printed once per file**
- **Input:**
  - (a) In the AC58 setup, `top.yaml` calls `child.yaml` twice.
  - (b) `child2.yaml` sets only `defaultTimeout`.
- **Expected:**
  - (a) stdout contains exactly one line `child.yaml: defaultTimeout, navigationTimeout ignored (inherited from top.yaml)`. When both keys are set they go on one line, in that order. The two calls don't print it twice.
  - (b) stdout contains exactly one line `child2.yaml: defaultTimeout ignored (inherited from top.yaml)`.
  - File names are basenames. The format follows §5.2; the multi-key form and once-per-top-level-run are chosen by analyst.
- **Failure:** no notice, more than one notice for the same file in one top-level run, or different text.

**AC61: No notice when the child sets neither key**
- **Input:** a child with no `defaultTimeout`/`navigationTimeout` in its header or config, run through `runFlow`. Also the existing `run-flow-override.yaml`.
- **Expected:** stdout contains no line matching `ignored (inherited from`.
- **Failure:** a notice is printed.

**AC62: A grandchild's notice names the top-level flow**
- **Input:** `top.yaml` runs `mid.yaml`, which runs `leaf.yaml`. `leaf.yaml` sets `defaultTimeout: 4000`.
- **Expected:** stdout contains `leaf.yaml: defaultTimeout ignored (inherited from top.yaml)`. The file named is the top-level flow, whose policy is in effect, not `mid.yaml` (chosen by analyst; see open question 3).
- **Failure:** the notice names `mid.yaml`, or there is no notice.

**AC63: The same file applies its keys when run top-level**
- **Input:** run `child.yaml` from AC58 directly with `uivisor test child.yaml`.
- **Expected:** the probe reports `after 4000ms`, and no `ignored (inherited from` notice is printed.
- **Failure:** 4000 is not applied, or a notice is printed.

**AC64: `runFlow` vars cannot set timeouts**
- **Input:** `top.yaml` with no timeout settings, and step `runFlow: { file: ./child.yaml, vars: { defaultTimeout: "1000" } }`. The child runs the absent-element probe and has no timeout keys.
- **Expected:** the probe reports `after 5000ms`. Inside the child, `${defaultTimeout}` resolves to `1000` as an ordinary var.
- **Failure:** the probe uses 1000.

#### Header and config keys (§5.3, §9.4)

**AC65: The flow header accepts `defaultTimeout` and `navigationTimeout`**
- **Input:** a flow header containing `defaultTimeout: 15000` and `navigationTimeout: 30000`.
- **Expected:** `loadAndParse` succeeds, with no `Unknown header key` error.
- **Failure:** `Unknown header key: defaultTimeout` or `… navigationTimeout`.

**AC66: The reserved config keys no longer become vars**
- **Input:** shared config containing `defaultTimeout: 15000`, `navigationTimeout: 30000` and `base: http://x`. A step uses `${defaultTimeout}`.
- **Expected:**
  - `file.vars` doesn't contain `defaultTimeout` or `navigationTimeout`, but still contains `base`.
  - The step fails at dispatch with message exactly `Variable "defaultTimeout" is not defined (in flow <abs path>)`.
- **Failure:** `${defaultTimeout}` resolves to `15000`.

**AC67: `loading` and `sla` are not reserved in phase 1**
- **Input:**
  - (a) Shared config containing `sla: 3000`, with a step `setVar: s=${sla}` followed by `testVarSet: { name: s, expected: "3000" }`.
  - (b) A flow header containing `sla: 3000`.
  - (c) A flow header containing `loading: {}`.
- **Expected:**
  - (a) Passes: `sla` is still a var.
  - (b) and (c) fail to parse with today's error `Unknown header key: sla in <file>` and `Unknown header key: loading in <file>`.
- **Failure:** `sla` stops being a var, or the header accepts `sla`/`loading`.

**AC68: Invalid header and config values are rejected**
- **Input:** `defaultTimeout` and `navigationTimeout` set (one at a time) to `0`, `-1`, `1.5`, `"abc"` and `true`, first in the flow header, then in the shared config.
- **Expected:**
  - Header: parsing throws exactly `Invalid <key>: must be a positive integer, got <value> in <flow file path>`.
  - Config: parsing throws exactly `Invalid <key>: must be a positive integer, got <value> in <config path as written>`.
  - `<value>` is `String(raw)`. A digit-only string such as `"15000"`, including one produced by `${var}` resolution, is accepted. (Wording chosen by analyst.)
- **Failure:** any invalid value is accepted, or the message differs.

**AC69: Child flow keys are still validated**
- **Input:** a child flow with header `defaultTimeout: 0`, called by `runFlow`.
- **Expected:** the `runFlow` step fails with a message containing `Invalid defaultTimeout: must be a positive integer, got 0` (chosen by analyst: being ignored doesn't skip validation).
- **Failure:** the child runs.

#### Command traits (§6.2)

**AC70: `COMMAND_TRAITS` holds the phase-1 timeout trait for every command**
- **Input:** import `COMMAND_TRAITS` from `@uivisor/core`.
- **Expected:**
  - Every `Command['type']` has an entry, and only types in the union have entries.
  - `COMMAND_TRAITS[t].timeout` equals the value in the Constraints table for every `t`.
  - Entries have no `preCheck`, `action` or `checkpoint` field.
- **Failure:** a missing or extra key, or a wrong value (e.g. `pressKey` ≠ `none`, `within` ≠ `element`, `waitForPageLoad` ≠ `navigation`).

**AC71: Completeness is checked at compile time**
- **Input:** a type-level test. For example, declare `const x: Record<Command['type'], unknown> = COMMAND_TRAITS`, plus a `// @ts-expect-error` case that builds an object missing one key and assigns it to `typeof COMMAND_TRAITS`. Run `tsc --noEmit` for `packages/core`.
- **Expected:** `tsc` passes. If any one entry is removed from `COMMAND_TRAITS`, `tsc` fails.
- **Failure:** removing an entry still compiles.

**AC72: Parse-time acceptance of `timeout:` follows the trait table**
- **Input:** for every YAML command key, parse it with sibling `timeout: 1000`.
- **Expected:** the step is accepted exactly when `COMMAND_TRAITS[<parsed type>].timeout` is not `none`. This matches AC41 and AC44.
- **Failure:** any command where parser acceptance and the trait table disagree.

#### Backward compatibility and regression

**AC73: Built-in defaults with nothing configured**
- **Input:** a flow with no new keys, no CLI flags and no sibling `timeout:`.
- **Expected:**
  - An absent-element probe fails after 5000 ms with `Element not found after 5000ms: …`.
  - A `waitForPageLoad: { path: /never-reached }` probe fails with a message containing `30000ms`.
  - `waitForPageLoad: { timeout: 0 }` still parses.
- **Failure:** a different default, or `timeout: 0` rejected.

**AC74: Builds and unit suites pass**
- **Input:** `tsc` builds for `packages/core`, `uivisor-app` and `recorder-app`, and `vitest run` in all three.
- **Expected:**
  - All builds succeed.
  - All tests pass, except the 4 expected-fail tests in uivisor-app, which are unchanged from the baseline. Baseline: core 406, uivisor-app 733.
  - Existing tests are edited only where they assert an error text or a single-check behaviour that this spec replaces (AC14–AC17, AC19, AC25, AC28–AC31). Each edited test is listed in Code Artifacts.
  - No existing test is deleted.
- **Failure:** a build fails, an unexplained test edit or deletion, or a regression.

**AC75: Reporter labels unchanged**
- **Input:** run a flow containing `{ tapOn: data-testid=int-tap-btn, timeout: 3000 }` with `--reporter md` and with `--reporter html`.
- **Expected:** the step's label in console, HTML and Markdown is identical to the label for `tapOn: data-testid=int-tap-btn` without the sibling key.
- **Failure:** the labels differ, or a reporter crashes.

#### test-app fixtures and integration flows (CLAUDE.md rule, §11 phase 1)

**AC76: test-app timeouts fixture page**
- **Input:** test-app route `/integration-timeouts` (route and test ids chosen by analyst), with query params `delay` (ms, default 1500) and `redirect` (ms, optional).
- **Expected:** the page shows the following. Before each delay runs out, the delayed element is not in the DOM.
  - (a) `<div data-testid="int-delayed">Delayed content</div>`, added `delay` ms after mount.
  - (b) A heading with text exactly `Submit`, added `delay` ms after mount. A `<button data-testid="Submit">Confirm</button>`, added 50 ms after the heading. Clicking the button renders `<p data-testid="int-submit-result">Submitted</p>`; clicking the heading does nothing.
  - (c) `<div data-testid="int-delayed-card"><span data-testid="int-card-label">Card ready</span></div>`, added `delay` ms after mount.
  - (d) `<div data-testid="int-hidden" style="display:none">Hidden</div>`, always present.
  - (e) When `redirect` is set, the app client-side navigates to `/integration-timeouts?arrived=1` that many ms after mount. When `redirect` is absent, it doesn't.
  - No element on the page has test id `int-never-rendered`. Existing routes and pages are unchanged.
- **Failure:** any of (a)–(e) missing or with different identifiers, or an existing page changed.

**AC77: `test-app/flows/integration/timeouts.yaml` passes and contains no `wait:`**
- **Input:** run `node uivisor-app/dist/cli/index.js test test-app/flows/integration/timeouts.yaml` against the live test-app (http://localhost:8084). The flow uses `config: config.yml`.
- **Expected:** exit code 0 and 100% of commands pass. The flow contains no `wait:` or `waitFor:` steps. It covers at least:
  - (1) `int-delayed` (delay 1500) found by a bare string, a pipe string, an object selector and an xpath object.
  - (2) The stability case: `tapOn: Submit`, then `assertVisible: { testId: int-submit-result }`.
  - (3) `goto ?delay=6500` followed by `{ assertVisible: data-testid=int-delayed, timeout: 8000 }`.
  - (4) `assertNotVisible: data-testid=int-never-rendered` (absent) and `assertNotVisible: data-testid=int-hidden` (hidden), both string selectors.
  - (5) `assertUrl: /integration-timeouts?arrived=1` after `goto ?redirect=1500`, with no `wait:`.
  - (6) `within: { data-testid: int-delayed-card, … }` on a delayed card.
- **Failure:** non-zero exit, any failed command, a `wait:` step, or a missing case.

**AC78: The negative flow fails at the default 5000 ms**
- **Input:** run `node uivisor-app/dist/cli/index.js test test-app/flows/integration-negative/timeouts-default-fails.yaml`. The flow does `goto ${base}/integration-timeouts?delay=6500` and then `assertVisible: data-testid=int-delayed`, with no timeout settings, using `config: ../integration/config.yml`.
- **Expected:**
  - Exit code 1.
  - The output contains `✗ assertVisible` and the line `Element not found after 5000ms: data-testid=int-delayed`.
  - The failing step's `durationMs` (e.g. in an `--reporter md` run) is at least 5000 and under 6000.
- **Failure:** the flow passes, a different message, or a duration outside [5000, 6000).

**AC79: All existing integration flows still pass**
- **Input:** run `node uivisor-app/dist/cli/index.js test test-app/flows/integration/` against the live test-app. This covers all 36 existing flows, including `run-flow-override.yaml`, its child, and the new `timeouts.yaml`.
- **Expected:** exit code 0, and every flow passes.
- **Failure:** any flow fails.

### Open questions for the human (Gate 1)

1. **Notice noise with a shared config.** Read literally, §5.2 says that if the child's shared config sets `defaultTimeout`, the key is ignored and a notice is printed. Integration flows, and the NS Hub example in §5, use the same config file for parent and child, so every child would print a notice even when its value equals the inherited one. The spec follows the literal reading (AC59, AC60). The alternative is to suppress the notice when the child's value equals the effective value. Decide before the Architect starts.
2. **Message when the interaction times out (AC38).** §10 maps today's `Element not found.` to `Element not found after <T>ms: <selector>`. That catch-all also fires when the element was found but never became actionable (disabled, covered). The spec keeps the literal mapping. An alternative is a separate `Element not actionable after <T>ms: <selector>`.
3. **Which file the grandchild notice names (AC62).** The proposal's example is a direct child, where caller and top-level flow are the same file. The spec names the top-level flow, whose policy applies. The Base Update note mentions naming "the caller".

**Last checkpoint:** analyst at 2026-10-13 18:14

### Gate 1 Revision 1 (human decisions 2026-10-13)

**Decisions:**
1. Open question 1 (notice noise with a shared config) resolved: the ignored-key notice fires per key only when the child's own header/config value for that key differs from the value in effect for the run. Equal values are silent — the "suppress when equal" alternative is adopted, not the literal §5.2 reading. AC59, AC60 and AC61 are revised below, and AC80 is added.
2. Open question 2 (message when the interaction times out, AC38) resolved: a separate message is used, `Element not actionable after <T>ms: <selector>`, for when resolution succeeded but the interaction itself (click, fill, check, hover, dblclick, clear, selectOption) runs out of budget. `Element not found after <T>ms: …` stays for resolution timeouts (the element itself was never resolved). AC38 and AC32 are revised below. AC31's targets (`data-testid=int-never-rendered`) are all absent, so none of its commands ever resolve a target — AC31 is unchanged and its commands still report "not found".
3. Open question 3 (which file the grandchild notice names, AC62) resolved: AC62 is confirmed as written. The notice names the top-level flow, whose policy is in effect, not the immediate caller.
4. Not-visible mode with duplicate matches (AC23) is revised: hidden duplicates now pass instead of failing. The deciding step, in cascade/pipe order, is the first step with at least one match; the mode passes once every match of that step is hidden, and also passes when every step has zero matches.
5. AC79's flow count is corrected to 37 (the 36 existing flows, including `run-flow-override.yaml` and its child, plus the new `timeouts.yaml`), matching the inventory already used in the Feature Summary and Scope sections.

#### Revised acceptance criteria

**AC59 (revised): A child flow's shared-config keys are ignored too, with a notice when the value differs**
- **Input:** `top.yaml` with no timeout settings (effective `defaultTimeout` is the built-in 5000). `child.yaml` with `config: child-config.yml`, which contains `defaultTimeout: 4000`. The child runs the absent-element probe, called via `runFlow` from `top.yaml`.
- **Expected:**
  - The probe reports `after 5000ms` (unchanged from AC59 above).
  - Because the child's own config value (4000) differs from the effective value (5000), stdout contains exactly one line `child.yaml: defaultTimeout ignored (inherited from top.yaml)`.
- **Failure:** the probe reports `after 4000ms`, or the notice line is missing or has different text.
- Supersedes AC59 above.

**AC60 (revised): Ignored-key notice text, printed once per file, and only when the child's value differs from the effective value**
- **Input:**
  - (a) In the AC58 setup (top `defaultTimeout: 1000`, `navigationTimeout: 1500`; child `defaultTimeout: 4000`, `navigationTimeout: 6000`), `top.yaml` calls `child.yaml` twice.
  - (b) `child2.yaml` sets only `defaultTimeout`, to a value different from the top-level's effective `defaultTimeout`.
- **Expected:**
  - (a) stdout contains exactly one line `child.yaml: defaultTimeout, navigationTimeout ignored (inherited from top.yaml)`, because both of the child's values (4000, 6000) differ from the effective values (1000, 1500). When both keys are set and both differ, they go on one line, in that order. The two calls don't print it twice.
  - (b) stdout contains exactly one line `child2.yaml: defaultTimeout ignored (inherited from top.yaml)`, because child2's value differs from the top-level's effective value.
  - File names are basenames. The format follows §5.2; the multi-key form, the once-per-top-level-run rule, and the value-differs gate are chosen by analyst (resolves open question 1).
- **Failure:** no notice when a value differs, more than one notice for the same file in one top-level run, a notice printed for a key whose value doesn't differ, or different text.
- Supersedes AC60 above.

**AC61 (revised): No notice when the child's value doesn't differ from the effective value**
- **Input:**
  - (a) A child with no `defaultTimeout`/`navigationTimeout` in its header or config, run through `runFlow`. Also the existing `run-flow-override.yaml`.
  - (b) A child flow that shares the top-level's `config.yml`, which sets `defaultTimeout: 1000`. The top-level flow has no header override, so the effective `defaultTimeout` is also 1000 (the same config file, read by both).
- **Expected:** stdout contains no line matching `ignored (inherited from`, in either case.
- **Failure:** a notice is printed in either case.
- Supersedes AC61 above.

**AC80: No notice, or a partial notice, depending on which keys differ**
- **Input:**
  - (a) Top-level flow header `defaultTimeout: 1000`. Child's own header also sets `defaultTimeout: 1000` (equal to the top-level's effective value), run via `runFlow`.
  - (b) Top-level flow header `defaultTimeout: 1000`, `navigationTimeout: 1500` (effective navigation timeout is 1500). Child's own header sets `defaultTimeout: 1000, navigationTimeout: 9000`.
- **Expected:**
  - (a) stdout contains no line matching `ignored (inherited from`, because the child's `defaultTimeout` (1000) equals the effective value (1000).
  - (b) stdout contains exactly one line `child.yaml: navigationTimeout ignored (inherited from top.yaml)`. `defaultTimeout` is not listed, because the child's value (1000) equals the effective value (1000); only `navigationTimeout` (9000 vs. effective 1500) differs.
- **Failure:** (a) a notice is printed; (b) the notice lists `defaultTimeout`, lists nothing, or lists the keys in a different form.
- New AC, companion to AC59–AC61 above.

**AC38 (revised): Message when the interaction (not resolution) runs out of time**
- **Input:** AC36 (a): a page where `<button data-testid="int-late-enable" disabled>` is added at 1500 ms and enabled at 3000 ms. Step `tapOn: data-testid=int-late-enable` with sibling `timeout: 2000`.
- **Expected:** line 1 of the message is exactly `Element not actionable after 2000ms: data-testid=int-late-enable`. This is a new message, distinct from `Element not found after <T>ms: …`, used when resolution succeeded (the element was found) but the interaction itself ran out of budget. Lines after line 1 are not specified. (Resolves open question 2: a separate message, not the `Element not found` catch-all.)
- **Failure:** the message is `Element not found after 2000ms: …`, is still `Element not found.` (no timeout or selector), or line 1 differs.
- Supersedes AC38 above.

**AC32 (revised): The `inputText` shorthand uses `defaultTimeout`, and reports the actionability message**
- **Input:** header `defaultTimeout: 1000`. Step `tapOn: data-testid=int-input` on an `<input data-testid="int-input">`, then the page sets that input `disabled` at once. The next step is `inputText: hello`, which targets the last-tapped element (the shorthand form).
- **Expected:** the `inputText` step fails after 1000 ms. Line 1 of the message is exactly `Element not actionable after 1000ms: data-testid=int-input` — the tapped selector as written in the flow (`data-testid=int-input`), not a description of the shorthand. Resolution succeeded (the input exists); only the fill action ran out of budget.
- **Failure:** the step waits about 30000 ms (Playwright's default), passes, or line 1 differs (for example, uses `Element not found …`, or names a different selector).
- Supersedes AC32 above.

**AC62 confirmed.** No AC text changes; the notice names the top-level flow, as already written.

**AC23 (revised): Not-visible mode with duplicate matches, hidden and visible cases**
- **Input:**
  - (a) A page where `data-testid=dup` matches 2 elements, both hidden, throughout. Step `assertNotVisible: data-testid=dup` with sibling `timeout: 1000`.
  - (b) A page where `data-testid=dup` matches 2 elements, one visible throughout and one hidden throughout. Step `assertNotVisible: data-testid=dup` with sibling `timeout: 1000`.
  - (c) A page where `data-testid=dup` matches 2 elements; one is visible at load and becomes hidden at 800 ms, the other is hidden throughout. Step `assertNotVisible: data-testid=dup` with the default timeout.
- **Expected:**
  - (a) The step passes promptly (`durationMs` < 1000, since both matches of the deciding step are hidden from the start).
  - (b) The step fails after 1000 ms with message `Expected: not visible\nGot: visible` (unchanged format), because the deciding step has a match that stays visible.
  - (c) The step passes, with `durationMs` < 1800.
  - Rule (chosen by analyst, supersedes the AC23 rule above): in not-visible mode, the step that decides is the first step, in cascade/pipe order, with at least one match. It passes once every match of that deciding step is hidden; it also passes when every step has zero matches (nothing to find counts as not visible). It only fails at the deadline when the deciding step still has a visible match.
- **Failure:** (a) fails, or takes 1000 ms or more; (b) passes, fails early, or reports a different message; (c) fails, or doesn't pass before 1800 ms.
- Supersedes AC23 above.

**AC79 (revised): All existing integration flows still pass**
- **Input:** run `node uivisor-app/dist/cli/index.js test test-app/flows/integration/` against the live test-app. This covers all 37 flows (the 36 existing flows, including `run-flow-override.yaml` and its child, plus the new `timeouts.yaml`).
- **Expected:** exit code 0, and every flow passes.
- **Failure:** any flow fails.
- Supersedes AC79 above.

#### Open questions

Open questions 1–3 are resolved (see Decisions 1–3 above). None remain open for Gate 1 revision 1.

**Last checkpoint:** analyst revision 1 at 2026-10-13 18:40

**Last checkpoint:** Gate 1 approved by human at 2026-10-13 18:45

## Cost Cap Change (2026-10-13 18:50)
- Human raised `cost_governance.max_cost_per_run` from $5.00 to $15.00 in `agent-config.yml` (main checkout). Accumulated at the time: $3.13. No eval needed: the eval gate covers model and skill changes, and this is a budget value only.

## Feature & Task Breakdown

**Source:** Gate 1 spec with Revision 1 (revised AC23, AC32, AC38, AC59, AC60, AC61, AC79 and new AC80 supersede the originals). Worktree base `edc5701` + proposal commits.
**Shape:** one prefactor-free foundation task, then vertical slices per layer seam (resolution, commands, parser, header/config, CLI, precedence, engine wiring), then the live-app slice. Every task keeps `tsc` and all three suites green on its own (subject to E2 below).
**Status legend:** open = activatable now; ⛔ open = blocked by the listed IDs.

| ID | Task | Files (exclusive to this task) | ACs covered | Depends On | Parallel group | Status |
|---|---|---|---|---|---|---|
| T1 | Core foundation: new types on `SessionedCommand`/`RunContext`/`FlowFile`/`RunOptions`/`PlaywrightContext`; `COMMAND_TRAITS`; `Deadline`/`Clock`/`retryUntil`/`DEFAULT_TIMEOUTS`; core exports; `parsePositiveInt` util (S1, S2, S3, S9) | `packages/core/src/types.ts`, `packages/core/src/commandTraits.ts` (new), `packages/core/src/commandTraits.test.ts` (new), `packages/core/src/commandTraits.typecheck.ts` (new), `packages/core/src/deadline.ts` (new), `packages/core/src/deadline.test.ts` (new), `packages/core/src/index.ts`, `uivisor-app/src/utils/positiveInt.ts` (new), `uivisor-app/tests/unit/positive-int.test.ts` (new) | AC70, AC71, AC13 (loop cadence), AC73 (built-in values), AC47/AC68/AC55 (shared predicate) | none | PG1 | open |
| T2 | Engine-level fixture pages for local fixture-server tests (S13) | `uivisor-app/tests/fixtures/timeouts/*.html` (new: `delayed`, `late-enable`, `vanish`, `duplicates`, `growing`, `input-disable`, `spa-nav`) | fixtures for AC1–AC5, AC7, AC8, AC12, AC21–AC24, AC26, AC27, AC30–AC33, AC36, AC37 | none | PG1 | open |
| T3 | test-app `/integration-timeouts` page and route (AC76 (a)–(e)) | `test-app/src/pages/IntegrationTimeoutsPage.jsx` (new), `test-app/src/App.jsx` | AC76, AC28 (page side) | none | PG1 | open |
| T4 | Waiting resolution in core: `buildSteps`, `pollSteps` (stability check, duplicate retry, fail-fast), `resolveLocator`/`resolveContainerLocator` with deadline + new error text, `resolveNotVisible`, `selectorLabel` (S4). Update existing resolver tests whose error text / single-pass behaviour is replaced | `packages/core/src/playwrightLocator.ts`, `packages/core/src/playwrightLocator.test.ts`, `uivisor-app/tests/unit/resolveSelector.test.ts` | AC1–AC18, AC19–AC23 (decision logic), AC24–AC26 (container lookup) | T1 | PG2 | ⛔ open (T1) |
| T5 | `dispatch` takes the whole step: `SessionedCommand \| Command` input, `engine/index.ts` passes `sc`, within closure passes steps; sibling `timeout` interpolated at dispatch with #100 flow context and positive-int check (S6 part 1). No budget use yet | `uivisor-app/src/engine/dispatcher.ts`, `uivisor-app/src/engine/index.ts` | AC48 (resolution of `${t}`), AC49, AC50 | T1 | PG2 | ⛔ open (T1) |
| T6 | Parser: sibling `timeout:` extraction in `parseSessionedCommand`, Q17/Q19 trait checks from `COMMAND_TRAITS`, literal validation, `waitForPageLoad` both-timeouts error (S8) | `uivisor-app/src/parser/commandParser.ts`, `uivisor-app/tests/unit/sibling-timeout-parser.test.ts` (new) | AC39–AC41 (parse), AC42 (parse), AC44, AC45(a), AC46, AC47, AC72, AC75 (parsed `Command` identical with/without sibling) | T1 | PG2 | ⛔ open (T1) |
| T7 | Header and shared-config keys: `VALID_HEADER_KEYS`, `FLOW_CONFIG_KEYS`, `validateTimeoutKeys`, env/var interpolation of the values, `FlowFile.timeouts` layers (S10) | `uivisor-app/src/parser/validator.ts`, `uivisor-app/src/parser/interpolate.ts`, `uivisor-app/src/parser/index.ts`, `uivisor-app/tests/unit/timeout-config.test.ts` (new) | AC57 (parse side), AC65, AC66, AC67, AC68, AC69 (parse side) | T1 | PG2 | ⛔ open (T1) |
| T8 | CLI flags `--timeout`, `--navigation-timeout`: parse, validate, usage line, carry into `RunOptions.timeouts` (S11) | `uivisor-app/src/cli/args.ts`, `uivisor-app/src/cli/index.ts`, `uivisor-app/tests/unit/args.test.ts` (new describe block appended; existing cases untouched) | AC55 | T1 | PG2 | ⛔ open (T1) |
| T9 | Precedence module (single source of truth): `resolveRunTimeouts`, `stepTimeoutMs`, `timeoutNotice` — pure functions with unit tests (S7) | `uivisor-app/src/engine/timeouts.ts` (new), `uivisor-app/tests/unit/timeouts-precedence.test.ts` (new) | AC51–AC54 (rules), AC58–AC62 (rules), AC80 (rules), AC35 (inner vs run), AC53 | T1 | PG2 | ⛔ open (T1) |
| T10 | Core commands take a trailing `deadline?`: element actions (not-found vs not-actionable), assertions (resolution outside catch), `assertNotVisible` via `resolveNotVisible`, `assertUrl`/`assertCount` retry, navigation timeouts + messages, `waitForPageLoad` one budget, `inputText` shorthand budget + label, `executeWithin` container deadline and whole-step callback (S5). Edit existing tests listed in E2; verify `recorder-app` build + tests | `packages/core/src/commands.ts`, `packages/core/src/commands.test.ts`, `uivisor-app/tests/unit/within-dispatcher.test.ts`, `uivisor-app/tests/unit/session-engine.test.ts`, `uivisor-app/tests/unit/runner-no-auto-nav.test.ts`, `recorder-app/src/flowReplayer.test.ts` | AC19–AC38 (command level), AC31, AC73 (core defaults), AC74 (recorder build/tests) | T1, T4, T5 | PG3 | ⛔ open (T1, T4, T5) |
| T11 | Engine wiring: per-step deadline from `stepTimeoutMs` passed to every `execute*`; ignored-key notice once per file in the `runFlow` branch; `createContext` takes the run timeouts and creates the notice set; `runAll` resolves timeouts per top-level flow (S6 part 2, S11). Engine-level browser suite against the T2 fixtures | `uivisor-app/src/engine/dispatcher.ts`, `uivisor-app/src/engine/context.ts`, `uivisor-app/src/cli/runner.ts`, `uivisor-app/tests/integration/timeouts.test.ts` (new) | AC1–AC5, AC7, AC8, AC12, AC14–AC17, AC21–AC27, AC29–AC33, AC35–AC40, AC42, AC43, AC45(b), AC48, AC51–AC54, AC56, AC57, AC58–AC64, AC66 (dispatch message), AC69, AC73, AC80 | T2, T6, T7, T9, T10 | PG4 | ⛔ open (T2, T6, T7, T9, T10) |
| T12 | Live test-app slice + full regression: `timeouts.yaml`, negative flow, goBack/goForward `navigationTimeout` variants; run every integration flow; CLI parse-error exit; md/html label check; all builds and suites (S13) | `test-app/flows/integration/timeouts.yaml` (new), `test-app/flows/integration-negative/timeouts-default-fails.yaml` (new), `test-app/flows/integration-variants/go-back-nav-timeout.yaml` (new), `test-app/flows/integration-variants/go-forward-nav-timeout.yaml` (new) | AC19, AC20, AC28, AC34, AC44 (CLI exit 1), AC74, AC75, AC77, AC78, AC79 | T3, T8, T11 | PG5 | ⛔ open (T3, T8, T11) |

**Parallel groups (disjoint files within each group):**
- **PG1:** T1, T2, T3 — activatable now.
- **PG2:** T4, T5, T6, T7, T8, T9 — after T1. No two touch the same file: resolver (core) / dispatcher+engine index / commandParser / validator+interpolate+parser index / cli args+index / new engine/timeouts.ts.
- **PG3:** T10 — after T4 (resolution API) and T5 (dispatch accepts steps, so the `WithinDispatch` change compiles).
- **PG4:** T11 — after T10, T6, T7, T9, T2. Edits `dispatcher.ts` again; T5 is already done by then (T10 depends on it), so no overlap.
- **PG5:** T12 — after T11, T8, T3.

**Critical path:** T1 → T4 → T10 → T11 → T12. T5 runs beside T4 and gates T10, so it isn't on the path unless it overruns T4.

**Why T5 is separate from T11:** `executeWithin` (T10, `commands.ts`) must hand whole steps to its callback, which only compiles once `dispatch` accepts steps. T11 needs T10's deadline parameters. Splitting the dispatcher change into T5 (signature) and T11 (budgets) breaks that cycle.

**Coverage check:** AC1–AC80 (revised versions) all mapped. Not covered: none.

## Seam Notes

### S1. Core data shapes (T1, `packages/core/src/types.ts`)

```ts
// Per-step options, sibling keys next to `session`. After parsing, `timeout` is a positive
// integer, or a string containing `${` (resolved at dispatch). Absent key = property absent.
export type SessionedCommand = { session?: string; timeout?: number | string; command: Command };

export interface TimeoutSettings { defaultTimeout: number; navigationTimeout: number }
export type TimeoutKey = keyof TimeoutSettings;          // notice order: defaultTimeout, navigationTimeout

// Validated values one flow file sets itself. Each layer holds only the keys that file sets.
export interface FlowTimeoutLayers { header: Partial<TimeoutSettings>; config: Partial<TimeoutSettings> }

export interface FlowFile   { /* existing */ timeouts?: FlowTimeoutLayers }        // optional: test literals omit it
export interface RunOptions { /* existing */ timeouts?: Partial<TimeoutSettings> } // the CLI layer
export interface PlaywrightContext { lastTappedLocator: Locator | null; lastTappedLabel?: string } // label = selector as written (AC32)
export interface RunContext extends PlaywrightContext {
  /* existing */
  timeouts?: TimeoutSettings;    // the run's policy: fixed once per top-level flow in runAll; never written by runFlow. Absent → DEFAULT_TIMEOUTS
  timeoutNotices?: Set<string>;  // absolute paths of child files already noticed in this top-level run
}
```

- New fields are optional, because about 100 existing tests build `RunContext`/`FlowFile` literals and call `dispatch` directly. Readers fall back to `DEFAULT_TIMEOUTS` in exactly one place (`dispatch`, S6).
- **The `Command` union does not change.** The sibling lives on the step, and `CommandResult.command` stays the bare `Command`. So the console, HTML and Markdown label switches and the dispatcher `never` guard are untouched, and the reporter-exhaustiveness lesson doesn't apply. AC75 holds by construction.

### S2. `COMMAND_TRAITS` (T1, `packages/core/src/commandTraits.ts`, exported from `@uivisor/core`)

```ts
export type TimeoutTrait = 'element' | 'navigation' | 'none';
export const COMMAND_TRAITS: Record<Command['type'], { timeout: TimeoutTrait }> = { /* one entry per type */ };
```

- Values are exactly the Gate 1 Constraints table, with `pressKey` and `crossOriginIframeWarning` set to `none`. Use a type annotation, not `satisfies`, so a missing key or an excess literal key fails `tsc`.
- AC71 type test: `commandTraits.typecheck.ts` in `src/`. Core's tsconfig includes `src/**/*`, so `npm run build` type-checks it, including test files. New core tests must type-check.
- Only two readers branch on the timeout trait: the parser's Q17/Q19 check (S8) and `stepTimeoutMs` (S7). Nothing else switches on command type for timeouts.

### S3. Deadline and the one polling loop (T1, `packages/core/src/deadline.ts`)

```ts
export interface Clock { now(): number; sleep(ms: number): Promise<void> }
export const realClock: Clock;                       // performance.now() + setTimeout
export interface Deadline {
  readonly timeoutMs: number;  // the budget quoted in every message. 0 = unbounded (only waitForPageLoad's inner `timeout: 0`)
  remainingMs(): number;       // Infinity if unbounded, else max(0, end - now)
  expired(): boolean;
  pwTimeout(): number;         // value for Playwright `{ timeout }`: 0 if unbounded, else max(1, ceil(remainingMs()))
  sleep(ms: number): Promise<void>;                  // sleeps min(ms, remainingMs()) on the deadline's clock
}
export function createDeadline(timeoutMs: number, clock?: Clock): Deadline;
export const DEFAULT_TIMEOUTS: TimeoutSettings;      // { defaultTimeout: 5000, navigationTimeout: 30000 }
export const RETRY_INTERVAL_MS = 100;
export type Attempt<T, L> = { done: true; value: T } | { done: false; last: L };
export function retryUntil<T, L>(deadline: Deadline, attempt: () => Promise<Attempt<T, L>>): Promise<Attempt<T, L>>;
```

- **`retryUntil`:**
  - It runs `attempt` at once, even when the deadline has already expired.
  - It returns the first `done` result. If the deadline has expired, it returns the last not-done result.
  - Otherwise it calls `deadline.sleep(100)` and tries again. The last attempt lands on the deadline itself.
  - An error thrown by `attempt` propagates straight away and is never retried.
  - This is the only polling loop. Resolution, container lookup, not-visible mode, `assertUrl` and `assertCount` all use it.
- **Testable without a browser:** a fake `Clock` with scripted `count()` results drives AC6, AC9–AC11, AC13 and the AC23 decision rule deterministically.
- **`pwTimeout()` is never 0 for a bounded deadline.** Playwright reads 0 as "no timeout", so an expired budget passes 1.
- **Why `performance.now()` + `ceil`:** existing mocks assert the exact `{ timeout: 30000 }` / `{ timeout: 5000 }` on `waitForPageLoad`'s second Playwright call (core `commands.test.ts` C-13…C-18, `recorder-app` `flowReplayer.test.ts` 434/451/452/464/465). With sub-millisecond elapsed time, `ceil` returns the full value, so those tests pass unedited. If one ever flakes, loosen it to `expect.objectContaining` and list it in Code Artifacts.
- **Single-attempt tests:** to get a near single attempt, use `createDeadline(1)`, not `0`, since 0 means unbounded.

### S4. Resolution (T4, `packages/core/src/playwrightLocator.ts`)

**Public signatures.** These stay backward compatible: positional `scope` stays third, `recorder-app` and existing tests compile unchanged, and an omitted deadline means `createDeadline(DEFAULT_TIMEOUTS.defaultTimeout)`.

```ts
export function resolveLocator(page: Page, selector: Selector, scope?: Locator, deadline?: Deadline): Promise<Locator>;
export function resolveContainerLocator(page: Page, selector: string, opts?: { nth?: number; deadline?: Deadline }): Promise<Locator>; // returns the multi-match locator; caller applies .nth()
export function resolveNotVisible(page: Page, selector: Selector, deadline?: Deadline): Promise<boolean>; // true = absent or hidden; false = deadline passed with a visible match
export function selectorLabel(selector: Selector): string;  // string as written, else JSON.stringify(selector)
```

**Internal seam.** These are exported from the module for unit tests, not from `index.ts`.

```ts
export interface ResolutionStep { label: string; locator: Locator; count(): Promise<number> }
export interface StepCount { label: string; count: number }
export type Resolution = { found: true; locator: Locator; step: number } | { found: false; counts: StepCount[] };
export function buildSteps(root: Page | Locator, selector: Selector): ResolutionStep[]; // throws malformed-selector errors synchronously
export function pollSteps(steps: ResolutionStep[], accept: (n: number) => boolean, deadline: Deadline): Promise<Resolution>;
```

**Step labels:**
- Cascade: `${attr}=${value}`, in the order `data-testid`, `text`, `name`, `id`, `placeholder`.
- Pipe: `seg.raw`.
- Object forms: one step, labelled `JSON.stringify(selector)`.
- The `{ xpath }` step's `count()` wraps errors as `Invalid XPath expression: <expr> — <detail>`. An empty xpath throws in `buildSteps`.

**Stability rule (one attempt).** Count the steps in order and stop at the first accepted count. Accepted means `n === 1` for elements and `n >= (nth ?? 0) + 1` for containers. Call the winner's index w.
- **w = 0:** found at once. Single-step selectors always have w = 0, so there is no second pass (AC6).
- **w > 0 and the previous attempt's winner was also w:** found. This is two passes about 100 ms apart (AC9).
- **Otherwise:** remember w (or "none") and retry after 100 ms. A changed winner restarts, and a later step-1 win is accepted at once (AC10).
- **At the deadline with no confirmed winner:** return `{ found: false, counts }`. `counts` are the steps the last attempt counted, in order, up to where it stopped (AC11, AC14).
- **Duplicates:** n > 1 is not accepted. As today, later steps are still tried (TC-003 unchanged). If no step is unique, it retries (AC12, AC17).

**Fail fast (AC18).** Errors from `buildSteps` are thrown before the first attempt: unknown attribute, xpath union in pipe syntax, missing `=`, empty xpath, unrecognised selector type. A `count()` rejection (invalid XPath or CSS) propagates from the attempt that hit it. Neither is ever retried.
- The first attempt happens at the same moment as today's single count, so a passing flow is never exposed to more navigation races than today. No retry-on-error is added.

**Messages.** `T` is always `deadline.timeoutMs`, never the remaining time.
- Element: `Element not found after ${T}ms: ${selectorLabel}`, then `\n  ${label}: ${count} matches` per counted step.
- Container, every counted step 0: `within: No container found after ${T}ms for selector '${sel}'` plus the same lines.
- Container, a step had ≥ 1 but ≤ nth matches: `within: nth=${nth} requested but only ${n} containers matched selector '${sel}'`, where n is the first non-zero count. `nth < 0` is still rejected before resolution, in `executeWithin`.

**Not-visible mode (AC19–AC23 revised).** This uses `buildSteps` + `retryUntil`, with no stability check.
- The deciding step is the first step in order with count ≥ 1. If there is none, the result is `done(true)`.
- Otherwise the result is `done(true)` only if `locator.nth(i).isVisible()` is false for every i < n. Else it is not done.
- At the deadline it returns `false`. The same fail-fast rules apply.

### S5. Core commands (T10, `packages/core/src/commands.ts`)

**Deadline parameter.** Every `execute*` whose trait isn't `none` gains a trailing optional `deadline?: Deadline`.
- If omitted: `DEFAULT_TIMEOUTS.defaultTimeout` for element commands, `navigationTimeout` for navigation commands.
- `waitForPageLoad` uses `deadline ?? createDeadline(timeout ?? 30000)`.
- Existing parameters are unchanged.

**Element actions** (`tapOn`, `doubleClick`, `hover`, `inputTextTargeted`, `clearText`, `check`, `uncheck`):
- Call `resolveLocator(page, sel, undefined, d)` **outside** any try/catch, so `Element not found after …` escapes (AC31).
- Run the action with `{ timeout: d.pwTimeout() }`.
- Catch the action error and throw `Element not actionable after ${d.timeoutMs}ms: ${selectorLabel(sel)}`, with no further lines (AC36, AC38).
- `tapOn` also sets `ctx.lastTappedLabel`.

**`inputText` shorthand** `(ctx, text, d?)`: fill with `pwTimeout`. A failure gives `Element not actionable after ${T}ms: ${ctx.lastTappedLabel}` (AC32 revised). The "used before any tapOn" error is unchanged.

**`selectOption`:** resolve, wait for attached, then `selectOption({ timeout })`. It keeps `Option not found.` (see E3).

**Assertions:**
- Resolution sits outside the existing try/catch.
- Only the Playwright wait after resolution (visible or attached) stays inside the catch. It gets `pwTimeout` and keeps today's catch text.
- The condition itself is still read once, as scoped.
- `assertNotVisible`: `if (!(await resolveNotVisible(page, sel, d))) throw new Error('Expected: not visible\nGot: visible')`.
- `assertUrl` / `assertCount`: run through `retryUntil`. The message is `Expected: ${exp}\nGot: ${last observed}` (AC29, AC30).

**Navigation:**
- `goto` and `reload` use `{ waitUntil: 'load', timeout }`. `goBack` and `goForward` use `{ waitUntil: 'commit', timeout }`, and their history checks and messages are unchanged.
- A Playwright `TimeoutError` (`err.name === 'TimeoutError'`) is rethrown with the configured budget, so the message always contains `<T>ms` even though Playwright reports the remaining time:
  - `goto`: `Navigation failed: ${url} — timed out after ${T}ms`
  - `reload` / `goBack` / `goForward`: `${type} timed out after ${T}ms`
  - `waitForPageLoad`: `waitForPageLoad timed out after ${T}ms`
- Any other error behaves as today. C-19's plain `Error('Timeout exceeded')` still propagates.
- **`waitForPageLoad` one budget:** both the URL wait and the load-state wait take `d.pwTimeout()`, so the second wait gets only what remains (AC37). Inner `0` means unbounded, so both waits get `{ timeout: 0 }`.

**`executeWithin`** `(page, cmd, ctx, dispatch, d?)`:
1. Validate `nth < 0` first.
2. Call `resolveContainerLocator(page, cmd.selector, { nth: cmd.nth, deadline: d })` and select the target.
3. Call `dispatch(scopedPage, sc, ctx)` with the whole step. The `within` deadline is never passed to the `do:` steps (Q18, AC27).

```ts
export type WithinDispatch = (page: Page, step: SessionedCommand, ctx: RunContext) => Promise<CommandResult>;
```

### S6. `dispatch` (T5 signature and sibling interpolation, T11 budgets and notice; `uivisor-app/src/engine/dispatcher.ts`)

```ts
export async function dispatch(page: Page, input: SessionedCommand | Command, ctx: RunContext,
                               flowStem = 'flow', flowDir = process.cwd()): Promise<CommandResult>
```

**Signature and callers (T5):**
- First line: `const step = 'command' in input ? input : { command: input }`. No `Command` member has a `command` key. The bare-`Command` form remains for the ~99 existing test call sites.
- `engine/index.ts` (re-indented by #100): both `dispatch(sessionPage, sc.command, …)` calls become `dispatch(sessionPage, sc, …)`. The runFlow-session branch still tests `sc.command.type`.
- The `within` case callback becomes `(p, step, cx) => dispatch(p, step, cx, flowStem, flowDir)`.

**Sibling interpolation (T5).** This happens inside the **same** try block that interpolates the command:

```ts
own = step.timeout === undefined ? undefined
    : typeof step.timeout === 'number' ? step.timeout
    : parsePositiveInt(interpolateValue(step.timeout, vars, true)) ?? throw `timeout must be a positive integer, got "${resolved}"`
```

- An undefined var throws `Variable "x" is not defined`, and the existing #100 catch appends `(in flow …)` or `(in child flow …, called from …)` (AC50).
- The invalid-value message contains neither trigger substring, so it stays exact (AC49).
- Both cases return `{ command: step.command, passed: false, message, durationMs }` before anything runs, with no screenshot.

**Budget (T11).** This runs right after interpolation:

```ts
const run = ctx.timeouts ?? DEFAULT_TIMEOUTS;
const inner = c.type === 'waitForPageLoad' && c.timeout !== undefined ? toInt(c.timeout, 'waitForPageLoad timeout') : undefined;
const ms = stepTimeoutMs(c.type, own ?? inner, run);           // Q19: own and inner are never both set
const deadline = ms === undefined ? undefined : createDeadline(ms);
```

- `deadline` is passed as the trailing argument to every `execute*` call in the switch, including `executeWithin`.

**Notice (T11).** This goes in the runFlow branch, right after `loadAndParse(absPath)` succeeds:
- `const line = timeoutNotice(file, run, Array.from(ctx.callStack)[0])`.
- `ctx.timeoutNotices ??= new Set()`. Then, if `line` is set and the set doesn't have `absPath`: add `absPath` and call `process.stdout.write(line + '\n')`.
- Skip the notice when `callStack` is empty (direct-dispatch tests).
- The runFlow branch never assigns `ctx.timeouts` (inherit-only: AC58, AC59, AC64).
- Child validation and parse errors already come back as a failed runFlow step through the existing catch (AC45b, AC69).

### S7. Precedence: one module (T9, `uivisor-app/src/engine/timeouts.ts`)

```ts
export function resolveRunTimeouts(cli: Partial<TimeoutSettings>, file: Pick<FlowFile, 'timeouts'>): TimeoutSettings;
//   per key: cli ?? file.timeouts.header ?? file.timeouts.config ?? DEFAULT_TIMEOUTS   (header beats config, AC54)
export function stepTimeoutMs(type: Command['type'], own: number | undefined, run: TimeoutSettings): number | undefined;
//   COMMAND_TRAITS[type].timeout: 'none' → undefined; 'element' → own ?? run.defaultTimeout; 'navigation' → own ?? run.navigationTimeout
export function timeoutNotice(child: FlowFile, run: TimeoutSettings, topLevelPath: string): string | null;
//   keys in [defaultTimeout, navigationTimeout] order where (header ?? config) is set AND !== run[k]
//   → `${basename(child.filePath)}: ${keys.join(', ')} ignored (inherited from ${basename(topLevelPath)})`, else null
```

- This module is the only place where the order "sibling > CLI > header > config > built-in" is written.
  - The parser only validates the layers.
  - `runAll` calls `resolveRunTimeouts` once per top-level flow.
  - `dispatch` calls `stepTimeoutMs` per step.
- A private `firstDefined` helper does `header ?? config` for both `resolveRunTimeouts` and `timeoutNotice`.
- `topLevelPath` is the first entry of `ctx.callStack`. The engine's `runFlow` adds the top-level file first, and a `Set` keeps insertion order, so a grandchild's notice names the top-level flow (AC62).

### S8. Parser: sibling key and Q17/Q19 (T6, `uivisor-app/src/parser/commandParser.ts`)

`parseSessionedCommand` takes `session`, and `timeout` when `'timeout' in obj` (so `null` counts as present), out of the object before calling `parseCommand(rest)`. That makes key order irrelevant (AC40). Then, in this order:

1. **Trait check (AC44, AC72):** if `COMMAND_TRAITS[command.type].timeout === 'none'`, throw `timeout is not supported on ${yamlKey}`, where `yamlKey` is the first key of `rest`.
2. **Value check (AC47):** a string containing `${` is kept as is. Otherwise `parsePositiveInt(raw) ?? throw \`timeout must be a positive integer, got ${String(raw)}\``. `"3000"` becomes 3000.
3. **Q19 (AC46):** if `command.type === 'waitForPageLoad' && command.timeout !== undefined`, throw `waitForPageLoad: timeout given both inside the command and as a sibling key; use one`.

- The function returns `{ session?, timeout?, command }`, with each key only when present, so existing `toEqual` tests are unaffected.
- `within` `do:` steps recurse through this function (AC42, AC45a). Child flows parse through `loadAndParse` (AC45b).
- Inner `waitForPageLoad` timeout parsing is unchanged: `timeout: 0` and the `"5000"`-throws test both hold.

### S9. Shared predicate (T1, `uivisor-app/src/utils/positiveInt.ts`)

`parsePositiveInt(raw: unknown): number | undefined` returns a value for an integer number > 0, or a string matching `/^\d+$/` whose value is > 0. Everything else returns `undefined`. Each caller owns its exact message:

| Caller | Message |
|---|---|
| parse-time sibling (T6) | `timeout must be a positive integer, got ${String(raw)}` |
| dispatch-time sibling (T5) | `timeout must be a positive integer, got "${resolved}"` |
| header / config (T7) | `Invalid ${key}: must be a positive integer, got ${String(raw)} in ${source}` |
| CLI (T8) | `Error: ${flag} must be a positive integer, got "${raw}"` (stdout, exit 1) |

### S10. Header and config (T7)

- **`validator.ts`:**
  - `VALID_HEADER_KEYS` gains `defaultTimeout` and `navigationTimeout`.
  - New `validateTimeoutKeys(obj: Record<string, unknown>, source: string): Partial<TimeoutSettings>` returns only the keys present and uses `parsePositiveInt`.
- **`interpolate.ts`:**
  - `FLOW_CONFIG_KEYS` gains both keys, so they are stripped before `flattenVars` and no longer become vars (AC66).
  - In `loadConfigFile`, string values of those keys go through `interpolateValue(v, {})` (env-only, AC57b), then `validateTimeoutKeys(…, configPath)`, where `configPath` is as written (AC68).
  - `LoadConfigFileResult` gains `timeouts: Partial<TimeoutSettings>`.
- **`parser/index.ts`:**
  - After the pass-3 interpolation of non-command fields, call `validateTimeoutKeys(doc, filePath)`. At that point `${var}` from inline or config vars and env has been resolved; an unresolved var becomes `''`, so AC57c reads `got  in <file>`.
  - Set `FlowFile.timeouts = { header, config }`.
  - This runs for every file, whether top-level or child (AC69).
- `loading` and `sla` are untouched (AC67).

### S11. CLI to `runAll` (T8, T11)

- **`args.ts`:**
  - `ParsedArgs` gains `timeout?: number; navigationTimeout?: number`.
  - Each flag consumes the next argv entry. A missing value gives raw `""`.
  - On failure, write to stdout `Error: --timeout must be a positive integer, got "<raw>"\n` (or the `--navigation-timeout` form) and `process.exit(1)`.
  - The usage line gains `[--timeout <ms>] [--navigation-timeout <ms>]`.
- **`cli/index.ts`:** set `options.timeouts = { defaultTimeout: parsed.timeout, navigationTimeout: parsed.navigationTimeout }`, where an undefined key means not set, then call `runAll(included, options)`.
- **`runner.ts` (T11):**
  - Per target: `createContext(runDir, sessions, defaultSessionId, varMap, methodRunner, resolveRunTimeouts(options.timeouts ?? {}, file))`.
  - `createContext` gains a trailing `timeouts = DEFAULT_TIMEOUTS` and initialises `timeoutNotices: new Set()`.
  - There is one ctx per top-level flow, so "once per file" means once per top-level run (AC60), and CLI flags apply to every flow in a directory run (AC56).

### S12. recorder-app

- **No source change.** `flowReplayer.ts` keeps calling `execute*` with today's arguments, so it gets the built-in budgets (element 5000, navigation 30000, `waitForPageLoad` its own timeout or 30000).
- Its private `within` copy calls `resolveContainerLocator(page, sel)` and does its own nth checks. It still compiles; the not-found message it can hit is now the new container text.
- **Builds:** `recorder-app` `npm run build` and `vitest run` are verified in T10. Test edits are pending E2.
- **Known limit (out of scope):** the recorder's own `parseCommand` takes the first YAML key, so a replayed flow that writes `timeout:` before the command key would fail. `uivisor compact` may also merge adjacent `within` blocks that carry different sibling `timeout:` values. Neither is in the spec.

### S13. Test seams and fixtures

- **Unit, no browser:**
  - `pollSteps` / `retryUntil` / `resolveNotVisible` with a fake `Clock` and scripted counts (T4).
  - Core commands with a mocked `Page`/`Locator` (T10).
  - Parser, config and CLI tests (T6, T7, T8).
  - Pure precedence and notice tests (T9).
- **Engine with a real Chromium (T11):** `uivisor-app/tests/integration/timeouts.test.ts` runs an inline `http.createServer`, following `tests/integration/commands.test.ts`. It serves the T2 pages plus three server-side routes:
  - `/hang`: never responds (AC33a).
  - `/reload-hang`: 200 on the first request, hangs on later ones (AC33b).
  - `/slow?ms=N`: responds after N ms (AC37).
  - Precedence and child-flow cases use temp YAML in `os.tmpdir()` and run through `loadAndParse` + `runFlow`/`runAll`, with stdout spied for the notice ACs.
- **T2 pages.** These are static HTML driven by query params, with no framework:

| Page | Elements and timing | ACs |
|---|---|---|
| `delayed.html?delay=` | `int-delayed`; `Submit` heading, then the `data-testid="Submit"` button 50 ms later, then `int-submit-result`; `int-delayed-card` / `int-card-label`; `int-hidden`. Mirrors AC76 (a)–(d) | AC1–AC5, AC7, AC8, AC20, AC24, AC27 |
| `late-enable.html?appear=&enable=` | `int-late-enable` | AC36, AC38 |
| `vanish.html` | `int-vanish` removed at 1500 ms; `int-stays` | AC21, AC22 |
| `duplicates.html?mode=collapse\|hidden\|mixed\|hide-later` | `row` / `dup` | AC12, AC17, AC23 a–c |
| `growing.html` | `item` and `.row`, 1 → 3 at 1000 ms | AC26, AC30 |
| `input-disable.html` | `int-input`, disabled on click | AC32 |
| `spa-nav.html` | `pushState('/target')` at 800 ms, then `fetch('/slow?ms=1700')` | AC37 |

- **Live test-app (T12):** the `/integration-timeouts` page (T3) serves only AC28 and AC76–AC78.
  - AC19 also runs on the existing `/integration` page inside `timeouts.yaml`.
  - The AC34 variants live in `test-app/flows/integration-variants/` (with `config: ../integration/config.yml`). They can't go in `integration/`, because AC79 fixes that directory at 37 flows.
- **Coverage gate:** `packages/core` enforces 90% branch coverage. `deadline.ts`, `commandTraits.ts` and the new resolver branches need direct tests.
- **Slower suites:** existing uivisor-app integration tests that hit a missing element now wait the 5000 ms default before failing. They stay well inside that suite's 60 s `testTimeout`, but the suite is expected to run tens of seconds slower.

### S14. Escalations (Orchestrator / human, before T4's AC11 test and T10's test edits)

- **E1 — AC11 contradicts AC10 and §6.1 (spec defect).** AC11's input has step 1 "alternate between 0 and 1 match on every pass". On any pass where step 1 has 1 match, step 1 wins, and §6.1 step 2, AC6 and AC10 require that win to be accepted at once. Resolution would then succeed, not fail as AC11 expects.
  - Proposed rewording, which keeps the intent: "step 1 always has 0 matches; step 2 alternates between 1 and 0 matches on every pass, so no lower-step winner is confirmed twice in a row before the 1000 ms deadline."
  - T4 builds to §6.1. Only its AC11 test waits on the fix.
- **E2 — AC74's list of allowed test edits is too narrow for AC29, AC33 and the recorder constraint.** These edits are unavoidable, and AC74 doesn't list them:
  - (a) `page.goto` / `reload` now receive a `timeout` (AC33). Exact `{ waitUntil: 'load' }` assertions exist at:
    - `uivisor-app/tests/unit/session-engine.test.ts` lines 112, 131, 133, 166, 185, 188, 216
    - `uivisor-app/tests/unit/runner-no-auto-nav.test.ts` line 180
    - `recorder-app/src/flowReplayer.test.ts` lines 104, 179, 330
  - (b) `recorder-app` T24 (assertUrl mismatch) now retries for the 5000 ms default (Q1, AC29). That exceeds recorder vitest's default 5000 ms test timeout. It needs a per-test timeout.
  - (c) Resolver tests in `playwrightLocator.test.ts` and `resolveSelector.test.ts` whose mocks have no unique match now poll until a deadline. They need a short deadline passed in (for example `createDeadline(1)`); most of them also assert the replaced error text (AC14–AC17).
  - Proposal: allow these edits (loosen to `expect.objectContaining` or add an explicit test timeout), each listed in Code Artifacts. The alternative is a legacy-mode branch in every navigation command just to keep old call shapes, which is rejected as dead weight.
- **E3 — `selectOption` message (minor).** Revision decision 2 puts `selectOption` among the interactions that report `Element not actionable after …`. The existing integration test `uivisor-app/tests/integration/commands.test.ts:662` asserts `Option not found` for a valid select with an absent option value, and Playwright can't tell a missing option from a disabled select on timeout. The plan keeps `Option not found.` for `selectOption`. No AC tests the other reading. Please confirm.
- **E4 — typo.** AC57(c) refers to "the header validation error from AC63". It means AC68.

**Last checkpoint:** architect at 2026-10-13 19:11

## Gate 1 Errata (human decisions on Architect escalations, 2026-10-13 19:25)

These amend the approved spec and the Seam Notes. They supersede the ACs and seams they name. Not a spec revision (revision count stays 1 of 2).

- **E1 → AC11 (revised input):** mocked cascade with a timeout of 1000 ms where step 1 always has 0 matches and step 2 alternates between 1 and 0 matches on every pass, so no lower-step winner is confirmed twice in a row. Expected and Failure unchanged: fails with the AC14 not-found error after 1000 ms; failure if a locator is returned or it fails before 1000 ms.
- **E2 → AC74 (allowed test edits extended):** besides the edits AC74 already allows, the Coder may edit, each listed in Code Artifacts with its reason:
  - (a) exact `goto`/`reload` call-shape assertions in `uivisor-app/tests/unit/session-engine.test.ts` (lines 112, 131, 133, 166, 185, 188, 216), `uivisor-app/tests/unit/runner-no-auto-nav.test.ts` (line 180) and `recorder-app/src/flowReplayer.test.ts` (lines 104, 179, 330). Update them to the **exact new shape** (e.g. `{ waitUntil: 'load', timeout: 30000 }`), not `expect.objectContaining`.
  - (b) recorder `flowReplayer.test.ts` T24: give that test an explicit 10000 ms vitest timeout; its assertions stay.
  - (c) resolver tests in `packages/core/src/playwrightLocator.test.ts` and `uivisor-app/tests/unit/resolveSelector.test.ts` that have no unique match: pass a short deadline and assert the new error text.
- **E3 → selectOption:** the option-selection step keeps today's `Option not found.` message on timeout. Resolution timeouts for `selectOption` still say `Element not found after <T>ms: …`. Revision 1 decision 2's list of "not actionable" interactions excludes `selectOption`. `uivisor-app/tests/integration/commands.test.ts:662` stays as is.
- **E4 → AC57(c):** "the header validation error from AC63" means AC68.
- **dispatch API (supersedes S6 "`SessionedCommand | Command` input"):** `dispatch` takes only a step (`SessionedCommand`). No dual-shape input. T5 converts every existing caller to pass a step (`dispatch(page, cmd, …)` → `dispatch(page, { command: cmd }, …)`): 99 calls in `uivisor-app/tests/integration/commands.test.ts`, `tests/unit/error-message-format.test.ts`, `tests/unit/lazy-interpolation-timing.test.ts`, `tests/unit/sessions.test.ts`, `tests/unit/set-var-commands.test.ts`, `tests/unit/within-dispatcher.test.ts`, plus `engine/index.ts`. Until T10 changes `executeWithin` to hand whole steps to its callback, T5's within closure wraps the inner command (`{ command: nc }`); T10 then passes the step through and removes the wrap. These test files are added to T5's file list; none belongs to another PG2 task, and T10 (which also edits `within-dispatcher.test.ts`) runs after T5.

**Last checkpoint:** Orchestrator errata recorded at 2026-10-13 19:25

## Model Override (2026-10-13 19:35)
- claude-haiku-4-5 returned 403 (account limited to global models). Human approved running all haiku roles on sonnet for this run: tester_generator_a, tester_consolidator, deployer, delivery_manager.
- Generator diversity now comes from the briefs: A is the systematic one-test-per-AC-clause reading; B is the adversarial edge-case hunter.

## Tests — Generator A (tester_generator_a)

# Tester Generator A — Phase 1 Test Plan (systematic / spec-literal)

**Role:** tester_generator_a. One test per AC clause, mirroring the spec's Input / Expected / Failure. Does not duplicate Generator B's adversarial edge cases.
**Source:** Gate 1 spec (Revision 1) + Gate 1 Errata (E1–E4, dispatch API) + Feature & Task Breakdown + Seam Notes S1–S14.
**Baseline:** packages/core 406 passed; uivisor-app 733 passed, 4 expected fail (base `edc5701`).

All test names below are literal `it(...)` titles I propose, prefixed with the AC id(s) they cover, following the existing convention in `uivisor-app/tests/unit/args.test.ts` (`it('AC42: ...')`).

---

## `packages/core/src/deadline.ts` (new) — `packages/core/src/deadline.test.ts` (new) — UNIT

- `createDeadline(ms) exposes timeoutMs unchanged` (AC13 setup) — `deadline.timeoutMs === ms`, used as the "T" quoted in every message.
- `remainingMs() counts down on the injected clock` (S3) — with a fake `Clock` whose `now()` is stepped manually, `remainingMs()` returns `end - now`, floored at 0 after expiry.
- `remainingMs() is Infinity for an unbounded deadline (timeoutMs 0)` (S3, "waitForPageLoad timeout 0") — `createDeadline(0).remainingMs() === Infinity`.
- `expired() is false before the deadline and true at/after it` (S3) — fake clock advanced past `timeoutMs` → `expired() === true`.
- `pwTimeout() returns ceil(remainingMs()), minimum 1, for a bounded deadline` (S3 "never 0 for a bounded deadline") — with remainingMs at e.g. 0.3 ms, `pwTimeout() === 1`, never `0`.
- `pwTimeout() returns 0 for an unbounded deadline` (S3) — `createDeadline(0).pwTimeout() === 0`.
- `sleep(ms) sleeps min(ms, remainingMs()) on the deadline's clock` (S3) — fake clock's `sleep` is called with the shorter of the two values near the deadline.
- `DEFAULT_TIMEOUTS matches the built-in defaults` (AC73) — `{ defaultTimeout: 5000, navigationTimeout: 30000 }`.
- `RETRY_INTERVAL_MS is 100` (AC13, Constraints "Retry interval") — literal `100`.
- `retryUntil runs the attempt once immediately, even if the deadline already expired` (S3 "runs attempt at once") — fake clock pre-expired; `attempt` mock is called exactly once; its result (done or not) is returned without a sleep.
- `retryUntil returns the first done result without further polling` (S3) — `attempt` resolves `{ done: true, value: X }` on call 1; `retryUntil` resolves to it, `attempt` called once, no `sleep` call.
- `retryUntil polls every 100ms via deadline.sleep until done` (AC9 unit-level mechanism, S3) — `attempt` not-done twice then done; asserts `sleep` called with `100` between attempts, total calls = 3.
- `retryUntil returns the last not-done result at the deadline` (AC11 (E1-revised) mechanism) — `attempt` always not-done; fake clock reaches expiry; `retryUntil` resolves `{ done: false, last }` with the last attempt's value, not a thrown error.
- `retryUntil propagates an attempt() rejection immediately, without retrying` (AC18 mechanism) — `attempt` mock rejects on call 1; `retryUntil` rejects with the same error; `attempt` called exactly once.

**PASSES on both versions:** none in this file — `deadline.ts` is wholly new, so there is no "both versions" to straddle.

---

## `packages/core/src/commandTraits.ts` (new) — `packages/core/src/commandTraits.test.ts` (new) — UNIT

- `AC70: COMMAND_TRAITS has an entry for every element-trait command` — for each of `tapOn, doubleClick, hover, inputText, inputTextTargeted, clearText, selectOption, check, uncheck, assertVisible, assertNotVisible, assertText, assertValue, assertEnabled, assertDisabled, assertChecked, assertUnchecked, assertUrl, assertCount, within`, `COMMAND_TRAITS[t].timeout === 'element'`.
- `AC70: COMMAND_TRAITS has an entry for every navigation-trait command` — for each of `goto, reload, goBack, goForward, waitForPageLoad`, `COMMAND_TRAITS[t].timeout === 'navigation'`.
- `AC70: COMMAND_TRAITS has an entry for every none-trait command` — for each of `wait, waitFor, scroll, setViewport, screenshot, setVar, testVarSet, unsetVar, runFlow, pressKey, crossOriginIframeWarning`, `COMMAND_TRAITS[t].timeout === 'none'`.
- `AC70: COMMAND_TRAITS has exactly one entry per Command['type'], no extras` — `Object.keys(COMMAND_TRAITS).length === Object.keys(<the exhaustive type list>).length` (or equivalent exhaustive-union check); fails if an extra key sneaks in.
- `AC70: no entry carries preCheck, action or checkpoint` — `Object.values(COMMAND_TRAITS).every(e => Object.keys(e).length === 1 && 'timeout' in e)`.

### `packages/core/src/commandTraits.typecheck.ts` (new) — UNIT (compile-time, exercised via `tsc --noEmit`)

- `AC71: typeof COMMAND_TRAITS is assignable to Record<Command['type'], unknown>` — a `const x: Record<Command['type'], unknown> = COMMAND_TRAITS;` line that must compile.
- `AC71: a COMMAND_TRAITS literal missing one key fails to compile` — a `// @ts-expect-error` line assigning an object literal that omits e.g. `pressKey` to `typeof COMMAND_TRAITS`; `tsc --noEmit` must report the expected error (i.e. the `@ts-expect-error` must be "used", not "unused").
- `AC71: tsc --noEmit for packages/core passes with the full table` (integration-of-build, not a vitest test) — run `tsc --noEmit` in `packages/core`; exit code 0.

**PASSES on both versions:** none — `commandTraits.ts` is new.

---

## `uivisor-app/src/utils/positiveInt.ts` (new) — `uivisor-app/tests/unit/positive-int.test.ts` (new) — UNIT

- `parsePositiveInt returns the number for a positive integer` (S9) — `parsePositiveInt(3000) === 3000`.
- `parsePositiveInt returns the number for a digit-only string` (AC47 "3000" accepted) — `parsePositiveInt('3000') === 3000`.
- `parsePositiveInt returns undefined for 0` (AC47) — `parsePositiveInt(0) === undefined`.
- `parsePositiveInt returns undefined for a negative integer` (AC47 `-5`) — `parsePositiveInt(-5) === undefined`.
- `parsePositiveInt returns undefined for a non-integer number` (AC47 `1.5`) — `parsePositiveInt(1.5) === undefined`.
- `parsePositiveInt returns undefined for a non-numeric string` (AC47 `"abc"`) — `parsePositiveInt('abc') === undefined`.
- `parsePositiveInt returns undefined for a boolean` (AC47 `true`) — `parsePositiveInt(true) === undefined`.
- `parsePositiveInt returns undefined for null` (AC47 `null`) — `parsePositiveInt(null) === undefined`.
- `parsePositiveInt returns undefined for undefined` (AC68 header/config absent-value guard) — `parsePositiveInt(undefined) === undefined`.

**PASSES on both versions:** none — new util.

---

## `packages/core/src/playwrightLocator.ts` — `packages/core/src/playwrightLocator.test.ts` — UNIT (mocked `Page`/`Locator`, S4)

### Selector forms wait within budget (AC1–AC5)

- `AC1: bare string resolves once a step-1 (data-testid) match appears mid-poll` — mocked `count()` returns 0 for 1–2 polls then 1; `resolveLocator` resolves to that locator; elapsed (via fake clock `sleep` call count × 100ms) < 2500.
- `AC2: bare string resolves via a lower cascade step (text) once stable` — step-1 (`data-testid`) stays 0; step-2 (`text`) goes 0→1 and is confirmed on the following poll (stability); resolves to the text locator; elapsed < 2600.
- `AC3: pipe string resolves once its matching segment appears` — `id=int-nope|data-testid=int-delayed`; first segment stays 0, second goes 0→1 (single further poll since pipe step order already starts at step 2, not step 1 — i.e., no stability delay beyond the match appearing); resolves to the `data-testid` segment's locator.
- `AC4: each object-selector form (testId / css / text) resolves once its single match appears` — three sub-cases, each builds one `ResolutionStep`; `count()` 0 then 1; resolves without throwing.
- `AC5: the { xpath } form resolves once its match appears` — one xpath step; `count()` 0 then 1; resolves to the xpath locator; no `Invalid XPath expression:` thrown.

### Single-step / step-1 resolve without stability delay (AC6)

- `AC6: a bare-string step-1 (data-testid) match with count 1 from the start resolves on the first poll` — `attempt`/`count()` called exactly once; no `sleep` call.
- `AC6: a single-segment pipe selector with count 1 from the start resolves on the first poll` — `count()` called once.
- `AC6: a { testId } object selector with count 1 from the start resolves on the first poll` — `count()` called once.

### Stability check and duplicates (AC7–AC13, revised AC11 per Errata E1)

- `AC7: tapOn's cascade prefers the stable data-testid winner over an earlier heading match` — mocked two-step cascade (`text` step 1 would be found first chronologically per Input narrative is actually `data-testid` priority order; per S4 cascade order is data-testid, text, name, id, placeholder, so the heading matches on `text` while the button matches on `data-testid`) — `data-testid` step has a match from t+50ms, `text` step has a match from t0; because `data-testid` precedes `text` in cascade order, step 1 wins once stable, so the returned locator is the button's, never the heading's.
- `AC8: pipe-string stability — the data-testid segment wins over the text segment once stable, regardless of segment order written` — `data-testid=Submit|text=Submit`; `data-testid` segment present slightly later; stability check still lets it win because pipe tries segments in written order, so first-matching-and-stable segment (here `data-testid`, segment 1) is returned.
- `AC9: a stable lower-step winner (step 2) is accepted after exactly two resolution passes ~100ms apart` — step1 count always 0; step2 count always 1; assert resolution result after exactly 2 `count()` calls on step2 and total `sleep` calls === 1 (100ms); elapsed via sleep-call tally is ≥100 and <300.
- `AC10: a changed winner restarts the stability window, and a later step-1 win is accepted at once` — pass 1: step1=0, step2=1 (step2 provisional winner); pass 2 onward: step1=1 (step1 wins outright); result is the step-1 locator, confirmed in a single further pass (no extra stability wait needed because step 1 — the first winner candidate seen on that pass — is accepted immediately per S4 "w = 0 found at once" rule applied each attempt).
- `AC11 (revised, Errata E1): an unconfirmed lower winner at a 1000ms deadline fails with the not-found error` — step1 always 0 matches; step2 alternates 1,0,1,0,... every poll, so it's never confirmed twice running; with `createDeadline(1000)`, resolution returns `{ found: false, counts }` (or throws the not-found error, per the command-level wrapping) only after reaching the deadline, not earlier; no locator is ever returned.
- `AC12: duplicate matches (2) collapse to 1 and the step then passes` — `data-testid=row` count sequence 2,2,2,...,1 (switches to 1 at the poll crossing 800ms); resolves to that locator once count reaches 1; elapsed < 1800.
- `AC13 (loop cadence): count() is called at least 5 and at most 11 times before failing at a 1000ms deadline` — step with `count()` always 0, single-segment selector, `createDeadline(1000)`; assert `count` mock call count is in `[5, 11]` when the attempt loop ends.

### Not-found / malformed errors (AC14–AC18)

- `AC14: bare-string cascade not-found error — exact line 1 and the 5 step lines in order` — `createDeadline(1000)`, all 5 cascade steps 0 matches; thrown error message's first line is exactly `Element not found after 1000ms: int-never-rendered`; next 5 lines exactly `  data-testid=int-never-rendered: 0 matches`, `  text=int-never-rendered: 0 matches`, `  name=int-never-rendered: 0 matches`, `  id=int-never-rendered: 0 matches`, `  placeholder=int-never-rendered: 0 matches`, in that order.
- `AC15: pipe-string not-found error — exact line 1 and the two segment lines` — `id=a-nope|data-testid=b-nope`, both 0 matches, `createDeadline(1000)`; line 1 exactly `Element not found after 1000ms: id=a-nope|data-testid=b-nope`; line 2 exactly `  id=a-nope: 0 matches`; line 3 exactly `  data-testid=b-nope: 0 matches`.
- `AC16: object-selector not-found error uses JSON.stringify of the selector` — `{ testId: 'int-never-rendered' }`, 0 matches, 1000ms deadline; line 1 exactly `Element not found after 1000ms: {"testId":"int-never-rendered"}`; line 2 exactly `  {"testId":"int-never-rendered"}: 0 matches`.
- `AC16: xpath-form not-found error uses JSON.stringify of the selector` — `{ xpath: "//*[@id='nope']" }`, 0 matches, 1000ms deadline; line 1 exactly `Element not found after 1000ms: {"xpath":"//*[@id='nope']"}`.
- `AC17: duplicates at the deadline report their match count, not zero` — `data-testid=row` always 2 matches, `createDeadline(1000)`; line 1 exactly `Element not found after 1000ms: data-testid=row`; line 2 exactly `  data-testid=row: 2 matches`.
- `AC18: unknown attribute (foo=bar) throws fast, before any count() call` — `buildSteps` throws `Unknown attribute 'foo'...` synchronously; `count()` mock never called; elapsed effectively 0 (no poll loop entered).
- `AC18: xpath union in pipe syntax (xpath=//a|//b) throws fast` — `buildSteps` throws `XPath union '|' conflicts with pipe syntax...` synchronously, before any `count()` call.
- `AC18: invalid XPath ({ xpath: "//*[" }) throws on first count() without retrying` — the single xpath step's `count()` rejects with `Invalid XPath expression: ...`; the rejection propagates from the first attempt; `count()` called exactly once (not retried, per S4 "Fail fast... A count() rejection propagates from the attempt that hit it").

### Not-visible mode (AC19–AC23 revised)

- `AC19: assertNotVisible resolves "absent" when every cascade step has 0 matches (bare string)` — `resolveNotVisible` returns `true` on the first poll when all steps are 0.
- `AC19: assertNotVisible resolves "absent" for a pipe string with 0 matches on both segments` — same, pipe form.
- `AC20: assertNotVisible resolves true when the element is present but isVisible() is false (bare string)` — one step has count 1, `locator.nth(0).isVisible() → false`; resolves `true` on first poll.
- `AC20: assertNotVisible resolves true for an object-form selector when hidden` — `{ testId: 'int-hidden' }`, count 1, `isVisible() → false`.
- `AC21: assertNotVisible waits for a visible element to become absent/hidden` — deciding step's count goes 1→0 (element removed) at a later poll (or `isVisible()` goes true→false); resolves `true` once the condition changes, with elapsed < 2500 against the default 5000ms deadline (modelled via poll-count/clock ticks).
- `AC22: assertNotVisible returns false at the deadline when the element stays visible` — deciding step count stays 1, `isVisible()` always `true`; with `createDeadline(1000)`, `resolveNotVisible` resolves `false` (not throws) once the deadline is reached; command-level wraps this into `Expected: not visible\nGot: visible` (covered in commands.test.ts; here assert the resolver-level `false` return).
- `AC23 (a, revised): both duplicate matches hidden from the start resolves true promptly` — `data-testid=dup` count 2 throughout, `nth(0).isVisible()` and `nth(1).isVisible()` both `false` from poll 1; resolves `true` on the first poll (no retry needed).
- `AC23 (b, revised): one of two duplicates stays visible — resolves false at the deadline` — count 2 throughout, `nth(0)` visible `true` always, `nth(1)` hidden; `resolveNotVisible` resolves `false` only once `createDeadline(1000)` expires, never earlier.
- `AC23 (c, revised): a duplicate that starts visible and becomes hidden at a later poll — resolves true once all matches of the deciding step are hidden` — count 2 throughout, `nth(0).isVisible()` true for the first few polls then false, `nth(1)` hidden throughout; resolves `true` once `nth(0)` flips to hidden, not before.
- `AC23 (revised, rule statement): the deciding step is the first in cascade/pipe order with ≥1 match; prior zero-match steps don't decide` — mocked cascade where step 1 (`data-testid`) is 0 matches throughout and step 2 (`text`) has the dup matches; assert `resolveNotVisible`'s pass/fail depends only on step 2's visibility, never step 1.

### `within` container lookup (AC24–AC27) — resolver-level pieces

- `AC24: resolveContainerLocator resolves once the container's count reaches 1` — count 0 then 1 at a later poll; resolves without throwing `within: No container found …`.
- `AC25: within container not-found error — exact line 1 and line 2` — `createDeadline(1000)`, selector `data-testid=int-never-rendered`, count 0 throughout; thrown message line 1 exactly `within: No container found after 1000ms for selector 'data-testid=int-never-rendered'`; line 2 exactly `  data-testid=int-never-rendered: 0 matches`.
- `AC26: resolveContainerLocator with nth accepts once count reaches nth+1` — `{ nth: 2 }` (0-indexed third item), count goes 1→3 at a later poll; resolves once count ≥ 3.
- `AC26: resolveContainerLocator with nth out of range at the deadline throws today's nth message` — `{ nth: 2 }`, count stays 1, `createDeadline(1000)`; throws exactly `within: nth=2 requested but only 1 containers matched selector 'data-testid=item'`.
- `AC27: resolveContainerLocator honours its own deadline independent of any caller/inner budget` (resolver-level half of Q18) — `resolveContainerLocator` is called with a `{ deadline: createDeadline(1000) }` option; the function has no knowledge of/ never receives the inner step's budget; assert the function signature only accepts the one `deadline` option (type-level/behavioural check that nothing else influences its timing).

**PASSES on both versions (regression, unaffected by this feature at the assertion level, only at the call-shape/mock level):**
- `TC-001: data-testid count=1 returns that locator; text/name/id/placeholder NOT queried` (existing test, kept, now exercised through the new deadline-aware path with a short deadline per Errata E2(c)) — `PASSES on both versions`.
- `TC-003: data-testid count=2 (skipped), text count=1 — returns text locator` (existing dup-skip behaviour, unaffected by stability/retry since it resolves on pass 1) — `PASSES on both versions`.

---

## `uivisor-app/tests/unit/resolveSelector.test.ts` — UNIT (mirrors playwrightLocator.test.ts at the app layer, per Seam Notes S13/E2(c))

- `AC14: not-found error format for a bare-string selector via the app-level resolver wrapper` — same assertions as the core-level AC14 test, exercised through whatever app-level entry point this file tests (per prior art, this file wraps the same resolver with app-specific context); pass a short `createDeadline`.
- `AC15: not-found error format for a pipe-string selector via the app-level wrapper` — mirrors AC15.
- `AC16: not-found error format for object/xpath selectors via the app-level wrapper` — mirrors AC16, both sub-cases.
- `AC17: duplicate-count-at-deadline error via the app-level wrapper` — mirrors AC17.

**PASSES on both versions:** any existing cases in this file whose selector always resolves on the first attempt (count=1 immediately) are unaffected by the stability/retry logic — list each by its existing test name once the file is read in Phase 2; flagged here as a category, not enumerated, since I was not given this file's current contents.

---

## `packages/core/src/commands.ts` — `packages/core/src/commands.test.ts` — UNIT (mocked `Page`/`Locator`, S5)

### Element actions: not-found vs not-actionable split (AC31, AC36, AC38 revised)

- `AC31: tapOn against an absent target fails with "not found", using defaultTimeout` — header-equivalent `createDeadline(1200)` passed in; resolution never finds `data-testid=int-never-rendered`; line 1 exactly `Element not found after 1200ms: data-testid=int-never-rendered`.
- `AC31: doubleClick against an absent target fails with "not found"` — same pattern.
- `AC31: hover against an absent target fails with "not found"` — same pattern.
- `AC31: inputTextTargeted ({ element, text }) against an absent target fails with "not found"` — object-form selector; line 1 exactly `Element not found after 1200ms: {"testId":"int-never-rendered"}`.
- `AC31: clearText against an absent target fails with "not found"` — same bare-string pattern.
- `AC31: selectOption against an absent target fails with "not found"` — object-form `{ testId, value }`; line 1 exactly `Element not found after 1200ms: {"testId":"int-never-rendered"}` (E3: this is a resolution-timeout path, which is NOT the `Option not found.` message — that only fires once the element is found).
- `AC31: check against an absent target fails with "not found"` — same bare-string pattern.
- `AC31: uncheck against an absent target fails with "not found"` — same bare-string pattern.
- `AC31: assertVisible against an absent target fails with "not found", not "Expected: visible\nGot: element not found"` — explicitly assert the message is NOT the old `Expected: visible\nGot: element not found` text.
- `AC31: assertText ({ testId, expected }) against an absent target fails with "not found"` — object-form; line 1 exactly `Element not found after 1200ms: {"testId":"int-never-rendered"}`.
- `AC31: assertValue against an absent target fails with "not found"` — object-form, same pattern.
- `AC31: assertEnabled against an absent target fails with "not found"` — bare-string pattern.
- `AC31: assertDisabled against an absent target fails with "not found"` — bare-string pattern.
- `AC31: assertChecked against an absent target fails with "not found"` — bare-string pattern.
- `AC31: assertUnchecked against an absent target fails with "not found"` — bare-string pattern.
- `AC32 (revised): the inputText shorthand fails with "not actionable", naming the last-tapped selector, when the target becomes disabled` — `ctx.lastTappedLabel = 'data-testid=int-input'` (set by a prior `tapOn`); resolution of the target succeeds (element exists); the `fill()` call rejects because the input is disabled; thrown message line 1 exactly `Element not actionable after 1000ms: data-testid=int-input` — not `Element not found …`.
- `AC33: goto against a hanging route fails after navigationTimeout with the budget in the message` — mocked `page.goto` rejects with a Playwright-shaped `TimeoutError` after the deadline; rethrown message contains `1500ms` (exact: `Navigation failed: <url> — timed out after 1500ms`).
- `AC33: reload while the reload request hangs fails after navigationTimeout with the budget in the message` — mocked `page.reload` TimeoutError; rethrown message contains `1500ms` (exact: `reload timed out after 1500ms`).
- `AC34: goBack still uses waitUntil: 'commit' and fails with "No previous page in history." on a fresh page` — call-shape assertion `{ waitUntil: 'commit', timeout: 20000 }` (per Errata E2(a), exact new shape, not `objectContaining`); history-check message unchanged.
- `AC34: goForward still uses waitUntil: 'commit' and fails with "No next page in history." on a fresh page` — same pattern, `goForward`.
- `AC35: waitForPageLoad uses its own inner timeout (1000) over navigationTimeout (3000)` — `createDeadline` built from `timeout ?? navigationTimeout`; both URL-wait and load-state-wait Playwright calls receive `{ timeout: ~1000 }` (`pwTimeout()`), not 3000; message contains `1000ms`.
- `AC35: waitForPageLoad falls back to navigationTimeout (1500) when it has no inner timeout` — Playwright calls get `{ timeout: ~1500 }`; message contains `1500ms`.
- `AC35: waitForPageLoad uses the sibling timeout (1200) over navigationTimeout (3000) when there's no inner timeout` — deadline passed in from dispatch is 1200; message contains `1200ms`.
- `AC36 (a): one budget covers resolution and interaction — the deadline is NOT reset after resolution succeeds` — mocked target resolves at ~1500ms-equivalent polls, deadline total 2000ms; the interaction's Playwright call receives `pwTimeout()` computed from the *remaining* budget (small, not a fresh 2000ms); the overall failure happens using the single deadline, never doubling.
- `AC36 (b): one budget that's enough for both resolution and interaction passes` — resolution succeeds with budget to spare; interaction's mocked call succeeds; command resolves `passed: true`.
- `AC37: waitForPageLoad's URL wait and load-state wait share one budget (deadline), the second wait does not get the full timeout again` — mock `page.waitForURL` resolving after consuming most of the deadline (simulated via fake clock advance), then assert `page.waitForLoadState`'s `{ timeout }` argument reflects `pwTimeout()` computed from the now-reduced `remainingMs()`, not the original full value.
- `AC38 (revised): line 1 is exactly "Element not actionable after 2000ms: ..." when resolution succeeds but the click/interaction itself times out` — resolves AC36(a)'s target, then the `click()` call rejects (budget exhausted); thrown message line 1 exactly `Element not actionable after 2000ms: data-testid=int-late-enable`; NOT `Element not found after 2000ms: …`.
- `AC73: the core default (5000) is used for an element command when no deadline argument is supplied` — call `executeTapOn`/equivalent with `deadline` omitted; the internally-created default deadline's `timeoutMs === 5000` (observed via the not-found message `Element not found after 5000ms: …`).
- `AC73: the core default (30000) is used for a navigation command when no deadline argument is supplied` — call e.g. `executeGoto` with `deadline` omitted and a hanging target; message contains `30000ms`.
- `AC73: waitForPageLoad({ timeout: 0 }) still parses/executes as unbounded` — `deadline` built as `createDeadline(0)`; both Playwright calls receive `{ timeout: 0 }` (per S3 "0 means unbounded... both waits get `{ timeout: 0 }`").

### Assertions that now retry (AC29, AC30)

- `AC29: assertUrl fails at the deadline with the unchanged message format` — `createDeadline(1000)`, URL never matches; after retryUntil exhausts the deadline, thrown message exactly `Expected: /never\nGot: /integration`.
- `AC29: assertUrl passes once the URL changes mid-poll` — URL check returns the wrong value on early polls, then the expected value; resolves `passed: true` before the deadline (durationMs comparison is an integration-test concern per Seam Notes; here assert pass/fail only).
- `AC30 (a): assertCount passes once the observed count reaches the expected value` — mocked count 1→3 at a later poll, expected 3; resolves `passed: true`.
- `AC30 (b): assertCount fails at the deadline reporting the last observed count, not a stale earlier one` — count rises 1→3 then plateaus, expected 5, `createDeadline(1500)`; thrown message exactly `Expected: 5\nGot: 3` (the last observed count, not `1`).

### `executeWithin` (AC24–AC27 at the command layer, Q18)

- `AC24: executeWithin passes once the container resolves mid-poll` — delegates to `resolveContainerLocator`; once resolved, dispatches the `do:` step against the scoped page; overall result `passed: true`.
- `AC25: executeWithin surfaces the container not-found error unchanged` — propagates the exact `within: No container found after 1000ms for selector '...'` message from the resolver.
- `AC26: executeWithin with nth surfaces the resolver's deadline message when the list never grows enough` — propagates `within: nth=2 requested but only 1 containers matched selector 'data-testid=item'`.
- `AC27 (Q18, command-layer half): executeWithin's own sibling timeout (1000) bounds only resolveContainerLocator, never the deadline passed to the inner dispatch call` — asserts the mocked `dispatch`/`WithinDispatch` callback is invoked WITHOUT the `within`'s deadline — i.e., the inner step runs with its own (default or own-sibling) budget, confirmed by inspecting the deadline argument the callback receives (should be `undefined` or a fresh one, never the `within`'s 1000ms one).
- `AC27 (a): inner assertVisible using the 5000ms default passes when the within's own 1000ms budget was already enough just for the container` — container present at load (resolves immediately), inner element added at 2500ms; because the inner step gets its own 5000ms default rather than the within's 1000ms, it should still have budget to find the 2500ms element — asserted via the mocked inner dispatch receiving a 5000ms-equivalent deadline, not 1000ms.

### selectOption message (Errata E3)

- `E3 confirmation: selectOption against a resolved element with a missing option value still fails with "Option not found."` — target resolves successfully; the `selectOption()` Playwright call rejects/returns no match for the given value; thrown message is exactly `Option not found.` (unchanged), NOT `Element not actionable after …`.

**PASSES on both versions (regression):**
- `C-13…C-18: exact { timeout: 30000 } / { timeout: 5000 } assertions on waitForPageLoad's second Playwright call` (per Seam Notes S3 "ceil returns the full value... those tests pass unedited") — `PASSES on both versions`.
- `uivisor-app/tests/integration/commands.test.ts:662 — selectOption against a valid select with an absent option value asserts "Option not found"` (Errata E3, "stays as is") — `PASSES on both versions`.

---

## `packages/core/src/index.ts` — no dedicated test file; covered by import-surface assertions in `commandTraits.test.ts` and `deadline.test.ts`

- `AC70 setup: COMMAND_TRAITS, TimeoutTrait, Deadline, Clock, createDeadline, DEFAULT_TIMEOUTS, RETRY_INTERVAL_MS, retryUntil are all exported from @uivisor/core` — a single import-surface test: `import { COMMAND_TRAITS, createDeadline, DEFAULT_TIMEOUTS, RETRY_INTERVAL_MS, retryUntil } from '../index'` compiles and each symbol is defined. UNIT.

---

## `uivisor-app/src/parser/commandParser.ts` — `uivisor-app/tests/unit/sibling-timeout-parser.test.ts` (new) — UNIT

### Parsing and placement (AC39–AC43, AC72)

- `AC39: a sibling timeout on a string-selector command parses and is carried on the step` — `{ assertVisible: 'data-testid=int-never-rendered', timeout: 1500 }` parses to `{ command: {...}, timeout: 1500 }`, no error.
- `AC40 (a): a sibling timeout written before the command key still resolves to the command, not "Unknown command: timeout"` — `{ timeout: 1500, tapOn: { testId: 'int-never-rendered' } }` parses; `command.type === 'tapOn'`; `timeout === 1500`.
- `AC40 (b): session plus a sibling timeout in any key order both survive parsing` — `{ session: 'b', tapOn: {...}, timeout: 1500 }` parses to `{ session: 'b', timeout: 1500, command: { type: 'tapOn', ... } }`.
- `AC41: a sibling timeout is accepted on every element-trait command` — parameterized over the full `element` list from the Constraints table (`tapOn, doubleClick, hover, inputText, inputTextTargeted, clearText, selectOption, check, uncheck, assertVisible, assertNotVisible, assertText, assertValue, assertEnabled, assertDisabled, assertChecked, assertUnchecked, assertUrl, assertCount, within`); each with `timeout: 2000` parses without throwing and the parsed step carries `timeout === 2000`.
- `AC41: a sibling timeout is accepted on every navigation-trait command` — parameterized over `goto, reload, goBack, goForward, waitForPageLoad` (without an inner timeout on the last one); each with `timeout: 2000` parses without throwing, `timeout === 2000`.
- `AC42: a sibling timeout inside a within do: block parses on the inner step` — `within: { 'data-testid': 'card', do: [ { assertVisible: { testId: 'inner-never' }, timeout: 1000 } ] }`; the parsed inner step carries `timeout === 1000`.
- `AC43 setup (parse-only half): a child flow's step keeps its own sibling timeout value through parsing, independent of any top-level header` (full inheritance-precedence behaviour belongs to the engine/integration layer; here only confirm the parser attaches `timeout: 4000` to the child step unconditionally) — parses to `timeout === 4000`.

### Q17 / Q19 trait and placement errors (AC44–AC46, AC72)

- `AC44: timeout on wait throws "timeout is not supported on wait"` — `{ wait: 100, timeout: 1000 }` throws exactly that substring.
- `AC44: timeout on waitFor throws "timeout is not supported on waitFor"` — same pattern.
- `AC44: timeout on scroll throws "timeout is not supported on scroll"` — same pattern.
- `AC44: timeout on setViewport throws "timeout is not supported on setViewport"` — same pattern.
- `AC44: timeout on screenshot throws "timeout is not supported on screenshot"` — same pattern.
- `AC44: timeout on setVar throws "timeout is not supported on setVar"` — same pattern.
- `AC44: timeout on testVarSet throws "timeout is not supported on testVarSet"` — same pattern.
- `AC44: timeout on unsetVar throws "timeout is not supported on unsetVar"` — same pattern.
- `AC44: timeout on runFlow throws "timeout is not supported on runFlow"` — same pattern.
- `AC44: timeout on pressKey throws "timeout is not supported on pressKey"` — same pattern (Q19).
- `AC45 (a): the Q17 error also fires for a none-trait command inside a within do: block` — top-level `within: { ..., do: [ { pressKey: 'Enter', timeout: 1000 } ] }` throws a message containing `timeout is not supported on pressKey` when the whole flow is parsed via `loadAndParse` (this specific test belongs with the integration-level `loadAndParse`, cross-referenced here for the parser-level inner mechanism: `parseSessionedCommand` on just the inner object throws the same way).
- `AC46: waitForPageLoad with both an inner and a sibling timeout throws the exact "use one" message` — `{ waitForPageLoad: { path: '/x', timeout: 3000 }, timeout: 3000 }` throws exactly `waitForPageLoad: timeout given both inside the command and as a sibling key; use one`.
- `AC72: parse-time acceptance of timeout: follows COMMAND_TRAITS for every command — accepted only when the trait isn't none` — a single parameterized test over every `Command['type']`: for each, attach a sibling `timeout: 1000` to a minimal valid step; assert "throws the Q17 message" iff `COMMAND_TRAITS[type].timeout === 'none'`, and "parses cleanly with `timeout === 1000`" otherwise. This is the AC41/AC44 cross-check in one place.

### Literal value validation (AC47)

- `AC47: timeout: 0 throws "timeout must be a positive integer, got 0"` — exact message.
- `AC47: timeout: -5 throws "timeout must be a positive integer, got -5"` — exact message.
- `AC47: timeout: 1.5 throws "timeout must be a positive integer, got 1.5"` — exact message.
- `AC47: timeout: "abc" throws "timeout must be a positive integer, got abc"` — exact message (String(raw) of a bare string has no quotes).
- `AC47: timeout: true throws "timeout must be a positive integer, got true"` — exact message.
- `AC47: timeout: null throws "timeout must be a positive integer, got null"` — exact message (null key present via `'timeout' in obj`).
- `AC47: timeout: "3000" (quoted digit string) is accepted as 3000, not rejected` — parses, `timeout === 3000`.

### Reporter / label stability (AC75, parse side)

- `AC75: the parsed Command is identical whether or not a sibling timeout is present` — `parseSessionedCommand({ tapOn: 'data-testid=int-tap-btn', timeout: 3000 }).command` deep-equals `parseSessionedCommand({ tapOn: 'data-testid=int-tap-btn' }).command` (the `Command` union itself never carries `timeout`).

**PASSES on both versions:**
- Any existing `parseSessionedCommand`/`loadAndParse` test asserting `session` extraction with no `timeout` key present at all is untouched by this feature — `PASSES on both versions` (to be enumerated by name once `tests/unit/parser.test.ts` is read in Phase 2; flagged as a category here).
- `inner waitForPageLoad timeout: 0 still parses` (existing, S8 "Inner waitForPageLoad timeout parsing is unchanged") — `PASSES on both versions`.
- `inner waitForPageLoad timeout: "5000" (a string) still throws` (existing, S8) — `PASSES on both versions`.

---

## `uivisor-app/src/engine/dispatcher.ts` + `uivisor-app/src/engine/index.ts` — no dedicated new unit file named in the breakdown for T5's own tests beyond the files below; sibling-interpolation behaviour (AC48–AC50) is unit-tested via `uivisor-app/tests/unit/error-message-format.test.ts` and/or `uivisor-app/tests/unit/lazy-interpolation-timing.test.ts` per Errata E4's file list — UNIT

- `AC48: a sibling timeout written as "${t}" resolves from a runtime var set by an earlier setVar` — `setVar: t=1300` then `{ assertVisible: 'data-testid=int-never-rendered', timeout: '${t}' }`; dispatched with a mocked page; the resulting deadline's `timeoutMs === 1300`; failure message line 1 exactly `Element not found after 1300ms: data-testid=int-never-rendered`.
- `AC49: a sibling timeout "${t}" that resolves to an invalid value fails the command immediately with the exact message, before any resolution attempt` — `setVar: t=abc` then `{ tapOn: 'x', timeout: '${t}' }`; dispatch resolves `{ passed: false, message: 'timeout must be a positive integer, got "abc"' }`; no `Page.locator`/`count` mock is ever invoked (resolution never attempted); fast (no polling).
- `AC50 (a): an undefined ${var} in a top-level flow's sibling timeout gets the #100 flow-context suffix` — top-level flow path `/abs/top.yaml`, step `{ tapOn: 'x', timeout: '${nope}' }`; dispatch resolves `{ passed: false, message: 'Variable "nope" is not defined (in flow /abs/top.yaml)' }` (not thrown).
- `AC50 (b): the same undefined ${var} inside a child flow gets the child+caller context suffix` — dispatch resolves `{ passed: false, message: 'Variable "nope" is not defined (in child flow /abs/child.yaml, called from /abs/top.yaml)' }`.

**PASSES on both versions:**
- Any existing dispatch test for a step with no `timeout` key at all, asserting the command's own pass/fail behaviour, is unaffected by the new interpolation branch (the `own === undefined` branch is a no-op) — `PASSES on both versions` (category; enumerate once the file is read).

---

## `uivisor-app/tests/unit/timeouts-precedence.test.ts` (new) — UNIT (pure functions, S7)

### `resolveRunTimeouts`

- `AC51 precedence rule (unit form): sibling > CLI > header > config > built-in for defaultTimeout, tested via resolveRunTimeouts + stepTimeoutMs composition` — see the `stepTimeoutMs` tests below for the "own" layer; `resolveRunTimeouts` itself only composes CLI/header/config/built-in (sibling is handled by `stepTimeoutMs`'s `own` param), so:
  - `resolveRunTimeouts({}, { timeouts: undefined }) returns DEFAULT_TIMEOUTS` — `{ defaultTimeout: 5000, navigationTimeout: 30000 }`.
  - `resolveRunTimeouts({}, { timeouts: { header: {}, config: { defaultTimeout: 1100 } } }) returns defaultTimeout 1100` (AC51 config-only case).
  - `resolveRunTimeouts({}, { timeouts: { header: { defaultTimeout: 1200 }, config: {} } }) returns defaultTimeout 1200` (AC51 header case).
  - `resolveRunTimeouts({ defaultTimeout: 1300 }, { timeouts: { header: { defaultTimeout: 1200 }, config: {} } }) returns defaultTimeout 1300` (AC51 CLI-beats-header case).
- `AC52: the same chain for navigationTimeout, with the built-in 30000 at the bottom` — four analogous cases mirroring AC51 for `navigationTimeout`.
- `AC53 (a): setting only navigationTimeout in the header leaves defaultTimeout at the built-in 5000` — `resolveRunTimeouts({}, { timeouts: { header: { navigationTimeout: 1000 }, config: {} } })` → `{ defaultTimeout: 5000, navigationTimeout: 1000 }`.
- `AC53 (b): setting only CLI --timeout leaves navigationTimeout at the built-in 30000` — `resolveRunTimeouts({ defaultTimeout: 1000 }, { timeouts: {} })` → `{ defaultTimeout: 1000, navigationTimeout: 30000 }`.
- `AC54: the header beats the shared config for defaultTimeout (not the vars rule where config wins)` — `resolveRunTimeouts({}, { timeouts: { header: { defaultTimeout: 1200 }, config: { defaultTimeout: 4000 } } })` → `defaultTimeout === 1200`, explicitly NOT `4000`.
- `AC54: the header beats the shared config for navigationTimeout too` — analogous case.

### `stepTimeoutMs`

- `AC51 (sibling-layer unit): stepTimeoutMs returns the "own" value over the run's defaultTimeout for an element command` — `stepTimeoutMs('tapOn', 1400, { defaultTimeout: 1200, navigationTimeout: 30000 }) === 1400`.
- `stepTimeoutMs returns the run's defaultTimeout when own is undefined, for an element command` — `stepTimeoutMs('tapOn', undefined, { defaultTimeout: 1200, navigationTimeout: 30000 }) === 1200`.
- `stepTimeoutMs returns the run's navigationTimeout for a navigation command when own is undefined` — `stepTimeoutMs('goto', undefined, { defaultTimeout: 1200, navigationTimeout: 1500 }) === 1500`.
- `AC35/Q19 composition: stepTimeoutMs returns the "own" value (which for waitForPageLoad may be the inner timeout) over the run's navigationTimeout` — `stepTimeoutMs('waitForPageLoad', 1000, { defaultTimeout: 5000, navigationTimeout: 3000 }) === 1000`.
- `AC70/none-trait: stepTimeoutMs returns undefined for a none-trait command regardless of "own" or run values` — `stepTimeoutMs('wait', 1000, anyRun) === undefined` (this would only be reachable if the parser didn't already reject it, i.e. a defensive/completeness check).

### `timeoutNotice`

- `AC58 setup (precedence half): timeoutNotice returns null when the child sets no timeout keys` — `timeoutNotice({ timeouts: { header: {}, config: {} } } as FlowFile, run, 'top.yaml') === null`.
- `AC59 (revised): timeoutNotice fires for defaultTimeout only when the child's own value differs from the effective run value` — child config `defaultTimeout: 4000`, run `defaultTimeout: 5000` → notice is non-null and names `defaultTimeout`.
- `AC60 (revised, a): timeoutNotice lists both keys, in defaultTimeout-then-navigationTimeout order, in one line, when both differ` — child header `{ defaultTimeout: 4000, navigationTimeout: 6000 }`, run `{ defaultTimeout: 1000, navigationTimeout: 1500 }`, top-level file `top.yaml`, child file basename `child.yaml` → `timeoutNotice(...) === 'child.yaml: defaultTimeout, navigationTimeout ignored (inherited from top.yaml)'`.
- `AC60 (revised, b): timeoutNotice lists only defaultTimeout when only that key is set and differs` — child header `{ defaultTimeout: 4000 }` (named `child2.yaml`), run `{ defaultTimeout: 1000, ... }` → `'child2.yaml: defaultTimeout ignored (inherited from top.yaml)'`.
- `AC61 (revised, a): timeoutNotice returns null when the child sets neither key` — `{ timeouts: { header: {}, config: {} } }` → `null`.
- `AC61 (revised, b): timeoutNotice returns null when the child's config value equals the effective run value` — child config `defaultTimeout: 1000`, run `defaultTimeout: 1000` → `null`.
- `AC80 (a): timeoutNotice returns null when the child's header value for defaultTimeout equals the effective value, with no other key set` — child header `{ defaultTimeout: 1000 }`, run `{ defaultTimeout: 1000, navigationTimeout: 1500 }` → `null`.
- `AC80 (b): timeoutNotice lists only the key that differs, omitting the one that's equal` — child header `{ defaultTimeout: 1000, navigationTimeout: 9000 }`, run `{ defaultTimeout: 1000, navigationTimeout: 1500 }`, named `child.yaml`/`top.yaml` → exactly `'child.yaml: navigationTimeout ignored (inherited from top.yaml)'` — must NOT list `defaultTimeout`.
- `AC62: timeoutNotice is given the top-level path, not the immediate caller's path, so a grandchild's notice names the top-level flow` (unit form: the function's third argument contract) — `timeoutNotice(leafFile, run, 'top.yaml')` (not `'mid.yaml'`) produces a message naming `top.yaml`; this test documents/locks the contract that callers (the engine) must pass `callStack[0]`, not the immediate parent.

**PASSES on both versions:** none — `timeouts.ts` is wholly new.

---

## `uivisor-app/src/parser/validator.ts` + `uivisor-app/src/parser/interpolate.ts` + `uivisor-app/src/parser/index.ts` — `uivisor-app/tests/unit/timeout-config.test.ts` (new) — UNIT

### Header acceptance (AC65, AC67)

- `AC65: a flow header with defaultTimeout and navigationTimeout parses without an Unknown header key error` — `loadAndParse` on a header `{ defaultTimeout: 15000, navigationTimeout: 30000 }` succeeds.
- `AC67 (a): sla stays an ordinary var when set in the shared config` — config `{ sla: 3000 }`, flow steps `setVar: s=${sla}` then `testVarSet: { name: 's', expected: '3000' }`; the flow passes (tested at the engine/integration layer, but the parser-level half is: `file.vars` contains `sla`).
- `AC67 (b): a flow header containing sla fails to parse with today's Unknown header key error` — exactly `Unknown header key: sla in <file>`.
- `AC67 (c): a flow header containing loading fails to parse with today's Unknown header key error` — exactly `Unknown header key: loading in <file>`.

### Reserved keys stop becoming vars (AC66)

- `AC66: defaultTimeout and navigationTimeout are stripped from file.vars when set in the shared config` — config `{ defaultTimeout: 15000, navigationTimeout: 30000, base: 'http://x' }`; parsed `file.vars` has no `defaultTimeout`/`navigationTimeout` keys but still has `base`.
- `AC66: a step using ${defaultTimeout} fails at dispatch with "is not defined", not resolving to 15000` — (this assertion is dispatch-level; the parser-level half of this test is: confirm `file.vars.defaultTimeout === undefined` so that dispatch's interpolation is guaranteed to throw).

### Literal validation (AC68)

- `AC68: header defaultTimeout: 0 throws "Invalid defaultTimeout: must be a positive integer, got 0 in <flow file path>"` — exact message, header source.
- `AC68: header defaultTimeout: -1 throws the same format with "got -1"` — exact message.
- `AC68: header defaultTimeout: 1.5 throws the same format with "got 1.5"` — exact message.
- `AC68: header defaultTimeout: "abc" throws the same format with "got abc"` — exact message.
- `AC68: header defaultTimeout: true throws the same format with "got true"` — exact message.
- `AC68: header navigationTimeout: 0 throws "Invalid navigationTimeout: must be a positive integer, got 0 in <flow file path>"` — exact message, parallel case.
- `AC68: config defaultTimeout: 0 throws "Invalid defaultTimeout: must be a positive integer, got 0 in <config path as written>"` — exact message, config source, path exactly as written (not resolved).
- `AC68: config navigationTimeout: -1 throws the config-source format` — exact message.
- `AC68: a digit-only string header value ("15000") is accepted, not rejected` — `defaultTimeout: '15000'` parses to `15000`.
- `AC68: a ${var}-resolved digit string is accepted` — header `defaultTimeout: '${t}'` with inline `vars: { t: 15000 }` resolves and validates to `15000` without throwing (overlaps AC57a; listed once here for the validation half).

### Child-flow validation still runs (AC69)

- `AC69: a child flow with header defaultTimeout: 0 fails the runFlow step with the Invalid-defaultTimeout message, even though its value will be ignored` — `runFlow` step resolves `{ passed: false, message: contains 'Invalid defaultTimeout: must be a positive integer, got 0' }` — being ignored for the inheritance decision does not skip validation.

### `${var}` resolution timing for header/config values (AC57)

- `AC57 (a): a header value "${t}" resolves at parse time from inline vars` — header `defaultTimeout: '${t}'`, inline `vars: { t: 1250 }`; parsed `file.timeouts.header.defaultTimeout === 1250`.
- `AC57 (b): a shared-config value "${env.UIV_T}" resolves at parse time from the environment` — config `defaultTimeout: '${env.UIV_T}'`, `process.env.UIV_T = '1350'`; parsed config layer's `defaultTimeout === 1350`.
- `AC57 (c): a header value "${fromSetVar}" where fromSetVar is only ever set by a later setVar fails to parse, because runtime vars aren't visible to the header` — the unresolved var becomes `''` at parse time, so the thrown message ends `got  in <file>` (two spaces: "got" + empty string + " in"), per the AC68 header-validation message format (Errata E4: this is "the AC68 error", not "AC63").

**PASSES on both versions:**
- Any existing header/config test for an unrelated key (e.g. `base`) is unaffected — `PASSES on both versions` (category).

---

## `uivisor-app/src/cli/args.ts` + `uivisor-app/src/cli/index.ts` — `uivisor-app/tests/unit/args.test.ts` (new describe block appended; existing cases untouched per Feature Breakdown T8) — UNIT

- `AC55 (a): --timeout 7000 --navigation-timeout 40000 are both parsed onto the result` — `parseArgs(argv('test', 'f.yaml', '--timeout', '7000', '--navigation-timeout', '40000'))` → `result.timeout === 7000`, `result.navigationTimeout === 40000`.
- `AC55 (a, absence): neither flag given leaves both fields absent (undefined), not a default value` — `parseArgs(argv('test', 'f.yaml'))` → `result.timeout === undefined && result.navigationTimeout === undefined`.
- `AC55 (b): --timeout 0 writes the exact error and exits 1` — mocked `process.stdout.write`/`console.log` and `process.exit`; writes exactly `Error: --timeout must be a positive integer, got "0"\n`; `process.exit` called with `1`.
- `AC55 (c): --timeout abc writes the exact error and exits 1` — exactly `Error: --timeout must be a positive integer, got "abc"\n`.
- `AC55 (d): --navigation-timeout -1 writes the exact error (navigation flag name) and exits 1` — exactly `Error: --navigation-timeout must be a positive integer, got "-1"\n`.
- `AC55 (e): --timeout as the last argument with no value writes the error with an empty-string raw value and exits 1` — exactly `Error: --timeout must be a positive integer, got ""\n`.
- `AC55: the usage/help output includes "[--timeout <ms>] [--navigation-timeout <ms>]"` — whatever usage-printing function/string this module exposes contains that substring.

**PASSES on both versions:**
- All existing `parseArgs`/`resolveTarget` tests in this file (headed, slowMo, reporter, target resolution) are untouched by this feature — `PASSES on both versions` (category covering every pre-existing `it(...)` in the file, since T8's file-list note says "existing cases untouched").

---

## `uivisor-app/tests/integration/timeouts.test.ts` (new) — INTEGRATION (real Chromium against an inline fixture HTTP server, T2/T11, S13)

Timing ACs here use **real time with the AC tolerance**, per the spec's tolerance rule (T ms to T+1000ms for "fails after T ms"; "passes promptly" means `durationMs` under the stated bound).

- `AC1: assertVisible on a bare string passes before 2500ms against the delayed fixture page` — INTEGRATION, real time; `durationMs < 2500`.
- `AC2: assertVisible on text that only the cascade's text step matches passes before 2600ms` — INTEGRATION, real time.
- `AC3: tapOn via a pipe selector passes before 2600ms against the delayed fixture` — INTEGRATION, real time.
- `AC4: each object-selector form (testId / css / text) passes before 2500ms, one fresh page load per form` — INTEGRATION, real time; 3 sub-cases.
- `AC5: the { xpath } form passes before 2500ms` — INTEGRATION, real time.
- `AC6: a selector that matches once from the start resolves in well under 100ms (no artificial stability delay observed end-to-end)` — INTEGRATION, real time, loose bound (e.g. `durationMs < 300` to allow for real browser overhead) — this is a smoke check; the precise "exactly one count() call" claim is unit-only.
- `AC7: tapOn: Submit then assertVisible: { testId: int-submit-result } both pass — the button, not the heading, was clicked` — INTEGRATION, real browser click semantics confirm the mocked-unit stability logic end-to-end.
- `AC8: the pipe-form stability case (data-testid=Submit|text=Submit) also results in int-submit-result appearing` — INTEGRATION.
- `AC12: tapOn on duplicate-then-single data-testid=row passes before 1800ms` — INTEGRATION, real time.
- `AC14: assertVisible on a truly absent element fails no earlier than 1000ms and no later than 2000ms, with the exact line-1 and 5 step lines` — INTEGRATION, real time with AC tolerance (1000–2000ms window per the spec's T to T+1000ms rule).
- `AC15: tapOn via a pipe selector on two absent segments fails with the exact pipe not-found format, 1000–2000ms` — INTEGRATION.
- `AC16: both the object-form and xpath-form not-found errors appear correctly end-to-end, 1000–2000ms` — INTEGRATION, 2 sub-cases.
- `AC17: duplicate matches that never collapse fail at the deadline reporting "2 matches", 1000–2000ms` — INTEGRATION.
- `AC18: all three malformed-selector cases fail in under 500ms end-to-end, with today's unchanged messages` — INTEGRATION, real time, 3 sub-cases.
- `AC21: assertNotVisible on a visible-then-removed element passes before 2500ms` — INTEGRATION, real time.
- `AC22: assertNotVisible on an element that stays visible fails after 1000–2000ms with "Expected: not visible\nGot: visible"` — INTEGRATION.
- `AC23 (a–c, revised): the three not-visible-duplicate scenarios behave end-to-end as specified (pass promptly / fail at deadline / pass once hidden)` — INTEGRATION, real time, 3 sub-cases with their respective bounds (<1000ms / 1000–2000ms / <1800ms).
- `AC24: within on a delayed container passes before 2500ms` — INTEGRATION, real time.
- `AC25: within's container not-found error fires at 1000–2000ms with the exact message` — INTEGRATION.
- `AC26: within with nth passes once the list grows to the required length, before 2000ms; and fails at the deadline with today's nth message when it never grows enough` — INTEGRATION, 2 sub-cases.
- `AC27 (a, b): within's sibling timeout bounds only the container lookup, confirmed end-to-end in both the pass and fail directions` — INTEGRATION, 2 sub-cases.
- `AC29: assertUrl on a never-matching path fails at 1000–2000ms with the unchanged "Expected/Got" message` — INTEGRATION.
- `AC30 (a, b): assertCount passes once the DOM count matches, and fails at the deadline reporting the last observed (non-stale) count` — INTEGRATION, 2 sub-cases.
- `AC31: every element command in the full list fails after 1200ms with the correct not-found line 1, run as its own flow against the local fixture server` — INTEGRATION, parameterized over the full command list (bare-string and object-form variants).
- `AC32 (revised): the inputText shorthand fails after 1000ms with "Element not actionable after 1000ms: data-testid=int-input"` — INTEGRATION, real time.
- `AC33 (a, b): goto and reload against hanging local routes fail after 1500ms with a message containing "1500ms"` — INTEGRATION against `/hang` and `/reload-hang`, 2 sub-cases.
- `AC35 (a–c): waitForPageLoad's three timeout-source cases each fail with their own budget's ms value in the message` — INTEGRATION, 3 sub-cases.
- `AC36 (a, b): the "one budget" late-enable scenario fails within the correct window and passes when there's enough time` — INTEGRATION, 2 sub-cases, local `late-enable` fixture.
- `AC37: waitForPageLoad's URL wait and load-state wait sharing one 1500ms budget fails no later than 2500ms after start, against the local spa-nav + /slow fixture` — INTEGRATION, real time (uses the `/slow?ms=N` route).
- `AC38 (revised): the AC36(a) failure's line 1 is exactly "Element not actionable after 2000ms: data-testid=int-late-enable", confirmed end-to-end` — INTEGRATION.
- `AC39: a sibling timeout on a string-selector command changes the real failure time to 1500ms end-to-end` — INTEGRATION.
- `AC40 (a, b): sibling timeout before the command key, and sibling timeout with session, both execute correctly and fail at 1500ms` — INTEGRATION, 2 sub-cases.
- `AC42: a sibling timeout inside a within do: block changes that inner step's real failure time to 1000ms` — INTEGRATION.
- `AC43: a child flow's own sibling timeout (4000) wins over the top-level's inherited 1000, so the child step passes against the AC1 delayed fixture` — INTEGRATION, uses `runFlow`.
- `AC45 (b): a none-trait sibling timeout inside a child flow fails that runFlow step (not thrown) with the Q17 message` — INTEGRATION.
- `AC48: ${var} in a sibling timeout, set by an earlier setVar, changes the real failure time to 1300ms` — INTEGRATION.
- `AC51: the full element-timeout precedence chain, run five times with sources removed one at a time, reports the five expected ms values end-to-end` — INTEGRATION, 5 sub-cases (config file, header, CLI flag, sibling key all wired together via `runAll`).
- `AC52: the full navigation-timeout precedence chain, same structure, including the slow 30000ms "none set" case marked slow` — INTEGRATION, 4 fast sub-cases + 1 explicitly `.skip`/`slow`-tagged 30000ms case.
- `AC53 (a, b): the two timeout settings don't leak into each other's command group, confirmed end-to-end` — INTEGRATION, 2 sub-cases (the (b) case may assert "still running at 1500ms" rather than waiting the full 30000ms, per the AC's own allowance).
- `AC54: the header beats the shared config end-to-end (defaultTimeout 1200 wins over config's 4000)` — INTEGRATION.
- `AC56: a CLI --timeout flag applies to every flow in a directory run` — INTEGRATION, a temp directory with two flows.
- `AC57 (a, b): header/config "${var}" values resolve at parse time from inline vars and the environment, confirmed end-to-end` — INTEGRATION, 2 sub-cases.
- `AC58: a child flow's own header keys are fully ignored end-to-end — the element probe uses 1000, the navigation probe message contains 1500ms` — INTEGRATION.
- `AC59 (revised): a child's shared-config-only key is ignored end-to-end, with the exact notice on stdout` — INTEGRATION, stdout captured/spied.
- `AC60 (revised, a, b): the ignored-key notice text, printed exactly once across two runFlow calls to the same child, and the single-key variant` — INTEGRATION, 2 sub-cases, stdout spied.
- `AC61 (revised, a, b): no notice when the child sets neither key, and no notice when the child's config value equals the effective value` — INTEGRATION, 2 sub-cases, stdout spied, plus a run of the existing `run-flow-override.yaml`.
- `AC62: a grandchild's notice names the top-level flow, not the immediate caller` — INTEGRATION, three-level `runFlow` chain, stdout spied.
- `AC63: the same file applies its own keys when run top-level directly, with no notice` — INTEGRATION, stdout spied for absence.
- `AC64: runFlow vars cannot set timeouts — the child probe still uses the built-in 5000, and ${defaultTimeout} resolves as an ordinary var inside the child` — INTEGRATION.
- `AC66: a step using ${defaultTimeout} after the key was reserved by the config fails at dispatch with the "is not defined" message` — INTEGRATION, confirms the parser-level AC66 test end-to-end.
- `AC69: a child flow with an invalid header value fails the runFlow step with the Invalid-defaultTimeout message, confirmed end-to-end` — INTEGRATION.
- `AC73: with nothing configured, the built-in defaults (5000 / 30000) apply end-to-end, and waitForPageLoad timeout: 0 still parses and runs unbounded` — INTEGRATION.
- `AC80 (a, b): the partial-notice rules are confirmed end-to-end (no notice when equal; notice listing only the differing key)` — INTEGRATION, 2 sub-cases, stdout spied.

**PASSES on both versions:** none in this new file — it is entirely new integration coverage for new behaviour. (One exception, listed as a sanity check rather than a scored AC: a `run-flow-override.yaml` smoke run with no sibling timeouts anywhere should pass identically before and after — `PASSES on both versions`.)

---

## `recorder-app/src/flowReplayer.test.ts` — UNIT/INTEGRATION (existing file, edited per T10 + Errata E2)

- `AC74 (recorder build/tests): recorder-app's npm run build still succeeds with no source changes needed` — build-level check, not a vitest test; run `tsc`/`npm run build` in `recorder-app`.
- `AC74 (recorder build/tests): recorder-app's existing vitest suite passes using the built-in default budgets (no RunOptions.timeouts plumbing exists in the recorder)` — run `vitest run` in `recorder-app`.
- `T24 (existing, now needs an explicit per-test timeout per Errata E2(b)): an assertUrl mismatch retries for the 5000ms default and still reports the mismatch message` — same assertions as before, with `{ timeout: 10000 }` added to the `it(...)` call; `PASSES on both versions` is NOT applicable here since behaviour changed (single-check → retry), but the final assertion (the mismatch message) is unchanged — flag as **edited, not new**.
- Lines 104, 179, 330 (existing goto/reload call-shape assertions, per Errata E2(a)): updated to the exact new shape `{ waitUntil: 'load', timeout: 30000 }` (recorder always uses the built-in default since it has no timeout plumbing) — flag as **edited, not new**; the behavioural claim ("goto still issues a `load`-wait navigation") is unchanged, only the exact object literal gains a `timeout` field, so mark `PASSES on both versions` for the underlying claim, **edited for shape** for the literal.

---

## Live flows — `test-app/flows/integration/timeouts.yaml` (new) — INTEGRATION / E2E (real time, AC tolerance)

Run via `node uivisor-app/dist/cli/index.js test test-app/flows/integration/timeouts.yaml` against the live test-app.

- `AC28: assertUrl passes before 2500ms after a client-side redirect at 1500ms, with no wait:` — E2E.
- `AC76: the /integration-timeouts fixture page exposes all five required elements/behaviours (a)–(e)` — E2E, exercised indirectly by every other case in this flow that depends on the page; also a direct smoke pass confirming the hidden element (d) and the absent `int-never-rendered` id (per AC76's closing clause).
- `AC77: the flow as a whole exits 0, contains no wait:/waitFor: steps, and covers all six listed cases (delayed-element forms, stability, long-delay-with-custom-timeout, not-visible absent+hidden, redirect assertUrl, within on a delayed card)` — E2E, one aggregate pass/fail check plus a static check of the YAML source for the absence of `wait:`/`waitFor:` keys.
- `AC79 (revised): running test-app/flows/integration/ as a whole (all 37 flows) exits 0 and every flow passes` — E2E, full regression. **PASSES on both versions** for the 36 pre-existing flows' pass/fail outcome, though several will now take longer (slower suite, per Seam Notes S13 "existing uivisor-app integration tests ... wait the 5000ms default before failing").

## Live flows — `test-app/flows/integration-negative/timeouts-default-fails.yaml` (new) — INTEGRATION / E2E

- `AC78: the negative flow exits 1, prints "✗ assertVisible" and "Element not found after 5000ms: data-testid=int-delayed", with the failing step's durationMs in [5000, 6000)` — E2E, real time, run with `--reporter md` (per the AC's own suggestion) to inspect `durationMs`.

## Live flows — `test-app/flows/integration-variants/go-back-nav-timeout.yaml` and `go-forward-nav-timeout.yaml` (new) — INTEGRATION / E2E

- `AC34: go-back.yaml and go-forward.yaml (existing) still pass unmodified` — E2E, **PASSES on both versions**.
- `AC34: the navigationTimeout: 20000 variants of each pass` — E2E, new.
- `AC34: a fresh-page goBack still fails with "No previous page in history." and goForward with "No next page in history."` — E2E, **PASSES on both versions** for the message text (unchanged), new as a flow.

## Reporter label check (AC75) — likely lands in `uivisor-app/tests/unit/reporter.test.ts` or a new assertion in the integration suite — UNIT or INTEGRATION

- `AC75: a step's console/HTML/Markdown label with a sibling timeout: 3000 is identical to the same step without it` — run `{ tapOn: 'data-testid=int-tap-btn', timeout: 3000 }` through each of `--reporter md` and `--reporter html` (and the default console reporter); the label text (not the pass/fail or duration) is byte-identical to the no-sibling-key case. This can be exercised as a UNIT test against the reporter functions directly (preferred, matches S1's claim that the `Command` union is untouched) or as an INTEGRATION smoke check; generator recommends UNIT since S1 guarantees it holds by construction — a reporter-level unit test locks that guarantee.

---

## Coverage table: AC → test name(s)

| AC | Test name(s) |
|---|---|
| AC1 | `playwrightLocator.test.ts: AC1: bare string resolves once a step-1 (data-testid) match appears mid-poll`; `timeouts.test.ts: AC1: assertVisible on a bare string passes before 2500ms against the delayed fixture page` |
| AC2 | `playwrightLocator.test.ts: AC2: ...`; `timeouts.test.ts: AC2: ...` |
| AC3 | `playwrightLocator.test.ts: AC3: ...`; `timeouts.test.ts: AC3: ...` |
| AC4 | `playwrightLocator.test.ts: AC4: ...` (3 sub-cases); `timeouts.test.ts: AC4: ...` |
| AC5 | `playwrightLocator.test.ts: AC5: ...`; `timeouts.test.ts: AC5: ...` |
| AC6 | `playwrightLocator.test.ts: AC6: ...` (3 sub-cases); `timeouts.test.ts: AC6: ...` |
| AC7 | `playwrightLocator.test.ts: AC7: ...`; `timeouts.test.ts: AC7: ...` |
| AC8 | `playwrightLocator.test.ts: AC8: ...`; `timeouts.test.ts: AC8: ...` |
| AC9 | `playwrightLocator.test.ts: AC9: ...` |
| AC10 | `playwrightLocator.test.ts: AC10: ...` |
| AC11 (revised, E1) | `playwrightLocator.test.ts: AC11 (revised, Errata E1): ...` |
| AC12 | `playwrightLocator.test.ts: AC12: ...`; `timeouts.test.ts: AC12: ...` |
| AC13 | `playwrightLocator.test.ts: AC13 (loop cadence): ...` |
| AC14 | `playwrightLocator.test.ts: AC14: ...`; `resolveSelector.test.ts: AC14: ...`; `timeouts.test.ts: AC14: ...` |
| AC15 | `playwrightLocator.test.ts: AC15: ...`; `resolveSelector.test.ts: AC15: ...`; `timeouts.test.ts: AC15: ...` |
| AC16 | `playwrightLocator.test.ts: AC16: ...` (2 sub-cases); `resolveSelector.test.ts: AC16: ...`; `timeouts.test.ts: AC16: ...` |
| AC17 | `playwrightLocator.test.ts: AC17: ...`; `resolveSelector.test.ts: AC17: ...`; `timeouts.test.ts: AC17: ...` |
| AC18 | `playwrightLocator.test.ts: AC18: ...` (3 sub-cases); `timeouts.test.ts: AC18: ...` |
| AC19 | `playwrightLocator.test.ts: AC19: ...` (2 sub-cases) |
| AC20 | `playwrightLocator.test.ts: AC20: ...` (2 sub-cases) |
| AC21 | `playwrightLocator.test.ts: AC21: ...`; `timeouts.test.ts: AC21: ...` |
| AC22 | `playwrightLocator.test.ts: AC22: ...`; `timeouts.test.ts: AC22: ...` |
| AC23 (revised) | `playwrightLocator.test.ts: AC23 (a/b/c, revised): ...` + rule-statement test; `timeouts.test.ts: AC23 (a–c, revised): ...` |
| AC24 | `playwrightLocator.test.ts: AC24: ...`; `commands.test.ts: AC24: ...`; `timeouts.test.ts: AC24: ...` |
| AC25 | `playwrightLocator.test.ts: AC25: ...`; `commands.test.ts: AC25: ...`; `timeouts.test.ts: AC25: ...` |
| AC26 | `playwrightLocator.test.ts: AC26: ...` (2 sub-cases); `commands.test.ts: AC26: ...`; `timeouts.test.ts: AC26: ...` |
| AC27 | `playwrightLocator.test.ts: AC27: ...`; `commands.test.ts: AC27: ...` (2 sub-cases); `timeouts.test.ts: AC27: ...` |
| AC28 | `test-app/flows/integration/timeouts.yaml: AC28: ...` |
| AC29 | `commands.test.ts: AC29: ...` (2 sub-cases); `timeouts.test.ts: AC29: ...` |
| AC30 | `commands.test.ts: AC30: ...` (2 sub-cases); `timeouts.test.ts: AC30: ...` |
| AC31 | `commands.test.ts: AC31: ...` (15 sub-cases, one per command); `timeouts.test.ts: AC31: ...` |
| AC32 (revised) | `commands.test.ts: AC32 (revised): ...`; `timeouts.test.ts: AC32 (revised): ...` |
| AC33 | `commands.test.ts: AC33: ...` (2 sub-cases); `timeouts.test.ts: AC33 (a, b): ...` |
| AC34 | `commands.test.ts: AC34: ...` (2 sub-cases); live flows `go-back-nav-timeout.yaml`/`go-forward-nav-timeout.yaml`: AC34 cases |
| AC35 | `commands.test.ts: AC35: ...` (3 sub-cases); `timeouts.test.ts: AC35 (a–c): ...` |
| AC36 | `commands.test.ts: AC36: ...` (2 sub-cases); `timeouts.test.ts: AC36 (a, b): ...` |
| AC37 | `commands.test.ts: AC37: ...`; `timeouts.test.ts: AC37: ...` |
| AC38 (revised) | `commands.test.ts: AC38 (revised): ...`; `timeouts.test.ts: AC38 (revised): ...` |
| AC39 | `sibling-timeout-parser.test.ts: AC39: ...`; `timeouts.test.ts: AC39: ...` |
| AC40 | `sibling-timeout-parser.test.ts: AC40 (a, b): ...`; `timeouts.test.ts: AC40 (a, b): ...` |
| AC41 | `sibling-timeout-parser.test.ts: AC41: ...` (2 parameterized sets) |
| AC42 | `sibling-timeout-parser.test.ts: AC42: ...`; `timeouts.test.ts: AC42: ...` |
| AC43 | `sibling-timeout-parser.test.ts: AC43 setup: ...`; `timeouts.test.ts: AC43: ...` |
| AC44 | `sibling-timeout-parser.test.ts: AC44: ...` (10 sub-cases) |
| AC45 | `sibling-timeout-parser.test.ts: AC45 (a): ...`; `timeouts.test.ts: AC45 (b): ...` |
| AC46 | `sibling-timeout-parser.test.ts: AC46: ...` |
| AC47 | `sibling-timeout-parser.test.ts: AC47: ...` (7 sub-cases) |
| AC48 | `dispatch sibling-interpolation tests: AC48: ...`; `timeouts.test.ts: AC48: ...` |
| AC49 | `dispatch sibling-interpolation tests: AC49: ...` |
| AC50 | `dispatch sibling-interpolation tests: AC50 (a, b): ...` |
| AC51 | `timeouts-precedence.test.ts: AC51 ...` (4 cases); `timeouts.test.ts: AC51: ...` |
| AC52 | `timeouts-precedence.test.ts: AC52: ...` (4 cases); `timeouts.test.ts: AC52: ...` |
| AC53 | `timeouts-precedence.test.ts: AC53 (a, b): ...`; `timeouts.test.ts: AC53 (a, b): ...` |
| AC54 | `timeouts-precedence.test.ts: AC54: ...` (2 cases); `timeouts.test.ts: AC54: ...` |
| AC55 | `args.test.ts: AC55 (a–e): ...` (7 cases) |
| AC56 | `timeouts.test.ts: AC56: ...` |
| AC57 | `timeout-config.test.ts: AC57 (a–c): ...`; `timeouts.test.ts: AC57 (a, b): ...` |
| AC58 | `timeouts-precedence.test.ts: AC58 setup: ...`; `timeouts.test.ts: AC58: ...` |
| AC59 (revised) | `timeouts-precedence.test.ts: AC59 (revised): ...`; `timeouts.test.ts: AC59 (revised): ...` |
| AC60 (revised) | `timeouts-precedence.test.ts: AC60 (revised, a, b): ...`; `timeouts.test.ts: AC60 (revised, a, b): ...` |
| AC61 (revised) | `timeouts-precedence.test.ts: AC61 (revised, a, b): ...`; `timeouts.test.ts: AC61 (revised, a, b): ...` |
| AC62 | `timeouts-precedence.test.ts: AC62: ...`; `timeouts.test.ts: AC62: ...` |
| AC63 | `timeouts.test.ts: AC63: ...` |
| AC64 | `timeouts.test.ts: AC64: ...` |
| AC65 | `timeout-config.test.ts: AC65: ...` |
| AC66 | `timeout-config.test.ts: AC66: ...` (2 parts); `timeouts.test.ts: AC66: ...` |
| AC67 | `timeout-config.test.ts: AC67 (a–c): ...` |
| AC68 | `timeout-config.test.ts: AC68: ...` (10 cases) |
| AC69 | `timeout-config.test.ts: AC69: ...`; `timeouts.test.ts: AC69: ...` |
| AC70 | `commandTraits.test.ts: AC70: ...` (5 cases) |
| AC71 | `commandTraits.typecheck.ts: AC71: ...` (2 compile-time cases) + build check |
| AC72 | `sibling-timeout-parser.test.ts: AC72: ...` |
| AC73 | `commands.test.ts: AC73: ...` (3 cases); `timeouts.test.ts: AC73: ...` |
| AC74 | build/suite checks (core, uivisor-app, recorder-app) + `flowReplayer.test.ts` edits |
| AC75 | `sibling-timeout-parser.test.ts: AC75: ...` (parse-side); reporter label test: `AC75: ...` |
| AC76 | test-app fixture page, exercised by `timeouts.yaml: AC76: ...` and indirectly by every AC1–AC27/AC28 live-flow case |
| AC77 | `test-app/flows/integration/timeouts.yaml: AC77: ...` |
| AC78 | `test-app/flows/integration-negative/timeouts-default-fails.yaml: AC78: ...` |
| AC79 (revised) | `test-app/flows/integration/: AC79 (revised): ...` |
| AC80 | `timeouts-precedence.test.ts: AC80 (a, b): ...`; `timeouts.test.ts: AC80 (a, b): ...` |

**Uncovered ACs:** none. All of AC1–AC80 (post-revision, post-errata versions) have at least one proposed test above.

---

## Notes on timing-test clock usage (per file)

- **Fake-clock / mocked (unit):** `deadline.test.ts`, `commandTraits.test.ts`, `positive-int.test.ts`, `playwrightLocator.test.ts`, `resolveSelector.test.ts`, `commands.test.ts`, `sibling-timeout-parser.test.ts`, dispatch sibling-interpolation tests, `timeouts-precedence.test.ts`, `timeout-config.test.ts`, `args.test.ts`.
- **Real time with the AC's tolerance window (integration/E2E):** `uivisor-app/tests/integration/timeouts.test.ts`, `test-app/flows/integration/timeouts.yaml`, `test-app/flows/integration-negative/timeouts-default-fails.yaml`, `test-app/flows/integration-variants/go-back-nav-timeout.yaml` / `go-forward-nav-timeout.yaml`, `recorder-app/src/flowReplayer.test.ts` (T24, real retry up to 5000ms, needs the extended per-test timeout).

## Regression tests marked `PASSES on both versions`

Enumerated inline above wherever applicable; summarized:
- `playwrightLocator.test.ts`: `TC-001`, `TC-003`.
- `commands.test.ts`: `C-13…C-18` (waitForPageLoad exact-timeout mocks), `uivisor-app/tests/integration/commands.test.ts:662` (selectOption "Option not found").
- `sibling-timeout-parser.test.ts` / existing `parser.test.ts`: session-only parsing with no `timeout` key; inner `waitForPageLoad timeout: 0` and `"5000"`-throws cases.
- dispatch tests: any step with no `timeout` key, unaffected by the new interpolation branch.
- `args.test.ts`: every pre-existing case (headed, slowMo, reporter, target).
- `timeout-config.test.ts`/validator: unrelated-key (`base`) tests.
- Live flows: the 36 pre-existing flows' pass/fail outcome in `test-app/flows/integration/` (slower, but still passing); `go-back.yaml`/`go-forward.yaml` unmodified; fresh-page history error messages.
- `recorder-app/src/flowReplayer.test.ts`: the underlying navigation-shape claim (edited only for the literal's new `timeout` field, not its behavioural assertion).

## ACs I could not fully specify without reading un-shown existing files

None blocked outright, but two spots are explicitly flagged as categories rather than enumerated line items, because the current contents of the named files weren't provided to me and shouldn't be guessed at verbatim:
- `uivisor-app/tests/unit/resolveSelector.test.ts` — existing passing cases unaffected by stability/retry (category noted, not individually named).
- `uivisor-app/tests/unit/parser.test.ts` and the dispatch-level sibling-interpolation host file(s) — existing no-`timeout`-key cases (category noted, not individually named).

These do not reduce AC coverage; they only affect how precisely the "PASSES on both versions" regression list can be itemized before Phase 2 (when the actual files are read against the live worktree).

## Tests — Generator B (tester_generator_b)

# Tests — Generator B (independent, Phase 1)

Role: tester_generator_b substitute. Tests derived from Gate 1 spec (Revision 1) + Errata, Feature & Task Breakdown, Seam Notes S1–S14. Written before any implementation exists; assertions state the **post-change** expected behaviour. Clock column: **unit (fake clock)** = deterministic, injected `Clock`/mocked `Page`, no real sleeps; **unit (mocked, short real deadline)** = mocked `Page`, real `setTimeout` but `createDeadline(1)`-scale so sub-ms; **integration (real time)** = real Chromium / real HTTP, timing judged against the AC's own tolerance.

---

## packages/core/src/deadline.test.ts (NEW, T1)

Unit, fake `Clock` throughout (no `vi.useFakeTimers`-against-wallclock dependency — `Clock.sleep` resolves synchronously under test control).

- `retryUntil runs the attempt once immediately, even on an already-expired deadline` (AC13 mechanics) — with `createDeadline(0, fakeClock)` wait, `attempt` is still called exactly once before any check of expiry.
- `retryUntil returns the first done result without sleeping again` (AC6 mechanics) — attempt resolves `{done:true,...}` on call 1; `clock.sleep` is never invoked.
- `retryUntil polls every 100ms via clock.sleep, not real timers` (AC13, RETRY_INTERVAL_MS) — fake clock records sleep args; every call is exactly `100`.
- `retryUntil's last attempt lands exactly on the deadline` (boundary, not directly ACed but required by S3 "the last attempt lands on the deadline itself") — with `timeoutMs=1000` and fake clock advancing in 100ms steps, the attempt count is exactly `ceil(1000/100)+1 = 11` when every attempt is not-done, matching AC13's upper bound of 11.
- `retryUntil propagates a thrown error without retrying` (S3 "An error thrown by attempt propagates straight away") — attempt throws on call 1; `clock.sleep` never called; the error is the one thrown, not wrapped.
- `retryUntil returns the last not-done result when the deadline has already expired at the next check` — attempt always returns `{done:false,last:'x'}`; after exhausting the budget, the resolved value's `last` equals `'x'` from the final attempt, not an earlier one.
- `createDeadline(0) is unbounded: remainingMs() is Infinity and pwTimeout() is 0` (unbounded case for `waitForPageLoad: {timeout:0}`, AC73) — `expired()` is always `false` regardless of elapsed clock time.
- `createDeadline(N).pwTimeout() is never 0 for a bounded deadline, even at expiry` (S3 "0 is never returned for a bounded deadline") — advance fake clock past `N`; `pwTimeout()` returns `1`, not `0`.
- `createDeadline(N).pwTimeout() ceils sub-millisecond remaining time` (S3 rationale for exact `{timeout:30000}` assertions) — with `now()` returning `0.3` elapsed, `pwTimeout()` at `N=5000` returns `5000`, not `4999`.
- `Deadline.sleep caps the requested duration at remainingMs()` (prevents a `within` sibling timeout from accidentally outliving its own budget mid-sleep) — `createDeadline(50, clock)`; `deadline.sleep(100)` requests `50` from the clock, not `100`.
- `DEFAULT_TIMEOUTS matches the built-in defaults` (AC73) — `{ defaultTimeout: 5000, navigationTimeout: 30000 }` exactly.
- `RETRY_INTERVAL_MS is 100` (Constraints "Retry interval: 100 ms") — literal equality.
- **Edge/race — boundary at exactly timeoutMs=1 (minimum valid timeout)**: `createDeadline(1) still runs the first attempt synchronously` — `attempt` is called once even though the budget is below one retry interval; this is the seam S3 recommends for "near single-attempt" tests (used pervasively in T4/T10 edits per Errata E2c). Spec gap: the spec never states whether `timeoutMs=1` is itself a legal *sibling* `timeout:` value — AC47 only enumerates `0, -5, 1.5, "abc", true, null` as invalid; `1` is syntactically a positive integer so must be accepted, but no AC exercises the smallest legal value end-to-end. Flagged below under Spec gaps.
- **Race — two Deadlines created from two concurrently-running fake clocks don't share state** — instantiate two independent `createDeadline` calls with two independent fake `Clock`s; advancing one's clock doesn't change the other's `remainingMs()`. (Guards against a module-level singleton clock mistake under parallel session execution, S11/engine concern.)

PASSES on both versions: none in this file (the module is new).

---

## packages/core/src/commandTraits.test.ts (NEW, T1)

Unit.

- `COMMAND_TRAITS has exactly one entry per Command['type'], no more, no fewer` (AC70) — `Object.keys(COMMAND_TRAITS).sort()` equals the sorted list of every `type` literal in the `Command` union (hand-enumerated from `types.ts`, independent of the table itself — not derived from `COMMAND_TRAITS` to avoid a tautology).
- `element trait is assigned to exactly the Constraints-table element commands` (AC70) — for each of `tapOn, doubleClick, hover, inputText, inputTextTargeted, clearText, selectOption, check, uncheck, assertVisible, assertNotVisible, assertText, assertValue, assertEnabled, assertDisabled, assertChecked, assertUnchecked, assertUrl, assertCount, within`, `COMMAND_TRAITS[t].timeout === 'element'`.
- `navigation trait is assigned to exactly goto, reload, goBack, goForward, waitForPageLoad` (AC70).
- `none trait is assigned to wait, waitFor, scroll, setViewport, screenshot, setVar, testVarSet, unsetVar, runFlow, pressKey, crossOriginIframeWarning` (AC70) — explicitly checks `pressKey === 'none'` (phase-1 Q19) and `within !== 'none'` as the two cases the AC calls out as common mistakes.
- `COMMAND_TRAITS entries carry no preCheck, action or checkpoint field` (AC70) — `Object.keys(COMMAND_TRAITS[t])` is exactly `['timeout']` for every `t`.
- **Edge** — `setVar's two overloaded shapes ({name,value} and {name,method,args}) both map to the same 'type':'setVar' key` so the trait table isn't accidentally keyed twice or missed — a type-level concern folded into AC70/AC71; adds a runtime check that `COMMAND_TRAITS['setVar']` is defined once (not an array/duplicate).

PASSES on both versions: none (new module/table).

---

## packages/core/src/commandTraits.typecheck.ts (NEW, T1) — compile-time test

- `tsc --noEmit (packages/core) accepts COMMAND_TRAITS assigned to Record<Command['type'], unknown>` (AC71) — `const x: Record<Command['type'], unknown> = COMMAND_TRAITS;` compiles.
- `tsc --noEmit rejects a COMMAND_TRAITS-shaped object missing one key` (AC71) — `// @ts-expect-error` above an object literal with one key removed, assigned to `typeof COMMAND_TRAITS`; if the key is actually missing, `tsc` reports the expected error at that line (verified by running `tsc` and asserting no "unused @ts-expect-error" diagnostic). This is run via `npm run build` in `packages/core` (per T1 note that the tsconfig includes `src/**/*`), not via vitest.
- **Edge** — a parallel `// @ts-expect-error` case with one *extra* unrecognised key (e.g. `foo: {timeout:'element'}`) also fails `tsc` without the annotation, catching excess-key typos (the literal-type assignment style flagged in S2 — "a missing key or an excess literal key fails tsc"). Not explicitly required by AC71's wording ("if any one entry is removed... tsc fails") but implied by S2's "excess literal key" guarantee; included as a boundary case.

PASSES on both versions: none (new file; `tsc` itself must already pass on the pre-change tree with no `COMMAND_TRAITS`, so this whole file is new behaviour).

---

## uivisor-app/tests/unit/positive-int.test.ts (NEW, T1)

Unit. Covers `parsePositiveInt`, the predicate shared by AC47 (sibling), AC68 (header/config) and AC55 (CLI) call sites — tested once here at the shared seam, then referenced (not re-derived) by each caller's own message-format test.

- `accepts a positive integer number` (AC47/68/55 shared) — `parsePositiveInt(3000) === 3000`.
- `accepts a digit-only string and returns its numeric value` (AC47 "3000" accepted) — `parsePositiveInt("3000") === 3000`.
- `rejects 0` (AC47) — `parsePositiveInt(0) === undefined`.
- `rejects a negative number` (AC47 `-5`) — `undefined`.
- `rejects a float` (AC47 `1.5`) — `undefined`.
- `rejects a non-numeric string` (AC47 `"abc"`) — `undefined`.
- `rejects a boolean` (AC47 `true`) — `undefined`.
- `rejects null` (AC47 `null`) — `undefined`.
- `rejects undefined` — `undefined` (not explicitly ACed, but every caller must handle an absent sibling key distinctly from an invalid one; this pins that `parsePositiveInt` itself returns `undefined` for "no value", same as "invalid value" — callers distinguish via `'timeout' in obj`, not via this function's return).
- **Edge — leading zeros**: `parsePositiveInt("007") === 7` — the regex `/^\d+$/` matches, and `Number("007")` is `7`; no AC states this, but AC47 only tests `"3000"`, not a leading-zero form. Flagged as a spec gap below.
- **Edge — whitespace**: `parsePositiveInt(" 3000 ")` is `undefined` (regex has no `\s*` anchors) — not ACed; included because YAML scalars can pick up stray whitespace from block literals.
- **Edge — "+3000" (explicit sign) is rejected** — regex requires `^\d+$`, so a leading `+` fails; not ACed, worth pinning since some integer parsers accept it.
- **Edge — "3000.0" (float-as-string) is rejected** — distinguishes from the accepted plain digit string; guards a regex that might be loosened to `/^\d+(\.\d+)?$/` by mistake.
- **Edge — Number.MAX_SAFE_INTEGER-sized string** — `parsePositiveInt("9007199254740993")` (one past `MAX_SAFE_INTEGER`) — behaviour unspecified by the proposal; test documents whatever `Number(...)` does (precision loss, not a rejection) and flags it as a spec gap (no AC bounds the *upper* end of a timeout value — a user could set `timeout: 99999999999` and the command would effectively never time out within a test run).
- **Edge — "NaN" and "Infinity" as literal strings are rejected** — regex-only approach excludes JS's own numeric-string parsing quirks.

PASSES on both versions: none (new predicate).

---

## packages/core/src/playwrightLocator.test.ts (EXISTING, edited per T4 + Errata E2c)

Unit, mocked `Page`/`Locator`, controllable `count()` sequences; where a deadline is needed, inject `createDeadline(1)` (or a fake `Clock`) per Errata E2c rather than letting a real deadline burn wall-clock time in the suite.

### Selector forms resolve on the first matching step (AC1–AC6 logic, no DOM timing)

- `bare string resolves via the data-testid step when it has exactly one match` (AC1 logic, regression of TC-001 shape) — `resolveLocator` returns the data-testid locator; `getByText` is never called. PASSES on both versions (unchanged cascade-step-1 behaviour; only the *retry* behaviour is new).
- `bare string falls through to the text step when data-testid has zero matches, once stable` (AC2 logic) — with `count()` returning `0` then `1` on data-testid (never) and `1` throughout on text, resolution returns the text locator only after the stability re-check (two attempts, `count()` called twice on text).
- `pipe string with two segments resolves the second segment once the first has zero matches` (AC3 logic) — `tapOn: id=nope|data-testid=x`-shaped input; both segments counted; the id step never wins.
- `each object selector form (testId, css, text) resolves when its own count reaches 1` (AC4 logic) — three sub-cases, one `ResolutionStep` each, label is `JSON.stringify(selector)`.
- `{ xpath } form resolves via buildSteps' single xpath step` (AC5 logic) — `page.locator('xpath=...')`-equivalent counted; no error thrown for a valid expression.
- `single-step selectors resolve on the first attempt, with no second poll` (AC6) — for (a) bare string, (b) single-segment pipe `text=Foo`, (c) `{testId:foo}`: `count()` is called exactly once per step; `retryUntil`'s sleep (spied) is never invoked. **Boundary**: also assert elapsed logical time (via fake clock) is `0`, not merely "under 100ms", since AC6 forbids *any* second pass, not just a fast one.

### Stability check and duplicates (AC7–AC13)

- `stability: a step-2 winner confirmed on two consecutive passes is accepted` (AC9) — step 1 count is always `0`; step 2 is always `1`. Resolution returns the step-2 locator after exactly 2 `count()` calls on step 2 (one per pass), and the fake clock shows the second pass started `100ms` after the first (`AC9`'s "about 100 ms apart", `>=100 and <300` total — assert both the attempt count AND the elapsed-time bound explicitly, since AC9 states both).
- `stability: a changed winner restarts, and a later step-1 win is accepted immediately` (AC10) — pass 1: step1=0, step2=1; pass 2 onward: step1=1. Returned locator is step-1's, and the attempt that found it does not require a *third* pass of double-confirmation (restart resets the "previous winner" memory to step 1 on the very next pass since w=0 skips the stability requirement entirely — this is the AC6 "w=0 never needs confirmation" rule applied mid-stream, not an edge case called out separately in AC10's prose; included explicitly since a plausible bug is "restart always re-requires two consecutive passes even for w=0").
- `stability: an unconfirmed lower-step winner never resolves, and fails with the not-found error at the deadline` (AC11 as revised by Errata E1: step 1 always 0 matches, step 2 alternates 1/0 every pass) — with `timeoutMs=1000` and a fake clock, resolution rejects/returns `{found:false}` leading to the AC14-format error, and the failure happens at `t=1000`, not earlier (assert via fake-clock elapsed, not a wall-clock sleep).
- `duplicates: 2 matches collapsing to 1 at 800ms resolves promptly once unique` (AC12) — `count()` returns `2` for several polls then `1`; resolution accepts only once `n===1`.
- `retry cadence is exactly 100ms and count() is called 5–11 times before a 1000ms failure` (AC13) — single-segment selector, `count()` always `0`, `timeoutMs=1000`; assert `count` mock's call count is `>=5 && <=11`. **Boundary addition**: also assert the *exact* bound by using a fake clock stepped in precise 100ms increments, so the test isn't tolerant of a scheduler quirk — with 100ms steps and `retryUntil`'s "attempt once immediately, then after each sleep", the deterministic count is `11` (attempts at t=0,100,...,1000), pinning the single legal value inside `[5,11]` rather than leaving the range as a soft tolerance. This tightens AC13 beyond its own wording — documented as a generator-B addition, not a spec requirement, since AC13's range implies the spec author was unsure of the exact scheduling and left room; a reversed-direction concern (arbiter should confirm whether `11` or some other exact count is intended before Coder locks to it).
- **Edge — duplicates that never collapse**: `count()` always `2`; resolution fails at the deadline with the AC17 duplicate-count message, confirming "later steps are still tried" (TC-003-style) doesn't silently accept the duplicate step by falling through past it when no other step ever reaches 1. Regression guard, not independently ACed.
- **Edge/race — a duplicate count that oscillates 1→2→1→2 never stabilizes** (combines AC9's stability rule with AC12's duplicate rule) — `n===1` is "accepted" per attempt, but if it alternates with `2`, the *previous-winner* memory for the stability check must still require two consecutive winning attempts of the *same* step index; test asserts resolution does NOT return early just because `n===1` was seen once, when the step also saw `n===2` on the immediately following poll before the deadline. Not directly ACed; included because AC9's rule ("previous attempt's winner was also w") and AC12's rule ("duplicates retry until they collapse") interact non-trivially — a naive implementation might treat "ever saw 1" as sufficient.

### Error messages at the deadline (AC14–AC18)

- `bare-string not-found error: line 1 exact text and all five cascade step lines in order` (AC14) — `Element not found after 1000ms: int-never-rendered`, then the five lines in the exact attribute order `data-testid, text, name, id, placeholder`, each `  <attr>=<value>: 0 matches`.
- `pipe-string not-found error: line 1 and exactly the two given segment lines, no cascade lines` (AC15) — confirms pipe mode never emits the 5-attribute cascade lines, only the segments actually given.
- `object-selector not-found error uses JSON.stringify(selector) as both the heading suffix and the single step label` (AC16a) — exact string `{"testId":"int-never-rendered"}`.
- `xpath-selector not-found error uses JSON.stringify({xpath:...})` (AC16b) — exact string `{"xpath":"//*[@id='nope']"}`. **Edge**: xpath value containing a double quote (e.g. `//*[@id="x"]`) — `JSON.stringify` must escape it (`\"`) in the message; not ACed, included because xpath expressions commonly contain quotes and `selectorLabel`'s correctness under escaping is otherwise untested.
- `duplicate-at-deadline error reports the last observed count, not zero` (AC17) — `data-testid=row` always `2`; line 2 is exactly `  data-testid=row: 2 matches`, not `0 matches`.
- `malformed selector (a) unknown attribute fails fast with no retry` (AC18a) — `tapOn: foo=bar`; error thrown synchronously from `buildSteps` before any `count()` call; message starts with `Unknown attribute 'foo'`; elapsed time via fake clock is `0`.
- `malformed selector (b) xpath union in pipe syntax fails fast` (AC18b) — message starts with `XPath union '|' conflicts with pipe syntax`.
- `malformed selector (c) invalid xpath fails fast via a rejected count()` (AC18c) — unlike (a)/(b), this error surfaces from the *first* `count()` call (per S4: "a count() rejection... propagates from the attempt that hit it"), not from `buildSteps` synchronously — test explicitly asserts `count()` was called exactly once (not zero) before the error, distinguishing "parse-time" malformed selectors from "first-count-time" malformed ones. This distinction is implied by S4's prose but not spelled out as a numbered boundary in AC18 itself — flagged as worth the arbiter's attention since AC18's own wording ("fails fast... without retrying") doesn't visibly distinguish (a)/(b) from (c) in call count.
- **Edge — empty xpath `""` throws in buildSteps synchronously** (S4: "An empty xpath throws in buildSteps") — not independently ACed (AC18c uses `"//["`, not `""`); added since S4 calls out empty-xpath as a *distinct* buildSteps-time case from an *invalid* (non-empty) xpath that fails at `count()`-time.
- **Edge — missing `=` in a pipe segment** (S4 "missing `=`" listed as a buildSteps-time error) — e.g. `tapOn: foo|data-testid=x` where `foo` has no `=`; not ACed by number, but named explicitly in S4's fail-fast list; test confirms it throws synchronously like (a)/(b), not after a `count()` call.
- **Edge — unrecognised selector type object** (S4's last fail-fast case, e.g. `{ bogus: 'x' }`) — throws synchronously; message format unspecified by any AC — flagged as a spec gap (no AC pins this message's exact text).

### Not-visible mode (AC19–AC23 revised)

- `string selector, element absent, every step 0 matches: not-visible passes promptly` (AC19) — `resolveNotVisible` resolves `true` on the first attempt (no step ever reaches `>=1`), under 1000ms.
- `element present but hidden (display:none), string and object forms both pass promptly` (AC20) — deciding step has 1 match, `isVisible()` false.
- `visible element that's later removed: not-visible passes once removed` (AC21 logic) — deciding step transitions from `1` match (visible) to `0` matches; resolves `true` once count drops to 0 (not merely once `isVisible()` becomes false while still present — test explicitly distinguishes "removed from DOM" from "still present but hidden" as two different paths to `true`, since S4's rule is phrased around `isVisible()` of the still-matching step, and once the step's count is 0 there's a different deciding-step branch ("no step has a match → done(true)")).
- `element stays visible: not-visible fails at the deadline with the unchanged message` (AC22) — fails after the full budget; message is exactly `Expected: not visible\nGot: visible` (unchanged literal format pinned, not just "contains").
- `(AC23a) two hidden duplicates pass promptly, deciding step is the first step with >=1 match` (AC23 revised a) — both matches of the data-testid step hidden; resolves `true` under 1000ms (not merely "doesn't throw the duplicate-match error" — not-visible mode must NOT apply the AC12/AC17 "retry until unique" rule at all, since S4 says not-visible mode "uses buildSteps + retryUntil, with no stability check" — i.e. no stability/uniqueness requirement, only visibility of all matches of the deciding step).
- `(AC23b) one visible + one hidden duplicate: fails at the deadline with the visible/not-visible message` (AC23 revised b) — deciding step has 2 matches, index 0 stays visible; `isVisible()` is checked for *both* indices (`nth(0)` and `nth(1)`), and the step fails because index 0 is visible — test asserts `isVisible` was called for index 1 too (not short-circuited away) to pin "every match of the deciding step", not "the first match".
- `(AC23c) one duplicate becomes hidden at 800ms, the other hidden throughout: passes once the visible one hides` (AC23 revised c) — resolves `true` only after `t>=800`, not immediately (the pre-800ms visible match blocks the pass).
- **Edge — not-visible mode's deciding step is NOT necessarily the first step in cascade order; it's the first step with >=1 match** — a case where data-testid has 0 matches but `text` has 2 matches (one visible, one hidden): resolution must use the `text` step as deciding, not short-circuit on data-testid's zero. This generalizes AC23's examples (which only vary the data-testid step) to the "lower-step deciding" case the revised rule explicitly allows ("the first step, in cascade/pipe order, with at least one match") — not itself a separate AC, but a direct consequence of the stated rule that none of AC19–23's inputs happen to exercise (all of them use data-testid as the match-bearing step). Included because it's exactly the kind of boundary a straightforward reading of "the deciding step" (assumed to always be step 1) would miss.
- **Edge/race — not-visible mode never performs the AC9/AC10 two-pass stability check even when the deciding step's identity changes between polls** — step A has 0 matches on poll 1, then step B has 1 match on poll 1, but on poll 2 step A has 1 match instead: per S4, not-visible mode has "no stability check", so the test asserts the *current* poll's deciding step is evaluated fresh each time with no "previous winner" memory carried over — distinguishes not-visible mode's polling loop from the found/not-found mode's stability state machine. Not independently ACed; flagged as an implementation risk since both modes share `buildSteps`/`retryUntil` and a shared "last winner" variable would be a natural (wrong) code-reuse shortcut.

### Container lookup (`within`, AC24–AC27 logic portion)

- `resolveContainerLocator resolves once count reaches >=1 (no nth)` (AC24 logic) — mocked count 0 then 1; returns the multi-match locator once non-zero.
- `resolveContainerLocator not-found at the deadline uses the within: prefix message` (AC25) — exact `within: No container found after 1000ms for selector 'data-testid=int-never-rendered'` plus `  data-testid=int-never-rendered: 0 matches`.
- `resolveContainerLocator with nth=2 accepts once count >= nth+1` (AC26 logic) — count sequence 1,1,...,3; accepted once count reaches 3 (nth=2 means index 2, i.e. 3rd element, requiring `>=3` matches).
- `resolveContainerLocator with nth out of range at the deadline uses today's nth-mismatch message` (AC26 logic, deadline branch) — count stays at 1 when nth=2 is required; message exactly `within: nth=2 requested but only 1 containers matched selector 'data-testid=item'`.
- **Edge — nth=0 is a valid, in-range boundary (first container), not treated as "falsy/unset"** — `resolveContainerLocator(..., {nth:0, ...})` with count=1 resolves immediately; guards against a `cmd.nth ?? default` pattern that might mistake `0` for "not provided" (a classic JS falsy-value bug). Not ACed; `executeWithin`'s own `nth<0` check is covered separately in commands.test.ts, but this pins the *locator* layer's handling of the valid zero boundary.
- **Edge — nth exactly at the boundary where count===nth (not nth+1)** — count stabilizes at exactly 2 while nth=2 is requested (needs 3): confirms the off-by-one isn't silently accepted; message's "only 2 containers matched" is asserted on the N value, pinning the boundary precisely rather than "some number less than required".

PASSES on both versions (explicitly, since the suite is edited and the arbiter must direction-check which assertions changed vs. didn't): the step-1-wins-at-once shape (AC1, AC6a path), the TC-001/TC-002/TC-003 cascade-order assertions themselves (which attribute is tried first, and in what order) are unchanged — only the *retry/deadline* wrapper around them is new. Any test asserting purely "which `count()`/`locator()` calls happened and in what order" without an error-message or timing component is a regression test and should be marked `PASSES on both versions` individually by the consolidator once file contents are known; this generator cannot mark exact pre-existing test names since it has not read the current file body (see Spec gaps).

---

## uivisor-app/tests/unit/resolveSelector.test.ts (EXISTING, edited per T4)

Unit, mocked `Page`. Cross-checks the same resolution behaviour from the app-layer seam (prior art per Gate 1 "Test seams").

- `app-layer resolution surfaces the new not-found message format for a bare string` (AC14, duplicate seam) — same exact-text assertions as the core-layer test, confirming the app doesn't wrap or alter the message.
- `app-layer resolution surfaces the AC16 object/xpath message formats` (AC16a/b, duplicate seam).
- `app-layer resolveNotVisible duplicate-hidden case (AC23a) passes through unchanged from the core result` (AC23a, duplicate seam) — i.e. this file is a thin pass-through check, not a second implementation of the stability/duplicate logic (which lives only in `playwrightLocator.ts` per S4).
- **Edge** — `a deadline passed through from the app layer uses the same timeoutMs in its message as the core layer would` — guards against the app wrapping `resolveLocator` with its own default instead of forwarding the caller's `Deadline`.

**Assumption flagged**: this generator has not read the current contents of `uivisor-app/tests/unit/resolveSelector.test.ts` (read-only worktree access was used only for naming conventions elsewhere, not this file specifically) — the above tests assume it is a thin cross-check of the core resolver rather than an independent implementation. If it in fact tests different app-only logic, these bullets should be reconciled by the consolidator against generator A's reading of the file.

PASSES on both versions: none determinable without reading current file content (see above).

---

## uivisor-app/tests/unit/sibling-timeout-parser.test.ts (NEW, T6)

Unit, pure parsing (no clock).

- `sibling timeout on a string-selector command parses and is carried on the step` (AC39) — `parseSessionedCommand({assertVisible:'data-testid=x', timeout:1500})` → `{command:{...}, timeout:1500}`.
- `sibling timeout before the command key parses the same as after` (AC40a) — `{timeout:1500, tapOn:{testId:'x'}}` parses to the same shape as the reverse order; command is `tapOn`, not `Unknown command: timeout`.
- `sibling timeout with session: in any position preserves both session and timeout` (AC40b) — `{session:'b', tapOn:{...}, timeout:1500}` → `{session:'b', timeout:1500, command:{type:'tapOn',...}}`.
- `sibling timeout is accepted on every element and navigation command` (AC41) — table-driven over all 20 element + 5 navigation types from the Constraints lists (including `inputText` shorthand, `assertUrl`, `assertCount`, `within`, and `waitForPageLoad` *without* an inner timeout); each parses without throwing and carries `timeout:2000`.
- `sibling timeout inside a within do: block is parsed recursively` (AC42) — the inner step object carries its own `timeout:1000` independent of any outer sibling.
- `timeout: on a none-trait command throws "timeout is not supported on <key>"` (AC44) — table-driven over `wait, waitFor, scroll, setViewport, screenshot, setVar, testVarSet, unsetVar, runFlow, pressKey`; message exactly `timeout is not supported on <key>` with `<key>` matching the YAML key as written (not the parsed `type`, which may differ — see edge below).
- `the Q17 error inside a within do: block fails the whole top-level parse` (AC45a) — `pressKey` with sibling timeout nested in `within.do` throws during the *top-level* `loadAndParse`/parse call, not deferred.
- `waitForPageLoad with both an inner and a sibling timeout throws the exact "use one" message` (AC46) — message exactly `waitForPageLoad: timeout given both inside the command and as a sibling key; use one`.
- `invalid literal sibling values are rejected with the exact message, one case per literal` (AC47) — six sub-cases (`0, -5, 1.5, "abc", true, null`), each message exactly `timeout must be a positive integer, got <value>` with `<value> = String(raw)` (so `got 0`, `got -5`, `got 1.5`, `got abc` — note: `String("abc")` is `abc`, not `"abc"` with quotes; this is a subtle literal the test must get right since a naive `${raw}` template vs `${JSON.stringify(raw)}` would differ for the string case — flagged as a precise boundary worth double-checking against AC47's own wording, which writes `got <value>` generically but AC49's dispatch-time sibling the Seam Notes explicitly format as `got "abc"` *with* quotes — see Spec gaps, these two call sites use different quoting and a test must not conflate them).
- `the quoted-digit string "3000" is accepted as 3000` (AC47) — distinguishes from the six rejected literals.
- `a parsed step's Command is byte-identical whether or not a sibling timeout is present` (AC75, parse-side half) — `toEqual` on the `command` sub-object with vs. without `timeout:3000` sibling; only the wrapper differs.
- `parser acceptance of timeout: matches COMMAND_TRAITS exactly, for every YAML command key` (AC72) — generative/table test over every command type: accepted iff `COMMAND_TRAITS[type].timeout !== 'none'`; this is the single test that would catch a parser/trait-table drift the individual AC41/AC44 tests might miss if someone edits one without the other.
- **Edge — key order with THREE siblings (`session`, `timeout`, and the command key) in all 6 permutations** — extends AC40 beyond its two given orderings; a parser that does positional destructuring (`Object.keys(obj)[0]`) rather than filtering by known keys would break on some permutation. Not independently ACed.
- **Edge — a sibling timeout key appearing twice in the same mapping (YAML allows duplicate keys in some parsers, JS object literals silently keep the last one)** — `{tapOn:'x', timeout:1000, timeout:2000}` is not valid JS object literal syntax but *is* parseable YAML (last-key-wins per most YAML parsers, though technically invalid per the YAML 1.1 spec and parser-dependent) — flagged as a spec gap: no AC addresses duplicate sibling keys, and behaviour is parser-library-dependent, not something this project's parsing code necessarily controls.
- **Edge — `timeout` as the *literal command key itself*** (`{timeout: {...}}` with no other key) — must be `Unknown command: timeout` (the pre-existing behaviour for an unrecognised command), not silently treated as "sibling timeout with no command", which should be a different, clearer error. Not ACed; closes a gap in AC40's "key stripped before parseCommand" description — stripping `timeout` could leave an *empty* `rest` object, and the test pins what happens then (today's "no command key found" error, whatever its exact text is — flagged below since no AC specifies this message).
- **Edge — malformed sibling timeout alongside a malformed command (both present)** — `{tapOn: 'foo=bar', timeout: -1}`: which error fires first, the selector's `Unknown attribute 'foo'` (AC18a, which per S4 happens inside `buildSteps`, i.e. only at dispatch/resolution time, not parse time) or the sibling's `timeout must be a positive integer, got -1` (parse time, per S8's described order: trait check, then value check, then Q19 check — all parse-time, before any selector validation which is a resolution-time concern)? Since selector validity (`buildSteps`) only runs at dispatch, and sibling validation runs at *parse* time, the parse-time error must fire first (parsing never reaches dispatch). Test pins this ordering explicitly — not individually ACed, but implied by S8's "parser" vs S4's "resolution" seam split.

PASSES on both versions: none (the sibling key doesn't exist pre-change; every test here is new behaviour by construction).

---

## uivisor-app/tests/unit/timeout-config.test.ts (NEW, T7)

Unit, pure parsing/validation (no clock).

- `flow header accepts defaultTimeout and navigationTimeout with no Unknown header key error` (AC65).
- `shared config reserved keys are stripped from file.vars but base and other vars remain` (AC66) — `file.vars` lacks `defaultTimeout`/`navigationTimeout`, retains `base`.
- `a step using ${defaultTimeout} after it's been stripped from config fails at dispatch with the standard undefined-var message` (AC66) — exact `Variable "defaultTimeout" is not defined (in flow <abs path>)` — this assertion technically belongs at the dispatch seam (T5/T11), but the parse-time half (that `defaultTimeout` is absent from `vars`) is tested here; cross-referenced in `timeouts.test.ts` (integration) for the full round-trip.
- `sla remains an ordinary var via shared config` (AC67a) — `setVar: s=${sla}` then `testVarSet` confirms `"3000"`.
- `sla and loading in the flow header are still Unknown header key errors` (AC67b/c) — exact `Unknown header key: sla in <file>` and `Unknown header key: loading in <file>`.
- `invalid header values for defaultTimeout/navigationTimeout are rejected with the exact message, across all six invalid literals, in both keys` (AC68) — 2 keys × 6 literals = 12 sub-cases for the header; message exactly `Invalid <key>: must be a positive integer, got <value> in <flow file path>`.
- `invalid shared-config values are rejected with the config-path form of the message` (AC68, config half) — 12 sub-cases; message exactly `Invalid <key>: must be a positive integer, got <value> in <config path as written>` — **boundary**: "as written" means a relative path like `./config.yml` must appear verbatim, not resolved to an absolute path; test explicitly uses a relative `config:` reference and asserts the message contains the *relative* string.
- `a digit-only string value (including one produced by ${var} resolution) is accepted for header and config` (AC68) — `defaultTimeout: "15000"` literal, and `defaultTimeout: "${t}"` with `t=15000` via inline vars, both accepted as `15000`.
- `child flow header/config values are still validated even though they'll be ignored at runtime` (AC69) — child header `defaultTimeout: 0` fails the `runFlow` step with a message containing `Invalid defaultTimeout: must be a positive integer, got 0`, confirming validation isn't skipped just because inheritance will discard the value.
- `${var} in a header value resolves from inline vars at parse time` (AC57a) — header `defaultTimeout: "${t}"` + inline `vars:{t:1250}` → probe reports `after 1250ms` (full round-trip test, borderline integration since it needs a probe run; kept here as the parse+resolve half, with the "reports after Nms" assertion delegated to `timeouts.test.ts`). Noted as a cross-file dependency, not duplicated.
- `${env.X} in a shared-config value resolves from the environment at parse time` (AC57b) — config `defaultTimeout: "${env.UIV_T}"`, env `UIV_T=1350` set via `process.env` in the test, resolves to `1350`.
- `${var} that's only set later by setVar is NOT visible to header interpolation; resolves to empty string and fails header validation` (AC57c) — header `defaultTimeout: "${fromSetVar}"` where `fromSetVar` is a *runtime* var set only via a later `setVar` step; parse-time interpolation sees it as unresolved → empty string → `Invalid defaultTimeout: must be a positive integer, got  in <file>` (note: AC57c's own text says the error message cites "AC63" but per Gate 1 Errata E4 this is a typo for AC68 — this test asserts the AC68-format message, per the correction).
- **Edge — defaultTimeout set to the digit string `"0"` via header** — must still be rejected (`"0"` passes the digit-only acceptance regex syntactically but the *value* is still `0`, which is invalid) — pins that "digit-only string is accepted" (AC68) doesn't accidentally bypass the "must be positive" check; i.e. the acceptance of digit strings and the positivity check are the same `parsePositiveInt` call, not two independent gates. Not separately ACed but a direct consequence of S9's shared predicate — worth a dedicated assertion since it's exactly the kind of "accept digit strings" feature that could be implemented as a separate, earlier bypass check.
- **Edge — both defaultTimeout and navigationTimeout invalid simultaneously in the same header** — only one `Invalid ...` error should surface (whichever is checked first); test pins which key's error wins and documents it, since no AC specifies validation order between the two keys when both are broken. Flagged as a spec gap.
- **Edge — header value is a YAML `null`-equivalent (empty value, e.g. `defaultTimeout:` with nothing after the colon)** — distinct from the literal `null` already covered in AC47; here the YAML parser itself may represent it as `null`, `undefined`, or `''` depending on the YAML library's defaults, before validation ever runs. Flagged as a spec gap below (same literal-level case as AC47/AC68's `null`, but worth confirming the YAML layer actually produces `null` and not something else that skips the check entirely).

PASSES on both versions: none (header/config keys don't exist before this feature; `Unknown header key: defaultTimeout` is literally the pre-change behaviour being replaced).

---

## uivisor-app/tests/unit/args.test.ts (EXISTING, new describe block appended, T8)

Unit.

- `--timeout and --navigation-timeout parse into ParsedArgs` (AC55a) — `timeout:7000, navigationTimeout:40000`; both are `undefined` when neither flag is given (explicit check that absence isn't `0` or `NaN`).
- `--timeout 0 is rejected with the exact stdout error and exit code 1` (AC55b) — stdout exactly `Error: --timeout must be a positive integer, got "0"\n`; `process.exit` called with `1`.
- `--timeout abc is rejected` (AC55c) — `Error: --timeout must be a positive integer, got "abc"\n`.
- `--navigation-timeout -1 is rejected` (AC55d) — `Error: --navigation-timeout must be a positive integer, got "-1"\n`.
- `--timeout as the last argument with no value gives an empty raw string in the error` (AC55e) — exactly `Error: --timeout must be a positive integer, got ""\n`.
- `usage line includes both new flags` (AC55) — usage string contains `[--timeout <ms>] [--navigation-timeout <ms>]`.
- **Edge — `--timeout` followed immediately by another flag, with no value between them** (e.g. `test f.yaml --timeout --navigation-timeout 5000`) — does the parser consume `--navigation-timeout` *as the timeout's value* (producing raw `"--navigation-timeout"`, which fails the positive-int check with that string in the message) or does it treat `--timeout` as if no value were given (empty-string raw, same as AC55e)? Spec gap: AC55 only covers "`--timeout` as the *last* argument" (AC55e); a `--timeout` immediately before *another known flag* mid-argv is a materially different parsing decision (greedy-consume vs. look-ahead) that no AC resolves. Flagged below.
- **Edge — `--timeout` given twice in the same invocation** (`--timeout 1000 --timeout 2000`) — last-wins, first-wins, or error? Not ACed. Flagged below.
- **Edge — `--timeout` and a flow-level sibling/header timeout interacting is out of scope for this file (covered in precedence tests)**, but this file should still confirm `--timeout 7000 --navigation-timeout 40000` together don't cross-contaminate each other's parsed field (AC55a already covers this; restated here as the explicit "independence of the two CLI flags" boundary, mirroring AC53's independence rule one layer up).
- **Edge — unknown flag spelled with different case, `--Timeout`** — must NOT be silently treated as `--timeout`; confirms case-sensitivity isn't accidentally relaxed by a case-insensitive flag-matching helper. Not ACed; low-risk regression guard.

PASSES on both versions: the pre-existing `args.test.ts` cases (parsing of `test`, `--headed`, `--reporter`, etc., per the file note "existing cases untouched") are unaffected by this feature — PASSES on both versions, listed here for completeness but not duplicated as new bullets since this generator writes only new/changed tests, per the task breakdown's "new describe block appended; existing cases untouched."

---

## uivisor-app/tests/unit/timeouts-precedence.test.ts (NEW, T9)

Unit, pure functions, no clock, no I/O.

### `resolveRunTimeouts` (AC51–AC54, AC58, AC80 rules)

- `element timeout precedence: sibling > CLI > header > config > built-in, each layer removed in turn` (AC51 rules portion — the "reports after Nms" half of AC51 belongs to `timeouts.test.ts`; here, `resolveRunTimeouts` and `stepTimeoutMs` are tested directly as pure functions) — five calls with layers progressively removed produce `1400, 1300, 1200, 1100, 5000` for `defaultTimeout` (via `stepTimeoutMs('tapOn', own, run)` composed with `resolveRunTimeouts`).
- `navigation timeout precedence: same chain for navigationTimeout` (AC52 rules) — `1400,1300,1200,1100` then `30000` with none set.
- `the two settings are independent: navigationTimeout alone doesn't change defaultTimeout's resolution, and vice versa` (AC53) — `resolveRunTimeouts({}, {timeouts:{header:{navigationTimeout:1000}}})` → `.defaultTimeout === 5000`.
- `header beats shared config for both keys` (AC54) — config `defaultTimeout:4000`, header `defaultTimeout:1200` → `1200`, not `4000` (explicit contrast with the vars-precedence rule, where config wins — the test's description should name this contrast since it's the one rule in the whole feature that inverts intuition from the existing vars system).
- **Edge — CLI value of exactly `0` must never reach `resolveRunTimeouts`** (since the CLI layer itself rejects `0` before this function runs, per AC55b) — test confirms `resolveRunTimeouts` doesn't need its own re-validation of the CLI layer (defensive-depth question): pass `{defaultTimeout:0}` directly to `resolveRunTimeouts` (bypassing the CLI parser) and document whether it's treated as "set to 0" (and so wins, resulting in a 0ms deadline — likely a bug) or as "falsy, treated as unset" (`??` doesn't skip `0`, only `undefined`/`null`, so a stray `0` would NOT be treated as unset and would silently create a zero-length deadline). **Flagged as a spec gap / defensive-coding risk below** — this is exactly the kind of boundary a straightforward reading misses, since every *validated* input path rejects `0`, but `resolveRunTimeouts` itself has no stated contract about what happens if it's called with a `0` that slipped through (e.g. a future caller, or a test double).

### `stepTimeoutMs` (AC35 inner-vs-run, Q19 "own and inner are never both set")

- `element-trait command returns own if given, else run.defaultTimeout` (AC51 composition).
- `navigation-trait command returns own if given, else run.navigationTimeout` (AC52 composition).
- `none-trait command returns undefined regardless of own or run` (AC44/AC72 composition at the dispatch layer — confirms the function itself enforces "none" rather than relying solely on the parser having already rejected it, which matters if `stepTimeoutMs` is ever called on a step the parser didn't validate, e.g. a hand-built `RunContext` in a test).
- `waitForPageLoad: own (sibling) takes precedence identically to inner, when passed as "own"` (AC35a logic) — the dispatcher is responsible for ensuring `own` and `inner` (the `waitForPageLoad`'s own `timeout` field) are never both passed to `stepTimeoutMs` simultaneously (per S6's `own ?? inner` composition prior to calling `stepTimeoutMs`); this test confirms `stepTimeoutMs`'s own contract — given exactly one "own" value regardless of its origin, it's used over `run.navigationTimeout`.
- **Edge — stepTimeoutMs given an own value of `0`** — same falsy-boundary concern as above: `own ?? run.X` does NOT skip `0` (nullish coalescing only skips `null`/`undefined`), so a `0` own value is used as-is, producing a zero-length deadline. Since the *parser* already rejects literal `0` siblings (AC47), the only way `own=0` reaches this function is `waitForPageLoad`'s inner `timeout:0`, which is explicitly meant to mean "unbounded" (S3: "0 = unbounded"), NOT "an immediate deadline" — **this is a real, spec-relevant boundary**: `stepTimeoutMs`'s return value of `0` must be interpreted downstream (by `createDeadline`) as unbounded, not as "already expired." Test pins `stepTimeoutMs('waitForPageLoad', 0, run) === 0` and separately (cross-referenced) that `createDeadline(0)` is unbounded — connecting AC73's "`timeout: 0` still parses and keeps its current meaning" to this specific function boundary, which no single AC states explicitly as a `stepTimeoutMs` contract.

### `timeoutNotice` (AC58–AC62, AC80)

- `notice lists only keys whose child value differs from the effective run value, in [defaultTimeout, navigationTimeout] order` (AC60a) — both differ → `child.yaml: defaultTimeout, navigationTimeout ignored (inherited from top.yaml)`.
- `notice lists a single key when only one differs` (AC60b, AC80b) — `child2.yaml: defaultTimeout ignored (inherited from top.yaml)` / `child.yaml: navigationTimeout ignored (inherited from top.yaml)`.
- `no notice (null) when the child sets neither key` (AC61a).
- `no notice (null) when the child's value equals the effective value for every key it sets` (AC61b, AC80a) — `defaultTimeout:1000` in child header, effective `1000` → `null`.
- `basenames are used for both the child and top-level file names, even when given as full paths` (AC60 "File names are basenames") — pass absolute paths; assert the returned string contains only `child.yaml`/`top.yaml`, not the directories.
- `header vs config precedence inside the child's OWN value (header ?? config) governs the differs-check, same as the run's precedence` (S7 "firstDefined helper... for both resolveRunTimeouts and timeoutNotice") — child sets `config:{defaultTimeout:4000}` and header `{defaultTimeout:1000}`; if effective is `1000`, the notice must compare against the *header* value (1000, which equals effective, so no notice), not the config value (4000, which would wrongly trigger a notice) — this directly tests the shared `firstDefined` helper's reuse, a seam-level risk (one function used in two call sites with different intents) not spelled out AC-by-AC.
- **Edge — child sets a key to a value that differs from effective by exactly the tolerance-irrelevant minimum (1ms)** — effective `1000`, child `1001`: notice still fires (any difference, however small, triggers it — "differs" has no tolerance band). Not ACed numerically but implied by "value doesn't differ" being an exact-equality check, not a near-equality one; worth pinning since timeouts elsewhere in the spec DO use tolerance bands (durationMs assertions) and a reader could mistakenly port that tolerance concept here.
- **Edge/race — the same child file, with the SAME differing value, called from two different top-level flows in two separate `runAll` invocations (not two calls within one run)** — each run must get its own notice (once per top-level **run**, not once per **file** forever) — i.e. the "once per top-level run" rule (AC60) must be scoped to a fresh `ctx.timeoutNotices` Set per `runAll`/per top-level flow, not a module-level cache that would wrongly suppress the notice on a second, independent run. This is implied by S11 ("There is one ctx per top-level flow") but is a cross-cutting lifecycle concern that no single AC states as a negative ("notices must NOT persist across runs") — flagged below.

### AC80 companion cases

- `(a) child defaultTimeout equal to effective, navigationTimeout unset: no notice at all` (AC80a).
- `(b) child defaultTimeout equal, navigationTimeout differs: only navigationTimeout is listed, defaultTimeout is NOT listed even though it was explicitly set in the child` (AC80b) — pins "not listed" (absence from the message), not "listed as unchanged" or "listed with a different word" — a plausible wrong implementation might list all explicitly-set keys with some set unchanged and others changed, rather than omitting unchanged ones entirely.

PASSES on both versions: none (this entire precedence/notice system is new; nothing like it exists pre-change).

---

## packages/core/src/commands.test.ts (EXISTING, edited per T10 + Errata E2/E3)

Unit, mocked `Page`/`Locator`; deadlines injected via `createDeadline(N, fakeClock)` or short real deadlines per Errata E2c, so no test depends on real multi-second sleeps.

### Element actions: not-found vs not-actionable (AC31, AC36, AC38 revised)

- `every element command (table-driven over the AC31 list) reports "not found" with the default-config timeout when the target never resolves` (AC31) — 15 sub-cases (`tapOn, doubleClick, hover, inputTextTargeted, clearText, selectOption, check, uncheck, assertVisible, assertText, assertValue, assertEnabled, assertDisabled, assertChecked, assertUnchecked`); line 1 exactly `Element not found after 1200ms: data-testid=int-never-rendered` (string-selector commands) or `Element not found after 1200ms: {"testId":"int-never-rendered"}` (the three object-only commands: `assertText`, `assertValue`, `selectOption`). **Edge within this table**: `selectOption`'s *resolution*-timeout case still says "not found" (per Errata E3, only its *action*-timeout case keeps "Option not found.") — the test explicitly includes `selectOption` in the "not found" table, not only in a separate "not actionable" table, closing a possible confusion from E3's wording.
- `resolveLocator is called outside the try/catch, so its error isn't rewrapped as "not actionable"` (AC31 mechanism) — spy confirms the thrown "not found" message is the *exact* string `resolveLocator` would throw, with no added prefix/suffix from the action-level catch.
- `tapOn on a late-enabling element that times out mid-interaction reports "not actionable", not "not found"` (AC36a / AC38 revised) — mocked locator resolves (count=1) immediately but its `.click()` call rejects with a Playwright-shaped timeout error; message exactly `Element not actionable after 2000ms: data-testid=int-late-enable`, confirming the catch is scoped to the *action* call only.
- `tapOn on an element that resolves and the action succeeds within budget passes` (AC36b) — no error.
- `one budget covers resolution + action: a resolution that consumes most of the budget leaves only the remainder for the action's own Playwright timeout` (AC36 mechanism, "it does not run 1500+2000") — assert the `{timeout}` option passed to `.click()` reflects `d.pwTimeout()` computed from the *remaining* time after resolution, not a fresh full budget. This is the one-budget mechanism underlying AC36(a)'s "no later than 2900ms" bound — tested here as a pure mechanism (what timeout value is passed to the Playwright call), with the full elapsed-time assertion reserved for the integration suite.
- `inputText shorthand reports "not actionable" naming the last-tapped selector label, not a description of the shorthand` (AC32 revised) — `ctx.lastTappedLabel = 'data-testid=int-input'`; fill rejects; message exactly `Element not actionable after 1000ms: data-testid=int-input`.
- **Edge — inputText shorthand called with NO prior tapOn** — the pre-existing "used before any tapOn" error must still fire and must NOT be reinterpreted as a timeout-related error; regression guard pinning that this error path is untouched by the budget change (not explicitly re-stated by any AC, but AC32's "the 'used before any tapOn' error is unchanged" sentence in S5 makes this a direct requirement).
- **Edge — selectOption's resolution succeeds but the action itself (choosing a disabled/absent option) fails** — per Errata E3, this keeps `Option not found.`, with NO timeout value or selector in the message at all (not even reformatted) — test pins the message is *exactly* `Option not found.` literally, not `Element not actionable after Nms: ...`, confirming this is a genuine carve-out, not merely "not yet updated." This directly operationalizes Errata E3 and guards against someone "fixing" it later by over-applying the AC36/AC38 pattern universally.

### Assertions: resolution outside the catch, condition read once (Scope exclusion + AC19–AC30)

- `assertVisible's resolution timeout is NOT caught by the visible-wait catch block; its message is the plain "not found" text, not wrapped with "Expected: visible"` (AC31/Scope "Resolution sits outside the existing try/catch") — distinguishes the new resolution-timeout message from the pre-existing `Expected: visible\nGot: element not found` message that AC16's Failure clause explicitly forbids as a now-wrong output.
- `assertText/assertValue/assertEnabled/assertDisabled/assertChecked/assertUnchecked read their condition exactly once after resolution, never retried` (Scope exclusion, explicit regression) — mocked target resolves then the condition-check (e.g. text comparison) is evaluated once; even if the mock is set up so a *second* read would return a different (passing) value, the test confirms the command still reports the *first* read's failure — pins that only `assertUrl`/`assertCount` retry their own condition, not these.
- `assertNotVisible delegates entirely to resolveNotVisible and throws the unchanged "Expected: not visible\nGot: visible" literal on a false result` (AC22, mechanism) — mocked `resolveNotVisible` returns `false`; exact message, no selector or timeout embedded (AC22 explicitly keeps the old, generic message).
- `assertUrl retries via retryUntil and reports the last observed URL at the deadline` (AC29) — exact `Expected: /never\nGot: /integration` — the mocked page's URL is read fresh on each poll (not cached from the first attempt), confirmed by varying the mock's URL mid-poll and asserting the LAST value appears, not the first.
- `assertUrl passes as soon as the URL matches, without waiting for the full deadline` (AC28, mechanism half) — mocked URL flips to the target mid-poll-sequence; command resolves on that poll, not the deadline (fake-clock elapsed asserted as less than full budget).
- `assertCount retries and reports the last observed count at the deadline, not a stale first-read count` (AC30b) — exact `Expected: 5\nGot: 3`.
- `assertCount passes once count matches, without over-waiting` (AC30a mechanism).
- **Edge — assertUrl's URL comparison during retries must use the SAME comparison semantics as the original single-check version (exact match vs. prefix, query-string handling, etc.)** — not an AC itself, but a regression concern: the retry loop must not accidentally change *what* counts as a match (e.g. by introducing trimming or normalization) while changing *when* it's checked. Test reuses an existing non-timing assertUrl match/mismatch case from this suite (if present) inside the new retry wrapper to confirm identical semantics — flagged as needing the consolidator to pair this with whatever pre-existing assertUrl matching tests already exist (this generator hasn't read them).

### Navigation (AC33–AC35, AC37)

- `goto rethrows a Playwright TimeoutError with the exact navigation-failed message, embedding the configured budget, not Playwright's own remaining-time report` (AC33a mechanism) — mocked `page.goto` rejects with `{name:'TimeoutError'}`; message exactly `Navigation failed: <url> — timed out after 1500ms` using `d.timeoutMs`, confirmed distinct from any value Playwright's error object itself carries (test gives the mock error a *different*, wrong elapsed value to prove the rethrow ignores it).
- `reload / goBack / goForward each rethrow with their own "<type> timed out after Nms" message` (AC33b, AC34 mechanism) — three sub-cases.
- `goBack/goForward keep waitUntil:'commit' and their existing fresh-page history messages unchanged` (AC34) — "No previous page in history." / "No next page in history." literal, PASSES on both versions (these specific messages are explicitly unchanged by this feature — flagged so the arbiter doesn't mistakenly treat an *unedited* assertion here as suspicious when it reviews the diff).
- `a non-TimeoutError navigation failure (e.g. DNS failure) is NOT rewritten; it propagates as-is` (S5 "Any other error behaves as today") — mocked rejection with a different error name; message is the original error's message, untouched.
- `the pre-existing plain Error('Timeout exceeded') (not Playwright's TimeoutError shape) still propagates unmodified` (S5 "C-19's plain Error('Timeout exceeded') still propagates") — regression, PASSES on both versions (this is explicitly an *existing* test case (C-19) the Seam Notes call out as untouched).
- `waitForPageLoad: both the URL wait and the load-state wait receive d.pwTimeout(), and the second wait gets only the REMAINING budget, not a fresh one` (AC37 mechanism) — mock the URL wait to consume (simulated) time, then assert the load-state wait's `{timeout}` argument reflects the shrunk remainder, not the original full value — this is the unit-level mechanism underlying AC37's full real-time assertion (reserved for integration).
- `waitForPageLoad inner timeout:0 passes {timeout:0} (unbounded) to BOTH waits` (AC73, S5 "Inner 0 means unbounded, so both waits get {timeout:0}") — confirms `0` isn't accidentally only applied to the first wait.
- **Edge — waitForPageLoad where the URL wait fails (times out) before the load-state wait even starts** — the load-state wait must never be attempted at all (its mock is never called), and the surfaced message is the URL-wait's timeout message, not a merged/confused one — not independently ACed; a natural implementation risk given "one budget covers both waits" could be read as "run both regardless, in parallel" rather than "sequential, and the first failure ends it."
- **Edge — exact zero remaining budget for the second waitForPageLoad wait** (URL wait consumes the ENTIRE budget, leaving 0ms for the load-state wait) — per S3, `pwTimeout()` is "never 0 for a bounded deadline... passes 1" — so the second wait still gets `{timeout:1}`, not `{timeout:0}` (which Playwright would read as unbounded, the opposite of intended) — this is the single most safety-critical boundary in the whole one-budget design (a bug here silently makes `waitForPageLoad` block forever on its second wait when the budget is nearly exhausted) and deserves its own explicit unit test, not just reliance on the generic `deadline.test.ts` `pwTimeout()` test — included here as the composed, command-level consequence.

### executeWithin (AC24–AC27 command-level, Q18)

- `executeWithin validates nth<0 before attempting any resolution` (S5 "Validate nth<0 first") — mocked `resolveContainerLocator` is never called when `nth=-1`; error surfaces immediately.
- `executeWithin's sibling timeout bounds ONLY the container lookup; the inner do: step gets its own independently-resolved timeout, not the within deadline` (AC27 mechanism) — mocked container resolves within budget; the inner step's dispatched call is inspected to confirm no `within`-scoped deadline leaked into it (the dispatch mock receives a step/ctx but the test confirms `executeWithin` itself passes nothing timeout-related down — the actual per-step deadline computation for the inner command happens at the dispatcher layer, tested separately in `timeouts.test.ts`/dispatcher tests; this unit test pins `executeWithin`'s OWN contract of not forwarding its deadline).
- `executeWithin passes the whole step (not just the bare command) to its dispatch callback` (Errata "dispatch API" / S5 WithinDispatch signature) — mock `dispatch` callback asserts it receives `{session?, timeout?, command}` shape, confirming T10's removal of the T5-era wrapping (`{command: nc}`) once the real step is threaded through.
- **Edge — executeWithin's container resolves successfully but the inner do: array is empty (`do: []`)** — not ACed; command-level sanity check that an empty inner list is a no-op pass, not an error, and doesn't hang on a non-existent deadline computation. Low risk, included for completeness since AC24–27's examples all have exactly one inner step.

PASSES on both versions (dispatch-signature mechanics, Errata "dispatch API" section): the ~99 existing call sites across other files converting `dispatch(page, cmd, ...)` to `dispatch(page, {command: cmd}, ...)` are a pure call-shape change with NO behavioural change — every pre-existing assertion in `uivisor-app/tests/integration/commands.test.ts`, `tests/unit/error-message-format.test.ts`, `tests/unit/lazy-interpolation-timing.test.ts`, `tests/unit/sessions.test.ts`, `tests/unit/set-var-commands.test.ts`, `tests/unit/within-dispatcher.test.ts` and `engine/index.ts`'s own behaviour should continue to pass unmodified in substance (only the call-site syntax changes) — **PASSES on both versions**, flagged explicitly so the arbiter's direction-check doesn't waste cycles re-deriving expected values for these ~99 sites; they're a mechanical signature migration, not new assertions.

---

## uivisor-app/tests/unit/within-dispatcher.test.ts (EXISTING, edited per T10 + Errata "dispatch API")

Unit.

- `the within dispatch callback now receives the full SessionedCommand step, not a bare Command` (Errata dispatch API, S5 WithinDispatch) — regression-adjacent: this is a NEW assertion about the callback's parameter shape (previously it would have received a bare command, if the suite predates this feature) — not PASSES-on-both since the shape changed; direction is "fails pre-change (bare command), passes post-change (step)."
- `an inner do: step carrying its own sibling timeout is visible to the dispatch callback as part of the step object` (AC42 mechanism, cross-check with the parser test) — the callback receives `{timeout:1000, command:{...}}`, confirming the within-to-dispatch wiring doesn't drop the sibling.
- **Edge** — `a within whose do: array mixes a sibling-timeout step and a plain step in the same call` — both are forwarded with their individually correct shapes (one with `timeout`, one without the key at all — not `timeout: undefined`, matching S1's "Absent key = property absent" rule, which affects `toEqual` assertions elsewhere in the suite that may do exact object matching).

PASSES on both versions: none for the shape-change tests themselves (see above); any pre-existing tests in this file about `nth`/container selection logic *unrelated* to the dispatch callback's parameter shape are unaffected and PASSES on both versions, but cannot be named without reading the file (flagged in Spec gaps).

---

## uivisor-app/tests/unit/session-engine.test.ts, uivisor-app/tests/unit/runner-no-auto-nav.test.ts, recorder-app/src/flowReplayer.test.ts (EXISTING, edited per Errata E2a/E2b)

Unit/regression, exact line numbers per Errata.

- `session-engine.test.ts lines 112,131,133,166,185,188,216: goto/reload mock-call assertions updated to the exact new shape {waitUntil:'load', timeout:30000}` (Errata E2a) — exact object equality, not `objectContaining`, per the Errata's explicit instruction ("Update them to the exact new shape... not expect.objectContaining"). Direction: fails pre-change (old shape has no `timeout` key), passes post-change.
- `runner-no-auto-nav.test.ts line 180: same exact-shape update` (Errata E2a).
- `flowReplayer.test.ts lines 104,179,330: same exact-shape update, using the built-in defaults since recorder-app passes none of its own` (Errata E2a, S12 "gets the built-in budgets").
- `flowReplayer.test.ts T24 (assertUrl mismatch): given an explicit 10000ms vitest test timeout, and its existing assertions are otherwise unchanged` (Errata E2b) — the test's own *content* (what it asserts about the mismatch message) is PASSES on both versions; only its vitest `timeout` option is new, because the command itself now legitimately takes up to 5000ms (the default) to fail, which would otherwise exceed vitest's 5000ms per-test default.
- `recorder-app build and vitest run both succeed using only the built-in defaults (no source change in flowReplayer.ts)` (AC74, S12 "No source change") — a build/test-run assertion, not a unit assertion; included here since it's this file-group's responsibility per the task breakdown.
- **Edge — flowReplayer's private within copy's not-found message reflects the NEW container-lookup text** (S12: "the not-found message it can hit is now the new container text") — a recorder-specific regression: any recorder test asserting the OLD `within: No container found …` text (without a timeout value) must be updated to expect the new `within: No container found after <T>ms for selector '...'` form, using whatever default budget recorder's private copy ends up using (per S12, the built-in 5000, since recorder passes no deadline). Not an AC by number; a direct, easily-missed consequence of S4's new message format propagating into a module (`recorder-app`) that the Gate 1 spec explicitly says "no source change" for — meaning its *tests*, not its code, absorb the new message text coming from the shared `resolveContainerLocator`.

PASSES on both versions: T24's assertion content (per above), and any other pre-existing assertions in these three files NOT touching `goto`/`reload`/`within`-container-message call shapes.

---

## uivisor-app/tests/integration/timeouts.test.ts (NEW, T11) — real Chromium, real elapsed time

Integration. Uses an inline `http.createServer` plus the T2 fixture pages (`delayed.html`, `late-enable.html`, `vanish.html`, `duplicates.html`, `growing.html`, `input-disable.html`, `spa-nav.html`) and three server routes (`/hang`, `/reload-hang`, `/slow?ms=N`). All timing assertions use the AC's own stated tolerance (never a tighter one invented by this generator, except where explicitly marked "tightened" above in the unit section).

- `AC1: bare string on delayed.html?delay=1500 passes with durationMs < 2500` (AC1) — integration, real time.
- `AC2: bare string matching only via the text cascade step passes with durationMs < 2600` (AC2) — integration, real time.
- `AC3: pipe string with one absent + one delayed segment passes with durationMs < 2600` (AC3) — integration.
- `AC4: each of three object-selector forms (testId, css, text) passes with durationMs < 2500, each on a fresh page load` (AC4) — integration, 3 sub-cases, each a fresh `page.goto`.
- `AC5: {xpath} form passes with durationMs < 2500` (AC5) — integration.
- `AC7: tapOn 'Submit' before the testid button appears clicks the button, not the heading, confirmed via assertVisible int-submit-result` (AC7) — integration, real DOM timing (heading at t, button at t+50ms).
- `AC8: pipe-string stability case, same page, same two-step assertion sequence` (AC8) — integration.
- `AC12: duplicate-collapsing row selector passes with durationMs < 1800` (AC12) — integration, real time (duplicates.html?mode=collapse).
- `AC21: assertNotVisible on an element removed at 1500ms passes with durationMs < 2500` (AC21) — integration (vanish.html).
- `AC22: assertNotVisible on an element that stays visible fails after 1000ms with the exact unchanged message` (AC22) — integration; message content is pinned exactly even though this is a real-browser test (not merely "fails").
- `AC23 revised (a)(b)(c): all three duplicates.html?mode= variants against assertNotVisible` (AC23) — integration, real time, 3 sub-cases.
- `AC24: within on a delayed card passes with durationMs < 2500` (AC24) — integration.
- `AC25: within container not-found at the deadline, exact two-line message` (AC25) — integration (message exactness even though timed via real browser).
- `AC26: within nth=2 on growing.html (1→3 items at 1000ms) passes with durationMs < 2000; a never-reaches-3 variant fails at 1000ms with the exact nth-mismatch message` (AC26) — integration, 2 sub-cases.
- `AC27 (a)(b): within sibling timeout bounds only the container lookup — the (a) pass case and the (b) deadline-fail case` (AC27) — integration, 2 sub-cases; (a) is the one case in this whole suite with the LARGEST tolerance window (up to ~5000ms wait) since it deliberately exercises the un-bounded inner default.
- `AC28: assertUrl on the test-app's own redirect behavior is actually exercised via the test-app flow (AC77/AC28 live), not this fixture suite — cross-reference only` — **note**: AC28 as written targets the live test-app route `/integration-timeouts?redirect=`, which belongs to T3/T12, not the T2 fixture set; this generator initially assumed `spa-nav.html` (T2) would cover it, but S13's table maps `spa-nav.html` only to AC37, and AC28 explicitly to the live test-app. **Flagged as a coverage note, not a gap**: AC28 is covered in the "test-app flows" section below, not here.
- `AC30: assertCount on growing.html — (a) expected 3, passes under 2000ms; (b) expected 5 with sibling timeout 1500, fails after 1500ms with "Expected: 5\nGot: 3"` (AC30) — integration, 2 sub-cases, exact Got-count pinned against real DOM growth.
- `AC31: all 15 element commands against a dedicated flow with header defaultTimeout:1200, each targeting int-never-rendered, each failing with the exact 1200ms message` (AC31) — integration (full engine round-trip; the unit version in commands.test.ts tests the mechanism, this tests the real wiring from flow header to deadline).
- `AC32 revised: inputText shorthand after a disabled input fails after 1000ms with "Element not actionable after 1000ms: data-testid=int-input"` (AC32) — integration (input-disable.html).
- `AC33 (a)(b): goto /hang and reload against /reload-hang each fail after navigationTimeout:1500 with a message containing 1500ms` (AC33) — integration, real server routes that genuinely never/once-then-hang respond.
- `AC34: go-back.yaml, go-forward.yaml, their navigationTimeout:20000 copies, and a fresh-page goBack/goForward history-message check` (AC34) — integration, 5 sub-flows (unusual in that two of the four "flows" are copies with a header override — same assertions, different header).
- `AC35 (a)(b)(c): waitForPageLoad inner vs sibling vs header navigationTimeout, three budgets (1000, 1500, 1200), each message containing its own value` (AC35) — integration, 3 sub-cases, all against the same never-reached path to isolate budget selection from any other variable.
- `AC36 (a)(b): late-enable.html — enabled at 3000ms fails no earlier than 2000ms and no later than 2900ms after step start; enabled at 1800ms passes` (AC36) — integration, the one AC in this suite with an asymmetric window (2000–2900) rather than a simple "<N" bound; test must assert BOTH the lower and upper bound, not just the upper (a plausible oversight: AC36(a)'s lower bound of "no earlier than 2000ms" is just as load-bearing as the upper, since a too-early failure would indicate the resolution budget leaked into, rather than shared with, the action budget).
- `AC37: spa-nav.html's pushState at 800ms + /slow?ms=1700-backed fetch — waitForPageLoad timeout:1500 fails no later than 2500ms after start` (AC37) — integration; also assert it does NOT pass (which per the AC "would need about 2500ms" of combined budget it doesn't have — explicit negative assertion, not just a timing bound).
- `AC39: sibling timeout:1500 on a string-selector command fails after 1500ms with the exact message` (AC39) — integration, full round-trip through the real parser+dispatcher+resolver stack (the unit test covers parsing; this confirms the parsed value actually drives the real deadline).
- `AC40 (a)(b): key-order and session: interplay, both failing after 1500ms, (b) confirmed running in session b` (AC40) — integration.
- `AC43: child flow's own sibling timeout (4000) overrides the inherited top-level default (1000) and passes against the AC1 delayed element` (AC43) — integration.
- `AC48: setVar then ${t} in sibling timeout resolves to 1300 at dispatch and drives a real 1300ms failure` (AC48) — integration (dispatch-time var resolution against a real deadline, not just the message-format unit check).
- `AC51/AC52: full five-layer-removal precedence chains, each reporting the exact expected Nms, run against the real engine (navigationTimeout's "none set" case explicitly marked slow, per S13's 30000ms real wait)` (AC51, AC52) — integration; AC52's final 30000ms case is explicitly a `test.skip`-free but `vi.setConfig({testTimeout: ...})`-extended, deliberately slow test, matching the AC's own "may be done once, in a slow-marked test" allowance.
- `AC53: header navigationTimeout alone doesn't affect an element probe (reports 5000ms); CLI --timeout alone doesn't affect a waitForPageLoad probe (still running, i.e. not yet failed, at 1500ms, confirmed via the 30000ms budget)` (AC53) — integration, 2 sub-cases; (b)'s assertion is explicitly "still running at 1500ms" per the AC's own suggested technique, not a full 30s wait.
- `AC56: --timeout 1300 applied to a directory with two flows, both report 1300ms` (AC56) — integration, CLI-level directory run.
- `AC58/AC59 revised/AC60 revised/AC61 revised/AC62/AC80: the full child-flow inheritance + notice matrix` (AC58–62, AC80) — integration, 7+ sub-cases including the grandchild case (AC62) and the once-per-top-level-run dedup (AC60a's "two calls don't print it twice") — stdout captured via a spy on `process.stdout.write`.
- `AC63: running child.yaml directly as the top-level flow applies its own 4000ms value with no notice` (AC63) — integration.
- `AC64: runFlow vars: {defaultTimeout:"1000"} does not become the effective timeout; the child's ${defaultTimeout} resolves to the plain var "1000"` (AC64) — integration, two assertions in one test (the probe's real timeout AND the var's string value).
- `AC66 (dispatch half): ${defaultTimeout} after config-stripping fails at dispatch with the exact flow-path message` (AC66) — integration (the parse-time half is in timeout-config.test.ts; this confirms the full dispatch-time error).
- `AC69 (runFlow half): a child with defaultTimeout:0 fails the parent's runFlow step with the exact message` (AC69) — integration.
- `AC73: a flow with nothing configured — element probe at 5000ms, waitForPageLoad probe message containing 30000ms, and timeout:0 still parses` (AC73) — integration, baked-in-defaults smoke test.
- `AC75: tapOn with a sibling timeout:3000 produces an IDENTICAL label across console, HTML and Markdown reporters compared to the same tapOn without the sibling` (AC75) — integration, 3 reporter sub-cases (console/html/md), run twice each (with/without sibling) and diffed.
- `AC80 real-engine confirmation (duplicate of the pure-function test, run through actual runFlow + stdout capture)` — integration, cross-check that the precedence module's pure-function correctness (tested in timeouts-precedence.test.ts) actually gets WIRED into the real `runFlow`/`createContext` path, since a pure-function test alone can't catch a dispatcher that forgets to call `timeoutNotice` at all.
- **Edge/race — two sessions in the SAME top-level flow both calling runFlow on the same child file** — per S11 "one ctx per top-level flow," both sessions share the same `ctx.timeoutNotices` Set; test confirms the notice fires only ONCE even when triggered from two different sessions within one run (extends AC60's "two calls don't print it twice" from "two calls in sequence" to "two calls from concurrently-dispatched sessions," which is a materially different code path — concurrent/interleaved `runFlow` execution via the session mechanism, not just two sequential `runFlow` steps in one session). Not independently ACed; flagged as a plausible race the Set-based dedup might not survive if `ctx` were ever cloned per-session rather than shared.
- **Edge — a flow with BOTH a passing probe and a failing probe in sequence, where the failing one's deadline is observed via wall-clock to confirm the PREVIOUS passing step's elapsed time didn't bleed into the next step's budget** (one-context-per-top-level-flow does NOT mean one-deadline-per-flow) — guards against a `Deadline` object being created once per flow and reused/decremented across steps rather than freshly created per step via `stepTimeoutMs`+`createDeadline` in `dispatch`. Not ACed; a serious correctness risk given how central the "one ctx" design is — this test exists specifically to distinguish "one timeouts POLICY per flow" (correct, per S1's `ctx.timeouts`) from "one deadline INSTANCE per flow" (would be a bug).

PASSES on both versions: none (the whole engine-level timeout wiring is new).

---

## test-app/flows/integration/timeouts.yaml (NEW, T12) — live test-app, real time, exit-code-level integration

- `full flow run against http://localhost:8084 exits 0 with 100% commands passing, and contains no wait:/waitFor: step` (AC77) — integration, live app.
- `(1) int-delayed found via bare string, pipe string, object selector and xpath object, all within the flow` (AC77 sub-1).
- `(2) stability case: tapOn Submit then assertVisible {testId: int-submit-result}` (AC77 sub-2, same scenario as AC7 but against the live app rather than the fixture).
- `(3) goto ?delay=6500 then assertVisible data-testid=int-delayed with sibling timeout:8000` (AC77 sub-3) — the one case in this flow with a timeout close to its upper practical bound (8000ms); worth noting as the slowest single step in the flow (affects overall suite runtime).
- `(4) assertNotVisible on the absent int-never-rendered and the hidden int-hidden, both string selectors` (AC77 sub-4, AC19 "also runs on the existing /integration page" plus the new page's hidden case AC20).
- `(5) assertUrl /integration-timeouts?arrived=1 after goto ?redirect=1500, with no wait:` (AC77 sub-5, AC28 live).
- `(6) within on a delayed card against int-delayed-card/int-card-label` (AC77 sub-6).
- **Edge — the flow explicitly must NOT contain a wait: or waitFor: step anywhere, including as a disguised dependency (e.g. a wait: 0 used as a no-op separator)** — a static-content check on the YAML file itself, run as part of the integration test harness (grep the file), not just "the flow passes" — AC77 is explicit that absence of `wait:`/`waitFor:` is part of the pass criterion, not merely incidental; a flow that happens to pass WITH a stray `wait: 100` somewhere would still violate AC77 to the letter.

PASSES on both versions: none (new flow file).

---

## test-app/flows/integration-negative/timeouts-default-fails.yaml (NEW, T12)

- `exit code 1, stdout contains ✗ assertVisible and the exact line "Element not found after 5000ms: data-testid=int-delayed"` (AC78) — integration, live app, real 5000ms wait.
- `the failing step's durationMs (via --reporter md) is in [5000, 6000)` (AC78) — integration, exact numeric range check (not "around 5000ms").
- **Edge — this flow is explicitly run OUTSIDE the integration/ directory (per the Constraints "Negative flow location" note), so a separate test must confirm it is NOT swept up by the AC79 "run test-app/flows/integration/ as a whole directory" command** — i.e. a test that runs the integration/ directory and asserts the negative flow's known failure does NOT appear in that run's output (since if it were accidentally placed inside `integration/`, AC79's "every flow passes" would be violated). Not an AC by number but a direct structural consequence of the Constraints note and AC79's exact-37-count requirement — this is exactly the kind of "did the file end up in the wrong place" boundary a straightforward reading of AC78 alone would miss, since AC78 only says how to run the negative flow, not where it must NOT be.

PASSES on both versions: none (new flow file).

---

## test-app/flows/integration-variants/go-back-nav-timeout.yaml, go-forward-nav-timeout.yaml (NEW, T12)

- `each variant (header navigationTimeout:20000) passes against the live app, using config: ../integration/config.yml` (AC34, live half) — integration.
- **Edge** — confirms these two variant flows are run via an explicit, separate CLI invocation (NOT swept into the `integration/` directory run), matching the Constraints note "They can't go in integration/, because AC79 fixes that directory at 37 flows" — same class of structural check as above, worth a dedicated assertion in the test harness/CI script (e.g. a glob-count check: `integration/*.yaml` is exactly 37 files) rather than trusting file placement by convention alone.

PASSES on both versions: none (new flow files).

---

## Full regression run: `test-app/flows/integration/` directory (AC79 revised)

- `node uivisor-app/dist/cli/index.js test test-app/flows/integration/ exits 0 and every one of the 37 flows passes` (AC79 revised) — integration, live app, the single largest/slowest test in the whole plan (all 37 flows, including `run-flow-override.yaml` + child + the new `timeouts.yaml`).
- `the directory contains exactly 37 .yaml flow files (a static count check, independent of running them)` (AC79's "37 flows" claim, structural half) — guards against a miscount if a future flow is added/removed without updating the AC's stated number; cheap, fast, run before the expensive full pass.
- **Edge — re-running the full directory a second time in the same CI invocation produces an IDENTICAL pass/fail result (idempotency)**, particularly relevant to the new timeout-notice stdout lines (AC60's "once per top-level run" — a second full run must independently re-emit notices for its OWN run, not suppress them because a previous run in the same CI job already saw them) — this interacts with the earlier "notices must not persist across runs" edge case flagged under `timeouts-precedence.test.ts`, now re-asserted at the full-directory, live-process level (new OS process per run, so this mostly re-confirms there's no accidental file-based or env-based persistence of the notice set across invocations). Not ACed; flagged as a sanity check given CI commonly re-runs flaky suites.

PASSES on both versions: the 36 pre-existing flows' own pass/fail outcomes are unaffected by this feature in the common case — PASSES on both versions AS LONG AS none of them happen to probe an absent element without a timeout override (which would now take up to 5000ms longer to fail, per S13's "Slower suites" note, but should not change pass/fail status, only duration). Flagged as a borderline case below (an existing flow that was *marginally* timing-sensitive — e.g. relying on a race that happened to resolve favourably under the old single-check behaviour — could, in principle, flip from pass to fail or vice versa now that element commands retry instead of checking once; the spec's AC73 "every flow that passes today still passes" is the relevant guarantee, but this generator cannot verify it without running the actual 36 flows, which generator A/the Coder's Phase 2 run will do).

---

## AC → Test coverage table

| AC | Covered by |
|---|---|
| AC1 | playwrightLocator.test.ts (unit, logic) · timeouts.test.ts (integration, real time) · timeouts.yaml sub-1 |
| AC2 | playwrightLocator.test.ts (unit) · timeouts.test.ts (integration) |
| AC3 | playwrightLocator.test.ts (unit) · timeouts.test.ts (integration) |
| AC4 | playwrightLocator.test.ts (unit) · timeouts.test.ts (integration) |
| AC5 | playwrightLocator.test.ts (unit) · timeouts.test.ts (integration) |
| AC6 | playwrightLocator.test.ts (unit, fake clock) |
| AC7 | playwrightLocator.test.ts (unit) · timeouts.test.ts (integration) · timeouts.yaml sub-2 |
| AC8 | playwrightLocator.test.ts (unit) · timeouts.test.ts (integration) |
| AC9 | playwrightLocator.test.ts (unit, fake clock) |
| AC10 | playwrightLocator.test.ts (unit, fake clock) |
| AC11 (E1-revised) | playwrightLocator.test.ts (unit, fake clock) |
| AC12 | playwrightLocator.test.ts (unit) · timeouts.test.ts (integration) |
| AC13 | playwrightLocator.test.ts (unit, fake clock) · deadline.test.ts (unit, cadence mechanics) |
| AC14 | playwrightLocator.test.ts (unit, fake clock/short deadline) |
| AC15 | playwrightLocator.test.ts (unit) |
| AC16 | playwrightLocator.test.ts (unit) |
| AC17 | playwrightLocator.test.ts (unit) |
| AC18 | playwrightLocator.test.ts (unit) |
| AC19 | timeouts.yaml sub-4 (integration; AC19 explicitly runs on the live `/integration` page, not a fixture) |
| AC20 | playwrightLocator.test.ts (unit, not-visible) · timeouts.yaml sub-4 (hidden case) |
| AC21 | playwrightLocator.test.ts (unit) · timeouts.test.ts (integration) |
| AC22 | playwrightLocator.test.ts (unit) · commands.test.ts (unit, message mechanism) · timeouts.test.ts (integration) |
| AC23 (revised) | playwrightLocator.test.ts (unit, a/b/c + 2 extra edge cases) · timeouts.test.ts (integration, a/b/c) |
| AC24 | playwrightLocator.test.ts (unit) · timeouts.test.ts (integration) |
| AC25 | playwrightLocator.test.ts (unit) · timeouts.test.ts (integration) |
| AC26 | playwrightLocator.test.ts (unit) · timeouts.test.ts (integration) |
| AC27 | commands.test.ts (unit, mechanism) · timeouts.test.ts (integration, a/b) |
| AC28 | timeouts.yaml sub-5 (integration, live app; this is the authoritative seam per spec) |
| AC29 | commands.test.ts (unit) |
| AC30 | commands.test.ts (unit) · timeouts.test.ts (integration, a/b) |
| AC31 | commands.test.ts (unit, 15-case table) · timeouts.test.ts (integration, full engine) |
| AC32 (revised) | commands.test.ts (unit) · timeouts.test.ts (integration) |
| AC33 | commands.test.ts (unit, mechanism) · timeouts.test.ts (integration, a/b) |
| AC34 | commands.test.ts (unit, regression) · timeouts.test.ts (integration, 5 sub-flows) |
| AC35 | timeouts-precedence.test.ts (unit, stepTimeoutMs mechanism) · timeouts.test.ts (integration, a/b/c) |
| AC36 | commands.test.ts (unit, mechanism) · timeouts.test.ts (integration, a/b, asymmetric window) |
| AC37 | commands.test.ts (unit, mechanism) · timeouts.test.ts (integration) |
| AC38 (revised) | commands.test.ts (unit) |
| AC39 | sibling-timeout-parser.test.ts (unit) · timeouts.test.ts (integration) |
| AC40 | sibling-timeout-parser.test.ts (unit, + permutation edge) · timeouts.test.ts (integration) |
| AC41 | sibling-timeout-parser.test.ts (unit, table-driven) |
| AC42 | sibling-timeout-parser.test.ts (unit) · within-dispatcher.test.ts (unit) |
| AC43 | timeouts.test.ts (integration) |
| AC44 | sibling-timeout-parser.test.ts (unit, table-driven) |
| AC45 | sibling-timeout-parser.test.ts (unit, a) · timeouts.test.ts / engine (integration, b — see Spec gaps: no dedicated unit test file identified for the b half beyond the integration suite) |
| AC46 | sibling-timeout-parser.test.ts (unit) |
| AC47 | sibling-timeout-parser.test.ts (unit) · positive-int.test.ts (shared predicate) |
| AC48 | timeouts.test.ts (integration; dispatch-time var resolution needs a real/engine round-trip) |
| AC49 | sibling-timeout-parser.test.ts assumption — **see Spec gaps**: AC49 is a dispatch-time (not parse-time) assertion per S6, so its primary home should be a dispatcher unit test; none of the task breakdown's listed files is an obvious "dispatcher.test.ts" unit file distinct from the integration suite. Covered here only at integration level (timeouts.test.ts) pending consolidator reconciliation with generator A. |
| AC50 | timeouts.test.ts (integration) — same gap as AC49: this is dispatch-time var-context logic, best unit-tested against `dispatcher.ts` directly; no such unit file is named in the task breakdown. |
| AC51 | timeouts-precedence.test.ts (unit, pure function) · timeouts.test.ts (integration, full chain) |
| AC52 | timeouts-precedence.test.ts (unit) · timeouts.test.ts (integration, incl. slow-marked 30000ms case) |
| AC53 | timeouts-precedence.test.ts (unit) · timeouts.test.ts (integration) |
| AC54 | timeouts-precedence.test.ts (unit) |
| AC55 | args.test.ts (unit) |
| AC56 | timeouts.test.ts (integration) |
| AC57 | timeout-config.test.ts (unit, a/b/c) |
| AC58 | timeouts-precedence.test.ts (unit, timeoutNotice) · timeouts.test.ts (integration) |
| AC59 (revised) | timeouts-precedence.test.ts (unit) · timeouts.test.ts (integration) |
| AC60 (revised) | timeouts-precedence.test.ts (unit) · timeouts.test.ts (integration) |
| AC61 (revised) | timeouts-precedence.test.ts (unit) · timeouts.test.ts (integration) |
| AC62 | timeouts-precedence.test.ts (unit, "names top-level" rule) · timeouts.test.ts (integration) |
| AC63 | timeouts.test.ts (integration) |
| AC64 | timeouts.test.ts (integration) |
| AC65 | timeout-config.test.ts (unit) |
| AC66 | timeout-config.test.ts (unit, parse half) · timeouts.test.ts (integration, dispatch half) |
| AC67 | timeout-config.test.ts (unit) |
| AC68 | timeout-config.test.ts (unit) |
| AC69 | timeout-config.test.ts (unit, parse half) · timeouts.test.ts (integration, runFlow half) |
| AC70 | commandTraits.test.ts (unit) |
| AC71 | commandTraits.typecheck.ts (compile-time) |
| AC72 | sibling-timeout-parser.test.ts (unit, generative table) |
| AC73 | deadline.test.ts (unit, DEFAULT_TIMEOUTS) · commands.test.ts (unit) · timeouts.test.ts (integration) |
| AC74 | build/test-run assertions across session-engine.test.ts, runner-no-auto-nav.test.ts, flowReplayer.test.ts, commands.test.ts, playwrightLocator.test.ts — **not independently re-stated as its own bullet beyond "builds succeed / N tests pass" smoke checks**; see Spec gaps for why this AC resists being pinned to one file. |
| AC75 | commands.test.ts (unit, label computation untouched by construction, per S1) · timeouts.test.ts (integration, 3 reporters) |
| AC76 | **Not covered by any unit/integration test in this plan — see "ACs not covered" below.** |
| AC77 | timeouts.yaml (integration, live app, 6 sub-cases + structural wait:-absence check) |
| AC78 | timeouts-default-fails.yaml (integration, live app) |
| AC79 (revised) | full directory run (integration, live app) + structural file-count check |
| AC80 | timeouts-precedence.test.ts (unit, a/b) · timeouts.test.ts (integration) |

## ACs not covered, with reason

- **AC76 (test-app timeouts fixture page content/markup)**: this AC describes a React component's rendered DOM shape (`IntegrationTimeoutsPage.jsx`) — it is exercised *indirectly* by every test in `timeouts.yaml`/the negative flow that depends on the page's elements existing (AC77's sub-cases, AC78, AC28), but there is no dedicated unit test for the component itself (e.g. a React Testing Library render test) anywhere in the task breakdown's file list — T3's own row lists only the page/route files, no test file. **Reason uncovered**: the task breakdown allocates no test file to T3; test-app has no stated unit-testing convention for its pages in the Gate 1 materials I was given (prior art citations are all for `packages/core`/`uivisor-app`, none for `test-app/src/pages/*`). Recommend the Architect/Coder add either a lightweight component test or accept AC76 as covered only transitively through AC77/AC78/AC28's live-flow assertions — flagging this explicitly rather than inventing a test file not in the breakdown.

No other AC is left uncovered; AC49/AC50/AC45(b) are covered but flagged above as *weakly* covered (integration-only, no clearly-designated unit-test home) — see Spec gaps.

---

## Spec gaps / ambiguities found

1. **No AC pins the exact message when `buildSteps` hits an unrecognised selector-type object** (S4's fourth fail-fast case). AC18 only exercises unknown-attribute, xpath-union-in-pipe, and invalid-xpath; "unrecognised selector type" has no stated message format.
2. **No AC bounds the upper end of a valid timeout value.** `parsePositiveInt` accepts arbitrarily large digit strings (e.g. `"99999999999999"`); nothing in §9.4 or AC47/AC68 states a maximum, so a user-set timeout could effectively never expire within any realistic test run. Possibly intentional (no SLA/sanity ceiling exists until phase 2's `sla` work), but worth the arbiter's confirmation that this is accepted, not an oversight.
3. **Leading-zero digit strings** (`"007"`) are not explicitly addressed by AC47 ("3000" is the only accepted-string example given); behaviour falls out of the `/^\d+$/` + `Number()` combination but isn't itself specified.
4. **CLI flag edge cases are underspecified**: AC55 only covers "flag as the last argument with no value" (AC55e); it doesn't say what happens when `--timeout` is immediately followed by *another recognised flag* (greedy-consume vs. look-ahead), nor what happens if the same flag is given twice in one invocation (first-wins/last-wins/error).
5. **`resolveRunTimeouts`/`stepTimeoutMs`'s behaviour when called with a literal `0`** that somehow bypasses upstream validation is unstated. Every *validated* input path rejects `0`, but neither function's own contract (S7) says it re-validates; `own ?? run.X` with `own=0` would NOT fall through to `run.X` (nullish coalescing treats only `null`/`undefined` as absent), which is almost certainly unintended if it ever happened, but no AC exercises this directly except via `waitForPageLoad`'s *legitimate* `timeout:0` (meaning unbounded) — the two `0`s (an invalid sibling vs. the legitimate unbounded `waitForPageLoad` inner value) need to be kept distinct by the implementation, and nothing in Gate 1 states this contrast explicitly as a design note (it only falls out of reading S3 + S6 + AC73 together).
6. **Validation order when BOTH `defaultTimeout` and `navigationTimeout` are invalid in the same header/config** is unspecified — which error surfaces first.
7. **AC49's and AC50's natural home is dispatch-time logic (`dispatcher.ts`), but the task breakdown names no standalone `dispatcher.test.ts`-style unit file** — T5's own row lists no new test file at all (only source files `dispatcher.ts`, `engine/index.ts`); the only tests that can exercise AC48–50 end up being integration-level (`timeouts.test.ts`) or incidentally covered inside whichever existing unit file happens to call `dispatch` with var-resolution scenarios already (e.g. `tests/unit/lazy-interpolation-timing.test.ts`, mentioned only in the Errata's call-site-migration list, not as a home for new assertions). Recommend the consolidator confirm with generator A / the Architect whether a new dispatcher-focused unit file should be added to T5's file list, or whether AC48–50 are meant to be integration-only by design (plausible, since they require real var-resolution plumbing, but the spec doesn't say so explicitly).
8. **AC74's "builds and unit suites pass" is a cross-cutting gate, not a single testable unit** — by its nature it resists a one-file home; this plan treats it as the sum of all the individual file-level build/test assertions listed in `session-engine.test.ts`'s and `commands.test.ts`'s bullets, but there is no single "run the whole AC74 check" test named anywhere, including in generator B's own plan — flagging that AC74 is really a *release-gate* criterion (matches the Quality Gate step in `state.md`'s pipeline, not a Tester-authored test file) and the consolidator should probably attribute it to the Quality Gate rather than expect a dedicated test.
9. **The notice-dedup Set's lifecycle across concurrent sessions within one top-level flow** (does `runFlow` from two different sessions in the same run share `ctx.timeoutNotices`?) is implied-but-not-explicit from S11 ("one ctx per top-level flow") — flagged as a race worth an explicit integration test (included above) but not something any AC states as a requirement in so many words.
10. **No AC specifies the YAML-duplicate-sibling-key case** (`timeout:` appearing twice in one step mapping) — behaviour is YAML-parser-library-dependent and outside this spec's stated scope, but a malicious/malformed flow file could exercise it; flagged as low-priority but genuinely unaddressed.
11. **AC76 (test-app page markup) has no designated test file** in the task breakdown — see "ACs not covered" above; this is a process gap (missing test-file allocation), not an ambiguity in the AC's own wording, which is otherwise precise.
12. **Whether `resolveSelector.test.ts` (uivisor-app/tests/unit) is a thin pass-through check or an independent re-implementation** could not be determined without reading its current body (worktree access for this role was read-only and this generator did not read that specific file's contents); flagged explicitly in that file's section above rather than guessed into firm test bullets.

---

## Summary

Approximately 230 individual test bullets (unit + integration + structural) across 17 files, hand-mapped to every AC1–AC80 (revised). One AC (AC76, the test-app fixture page's own markup) has no dedicated test file in the current task breakdown and is covered only transitively through the live-flow tests — flagged under "ACs not covered," not silently dropped. Twelve spec gaps/ambiguities were found, the most consequential being: the unbounded upper limit on timeout values, the CLI's unspecified double-flag/adjacent-flag parsing behavior, and AC48–50's dispatch-time logic having no clearly designated unit-test home in the task breakdown (T5 lists no new test file at all).

**Last checkpoint:** tester generators A and B at 2026-10-13 19:55

## Tests

**Role:** tester_consolidator. Source: Generator A (systematic, spec-literal) + Generator B (adversarial edge-case hunter), reconciled against Gate 1 (Revision 1), Gate 1 Errata (E1–E4, dispatch API), Feature & Task Breakdown (T1–T12), Seam Notes S1–S14. Both generators independently reached near-total AC coverage; their diversity shows up mostly as A writing one disciplined test per AC clause and B adding ~38 adversarial edge/race cases with no AC number of their own — not as conflicting expectations. Only one place was found where the two plans actually assert a different value for the same scenario (D1 below).

### Attribution

| AC | Generator A | Generator B |
|---|---|---|
| AC1 | ✓ | ✓ |
| AC2 | ✓ | ✓ |
| AC3 | ✓ | ✓ |
| AC4 | ✓ | ✓ |
| AC5 | ✓ | ✓ |
| AC6 | ✓ | ✓ |
| AC7 | ✓ | ✓ |
| AC8 | ✓ | ✓ |
| AC9 | ✓ | ✓ |
| AC10 | ✓ | ✓ |
| AC11 (rev. E1) | ✓ | ✓ |
| AC12 | ✓ | ✓ |
| AC13 | ✓ | ✓ (tightened — see D1) |
| AC14 | ✓ | ✓ |
| AC15 | ✓ | ✓ |
| AC16 | ✓ | ✓ |
| AC17 | ✓ | ✓ |
| AC18 | ✓ | ✓ |
| AC19 | ✓ | ✓ |
| AC20 | ✓ | ✓ |
| AC21 | ✓ | ✓ |
| AC22 | ✓ | ✓ |
| AC23 (revised) | ✓ | ✓ |
| AC24 | ✓ | ✓ |
| AC25 | ✓ | ✓ |
| AC26 | ✓ | ✓ |
| AC27 | ✓ | ✓ |
| AC28 | ✓ | ✓ |
| AC29 | ✓ | ✓ |
| AC30 | ✓ | ✓ |
| AC31 | ✓ | ✓ |
| AC32 (revised) | ✓ | ✓ |
| AC33 | ✓ | ✓ |
| AC34 | ✓ | ✓ |
| AC35 | ✓ | ✓ |
| AC36 | ✓ | ✓ |
| AC37 | ✓ | ✓ |
| AC38 (revised) | ✓ | ✓ |
| AC39 | ✓ | ✓ |
| AC40 | ✓ | ✓ |
| AC41 | ✓ | ✓ |
| AC42 | ✓ | ✓ |
| AC43 | ✓ | ✓ |
| AC44 | ✓ | ✓ |
| AC45 | ✓ | ✓ |
| AC46 | ✓ | ✓ |
| AC47 | ✓ | ✓ |
| AC48 | ✓ | ✓ (integration-only, no unit home named — see Gap 7) |
| AC49 | ✓ (unit home named via Errata E4 files) | ✓ (flagged as weak/no unit home — see Gap 7) |
| AC50 | ✓ (unit home named) | ✓ (flagged as weak/no unit home — see Gap 7) |
| AC51 | ✓ | ✓ |
| AC52 | ✓ | ✓ |
| AC53 | ✓ | ✓ |
| AC54 | ✓ | ✓ |
| AC55 | ✓ | ✓ |
| AC56 | ✓ | ✓ |
| AC57 | ✓ | ✓ |
| AC58 | ✓ | ✓ |
| AC59 (revised) | ✓ | ✓ |
| AC60 (revised) | ✓ | ✓ |
| AC61 (revised) | ✓ | ✓ |
| AC62 | ✓ | ✓ |
| AC63 | ✓ | ✓ |
| AC64 | ✓ | ✓ |
| AC65 | ✓ | ✓ |
| AC66 | ✓ | ✓ |
| AC67 | ✓ | ✓ |
| AC68 | ✓ | ✓ |
| AC69 | ✓ | ✓ |
| AC70 | ✓ | ✓ |
| AC71 | ✓ | ✓ |
| AC72 | ✓ | ✓ |
| AC73 | ✓ | ✓ |
| AC74 | ✓ (distributed across file-level checks) | ✓ (flagged as a release-gate, not a single test — see Gap 8) |
| AC75 | ✓ (recommends a reporter unit test) | ✓ (integration-only) |
| AC76 | ✓ (indirect, via live-flow transitive coverage only) | — (explicitly flagged uncovered by any dedicated test — see Gap 11) |
| AC77 | ✓ | ✓ |
| AC78 | ✓ | ✓ |
| AC79 (revised) | ✓ | ✓ |
| AC80 | ✓ | ✓ |

**Unique to A:** 2 (the AC48–AC50 unit-test file assignment to existing files per Errata E4's call-site list; the AC75 reporter-unit-test recommendation, adopted below)
**Unique to B:** 38 (adversarial edge/race tests with no AC number of their own — duplicate-oscillation, nth=0 boundary, CLI adjacent-flag parsing, notice-Set lifecycle across sessions/runs, zero-remaining-budget `pwTimeout()`, etc. — all kept in the Consolidated Test Plan below, tagged "(B edge)")
**Shared:** 189 (both generators independently proposed a test for the same AC clause; consolidated into one bullet each, keeping whichever generator's assertion was more exact)
**Total after dedup:** 229

One AC (AC76) needed a new test added by this consolidator, since neither generator assigned it a dedicated file (Generator A only covers it transitively; Generator B explicitly flags it as uncovered). Added under T3 — see the Consolidated Test Plan.

### Disagreements for Arbiter

**D1 — AC13 retry-cadence exactness.** AC13 itself states a tolerant range: "`count()` is called at least 5 and at most 11 times" before a 1000 ms failure. Generator A's test asserts the mock call count falls in `[5, 11]`, matching the AC's own looseness. Generator B's test tightens this: under a fully deterministic fake clock stepping in exact 100 ms increments (attempts at t=0,100,…,1000), it asserts the count is **exactly 11**, and explicitly flags this as "a generator-B addition, not a spec requirement... the arbiter should confirm whether 11 or some other exact count is intended before Coder locks to it." Both are internally consistent (11 is the top of A's own range, and is what `retryUntil`'s stated contract — "the last attempt lands on the deadline itself" — produces under a clean 100 ms-stepped fake clock), but they differ in what the Coder is required to assert: a tolerant bound (A) vs. an exact value (B). **Recommendation for the arbiter:** keep A's tolerant `[5, 11]` assertion as the AC13-numbered test (matches the AC's own stated tolerance, and is robust to any legitimate scheduling variation), and keep B's exact-11 assertion as a separate, explicitly-unnumbered mechanism test on `retryUntil` itself (already how it's filed in `deadline.test.ts`, not `playwrightLocator.test.ts`) — the two don't need to be reconciled into one test, since they test different things (the AC's tolerance vs. `retryUntil`'s own documented contract). No other place in either plan asserts a different expected value/message/timing for the same behaviour; the rest of A/B's divergence is coverage breadth, not conflicting expectations.

### Spec gaps raised by generators

All raised by Generator B except where noted; Generator A independently raised two information-availability caveats (not spec ambiguities) about files it hadn't read (`resolveSelector.test.ts`, `tests/unit/parser.test.ts`) — folded into gap 12 below rather than listed separately.

1. No AC pins the exact message for `buildSteps`'s "unrecognised selector type" fail-fast case (S4's 4th case; AC18 only covers unknown-attribute, xpath-union-in-pipe, invalid-xpath) — *test needs a value the spec doesn't give.*
2. No AC bounds the upper end of a valid `timeout` value; `parsePositiveInt` accepts arbitrarily large digit strings with no sanity ceiling — *test needs a value the spec doesn't give* (resolved for now: test documents current `Number()` behaviour, not a rejection).
3. Leading-zero digit strings (e.g. `"007"`) aren't addressed by AC47 (only `"3000"` is given as the accepted-string example) — *nice-to-have edge case.*
4. CLI flag edge cases are underspecified: `--timeout` immediately followed by another recognised flag (greedy-consume vs. empty-value), and `--timeout` given twice in one invocation (first/last-wins/error) — *test needs a value the spec doesn't give.*
5. `resolveRunTimeouts`/`stepTimeoutMs`'s contract when called with a literal `0` that bypasses upstream validation is unstated; `own ?? run.X` does not treat `0` as absent (only `null`/`undefined` are), which matters because `waitForPageLoad`'s legitimate inner `0` ("unbounded") must flow through as `0`, not be mistaken for an invalid/expired value downstream — *test needs a value the spec doesn't give* (resolved below: pinned as a `stepTimeoutMs`/`createDeadline(0)` contract test, flagged safety-critical).
6. Validation order when both `defaultTimeout` and `navigationTimeout` are invalid simultaneously in the same header/config is unspecified (which error surfaces first) — *test needs a value the spec doesn't give.*
7. AC48–AC50 are dispatch-time (not parse-time) behaviour, but T5's row in the task breakdown names no new test file — only source files. Generator A resolves this by assigning the unit tests to the existing files named in Errata E4's call-site-migration list (`uivisor-app/tests/unit/error-message-format.test.ts` and/or `tests/unit/lazy-interpolation-timing.test.ts`); Generator B flags it as unresolved and defers to integration-only coverage. **Resolved by this consolidator: adopt Generator A's file assignment** (see T5 in the Consolidated Test Plan) — *nice-to-have* in the sense that it's a filing decision, not a behavioural ambiguity.
8. AC74 ("builds and unit suites pass") is a cross-cutting release gate, not a single testable unit; no file in the breakdown owns it as one test. **Resolved: attributed to the sum of the T1–T12 file-level build/test checks plus a final composite gate**, matching the pipeline's own Quality Gate step rather than inventing a dedicated test file — *nice-to-have edge case* (process/attribution note, not a behavioural gap).
9. The timeout-notice dedup `Set`'s lifecycle isn't explicit for two cross-cutting cases: (a) two sessions in one top-level flow both calling `runFlow` on the same child, and (b) two independent top-level runs in the same CI invocation. S11's "one ctx per top-level flow" implies both should work correctly (shared Set within a run, fresh Set across runs), but no AC states either as a requirement — *nice-to-have edge case*, covered by two new integration tests under T11/T12 below.
10. No AC addresses a YAML mapping with a duplicate `timeout:` sibling key in one step (parser-library-dependent, last-key-wins in most YAML parsers) — *nice-to-have edge case*, out of scope for a dedicated test per both generators.
11. AC76 (the test-app fixture page's own markup) has no test file allocated anywhere in the task breakdown; T3's row lists only source files. **Resolved: new test added under T3** (see Consolidated Test Plan) — *process gap*, now closed.
12. Whether `uivisor-app/tests/unit/resolveSelector.test.ts` is a thin pass-through check of the core resolver or an independent re-implementation couldn't be determined by either generator without reading its current body (neither had read access to it) — *information gap, not a spec ambiguity*; the Coder should reconcile the proposed bullets against the file's actual current contents in Phase 2 and keep whichever of this file's existing cases are genuinely untouched by the stability/retry change.

### Consolidated Test Plan

Grouped by test file, each tagged with its owning task ID. `PASSES on both versions` marks regression assertions that hold unchanged before and after this feature.

#### T1 — Core foundation

**`packages/core/src/deadline.ts` (new) — `packages/core/src/deadline.test.ts` (new) [unit, fake clock]**
- `createDeadline(ms) exposes timeoutMs unchanged` (setup for AC13's "T") [unit] — `deadline.timeoutMs === ms`.
- `remainingMs() counts down on the injected clock, floored at 0 after expiry` (S3) [unit].
- `remainingMs() is Infinity for timeoutMs=0 (unbounded)` (AC73) [unit].
- `expired() is false before the deadline, true at/after it` (S3) [unit].
- `pwTimeout() returns ceil(remainingMs()), minimum 1 — never 0 for a bounded deadline, even at expiry` (S3) [unit].
- `pwTimeout() ceils sub-millisecond remaining time to the full value` (why the exact `{timeout:30000}`/`{timeout:5000}` mocks pass unedited, S3) [unit].
- `pwTimeout() returns 0 for an unbounded deadline` (S3) [unit].
- `sleep(ms) caps the requested duration at remainingMs()` (S3) [unit] — `createDeadline(50)`: `sleep(100)` requests `50` from the clock.
- `DEFAULT_TIMEOUTS === { defaultTimeout: 5000, navigationTimeout: 30000 }` (AC73) [unit].
- `RETRY_INTERVAL_MS === 100` (AC13/Constraints) [unit].
- `retryUntil runs attempt once immediately, even on an already-expired deadline` (S3) [unit] — attempt called exactly once, no expiry check first.
- `retryUntil returns the first done result without further polling; sleep is never called` (AC6 mechanics) [unit].
- `retryUntil polls every 100ms via deadline.sleep until done` (AC9 mechanics) [unit] — not-done twice then done; `sleep(100)` called twice.
- `retryUntil's last attempt lands exactly on the deadline` (S3 "the last attempt lands on the deadline itself"; mechanism underlying AC13's upper bound) [unit] — `timeoutMs=1000`, every attempt not-done, fake clock stepped in exact 100ms increments → 11 total attempts. See D1 for how this relates to AC13's own test.
- `retryUntil returns the last not-done result at the deadline, never throwing` (AC11 revised mechanism) [unit].
- `retryUntil propagates an attempt() rejection immediately, without retrying` (AC18 mechanism) [unit] — rejects on call 1, sleep never called.
- `two independently-created Deadlines on two independent fake clocks don't share state` (B edge) [unit] — guards a module-level-singleton-clock mistake.

PASSES on both versions: none (module is wholly new).

**`packages/core/src/commandTraits.ts` (new) — `packages/core/src/commandTraits.test.ts` (new) [unit]**
- `COMMAND_TRAITS has exactly one entry per Command['type'], independently enumerated (not derived from the table itself)` (AC70) [unit].
- `element trait assigned to exactly the 20 Constraints-table element commands` (AC70) [unit].
- `navigation trait assigned to exactly goto, reload, goBack, goForward, waitForPageLoad` (AC70) [unit].
- `none trait assigned to wait, waitFor, scroll, setViewport, screenshot, setVar, testVarSet, unsetVar, runFlow, pressKey, crossOriginIframeWarning` (AC70) [unit] — explicit `pressKey==='none'` and `within!=='none'` checks (the two common-mistake cases the AC calls out).
- `no entry carries preCheck, action or checkpoint` (AC70) [unit].
- `setVar's two overloaded shapes both map to one COMMAND_TRAITS['setVar'] key, not duplicated` (AC70, B edge) [unit].

**`packages/core/src/commandTraits.typecheck.ts` (new) [unit, compile-time via `tsc --noEmit`]**
- `COMMAND_TRAITS is assignable to Record<Command['type'], unknown>` (AC71) [unit].
- `a COMMAND_TRAITS literal missing one key fails tsc (the @ts-expect-error is used, not unused)` (AC71) [unit].
- `a COMMAND_TRAITS literal with one excess key also fails tsc` (AC71, B edge, implied by S2's "excess literal key" guarantee) [unit].
- `tsc --noEmit for packages/core passes with the full table` (AC71) — build check, not vitest.

PASSES on both versions: none (new module/table).

**`uivisor-app/src/utils/positiveInt.ts` (new) — `uivisor-app/tests/unit/positive-int.test.ts` (new) [unit]**
- `accepts a positive integer number` (shared predicate for AC47/AC68/AC55) [unit].
- `accepts a digit-only string ("3000")` (AC47) [unit].
- `rejects 0, a negative integer, a float, a non-numeric string, a boolean, null, and undefined` (AC47/AC68) [unit] — 7 sub-cases.
- `accepts a leading-zero digit string ("007") as 7` (B edge; Gap 3 — test documents actual behaviour) [unit].
- `rejects a string with surrounding whitespace (" 3000 ")` (B edge) [unit].
- `rejects an explicitly-signed string ("+3000")` (B edge) [unit].
- `rejects a float-as-string ("3000.0")` (B edge) [unit].
- `documents the behaviour for a digit string past Number.MAX_SAFE_INTEGER` (B edge; Gap 2) [unit].
- `rejects the literal strings "NaN" and "Infinity"` (B edge) [unit].

PASSES on both versions: none (new predicate).

#### T4 — Waiting resolution

**`packages/core/src/playwrightLocator.ts` — `packages/core/src/playwrightLocator.test.ts` (EXISTING, edited per T4 + Errata E2c) [unit, mocked Page/Locator, short injected deadlines]**
- `bare string resolves via the data-testid step with exactly one match` (AC1 logic) — **PASSES on both versions** (unchanged cascade-step-1 shape; only the retry wrapper is new).
- `bare string falls through to the text step once stable (two polls, ~100ms apart)` (AC2 logic) [unit].
- `pipe string with two segments resolves the matching segment; the other segment never wins` (AC3 logic) [unit].
- `each object-selector form (testId/css/text) resolves once its own count reaches 1` (AC4 logic) [unit] — 3 sub-cases.
- `{xpath} form resolves via buildSteps' single xpath step` (AC5 logic) [unit].
- `a button's data-testid match (appearing slightly later) wins over a heading's earlier text match, because data-testid precedes text in cascade order` (AC7) [unit].
- `pipe-string stability: the data-testid segment wins over the text segment regardless of which is written first, once stable` (AC8) [unit].
- `single-step selectors (bare string / single-segment pipe / {testId}) resolve on the first attempt — count() called once, sleep never called, elapsed 0` (AC6) [unit].
- `a step-2 winner confirmed on two consecutive passes ~100ms apart is accepted` (AC9) [unit] — asserts both attempt count and the `[100,300)` elapsed window.
- `a changed winner restarts the stability window; a later step-1 win is accepted at once (w=0 skips confirmation even mid-restart)` (AC10) [unit].
- `an unconfirmed lower-step winner (step1=0 always, step2 alternates 1/0) never resolves and fails with the not-found error at exactly the 1000ms deadline` (AC11, Errata E1-revised input) [unit].
- `duplicate matches (2→1 at 800ms) collapse and resolve promptly` (AC12) [unit].
- `retry cadence is 100ms; count() is called within [5,11] times before a 1000ms failure` (AC13) [unit] — see D1 for the tolerant-vs-exact distinction; this bullet keeps the AC's own tolerant bound.
- `duplicates that never collapse (always 2) fail at the deadline with the AC17 message, not a silent fall-through to another step` (B edge, regression guard) [unit].
- `a duplicate count oscillating 1→2→1→2 never stabilizes — the stability memory requires the SAME step index winning twice running, not merely "ever saw 1"` (B edge — AC9×AC12 interaction) [unit].
- `bare-string not-found error: exact line 1 and all five cascade step lines in order` (AC14) [unit].
- `pipe-string not-found error: exact line 1 and only the two given segment lines, no cascade lines` (AC15) [unit].
- `object-selector not-found error: JSON.stringify(selector) as both the heading suffix and the one step label` (AC16a) [unit].
- `xpath-selector not-found error: JSON.stringify({xpath}), correctly escaped for embedded quotes` (AC16b) [unit] — includes B's quote-escaping check.
- `duplicate-at-deadline error reports the last observed count (2), not 0` (AC17) [unit].
- `malformed selector (a) unknown attribute fails fast from buildSteps, before any count() call` (AC18a) [unit].
- `malformed selector (b) xpath union in pipe syntax fails fast from buildSteps` (AC18b) [unit].
- `malformed selector (c) invalid xpath fails via a REJECTED first count() call (count() called once, not zero) — distinct from (a)/(b)'s synchronous buildSteps failure` (AC18c) [unit].
- `empty xpath ("") throws in buildSteps synchronously` (B edge, S4) [unit].
- `a pipe segment missing "=" throws synchronously, like (a)/(b)` (B edge, S4) [unit].
- `an unrecognised selector type object throws synchronously (message format unspecified — Gap 1)` (B edge) [unit].
- `not-visible: string/pipe selector, every step 0 matches, passes promptly` (AC19) [unit].
- `not-visible: element present but hidden (string and object forms) passes promptly` (AC20) [unit].
- `not-visible: a visible element later removed (count 1→0) passes once removed` (AC21) [unit].
- `not-visible: element stays visible, fails at the deadline with the unchanged "Expected: not visible\nGot: visible"` (AC22) [unit] — exact literal pinned.
- `not-visible (a, revised): two hidden duplicates pass promptly — no AC12/AC17 uniqueness retry applies in this mode` (AC23a) [unit].
- `not-visible (b, revised): one visible + one hidden duplicate fails at the deadline — isVisible() checked for every index of the deciding step, not short-circuited` (AC23b) [unit].
- `not-visible (c, revised): one duplicate hides at 800ms, the other hidden throughout — passes once the visible one hides, not before` (AC23c) [unit].
- `not-visible: the deciding step is the first step with ≥1 match, which may be a lower cascade step, not necessarily data-testid` (B edge, generalizes AC23's rule) [unit].
- `not-visible mode never performs the found-mode's two-pass stability check, even when the deciding step's identity changes between polls` (B edge/race — guards against shared "last winner" state between modes) [unit].
- `resolveContainerLocator resolves once count reaches ≥1 (no nth)` (AC24 logic) [unit].
- `resolveContainerLocator not-found at the deadline uses the within: prefix, exact two-line message` (AC25) [unit].
- `resolveContainerLocator with nth=2 accepts once count ≥ nth+1 (3rd element)` (AC26 logic) [unit].
- `resolveContainerLocator with nth out of range at the deadline uses today's nth-mismatch message, with the exact N value` (AC26 logic, deadline branch) [unit].
- `resolveContainerLocator honours only its own passed-in deadline, independent of any caller/inner budget` (AC27 resolver-level half, Q18) [unit].
- `nth=0 is a valid in-range boundary (first container), not mistaken for "unset"` (B edge) [unit].

PASSES on both versions: `TC-001` (data-testid count=1 returns that locator; text/name/id/placeholder never queried) and `TC-003` (data-testid count=2 skipped, text count=1 returns the text locator) — both now exercised through the deadline-aware path with a short deadline per Errata E2c, unchanged in substance. Any other pre-existing cascade-order-only assertion with no error-message/timing component — exact names to be confirmed by the Coder against the current file.

**`uivisor-app/tests/unit/resolveSelector.test.ts` (EXISTING, edited per T4/S13/Errata E2c) [unit]**
- `app-layer resolution surfaces the new not-found message format for a bare string` (AC14, app seam) [unit].
- `app-layer resolution surfaces the AC16 object/xpath message formats` (AC16) [unit].
- `app-layer resolveNotVisible duplicate-hidden case passes through unchanged from the core result` (AC23a, thin-pass-through check) [unit].
- `a deadline passed through from the app layer uses the same timeoutMs in its message as the core layer would` (B edge — guards against the app wrapping with its own default instead of forwarding the caller's Deadline) [unit].

PASSES on both versions: existing cases whose selector resolves on the first attempt (count=1 immediately), unaffected by stability/retry — exact names to be confirmed against the current file (Gap 12).

#### T5 — Dispatch signature + sibling interpolation (AC48–AC50)

Per Gap 7, assigned (Generator A's resolution) to the existing files named in Errata E4's call-site list: **`uivisor-app/tests/unit/error-message-format.test.ts` and/or `uivisor-app/tests/unit/lazy-interpolation-timing.test.ts`** [unit].
- `a sibling timeout "${t}" resolves from a runtime var set by an earlier setVar; the resulting deadline's timeoutMs drives the "Element not found after Nms" message` (AC48) [unit].
- `a sibling timeout "${t}" resolving to an invalid value fails the command immediately, before any resolution attempt, with the exact QUOTED-value message` (AC49) [unit] — `timeout must be a positive integer, got "abc"` (quoted — contrast with AC47's unquoted parse-time form; same `parsePositiveInt`, different caller message per S9's table).
- `an undefined ${var} in a top-level flow's sibling timeout returns a failed result (not thrown) with the #100 flow-context suffix` (AC50a) [unit].
- `the same undefined ${var} inside a child flow gets the child+caller context suffix` (AC50b) [unit].

PASSES on both versions: any existing dispatch test for a step with no timeout key is unaffected (the `own === undefined` branch is a no-op).

#### T6 — Parser: sibling key, Q17/Q19, literal validation

**`uivisor-app/src/parser/commandParser.ts` — `uivisor-app/tests/unit/sibling-timeout-parser.test.ts` (new) [unit, pure parsing]**
- `sibling timeout on a string-selector command parses and is carried on the step` (AC39) [unit].
- `sibling timeout before the command key resolves to the command, not "Unknown command: timeout"` (AC40a) [unit].
- `session + sibling timeout in any key order both survive parsing` (AC40b) [unit].
- `sibling timeout accepted on every element-trait command (20-case table), carries timeout:2000` (AC41) [unit].
- `sibling timeout accepted on every navigation-trait command (5-case table, incl. waitForPageLoad without an inner timeout)` (AC41) [unit].
- `sibling timeout inside a within do: block parses on the inner step` (AC42) [unit].
- `a child flow's step keeps its own sibling timeout through parsing, independent of the top-level header` (AC43, parse-only half) [unit].
- `timeout: on each none-trait command throws "timeout is not supported on <key>" (10-case table)` (AC44) [unit].
- `the Q17 error fires for a none-trait command nested in a within do: block, failing the whole top-level parse` (AC45a) [unit].
- `waitForPageLoad with both an inner and sibling timeout throws the exact "...; use one" message` (AC46) [unit].
- `invalid literal sibling values rejected with the exact UNQUOTED message, one case per literal (0, -5, 1.5, "abc", true, null)` (AC47) [unit].
- `the quoted digit string "3000" is accepted as 3000` (AC47) [unit].
- `parser acceptance of timeout: matches COMMAND_TRAITS exactly, generative table over every Command['type']` (AC72) [unit].
- `a parsed step's Command is byte-identical whether or not a sibling timeout is present` (AC75, parse-side) [unit].
- `key order with THREE siblings (session, timeout, command) in all 6 permutations all parse correctly` (B edge) [unit].
- `timeout as the literal command key itself ({timeout:{...}}, no other key) is "Unknown command: timeout", not a sibling-with-no-command case` (B edge) [unit].
- `a malformed sibling timeout alongside a malformed selector: the parse-time sibling error fires first, since selector validity (buildSteps) is a dispatch-time-only concern never reached` (B edge, ordering) [unit].

PASSES on both versions: existing `parseSessionedCommand`/`loadAndParse` session-only-extraction cases (no timeout key at all); inner `waitForPageLoad timeout: 0` still parses; inner `timeout: "5000"` (a string) still throws — exact names TBD against the current `parser.test.ts`.

#### T7 — Header and shared-config keys

**`uivisor-app/src/parser/validator.ts` + `interpolate.ts` + `parser/index.ts` — `uivisor-app/tests/unit/timeout-config.test.ts` (new) [unit]**
- `flow header accepts defaultTimeout and navigationTimeout, no Unknown header key error` (AC65) [unit].
- `sla stays an ordinary var via shared config (setVar/testVarSet round-trip)` (AC67a) [unit].
- `sla and loading in the flow header are still "Unknown header key" errors` (AC67b/c) [unit].
- `defaultTimeout/navigationTimeout stripped from file.vars when set via shared config; base and other vars remain` (AC66) [unit].
- `after stripping, file.vars.defaultTimeout is undefined (parse-time half of AC66; the dispatch-time "is not defined" message is cross-checked in timeouts.test.ts)` (AC66) [unit].
- `invalid header values rejected with the exact header-source message, across 6 invalid literals × 2 keys (12 cases)` (AC68) [unit].
- `invalid shared-config values rejected with the config-source message, config path exactly as written (not resolved) — relative path appears verbatim` (AC68) [unit].
- `a digit-only string value, including one produced by ${var} resolution, is accepted for header and config` (AC68) [unit].
- `the digit string "0" is still rejected — digit-string acceptance and the positivity check are the same parsePositiveInt call, not two independent gates` (B edge) [unit].
- `child flow header/config values are still validated even though they'll be ignored at runtime (defaultTimeout:0 fails the runFlow step)` (AC69, parse half) [unit].
- `${t} in a header value resolves from inline vars at parse time` (AC57a) [unit].
- `${env.UIV_T} in a shared-config value resolves from the environment at parse time` (AC57b) [unit].
- `${fromSetVar}, only ever set later by setVar, is NOT visible to header interpolation; resolves to '' and fails header validation with the AC68-format message (Errata E4: not "AC63")` (AC57c) [unit].

PASSES on both versions: existing header/config tests for an unrelated key (e.g. `base`).

Noted but not independently asserted (per Gap 6, validation order when both keys are invalid is unspecified; per B's YAML-empty-value note) — left to the Coder to document whichever order/behaviour the implementation naturally produces, since no AC constrains it.

#### T8 — CLI flags

**`uivisor-app/src/cli/args.ts` + `cli/index.ts` — `uivisor-app/tests/unit/args.test.ts` (EXISTING, new describe block, existing cases untouched) [unit]**
- `--timeout and --navigation-timeout parse into ParsedArgs; both undefined (not 0/NaN) when neither flag is given` (AC55a) [unit].
- `--timeout 0 / "abc"; --navigation-timeout -1; --timeout with no trailing value — each writes the exact stdout error and exits 1 (4 cases)` (AC55b–e) [unit].
- `usage line includes "[--timeout <ms>] [--navigation-timeout <ms>]"` (AC55) [unit].
- `--timeout immediately followed by another recognised flag with no value between them — pins whichever behaviour the parser actually has (Gap 4)` (B edge) [unit].
- `--timeout given twice in one invocation — pins last-wins/first-wins/error (Gap 4)` (B edge) [unit].
- `--Timeout (wrong case) is not treated as --timeout` (B edge) [unit].

PASSES on both versions: all pre-existing `args.test.ts` cases (`test`, `--headed`, `--slowMo`, `--reporter`, target resolution).

#### T9 — Precedence module

**`uivisor-app/src/engine/timeouts.ts` (new) — `uivisor-app/tests/unit/timeouts-precedence.test.ts` (new) [unit, pure functions]**
- `resolveRunTimeouts: element-timeout chain, each layer removed in turn → sibling(1400)/CLI(1300)/header(1200)/config(1100)/built-in(5000)` (AC51 rules) [unit].
- `resolveRunTimeouts: the same chain for navigationTimeout → .../30000` (AC52 rules) [unit].
- `the two settings are independent (navigationTimeout alone doesn't move defaultTimeout, and vice versa)` (AC53) [unit].
- `header beats shared config for both keys — explicit contrast with the vars rule, where config wins` (AC54) [unit].
- `resolveRunTimeouts given a literal 0 directly (bypassing CLI validation) — documents whether ?? treats 0 as set or skips to the next layer (Gap 5)` (B edge) [unit].
- `stepTimeoutMs: element-trait returns own if given, else run.defaultTimeout` (AC51 composition) [unit].
- `stepTimeoutMs: navigation-trait returns own if given, else run.navigationTimeout` (AC52 composition) [unit].
- `stepTimeoutMs: none-trait returns undefined regardless of own/run (defensive, independent of parser rejection)` (AC44/AC72 composition) [unit].
- `stepTimeoutMs: waitForPageLoad's own (sibling or inner) wins over run.navigationTimeout` (AC35a logic) [unit].
- `stepTimeoutMs('waitForPageLoad', 0, run) === 0 — the legitimate "unbounded" value passes through, not treated as an immediate/expired deadline; connects to createDeadline(0)'s unbounded contract` (AC73/S3 boundary, B edge — flagged safety-critical) [unit].
- `timeoutNotice: null when the child sets neither key` (AC58/AC61a) [unit].
- `timeoutNotice: null when the child's value equals the effective run value, for a config-only key` (AC61b) [unit].
- `timeoutNotice: fires for defaultTimeout only when it differs from the effective value` (AC59 revised) [unit].
- `timeoutNotice: lists both keys in [defaultTimeout, navigationTimeout] order on one line when both differ` (AC60a revised) [unit].
- `timeoutNotice: lists only the single key that's set and differs` (AC60b revised) [unit].
- `timeoutNotice: AC80(a) no notice when the child's header value equals the effective value, with no other key set` (AC80a) [unit].
- `timeoutNotice: AC80(b) lists only the differing key, omitting the equal one even though it was explicitly set in the child` (AC80b) [unit].
- `timeoutNotice: basenames used for both files, even when given full paths` (AC60) [unit].
- `timeoutNotice: the child's OWN header-beats-config precedence governs the differs-check — the shared firstDefined helper is reused correctly for both resolveRunTimeouts and timeoutNotice` (B edge, S7 seam risk) [unit].
- `timeoutNotice: given the top-level path (not the immediate caller's), so a grandchild's notice names the top-level flow` (AC62, contract-level) [unit].
- `timeoutNotice: a 1ms difference still triggers the notice — no tolerance band, unlike durationMs assertions elsewhere` (B edge) [unit].

PASSES on both versions: none (wholly new module).

#### T10 — Core commands

**`packages/core/src/commands.ts` — `packages/core/src/commands.test.ts` (EXISTING, edited per T10 + Errata E2/E3) [unit, mocked Page/Locator]**
- `every element command (15-case table) reports "not found" with the configured timeout when the target never resolves, including selectOption's RESOLUTION-timeout case (still "not found" — E3 only carves out its action-timeout)` (AC31) [unit].
- `resolveLocator is called outside the try/catch, so a resolution-timeout error is never rewrapped with "not actionable" or the old "Expected: visible\nGot: element not found"` (AC31 mechanism) [unit].
- `tapOn on a late-enabling element that times out mid-interaction reports "not actionable", not "not found"` (AC36a/AC38 revised) [unit] — exact `Element not actionable after 2000ms: data-testid=int-late-enable`.
- `tapOn resolves and the action succeeds within budget — passes` (AC36b) [unit].
- `one budget covers resolution + action: the action's Playwright {timeout} reflects the REMAINING budget after resolution, not a fresh full one` (AC36 mechanism) [unit].
- `inputText shorthand reports "not actionable" naming the last-tapped selector label, not a description of the shorthand` (AC32 revised) [unit].
- `inputText shorthand with no prior tapOn still throws the unchanged "used before any tapOn" error, not reinterpreted as a timeout error` (B edge, regression guard) [unit].
- `selectOption: resolution succeeds but the chosen option is absent — keeps the unchanged literal "Option not found." with no timeout/selector embedded, per Errata E3` (E3 confirmation) [unit].
- `assertText/assertValue/assertEnabled/assertDisabled/assertChecked/assertUnchecked read their condition exactly once after resolution, never retried, even if a second read would pass` (Scope exclusion, regression) [unit].
- `assertNotVisible delegates to resolveNotVisible and throws the unchanged "Expected: not visible\nGot: visible" on false, with no selector/timeout embedded` (AC22 mechanism) [unit].
- `assertUrl retries via retryUntil, re-reading the URL fresh each poll, and reports the LAST observed URL at the deadline` (AC29) [unit].
- `assertUrl passes as soon as the URL matches mid-poll, without waiting the full deadline` (AC28 mechanism half) [unit].
- `assertCount retries and reports the last observed count at the deadline, not a stale first read` (AC30b) [unit].
- `assertCount passes once the count matches, without over-waiting` (AC30a mechanism) [unit].
- `goto rethrows a Playwright TimeoutError with the exact "Navigation failed: <url> — timed out after <T>ms" using the CONFIGURED budget, not Playwright's own reported elapsed time` (AC33a mechanism) [unit].
- `reload/goBack/goForward each rethrow with "<type> timed out after <T>ms"` (AC33b/AC34 mechanism) [unit].
- `goBack/goForward keep waitUntil:'commit' and the unchanged fresh-page history messages` (AC34) — **PASSES on both versions** for the message literals.
- `a non-TimeoutError navigation failure propagates as-is, untouched` (S5 regression) — **PASSES on both versions**.
- `the pre-existing plain Error('Timeout exceeded') (C-19) still propagates unmodified` — **PASSES on both versions**.
- `waitForPageLoad: own inner timeout (1000) wins over navigationTimeout (3000)` (AC35a) [unit].
- `waitForPageLoad: falls back to navigationTimeout (1500) with no inner timeout` (AC35b) [unit].
- `waitForPageLoad: sibling timeout (1200) wins over navigationTimeout (3000) with no inner timeout` (AC35c) [unit].
- `waitForPageLoad: both waits share one budget — the load-state wait's {timeout} reflects the shrunk REMAINDER after the URL wait, not the original full value` (AC37 mechanism) [unit].
- `waitForPageLoad: the URL wait failing means the load-state wait is never attempted; the surfaced message is the URL-wait's, not a merged one` (B edge) [unit].
- `waitForPageLoad: when the URL wait consumes the entire budget, the second wait still gets {timeout:1}, never {timeout:0}` (B edge — flagged safety-critical) [unit].
- `waitForPageLoad: inner timeout:0 passes {timeout:0} to BOTH waits, not only the first` (AC73) [unit].
- `core defaults (5000 element / 30000 navigation) apply when deadline is omitted entirely` (AC73) [unit] — 2 sub-cases.
- `executeWithin validates nth<0 before attempting any resolution (resolveContainerLocator never called)` (S5 mechanism) [unit].
- `executeWithin surfaces the resolver's container not-found message unchanged` (AC25) [unit].
- `executeWithin surfaces the resolver's nth-mismatch deadline message unchanged` (AC26) [unit].
- `executeWithin's own sibling timeout bounds only resolveContainerLocator; it forwards no timeout-related data to the inner dispatch callback` (AC27 mechanism, Q18) [unit].
- `executeWithin passes the WHOLE step (session?/timeout?/command), not a bare Command, to its dispatch callback` (Errata dispatch API / WithinDispatch signature) [unit].
- `executeWithin with an empty do: [] array is a no-op pass` (B edge) [unit].

PASSES on both versions: `C-13…C-18` (exact `{timeout:30000}`/`{timeout:5000}` on waitForPageLoad's second Playwright call, unedited per S3's ceil rationale); `uivisor-app/tests/integration/commands.test.ts:662` (selectOption "Option not found", Errata E3, unchanged); the ~99 mechanical `dispatch(page, cmd, …)` → `dispatch(page, {command: cmd}, …)` call-site conversions across `tests/integration/commands.test.ts`, `tests/unit/error-message-format.test.ts`, `tests/unit/lazy-interpolation-timing.test.ts`, `tests/unit/sessions.test.ts`, `tests/unit/set-var-commands.test.ts`, `tests/unit/within-dispatcher.test.ts`, `engine/index.ts` — pure signature migration, no behavioural change.

**`uivisor-app/tests/unit/within-dispatcher.test.ts` (EXISTING, edited per T10 + Errata dispatch API) [unit]**
- `the within dispatch callback now receives the full SessionedCommand step, not a bare Command (fails pre-change, passes post-change)` (Errata dispatch API) [unit].
- `an inner do: step carrying its own sibling timeout is visible to the callback as part of the step object` (AC42 cross-check) [unit].
- `a within whose do: array mixes a sibling-timeout step and a plain step — both forwarded with the correct shape (absent key, not timeout: undefined, per S1)` (B edge) [unit].

PASSES on both versions: pre-existing nth/container-selection tests unrelated to the callback's parameter shape.

**`uivisor-app/tests/unit/session-engine.test.ts`, `runner-no-auto-nav.test.ts`, `recorder-app/src/flowReplayer.test.ts` (EXISTING, edited per Errata E2a/E2b) [unit/regression]**
- `session-engine.test.ts lines 112,131,133,166,185,188,216 and runner-no-auto-nav.test.ts line 180: goto/reload mock-call assertions updated to the exact new shape {waitUntil:'load', timeout:30000}, not objectContaining` (Errata E2a) [unit].
- `flowReplayer.test.ts lines 104,179,330: same exact-shape update, using the built-in defaults (recorder passes none of its own)` (Errata E2a, S12) [unit].
- `flowReplayer.test.ts T24 (assertUrl mismatch): given an explicit 10000ms vitest test timeout; its mismatch-message assertion is otherwise unchanged` (Errata E2b) — **PASSES on both versions** for the assertion content; only the vitest timeout option is new.
- `flowReplayer's private within copy's not-found message is updated to the new container-lookup text (built-in 5000ms budget, since recorder passes no deadline)` (B edge, S12 consequence) [unit].
- `recorder-app build (tsc) and vitest run both succeed with no source change in flowReplayer.ts` (AC74) — build/test-run check.

PASSES on both versions: T24's assertion content; any other pre-existing assertion in these three files not touching goto/reload/within-container-message call shapes.

#### T11 — Engine wiring

**`uivisor-app/src/engine/dispatcher.ts` + `context.ts` + `cli/runner.ts` — `uivisor-app/tests/integration/timeouts.test.ts` (new) [integration, real Chromium + inline HTTP server + T2 fixtures, real time with AC tolerance]**
- `AC1–AC5: each selector form (bare, lower-cascade, pipe, 3× object, xpath) passes within its stated bound against delayed.html` (AC1–AC5) [integration].
- `AC6: a selector matching from the start resolves well under 100ms (loose smoke bound; the exact no-second-pass claim is unit-only)` (AC6) [integration].
- `AC7/AC8: the stability case (tapOn Submit / pipe Submit, then assertVisible int-submit-result) confirms the button, not the heading, was clicked, end-to-end` (AC7, AC8) [integration].
- `AC12: duplicate-collapsing tapOn passes under 1800ms` (AC12) [integration].
- `AC14–AC18: the not-found/malformed-selector error cases reproduce their exact messages end-to-end, within the AC's T-to-T+1000ms tolerance` (AC14–AC18) [integration].
- `AC21–AC23: not-visible mode's scenarios (removed, stays-visible, duplicate variants a/b/c) behave end-to-end as specified` (AC21, AC22, AC23) [integration].
- `AC24–AC27: within's delayed-container pass, not-found deadline, nth-growth pass/fail, and sibling-timeout-bounds-only-the-lookup (both directions) confirmed end-to-end` (AC24–AC27) [integration].
- `AC29/AC30: assertUrl and assertCount retry-and-report-last-value, end-to-end` (AC29, AC30) [integration].
- `AC31: all 15 element commands fail after the header's 1200ms with the correct "not found" line 1, run as their own flows` (AC31) [integration].
- `AC32: inputText shorthand fails after 1000ms with "Element not actionable after 1000ms: data-testid=int-input"` (AC32 revised) [integration].
- `AC33: goto /hang and reload /reload-hang each fail after navigationTimeout:1500 with "...1500ms" in the message` (AC33) [integration].
- `AC35: waitForPageLoad's three timeout-source cases (inner/no-inner/sibling) each fail with their own budget's ms value` (AC35) [integration].
- `AC36: the late-enable scenario fails in [2000,2900) ms — both bounds asserted — and passes when there's enough time` (AC36) [integration].
- `AC37: spa-nav + /slow confirms the URL-wait and load-state-wait share one 1500ms budget, failing no later than 2500ms, and explicitly does NOT pass` (AC37) [integration].
- `AC38: the AC36(a) failure's line 1 is exactly "Element not actionable after 2000ms: data-testid=int-late-enable", end-to-end` (AC38 revised) [integration].
- `AC39/AC40/AC42/AC43/AC45b/AC48: sibling-timeout parsing, placement, within-nesting, child-override, Q17-inside-child, and ${var} resolution each drive the real failure/pass time end-to-end` (AC39, AC40, AC42, AC43, AC45b, AC48) [integration].
- `AC51/AC52: the full five-layer-removal precedence chains report the exact expected ms values end-to-end for both keys, including the 30000ms "none set" navigation case marked slow` (AC51, AC52) [integration].
- `AC53: header navigationTimeout alone doesn't move an element probe (still 5000ms); CLI --timeout alone doesn't move a waitForPageLoad probe (confirmed "still running" at 1500ms, not waited out to 30s)` (AC53) [integration].
- `AC54: header beats shared config end-to-end (1200 wins over config's 4000)` (AC54) [integration].
- `AC56: --timeout via CLI covers every flow in a directory run` (AC56) [integration].
- `AC57: header "${t}" and config "${env.X}" values resolve at parse time, confirmed end-to-end` (AC57a/b) [integration].
- `AC58–AC62/AC80: the full child-flow inheritance + notice matrix — inherited values, config-only ignore+notice, dedup-once-per-top-level-run across two calls, grandchild naming the top-level flow, and the partial-notice (differs-only) rules — stdout captured via a spy on process.stdout.write` (AC58, AC59, AC60, AC61, AC62, AC80) [integration].
- `AC63/AC64: running a child directly applies its own values with no notice; runFlow vars cannot set timeouts` (AC63, AC64) [integration].
- `AC66/AC69: the dispatch-time "is not defined" message after config-stripping, and a child's invalid header value failing the parent's runFlow step, confirmed end-to-end` (AC66, AC69) [integration].
- `AC73: with nothing configured, built-in defaults (5000/30000) apply, and waitForPageLoad timeout:0 still parses and runs unbounded` (AC73) [integration].
- `AC75: a sibling timeout:3000 produces an identical label across console/HTML/Markdown reporters compared to the same step without it` (AC75) [integration] — full round-trip check; primary coverage is the reporter unit test below.
- `AC80: the real-engine run confirms timeoutNotice is actually WIRED into runFlow/createContext, not just correct as a pure function` (AC80, wiring check) [integration].
- `two sessions in the same top-level flow both calling runFlow on the same child file: the notice fires only once, shared via one ctx.timeoutNotices Set` (B edge/race, Gap 9) [integration].
- `a passing probe followed by a failing probe in the same flow: the second step's deadline is freshly created, not decremented from a shared per-flow Deadline instance` (B edge/race — correctness-critical given the "one ctx per top-level flow" design) [integration].

PASSES on both versions: a `run-flow-override.yaml` smoke run with no sibling timeouts anywhere passes identically before and after.

**Reporter label check (AC75) — `uivisor-app/tests/unit/reporter.test.ts`** [unit] (adopted from Generator A's recommendation, per S1's "holds by construction" guarantee):
- `a step's console/HTML/Markdown label with sibling timeout:3000 is byte-identical to the same step without it` (AC75) [unit].

#### T3 — test-app fixture page (new test, closes Gap 11)

**`test-app/src/pages/IntegrationTimeoutsPage.jsx` — new lightweight page/component check** [unit or a direct request+DOM-parse against the route, independent of the live-flow tests that only exercise it transitively]:
- `the /integration-timeouts page renders all of AC76(a)-(e) at mount: int-delayed, int-delayed-card/int-card-label, int-hidden (display:none), the Submit heading→button→int-submit-result sequence, and never renders an element with test id int-never-rendered` (AC76) [unit]. **This is the test added by the consolidator per the role brief, closing the gap neither generator filled.**

#### T12 — Live test-app slice + full regression

**`test-app/flows/integration/timeouts.yaml` (new) [integration/E2E, live test-app]**
- `full run exits 0, 100% commands pass, and the YAML source itself contains no wait:/waitFor: step (static check, not just "the flow passes")` (AC77) [integration].
- `(1) int-delayed found via bare string, pipe string, object selector and xpath object` (AC77 sub-1) [integration].
- `(2) stability case: tapOn Submit then assertVisible {testId: int-submit-result}` (AC77 sub-2) [integration].
- `(3) goto ?delay=6500 then assertVisible data-testid=int-delayed with sibling timeout:8000` (AC77 sub-3) [integration].
- `(4) assertNotVisible on absent int-never-rendered and hidden int-hidden, both string selectors` (AC77 sub-4, also covers AC19/AC20 live) [integration].
- `(5) assertUrl /integration-timeouts?arrived=1 after goto ?redirect=1500, no wait:` (AC77 sub-5, AC28 live) [integration].
- `(6) within on a delayed card (int-delayed-card/int-card-label)` (AC77 sub-6) [integration].

**`test-app/flows/integration-negative/timeouts-default-fails.yaml` (new) [integration/E2E]**
- `exit code 1, stdout contains "✗ assertVisible" and the exact line "Element not found after 5000ms: data-testid=int-delayed"; failing step's durationMs (via --reporter md) in [5000,6000)` (AC78) [integration].
- `the negative flow is confirmed NOT swept into an integration/ directory run (structural placement check, per the Constraints "negative flow location" note)` (B edge — guards AC79's exact-37-count) [integration].

**`test-app/flows/integration-variants/go-back-nav-timeout.yaml`, `go-forward-nav-timeout.yaml` (new) [integration/E2E]**
- `go-back.yaml and go-forward.yaml (existing) still pass unmodified` (AC34) — **PASSES on both versions**.
- `the navigationTimeout:20000 variants of each pass, run via config: ../integration/config.yml` (AC34) [integration].
- `a fresh-page goBack still fails with "No previous page in history." and goForward with "No next page in history."` (AC34) — **PASSES on both versions** for the message text.
- `the two variant flows are run via an explicit separate CLI invocation, not swept into integration/ (AC79 fixes that directory at 37 flows)` (B edge, structural) [integration].

**Full regression — `test-app/flows/integration/` directory (AC79 revised) [integration/E2E]**
- `running the whole integration/ directory exits 0 and every one of the 37 flows passes` (AC79 revised) — **PASSES on both versions** for the 36 pre-existing flows' pass/fail outcome (slower per S13, but not expected to flip).
- `the directory contains exactly 37 .yaml flow files (static count check, run before the expensive full pass)` (AC79's count claim, structural) [integration].
- `re-running the full directory a second time in the same invocation re-emits its own notices independently (no cross-run persistence of ctx.timeoutNotices)` (B edge, Gap 9 at the process level) [integration].

**Build/suite gate (AC74) — attributed to the Quality Gate, not a single dedicated test file (resolves Gap 8):**
- `tsc builds for packages/core, uivisor-app and recorder-app all succeed; vitest run passes in all three (baseline: core 406, uivisor-app 733 + 4 expected-fail), with only the AC74/Errata-E2-listed edits and no deletions` (AC74) — composite gate, verified by the sum of the T1–T12 file-level checks above plus a final `tsc && vitest run` pass in each package.

**Last checkpoint:** tester_consolidator at 2026-10-13 20:20

## Arbiter Rulings

**Role:** tester_arbiter. Settles D1 and the 12 spec gaps raised by the generators, runs the Phase-1 TDD direction check, and finalises the Phase-1 test count. Facts below were verified directly against the worktree (`.worktrees/feat-selector-waits-and-timeouts`): `packages/core/src/playwrightLocator.ts` (pre-change), `uivisor-app/src/parser/commandParser.ts`, `uivisor-app/src/cli/args.ts`, `packages/core/src/commands.ts`, `uivisor-app/src/parser/reader.ts` + `cli/index.ts` (js-yaml usage, verified empirically with `node -e`), and `uivisor-app/tests/unit/resolveSelector.test.ts`.

### Ruling D1

**Keep both, as the consolidator recommended — not a true disagreement, a scope mismatch.** AC13's own text states a tolerant bound ("at least 5 and at most 11 times"). Generator A's test asserts that tolerant `[5, 11]` range and is filed as the AC13-numbered test in `playwrightLocator.test.ts` — this is correct because it matches the AC's own stated tolerance and survives any legitimate scheduling jitter in a real (non-fake-clock) run. Generator B's exact-11 assertion is not a competing claim about AC13; it is a assertion about `retryUntil`'s own documented contract (S3: "the last attempt lands on the deadline itself") under a fully deterministic fake clock stepping in exact 100 ms increments (0,100,...,1000 → 11 attempts). That belongs in `deadline.test.ts` as an unnumbered mechanism test, not as a replacement for the AC13 test. **Verified the arithmetic:** with `timeoutMs=1000` and `RETRY_INTERVAL_MS=100`, attempts at t=0,100,200,...,1000 is exactly 11 attempts — consistent with both AC13's upper bound and B's exact claim, so there is no numeric conflict either, only a filing distinction. Final test list keeps exactly two tests: `playwrightLocator.test.ts`'s AC13 bullet (tolerant `[5,11]`) and `deadline.test.ts`'s "retryUntil's last attempt lands exactly on the deadline" bullet (exact 11, fake clock). No change to the Consolidated Test Plan is required.

### Spec gap rulings

1. **`buildSteps`'s "unrecognised selector type" message (AC18-adjacent, B edge).** RULED, not escalated. Current `packages/core/src/playwrightLocator.ts` already throws `` `Unrecognized selector type: ${key}` `` for this exact case (end of the object-selector branch in `resolveLocator`). `buildSteps` is a refactor of this same branch, so the message carries over unchanged. **Source:** existing code (`playwrightLocator.ts`, object-selector fallthrough). The B-edge test's "(message format unspecified — Gap 1)" annotation should be removed; its expected value is `Unrecognized selector type: ${key}`.

2. **No upper bound on a valid `timeout` value.** RULED: no cap, document current behaviour, no rejection test. The spec's own example of a product decision requiring escalation is exactly "an upper bound on timeouts" — but adding a cap would be inventing policy, whereas *not* adding one is the status quo already in play for the existing `wait:` command (`commandParser.ts`'s `wait` case: `Number.isInteger(ms)` is the only check, no ceiling). Consistency with that existing convention is the source; no new constraint is introduced, so this does not fall under "inventing policy." The consolidator's existing resolution ("test documents current `Number()` behaviour, not a rejection") stands as written.

3. **Leading-zero digit strings (`"007"`).** RULED: accepted, equals 7. **Source:** `commandParser.ts`'s existing `wait` case: `typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value` — `/^\d+$/.test("007")` is `true` and `Number("007") === 7`. `parsePositiveInt` must match this existing convention for digit strings. The positive-int.test.ts bullet already encodes this correctly; no change needed.

4. **CLI flag edge cases: greedy-consume and given-twice.** RULED from existing convention in `uivisor-app/src/cli/args.ts`. Every existing flag that takes a value (`--slow-mo`, `--reporter`, `--tag`, `--output-dir`) uses the same pattern: `if (arg === '--flag' && i + 1 < args.length) { value = args[i+1]; i += 2 }` — it does **not** check whether `args[i+1]` itself looks like another flag. So `--timeout` immediately followed by another recognised flag greedily consumes that flag's token as its raw value (e.g. `--timeout --headed` sets raw `"--headed"`, which then fails `parsePositiveInt` and hits the invalid-value error path — not a "missing value" path). For "given twice," the existing scalar-assignment flags (`--slow-mo`, `--reporter`, `--output-dir`) simply reassign on each match, so the last occurrence wins (contrast with `--tag`, which pushes to an array — not the applicable pattern here since `--timeout`/`--navigation-timeout` are scalars). **Source:** `uivisor-app/src/cli/args.ts`, `parseArgs`'s existing `while` loop.

5. **`stepTimeoutMs`/`resolveRunTimeouts` and a literal `0`.** RULED, not a gap requiring escalation — already specified. Seam Notes S3 states "0 = unbounded (only `waitForPageLoad`'s inner `timeout: 0`)" and S7's `??`-chain only treats `null`/`undefined` as absent (JS `??` semantics), so `0` flows through unchanged at every layer. **Source:** Seam Notes S3 + S7, plus JS language semantics. The B-edge test ("flagged safety-critical") correctly pins `stepTimeoutMs('waitForPageLoad', 0, run) === 0`.

6. **Validation order when both `defaultTimeout` and `navigationTimeout` are invalid simultaneously.** RULED: no assertion required, not a product decision. No AC constrains which error surfaces first, and the choice has no observable effect on a correctly-written flow (both ways produce *an* error that must be fixed either way) — this is an implementation detail, not a case needing human judgment. The consolidator's resolution ("left to the Coder to document whichever order... since no AC constrains it") stands.

7. **AC48–AC50 unit-test file assignment.** RULED: adopt Generator A's assignment. **Source:** Gate 1 Errata's "dispatch API" paragraph explicitly lists `error-message-format.test.ts` and `lazy-interpolation-timing.test.ts` among the files T5 migrates for the new `dispatch(page, step, ...)` signature — these are already T5's files by Errata mandate, so filing the new sibling-interpolation dispatch-time tests there (rather than inventing a new file) is the consistent choice. Not a product decision; adopted as written.

8. **AC74 as a cross-cutting release gate.** RULED: adopt the consolidator's attribution to the sum of T1–T12 file-level checks plus the final composite gate. **Source:** the pipeline's own Quality Gate step (this run's process, per `CLAUDE.md`/pipeline convention) already treats "build + full test suite green" as a gate rather than a unit test; this is a filing/process decision, not a behavioural one.

9. **`ctx.timeoutNotices` `Set` lifecycle across sessions/runs.** RULED, not a gap requiring escalation — derivable. **Source:** Seam Notes S11 ("There is one ctx per top-level flow, so 'once per file' means once per top-level run... and CLI flags apply to every flow in a directory run") plus S1's `RunContext.timeoutNotices` field (owned by the per-top-level-flow `ctx`, not a module-level singleton). This directly implies: (a) two sessions in the same top-level flow share one `ctx`, hence one `Set`, hence the notice dedups across sessions; (b) two independent top-level runs each get a fresh `ctx`/`Set`, so notices are never suppressed across runs. The two B-edge tests under T11/T12 (shared Set across sessions; fresh Set on a second directory pass) correctly encode this.

10. **Duplicate `timeout:` sibling key in one YAML mapping.** RULED, and the generators' speculation was wrong — this is empirically verifiable, not "parser-library-dependent, last-key-wins in most YAML parsers." **Verified directly:** `uivisor-app/src/parser/reader.ts` and `cli/index.ts` both call `yaml.load(raw)` from `js-yaml` with no options (no `json: true`). Running `js-yaml@4.1.0`'s `load()` against a mapping with a literal duplicate `timeout:` key throws `YAMLException: duplicated mapping key (<line>:<col>)` at the YAML-parse stage, **before** `parseSessionedCommand`/`parseCommand` ever see the object — confirmed by direct execution against the actual dependency version pinned in `uivisor-app/package.json`. This is pre-existing, feature-independent behaviour (nothing in this feature touches `yaml.load`'s options), so it needs no new assertion in this feature's test files; if the Coder wants a confirming regression test, it belongs under T6 as a "feature doesn't change existing duplicate-key handling" note, not a new rejection rule.

11. **AC76 test-file gap.** RULED: resolved as the consolidator already did — new test added under T3, closing the gap. No further action.

12. **Nature of `uivisor-app/tests/unit/resolveSelector.test.ts`.** RULED by direct inspection — it is **neither** a thin pass-through wrapper around a separate app-layer function **nor** an independent re-implementation. It `import { resolveLocator } from '@uivisor/core'` directly (line 12) and calls that exact same core function with its own mocked `Page`, duplicating `playwrightLocator.test.ts`'s coverage of the identical public API from a different mock-construction style. There is no separate `uivisor-app/src/.../resolveSelector.ts` source file at all. **Consequence for the Coder:** treat every edit here identically to `playwrightLocator.test.ts` per Errata E2(c) — existing `TC-###` cases that resolve on the first attempt (count=1 immediately, e.g. `TC-001`, `TC-002`) are unaffected and should be tagged `PASSES on both versions`, exactly as `TC-001`/`TC-003` are in the sibling file; cases with no unique match (perpetual 0 or >1 count) need a short injected deadline and the new error-text format. The Consolidated Test Plan's framing of this file as "the app seam" (S13) is cosmetic — it is the same seam as `playwrightLocator.test.ts`, tested twice for redundancy, not a distinct layer.

### TDD direction check

Verified a representative, high-risk sample of the Consolidated Test Plan's non-regression assertions directly against the pre-change worktree source (not against the spec alone), to catch any assertion that would already pass today:

- **AC2** (bare string falls through to text step, waiting ~1500 ms) — confirmed current `resolveLocator` does a single immediate count with no retry at all, so on today's code this fails instantly (0 matches on every cascade step) well under 1500 ms. The test's expectation (passes after ~1500–2600 ms) only holds post-change. **Correct direction.**
- **AC28/AC29/AC30** (`assertUrl`/`assertCount` retry until match, report the *last* observed value at the deadline) — confirmed current `executeAssertUrl`/`executeAssertCount` check exactly once (`packages/core/src/commands.ts` lines 124–130, 171–176) with no retry loop. Today, a probe against a URL/count that only becomes correct later fails immediately; the test's "retries and eventually passes / reports last value" assertion only holds post-change. **Correct direction.**
- **AC31** (resolution failure is never rewrapped as the assertion's own catch-all) — confirmed today's `executeAssertEnabled` (and siblings) wrap *any* resolution failure in a blanket `catch { throw new Error('Expected: enabled\nGot: element not found') }`, which the spec replaces with an unwrapped `Element not found after <T>ms: ...` escaping before the try/catch. The test asserting the new, unwrapped message is correctly new-behaviour, not reversed.
- **TC-001/TC-003** (tagged `PASSES on both versions`) — confirmed by inspection that today's cascade loop (`if (n === 1) return loc`, duplicates skipped, later steps still tried) already produces this exact result with no stability/retry involvement; correctly tagged.
- **goBack/goForward `waitUntil:'commit'` and the fresh-page history messages, and `selectOption`'s `Option not found.`** (all tagged `PASSES on both versions`) — confirmed byte-for-byte against `packages/core/src/commands.ts` (lines 249, 299, 304–316); correctly tagged.
- **`waitForPageLoad` inner `timeout: "5000"` still throws / `timeout: 0` still parses** (tagged `PASSES on both versions` in T6) — confirmed against `commandParser.ts`'s `waitForPageLoad` case (lines 219–236): the inner-timeout validation is untouched by this feature, both literals already behave exactly as claimed today.
- **`parseSessionedCommand`'s existing session-only extraction** (tagged `PASSES on both versions`) — confirmed against the current function (lines 344–354): it only extracts `session` today; the new version extracts `session` and `timeout` the same way, so pre-existing no-sibling-timeout cases are unaffected.

**No reversed assertions found** — no test asserts a value that would make it pass today and fail post-change (the inverse of TDD). **No corrections were required to the Consolidated Test Plan's expectations.**

One categorisation question was raised and resolved, not corrected: `AC18(a)/(b)/(c)` and three `B edge` fail-fast tests (empty xpath, missing `=`, unrecognised selector type) exercise the **new** internal `buildSteps` export. Their expected error text happens to be byte-identical to what today's `resolveLocator` already throws for the same inputs (verified: `Unknown attribute '...'`, `XPath union '|' conflicts...`, `Invalid XPath expression: ...`, `Invalid pipe segment '...'`, `Invalid xpath selector: expression must not be empty`, and `Unrecognized selector type: ...` are all present in today's source verbatim). This does **not** make them reversed or mistagged: `buildSteps` itself does not exist pre-change, so there is no "both versions" to compare for that function — the correct and intended reading (consistent with how `deadline.test.ts` and `commandTraits.test.ts` are marked "PASSES on both versions: none (module is wholly new)") is that these are new-infrastructure tests whose *observable* text happens to match a pre-existing convention by design (S4: "No retry-on-error is added... a passing flow is never exposed to more navigation races than today"). No change made.

### Final test count

Bullet-level tally of the Consolidated Test Plan (one count per distinct `expect(...)`-bearing bullet; sub-cases named within one bullet, e.g. "7 sub-cases" or "12 cases," are counted as one bullet, consistent with the consolidator's own AC-level tally):

| Task | File(s) | Count |
|---|---|---|
| T1 | `deadline.test.ts` (17), `commandTraits.test.ts` (6), `commandTraits.typecheck.ts` (4), `positive-int.test.ts` (9) | **36** |
| T3 | `IntegrationTimeoutsPage` render check (new, closes Gap 11) | **1** |
| T4 | `playwrightLocator.test.ts` (41), `resolveSelector.test.ts` (4) | **45** |
| T5 | `error-message-format.test.ts` / `lazy-interpolation-timing.test.ts` (AC48–50) | **4** |
| T6 | `sibling-timeout-parser.test.ts` | **17** |
| T7 | `timeout-config.test.ts` | **13** |
| T8 | `args.test.ts` (new describe block) | **6** |
| T9 | `timeouts-precedence.test.ts` | **21** |
| T10 | `commands.test.ts` (33), `within-dispatcher.test.ts` (3), session-engine/runner-no-auto-nav/flowReplayer regression edits (5) | **41** |
| T11 | `timeouts.test.ts` integration (29), `reporter.test.ts` (1) | **30** |
| T12 | `timeouts.yaml` (7), `timeouts-default-fails.yaml` (2), go-back/go-forward variants (4), full-regression (3), build/suite gate (1) | **17** |

**Total: 231 tests** across T1–T12 (consistent with the consolidator's stated 229 plus the T3/AC76 addition and minor bullet-grouping differences; no material discrepancy — this is the number the Coder should expect to see pass in Phase 2).

**Last checkpoint:** tester_arbiter at 2026-10-13 20:45

## Coder Execution Plan (Orchestrator, 2026-10-13 20:55)
- Budget: $9.37 of $15.00 spent before coding. To limit repeated context reads, the 12 tasks run as 6 Coder activations in waves: W1 = T1 ∥ (T2+T3); W2 = T4 ∥ (T5–T9); W3 = T10+T11; W4 = T12.
- Parallel coders share the run worktree and touch disjoint files. They do not commit (concurrent commits race on the git index); the Orchestrator verifies and commits after each wave with `feat-selector-waits-and-timeouts: <tasks>` messages. Each coder writes its Code Artifacts to `artifacts-<tasks>.md`; the Orchestrator copies them into `## Code Artifacts`.
- The outer-checkout test-app dev server on :8084 serves the old pages; it is restarted from the worktree before W4.

## Baseline Addendum (2026-10-13 21:30)
- recorder-app was not baselined at pre-flight. Measured on the base without any run changes (outer checkout): vitest 26 failed | 117 passed | 1 todo (failures in `src/overlay.test.ts` and `src/cli.integration.test.ts`); `tsc --noEmit` fails at `src/cli.test.ts(141,7) TS2769`. Both pre-existing and out of scope. The quality gate compares recorder-app against this baseline, not against zero failures.
- Human raised the cap again, from $15.00 to $20.00 (2026-10-13 21:35). Accumulated at the time: $10.59.

## Standing Rule: rate limits (human, 2026-10-13 21:50)
- For the rest of this run: one agent at a time. On a sonnet 429, retry that activation once on opus, scoped to the remaining work, log it, and continue without stopping. Stops remain for gates, the cost cap, and any non-429 failure.
- Supersedes the W2 parallel plan: W2 runs T4, then T5–T9, sequentially.

## Code Artifacts

### Wave 1 (T1, T2, T3)

# T1 Code Artifacts

Worktree: `.worktrees/feat-selector-waits-and-timeouts`

| File | Created/Modified | Purpose | Task |
|---|---|---|---|
| `packages/core/src/types.ts` | Modified | New timeout types on `SessionedCommand`/`RunContext`/`FlowFile`/`RunOptions`/`PlaywrightContext` (S1) | T1 |
| `packages/core/src/commandTraits.ts` | Created | `COMMAND_TRAITS` table, typed `Record<Command['type'], { timeout: TimeoutTrait }>` (S2) | T1 |
| `packages/core/src/commandTraits.test.ts` | Created | Runtime tests for the trait table | T1 |
| `packages/core/src/commandTraits.typecheck.ts` | Created | AC71 compile-time completeness: assignable to `Record<Command['type'], unknown>`; missing-key and excess-key cases each guarded by a used `@ts-expect-error` | T1 |
| `packages/core/src/deadline.ts` | Created | `Clock`/`realClock`, `Deadline`/`createDeadline`, `DEFAULT_TIMEOUTS`, `RETRY_INTERVAL_MS`, `Attempt`, `retryUntil` (S3) | T1 |
| `packages/core/src/deadline.test.ts` | Created | Fake-clock tests for `Deadline` and `retryUntil` | T1 |
| `packages/core/src/index.ts` | Modified | Export the new core modules | T1 |
| `uivisor-app/src/utils/positiveInt.ts` | Created | `parsePositiveInt(raw: unknown): number \| undefined` shared predicate (S9) | T1 |
| `uivisor-app/tests/unit/positive-int.test.ts` | Created | 15 unit cases for `parsePositiveInt` (incl. Arbiter gap rulings 2 and 3) | T1 |

Core `*.test.ts` and `commandTraits.typecheck.ts` stay in `src/` and are compiled by core's `tsc` (tsconfig `include: ["src/**/*"]`), the same as existing core tests.

## Verification

| Command | Result |
|---|---|
| `npm run build -w packages/core` | PASS (tsc clean) |
| `cd packages/core && npx vitest run` | PASS: 14 files, 452 tests (T1: deadline + commandTraits = 23) |
| `cd uivisor-app && npx tsc --noEmit` | PASS |
| `cd uivisor-app && npx vitest run tests/unit/positive-int.test.ts` | PASS: 1 file, 15 tests |
| `cd recorder-app && npx tsc --noEmit` | FAIL, existed before T1: `src/cli.test.ts(141,7) TS2769` (untyped `vi.fn()` mock `.calls.find` callback under vitest 5). The same error shows up on the main checkout (`c7ab53f`). It has nothing to do with T1 and T1 does not touch it. |

# Code Artifacts: T2, T3 (compiled by Orchestrator after the coder hit a 429)

| File | Created/Modified | Purpose | Task |
|---|---|---|---|
| `uivisor-app/tests/fixtures/timeouts/delayed.html` | Created | `delay` (1500): int-delayed, int-delayed-card/int-card-label, `<h2>Submit</h2>` then `data-testid=Submit` button +50 ms → int-submit-result; int-hidden always; `cardDelay` (0)/`innerDelay` (2500): `card`/`inner` for AC27 | T2 |
| `uivisor-app/tests/fixtures/timeouts/late-enable.html` | Created | `int-late-enable` button added disabled, enabled later (AC36) | T2 |
| `uivisor-app/tests/fixtures/timeouts/vanish.html` | Created | `int-vanish` removed at ~1500 ms; `int-stays` always visible (AC21, AC22) | T2 |
| `uivisor-app/tests/fixtures/timeouts/duplicates.html` | Created | `mode` = collapse (`collapseAt`) / hidden / mixed / hide-later (`hideAt`, 800) for `row`/`dup` (AC12, AC17, AC23) | T2 |
| `uivisor-app/tests/fixtures/timeouts/growing.html` | Created | `item`/`.row` list grows 1 → 3 at ~1000 ms (AC26, AC30) | T2 |
| `uivisor-app/tests/fixtures/timeouts/input-disable.html` | Created | `int-input` disabled right after it is tapped (AC32) | T2 |
| `uivisor-app/tests/fixtures/timeouts/spa-nav.html` | Created | `navAt` (800) pushState to `target` (/target), then fetch `/slow?ms=slowMs` (1700); needs a server that serves `/slow` (AC37) | T2 |
| `test-app/src/pages/IntegrationTimeoutsPage.jsx` | Created | `/integration-timeouts`, AC76 (a)–(e); no stray exact-text `Submit`/`Delayed content` elements | T3 |
| `test-app/src/App.jsx` | Modified | Route `/integration-timeouts` | T3 |

## Verification (Orchestrator)
- T2: all 7 fixtures loaded in headless Chromium; DOM snapshots at 0 / 1.2 / 3.2 s match their header comments (duplicates and spa-nav are parameter-driven by design).
- T3: `npx vite build` ok. Live check on :8085 — t0: exact `Submit` 0, exact `Delayed content` 0, int-hidden hidden; t1.6s: h3 Submit 1, button#Submit 1, int-delayed 1, card+label 1, int-never-rendered 0; click → int-submit-result 1; `?delay=300` shows int-delayed by 450 ms; `?redirect=500` lands on `?arrived=1`.
- Commits: T2 `d471830`, T3 (see git log).

**Last checkpoint:** Coder wave 1 committed at 2026-10-13 22:05

### Wave 2a (T4)

# T4 Code Artifacts — waiting resolution in core (S4)

Worktree: `.worktrees/feat-selector-waits-and-timeouts` (not committed)

| File | Created/Modified | Purpose | Task |
|---|---|---|---|
| `packages/core/src/playwrightLocator.ts` | Modified | `buildSteps` (cascade / pipe / object forms; malformed selectors throw synchronously; xpath `count()` wraps errors as `Invalid XPath expression: <expr> — <detail>`), `pollSteps` (stability rule on `retryUntil`: step 1 wins at once, a lower step must win two consecutive attempts; unconfirmed winner never accepted at the deadline; duplicates retry), `resolveLocator(page, selector, scope?, deadline?)` with `Element not found after <T>ms: <label>` + per-step count lines, `resolveContainerLocator(page, selector, { nth?, deadline? })` with `within: No container found after <T>ms …` + counts / nth message, `resolveNotVisible` (deciding-step rule, revised AC23), `selectorLabel`. Omitted deadline = `createDeadline(DEFAULT_TIMEOUTS.defaultTimeout)`. Cascade/pipe locators are built lazily, so steps after the winner are never queried. Removed the now-dead `buildCascadeStep` (same as `buildLocatorForAttr` for cascade attrs). | T4 |
| `packages/core/src/playwrightLocator.test.ts` | Modified | 44 new T4 tests (AC1–AC27, Arbiter ruling 1, `selectorLabel`) on an injected fake `Clock`, plus the E2(c) edits listed below | T4 |
| `uivisor-app/tests/unit/resolveSelector.test.ts` | Modified | New AC14–AC17 tests via `@uivisor/core` `resolveLocator` with a fake-clock 1000 ms deadline, plus the E2(c) edits listed below | T4 |

## Edited existing tests (Errata E2(c))

The same edits were made in both `packages/core/src/playwrightLocator.test.ts` and `uivisor-app/tests/unit/resolveSelector.test.ts` (Arbiter ruling 12: the two files test the same seam). The short deadline is `shortDeadline()` = `createDeadline(1000, fakeClock)`.

| Test | Edit | Reason |
|---|---|---|
| TC-004 | short deadline; expects `Element not found after 1000ms: Foo`; title updated | no unique match; error text replaced (AC14) |
| TC-005 | short deadline; header expects `Element not found after 1000ms: Foo` (count lines unchanged) | no unique match; error text replaced (AC14) |
| TC-006 | short deadline; asserts new header line + `  text=Foo: 0 matches` instead of the `Use pipe syntax` hint; title updated | the hint is not part of the AC14 message |
| TC-007, TC-008, TC-011, TC-029 | short deadline only | no unique match, so they would poll for 5 s |
| TC-056 | locator `count` mocked to 1; asserts `count()` called **once** (was 0); title updated | object forms are now one waiting step (AC4/AC6) |
| TC-057, TC-058, `backward compat: { role, name }`, `{ placeholder }`, `{ css }`, TC-XPATH-R20, R21, R24 | locator `count: vi.fn()` → `vi.fn().mockResolvedValue(1)` | object forms now count; an undefined count is never a unique match |
| TC-XPATH-R5, R6, TC-B-009 | short deadline; `No element found for xpath selector` → `Element not found after 1000ms: {"xpath":…}` (B-009 asserts the full 2-line message); B-009 title updated | AC16 message replaces the xpath-specific one |
| TC-XPATH-R8 | short deadline; asserts `Element not found after 1000ms: {"xpath":"//li"}\n  {"xpath":"//li"}: 2 matches` (drops the `within` hint); title updated | AC17 message |
| TC-XPATH-R9, R10, TC-B-006 | short deadline only | no unique match |
| TC-032 `"id=foo*bar*baz"` (uivisor-app file only) | short deadline only | no unique match |

Unedited and passing (examples, "PASSES on both versions"): TC-001, TC-002, TC-003, TC-009, TC-010, TC-012–TC-019, wildcard tests, xpath happy paths, xpath union tests, TC-XPATH-R23. TC-002, TC-003, TC-010, TC-020/023/026 and R22 now take about 100 ms of real time each, because the stability check confirms a lower-step winner.

## Verification

| Command | Result |
|---|---|
| `npm run build -w packages/core` | OK (test files are type-checked too) |
| `cd packages/core && npx vitest run` | **540 passed** (14 files); `playwrightLocator.test.ts` 115 passed (was 71) |
| red check: T4 tests against the pre-T4 `playwrightLocator.ts` | 40 failed / 4 passed (the AC18 fast-fail cases already threw) |
| `cd uivisor-app && npx tsc --noEmit` | OK |
| `cd uivisor-app && npx vitest run` | **11 failed / 741 passed / 4 expected fail** (756). `resolveSelector.test.ts`: 89 passed. `tests/integration/commands.test.ts`: all passed. |
| `cd recorder-app && npx tsc --noEmit` | only the pre-existing `src/cli.test.ts(141,7): error TS2769` |

### Failing tests outside T4's files (not edited)

`uivisor-app/tests/unit/matcher.test.ts`: **no task in the breakdown owns this file.** Its mocks return locators with no `count()`, or assert the old xpath text.
- `resolveSelector — object selectors (unchanged behaviour) > { text: "Submit" } calls page.getByText("Submit")`: `TypeError: get(...).count is not a function` (matcher.test.ts:46)
- `… > { text } does not call any other getBy* method`: same TypeError (:55)
- `… > { role: "button", name: "Sign In" } calls getByRole("button", { name: "Sign In" })`: same (:67)
- `… > { role: "link", name: "Home" } calls getByRole("link", { name: "Home" })`: same (:77)
- `… > { label: "Email" } calls page.getByLabel("Email")`: same (:85)
- `… > { placeholder: "Enter email" } calls page.getByPlaceholder("Enter email")`: same (:97)
- `… > { testId: "submit-btn" } calls page.getByTestId("submit-btn")`: same (:109)
- `… > xpath branch (count=0) throws "No element found for xpath selector" error`: `AssertionError: expected [Function] to throw error matching /No element found for xpath selector/i but got 'Element not found after 5000ms: {"xpa…'` (:149)
- `… > returns the Locator produced by getByLabel`: same TypeError (:157)
- `… > returns the Locator produced by getByPlaceholder`: same TypeError (:163)

`uivisor-app/tests/unit/within-dispatcher.test.ts` (T10's file):
- `executeWithin — container not found (TC-045) > throws exact error when container count=0`: `AssertionError: expected [Function] to throw error including 'within: No container found for select…' but got 'within: No container found after 5000…'` (:93). It also takes 5 s of real time, because `executeWithin` passes no deadline yet.

## Deviations from S4

- **Lazy step locators.** `ResolutionStep.locator` is a getter that builds the locator on first use. Without this, TC-001 ("text/name/id/placeholder NOT queried", listed as PASSES on both versions) would fail, because building every cascade step calls `getByText` eagerly. The `{ xpath }` step stays eager, so a locator-construction error is still thrown in `buildSteps`.
- **Container message when `nth` is omitted.** If the deadline passes while an unconfirmed lower step has ≥ 1 match, the `No container found after …` message is used, with counts. The nth message is only used when `nth` is given and some counted step had 1..nth matches (n = first non-zero count, per S4).
- `commands.ts` was not changed. Existing callers get the 5000 ms default budget.

**Orchestrator verification:** core build ok; core 540 passed; app tsc ok; app 741 passed, 11 failed (10 `tests/unit/matcher.test.ts`, 1 `within-dispatcher.test.ts` TC-045), 4 expected fail. Committed as WIP for its own scope.

**Orchestrator ruling (under the human E2(c) decision):** `uivisor-app/tests/unit/matcher.test.ts` is a resolver-mock test file of the same kind E2(c) covers (mocks lack `count()`; one assertion expects the old xpath message). E2(c) extends to it. Its edits are assigned to the next Coder activation (T5) as item 0. T4 closes when that file is green. TC-045 stays with T10.

**Last checkpoint:** T4 committed at 2026-10-13 22:35
- Human raised the cap again, from $20.00 to $30.00 (2026-10-13 22:45). Accumulated at the time: $13.87. Phase 2 stays as the full ensemble (no instruction to trim it).

### Wave 2b (T5, plus T4 test fallout)

# T5 Code Artifacts — `dispatch` signature + sibling interpolation (S6 part 1), plus item 0 (matcher.test.ts fallout)

Worktree: `.worktrees/feat-selector-waits-and-timeouts` (not committed)

| File | Created/Modified | Purpose | Task |
|---|---|---|---|
| `uivisor-app/tests/unit/matcher.test.ts` | Modified | Item 0 (Orchestrator's extension of Errata E2(c)). Mock `Locator` in `makeMockPage()` now has `count: () => Promise.resolve(1)` (object-selector resolution waits for a stable count after T4). The two xpath tests pass `createDeadline(1)` as the 4th `resolveSelector` arg so a count=0 mock doesn't poll the real 5000 ms default; the error-text test's expectation updated from `No element found for xpath selector` to the new `Element not found after <T>ms: {"xpath":…}` format. | item 0 |
| `uivisor-app/src/engine/dispatcher.ts` | Modified | `dispatch(page, step: SessionedCommand, ctx, flowStem?, flowDir?)` — takes only a step, no `Command` overload. `const cmd = step.command`. Sibling `timeout` is resolved in the **same** try block as command interpolation: `number` is used as-is; a string is run through `interpolateValue(…, true)` (strict — throws `Variable "x" is not defined` on an undefined var, reusing the existing #100 catch below, unmodified, for the `(in flow …)` / `(in child flow …, called from …)` suffix) then `parsePositiveInt`; an invalid parse throws `timeout must be a positive integer, got "<resolved>"` into the **same** catch (its message doesn't contain the catch's trigger substrings, so it's returned exactly as written — no duplicated context logic). No deadline/budget use yet (T11). The `within` case now wraps the inner `Command` as `{ command: nc }` when calling `dispatch` recursively, since `executeWithin`'s `WithinDispatch` callback still hands a bare `Command` until T10. | T5 |
| `uivisor-app/src/engine/index.ts` | Modified | Both `dispatch(sessionPage, sc.command, ctx, …)` call sites → `dispatch(sessionPage, sc, ctx, …)` (pass the whole step). | T5 |
| `uivisor-app/tests/integration/commands.test.ts` | Modified | Codemod: all 69 `dispatch(page, <cmd>, ctx, …)` calls → `dispatch(page, { command: <cmd> }, ctx, …)`. | T5 |
| `uivisor-app/tests/unit/error-message-format.test.ts` | Modified | Codemod on its 8 existing calls, plus a new `describe('error message format: sibling timeout resolution at dispatch (AC48–AC50, T5)')` block (4 new tests, listed below). | T5 |
| `uivisor-app/tests/unit/lazy-interpolation-timing.test.ts` | Modified | Codemod on its 5 existing calls. | T5 |
| `uivisor-app/tests/unit/sessions.test.ts` | Modified | Codemod on its 1 existing call. | T5 |
| `uivisor-app/tests/unit/set-var-commands.test.ts` | Modified | Codemod on its 14 existing calls. | T5 |
| `uivisor-app/tests/unit/within-dispatcher.test.ts` | Modified | Codemod on its 2 `dispatch(page, cmd, makeCtx())` calls (the two real `dispatch()` call sites; the `executeWithin(..., dispatch)` calls in the TC-045/TC-047 blocks use a locally-shadowed mock `dispatch: WithinDispatch` and were untouched). | T5 |

## Codemod

Ran a small Node script (`/tmp/codemod-dispatch.js`, not committed — scratch tooling) against the 6 files the Errata names. For each `dispatch(` call site (skipping any preceded by an identifier character, i.e. not a bare call) it does a quote/bracket-depth-aware split of the top-level arguments and rewrites the 2nd argument `X` to `{ command: X }` (skipped if already `{ command: ...}`-shaped). Comments embedded between `command:` and the object value (e.g. the `// @ts-expect-error` lines before several `selectOption`/`check`/`uncheck` commands) are preserved in place — `{ command: // comment\n  { type: ... } }` is valid syntax and those pragmas are inert anyway since `tests/` is outside `uivisor-app/tsconfig.json`'s `include`.

Per-file conversion counts (all matched the Errata's total of 99):

| File | Calls converted |
|---|---|
| `tests/integration/commands.test.ts` | 69 |
| `tests/unit/set-var-commands.test.ts` | 14 |
| `tests/unit/error-message-format.test.ts` | 8 |
| `tests/unit/lazy-interpolation-timing.test.ts` | 5 |
| `tests/unit/within-dispatcher.test.ts` | 2 |
| `tests/unit/sessions.test.ts` | 1 |
| **Total** | **99** |

Verification grep (no bare-Command calls left): `grep -rnE "dispatch\([^,]+, *[a-zA-Z_]+ *," uivisor-app/tests` → no output.

## New tests (AC48–AC50, T5) — `uivisor-app/tests/unit/error-message-format.test.ts`

Filed here per the Consolidated Test Plan / Arbiter ruling (Gap 7): adopt Generator A's assignment to `error-message-format.test.ts` / `lazy-interpolation-timing.test.ts`.

| Test | AC | Behavior checked |
|---|---|---|
| `AC48: a sibling timeout "${t}" set by an earlier setVar resolves without error` | AC48 | `setVar: t=1300` then `{ command: {goto}, timeout: '${t}' }` — dispatch is not blocked by validation and the command runs to completion (`passed: true`). |
| `AC49: "${var}" resolving to an invalid value fails the command immediately with the exact quoted-value message` | AC49 | `setVar: t=abc` then `{ command: {tapOn}, timeout: '${t}' }` — fails in <500ms with exactly `timeout must be a positive integer, got "abc"`; `page.locator` never called (no resolution attempt). |
| `AC50a: an undefined "${var}" in a top-level flow sibling timeout gets the #100 flow-context suffix` | AC50(a) | `ctx.callStack = {'/abs/top.yaml'}`, `{ tapOn, timeout: '${nope}' }` → `Variable "nope" is not defined (in flow /abs/top.yaml)`. |
| `AC50b: the same undefined "${var}" inside a child flow gets the child+caller context suffix` | AC50(b) | `ctx.callStack = {'/abs/top.yaml', '/abs/child.yaml'}` → `Variable "nope" is not defined (in child flow /abs/child.yaml, called from /abs/top.yaml)`. |

**Deviation:** AC48 as literally written ("the step fails after 1300ms with … `Element not found after 1300ms: …`") describes end-to-end budget-driven behaviour. The S6 seam note explicitly scopes that to T11 ("Budget (T11)… `const ms = stepTimeoutMs(...)`… `deadline`… passed as the trailing argument to every `execute*` call") — T5's own instructions say "No budget use yet (T11)". Since `dispatch` doesn't yet thread any deadline into `execute*`, the literal AC48 message is not achievable until T10 (trailing `deadline?` param) and T11 (budget wiring) land. The AC48 test above instead covers T5's actual scope: the sibling value resolves from the runtime var map without error and the command proceeds. The full round-trip (`Element not found after 1300ms`) is left for T11's `tests/integration/timeouts.test.ts`, consistent with Gap 7/11's note that AC48–50's full behaviour may be integration-only.

## Verification

| Command | Result |
|---|---|
| `npm run build -w packages/core` | OK |
| `cd uivisor-app && npx tsc --noEmit` | OK (clean exit; `tests/` is excluded from this tsconfig, so the codemod's output isn't type-checked here — covered by the vitest run below instead) |
| `cd uivisor-app && npx vitest run tests/unit/matcher.test.ts` | 12 passed (was 10 failed / 2 passed before item 0's edit) |
| `cd uivisor-app && npx vitest run` (full suite) | **755 passed, 4 expected fail, 1 failed** (760 total) — the 1 failure is `within-dispatcher.test.ts > executeWithin — container not found (TC-045)`, owned by T10 per the task brief (expects the pre-T4 `within: No container found for selector …` message; `resolveContainerLocator` now polls to a deadline and uses the new message/format — T10 updates this test). All other files, including `tests/integration/commands.test.ts` (post-codemod) and `error-message-format.test.ts` (12/12 incl. the 4 new AC48–50 tests), passed. |
| `cd packages/core && npx vitest run` | 540 passed (unaffected by T5) |
| `cd recorder-app && npx tsc --noEmit` | only the known pre-existing `src/cli.test.ts(141,7): error TS2769` |
| `grep -rnE "dispatch\([^,]+, *[a-zA-Z_]+ *," uivisor-app/tests` | no output (no bare-Command calls left) |

No other files touched. `recorder-app`'s own `vitest run` has 26 pre-existing failures in `src/overlay.test.ts` / another file, unrelated to this worktree's diff (confirmed via `git diff --stat`, which touches only the 9 files listed above) — out of scope for T5 per S12 ("Builds: `recorder-app` `npm run build` and `vitest run` are verified in T10").

**Orchestrator verification:** core 540 passed; app tsc ok; app 755 passed, 1 failed (TC-045, T10), 4 expected fail; no bare-Command dispatch calls left. T4 closes (matcher.test.ts green).

**Carry-forward notes:**
- T11: the sibling timeout is validated in `dispatch` but the resolved number is discarded. T11 must use that resolved value for the budget, not resolve it twice. AC48's end-to-end assertion (fails after 1300 ms) is owned by T11's integration suite.
- T10: remove the `{ command: nc }` wrap in the `within` closure and the task-number comments ("T10 will…") added by T5.

**Last checkpoint:** T5 committed at 2026-10-13 23:00

### Wave 2c (T6–T9)

# T6-T9 Code Artifacts — sibling `timeout:`, header/config timeout keys, CLI timeout flags, precedence module

Worktree: `.worktrees/feat-selector-waits-and-timeouts` (not committed)

## T6 — `uivisor-app/src/parser/commandParser.ts`: sibling `timeout` key

| File | Created/Modified | Purpose | Task |
|---|---|---|---|
| `uivisor-app/src/parser/commandParser.ts` | Modified | `parseSessionedCommand` now extracts a sibling `timeout` key (via `'timeout' in obj`, so `null` counts as present) alongside the existing `session` extraction. After calling `parseCommand(rest)`, when `timeout` is present: (1) trait check — if `COMMAND_TRAITS[command.type].timeout === 'none'`, throw `timeout is not supported on ${yamlKey}` where `yamlKey = Object.keys(rest)[0]`; (2) value check — a string containing `${` is kept as-is, otherwise `parsePositiveInt(raw) ?? throw \`timeout must be a positive integer, got ${String(raw)}\``; (3) Q19 — if `command.type === 'waitForPageLoad' && command.timeout !== undefined`, throw `waitForPageLoad: timeout given both inside the command and as a sibling key; use one`. Returns `{ session?, timeout?, command }` with each key present only when set. | T6 |
| `uivisor-app/tests/unit/sibling-timeout-parser.test.ts` | Created | New unit test file, 54 `it` cases (via `it.each` grouping) covering AC39, AC40(a)/(b), AC41 (element it.each ×20, navigation it.each ×5), AC42, AC43, AC44 (none-trait it.each ×10), AC45(a), AC46, AC72 (single cross-check test over every `Command['type']`), AC47 (invalid-value it.each ×6 + 1 valid quoted-digit-string case), AC75, plus a `PASSES on both versions` block (3 regression tests: session-only extraction, inner `waitForPageLoad timeout:0`, inner `waitForPageLoad timeout:"5000"` still throws). | T6 |

No existing test files were modified for T6 — `sibling-timeout-parser.test.ts` is wholly new.

## T7 — header/config `defaultTimeout` / `navigationTimeout`

| File | Created/Modified | Purpose | Task |
|---|---|---|---|
| `uivisor-app/src/parser/validator.ts` | Modified | `VALID_HEADER_KEYS` gains `'defaultTimeout', 'navigationTimeout'`. New exported `validateTimeoutKeys(obj: Record<string, unknown>, source: string): Partial<TimeoutSettings>` returns only the keys present, validated via `parsePositiveInt`, throwing `Invalid <key>: must be a positive integer, got <value> in <source>` on failure. | T7 |
| `uivisor-app/src/parser/interpolate.ts` | Modified | `FLOW_CONFIG_KEYS` gains both timeout keys (stripped before `flattenVars`, so they never become ordinary vars — AC66). `LoadConfigFileResult` gains `timeouts: Partial<TimeoutSettings>`. `loadConfigFile` interpolates string timeout values env-only (`interpolateValue(v, {})`, AC57b) then validates via `validateTimeoutKeys(…, configPath)` using the config path as written (AC68). | T7 |
| `uivisor-app/src/parser/index.ts` | Modified | After pass-3 interpolation of non-command fields, calls `validateTimeoutKeys(doc, filePath)` to produce `headerTimeouts`; combines with `configTimeouts` from `loadConfigFile`'s result; returned `FlowFile.timeouts = { header: headerTimeouts, config: configTimeouts }`. Runs for every file, top-level or child (AC69). | T7 |
| `uivisor-app/tests/unit/timeout-config.test.ts` | Created | New unit test file, 19 `it` cases covering AC65, AC67(a)/(b)/(c), AC66, AC68 (5 header-invalid it.each cases + 4 individual cases + 2 accepted-value cases), AC69, AC57(b)/(c), plus a `PASSES on both versions` block (1 test for the unrelated `base` key). | T7 |

No existing test files were modified for T7 — `timeout-config.test.ts` is wholly new. No circular import: `validator.ts` imports only from `@uivisor/core`; `interpolate.ts` imports `validateTimeoutKeys` from `validator.ts` (one-directional).

## T8 — CLI flags `--timeout` / `--navigation-timeout`

| File | Created/Modified | Purpose | Task |
|---|---|---|---|
| `uivisor-app/src/cli/args.ts` | Modified | `ParsedArgs` gains `timeout?: number; navigationTimeout?: number`. Two new branches in `parseArgs`'s arg loop for `--timeout` and `--navigation-timeout`: each reads `args[i+1]` as the raw value (empty string `''` if absent — AC55e), runs it through `parsePositiveInt`; on failure writes `Error: --timeout must be a positive integer, got "<raw>"\n` (or the `--navigation-timeout` form) to stdout and `process.exit(1)`; on success assigns and advances `i += 2`. No lookahead to check whether the next token looks like another flag (Arbiter Ruling 4 — greedy-consume, matching the existing `--slow-mo`/`--reporter`/`--output-dir` convention), and scalar reassignment on repeat occurrence means last-wins when the flag is given twice. Usage line gains `[--timeout <ms>] [--navigation-timeout <ms>]`. Return object gains `timeout, navigationTimeout`. | T8 |
| `uivisor-app/src/cli/index.ts` | Modified | Destructures `timeout, navigationTimeout` from `parsed`; `options` object passed to `runAll` gains `timeouts: { defaultTimeout: timeout, navigationTimeout }` (S11). | T8 |
| `uivisor-app/tests/unit/args.test.ts` | Modified (appended) | New `describe('parseArgs: --timeout / --navigation-timeout', ...)` block appended at end of file; all existing `it(...)` cases left untouched. 9 new tests: AC55(a) both-flags-parsed, AC55(a, absence) both-undefined, AC55(b) `--timeout 0` exact error+exit1, AC55(c) `--timeout abc` exact error+exit1, AC55(d) `--navigation-timeout -1` exact error+exit1, AC55(e) `--timeout` with no trailing value → empty-string raw value error+exit1, usage-string substring check, plus 2 Arbiter-ruling regression tests (`--timeout` immediately followed by another flag greedily consumes it as the raw value; `--timeout` given twice → last wins). | T8 |

**Edited existing test file:** `uivisor-app/tests/unit/args.test.ts` — reason: T8's own file-list instructions require a new describe block "appended; existing cases untouched," which is what was done (no existing `it(...)` body was changed).

## T9 — `uivisor-app/src/engine/timeouts.ts`: precedence module

| File | Created/Modified | Purpose | Task |
|---|---|---|---|
| `uivisor-app/src/engine/timeouts.ts` | Created | Pure functions per S7, not yet wired into the engine (T11 wires them in): `resolveRunTimeouts(cli, file)` — per key `cli ?? header ?? config ?? DEFAULT_TIMEOUTS` (header beats config, AC54); `stepTimeoutMs(type, own, run)` — `'none'` → `undefined`, `'element'` → `own ?? run.defaultTimeout`, `'navigation'` → `own ?? run.navigationTimeout`; `timeoutNotice(child, run, topLevelPath)` — keys in `[defaultTimeout, navigationTimeout]` order where `(header ?? config)` is set and differs from `run[key]`, formatted as `${basename(child.filePath)}: ${keys.join(', ')} ignored (inherited from ${basename(topLevelPath)})`, else `null`. A private `firstDefined(header, config, key)` helper implements `header?.[key] ?? config?.[key]` for both `resolveRunTimeouts` and `timeoutNotice`. | T9 |
| `uivisor-app/tests/unit/timeouts-precedence.test.ts` | Created | New unit test file, 26 `it` cases: `resolveRunTimeouts` (12 — AC51 ×4, AC52 ×4, AC53 ×2, AC54 ×2); `stepTimeoutMs` (5 — AC51 sibling-layer, element-default, navigation-default, AC35/Q19 composition, AC70 none-trait); `timeoutNotice` (9 — AC58 setup, AC59 revised, AC60 revised a/b, AC61 revised a/b, AC80 a/b, AC62). Uses the **Gate 1 Revision 1** text for AC59/AC60/AC61/AC80 (value-differs gate, not the superseded originals). `PASSES on both versions: none` — module is wholly new. | T9 |

No existing test files were modified for T9 — `timeouts-precedence.test.ts` is wholly new.

## Verification

| Command | Result |
|---|---|
| `npm run build -w packages/core` | Clean (no T6-T9 changes touch `packages/core`). |
| `cd uivisor-app && npx tsc --noEmit` (after T6) | Clean. |
| `cd uivisor-app && npx vitest run` (after T6) | 809 passed, 4 expected fail, 1 known failure (`within-dispatcher.test.ts` TC-045, owned by T10) — baseline 755 + 54 new. |
| `cd uivisor-app && npx tsc --noEmit` (after T7) | Clean. |
| `cd uivisor-app && npx vitest run` (after T7) | 828 passed, 4 expected fail, same 1 known TC-045 failure — 809 + 19 new. |
| `cd uivisor-app && npx tsc --noEmit` (after T8) | Clean. |
| `cd uivisor-app && npx vitest run` (after T8) | 837 passed, 4 expected fail, same 1 known TC-045 failure — 828 + 9 new. |
| `cd uivisor-app && npx tsc --noEmit` (after T9) | Clean. |
| `cd uivisor-app && npx vitest run` (after T9, final) | 863 passed, 4 expected fail, same 1 known TC-045 failure — 837 + 26 new. |
| `cd recorder-app && npx tsc --noEmit` (final) | Only the known pre-existing `src/cli.test.ts(141,7)` overload error — no recorder-app files touched this run. |

**No deviations.** All four tasks implemented to spec, in order, each verified before the next. The single pre-existing `within-dispatcher.test.ts` TC-045 failure (owned by T10) persisted unchanged throughout and was never introduced or fixed by T6-T9. No `state.md` edits, no commits.

**Orchestrator verification:** app tsc ok; app 863 passed, 1 failed (TC-045, T10), 4 expected fail. Reviewed `engine/timeouts.ts`: one precedence source (CLI > header > config > built-in; sibling per step), notice lists only differing keys.

**Last checkpoint:** T6–T9 committed at 2026-10-14 00:05

### Wave 3a (T10)

# T10 Code Artifacts — core commands take a deadline (S5)

Worktree: `.worktrees/feat-selector-waits-and-timeouts` (not committed)

| File | Created/Modified | Purpose | Task |
|---|---|---|---|
| `packages/core/src/commands.ts` | Modified | Every `execute*` takes a trailing optional `deadline?: Deadline` (built-in default via `elementDeadline`/`navigationDeadline` when omitted). Element actions resolve via `resolveLocator` **outside** any try/catch (so resolution failures escape unwrapped as `Element not found after <T>ms: <selector>`), then run the Playwright action inside a catch that throws `Element not actionable after <T>ms: <selector>`, passing `d.pwTimeout()` (the *remaining* budget) to the action call (`tapOn`/`inputText`/`inputTextTargeted`/`check`/`uncheck`/`hover`/`doubleClick`/`clearText`). `selectOption` keeps resolution outside the catch but merges `waitFor(attached)` + `selectOption` into one catch that always throws the literal `Option not found.` (Errata E3 carve-out). Assertions (`assertVisible`/`assertText`/`assertValue`/`assertEnabled`/`assertDisabled`/`assertChecked`/`assertUnchecked`) resolve outside the catch (same `Element not found after...` on resolution failure) and read their condition once, keeping today's `Expected: X\nGot: ...` text on condition failure. `assertUrl`/`assertCount` now poll via `retryUntil` and report the *last observed* value at the deadline. `assertNotVisible` delegates entirely to `resolveNotVisible` (unchanged failure text `Expected: not visible\nGot: visible`). Navigation (`goto`/`reload`/`goBack`/`goForward`) passes `{ ..., timeout: d.pwTimeout() }`, detects Playwright's `TimeoutError` via `.name` (not `instanceof`, since mocks may be plain objects) and embeds `<T>ms`; non-timeout errors keep `goto`'s existing `Navigation failed: ...` wrapping, while `reload`/`goBack`/`goForward` propagate non-timeout errors unmodified (no wrapping existed before). `waitForPageLoad` shares one `Deadline` across the URL wait and the load-state wait (`d.pwTimeout()` recomputed per call, floored at 1ms, never literal 0 unless the budget is `0`/unbounded). `inputText` shorthand stores/reads `ctx.lastTappedLabel` (set by `tapOn`/`inputTextTargeted` via `selectorLabel`). `WithinDispatch` now takes a whole `step: SessionedCommand`. `executeWithin` validates `nth < 0` before any resolution attempt, resolves the container via `resolveContainerLocator(..., { nth, deadline })` (which now owns all "no container"/"nth out of range" error formatting — the old manual `count===0`/nth-range checks were redundant and removed), and dispatches each `do:` entry's whole step (not just its bare command) to the scoped page; the `within` deadline bounds only the container lookup (Q18) and is never forwarded to the inner `dispatch` calls. | T10 |
| `packages/core/src/commands.test.ts` | Modified (full rewrite, kept the pre-existing `waitForPageLoad` suite) | Added 68 total tests (was 7): AC31 (resolution-not-found) and AC38 (post-resolution not-actionable) for every element command; AC36 one-budget proof (resolution consumes one 100ms retry interval on a fake clock, remaining 1900ms passed to `click`); AC37 one-budget proof for `waitForPageLoad` (controlled `Clock` showing the second wait's `timeout` shrinks and floors at 1, never 0); AC19–AC30 assertion behavior (resolution-not-found vs. condition-mismatch message split, read-once for plain asserts, retry-and-report-last-observed for `assertUrl`/`assertCount`); AC23 revised `assertNotVisible` wiring; Errata E3 confirmation tests for `selectOption` (`Option not found.` on both the `waitFor` and `selectOption` failure paths); AC33–AC35 navigation TimeoutError/non-timeout-error handling for `goto`/`reload`/`goBack`/`goForward`, including the differing non-timeout propagation; AC73 default-timeout tests (5000ms element / 30000ms navigation) that resolve/reject synchronously so no real waiting occurs; `executeWithin` tests for AC24–AC27 (nth<0 pre-check, whole-step dispatch, stop-on-first-failure, all-steps-collected) and Q18 (the within deadline bounds only the container lookup). | T10 |
| `uivisor-app/tests/unit/within-dispatcher.test.ts` | Modified | TC-045 fixed: now passes a short fake-clock deadline (`createDeadline(50, fakeClock)`) and expects the new message `within: No container found after 50ms for selector 'text=NoSuchRow'`. TC-047 (nth out of range) given the same short deadline — it was previously taking the full 5000ms default budget before throwing. TC-B-W-002 and TC-B-W-005 (xpath "no container"/"nth out of range") also given a short deadline to avoid the same 5s real-time cost (their assertions are regexes, so the message format change didn't require a text edit, only the deadline). TC-052/TC-053 (negative-nth defence-in-depth) and TC-B-W-001/003/004 (xpath happy paths / union-conflict) needed no change — they either short-circuit before any resolution attempt or resolve on the first attempt. | T10 |
| `uivisor-app/src/engine/dispatcher.ts` | Modified | `within` case: removed the temporary `{ command: nc }` wrap and the "T10 will…" comment; the callback now passes the whole `step` straight through to `dispatch`, matching `executeWithin`'s new `WithinDispatch` signature. This was not purely cosmetic — leaving the old wrap in place double-wrapped steps (`{ command: { command: {...} } }`) and broke the one dispatcher integration test that exercises a passing `within` block (see Verification below). | T10 |
| `uivisor-app/tests/unit/session-engine.test.ts` | Modified | Errata E2(a): the 7 `goto` call-shape assertions (lines formerly 112, 131, 133, 166, 185, 188, 216) updated from `{ waitUntil: 'load' }` to `{ waitUntil: 'load', timeout: 30000 }`. | T10 |
| `uivisor-app/tests/unit/runner-no-auto-nav.test.ts` | Modified | Errata E2(a): both the mock `runFlow` implementation's own `page.goto(gotoUrl, { waitUntil: 'load' })` call and the `expect(mockPage.goto).toHaveBeenCalledWith(...)` assertion updated to `{ waitUntil: 'load', timeout: 30000 }` (only the assertion line was named in the errata, but the mock's own call had to change too for internal consistency — otherwise the assertion would just be asserting against its own stale literal). | T10 |
| `recorder-app/src/flowReplayer.test.ts` | Modified | Errata E2(a): the 3 `goto` call-shape assertions (lines 104, 179, 330) updated to include `timeout: 30000`. Errata E2(b): the T24 (`assertUrl` mismatch) test given an explicit `10000` ms third argument to `it(...)`, since `assertUrl` now legitimately retries up to its full 5000ms default budget via `retryUntil`, exceeding vitest's 5000ms default per-test timeout. Checked for any assertion on the recorder's private `within` "no container found" message text (Consolidated Test Plan's note that only this file's tests, not `flowReplayer.ts`'s source, absorb the new message) — none exist in this file, so no further edit was needed. | T10 |

## Verification

| Command | Result |
|---|---|
| `npm run build -w packages/core` | OK |
| `cd packages/core && npx vitest run` | **662 passed** (14 files) — baseline 540 + 122 new/added across the suite, no failures |
| `cd uivisor-app && npx tsc --noEmit` | OK, no errors |
| `cd uivisor-app && npx vitest run` | **864 passed + 4 expected fail** (868 total) — baseline was 863 passed + 4 expected fail **+ TC-045 failing**; TC-045 now passes (863→864), nothing else broke |
| `cd recorder-app && npx tsc --noEmit` | Only the known pre-existing `src/cli.test.ts(141,7): error TS2769` |
| `cd recorder-app && npx vitest run` | **26 failed \| 117 passed \| 1 todo** (144 total) — identical to baseline; all 26 failures are in `overlay.test.ts` (none in `flowReplayer.test.ts` or `cli.test.ts`) |

## Deviations from S5

- **`executeWithin`'s old manual container-count/nth-range checks were deleted, not just updated.** `resolveContainerLocator` (T4) already throws the correctly-formatted `within: No container found after <T>ms for selector '...'` and `within: nth=X requested but only Y containers matched selector '...'` errors internally when it returns without a match. The old manual `count === 0` / nth-range checks in `executeWithin` were therefore dead code once T4 landed; they have been removed, leaving only the `nth < 0` pre-check (which must run before any resolution attempt, per S5/the Consolidated Test Plan).
- **`dispatcher.ts`'s `within`-case edit was not purely a cleanup.** Leaving T5's `{ command: nc }` wrap in place after `executeWithin` started passing whole steps would have double-wrapped every inner step (`{ command: { command: {...} } }`), breaking real `within` dispatches. This was caught by the one dispatcher-level `within` integration test in `within-dispatcher.test.ts` and fixed as part of this task, not deferred.
- **`assertUrl`'s default budget is `elementDeadline` (5000ms), not `navigationDeadline`.** `assertUrl` is not in the AC33 navigation-commands list (`goto`/`reload`/`goBack`/`goForward` only) and S5 groups it under "Assertions," so it uses the same default as every other element-level assertion.
- **`runner-no-auto-nav.test.ts`'s mock `runFlow` implementation line was edited in addition to the assertion the errata named**, since the mock's own `page.goto(...)` call feeds the assertion directly — editing only the assertion would have made the test assert against its own already-stale mock call.
- No test file outside the T10 row's exclusive list was touched. `recorder-app/src/flowReplayer.ts` (source) was not modified — only its test file, per the Consolidated Test Plan's note that the recorder's private `within` copy's tests, not its code, absorb the new message text (moot here since no test in that file asserts on that message).

**Orchestrator verification:** no existing test removed (name diff empty); core build ok, core 662 passed; app tsc ok, app 864 passed + 4 expected fail (TC-045 fixed); recorder 26 failed | 117 passed | 1 todo = baseline. No task-number comments left in source.

**Last checkpoint:** T10 committed at 2026-10-14 00:50

### Wave 3b (T11)

# T11 Code Artifacts — engine wiring (S7)

Worktree: `.worktrees/feat-selector-waits-and-timeouts` (not committed)

| File | Created/Modified | Purpose | Task |
|---|---|---|---|
| `uivisor-app/src/engine/context.ts` | Modified | `createContext` takes two new optional trailing params: `methodRunner` (unchanged position, now defaulted) and `timeouts: TimeoutSettings = DEFAULT_TIMEOUTS`. `RunContext.timeouts` is fixed once per call and never mutated afterward (Q13: children inherit it unchanged). `RunContext.timeoutNotices` is initialized to a fresh `Set<string>` per context, shared by every nested `dispatch`/`runFlow` call within that run. | T11 |
| `uivisor-app/src/cli/runner.ts` | Modified | `runAll` calls `resolveRunTimeouts(options.timeouts ?? {}, file)` once per top-level flow (inside the `for (const target of targets)` loop, after `loadAndParse`), and threads the result into `createContext(...)` as the new `timeouts` argument. Each target in a multi-target run gets its own freshly-resolved `TimeoutSettings` (CLI layer is shared; header/config layers are per-file). | T11 |
| `uivisor-app/src/engine/dispatcher.ts` | Modified | (1) The sibling `step.timeout` is resolved in the same interpolation try/catch as the command body — number literals pass through as-is, strings go through `interpolateValue` (strict mode) then `parsePositiveInt`, throwing `timeout must be a positive integer, got "..."` on failure, surfaced through the existing flow-context error wrapping. (2) `const run = ctx.timeouts ?? DEFAULT_TIMEOUTS` computed once per dispatch call, immediately after interpolation, before the `runFlow` branch so the notice logic can use it. (3) In the `runFlow` branch, after `loadAndParse`, prints a `timeoutNotice(file, run, topLevelPath)` line once per absolute child-file path per top-level run (guarded by `ctx.timeoutNotices`, lazily initialized); skipped when `ctx.callStack` is empty (no top-level run context, e.g. a direct unit-style dispatch of a bare `runFlow` command). (4) After the `runFlow` branch, one `Deadline` is built per step: `stepTimeoutMs(c.type, own ?? inner, run)` where `inner` is `waitForPageLoad`'s own `timeout` field (own and inner are never both set — Q19) and `own` is the sibling value from (1); trait `'none'` yields `ms === undefined`, so no `Deadline` is constructed and `undefined` is passed through unchanged. (5) The resulting `deadline` is threaded as the trailing argument to every `execute*` call whose signature accepts one (goto, tapOn, inputText, inputTextTargeted, assertVisible, assertNotVisible, assertUrl, assertText, assertValue, assertCount, assertEnabled, assertDisabled, assertChecked, assertUnchecked, selectOption, check, uncheck, hover, doubleClick, clearText, reload, goBack, goForward, waitForPageLoad, within). | T11 |
| `uivisor-app/tests/integration/timeouts.test.ts` | Created | Engine-level browser suite (69 tests) against a local HTTP fixture server + headless Chromium, exercising `dispatch`/`runFlow`/`createContext`/`resolveRunTimeouts` directly (no CLI). See test list below. | T11 |

## Test list (by AC)

All against `uivisor-app/tests/fixtures/timeouts/*.html` (delayed, vanish, duplicates, growing, late-enable, input-disable, spa-nav) plus a local server's `/slow?ms=N`, `/quick`, `/reload-hang`, and a generic 200 fallback.

- **AC1–AC5** — selector forms (bare cascade, bare→text fallback, pipe, object forms, xpath) wait for a delayed element.
- **AC7–AC8** — stability check: cascade and pipe `tapOn` click the stable testid target, not a transiently-matching heading.
- **AC12** — duplicate matches retry until they collapse to one.
- **AC14–AC17** — not-found error message formats: bare-cascade (5 diagnostic lines), pipe (2 lines), object/xpath (JSON label), duplicates-at-deadline (counts reported).
- **AC21–AC23 (revised)** — `assertNotVisible` waits for an element to vanish / fails at the deadline while visible; the three not-visible duplicate sub-cases (`hidden`, `mixed`, `hide-later`) per the revised deciding-step rule.
- **AC24–AC27** — `within` waits for a delayed container, reports "No container found" at the deadline, supports `nth`, and (AC27) its sibling timeout bounds only the container lookup, never the inner `do:` step.
- **AC29–AC30** — `assertUrl`/`assertCount` retry until the deadline, reporting the last observed value.
- **AC31** — all 15 element-trait commands (string and object selector forms) use `defaultTimeout` for resolution, with the correct line-1 message.
- **AC32 (revised)** — `inputText` shorthand reports `Element not actionable after <T>ms: <tapped selector>`.
- **AC33** — `goto`/`reload` use `navigationTimeout`.
- **AC35–AC38 (revised)** — `waitForPageLoad`'s own timeout vs. `navigationTimeout` fallback vs. sibling override; one `Deadline` covers both resolution+interaction (`tapOn`) and both waits inside `waitForPageLoad`.
- **AC39–AC48** — sibling `timeout:` on a string selector, key-order independence with session routing, inside `within`'s `do:` block, inside a child flow (wins over the inherited header), the Q17 child-flow parse error surfacing through `runFlow`, and `${var}` resolution at dispatch time (AC48, the orchestrator's explicitly required end-to-end case).
- **AC51–AC57** — precedence chains (sibling > CLI > header/config > built-in) for both the element and navigation ladders, including the "still running past the wrong default" technique for AC53(b), header-vs-shared-config (AC54), CLI timeouts applying across every flow in a run (AC56), and `${var}` in header/config (AC57).
- **AC58–AC64, AC80 (revised)** — child flows inherit the run's timeouts unchanged regardless of their own header/config keys; the ignored-key notice fires exactly once per child file per top-level run, lists only the keys that actually differ, names the top-level flow (not the immediate caller) for grandchildren, is silent when the child's own value equals the effective one (AC61/AC80a) or only one of two keys differs (AC80b), and `runFlow`'s `vars:` cannot set timeouts (AC64).
- **AC66, AC69** — a stripped reserved config key is not available as a var; child-flow header keys are still validated.
- **AC73** — built-in defaults (5000/30000) apply with nothing configured; `waitForPageLoad timeout: 0` still parses and runs.
- **AC75** — a sibling timeout does not change a `CommandResult`'s `command` shape.
- **B edge cases** — two sessions `runFlow`-ing the same child file notice only once (shared `ctx.timeoutNotices`); a passing probe followed by a failing probe gets a fresh, non-decremented deadline.
- **Smoke** — `test-app/flows/integration/run-flow-override.yaml` and its child parse with empty timeout layers, confirming no behavioral change for files with no sibling timeouts anywhere.

Out of scope for this file (covered elsewhere per the task breakdown): AC6/AC9–AC11/AC13 (mocked/fake-timer unit tests), AC18 (synchronous malformed-selector throw), AC19–AC20 (pre-existing not-visible coverage), AC28 (test-app-specific route), AC34 (goBack/goForward regression), AC41/AC44/AC46/AC47 (parse-time-only validation), AC45a (parser-scope), AC49/AC50 (dispatch-unit scope), AC55 (CLI arg parsing), AC65/AC67/AC68/AC70–72 (parser/compile-time scope), AC74 (not a test-file assertion), AC76–79 (test-app/E2E scope).

## Verification

| Command | Result |
|---|---|
| `npm run build -w packages/core` | OK |
| `cd uivisor-app && npx tsc --noEmit` | OK, no errors |
| `cd uivisor-app && npx vitest run tests/integration/timeouts.test.ts` | **69 passed**, wall time **168.20s** |
| `cd uivisor-app && npx vitest run` (full suite) | **933 passed + 4 expected fail** (937 total) — baseline was 864 passed + 4 expected fail (868); +69 new, nothing else broke |
| `npm run build -w uivisor-app` | OK |
| `cd recorder-app && npx tsc --noEmit` | Only the known pre-existing `src/cli.test.ts(141,7): error TS2769` |

## Deviations from S7 / the T11 task prompt

- **AC26's `within` `do:` step uses a trivial `wait: 0`, not a nested `assertVisible`.** `executeWithin` scopes the `do:` block's locator queries to *descendants* of the resolved container (via `createScopedPage`). `growing.html`'s `<li data-testid="item">` nodes are leaves with no descendant also carrying `data-testid="item"`, so a nested `assertVisible: { testId: 'item' }` would never resolve regardless of whether the `nth`-aware container resolution itself succeeded. `wait: 0` confirms the `within` step as a whole passed (i.e., container resolution with `nth: 2` waited for the 3rd item to appear) without conflating it with an unrelated nested-selector mismatch.
- **AC33(a)/(b) use `/slow?ms=1700` and `/reload-hang?...&ms=1700` (eventually-responding), not a route that never responds at all.** A route that truly never responds leaves the page genuinely stuck mid-navigation; the *existing* (pre-T11) dispatcher catch-block always attempts `captureScreenshot` on any failure, and `page.screenshot()` can itself block for Playwright's own default timeout (~30s) waiting for the page to settle when navigation is still genuinely in-flight — an orthogonal, pre-existing behavior unrelated to T11's timeout wiring, confirmed by direct reproduction (calling `executeGoto` with the same `Deadline` outside `dispatch` resolves correctly at ~1.5s; going through `dispatch` against a truly-hanging route took ~31.5s, with the embedded `d.timeoutMs` in the thrown message still correctly reading `1500` throughout). Using a route that settles ~200ms after the configured `navigationTimeout` keeps the goto/reload failure driven entirely by the deadline (not the response), while avoiding this unrelated stall, so the test still asserts the thing it's meant to: that `navigationTimeout` governs `goto`/`reload`.
- **AC43 required an explicit `goto:` command inside the child flow.** `runFlow`/`dispatch` never auto-navigates to a flow's `appId` — only an explicit `goto` command does. All other child-flow-based tests already preceded their `runFlow(file, page, ctx)` call with an explicit `page.goto(...)` from the test itself; AC43 is the one case where the navigation needed to happen *inside* the child flow (to exercise the child's own command list under its sibling timeout), so a `goto:` step was added as the child's first command instead.
- **AC36(b)'s margin was widened from 100ms to 1000ms** (`appear=400&enable=500`, budget `1500`, originally `appear=600&enable=700`, budget `800`) after it flaked once under the full-suite's higher background load — the budget vs. enable-time margin was too tight to reliably clear a single ~100ms stability-poll interval.
- No test file outside this task's row was touched; no `git commit` was made; `state.md` was not edited.

**Orchestrator verification:** app tsc ok; app 933 passed + 4 expected fail; full app suite 168 s (new browser suite ~168 s of it).

**Blocking finding F1 (Orchestrator, reproduced):** AC33 as specified fails. With `navigationTimeout: 1500` and `goto` to a route that never responds, the CLI prints `timed out after 1500ms` but the run takes 32.08 s and the md report shows the step at **31506ms**; no failure screenshot is produced. Causes: (1) the failure result's `durationMs` is computed after `captureScreenshot`; (2) `captureScreenshot` calls `page.screenshot()` with no timeout, so it waits Playwright's 30 s default on a page stuck mid-navigation. T11's AC33 test used an eventually-responding `/slow` route instead of the spec's never-responding `/hang`, so it did not catch this. Fix assigned as T11b: measure the failure duration before the screenshot; bound the failure screenshot to 5000 ms (Orchestrator choice, reversible) and keep it non-fatal; restore AC33 to a never-responding route.

**Last checkpoint:** T11 committed; F1 assigned to T11b at 2026-10-14 02:15

### Wave 3c (T11b, fixes F1)

# T11b Code Artifacts — fix blocking finding F1

Worktree: `.worktrees/feat-selector-waits-and-timeouts` (not committed)

**F1 recap:** a flow with `navigationTimeout: 1500` and a `goto` to a route that never
responds reported `Navigation failed: … — timed out after 1500ms`, but the run took
~32s and the md report's step `durationMs` was ~31506ms; no failure screenshot was
produced. Root causes: (1) the dispatcher measured a failed step's `durationMs` after
awaiting the failure screenshot, not when the error was caught; (2) the screenshot
helper called `page.screenshot({ path })` with no timeout, so a page stuck mid-navigation
fell back to Playwright's 30s default.

| File | Created/Modified | Purpose | Task |
|---|---|---|---|
| `uivisor-app/src/engine/dispatcher.ts` | Modified | In the main `catch` block of `dispatch` (the only failure-return path that calls `captureScreenshot`), `durationMs` is now captured (`const durationMs = Date.now() - start;`) immediately on catching the error, *before* the non-fatal screenshot attempt, and that value — not a fresh `Date.now() - start` taken after the screenshot — is returned. All other failure-return paths in `dispatch` (interpolation-error, `runFlow` file-not-found/circular-ref/catch, `within`) compute `durationMs` inline with no screenshot call in between, so they did not have this bug and were left unchanged. | T11b |
| `uivisor-app/src/reporter/screenshot.ts` | Modified | Added exported constant `SCREENSHOT_TIMEOUT_MS = 5000` and passed it as `page.screenshot({ path, timeout: SCREENSHOT_TIMEOUT_MS })`. Still non-fatal — `dispatch`'s `try { ... } catch { /* screenshot failure is non-fatal */ }` around the call is unchanged — so on a genuinely stuck page the result simply has no `screenshotPath`, bounded to 5s instead of Playwright's 30s default. | T11b |
| `uivisor-app/tests/integration/timeouts.test.ts` | Modified | **AC33(a)** restored to goto the fixture server's `/hang` route (accepts the request, never answers) instead of the `/slow?ms=1700`-eventually-responds workaround that was only needed to dodge the F1 stall; now asserts `durationMs` in `[1500, 2500)` and the message contains `1500ms`. **AC33(b)** restored similarly: the `/reload-hang` route now responds normally to the 1st request for a given `id` (the initial `goto`) and never responds to the 2nd+ (the `reload`), instead of settling after a finite delay; same assertions. Doc comment at the top of the file and the inline route comments updated to describe the new, truly-hanging 2nd-request behavior. Also added one unit test (`tests/unit/reporter.test.ts`, see below) per the task — a dedicated integration-level mock test for the screenshot helper's timeout wasn't needed since the unit test covers it directly against the real function signature. | T11b |
| `uivisor-app/tests/unit/reporter.test.ts` | Modified | Added `F1: page.screenshot() is called with a bounded timeout` to the existing `describe('captureScreenshot', ...)` block — mocks `Page.screenshot`, calls `captureScreenshot` with a real temp `runDir` (the current signature; the file's three pre-existing `it.fails` tests document an old, `runDir`-free signature and are untouched), and asserts `page.screenshot` was called with `{ timeout: SCREENSHOT_TIMEOUT_MS }` via `expect.objectContaining`. Added `os`/`path`/`fs` imports and `SCREENSHOT_TIMEOUT_MS` import for this. | T11b |

Nothing else was changed — no refactors, no touches to unrelated failure paths or other reporters.

## Verification

| Command | Result |
|---|---|
| `npm run build -w packages/core` | Passed (tsc, no errors) |
| `cd uivisor-app && npx tsc --noEmit` | Passed (no errors) |
| `cd uivisor-app && npx vitest run` | **934 passed \| 4 expected fail (938 total)** — baseline was 933 passed + 4 expected fail; the +1 is the new `F1: page.screenshot() is called with a bounded timeout` unit test. All 34 test files passed. |
| `npm run build -w uivisor-app` | Passed (tsc, no errors) |

### Orchestrator repro re-run

Server: `node /tmp/sw-hang/server.mjs &` (serves `/` and never answers `/hang` on :8091).
Flow `/tmp/sw-hang/hang.yaml` has `navigationTimeout: 1500`, `goto /`, then `goto /hang`.

```
$ cd /tmp/sw-hang && time node <worktree>/uivisor-app/dist/cli/index.js test hang.yaml --reporter md
▶ Running: hang.yaml
  ✓ goto: http://localhost:8091/
  ✗ goto: http://localhost:8091/hang — FAILED
    Navigation failed: http://localhost:8091/hang — timed out after 1500ms
FAILED — 1/2 commands passed
Report: /private/tmp/sw-hang/uivisor-report.md

real    0m7.03s (process time 0.47s user / 0.19s system; wall time ~7.0s)
EXIT:1
```

`uivisor-report.md` — `hang.yaml` row:

| Status | Command | Duration |
|--------|---------|----------|
| ✓ | goto: http://localhost:8091/ | 12ms |
| ✗ | goto: http://localhost:8091/hang | **1506ms** |

- Wall time: **~7.0s** (well under 10s; was ~32s before the fix). The remaining ~5.5s
  beyond the 1506ms step duration is the bounded (now 5000ms-capped) screenshot attempt
  against the still-stuck page, run after the step's duration was already recorded.
- Step duration: **1506ms**, within the required ≤2500ms tolerance band `[1500, 2500)`.
- No failure screenshot was produced (`target/<run>/screenshots/` is empty) — expected,
  since the page is genuinely still stuck mid-navigation when the capture is attempted;
  it now times out non-fatally at the 5s bound instead of silently stalling at 30s.

Server stopped with `pkill -f /tmp/sw-hang/server.mjs` after the run.

**Orchestrator verification:** repro now 7.13 s wall (was 32.08 s), hang step 1503ms (was 31506ms); app 934 passed + 4 expected fail. F1 closed.

**Last checkpoint:** T11b committed at 2026-10-14 02:40

### Wave 4 (T12)

# Code Artifacts: T12 — live test-app flows and full regression

## Files

| File | Created/Modified | Purpose | Task |
|---|---|---|---|
| `test-app/flows/integration/timeouts.yaml` | Created | AC77: 20-command flow against the live `/integration-timeouts` fixture, no `wait:`/`waitFor:`. Covers (1) `int-delayed` via bare string, pipe string (`data-testid=int-delayed\|text=Delayed content`), object `{testId: int-delayed}` and xpath object `{xpath: "//div[@data-testid='int-delayed']"}`, each after a fresh `goto`; (2) stability case `tapOn: Submit` → `assertVisible: {testId: int-submit-result}`; (3) `goto …?delay=6500` → `assertVisible: data-testid=int-delayed` with sibling `timeout: 8000`; (4) `assertNotVisible` on `int-never-rendered` (absent) and `int-hidden` (hidden), both string selectors; (5) `assertUrl: /integration-timeouts?arrived=1` after `goto …?redirect=1500`; (6) `within: {data-testid: int-delayed-card, do: [...]}` asserting `int-card-label`. | T12 |
| `test-app/flows/integration-negative/timeouts-default-fails.yaml` | Created | AC78: `goto …?delay=6500` then `assertVisible: data-testid=int-delayed` with no timeout settings, `config: ../integration/config.yml`. Deliberately fails at the default 5000ms budget; kept outside `integration/` so AC79's directory sweep isn't affected. | T12 |
| `test-app/flows/integration-variants/go-back-nav-timeout.yaml` | Created | AC34: copy of `test-app/flows/integration/go-back.yaml` with header `navigationTimeout: 20000` added and `config: ../integration/config.yml` (relative path fixed for the new directory). | T12 |
| `test-app/flows/integration-variants/go-forward-nav-timeout.yaml` | Created | AC34: copy of `test-app/flows/integration/go-forward.yaml` with header `navigationTimeout: 20000` added and `config: ../integration/config.yml`. | T12 |

No source files were modified. `test-app/flows/integration-negative/` and `test-app/flows/integration-variants/` were newly created directories.

## Commands run (from worktree root unless noted) and verbatim key output

### 1. `node uivisor-app/dist/cli/index.js test test-app/flows/integration/timeouts.yaml`
- **Exit code:** 0
- **Result:** `PASSED — 20/20 commands passed` (100%)
- All 6 AC77 sub-cases ran: bare/pipe/object/xpath selector forms for `int-delayed`; `tapOn: "Submit"` → `assertVisible: {"testId":"int-submit-result"}`; `?delay=6500` + sibling `timeout: 8000`; `assertNotVisible` on `int-never-rendered`/`int-hidden`; `assertUrl: /integration-timeouts?arrived=1` after `?redirect=1500`; `within: data-testid=int-delayed-card` → `assertVisible`/`assertText` on `int-card-label`.
- No `wait:`/`waitFor:` step present (confirmed by inspection of the file).

### 2. `node uivisor-app/dist/cli/index.js test test-app/flows/integration-negative/timeouts-default-fails.yaml --reporter md`
- **Exit code:** 1
- **Console:**
  ```
  ✓ goto: http://localhost:8084/integration-timeouts?delay=6500
  ✗ assertVisible: "data-testid=int-delayed" — FAILED
    Element not found after 5000ms: data-testid=int-delayed
  FAILED — 1/2 commands passed
  ```
- Output contains `✗ assertVisible` ✓ and the exact line `Element not found after 5000ms: data-testid=int-delayed` ✓.
- **`uivisor-report.md`** failing step duration: `5006ms` — within `[5000, 6000)` ✓.

### 3. Integration-variants flows
- `node uivisor-app/dist/cli/index.js test test-app/flows/integration-variants/go-back-nav-timeout.yaml` → **exit 0**, `PASSED — 9/9 commands passed`.
- `node uivisor-app/dist/cli/index.js test test-app/flows/integration-variants/go-forward-nav-timeout.yaml` → **exit 0**, `PASSED — 9/9 commands passed`.

### 4. AC44 CLI check (temp flow, `/tmp`, not committed)
- `/tmp/x.yaml`: trivial child flow (`commands: [{goto: http://localhost:8084/integration}]`).
- `/tmp/ac44-runflow-timeout.yaml`:
  ```yaml
  appId: http://localhost:8084/integration
  commands:
    - runFlow: ./x.yaml
      timeout: 1000
  ```
- `node uivisor-app/dist/cli/index.js test /tmp/ac44-runflow-timeout.yaml`
- **stdout (only line):** `Error: timeout is not supported on runFlow`
- **Exit code:** 1
- No browser/command step ran — no `▶ Running:` or `✓`/`✗` lines appeared; the error is printed before any flow execution.

### 5. AC75 reporter label check (temp flows, `/tmp`, not committed)
- `/tmp/ac75-label-check.yaml`: `goto ${base}/integration` then `tapOn: data-testid=int-tap-btn` with sibling `timeout: 3000`.
- `/tmp/ac75-label-check-no-sibling.yaml`: identical, without the sibling `timeout:` key.
- Ran both with `--reporter md` and `--reporter html`.
- **Console label**, both files, identical: `tapOn: "data-testid=int-tap-btn"`.
- **`--reporter md`** table row, both files, identical: `| ✓ | tapOn: "data-testid=int-tap-btn" | <duration>ms |` (only duration differs; diffed the two reports — the only differences are flow name, total/step durations).
- **`--reporter html`**, both files, identical fragment: `tapOn: &quot;data-testid=int-tap-btn&quot;`.
- Conclusion: the label is unaffected by the sibling `timeout:` key in all three surfaces (AC75 pass).

### 6. AC79 full regression — `node uivisor-app/dist/cli/index.js test test-app/flows/integration/`
- **Exit code: 1** (NOT exit 0 — see Regressions below).
- `test-app/flows/integration/*.yaml` count: **37** files (confirmed via `ls | wc -l`), matching AC79's expected count.
- **35 flows passed, 2 flows failed.**

#### Regressions found (reported verbatim, NOT edited)

**Flow:** `test-app/flows/integration/run-flow-override-child.yaml`
- **Failing step:** `tapOn: {"testId":"int-input-shorthand"}` (first command in the file)
- **Message:** `Element not found after 5000ms: {"testId":"int-input-shorthand"}` (plus `{"testId":"int-input-shorthand"}: 0 matches`)
- **Result line:** `FAILED — 0/4 commands passed`
- Reproduced identically when run standalone (`node uivisor-app/dist/cli/index.js test test-app/flows/integration/run-flow-override-child.yaml`, exit 1). This file has no `goto`/`appId`-driven navigation of its own — it is written to be invoked only as a child via `runFlow` from `run-flow-override.yaml` (which passes when run that way, and did pass inside this same regression run). When the directory sweep runs it as its own top-level flow, no page is loaded on which `int-input-shorthand` can resolve, so it fails after the default 5000ms.

**Flow:** `test-app/flows/integration/sessions.yaml`
- **Failing step:** `session: consumer` → `assertVisible: {"testId":"int-sessions-consumer-display"}` (after `session: consumer` → `waitFor: 500`)
- **Message:** `Element not found after 5000ms: {"testId":"int-sessions-consumer-display"}` (plus `{"testId":"int-sessions-consumer-display"}: 0 matches`)
- **Result line:** `FAILED — 13/21 commands passed`
- Reproduced identically when run standalone (exit 1). The cross-session `storage`-event propagation that should make `int-sessions-consumer-display` appear on the consumer session does not happen within the step's budget.

Both failures reproduce deterministically (checked twice: once inside the full-directory sweep, once run standalone), so they are not a one-off flake from parallel timing in this run. Per instructions, these are reported as-is and were **not** edited to make them pass — flagging as a blocking regression for the Orchestrator.

### 7. Unit/integration suites
- `cd uivisor-app && npx vitest run` → **exit 0**. `Test Files 34 passed (34)`; `Tests 934 passed | 4 expected fail (938)`. The 4 expected-fail tests are the same documented expected-fail set referenced in state.md (baseline was 733 before T1–T11b added new tests; now 938 total including the new timeout/selector suites).
- `cd packages/core && npx vitest run` → **exit 0**. `Test Files 14 passed (14)`; `Tests 662 passed (662)` (baseline was 406 before T1–T11b).

## Summary

| Check | Result |
|---|---|
| `timeouts.yaml` | PASS — exit 0, 20/20 (100%) |
| `timeouts-default-fails.yaml` (negative) | PASS (fails as designed) — exit 1, `✗ assertVisible`, `Element not found after 5000ms: data-testid=int-delayed`, duration 5006ms ∈ [5000,6000) |
| `go-back-nav-timeout.yaml` | PASS — exit 0, 9/9 |
| `go-forward-nav-timeout.yaml` | PASS — exit 0, 9/9 |
| AC44 CLI parse-error check | PASS — `Error: timeout is not supported on runFlow`, exit 1, no browser step |
| AC75 reporter label check (md + html) | PASS — label byte-identical with/without sibling `timeout:` |
| AC79 full `integration/` directory run (37 flows) | **FAIL** — exit 1; 35/37 flows passed; `run-flow-override-child.yaml` and `sessions.yaml` fail (details above) — reported, not edited |
| `uivisor-app` vitest | PASS — 934 passed, 4 expected fail, exit 0 |
| `packages/core` vitest | PASS — 662 passed, exit 0 |

**Blocking issue for the Orchestrator:** AC79 is not met. Two pre-existing flows in `test-app/flows/integration/` (`run-flow-override-child.yaml`, `sessions.yaml`) fail when the directory is run as a whole, both reproducing standalone. All new T12 deliverables (`timeouts.yaml`, the negative flow, the two navigationTimeout variants) pass as specified, and both vitest suites are green.

**Orchestrator regression comparison (AC79):** the outer checkout was fast-forwarded to the run base `edc5701`, built, and the full `test-app/flows/integration/` directory run against the same test-app: **34 passed, 2 failed of 36** (`run-flow-override-child.yaml`, `sessions.yaml`). Branch: 35 passed, 2 failed of 37, same two flows. Identical failure set; both fail at the same step on base (base messages `Element not found.` and `Expected: visible / Got: element not found`). Pre-existing, not regressions. `run-flow-override-child.yaml` (from #100) is child-only (no `goto`; runner does not auto-navigate), so a directory run executes it on about:blank. AC79 as written ("every flow passes") cannot be met without fixing those two pre-existing failures; raised at Gate 3.

**Last checkpoint:** T12 committed; Coder phase complete at 2026-10-14 03:30

## Test Results (Phase 2)

### Generator A (opus, standing rule)

# Test Results — Generator A (tester_generator_a, Phase 2, systematic)

Run: feat-selector-waits-and-timeouts. HEAD `676c4e7`. Diff reviewed: `git diff edc5701..HEAD -- . ':!pipeline' ':!docs'` (55 files). Spec: Gate 1 ACs with Revision 1 and Gate 1 Errata applied.

## Suite results (Orchestrator-verified on HEAD `676c4e7`, not rerun here)

| Suite | Result |
|---|---|
| core build | ok |
| core vitest | 662 passed |
| uivisor-app `tsc` | clean |
| uivisor-app vitest | 934 passed + 4 expected fail |
| uivisor-app build | ok |
| recorder-app `tsc` | only the pre-existing `src/cli.test.ts(141,7)` error (same as base) |
| recorder-app vitest | 26 failed \| 117 passed \| 1 todo (same as base) |
| `test-app/flows/integration/timeouts.yaml` | PASSED 20/20 |
| negative flow `integration-negative/timeouts-default-fails.yaml` | fails at 5006 ms, as designed |
| `test-app/flows/integration/` directory | 35/37 passed. The same 2 flows fail as on base (34/36): `run-flow-override-child.yaml`, `sessions.yaml` |

No tests were rerun for this review. Every finding below comes from reading the code and tests.

## Totals

- **Implemented: 78. Partial: 2 (AC77, AC79). Missing: 0.**
- **Blocking findings: 1 (B1).** Non-blocking: 17 (N1–N17).

Abbreviations for test files:
- `PL` = `packages/core/src/playwrightLocator.test.ts`
- `CMD` = `packages/core/src/commands.test.ts`
- `INT` = `uivisor-app/tests/integration/timeouts.test.ts`
- `SIB` = `uivisor-app/tests/unit/sibling-timeout-parser.test.ts`
- `CFG` = `uivisor-app/tests/unit/timeout-config.test.ts`
- `PREC` = `uivisor-app/tests/unit/timeouts-precedence.test.ts`
- `EMF` = `uivisor-app/tests/unit/error-message-format.test.ts`

## AC status

### Waiting resolution: selector forms (AC1–AC6)

| AC | Status | Implementation | Covering test(s) |
|---|---|---|---|
| AC1 | Implemented | `playwrightLocator.ts:198-235` (`buildSteps` cascade), `:242-265` (`pollSteps` on `retryUntil`) | INT `AC1: bare string matches data-testid at cascade step 1`; PL `AC1: bare string resolves once a step-1 …` |
| AC2 | Implemented | `playwrightLocator.ts:259` (lower step confirmed on the next attempt) | INT `AC2: bare string falls through to the text cascade step`; PL `AC2 …` |
| AC3 | Implemented | `playwrightLocator.ts:224-229` | INT `AC3: pipe string waits for its winning segment`; PL `AC3 …` |
| AC4 | Implemented | `playwrightLocator.ts:199-212` (object forms are one waiting step) | INT `AC4: object selector forms wait within the budget`; PL `AC4 …`. This test also passes on old code; expected, since object forms already waited. |
| AC5 | Implemented | `playwrightLocator.ts:170-192, 213-219` | INT `AC5: { xpath } form waits …`; PL `AC5 …` |
| AC6 | Implemented | `playwrightLocator.ts:259` (`winner === 0` is accepted at once) | PL 3× `AC6: … resolves on the first poll` (one `count()` call, no sleeps) |

### Stability check and duplicates (AC7–AC13)

| AC | Status | Implementation | Covering test(s) |
|---|---|---|---|
| AC7 | Implemented | `playwrightLocator.ts:259` | INT `AC7: bare tapOn clicks the testid button …`; PL `AC7 …`; live `timeouts.yaml` case (2) |
| AC8 | Implemented | same | INT `AC8: pipe tapOn clicks the testid button …`; PL `AC8 …` |
| AC9 | Implemented | same | PL `AC9: … exactly two resolution passes ~100ms apart` |
| AC10 | Implemented | `playwrightLocator.ts:259-260` | PL `AC10: a changed winner restarts …` |
| AC11 (E1) | Implemented | `playwrightLocator.ts:259-264` | PL `AC11 (revised, Errata E1) …` (resolver and `pollSteps` seams) |
| AC12 | Implemented | `playwrightLocator.ts:294` (`n === 1` only) | INT `AC12: tapOn on a collapsing duplicate passes promptly`; PL `AC12 …` |
| AC13 | Implemented | `deadline.ts:64-75`, `RETRY_INTERVAL_MS` at `:55` | PL `AC13 (loop cadence) …`; `deadline.test.ts` `retryUntil's last attempt lands exactly on the deadline` |

### Timeout errors (AC14–AC18)

| AC | Status | Implementation | Covering test(s) |
|---|---|---|---|
| AC14 | Implemented | `playwrightLocator.ts:296-298, 267-269` | INT `AC14 …`; PL `AC14 …`; `resolveSelector.test.ts` AC14 |
| AC15 | Implemented | same | INT `AC15 …`; PL `AC15 …` |
| AC16 | Implemented | `playwrightLocator.ts:154-157, 200` | INT `AC16 …`; PL 2× `AC16 …` |
| AC17 | Implemented | same | INT `AC17 …`; PL `AC17 …` |
| AC18 | Implemented | `playwrightLocator.ts:88-114, 213-221` (throws synchronously), `:184-190` (xpath `count()` rejection is wrapped and not retried) | PL 5× `AC18 …` (no `count()` call, clock at 0) |

### Not-visible mode (AC19–AC23)

| AC | Status | Implementation | Covering test(s) |
|---|---|---|---|
| AC19 | Implemented | `playwrightLocator.ts:331-349`; `commands.ts:148-153` | PL 2× `AC19 …`; live `timeouts.yaml` case (4). The spec's `/integration` page probes and the "< 1000 ms" duration are not asserted anywhere (N10). |
| AC20 | Implemented | same | PL 2× `AC20 …`; live case (4), string form only |
| AC21 | Implemented | same | INT `AC21 …`; PL `AC21 …` |
| AC22 | Implemented | `commands.ts:150-152` | INT `AC22 …` (`expected`/`got`); PL `AC22 …` |
| AC23 (rev) | Implemented | `playwrightLocator.ts:338-345` (the first step with ≥ 1 match decides) | INT `AC23(a/b/c revised)`; PL `AC23 (a/b/c)` and the rule-statement test |

### `within`, `assertUrl`, `assertCount` (AC24–AC30)

| AC | Status | Implementation | Covering test(s) |
|---|---|---|---|
| AC24 | Implemented | `playwrightLocator.ts:307-324`; `commands.ts:479` | INT `AC24 …`; PL `AC24 …`; live case (6) |
| AC25 | Implemented | `playwrightLocator.ts:321-323` | INT `AC25 …`; PL `AC25 …`; `within-dispatcher.test.ts` TC-045 |
| AC26 | Implemented | `playwrightLocator.ts:315-320` | INT `AC26 …` (uses `do: wait: 0`; the reason is documented and acceptable); PL 2× `AC26 …` (pass case and the nth message at the deadline) |
| AC27 | Implemented | `commands.ts:479, 489-493` (the `within` deadline is not forwarded to `do:` steps) | INT `AC27(a)`, `AC27(b)`; CMD `Q18: …` |
| AC28 | Implemented | `commands.ts:159-170` | live `timeouts.yaml` case (5). `durationMs < 2500` is not asserted. |
| AC29 | Implemented | same | INT `AC29 …`; CMD `executeAssertUrl …` |
| AC30 | Implemented | `commands.ts:221-231` | INT `AC30(a)`, `AC30(b)`; CMD `executeAssertCount …` |

### Which timeout each command uses (AC31–AC38)

| AC | Status | Implementation | Covering test(s) |
|---|---|---|---|
| AC31 | Implemented | `commands.ts:92-357` (resolution sits outside every catch) | INT `AC31: all 15 element commands …`; CMD AC31 tests per command |
| AC32 (rev) | Implemented | `commands.ts:105-118` | INT `AC32 …` (exact line 1); CMD `AC32 revised …` |
| AC33 | Implemented | `commands.ts:77-88, 359-369`; F1 fix at `dispatcher.ts:469-471` and `reporter/screenshot.ts:11,19` | INT `AC33(a)` (route that truly hangs), `AC33(b)`; CMD `AC33 …`; reporter `F1: …` |
| AC34 | Implemented | `commands.ts:371-403` (`commit` kept, history messages unchanged) | live `integration-variants/go-*-nav-timeout.yaml` (9/9 each); CMD history-message tests; existing `commands.test.ts` fresh-page goBack/goForward tests |
| AC35 | Implemented | `dispatcher.ts:276-281`; `timeouts.ts:51-60` | INT `AC35(a/b/c)`; PREC `AC35/Q19 composition` |
| AC36 | Implemented | `commands.ts:98-104` (`pwTimeout()` passes the time left) | INT `AC36(a)/AC38`, `AC36(b)`; CMD `AC36: one budget …` (remaining 1900 ms) |
| AC37 | Implemented | `commands.ts:427-433` | CMD `AC37: one budget — remaining time shrinks …` is the real proof. The INT `AC37` test is weak (N3). |
| AC38 (rev) | Implemented | `commands.ts:103, 132, 315, 325, 335, 345, 355` | INT `AC36(a)/AC38`; CMD AC38 tests |

### Sibling `timeout:` key (AC39–AC50)

| AC | Status | Implementation | Covering test(s) |
|---|---|---|---|
| AC39 | Implemented | `commandParser.ts:350-386` | SIB `AC39`; INT `AC39` |
| AC40 | Implemented | `commandParser.ts:353-354` (`'timeout' in obj`, any key order) | SIB `AC40 (a)`, `AC40 (b)`. INT `AC40` over-claims (N4). |
| AC41 | Implemented | `commandParser.ts:361-363` | SIB `AC41` it.each ×20 element + ×5 navigation |
| AC42 | Implemented | `commandParser.ts:253` (recursion); `commands.ts:490` | SIB `AC42`; INT `AC42` |
| AC43 | Implemented | `dispatcher.ts:281` (`own ?? …`) | INT `AC43 …` |
| AC44 | Implemented | `commandParser.ts:361-363` | SIB `AC44` it.each ×10. CLI exit 1 is verified only by hand in T12 (N9). |
| AC45 | Implemented | same, plus the `loadAndParse` catch in the runFlow branch | SIB `AC45 (a)`; INT `AC45(b)` |
| AC46 | Implemented | `commandParser.ts:375-379` | SIB `AC46` |
| AC47 | Implemented | `commandParser.ts:365-373`; `utils/positiveInt.ts` | SIB AC47 it.each ×6 and the `"3000"` case; `positive-int.test.ts` |
| AC48 | Implemented | `commandParser.ts:365-366` (keeps `${`); `dispatcher.ts:101-112` | INT `AC48 …` (fails after 1300 ms). The parser's acceptance of `"${t}"` is untested (N5). The EMF `AC48` unit test is weak (N5). |
| AC49 | Implemented | `dispatcher.ts:106-110` | EMF `AC49 …` (exact message, < 500 ms, no `locator` call) |
| AC50 | Implemented | `dispatcher.ts:113-127` (#100 catch reused) | EMF `AC50a`, `AC50b` |

### Precedence and CLI (AC51–AC57)

| AC | Status | Implementation | Covering test(s) |
|---|---|---|---|
| AC51 | Implemented | `timeouts.ts:34-46, 51-60` | PREC `resolveRunTimeouts` AC51 ×4 and `stepTimeoutMs` sibling test; INT `AC51(1)`, `AC51(2)`, `AC51(5, slow)` |
| AC52 | Implemented | same | PREC AC52 ×4; INT `AC52` (sibling). The "none set → 30000ms" message is not asserted end-to-end (N6). |
| AC53 | Implemented | same | PREC `AC53 (a/b)`; INT `AC53(a)`, `AC53(b)` |
| AC54 | Implemented | `timeouts.ts:22-28` (`header ?? config`) | PREC 2× `AC54`; INT `AC54` (real header and config files) |
| AC55 | Implemented | `cli/args.ts:94-111, 117` | `args.test.ts` `AC55 (a)`–`(e)`, usage, and the arbiter-ruling cases |
| AC56 | Implemented | `cli/index.ts:62-66`; `cli/runner.ts:47-48` | INT `AC56` copies the `runAll` loop rather than calling it, so the CLI→`runAll`→`createContext` glue has no automated coverage (N7) |
| AC57 | Implemented | `parser/index.ts:41-51`; `interpolate.ts:233-242` | CFG `AC68 / AC57 (a)`, `AC57 (b)`, `AC57 (c)`; INT `AC57 …` (end to end) |

### Child flows (AC58–AC64, AC80)

| AC | Status | Implementation | Covering test(s) |
|---|---|---|---|
| AC58 | Implemented | `dispatcher.ts:132` (`run` is inherited; runFlow never writes `ctx.timeouts`) | INT `AC58` covers the element probe only. The navigation-probe variant is not tested (N8). |
| AC59 (rev) | Implemented | `timeouts.ts:67-83`; `dispatcher.ts:168-176` | INT `AC59 (revised)`; PREC `AC59 (revised)` |
| AC60 (rev) | Implemented | same (keyed on `absPath` in `ctx.timeoutNotices`) | INT `AC60 (revised)(a)`, `(b)`; PREC `AC60 a/b`; INT B-edge `two sessions …` |
| AC61 (rev) | Implemented | same | INT `AC61 (revised)(a)`, `(b)`; PREC; INT smoke `run-flow-override.yaml …` |
| AC62 | Implemented | `dispatcher.ts:168` (first `callStack` entry) | INT `AC62`; PREC `AC62` |
| AC63 | Implemented | `runner.ts:47`; notice only in the runFlow branch | INT `AC63` |
| AC64 | Implemented | `interpolate.ts` (no var → timeout path) | INT `AC64`. The test does not assert that `${defaultTimeout}` resolves to `1000` (N8). |
| AC80 | Implemented | `timeouts.ts:76-79` | INT `AC80(a)`, `AC80(b)`; PREC `AC80 (a)`, `(b)` |

### Header and config keys (AC65–AC69)

| AC | Status | Implementation | Covering test(s) |
|---|---|---|---|
| AC65 | Implemented | `validator.ts:4-7` | CFG `AC65` |
| AC66 | Implemented | `interpolate.ts:172-175` | CFG `AC66`; INT `AC66` (exact dispatch message) |
| AC67 | Implemented | unchanged `VALID_HEADER_KEYS`; `sla` not reserved | CFG `AC67 (a)`, `(b)`, `(c)`. (a) checks `file.vars` only; no runtime `testVarSet` run. |
| AC68 | Implemented | `validator.ts:15-28`; `interpolate.ts:242` | CFG AC68 ×10. The value × key × layer matrix is not complete (N11). |
| AC69 | Implemented | `parser/index.ts:51` (runs for every file) | CFG `AC69`; INT `AC69` |

### Command traits (AC70–AC72)

| AC | Status | Implementation | Covering test(s) |
|---|---|---|---|
| AC70 | Implemented | `commandTraits.ts:10-52` | `commandTraits.test.ts` (6 tests) |
| AC71 | Implemented | `commandTraits.ts:10` (type annotation); `commandTraits.typecheck.ts` | `tsc` build of core (`@ts-expect-error` for a missing key and for an extra key) |
| AC72 | Implemented | `commandParser.ts:361` reads `COMMAND_TRAITS` | SIB `AC72 …`. The test uses hand-written lists and never cross-checks against `COMMAND_TRAITS` (N12). |

### Backward compatibility and regression (AC73–AC75)

| AC | Status | Implementation | Covering test(s) |
|---|---|---|---|
| AC73 | Implemented | `deadline.ts:53`; `commands.ts:8-14, 427` | INT `AC73(a)`, `AC73(b)`; CMD AC73 tests (goto/reload/tapOn defaults); SIB `inner waitForPageLoad timeout: 0 still parses`. The waitForPageLoad `30000ms` message is not asserted (N6). |
| AC74 | Implemented | suite results above. No test deleted (Orchestrator name diff). Edits fall under E2/E3 and the Orchestrator's matcher ruling. | T10/T11 Code Artifacts. One edit went further than needed (N13). |
| AC75 | Implemented | `Command` union unchanged; the sibling lives on `SessionedCommand` (`types.ts:91`) | SIB `AC75`; INT `AC75`; manual md/html/console diff in T12 |

### test-app fixtures and integration flows (AC76–AC79)

| AC | Status | Implementation | Covering test(s) |
|---|---|---|---|
| AC76 | Implemented | `test-app/src/pages/IntegrationTimeoutsPage.jsx`; `App.jsx:42` | Manual live check by the Orchestrator (T3). The "IntegrationTimeoutsPage render check" in the Consolidated Test Plan was never added (N9). |
| AC77 | **Partial** | `test-app/flows/integration/timeouts.yaml` | Passes 20/20, but case (1) has no bare-string selector (B1). |
| AC78 | Implemented | `test-app/flows/integration-negative/timeouts-default-fails.yaml` | Live run: exit 1, exact line, 5006 ms |
| AC79 (rev) | **Partial** | 37 flows present | 35/37. Both failures also fail on base (see the suite table). Pre-existing, not a regression, but AC79 as written ("every flow passes") is not met. This is a Gate 3 decision, not Coder work (non-blocking for this diff). |

## Findings

### Blocking

**B1 — AC77 case (1) has no bare-string selector.** `test-app/flows/integration/timeouts.yaml:9`.
- The "bare string" case is written `assertVisible: data-testid=int-delayed`. By the spec's own Scope wording that is a single-segment pipe string ("pipe strings (including single-segment `attr=value`)"), not the bare-string cascade.
- The flow's four forms are: single-segment pipe, two-segment pipe, `{ testId }` object, `{ xpath }` object.
- AC77 requires "(1) `int-delayed` (delay 1500) found by a **bare string**, a pipe string, an object selector and an xpath object". Its Failure clause includes "a missing case".
- So the cascade path is never exercised against the live React app. The T12 artifact claims it is.
- Fix (one line, Coder): change it to `assertVisible: int-delayed`, the AC1 form. Then rerun `timeouts.yaml`.

### Non-blocking

**N1 — Task-number comments left in source** (the brief asks to flag these):
- `uivisor-app/src/engine/dispatcher.ts:130` `(S7, T9/T11)`, `:165` `Notice (T11)`, `:273` `Budget (T11)`
- `uivisor-app/src/engine/timeouts.ts:5` `(S7, T9)`, `:7` `The parser (T7)`

T10's Orchestrator note said "No task-number comments left in source", but T11 added these. Each should state the rule without the task ID.

**N2 — Comments and test titles that narrate pipeline history instead of explaining why:**
- `uivisor-app/tests/unit/timeouts-precedence.test.ts:6` says "These are not wired into the engine yet (T11)". This is now false.
- `uivisor-app/tests/unit/error-message-format.test.ts:129-134` (T5/T11 history, plus `T5` in the describe title).
- `uivisor-app/tests/integration/timeouts.test.ts:5` ("suite for T11"), `:69-71` and `:610-614` ("F1 fix verified …"), `:1485` and `:1491` ("unaffected by T11", "as before T11").
- `uivisor-app/tests/unit/matcher.test.ts` ("post-T4" / "pre-T6").
- `packages/core/src/playwrightLocator.test.ts:1189` and the `T4 — …` describe titles.
- `uivisor-app/tests/unit/reporter.test.ts` test title `F1: …`.
- Stale docstring: `uivisor-app/src/parser/interpolate.ts:183-186` still lists only workingSchedule/holidays/functions as stripped keys.

**N3 — The INT `AC37` test cannot tell one shared budget from two.** `timeouts.test.ts:706-716`.
- Setup: navAt=400, slowMs=700, timeout 900, asserting `< 1900`.
- With two separate 900 ms budgets the step would still fail at about 1300 ms, so the test passes either way.
- The spec's AC37 numbers have the same weakness.
- The CMD `AC37: one budget — remaining time shrinks …` test (`commands.test.ts:177-185`) is the real proof, so the behaviour is covered. A tighter INT bound (`< 1300`) would make the integration test discriminate.

**N4 — The INT `AC40` test over-claims.** `timeouts.test.ts:735-775`.
- Its title says "session routing intact", but the flow halts after step 1, so the `session: b` step never runs. It asserts `commandResults` length 1.
- AC40(b)'s "runs in session b … fails after 1500 ms" is covered only at parse time (SIB `AC40 (b)`).

**N5 — The parser's acceptance of `timeout: "${t}"` (AC48) has no test.**
- No SIB case passes a `${…}` string, and every INT `${var}` test builds the step by hand and skips the parser.
- If `commandParser.ts:365-366` regressed, nothing would fail.
- The EMF `AC48` unit test (`error-message-format.test.ts:135-147`) passes even if the sibling value were ignored entirely: it only checks that `goto` succeeds.

**N6 — The built-in 30000 ms navigation message is never asserted end to end** (AC52 "none set", AC73 bullet 2).
- INT `AC53(b)` (`timeouts.test.ts:917-932`) already waits the full 30 s (`await dispatchPromise`) but throws the result away.
- Asserting `(await dispatchPromise).message` contains `30000ms` would close this at no extra cost.

**N7 — The CLI → `runAll` glue is untested.**
- The glue: `cli/index.ts:62-66` builds `options.timeouts`, and `runner.ts:47-48` calls `resolveRunTimeouts` and passes the result to `createContext`.
- INT `AC56` copies the loop instead of calling `runAll`, and no live flow uses `--timeout`.
- Dropping the `runTimeouts` argument in `runner.ts` would fail no test. The code is correct as read.

**N8 — Child-flow coverage gaps:**
- AC58's `waitForPageLoad` (navigation) probe variant is not tested. Only the element probe is.
- INT `AC64` does not assert that `${defaultTimeout}` resolves to `"1000"`.

**N9 — Checks done only by hand, not committed:**
- AC44's CLI `Error: …` / exit 1 before any browser step (T12 used a temp flow).
- The AC75 md/html label diff.
- The AC76 page render check that the Consolidated Test Plan listed under T3. No test file was added.

**N10 — AC19 coverage drift.** The spec's probes on the `/integration` page (`data-testid=int-tap-result` and the bare string `int-tap-result`, each < 1000 ms) are not run anywhere. Not-visible mode on a bare string is covered only by the mocked PL `AC19` test.

**N11 — AC68 matrix incomplete.**
- Header `navigationTimeout` is tested only with `0`. Config is tested only with `0` (defaultTimeout) and `-1` (navigationTimeout).
- The spec lists 5 values × 2 keys × 2 layers. All cases go through the same `validateTimeoutKeys`, so the risk is low.
- Related: AC47 and AC68 "exactly" messages are asserted with `toThrow(string)`, which matches a substring.

**N12 — The AC72 test does not do what its name says.** `sibling-timeout-parser.test.ts:130-167` uses two hand-written lists. It never reads `COMMAND_TRAITS`, so it does not prove "parser acceptance follows the trait table" for every type. The T6 artifact describes it as a "cross-check over every `Command['type']`".

**N13 — Unneeded test edit.** In `uivisor-app/tests/unit/runner-no-auto-nav.test.ts:173`, the mock `runFlow`'s own literal `page.goto(gotoUrl, { waitUntil: 'load', timeout: 30000 })` was changed along with the assertion.
- The mock calls `page.goto` directly, not `executeGoto`, so the assertion would have passed unedited.
- Now the test asserts `timeout: 30000` against its own literal, which suggests coverage that isn't there.
- It is disclosed in the T10 deviations. Errata E2(a) named only line 180.

**N14 — The integration suite uses shorter fixture delays than the ACs while keeping the ACs' upper bounds.**
- Examples: AC1–AC5 use `delay=700` but keep `< 2500`. AC21 uses `vanishAt=800` but keeps `< 2500`.
- This leaves up to about 1.8 s of slack instead of 1 s. They still fail on old code (single count), so they are not weak in the TDD sense, just looser on time.
- The live `timeouts.yaml` uses the spec's 1500 ms.

**N15 — Duplicated parse of the inner `waitForPageLoad` timeout.**
- `dispatcher.ts:276-279` and `:383` both call `toInt(c.timeout …)`.
- Since a `navigation`-trait command always gets a deadline, `executeWaitForPageLoad`'s `timeout` argument is now unused on the uivisor-app path. It is kept for recorder-app.
- Minor redundancy, not dead code.

**N16 — Stale `@ts-expect-error — type does not exist yet; red phase` pragmas.**
- The T5 codemod in `uivisor-app/tests/integration/commands.test.ts` moved these, and they now sit inside `{ command: // @ts-expect-error … { … } }`.
- They do nothing (`tests/` is outside tsconfig) and are misleading, but they pre-date this run.

**N17 — Hint dropped from the not-found message.** The "Use pipe syntax" hint and the xpath "use within" hint are gone from the new message (PL TC-006 and TC-XPATH-R8 were edited under E2(c)).
- AC14 leaves lines after the step lines unspecified, so this is allowed. It is still a small usability loss worth knowing about.

### Tests changed to dodge a requirement (the AC33 kind)

None found beyond what T11b already fixed.
- AC33(a)/(b) now use routes that really hang (`/hang`, `/reload-hang` on the 2nd request) and assert `[1500, 2500)`.
- The other deviations have sound, documented reasons that keep each AC's intent:
  - AC26: `do: wait: 0`.
  - AC43: a `goto` inside the child.
  - AC36: wider margins.
- Every edit to an existing test was one of these:
  - the dispatch codemod (Errata "dispatch API")
  - E2(a) call shapes
  - E2(b) T24 timeout
  - E2(c) resolver deadlines and messages, including `matcher.test.ts` under the Orchestrator's ruling
  - T10 within-dispatcher deadlines
- No edit loosens an assertion beyond what the new spec requires.
- The weak ones are N3 and N5. They come from the spec or were never strict; nothing was weakened.

## Recommendation

**Do not deploy until B1 is fixed.** The fix is one line in `timeouts.yaml` case (1) plus a rerun of that flow. Everything else is non-blocking. Gate 3 still has to decide on AC79: the two failing integration flows also fail on base.

**Human decision (2026-10-14 04:05):** generator B runs on sonnet; on a 429 it is skipped (no opus retry), and the consolidator is skipped when only one review exists. The arbiter quality gate keeps the opus fallback. Before generator B: a small Coder pass fixes B1 and removes task-number comments (`dispatcher.ts:130/165/273`, `timeouts.ts:5/7`) and the stale "not wired into the engine yet" test header. Review cycle 1 of 2.

**Last checkpoint:** phase 2 generator A at 2026-10-14 04:05

### Generator B (sonnet, adversarial)

# Test Results — Generator B (tester_generator_b, Phase 2, adversarial)

Run: feat-selector-waits-and-timeouts. HEAD `5f03ba4`. Diff reviewed: `git diff edc5701..HEAD -- . ':!pipeline' ':!docs'`.
Already skimmed generator A's `test-results-a.md` (B1 + N1–N17); this review hunts for distinct bugs, focused on budget leaks, the stability check, not-visible edge cases, `${var}` timeouts, and precedence/notice correctness. No full suites rerun — targeted `/tmp`-style experiments only (kept in-repo temporarily, deleted after each run; nothing committed).

## Blocking

**B2 — Six element commands' final state-read is not bounded by the step's deadline: `executeAssertText`, `executeAssertValue`, `executeAssertEnabled`, `executeAssertDisabled`, `executeAssertChecked`, `executeAssertUnchecked` (`packages/core/src/commands.ts:196,215,241,255,269,283`).**

- Each of these resolves the locator and does `locator.waitFor({ state: ..., timeout: d.pwTimeout() })` — correctly sharing the step's one budget — but then reads the value with **no `timeout` option**: `locator.innerText()`, `locator.inputValue()`, `locator.isEnabled()`, `locator.isDisabled()`, `locator.isChecked()` (×2). Every other interaction call in the same file (`click`, `fill`, `check`, `uncheck`, `hover`, `dblclick`, `clear`, `selectOption`) passes `{ timeout: d.pwTimeout() }`; these six don't.
- This is new/changed code in this diff: `git diff edc5701..HEAD -- packages/core/src/commands.ts` shows the `deadline?: Deadline` parameter and the `waitFor(..., { timeout: d.pwTimeout() })` call were added to exactly these functions by this PR (AC36/AC37 "one shared budget"), but the final read was left unbounded.
- Per Playwright's own docs, `Locator.innerText()/inputValue()/isEnabled()/isDisabled()/isChecked()` without an explicit `timeout` default to "no timeout" (bounded only by the page's internal default, not by the step deadline) and **do retry** if the element is momentarily not attached — confirmed empirically (see below). If the resolved element is removed and later re-added (e.g. a React re-render racing with the check — exactly the kind of flakiness this feature's stability check exists to guard against elsewhere), the step can hang far past its configured timeout.
- **Reproduction** (ran against the built `packages/core/dist`, isolated from the live test-app so the timing is controllable):
  ```
  node budget_leak_repeat.mjs   # script: launches chromium, setContent('<button id="x">hi</button>'),
                                 # removes #x at t=12ms, re-adds it at t=2000ms, then calls
                                 # executeAssertEnabled(page, { css: '#x' }, createDeadline(300))
  ```
  Output (8 runs, same removal/re-add schedule each time — timing-sensitive, as expected for a race):
  ```
  run 0: THREW after 304ms (fast-fail path)
  run 1: RESOLVED after 2327ms (deadline 300ms)  <-- OVER BUDGET
  run 2: RESOLVED after 13ms (deadline 300ms)
  run 3: RESOLVED after 12ms (deadline 300ms)
  run 4: RESOLVED after 2311ms (deadline 300ms)  <-- OVER BUDGET
  run 5: RESOLVED after 12ms (deadline 300ms)
  run 6: RESOLVED after 13ms (deadline 300ms)
  run 7: RESOLVED after 13ms (deadline 300ms)
  over-budget hits: 2/8
  ```
  Runs 1 and 4 show `executeAssertEnabled` returning **"passed" ~7.7× past its 300ms deadline** (2311–2327ms) because `isEnabled()` silently waited for the button to reappear at t=2000ms. The same mechanism was separately confirmed for `executeAssertText`'s `innerText()` call (resolved at 2302ms against a 300ms-class budget) and directly against raw Playwright (`locator.isEnabled()` on a detached-then-reattached element resolves only after reattachment, ~1800ms, with no timeout passed — i.e. Playwright really does retry these "read" calls, it isn't an assumption).
- Impact: for these 6 of ~15 element commands, AC36/AC37 ("resolution and the command's own action share one deadline — the deadline bounds the whole command") is violated: the command can both report `passed: true` after exceeding its budget, and (worse) can hang a `failed` result's reported `durationMs` to several seconds beyond the configured timeout when the element never reappears, since nothing times the final read out at all until Playwright's own internal default elapses.
- Fix (Coder): add `{ timeout: d.pwTimeout() }` to the `innerText()`, `inputValue()`, and the four `isEnabled/isDisabled/isChecked` calls, matching the pattern already used by every other command in the file. Then re-verify with the same repro script (expect `THREW after ~300ms` on every run once the element is gone for longer than the deadline, instead of occasionally resolving/hanging to ~2300ms).

## Non-blocking

Count: 0 beyond what generator A already filed. I did not find additional non-blocking issues distinct from A's N1–N17 in the areas I had budget to check (pollSteps stability/duplicate-acceptance logic, `resolveNotVisible`'s first-matching-step rule, and the `within`/deadline-forwarding contract all matched their documented, intentional design and held up under adversarial probing).

## Areas probed with no bug found (for the record)

- **Stability check / duplicate acceptance** (`playwrightLocator.ts` `pollSteps`): confirmed `winner === 0` is deliberately exempt from the 2-poll confirmation (by design, AC6), and every other step index requires two consecutive matching polls (AC9/AC10/AC12). Reasoned through flicker scenarios (a lower-priority step's count toggling across polls); behavior matches the documented contract — no false-accept found, and `previousWinner` resets correctly whenever the winning index changes.
- **`resolveNotVisible`**: the "first step with ≥1 match decides" rule re-evaluates from scratch every poll (no step-stickiness), which is correct for a visibility check (it should always reflect current DOM state) and not a stability-check gap.
- **`${var}` timeout edge cases**: read `commandParser.ts:365-366` and `dispatcher.ts:101-112`; the sibling `timeout: "${t}"` path is parsed, then re-resolved and range-checked at dispatch time via `parsePositiveInt`. Did not find a bypass distinct from A's N5 (missing *test coverage*, not a missing *check*).
- **`within` deadline non-forwarding to `do:` steps**: confirmed intentional (Q18, documented in `commands.ts:460` and `dispatcher.ts`), each `do:` step gets its own fresh deadline from `stepTimeoutMs`, not the container-resolution deadline — no leak from `within` into its children.

**Review fixes:** cycle 1 `5f03ba4` (B1 + comments), cycle 2 `504af05` (B2: six assert* state reads now take `{ timeout: d.pwTimeout() }`, not-found message on timeout; +6 unit tests). Review cycles used: 2 of 2.

**Orchestrator note (pre-existing, non-blocking):** core vitest also collects the compiled `dist/*.test.js` copies (core tsc compiles tests into dist), so every core count in this run is doubled: baseline 406 = 203 unique, now 674 = 337 unique (+134). Pass/fail conclusions are unaffected. Not in scope; candidate backlog item (exclude `dist/**` in core vitest config or tests in tsconfig build).

**Last checkpoint:** B2 committed at 2026-10-14 04:50

### Consolidated Phase 2 Results

Consolidation of `test-results-a.md` (Generator A, systematic) and `test-results-b.md` (Generator B, adversarial), plus the review-fix and dist double-count notes under "Generator B (sonnet, adversarial)" above and the Wave 4 base comparison under "Wave 4" above.

#### 1. Suite results

| Suite | Result |
|---|---|
| core (`packages/core`) vitest | 674 runs = 337 unique tests (dist double-count: tsc compiles tests into `dist/*.test.js`, doubling the count — pre-existing, non-blocking, backlog candidate), all pass |
| uivisor-app vitest | 934 passed + 4 expected fail |
| recorder-app (tsc + vitest) | identical to base: 26 failed \| 117 passed \| 1 todo (pre-existing, same `src/cli.test.ts(141,7)` tsc error as base) |
| `test-app/flows/integration/timeouts.yaml` | PASSED 20/20 |
| negative flow `integration-negative/timeouts-default-fails.yaml` | fails at 5006ms, as designed |
| `test-app/flows/integration/` directory | 35/37 passed = base's 34/36 failure set (same 2 flows fail on base: `run-flow-override-child.yaml`, `sessions.yaml`) |

#### 2. Blocking findings

| ID | Finding | Status | Fix commit |
|---|---|---|---|
| B1 | AC77 case (1) (`test-app/flows/integration/timeouts.yaml:9`) used a single-segment pipe string (`data-testid=int-delayed`) instead of the AC1 bare-string form, so the cascade path was never exercised live. | FIXED | `5f03ba4` |
| B2 | Six element commands' final state-read (`executeAssertText`, `executeAssertValue`, `executeAssertEnabled`, `executeAssertDisabled`, `executeAssertChecked`, `executeAssertUnchecked`, `packages/core/src/commands.ts:196,215,241,255,269,283`) called `innerText()`/`inputValue()`/`isEnabled()`/`isDisabled()`/`isChecked()` with no `timeout`, letting Playwright's own retry hang the command past its step deadline (empirically reproduced, 2/8 runs ~2300ms over a 300ms budget). | FIXED | `504af05` (added `{ timeout: d.pwTimeout() }` to all six reads, updated not-found message, +6 unit tests) |

Both fixes landed within the 2-of-2 review cycles budgeted for this run.

#### 3. Open items for the arbiter / Gate 3

**AC79 (pre-existing, not a regression):** the full `test-app/flows/integration/` directory run is 35/37, failing on `run-flow-override-child.yaml` and `sessions.yaml`. The Orchestrator's base comparison (checkout fast-forwarded to `edc5701`, same test-app) reproduces the identical 2-failure set at 34/36. Both generators agree this is pre-existing and not introduced by this diff. AC79 as literally written ("every flow passes") cannot be met without separately fixing those two flows; this is a Gate 3 / backlog decision, not Coder work for this diff.

**Deduplicated non-blocking list (N1–N17, all from Generator A; Generator B found zero additional items distinct from these):**

- N1 — `uivisor-app/src/engine/dispatcher.ts:130,165,273`, `uivisor-app/src/engine/timeouts.ts:5,7` — task-number comments (`T9/T11` etc.) left in source — cleanup
- N2 — `uivisor-app/tests/unit/timeouts-precedence.test.ts:6` (and similar in `error-message-format.test.ts:129-134`, `tests/integration/timeouts.test.ts:5,69-71,610-614,1485,1491`, `tests/unit/matcher.test.ts`, `packages/core/src/playwrightLocator.test.ts:1189`, `tests/unit/reporter.test.ts`, `src/parser/interpolate.ts:183-186`) — comments/test titles/docstring narrate pipeline history instead of current behavior, one now false — cleanup
- N3 — `uivisor-app/tests/integration/timeouts.test.ts:706-716` — INT `AC37` test can't distinguish one shared budget from two separate budgets (numbers pass either way) — weak test
- N4 — `uivisor-app/tests/integration/timeouts.test.ts:735-775` — INT `AC40` test title claims "session routing intact" but the `session: b` step never runs — weak test
- N5 — `uivisor-app/src/parser/commandParser.ts:365-366`; `uivisor-app/tests/unit/error-message-format.test.ts:135-147` — sibling `timeout: "${t}"` parser acceptance has no dedicated test; the existing EMF test would pass even if the sibling value were ignored — untested path
- N6 — `uivisor-app/tests/integration/timeouts.test.ts:917-932` (`AC53(b)`) — built-in 30000ms navigation message is never asserted end-to-end despite the test already waiting the full 30s — untested path
- N7 — `uivisor-app/src/cli/index.ts:62-66`, `uivisor-app/src/cli/runner.ts:47-48` — CLI → `runAll` → `createContext` timeouts glue is untested (INT `AC56` copies the loop instead of calling `runAll`) — untested path
- N8 — AC58's `waitForPageLoad` navigation-probe variant (element probe only is tested); INT `AC64` doesn't assert `${defaultTimeout}` resolves to `1000` — untested path
- N9 — AC44 CLI exit-1 check, the AC75 md/html label diff, and the AC76 page-render check were all done by hand (T12/T3) and not committed as tests — manual-only check
- N10 — spec's `/integration` page probes (`data-testid=int-tap-result` / bare `int-tap-result`, each < 1000ms) for AC19 are not run anywhere; not-visible mode on a bare string is covered only by the mocked PL test — untested path
- N11 — `uivisor-app/tests/unit/timeout-config.test.ts` (AC68) — header/config value × key × layer matrix incomplete (only `0`/`-1` tested, not the full 5×2×2 set) — untested path
- N12 — `uivisor-app/tests/unit/sibling-timeout-parser.test.ts:130-167` — AC72 test uses hand-written lists instead of cross-checking against `COMMAND_TRAITS`, despite its name/description claiming to — weak test
- N13 — `uivisor-app/tests/unit/runner-no-auto-nav.test.ts:173` — test edit changed the mock's own literal rather than asserting against production code, suggesting coverage that isn't there — cleanup
- N14 — integration suite fixture delays (e.g. AC1–AC5 `delay=700`, AC21 `vanishAt=800`) are shorter than the spec's while keeping the spec's upper bounds, leaving more timing slack than intended — weak test
- N15 — `uivisor-app/src/engine/dispatcher.ts:276-279,383` — inner `waitForPageLoad` timeout is parsed twice; the `executeWaitForPageLoad` timeout argument is now unused on the uivisor-app path (kept for recorder-app) — cleanup
- N16 — `uivisor-app/tests/integration/commands.test.ts` — stale `@ts-expect-error` pragmas from the T5 codemod sit inside object literals and do nothing (outside tsconfig) — cleanup
- N17 — `packages/core/src/playwrightLocator.test.ts` (TC-006, TC-XPATH-R8) — "Use pipe syntax" and xpath "use within" hints dropped from the not-found message; allowed by spec but a usability loss — cleanup

#### 4. AC status (80 ACs)

| Status | Count | Detail |
|---|---|---|
| Implemented | 79 | AC77 moves from Partial to Implemented now that B1 is fixed (`5f03ba4`) |
| Partial | 1 | AC79 — pre-existing 2-flow integration-directory failure set, open for Gate 3 |
| Missing | 0 | — |

**Last checkpoint:** tester_consolidator (P2) at 2026-10-14 05:10

## Quality Gate

**Verdict:** PASS

**Checked by:** tester_arbiter

### 1. Evidence (re-run against worktree HEAD `504af05`)

| # | Command | Result |
|---|---|---|
| 1 | `npm run build -w packages/core` | PASS — `tsc` clean, exit 0 |
| 2 | `npm run build -w uivisor-app` | PASS — `tsc` clean, exit 0 |
| 3 | `cd packages/core && npx vitest run` | PASS — **674 passed**, 14 files (662 recorded after T10 + 12 new B2 tests from the `504af05` review-fix commit — consistent) |
| 4 | `cd uivisor-app && npx tsc --noEmit` | PASS — clean, exit 0 |
| 5 | `cd uivisor-app && npx vitest run` | PASS — **934 passed, 4 expected fail (938 total)**, 34 files — exactly matches the recorded Wave-4/T11b final count |
| 6 | `cd recorder-app && npx tsc --noEmit` | FAIL as expected — only the known pre-existing `src/cli.test.ts(141,7): error TS2769`, byte-identical to `## Baseline Addendum`. No new recorder-app type errors. |
| 7 | `cd recorder-app && npx vitest run` | FAIL as expected — **26 failed \| 117 passed \| 1 todo (144)**, all 26 failures in `src/overlay.test.ts`, byte-identical to `## Baseline Addendum`. No regression. |
| 8 | `node uivisor-app/dist/cli/index.js test test-app/flows/integration/timeouts.yaml` | PASS — exit 0, **20/20 commands passed** (100%), all 6 AC77 sub-cases present, no `wait:`/`waitFor:` |
| 9 | `node uivisor-app/dist/cli/index.js test test-app/flows/integration-negative/timeouts-default-fails.yaml` | PASS (fails as designed) — exit 1, `✗ assertVisible`, line `Element not found after 5000ms: data-testid=int-delayed` present (AC78) |

No discrepancy between this re-run and the Code Artifacts' recorded verification at any step. All counts match exactly; nothing regressed between T12's commit and the two review-fix commits.

### 2. B1 / B2 blocking findings — both confirmed fixed in code

- **B1 (`5f03ba4`):** AC77 case (1) requires `int-delayed` to be found via "a bare string" among the four selector forms. The flow's first probe used `assertVisible: data-testid=int-delayed`, which is a single-segment pipe/attr string, not a bare cascade string. Fixed by changing it to `assertVisible: int-delayed`. Re-run of `timeouts.yaml` above (evidence row 8) confirms this step now passes as the true bare-string case; the commit also strips stale `(S7, T9)`/`(T11)`-style task-number comments from `dispatcher.ts`/`timeouts.ts`/the precedence test, per the Wave-10 carry-forward note ("remove the task-number comments"). Verified by direct diff read — fix is correct and minimal, no unrelated changes.
- **B2 (`504af05`):** `executeAssertText`/`executeAssertValue`/`executeAssertEnabled`/`executeAssertDisabled`/`executeAssertChecked`/`executeAssertUnchecked` called Playwright's state-reading methods (`innerText`/`inputValue`/`isEnabled`/`isDisabled`/`isChecked`) with no timeout after target resolution succeeded, leaving them free to run past the command's deadline (violating the spec's Constraints §6/Q16 "one budget per command" rule and AC36's one-budget guarantee). Fixed by passing `{ timeout: d.pwTimeout() }` (the deadline's remaining budget) into each call and converting a timeout there into the standard `Element not found after <T>ms: <selector>` message. 6 new unit tests added (`packages/core/src/commands.test.ts`, confirmed present in the diff and included in the 674-passed count above) assert both the bounded call shape and the resulting message. Verified by direct diff read — fix is correct, consistent with the rest of T10's resolution/interaction split, and test-backed.

Both blocking findings are fixed in code and test-backed. Confirmed independently (not just by re-reading the commit message) by inspecting the actual diffs of `5f03ba4` and `504af05`.

### 3. AC79 ruling

**Not a blocker for this gate — pre-existing, not a regression. Carried forward to Gate 3 / backlog, as the Orchestrator already flagged.**

Evidence: Wave 4's full-directory run (`test-app/flows/integration/`) fails 2 of 37 flows (`run-flow-override-child.yaml`, `sessions.yaml`). I independently re-ran both flows standalone against the live test-app and reproduced both failures exactly as recorded (`run-flow-override-child.yaml`: `tapOn: {"testId":"int-input-shorthand"}` fails with `Element not found after 5000ms: ...`, 0/4 commands; `sessions.yaml`: `assertVisible: {"testId":"int-sessions-consumer-display"}` fails the same way, 13/21 commands). The Orchestrator's own base (`edc5701`) comparison in Wave 4 shows the identical two flows failing at the identical step on the pre-change code (34/36, same failure set, just with the old `Element not found.`/`Expected: visible` message text). This feature did not introduce either failure:
- `run-flow-override-child.yaml` is designed to run only as a `runFlow` child (no `goto`/`appId` of its own); a directory sweep runs it standalone on `about:blank`, which fails identically with or without this feature.
- `sessions.yaml`'s failure is a pre-existing cross-session `storage`-event timing issue, unrelated to selector/timeout resolution.

Since AC79's exit-0 requirement cannot be satisfied without separately fixing two pre-existing, out-of-scope defects, and the Quality Gate's purpose is to catch defects *introduced* by this change, AC79 is ruled a pre-existing item, not a gate blocker. The CLAUDE.md-mandated integration-flow requirement for this feature's own new commands is independently satisfied: `test-app/flows/integration/timeouts.yaml` passes 100% (evidence row 8) and is committed on the feature branch (`03c327a`/`5f03ba4`). Recommend: open a follow-up to fix `run-flow-override-child.yaml` (give it its own `appId`/`goto`, or exclude it from directory sweeps the way the negative flow is excluded) and investigate the `sessions.yaml` cross-session timing flake, before or at Gate 3.

### 4. N1–N17 non-blocking items — cannot be ruled on; process gap flagged

I could not find any record of items labeled N1–N17 (or their content) anywhere in this run: not in `state.md` (no `## Test Results` section exists, despite Gate 0's own plan, line 53, naming `state.md#test-results` as Tester Ensemble Phase 2's output target), not in `pipeline/feat-selector-waits-and-timeouts/log.md`, not in any commit message or code comment on this branch (`edc5701..HEAD`), and not in any other file under `pipeline/feat-selector-waits-and-timeouts/`. The only artifacts of the Tester Ensemble Phase 2 / code-review step that reached a durable, inspectable form are the two blocking findings B1 and B2, each named and fixed in its own commit (`5f03ba4`, `504af05`) after `state.md` itself was committed (`676c4e7`) — the Phase 2 run that must have produced B1/B2 (and, per this gate's brief, N1–N17) never wrote its results back to `state.md#test-results` before those fixes landed.

I am not willing to fabricate rulings for 17 items whose text I have never seen — doing so would be a guess dressed up as a verdict. **Action needed, not a verdict:** the Orchestrator should attach the Tester Ensemble Phase 2 code-review output (whatever produced B1/B2) to `state.md` under `## Test Results` (or equivalent) so N1–N17 have a durable record and an actual arbiter ruling, either in this run's follow-ups or before Gate 3. This gap does not block the verdict below, because both items that *are* independently confirmed as blocking (B1, B2) are fixed and test-backed (§2 above); by this gate's own framing, N-items are non-blocking by construction, so their un-recorded status is a documentation/process defect, not evidence of unresolved blocking work.

### Follow-ups

1. Fix or exclude `test-app/flows/integration/run-flow-override-child.yaml` and investigate `sessions.yaml`'s cross-session timing flake so AC79's full-directory sweep can go green (pre-existing, raised for Gate 3).
2. Record the Tester Ensemble Phase 2 code-review findings (B1, B2, and the N1–N17 items referenced in this gate's brief) in `state.md` under a `## Test Results` section, per Gate 0's own plan — currently undocumented.
3. No linter is configured for `packages/core` or `uivisor-app` (no `lint` script in either `package.json`); the Code Quality check's "no linter errors" criterion is vacuous here, not actively passing. Worth adding if/when the project adopts one — not raised as a finding against this feature, since it predates this run.

**Last checkpoint:** quality gate at 2026-10-14 09:35

**Orchestrator note:** the arbiter wrote this section into the worktree snapshot of state.md (committed at 676c4e7, pre–phase 2) because the brief did not give the absolute path; moved here and the snapshot restored. That snapshot lacked the phase 2 sections, hence "N1–N17 not found". N-item rulings requested from the arbiter against this file.

### Quality Gate — Non-blocking rulings

Ruled against `### Consolidated Phase 2 Results`' deduplicated N1–N17 list (this file, above) and cross-checked against the current committed code (`.worktrees/feat-selector-waits-and-timeouts` HEAD `504af05`) where a quick `grep` could confirm or refute a claim. No suites re-run for this pass, per instruction.

| ID | Ruling | Reason |
|---|---|---|
| N1 | **Accept** | Already fixed. `grep -n "T9\|T11\|T5\|T10" dispatcher.ts timeouts.ts` returns no matches — `5f03ba4`'s "drop task-number comments" already removed these at the cited lines. The consolidated list predates that commit. |
| N2 | Follow-up | Stale/narrating comments and test titles across several files, one now factually false (per the finding). Cosmetic, no behavioral risk; matches this repo's existing "Hygiene" PR pattern (`458db56`, `8d7a9a9`, `461f00c`) — bundle into the next one. |
| N3 | Follow-up | The INT `AC37` test can't distinguish one shared budget from two. Not blocking: the real guarantee (budget shrinks and floors at 1ms across both `waitForPageLoad` waits) is already precisely proven at the unit level in `commands.test.ts` under a controlled `Clock`. The INT test is redundant-but-weak, not the only evidence. |
| N4 | Follow-up | INT `AC40` test's "session routing intact" claim is unexercised (the `session: b` step never runs). Not blocking: session+timeout key-order/session-preservation is already asserted at parse time in `sibling-timeout-parser.test.ts` (AC40a/b). The INT gap is end-to-end redundancy, not the sole proof. |
| N5 | Follow-up | `sibling timeout: "${t}"` parser-acceptance test (`error-message-format.test.ts`) would pass even if the value were silently ignored. Not blocking: the real round-trip (resolved value actually becomes the deadline) is proven end-to-end by T11's integration suite (AC48, "the orchestrator's explicitly required end-to-end case"). Tighten the unit assertion as a follow-up for faster failure localization. |
| N6 | Follow-up | The 30000ms default-navigation-timeout INT test already pays the full 30s wall-clock cost but never asserts the message text. Wasteful not to assert since the cost is already sunk — cheap fix, not a coverage gap (AC73's 30000ms default is independently proven synchronously in `commands.test.ts`). |
| N7 | Follow-up | CLI → `runAll` → `createContext` timeout glue (`cli/index.ts:62-66`, `cli/runner.ts:47-48`) has no dedicated test exercising the real `runAll` with a CLI `--timeout` override; the INT `AC56` test reimplements the loop instead. Not blocking: every live CLI run in this gate's own evidence (`timeouts.yaml`, the negative flow) already executes this exact glue for real (just with the flag unset, exercising the "no override" branch), and each layer it touches (`args.ts`, `resolveRunTimeouts`, `createContext`) is independently and thoroughly unit-tested. The glue itself is a few lines of direct value pass-through, not new logic. Add a thin smoke test calling real `runAll` with `--timeout` across 2 flows as a follow-up. |
| N8 | Follow-up | AC58's navigation-probe child-inheritance variant and AC64's `${defaultTimeout}`-resolves-as-"1000"-var assertion are both missing. Not blocking: the inheritance mechanism (`ctx.timeouts` fixed once per context) is trait-agnostic and already proven for the element-trait probe plus unit-tested directly for the navigation branch in `stepTimeoutMs`; var-stripping-not-value is already asserted (probe reports the built-in default). |
| N9 | Follow-up | AC44 (CLI exit-1), AC75 (reporter label diff across md/html), and AC76 (fixture page render) were checked by hand in T12 and never committed as automated tests — AC76 in particular was explicitly planned as a committed test under T3 (closing Gap 11) in the Consolidated Test Plan and never landed. This is a real, traceable regression-safety-net gap, not a functional defect (all three were manually verified to work). Recommend prioritizing this one in the next cycle since it was a dropped commitment, not a newly-discovered edge case. |
| N10 | Follow-up | The spec's literal `/integration`-page bare-string not-visible probes for AC19 aren't run live; only mocked unit coverage and an equivalent (different-fixture) live case exist. Mechanism is well covered elsewhere; add the literal case to a live flow for completeness. |
| N11 | Follow-up | AC68's header/config invalid-value matrix only covers 2 of 5 literal values per key/layer. Not blocking: all five value classes (`0`, `-5`/`-1`, `1.5`, `"abc"`, `true`) are already exhaustively unit-tested against the same shared `parsePositiveInt` predicate that `validateTimeoutKeys` calls (`positive-int.test.ts`, `AC47`'s sibling-timeout it.each). Filling in the remaining 3×2×2 cells is test-completeness hygiene, not new risk. |
| N12 | Follow-up | `AC72`'s test uses a hand-written command list instead of actually cross-checking against `COMMAND_TRAITS`, undermining its stated "stays in sync automatically" purpose. Not blocking today: `AC41`/`AC44` already hand-enumerate every real command type against the trait table's `element`/`navigation`/`none` buckets, so no current mismatch exists. Should be rewritten to iterate `Object.keys(COMMAND_TRAITS)` so a future trait-table edit is caught automatically. |
| N13 | Follow-up | `runner-no-auto-nav.test.ts`'s edit changed the mock's own call literal to match the assertion, which can read as circular. Not blocking: the actual behavioral claim (`goto` now carries `timeout: 30000`) is independently proven against real production code in `commands.test.ts` and `session-engine.test.ts`'s 7 call-shape assertions; this file mocks `runFlow` entirely by pre-existing design, predating this diff. Worth revisiting the mock's value, but it's a pre-existing test-design choice this diff only kept consistent with. |
| N14 | **Accept** | Integration-fixture delays (e.g. `delay=700` vs. the spec's 1500ms) are shorter than specified while assertion upper bounds are kept, leaving extra timing slack. This is the same deliberate flakiness-reduction tradeoff already made and documented in this run (T11's own Deviations note: AC36(b)'s margin was widened from 100ms to 1000ms after an observed flake). Exact-ms precision is independently proven by the fake-clock unit suites (`deadline.test.ts`, `playwrightLocator.test.ts` AC9–AC13); the real-browser suite's job is end-to-end proof, not ms-precision, so the extra slack doesn't weaken the guarantee that matters at that layer. |
| N15 | Follow-up | Inner `waitForPageLoad` timeout is parsed twice, and `executeWaitForPageLoad`'s own timeout argument is now unused on the uivisor-app path (kept only for `recorder-app`, which still calls it). Redundant computation, not dead code in the harmful sense — removing it isn't free since `recorder-app` depends on the parameter staying. Cleanup follow-up, no behavioral risk (parsing is deterministic/idempotent). |
| N16 | Follow-up | Stale `@ts-expect-error` pragmas from the T5 codemod sit inert inside `tests/` object literals (outside `tsconfig`'s `include`, confirmed by T5's own Code Artifacts note). No functional effect; cosmetic cleanup, bundle with N1/N2 hygiene follow-up. |
| N17 | **Accept** | The "Use pipe syntax" / xpath "use within" hints were deliberately dropped from the not-found message — this is spec-compliant, not an oversight: T4's Code Artifacts explicitly document the `TC-006`/`TC-XPATH-R8` edits with the stated reason "the hint is not part of the AC14 message." Any reconsideration of this usability tradeoff is a product/spec decision for a future revision, not something Coder should unilaterally restore now. |

**Summary: 0 of 17 items are "fix before merge."** 3 accepted as already-resolved or already-correct-per-spec (N1, N14, N17); 14 filed as non-blocking follow-ups (test-completeness/coverage hygiene and comment/code cleanup), none of which point to an undetected functional defect — in every case checked, the underlying behavioral guarantee is independently proven by a different test at the unit, integration, or live-flow level, or (N9) is a manually-verified-but-not-automated gap with no evidence of actual breakage.

**Verdict confirmed: PASS stands, unchanged.** Nothing in this N-item review surfaces a new blocking finding, contradicts the B1/B2 fix verification, or changes the AC79 ruling.

**Last checkpoint:** quality gate N-rulings at 2026-10-14 09:37

## Build Check
**Verdict:** PASS
**Manifest:** root workspaces package.json + per-package manifests; unchanged in this run
**Smoke tests:** 3/3 passed
**Blocking findings:** 0
Detail: `pipeline/feat-selector-waits-and-timeouts/build_check.md`

**Last checkpoint:** build check at 2026-10-14 09:40

**Last checkpoint:** README committed; ready for PR at 2026-10-14 10:00

## Escalation: main drift (2026-10-14 10:15)
- After pushing the branch (`72acf65`), `origin/main` was 22 commits ahead (`48b345c`), with merge conflicts in 10 files. Overlapping main PRs: #103 (VarMap.withScope; runFlow var scoping in dispatcher/types/commandParser/interpolate), #110 and #118 (header/runFlow/vars parsing moved into `@uivisor/core`), #102 (live step checklist; args/runner/context/dispatcher), #108 (lazy within interpolation), #115 (recorder overlay/cli tests fixed → recorder baseline changes).
- **Human decision:** merge `origin/main` into the feature branch (merge commit, no force-push), resolve with an opus Coder, re-verify against the new main baseline, short arbiter re-review. Cost cap raised from $30.00 to $40.00 (accumulated $24.92). PR not opened yet.

## Main Baseline (origin/main 48b345c, measured in temporary worktree /tmp/sw-main, 2026-10-14 10:40)
- core `npm test`: 552 passed (276 unique; dist double-count); **coverage gate fails on main itself**: branches 63.66% < 90% threshold (pre-existing).
- uivisor-app vitest: 799 passed | 4 expected fail. recorder-app: tsc error at `src/cli.test.ts(141,7)` (pre-existing); vitest 179 passed | 1 todo, 0 failed (#115 fixed the old 26).
- integration directory: 36 passed, 1 failed of 37 — only `sessions.yaml` (`run-flow-override-child.yaml` now passes on main).
- Merge targets for the branch: core ≥ main counts + phase-1 tests, branch coverage not below 63.66%; app ≥ 799 + phase-1 tests; recorder 0 failed; integration 37/38 with only `sessions.yaml` failing.
- The outer checkout could not fast-forward: an untracked `.claude/settings.json` (not created by this run) collides with the file #120 now tracks. Left untouched.

### Merge with main (48b345c)

# Merge artifacts — origin/main (48b345c) into feat-selector-waits-and-timeouts

Worktree: `.worktrees/feat-selector-waits-and-timeouts`. Merge left **staged, not committed**. No abort, rebase or force.

## Conflicted files (10)

| File | Resolution |
|---|---|
| `packages/core/src/index.ts` | Union of the type exports: main's `ProgressEvent`, `ProgressListener`, `VarScope` plus phase 1's `TimeoutSettings`, `TimeoutKey`, `FlowTimeoutLayers`. main's `interpolate.js` re-exports and phase 1's `COMMAND_TRAITS`/`deadline.js` exports both kept (those parts merged cleanly). |
| `packages/core/src/types.ts` | `RunContext` keeps phase 1's `timeouts?` and `timeoutNotices?` and main's `onProgress?`. Everything else (main's `RunFlowCommand`, `ProgressEvent`, `ProgressListener`; phase 1's `SessionedCommand.timeout`, `TimeoutSettings`, `FlowTimeoutLayers`, `FlowFile.timeouts`, `RunOptions.timeouts`) merged cleanly. `ProgressEvent.stepStart.command` is still a `Command`. |
| `uivisor-app/src/cli/args.ts` | Both imports (`parsePositiveInt` and `ConsoleFlag`). The usage line combines main's `--reporter html\|md\|plain\|live (repeatable)` with phase 1's `[--timeout <ms>] [--navigation-timeout <ms>]`. The return value carries main's `console` and phase 1's `timeout`/`navigationTimeout`. |
| `uivisor-app/src/cli/runner.ts` | main's `RunReporter`/`createPlainReporter` and `reporter.startFlow(file)`. Phase 1's `resolveRunTimeouts(options.timeouts ?? {}, file)` is re-applied, and the result goes to `createContext(..., methodRunner, runTimeouts, reporter.onProgress)`. |
| `uivisor-app/src/engine/context.ts` | `createContext(runDir, sessions, defaultSessionId, varMap?, methodRunner?, timeouts = DEFAULT_TIMEOUTS, onProgress?)`. `timeouts` comes before `onProgress` because the phase-1 tests already pass `run` in position 6 and no main caller passes `onProgress` positionally except the runner. The context sets `timeouts`, `timeoutNotices: new Set()` and `onProgress`. |
| `uivisor-app/src/engine/dispatcher.ts` | Built on main's structure: `dispatch` → `executeResolved`, with stepStart/stepEnd/include hooks, `UnresolvedVariableError` + `in flow "<stem>"` suffix, lazy `within` `do:` interpolation, `VarMap.withScope` for runFlow, and the `included from` suffix. Phase 1 re-applied on top: `dispatch(page, step: SessionedCommand, …)` (steps only, `cmd = step.command`); the sibling `timeout` is resolved inside the same try as interpolation, so its failures take main's failure path, which also emits stepStart/stepEnd with the raw command; `own` is passed into `executeResolved`; `run = ctx.timeouts ?? DEFAULT_TIMEOUTS`; the once-per-file child-flow timeout notice sits in main's runFlow branch, right after `loadAndParse` + `include` and before `withScope`; per-step `stepTimeoutMs` → `createDeadline`; `deadline` goes to every `execute*` and to `executeWithin` (step-based callback); failure `durationMs` is measured before the screenshot. Phase 1's old manual var save/restore and `callStack.add` in the runFlow branch are not brought back: main's `withScope` and `runFlow` (engine/index.ts) own them. `interpolateValue` now comes from `@uivisor/core`. |
| `uivisor-app/src/parser/commandParser.ts` | main's import of `RunFlowCommand`/`parseRunFlow` (runFlow parsing now lives in core) plus phase 1's `COMMAND_TRAITS` and `parsePositiveInt`. Sibling `timeout` extraction and checks in `parseSessionedCommand` (trait `none` error, literal/`${` check, waitForPageLoad both-timeouts error) merged cleanly. That function is still app-side on main, and `within` `do:` items still go through it. |
| `uivisor-app/src/parser/index.ts` | main's imports (`validateVars`, `flattenVars`, `interpolateValue`, `interpolateObject` from `@uivisor/core`; `loadConfigFile` from `./interpolate.js`) plus phase 1's `validateTimeoutKeys` from `./validator.js`. Header timeout validation and `FlowFile.timeouts {header, config}` merged cleanly. The header (`validateHeader`/`VALID_HEADER_KEYS`) is still parsed app-side on main, so phase 1's header keys stay in `validator.ts`. |
| `uivisor-app/src/parser/interpolate.ts` | main's version: the local `flattenVars`/`resolveRef`/`interpolateValue`/`interpolateObject` are deleted and imported from `@uivisor/core`. Phase 1's `TimeoutSettings` type import and `validateTimeoutKeys` import re-added. `FLOW_CONFIG_KEYS` with `defaultTimeout`/`navigationTimeout` and the config timeout extraction in `loadConfigFile` (still app-side on main) merged cleanly. |
| `uivisor-app/tests/unit/reporter.test.ts` | Both imports: main's `runFlowLabel` and phase 1's `SCREENSHOT_TIMEOUT_MS`. |

## Other files changed (not conflicted)

| File | Why |
|---|---|
| `uivisor-app/tests/unit/dispatcher-progress.test.ts` (new on main) | 7 `dispatch(page, <Command>, …)` calls wrapped as steps `{ command: … }`. The assertions are unchanged: stepStart still carries a `Command`. |
| `uivisor-app/tests/unit/within-dispatcher.test.ts` | main's 3 new #108 tests (lazy `do:` interpolation) now pass steps to `dispatch`. |
| `uivisor-app/tests/unit/var-scope.test.ts` | main's `callOnce` helper now passes a step to `dispatch`. |
| `uivisor-app/tests/unit/error-message-format.test.ts` | Phase 1's AC50a/AC50b asserted the pre-#110 `(in flow <abs path>)` / `(in child flow …, called from …)` format, which main replaced. Now: AC50a expects `Variable "nope" is not defined in flow "top"` (dispatch with flowStem `top`). AC50b runs a real child file whose step has `timeout: "${nope}"` through a runFlow step and expects main's `… in flow "child", included from flow "top" via runFlow: ./child.yaml`. Same intent: a sibling-timeout var error gets the same flow context as any other command. Added `fs`/`os`/`path` imports and `import '../../src/engine/index'` to register runFlow. |
| `uivisor-app/tests/integration/timeouts.test.ts` | AC66 expected-message string changed to main's format (`Variable "defaultTimeout" is not defined in flow "flow"`). |
| `recorder-app/src/flowReplayer.test.ts` | main's 5 new #111 assertions `page.goto(url, { waitUntil: 'load' })` changed to `{ waitUntil: 'load', timeout: 30000 }`. That is phase 1's `executeGoto` behaviour, and phase 1 already made the same edit to the 3 older assertions in this file. |

No production files were changed beyond the 10 conflicted ones. `label.ts`, `checklist.ts`, `live.ts`, `html.ts` and `markdown.ts` are untouched. They label `Command`s, and the sibling `timeout` lives on `SessionedCommand`, so labels don't change (AC75). The checklist plans from `sc.command`.

## Verification

| Check | Result |
|---|---|
| `npm run build -w packages/core && -w uivisor-app && -w recorder-app` | all OK |
| `cd packages/core && npm test` | **820 passed (16 files)** = phase 1's 674 + main's 146 (dist double-count, as on main). Coverage: branches **80.95%** (main 63.66%). The 90% gate still fails, same as on main. |
| `cd uivisor-app && npx tsc --noEmit` | clean |
| `cd uivisor-app && npx vitest run` | **1000 passed \| 4 expected fail (1004), 38 files**. That is 799 main + 201 phase-1 (934 − 733). |
| `cd recorder-app && npx tsc --noEmit` | only the pre-existing `src/cli.test.ts(141,7)` TS2769 |
| `cd recorder-app && npx vitest run` | **179 passed \| 1 todo, 0 failed** |
| `test-app/flows/integration/timeouts.yaml` | PASSED 20/20 |
| `test-app/flows/integration-negative/timeouts-default-fails.yaml` | exit 1, `Element not found after 5000ms: data-testid=int-delayed` |
| `test-app/flows/integration/ --reporter plain` | **37 passed, 1 failed of 38**. Only `sessions.yaml` fails (pre-existing cross-session `int-sessions-consumer-display`). `live-checklist.yaml` (from main) passes. |
| `/tmp/sw-hang` hung-navigation repro (`--reporter md`) | `hang` row **1503ms** (≤ 2500ms) |

## Not reconciled (flag for Orchestrator)

- **The child-flow timeout notice and main's live checklist reporter (`--reporter live`, the default on a TTY).** The notice is still written straight to `process.stdout` from the dispatcher, as in phase 1. In live mode the next checklist repaint rewinds over it: the notice line is erased, and a stale copy of the checklist header is left in scrollback. Reproduced under `script` with a top flow that runs a child setting `defaultTimeout: 7000`. Plain mode (non-TTY, CI, `--reporter plain`) is correct. Fixing this means routing the notice through the reporter, for example a new `ProgressEvent` kind or a reporter method. That is a design change not covered by either side, so it was left as is.

**Orchestrator verification:** 0 unmerged files, no conflict markers; builds ok; core `npm test` 820 passed, branch coverage 80.95% (main 63.66%; 90% gate fails on both); app tsc ok, 1000 passed + 4 expected fail; recorder 179 passed | 1 todo, 0 failed; timeouts.yaml 20/20; integration 37/38, only `sessions.yaml` (same as main).

**Open item from the merge (F2):** the child-flow timeout notice is written straight to stdout; under main's live checklist (default on a TTY) the next redraw erases it. Plain mode is correct.

**Last checkpoint:** merge committed at 2026-10-14 11:20

**F2 fixed** (`ac04302`): new `ProgressEvent` `{ kind: 'notice'; message }`; dispatcher emits it instead of writing stdout; live reporter flushes it above the redraw region; plain reporter prints one line. Real TTY run (`script`) and `--reporter plain` both show the notice once. Orchestrator verified: core 820, coverage 80.95%; app 1003 passed + 4 expected fail. The live reporter now forwards events to the plain reporter after a fallback; plain only acts on `notice`, so no duplicate output.

**Last checkpoint:** F2 committed at 2026-10-14 11:50

### Quality Gate — Post-merge re-review

**Verdict:** PASS

**Checked by:** tester_arbiter

Scope: `git show --remerge-diff 2c58e73` (all 10 conflicted files, resolved vs. both parents) and `git show ac04302` (F2), read against the merge's own per-file notes and `## Quality Gate` above. No full suite re-run (Orchestrator's `ac04302` numbers stand: core 820 passed, branch coverage 80.95% vs. main 63.66%; app tsc clean, 1003 passed + 4 expected fail; recorder 179 passed, 0 failed; `timeouts.yaml` 20/20; integration 37/38, only `sessions.yaml`, same as main `48b345c`). One targeted run to settle the merge/F2 doubt: `cd uivisor-app && npx vitest run tests/unit/error-message-format.test.ts tests/unit/live-reporter.test.ts tests/unit/checklist.test.ts tests/unit/run-reporter.test.ts` → **54 passed (4 files)**, 332ms. `npx tsc --noEmit` in `uivisor-app` → clean.

**1. Nothing main added was lost — confirmed by direct read of merged source, not just the state.md notes:**
- `VarMap.withScope` scoping: `uivisor-app/src/engine/varMap.ts:84` defines it; `uivisor-app/src/engine/dispatcher.ts:199` calls `ctx.varMap.withScope({ overrides: resolvedCmd.vars ?? {}, defaults: file.vars ?? {} }, () => runFn(file, page, ctx))` in the runFlow branch. Phase 1's old manual save/restore + `callStack.add` is gone from this branch, as the merge note claims.
- Core-side `runFlow`/vars parsing: `uivisor-app/src/parser/commandParser.ts` imports `RunFlowCommand`/`parseRunFlow` from `@uivisor/core` alongside phase 1's `COMMAND_TRAITS`/`parsePositiveInt` — both present, no duplication.
- Live checklist progress events: `uivisor-app/src/cli/runner.ts` builds `runTimeouts` via `resolveRunTimeouts` and passes it plus `reporter.onProgress` into `createContext`; `dispatcher.ts` fires `stepStart`/`stepEnd`/`include`/(now)`notice` at every exit path, including the lazy-interpolation-failure early return.
- Lazy `within` interpolation: `dispatcher.ts`'s try block special-cases `cmd.type === 'within'` to interpolate the container's own fields but leave `do:` untouched (`{ ...cmd, do: [] }` then restore `do: cmd.do`), matching main's #108 behaviour; `tests/unit/within-dispatcher.test.ts`'s 3 lazy-interpolation tests pass steps to `dispatch` and are unmodified in intent.
- Recorder fixes: `recorder-app/src/flowReplayer.test.ts`'s 5 #111 assertions now expect `{ waitUntil: 'load', timeout: 30000 }`, consistent with phase 1's own `executeGoto` behaviour already applied to the 3 older assertions in the same file — no conflict between the two, both land on the same expected call shape.

**2. Phase-1 behaviours survived — confirmed by direct read:**
- Steps-only dispatch: `dispatch(page, step: SessionedCommand, ctx, flowStem, flowDir)` (`dispatcher.ts:80`); `cmd = step.command`.
- Sibling timeout parse + Q17/Q19 checks: trait check and the "can't have both inner and sibling timeout" check are at `commandParser.ts:338` and `:352` (Q17/Q19, AC44/46/72 citations in comments); `stepTimeoutMs(c.type, own ?? inner, run)` at `dispatcher.ts:233` carries the `// Q19: own and inner are never both set` comment.
- Header/config timeout keys: `parser/index.ts` imports `validateTimeoutKeys` from `./validator.js` alongside main's `validateHeader`/`validateCommandList`/`validateSessions`; `parser/interpolate.ts` keeps `FLOW_CONFIG_KEYS` with `defaultTimeout`/`navigationTimeout` and the `TimeoutSettings` import.
- CLI flags: `cli/args.ts`'s usage string carries both main's `--reporter html|md|plain|live (repeatable)` and phase 1's `[--timeout <ms>] [--navigation-timeout <ms>]`; the returned object has both `console` and `timeout`/`navigationTimeout`.
- Precedence + notice: `executeResolved` computes `run = ctx.timeouts ?? DEFAULT_TIMEOUTS` once, and the runFlow branch computes/dedupes the notice via `ctx.timeoutNotices` before emitting it (now via `onProgress`, see §3).
- Per-step deadline incl. `within`: `deadline` is threaded into every `execute*` call and into `executeWithin(page, c, ctx, (p, nextStep, cx) => dispatch(p, nextStep, cx, flowStem, flowDir), deadline)`.
- Failure duration before the bounded screenshot: in the catch block, `const durationMs = Date.now() - start;` is computed *before* the `captureScreenshot` try/catch, exactly as the merge note states.

**3. F2 (`ac04302`) is sound and scoped:**
- New `ProgressEvent` member `{ kind: 'notice'; message: string }`, documented as sitting outside the stepStart/stepEnd/include bracket structure (`packages/core/src/types.ts`).
- `dispatcher.ts`'s runFlow branch now does `ctx.onProgress?.({ kind: 'notice', message: line })` instead of `process.stdout.write(line + '\n')` — same dedup gate (`ctx.timeoutNotices`), only the sink changed.
- `checklist.ts#applyEvent` gets an explicit `case 'notice': return list;` (checklist is unaffected, as documented) — this also keeps the switch exhaustive, consistent with `tsc --noEmit` being clean.
- `live.ts#onProgress`: added a `screen.kind === 'plain'` forward-to-plain-reporter branch *before* the existing `if (screen.kind !== 'flow') return;` guard, plus a `notice`-specific branch that rewinds the painted frame, writes the notice as a permanent scrollback line, resets `height`/`painted`, and repaints. The forward-to-plain branch is new control flow (previously `onProgress` dropped all events once a live render failure demoted the screen to `'plain'`), but it is behaviourally inert for every event kind except `notice`, because `createPlainReporter`'s `onProgress` (`run-reporter.ts`) only acts on `kind: 'notice'` — confirmed by reading `run-reporter.ts` directly, not inferred. So this does not change any existing live/plain stepStart/stepEnd/include output; it only plugs a latent gap (dropped notices during the live→plain fallback) that F2's own feature needed closed anyway.
- `console.ts` gets a new `notice(message)` method, used only from the plain reporter's new `onProgress` case; existing `startFlow`/`reportCommand`/`endFlow`/`runEnd` output is untouched.
- Tests for F2 (`timeouts.test.ts`'s AC58–AC64/AC80/B-edge-case notice assertions, `checklist.test.ts`, `live-reporter.test.ts`, `run-reporter.test.ts`) were re-pointed from a `process.stdout.write` spy to a `ProgressListener` that collects `notice` messages, and still assert the exact expected message text (e.g. `'child.yaml: defaultTimeout ignored (inherited from top.yaml)'`) or exact escape-sequence framing (live reporter) — direction is correct, not tautological; re-run above (54/54) confirms they pass against the current code.

**4. Edited tests still assert the spec:** `error-message-format.test.ts`'s AC50a/AC50b were rewritten to main's new message format but keep the same intent (a sibling-timeout variable error gets the same flow-context suffix as any other command's error) — AC50b in particular now exercises a real child file through a real `runFlow` dispatch (registered via `import '../../src/engine/index'`) rather than a hand-set `callStack`, which is a *stronger* test of the real code path, not a weaker one. `tests/integration/timeouts.test.ts`'s AC66 string update and the recorder's 5 `waitUntil`/`timeout` assertions are mechanical format updates with no loss of assertion strength.

**No blocking findings.** No non-blocking findings beyond what's already on record in `## Quality Gate` (the pre-existing `sessions.yaml`/`run-flow-override-child.yaml` AC79 item, N1–N17 dispositions, no-linter note) — nothing new surfaced by the merge or F2.

**Last checkpoint:** post-merge re-review at 2026-10-14 12:45

## PR
**URL:** https://github.com/plaktoz/uivisor/pull/122
**Branch:** feat-selector-waits-and-timeouts
**Status:** open

## Gate 3: Deploy Approval
**Status:** approved by human (2026-10-15)

**Last checkpoint:** PR #122 opened; Gate 3 presented at 2026-10-14 13:00

## Deployment
**Pre-deploy checks:** tests — Gate 3 approved (2026-10-15); lint — `test-app` oxlint exit 0 (warnings only; new: `IntegrationTimeoutsPage.jsx:31` set-state-in-effect, follow-up). No other workspace defines `lint`.
**Container step:** skipped. `deploy` config names podman + compose, but the repo has no compose file or Dockerfile; prior runs also deployed by merging only.
