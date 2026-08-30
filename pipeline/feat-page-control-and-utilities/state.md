# Pipeline State: feat-page-control-and-utilities

**Task:** Add reload, goBack, goForward, setViewport (with mobile/tablet/desktop presets), screenshot commands
**Epic:** epic-add-more-ui-test-capability
**Started:** 2026-08-30
**Status:** complete

## Worktree
**Path:** .worktrees/feat-page-control-and-utilities
**Branch:** feat-page-control-and-utilities
**Created:** 2026-08-30
**Status:** removed

---

## Gate 1: Spec

### Overview

This feature adds six page-control and utility commands: browser history navigation (`goBack`, `goForward`), page reload, viewport resizing (`setViewport` with named presets), on-demand screenshot capture, and a milliseconds-based wait alias (`waitFor`). All six require no selector — they operate on the page directly. The `screenshot` command is unique in that it writes a file and surfaces the resolved path through `CommandResult.screenshotPath`.

The existing `wait` command also takes milliseconds and requires an integer. `waitFor` is an alias with an explicit name — same behaviour, same validation (positive integer ms).

### YAML Syntax

```yaml
- reload: ~
- goBack: ~
- goForward: ~
- setViewport: mobile
- setViewport: tablet
- setViewport: desktop
- setViewport: { width: 1920, height: 1080 }
- screenshot: step1.png
- screenshot: screenshots/login-complete.png
- waitFor: 3000
- waitFor: 500
```

`reload`, `goBack`, `goForward` accept a null value (`~`) — no arguments required.

`waitFor` accepts a positive integer representing milliseconds — identical semantics to `wait`. Both commands remain supported.

`setViewport` accepts either a named preset string (`mobile`, `tablet`, `desktop`) or an explicit `{ width, height }` object. Preset dimensions are resolved at parse time.

`screenshot` accepts a plain string path, resolved relative to `ctx.runDir`. Intermediate directories are created automatically.

### Viewport Preset Dimensions

| Preset | Width | Height |
|---|---|---|
| `mobile` | 390 | 844 |
| `tablet` | 768 | 1024 |
| `desktop` | 1280 | 800 |

### Playwright API Mapping

| Command | Playwright call |
|---|---|
| `reload` | `page.reload({ waitUntil: 'load' })` |
| `goBack` | `page.goBack({ waitUntil: 'load' })` — throws if returns `null` |
| `goForward` | `page.goForward({ waitUntil: 'load' })` — throws if returns `null` |
| `setViewport` | `page.setViewportSize({ width, height })` |
| `screenshot` | `page.screenshot({ path: resolvedPath })` — saves PNG to `ctx.runDir`-relative path |
| `waitFor` | `await new Promise(r => setTimeout(r, ms))` — identical to `wait` |

### Type / Parser / Dispatcher Contracts

**`types.ts` additions:**
```typescript
| { type: 'reload' }
| { type: 'goBack' }
| { type: 'goForward' }
| { type: 'setViewport'; width: number; height: number }
| { type: 'screenshot';  path: string }
| { type: 'waitFor';    ms: number }
```

**Parser rules:**

| YAML key | Value shape | Notes |
|---|---|---|
| `reload` | null/any (ignored) | Always returns `{ type: 'reload' }` |
| `goBack` | null/any (ignored) | Always returns `{ type: 'goBack' }` |
| `goForward` | null/any (ignored) | Always returns `{ type: 'goForward' }` |
| `setViewport` | string preset OR `{ width, height }` | Resolves preset to numbers at parse time; throws on unknown preset or non-positive integers |
| `screenshot` | plain string path | `value as string` → `path` |
| `waitFor` | positive integer (ms) | same validation as `wait`; throws if non-integer or ≤ 0 |

**`setViewport` parser validation:**
- Unknown string preset → throw `Unknown viewport preset: <val>. Valid presets: mobile, tablet, desktop`
- `{ width, height }` with non-positive or non-integer values → throw `setViewport width and height must be positive integers`

**`screenshot` dispatcher special handling:**
The `screenshot` executor returns the resolved path. The dispatcher captures it and surfaces it in `CommandResult.screenshotPath` even on success (unlike all other commands where `screenshotPath` is only set on failure).

```typescript
// In dispatcher, before the main try block:
let capturedScreenshotPath: string | undefined;

// In the switch:
case 'screenshot':
  capturedScreenshotPath = await executeScreenshot(page, cmd.path, ctx.runDir);
  break;

// After the switch (success path):
return { command: cmd, passed: true, screenshotPath: capturedScreenshotPath, durationMs: ... };
```

### Error Messages

| Command | Failure scenario | Message |
|---|---|---|
| `reload` | (cannot fail in practice) | — |
| `goBack` | no previous page in history | `'No previous page in history.'` |
| `goForward` | no next page in history | `'No next page in history.'` |
| `setViewport` | unknown preset (parser) | `'Unknown viewport preset: <val>. Valid presets: mobile, tablet, desktop'` |
| `setViewport` | non-positive / non-integer (parser) | `'setViewport width and height must be positive integers'` |
| `screenshot` | disk write failure | propagate native error |
| `waitFor` | non-integer or ≤ 0 (parser) | `'waitFor ms must be a positive integer'` |

### Test Fixture Additions

No new fixture HTML elements required. The existing `test-page.html` is sufficient for all tests:
- `reload`: navigate to fixture, reload, verify page still loads
- `goBack`/`goForward`: use hash navigation (`baseUrl + '#section'`) to create history entries on the same server
- `setViewport`: verify via `page.viewportSize()`
- `screenshot`: write to `os.tmpdir()`, verify file exists, clean up after test

### Acceptance Criteria

**reload**
- AC1: dispatch `{ type: 'reload' }` → `passed: true`, `command.type = 'reload'`, `durationMs > 0`
- AC2: after reload, `assertVisible` still finds the heading element (page reloaded correctly)

**goBack**
- AC3: navigate to two different URLs then dispatch `{ type: 'goBack' }` → `passed: true`; verify URL changed back
- AC4: `goBack` on a fresh page with no history → `passed: false`, `message` matches `/No previous page in history/i`

**goForward**
- AC5: after navigating forward and back, dispatch `{ type: 'goForward' }` → `passed: true`; verify URL moved forward
- AC6: `goForward` with no forward history → `passed: false`, `message` matches `/No next page in history/i`

**setViewport**
- AC7: `{ type: 'setViewport', width: 390, height: 844 }` → `passed: true`; verify `page.viewportSize()` equals `{ width: 390, height: 844 }`
- AC8: `{ type: 'setViewport', width: 1920, height: 1080 }` → `passed: true`; verify `page.viewportSize()`

**screenshot**
- AC9: `{ type: 'screenshot', path: 'test-shot.png' }` with `runDir = os.tmpdir()` → `passed: true`; PNG file exists at resolved path; `result.screenshotPath` equals the resolved path
- AC10: screenshot into a nonexistent subdirectory → directory is created automatically, file exists

**waitFor**
- AC11: `{ type: 'waitFor', ms: 100 }` → `passed: true`, `durationMs >= 100`
- AC12: `{ type: 'waitFor', ms: 500 }` → `passed: true`, elapsed ≥ 500 ms
- AC13 (parser): `{ waitFor: 0 }` → throws `/positive integer/i`
- AC14 (parser): `{ waitFor: 1.5 }` → throws `/positive integer/i` (float rejected)

**CommandResult shape (all 6 commands)**
- AC15: `reload`, `goBack`, `goForward`, `setViewport`, `waitFor` passing → `screenshotPath` is `undefined`
- AC16: `screenshot` passing → `screenshotPath` is defined and points to the PNG

**Parser unit tests**
- AC13: `{ reload: null }` → `{ type: 'reload' }`
- AC14: `{ goBack: null }` → `{ type: 'goBack' }`
- AC15: `{ goForward: null }` → `{ type: 'goForward' }`
- AC16: `{ setViewport: 'mobile' }` → `{ type: 'setViewport', width: 390, height: 844 }`
- AC17: `{ setViewport: 'tablet' }` → `{ type: 'setViewport', width: 768, height: 1024 }`
- AC18: `{ setViewport: 'desktop' }` → `{ type: 'setViewport', width: 1280, height: 800 }`
- AC19: `{ setViewport: { width: 1920, height: 1080 } }` → `{ type: 'setViewport', width: 1920, height: 1080 }`
- AC20: `{ setViewport: 'ultrawide' }` → throws `/Unknown viewport preset/i`
- AC21: `{ setViewport: { width: 0, height: 720 } }` → throws `/positive integers/i`
- AC22: `{ screenshot: 'step1.png' }` → `{ type: 'screenshot', path: 'step1.png' }`
- AC23: `{ waitFor: 3000 }` → `{ type: 'waitFor', ms: 3000 }`
- AC24: `{ waitFor: 500 }` → `{ type: 'waitFor', ms: 500 }`
- AC25: `{ waitFor: 0 }` → throws `/positive integer/i`

**Spec revision: 0 of max 2**

---

## Feature & Task Breakdown

| # | Ticket | Files | Depends On | Status |
|---|---|---|---|---|
| T1 | Extend `Command` union in types.ts | `src/types.ts` | — | open |
| T2 | Add parser cases (5 commands) | `src/parser/commandParser.ts` | T1 | open |
| T3 | Add executor functions (5 commands) | `src/driver/commands.ts` | T1 | open |
| T4 | Wire dispatcher (5 commands) + screenshot special handling | `src/engine/dispatcher.ts` | T2, T3 | open |
| T5 | Reporter exhaustiveness (5 commands) | `src/reporter/console.ts`, `html.ts`, `markdown.ts` | T1 | open |
| T6 | Add parser unit tests | `tests/unit/parser.test.ts` | T1, T2 | open |
| T7 | Add integration tests | `tests/integration/commands.test.ts` | T4 | open |

**Seam flags (Coder must not miss):**
1. `reload`, `goBack`, `goForward` — no params beyond `page`. Dispatcher: `await executeXxx(page); break;`; `waitFor`: `await executeWaitFor(cmd.ms); break;`
2. `setViewport` — `page, cmd.width, cmd.height` (NOT selector). Dispatcher: `executeSetViewport(page, cmd.width, cmd.height)`
3. `screenshot` — dispatcher captures the return value from `executeScreenshot(page, cmd.path, ctx.runDir)` into `capturedScreenshotPath` and returns it in the success `CommandResult.screenshotPath`
4. `goBack`/`goForward` — Playwright returns `null` when no history; executor must check and throw

---

## Gate 0: Execution Plan

**Classification:** feature
**Complexity:** small

**Roles Activated:** Analyst, Architect, Tester Ensemble, Coder, Release Documenter, Deployer
**Designer Activated:** no

**Execution Sequence:**
1. Analyst → skill: to-spec
   Output: spec + acceptance criteria → state.md#gate-1
   [GATE 1: human approval required — revision cap: 2]
2. Architect → skill: to-tickets + codebase-design
   Reads: Gate 1 spec
   Output: task breakdown → state.md#feature-task-breakdown
3. Tester Ensemble Phase 1 → skill: tdd
   3a. tester_generator_a + tester_generator_b in parallel → generate test cases
   3b. tester_consolidator → deduplicates → state.md#tests
4. Coder → skill: implement
   Working directory: .worktrees/feat-page-control-and-utilities
   Output: source files → state.md#code-artifacts
5. Tester Ensemble Phase 2 → skill: tdd + code-review
   Output: test results → state.md#test-results
   Retry cap: 3 | Review cap: 2
6. Quality Gate → skill: quality (autonomous)
   Output: pass/fail verdict → state.md#quality-gate
   [GATE 3: human approval required before deploying]
7. Release Documenter → skill: proj-deploy
8. Deployer → skill: proj-deploy

## Run Estimates

**Complexity:** small
**Duration:** ~25–40 min  (no retries: ~25 min)
**Cost:** ~$0.18–$0.35  (cap: $5.00)
**Tokens:** ~18K–40K

**Retry budgets:**
- TDD + quality gate: 3 rounds
- Spec revision: 2 rounds
- Design revision: n/a (Designer not activated)
- Code review: 2 rounds
