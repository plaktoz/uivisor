# Backlog

Ideas that are worth building but not yet in a pipeline run.

---

## Subagent-Per-Role Execution

**Status:** Backlog
**Context:** All roles currently run as skill invocations inside the orchestrator's single Claude Code session. This means every role uses the orchestrator's model (`claude-opus-4-8`), `parallel_execution: true` has no effect, and `max_cost_per_run` is unenforceable. The pipeline's architecture (shared blackboard via `state.md`, explicit output contracts, tester ensemble with cross-provider roles) was designed for true subagent isolation — it's just not wired up yet.

### Problem

| Capability | Config intent | Current reality |
|---|---|---|
| Model tiering | Haiku for deployer, Sonnet for coder | All roles run on Opus (orchestrator's model) |
| Parallel execution | Independent tasks run concurrently | Sequential — one context, one thread |
| Cost governance | `max_cost_per_run: 5.00` | Unenforceable — no per-role token counts |
| Context isolation | Each role starts clean | Prior roles' reasoning accumulates in window |
| Runtime model verification | Detectable from Agent tool call | No mechanism — log.md doesn't record model used |

### Target Architecture

The orchestrator spawns each role as a true subagent via the Agent tool with:
- `model:` set from `agent-config.yml` for that role
- `prompt:` = context brief (role guide + relevant `state.md` sections)
- `isolation: worktree` for Coder roles (already supported by `worktree_isolation: true`)

The orchestrator waits for the subagent's output contract artifacts to appear in `state.md` before proceeding. All inter-role communication continues through the existing blackboard — no new state mechanism needed.

### Changes Required

**`CLAUDE.md` — Role Activation Protocol**

Add explicit subagent spawn instructions to the activation protocol. When activating a role, the orchestrator must:

1. Read `agent-config.yml` for `roles.[role].model` and `roles.[role].tools`
2. Read `steering/roles/[role].md` for the role guide
3. Compose context brief: role guide + relevant `state.md` sections (as defined per role)
4. Spawn Agent tool with `model: [from config]`, `prompt: [context brief]`
5. Write activation entry to `log.md`: `| timestamp | role | model | skill | started |`
6. Wait for output contract section in `state.md` to reach expected status

**`log.md` schema — add `model_used` column**

```
| timestamp | role | model_used | skill | status | notes |
```

This makes model usage auditable per run without requiring external tooling.

**`scripts/check_providers.py` — add model verification**

Extend the existing connectivity check to make a minimal test call to each configured model and confirm the model ID in the API response. Print a pass/fail table at session start before Gate 0.

```
Provider     Model                    Status
anthropic    claude-opus-4-8          ✓ reachable
anthropic    claude-sonnet-5          ✓ reachable
anthropic    claude-haiku-4-5 ✓ reachable
openai       gpt-5.4                  ✓ reachable
```

**`agent-config.yml` — no structural changes needed**

The model and tools fields are already per-role. The orchestrator just needs to read and use them instead of ignoring them.

### Tester Ensemble

The four tester roles (`generator_a`, `generator_b`, `consolidator`, `arbiter`) are the most important case. With subagent-per-role:

- `generator_a` (Haiku/Anthropic) and `generator_b` (GPT/OpenAI) spawn in parallel
- `consolidator` spawns after both complete, reading their outputs from `state.md`
- `arbiter` spawns on disagreements only

This is the only way the cross-provider tester ensemble actually runs concurrently with different models.

### Acceptance Criteria

- [ ] Each role activation spawns an Agent tool call with the model from `agent-config.yml`
- [ ] `log.md` records `model_used` on every role activation
- [ ] `check_providers.py` verifies all configured models are reachable before Gate 0
- [ ] Independent tasks (flagged by Architect) spawn as concurrent subagents
- [ ] Tester `generator_a` and `generator_b` run in parallel on their respective providers
- [ ] Coder activations use `isolation: worktree` when `worktree_isolation: true`
- [ ] Orchestrator reads subagent completion from `state.md` output contract section, not from subagent return value

---

## Cross-Agent Central Monitor

**Status:** KIV
**Context:** When running hundreds of parallel agents across git worktrees and different tools (Claude Code, Codex, etc.), tmux doesn't scale. Need a central dashboard.

<!-- cspell:ignore worktree worktrees myproject -->

### Architecture

A neutral drop directory `~/.agent-monitor/runs/` that any agent or wrapper writes to. A `monitor.py` polls this directory and renders a live status table.

### Registry file format

One JSON file per run at `~/.agent-monitor/runs/{run-id}.json`:

```json
{
  "id": "run-abc123",
  "agent": "claude-code",
  "label": "feat-auth in myproject",
  "project": "/path/to/project",
  "state_file": "/path/to/pipeline/feat-auth/state.md",
  "pid": 12345,
  "status": "running",
  "step": "coder",
  "started": "2026-09-01T10:30:00Z",
  "updated": "2026-09-01T10:35:00Z"
}
```

| Field | Values | Notes |
| --- | --- | --- |
| `agent` | `claude-code`, `codex`, `gemini-cli`, `custom` | Tool that's running |
| `status` | `running`, `done`, `failed`, `abandoned` | |
| `step` | e.g. `analyst`, `coder`, `tester` | `null` for non-Claude agents |
| `state_file` | absolute path | `null` for non-Claude agents — status only |

### Discovery logic (monitor.py)

1. Read all `~/.agent-monitor/runs/*.json` — cross-project pointers
2. `git worktree list --porcelain` — find same-repo worktrees
3. For each worktree path, glob `pipeline/*/state.md` and read step-level detail
4. Merge, deduplicate by run-id, render table

### Integration points

- **Claude Code agents:** write pointer at pipeline start, update on each state transition
- **Codex / other CLIs:** launch via `run-agent.sh <tool> <label> [args...]` wrapper — wrapper writes and updates the pointer around the subprocess
- **Cleanup:** pointer file deleted (or status set to `done`) when pipeline completes

---

## uivisor: Override Variables of an Included Flow (`runFlow` with `vars:`)

**Status:** Backlog
**Context:** A main flow includes shared flows (e.g. `runFlow: ./login-flow-v1.yaml`). Today the variable map is seeded **only from the top-level flow's** `vars:`/`config:` (`uivisor-app/src/cli/runner.ts:40`). The included flow's own `vars:` header is parsed by `loadAndParse` but never merged into the map (`uivisor-app/src/engine/dispatcher.ts:123`), so the main flow has to re-declare every variable the included flow uses, even ones that never change.

### Problem

| Need | Today |
|---|---|
| Included flow carries its own defaults (e.g. `waitForLandingPageInMills`) | Ignored when included; caller must redeclare |
| Caller changes one value (e.g. a different `userNric`) | Caller must declare it, plus every other var the child uses |
| Same sub-flow called twice with different values | Not possible without `setVar` juggling around each call |

### Proposed syntax

```yaml
# main flow — only declares what it wants to change
commands:
- runFlow: ./login-flow-v1.yaml              # unchanged: child uses its own vars as defaults
- runFlow:
    file: ./login-flow-v1.yaml
    vars:
      userNric: S1234567A                     # override just this one
```

### Resolution order (inside the included flow)

1. `runFlow.vars:` given at the call site (**highest**)
2. Values already in the shared map (main flow `vars:`/`config:`, earlier `setVar`)
3. The included flow's own `config:` then `vars:` header (**defaults**, fill-in only)

`${...}` in `runFlow.vars:` values is interpolated against the caller's map, so `userNric: ${adminNric}` works.

### Scoping

- Call-site overrides (1) are **scoped to the call**: the previous values (or absence) are restored when the child returns, so calling the same sub-flow twice with different values works.
- Child defaults (3) that were not already in the map are also removed on return, so the main flow's namespace isn't polluted.
- `setVar` inside the child keeps today's behaviour (writes to the shared map and survives the return), unless the name was a scoped override, in which case it's restored. This needs confirming at spec time.

### Acceptance Criteria

- [ ] Included flow's `vars:`/`config:` act as defaults when not set by the caller
- [ ] `runFlow: { file, vars }` object form; string form unchanged
- [ ] Call-site `vars:` override map values and child defaults; restored after the call
- [ ] Same sub-flow callable twice with different `vars:` in one flow
- [ ] Clear error when a variable is unresolved, naming both the child flow and the call site
- [ ] Integration flow under `test-app/flows/integration/` exercising defaults, override and double-call (per CLAUDE.md)

---

## uivisor: Live Step Checklist in the Console

**Status:** Backlog
**Context:** The console reporter (`uivisor-app/src/reporter/console.ts`) prints each step only after it finishes. You can't see what's coming, or how far through the flow the run is. Steps of an included flow (`runFlow`) are printed only after the **whole** sub-flow ends (`reportCommand` runs after `dispatch` returns), so during a long login nothing appears.

### Target behaviour

When a flow starts, print **all** its steps as a checklist, then update each line in place as it runs:

```
▶ my-flow.yaml                                   (step 3 of 22 · 00:41)
  ✓ runFlow: ./login-flow-v1.yaml                    38.2s
    ✓ goto: https://employees-nshub-qa2…/nshub        1.1s
    ✓ tapOn: "data-testid=storybook-button-secondary"  0.2s
    …
  ✓ tapOn: "text=N3-3 Test-Room-Change"               0.4s
  ◐ tapOn: {"css":"h6:nth-child(2)"}                  2.1s…
  ○ tapOn: "text=12"
  ○ inputText: 2026-10-12
  ○ …
```

| Icon | Meaning |
|---|---|
| `○` | pending |
| `◐` (spinner) | running, with a live elapsed timer |
| `✓` / `✗` | passed / failed (failure details printed under the line, as today) |
| `–` | skipped (steps after a failure, since the flow halts on first failure) |
| `⚠` | passed but over SLA (ties in with `docs/proposals/loading-timeout-sla.md`) |

### Design notes

- **Included flows:** the `runFlow` line expands into its child steps when it starts running. Paths with `${var}` can only be resolved then, so children aren't listed up front. Optionally pre-expand when the path is static.
- **`within`:** its `do:` steps are listed nested under it from the start, since they're known at parse time.
- **Long flows:** if the checklist is taller than the terminal, show a scrolling window around the running step, with `… 12 more` markers.
- **Non-TTY (CI, piped output, `> log.txt`):** in-place updates garble logs, so fall back to today's append-only output automatically (`process.stdout.isTTY`). Add `--reporter plain|live` to force either.
- **Final output:** after the run, the finished checklist stays on screen as a static block, so scrollback still has the full result.
- **Implementation:** a `LiveConsoleReporter` alongside `ConsoleReporter`. Needs new hooks `startCommand(cmd, indent)` and `planFlow(commands, indent)` from the engine (`uivisor-app/src/engine/index.ts`), plus per-command results streamed from nested flows rather than returned at the end.

### Acceptance Criteria

- [ ] All steps of the top-level flow listed as `○` before the first command runs
- [ ] Running step shows a spinner and live elapsed time; finished steps show `✓`/`✗` and duration
- [ ] Steps after a failure shown as `–` skipped
- [ ] `runFlow` children appear when the sub-flow starts and update live, not after it ends
- [ ] Non-TTY output identical to today's reporter (no ANSI cursor codes)
- [ ] `--reporter plain|live` flag
- [ ] Integration flow under `test-app/flows/integration/` run in both modes (per CLAUDE.md)

---

## Recorder: Right-Click Element Inspector Popup

**Status:** Backlog
**Context:** In the recorder (`recorder-app`), adding anything other than a plain click or typing is awkward. `Shift+A` opens a fixed, centred picker of assertion types (`recorder-app/src/overlay.ts`), and it has several limits:

| Today | Problem |
|---|---|
| Target = `document.activeElement` | Only works on the **focused** element. Buttons, labels and text can't be targeted without focusing them first. |
| Selector = `data-testid` only | Elements without a test id get an **empty selector** (`getSelector()` returns `''`), and the recorded step is broken. |
| Values via `window.prompt()` | No suggestions; you have to type expected text/values by hand. |
| No validation | You only find out a step is wrong (selector not unique, assertion false) when the flow is replayed. |
| Picker is centred on screen | Covers the page; no visual link to the element it applies to. |

Right-click isn't used by the app under test (NS Hub), so it's free to use as the recorder's inspect trigger.

### Target behaviour

**Right-click** any element (button, input, text, container) → the element is **highlighted** and a popup opens **next to it**:

```
┌─ <button> "Book now" ───────────────────────────────────── ✕ ┐
│ Selector                                                     │
│ (•) data-testid=storybook-button-primary        ✓ 1 match    │
│ ( ) text=Book now                               ⚠ 3 matches  │
│ ( ) role=button[name="Book now"]                ✓ 1 match    │
│ ( ) css: div.booking-footer > button            ✓ 1 match    │
│ ( ) custom… [________________________]                       │
├──────────────────────────────────────────────────────────────┤
│ Command                                                      │
│ (•) tapOn                                                    │
│ ( ) assertVisible        ( ) assertEnabled                   │
│ ( ) assertText  [Book now_____________] ▾                    │
│ ( ) hover                ( ) doubleClick                     │
├──────────────────────────────────────────────────────────────┤
│ ✓ Valid now: element unique, visible, enabled                │
│ - tapOn: data-testid=storybook-button-primary                │
│                                                              │
│        [ Record ]   [ Record & perform ]   [ Cancel ]        │
└──────────────────────────────────────────────────────────────┘
```

**1. Selector candidates.** Generate every usable selector for the element, in the same syntax uivisor accepts (`data-testid=`, `id=`, `name=`, `placeholder=`, `text=`, `role=`, `label=`, `{ css: }`, `{ xpath: }`). Show each one's **live match count** (✓ 1, ⚠ many, ✗ 0). Pre-select the most stable unique one: test id > id/name > role+name > text > css. A custom entry is allowed. When no selector is unique, offer **"scope with `within`"**, using the nearest ancestor that makes it unique.

**2. Commands offered for the element type**, with **suggested values** and a custom field for each:

| Element | Commands | Suggested values |
|---|---|---|
| Button / link | `tapOn`, `doubleClick`, `hover`, `assertVisible`, `assertEnabled`/`assertDisabled`, `assertText` | current text |
| Text input / textarea | `inputText`, `clearText`, `assertValue`, `assertEnabled` | current value, placeholder, flow variables (`${userNric}`…), recent values in this session |
| Native `<select>` | `selectOption`, `assertValue` | all `<option>` values/labels read from the DOM |
| Custom dropdown (antd `rc_select`, as in NS Hub) | `tapOn` (open) + `tapOn: text=<option>` (pick) | options read from the open listbox. First version: ask the user to open the dropdown once, then right-click it |
| Checkbox / radio | `check`, `uncheck`, `assertChecked`/`assertUnchecked` | current state |
| Date input (flatpickr, as in NS Hub) | `inputText` | today, current value, `${var}` |
| Any element | `assertVisible`, `assertNotVisible`, `assertText`, `assertCount` (same selector), `within` (start a scope here) | current text, current count |

Values accept `${var}` interpolation. Variables from the flow being recorded are listed in a dropdown.

**3. Validation runs as soon as the selector, command or value changes**, before anything is recorded:
- **Selector:** unique match? (0 / 1 / many)
- **Assertion:** evaluated against the live page right now. `✓ passes now`, or `✗ Expected: "Book now" / Got: "Booking…"`.
- **Action:** checks the target is actionable (visible, enabled, not covered) **without performing it**.
- Validation runs on the **Node side through the same locator code as `uivisor test`** (`@uivisor/core` `resolveLocator` / `playwrightLocator.ts`). The popup sends the candidate command through an exposed function and gets the result back. **A step that passes here will resolve the same way on replay.** This would have caught the `css=h6:nth-child(2)` string-shorthand error immediately.
- **Record** is enabled even when validation fails (you may be recording a negative case), but the button shows a ⚠ and asks for confirmation.

**4. Buttons:**
- **Record:** appends the step only.
- **Record & perform:** appends it and runs it on the page, e.g. actually clicks or types, so recording continues from the new state.
- **Cancel** / `Esc`.

### Trigger is configurable

Default: **right-click** (`contextmenu`, with the browser menu suppressed). It can be changed per project for apps that use right-click themselves:

```yaml
# recorder config (or CLI: --inspect-trigger "Alt+Click")
recorder:
  inspectTrigger: contextmenu      # contextmenu | Alt+Click | Ctrl+Shift+Click | Shift+E | F4 ...
  passthroughModifier: Shift       # Shift+right-click → native browser menu
```

- **Mouse triggers** target the element under the click.
- **Keyboard triggers** target the element **under the mouse pointer** (tracked with `mousemove`), not the focused element.
- `Shift+A` / `Shift+W` / `Shift+S` keep working. `Shift+A` opens the same popup for the focused element, so there's one assertion UI instead of two.
- The HUD (`#uivisor-hud`) shows the current trigger: `Right-click: inspect · Shift+W: wait · Shift+S: screenshot`.

### Design notes

- **Popup isolation:** render it in a **shadow DOM** root, so the app's CSS can't restyle it and its DOM doesn't interfere with the app. Exclude it from `CAPTURE_SCRIPT`, so clicks inside the popup are **not** recorded as `tapOn` steps. Exclude it from selector match counts.
- **Popup position:** anchored to the element, flipped or clamped to stay inside the viewport. The highlight is an absolutely positioned outline overlay, not a style change on the app's element.
- **Generating selectors** happens in-page (cheap), but **match counts and validation** come from Node (authoritative), shown with a short "checking…" state.
- **Ordering:** commands recorded through the popup are inserted in sequence with captured clicks and typing, via the existing `__uivisorOverlay` → `appendCommand` path in `recorder-app/src/cli.ts`.
- **Suggested values** never include password-field values (`type=password`). Show `${var}` placeholders instead.

### Acceptance Criteria

- [ ] Right-click on any element opens the popup anchored to it, with the element highlighted; the native context menu is suppressed
- [ ] Selector candidates shown with live match counts; the most stable unique one is pre-selected; custom selector allowed
- [ ] Commands and suggested values match the element type (table above); custom value and `${var}` supported
- [ ] Validation runs immediately on every change, using the same locator logic as `uivisor test`; assertion results show expected vs got
- [ ] **Record** and **Record & perform** both append the correct YAML step; popup clicks are never recorded
- [ ] Trigger configurable (`inspectTrigger`, `--inspect-trigger`), including keyboard triggers that target the element under the pointer; `passthroughModifier` restores the native menu
- [ ] Elements without a `data-testid` get a working selector (no more empty selectors)
- [ ] `Shift+A` opens the same popup for the focused element
- [ ] Recorder integration tests (`recorder-app/src/cli.integration.test.ts`) cover open, validate and record for button, input, select and checkbox against `test-app`
