# Epic State: epic-complete-recording-experience

**Epic:** Complete recording experience — start a browser with Playwright and record user actions to create a flow.yaml on the fly
**Started:** 2026-09-01
**Status:** complete

---

## Gate 0: Epic Spec

### Goal
Ship `uivisor-record` — a standalone Playwright-powered CLI that captures real user interactions in a headed browser and emits a ready-to-run `flow.yaml` requiring zero manual editing. Deliver this on top of a shared `@uivisor/core` library that cleanly separates reusable primitives from both the test runner and the recorder.

### Repository Layout (post-epic)
```
packages/
  core/           → @uivisor/core  (types, selectorParser, selectorHeuristics)
uivisor-app/      → uivisor CLI    (test runner; depends on @uivisor/core)
recorder-app/     → uivisor-record (standalone recorder; depends on @uivisor/core)
record-app/       → demo web app   (recording target, like test-app for testing)
```

### In Scope
- `@uivisor/core` extraction (F1 — merged PR #18)
- Selector heuristics engine: `testId → text → role+name → label → placeholder` (F2)
- DOM event capture layer: `page.addInitScript` + `page.exposeFunction` (F3)
- YAML serialiser: `fs.appendFileSync` per command, crash-safe (F4)
- In-browser overlay: `Shift+A` (assertion picker), `Shift+W` (wait prompt), `PrintScreen`/`Shift+S` (screenshot) (F5)
- `recorder-app/` standalone CLI: `uivisor-record <url> --output <file>` (F6)
- `record-app/` demo web app (F7 — merged PR #19)

### Acceptance Criteria
1. `uivisor-record http://localhost:5173/login --output flows/recorded.yaml` opens headed Chromium
2. Clicking `data-testid="login-submit"` → `- tapOn: { testId: login-submit }` in file
3. Typing into an input → `- inputText: { element: <selector>, text: <typed value> }`
4. Close tab or Ctrl+C → flush file + exit 0
5. Written file parses and runs via `uivisor test`
6. `Shift+A` → assertion picker; choosing "Assert visible" → `- assertVisible: <selector>`
7. `Shift+W` → ms prompt → `- wait: <ms>`
8. `PrintScreen` / `Shift+S` → `- screenshot: screenshots/step-{n}.png`
9. Incremental writes — crash leaves valid partial YAML
10. `uivisor-record --help` documents flags
11. Unit test: selector heuristic on element with `data-testid` returns `{ testId: ... }`
12. Existing `uivisor test` flows unaffected

---

## Gate 1: Feature Breakdown

| # | Feature | Description | Complexity | Depends On | Est. Duration | Est. Cost |
|---|---|---|---|---|---|---|
| 1 | Monorepo setup | Create `packages/core`, move `types.ts`+`selectorParser.ts`, root workspaces | medium | — | ~38 min | ~$0.12–0.28 |
| 2 | Selector heuristics engine | `packages/core/src/selectorHeuristics.ts`; priority chain; unit tests | small | 1 | ~21 min | ~$0.05–0.12 |
| 3 | DOM event capture layer | Injected script + `page.exposeFunction`; all event types → Commands | large | 1, 2 | ~58 min | ~$0.28–0.55 |
| 4 | YAML serialiser | `recorder-app/src/yamlWriter.ts`; `start`+`append`; crash-safe; round-trip tests | small | 1 | ~21 min | ~$0.05–0.12 |
| 5 | In-browser overlay | Injected HUD; Shift+A/Shift+W/PrintScreen+Shift+S; communicates via `__uivisorOverlay` | large | 1 | ~58 min | ~$0.28–0.55 |
| 6 | recorder-app CLI | `recorder-app/` package; `uivisor-record` binary; integration smoke test | medium | 1,2,3,4,5 | ~38 min | ~$0.12–0.28 |
| 7 | record-app demo app | Vite+React demo app; login+tasks+profile; data-testid everywhere | small | — | ~21 min | ~$0.05–0.12 |

**Wave 0 (parallel):** F1 + F7 — both no deps, run simultaneously
**Wave 1 (parallel, after F1):** F2 + F4 + F5
**Wave 2 (after F2):** F3
**Wave 3 (after F3+F4+F5):** F6

---

## Feature Runs

| # | Feature | Run | Status | Worktree | PR |
|---|---|---|---|---|---|
| 1 | Monorepo setup | feat-monorepo-setup | merged | removed | https://github.com/plaktoz/uivisor/pull/18 |
| 2 | Selector heuristics engine | feat-selector-heuristics-engine | merged | removed | https://github.com/plaktoz/uivisor/pull/21 |
| 3 | DOM event capture layer | feat-dom-event-capture-layer | merged | removed | https://github.com/plaktoz/uivisor/pull/24 |
| 4 | YAML serialiser | feat-yaml-serialiser | merged | removed | https://github.com/plaktoz/uivisor/pull/22 |
| 5 | In-browser overlay | feat-in-browser-overlay | merged | removed | https://github.com/plaktoz/uivisor/pull/23 |
| 6 | recorder-app CLI | feat-recorder-app-cli | merged | removed | https://github.com/plaktoz/uivisor/pull/25 |
| 7 | record-app demo app | feat-record-app-demo-app | merged | removed | https://github.com/plaktoz/uivisor/pull/19 |
