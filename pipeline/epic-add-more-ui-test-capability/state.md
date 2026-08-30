# Epic State: epic-add-more-ui-test-capability

**Epic:** add more ui test capability
**Started:** 2026-08-30
**Status:** complete

---

## Gate 0: Epic Spec

### Goal

Expand the uivisor YAML DSL with the additional assertions, interaction commands, and navigation controls that are currently absent, making the runner capable of covering real-world UI test scenarios end-to-end without resorting to `evaluate` workarounds or external tooling.

### Background

uivisor is a YAML-driven Playwright wrapper that turns `.yaml` flow files into browser test runs. It already handles navigation (`goto`, `assertUrl`), basic interaction (`tapOn`, `inputText`, `scroll`), visibility assertions (`assertVisible`, `assertNotVisible`), and flow composition (`runFlow`, `shared: true`). The CLI is CI-ready (exit codes, `--tag`, `--reporter`). The command surface is the only meaningful gap: nine commands cover the happy path but nothing else.

### User Needs

1. **Richer assertions** — users need to verify what text an element contains, what value a form field holds, how many items match a selector, and whether an element is in a specific state (enabled/disabled/checked).
2. **More interaction primitives** — users need to trigger keyboard events (Enter, Tab, Escape, arrow keys), interact with `<select>` dropdowns and checkboxes, and perform less-common pointer actions (hover, double-click).
3. **Navigation and page control** — users need to reload the page, go back/forward in history, and resize the viewport for responsive testing.
4. **Debugging aid** — users need an on-demand screenshot step and a way to clear a field without retyping into it.

### Scope

**In scope:**
- New assertion commands: `assertText`, `assertValue`, `assertCount`, `assertEnabled`, `assertDisabled`, `assertChecked`, `assertUnchecked`
- New interaction commands: `pressKey`, `selectOption`, `check`, `uncheck`, `hover`, `doubleClick`, `clearText`
- New page-control commands: `reload`, `goBack`, `goForward`, `setViewport` (accepts raw `width`/`height` or named presets: `mobile`, `tablet`, `desktop`)
- New utility command: `screenshot` (saves PNG to a configurable path)
- All new commands follow the existing YAML key/value pattern and share the same selector strategies already in use

**Out of scope:**
- `evaluate` (arbitrary JS execution) — too broad for this epic, deferred
- Network mocking / request interception — separate epic
- Multi-tab or multi-browser orchestration — separate epic
- Per-command timeout overrides — separate epic
- Changes to the test-app or reporter output format

### Non-Goals

- Changing the CLI interface or existing commands
- Modifying the report generation logic
- Touching `shared:` / `runFlow` composition mechanics

---

## Gate 1: Feature Breakdown

| # | Feature | Description | Complexity | Depends On | Est. Duration | Est. Cost |
|---|---|---|---|---|---|---|
| 1 | Assertion Commands | Add `assertText`, `assertValue`, `assertCount`, `assertEnabled`, `assertDisabled`, `assertChecked`, `assertUnchecked` | medium | — | ~44–80 min | ~$0.29–$0.49 |
| 2 | Interaction Commands | Add `pressKey`, `selectOption`, `check`, `uncheck`, `hover`, `doubleClick`, `clearText` | medium | 1 | ~44–80 min | ~$0.29–$0.49 |
| 3 | Page Control & Utilities | Add `reload`, `goBack`, `goForward`, `setViewport` (with `mobile`/`tablet`/`desktop` presets), `screenshot` | small | 2 | ~25–40 min | ~$0.29–$0.46 |

**Execution sequence:** sequential (1 → 2 → 3)

**Why sequential:** all three features modify the same core files — `src/types.ts` (Command union), `src/engine/commandParser.ts` (YAML key switch), and `src/engine/dispatcher.ts` (dispatch switch). Parallel branches would produce guaranteed merge conflicts on every PR merge.

**Epic totals (sequential path):** ~113–200 min | ~$0.87–$1.44
**Epic totals (parallel path):** N/A — sequential required
**Combined cost cap:** $15.00 ($5.00 × 3 features, each capped independently)

---

---

## Feature Runs

| # | Feature | Run | Status | Worktree | PR |
|---|---|---|---|---|---|
| 1 | Assertion Commands | feat-assertion-commands | complete | removed | https://github.com/plaktoz/uivisor/pull/8 |
| 2 | Interaction Commands | feat-interaction-commands | complete | removed | https://github.com/plaktoz/uivisor/pull/9 |
| 3 | Page Control & Utilities | feat-page-control-and-utilities | complete | removed | https://github.com/plaktoz/uivisor/pull/10 |

---

### Success Criteria

- Each new command is covered by at least one passing integration test in the `test-app` fixture
- All existing tests continue to pass (no regressions)
- Each command is documented with a YAML example in the README
