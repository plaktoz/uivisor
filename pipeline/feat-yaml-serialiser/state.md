# Pipeline State: feat-yaml-serialiser

**Task:** `recorder-app/src/yamlWriter.ts`; `startSession(path, appId)` creates file + YAML header; `appendCommand(path, cmd)` serialises + `fs.appendFileSync` (crash-safe); output compatible with `loadAndParse`; unit tests confirming round-trip parse
**Epic:** epic-complete-recording-experience
**Started:** 2026-09-02
**Status:** pr_open

## Worktree
**Path:** .worktrees/feat-yaml-serialiser
**Branch:** feat-yaml-serialiser
**Created:** 2026-09-02
**Status:** active

---

## Gate 0: Execution Plan

**Classification:** Feature
**Complexity:** Small

**Standard execution sequence:**
Gate 0 → Gate 1 → Architect → Tester Phase 1 → Coder → Tester Phase 2 → Quality Gate → Release Documenter → Deployer

| Stage | Role | Est. time |
|-------|------|-----------|
| Gate 0 | Orchestrator | 1 min |
| Gate 1 | Analyst | 3 min |
| Architect | Architect | 4 min |
| Tester Phase 1 | Tester Ensemble (Gen A + Gen B + Consolidator + Arbiter) | 4 min |
| Coder | Coder | 5 min |
| Tester Phase 2 | Tester Ensemble | 2 min |
| Quality Gate | Tester Arbiter | 2 min |
| Release Documenter | Release Documenter | 2 min |
| Deployer | Deployer | 1 min |

**Total estimate:** ~21–41 min (including retry budget)
**Cost estimate:** ~$0.05–$0.24

---

## Gate 1: Spec — yaml-serialiser

### Overview

A new package `recorder-app` (`@uivisor/recorder`) is created at the repo root alongside `uivisor-app/` and `packages/`. It exports two functions from `recorder-app/src/yamlWriter.ts`:

- **`startSession(outputPath: string, appId: string): void`** — initialises (or re-initialises) a session file by creating parent directories and writing the YAML document header. No in-memory state is retained.
- **`appendCommand(outputPath: string, cmd: Command): void`** — appends one command as a YAML list item using `fs.appendFileSync`. Each call is completely independent; no module-level buffer is maintained.

The written file is compatible with `uivisor-app/src/parser/loadAndParse`. The parser's `validateHeader` accepts `appId` at root; `parseSessionedCommand` expects the command type as the YAML key, not as a nested `type:` field.

### Key design decisions (for Coder)

1. **Command → YAML record transformation.** The `Command` type uses a `type` discriminant field plus payload fields (e.g. `{ type: 'wait', ms: 2000 }`). The YAML format uses the command type as the map key and the payload as the value (e.g. `wait: 2000`). A private `commandToRecord(cmd: Command): Record<string, unknown>` helper performs this transformation via an exhaustive `switch (cmd.type)`.

2. **Selector serialisation.** For commands with a `selector: Selector` field, the selector value is used directly as the YAML value (not wrapped in a `selector:` key), matching how `commandParser.ts` parses it. String selectors remain scalar; object selectors remain nested maps.

3. **Null-payload commands.** `reload`, `goBack`, `goForward` have no payload fields. Serialise as `{ [cmd.type]: null }` — js-yaml renders this as `reload: null\n`; `commandParser.ts` ignores the value.

4. **`startSession` uses `fs.writeFileSync`** (not `appendFileSync`) to guarantee truncation when called a second time.

5. **No imported re-use of `loadAndParse`.** The yamlWriter only depends on `@uivisor/core` (for `Command` type) and `js-yaml`. It does not import `uivisor-app`.

### Acceptance Criteria

| # | Criterion |
|---|-----------|
| AC1 | `recorder-app/package.json` exists (name: `@uivisor/recorder`, type: module, deps: `@uivisor/core: *`, `js-yaml: ^4.1.0`; devDeps: `vitest`, `typescript`) and `recorder-app/tsconfig.json` exists (strict: true, moduleResolution: bundler) |
| AC2 | `startSession(path, appId)` creates or truncates the output file and writes the exact header: `appId: <appId>\ncommands:\n` |
| AC3 | `startSession` calls `fs.mkdirSync(dir, { recursive: true })` before writing, so parent directories are created if absent |
| AC4 | `appendCommand(path, cmd)` appends a YAML list item to the file using `fs.appendFileSync` — no in-memory accumulation |
| AC5 | `appendCommand` is crash-safe: no module-level buffer; each call independently succeeds given only the output path and a Command value |
| AC6 | After one or more `appendCommand` calls, `js-yaml.load(fs.readFileSync(path, 'utf8'))` returns an object with a string `appId` property and an array `commands` property |
| AC7 | `{ type: 'tapOn', selector: { testId: 'login-submit' } }` serialises as `- tapOn:\n    testId: login-submit\n` |
| AC8 | `{ type: 'wait', ms: 2000 }` serialises as `- wait: 2000\n` |
| AC9 | `{ type: 'screenshot', path: 'screenshots/step-1.png' }` serialises as `- screenshot: screenshots/step-1.png\n` |
| AC10 | Round-trip: `startSession` + N `appendCommand` calls → `js-yaml.load` → `commands` array contains N items matching the original commands |
| AC11 | All source TypeScript compiles with `strict: true`, zero `any` types |

---

## Feature Task Breakdown

| ID | Task | Depends on | File(s) | Estimate |
|----|------|-----------|---------|---------|
| T1 | Create `recorder-app/package.json` (name `@uivisor/recorder`, type module, deps js-yaml + @uivisor/core, devDeps vitest + typescript) | — | `recorder-app/package.json` | 3 min |
| T2 | Create `recorder-app/tsconfig.json` (strict: true, moduleResolution: bundler, target: ES2022, outDir: dist) | T1 | `recorder-app/tsconfig.json` | 2 min |
| T3 | Implement private `commandToRecord(cmd: Command): Record<string, unknown>` helper with exhaustive switch on `cmd.type` | T2 | `recorder-app/src/yamlWriter.ts` | 15 min |
| T4 | Implement `startSession(outputPath, appId)`: `path.dirname` → `mkdirSync recursive` → `writeFileSync` header string | T3 | `recorder-app/src/yamlWriter.ts` | 5 min |
| T5 | Implement `appendCommand(outputPath, cmd)`: `commandToRecord(cmd)` → `yaml.dump(record, { lineWidth: -1 })` → strip doc separator if present → `appendFileSync` | T4 | `recorder-app/src/yamlWriter.ts` | 5 min |
| T6 | Write `recorder-app/src/yamlWriter.test.ts` covering all ACs; use `os.tmpdir()` + `crypto.randomUUID()` per-test dirs; `afterEach` cleanup | T5 | `recorder-app/src/yamlWriter.test.ts` | 20 min |

---

## Tests — Generator A

*Perspective: happy-path correctness and structural completeness. Covers the primary flow for each function and the most common command types.*

| # | Test name | Suite | Input | Assertion |
|---|-----------|-------|-------|-----------|
| GA1 | `creates file at the given path` | `startSession` | `tmpDir/out.yaml`, appId `myApp` | `fs.existsSync(path) === true` |
| GA2 | `file content starts with appId header` | `startSession` | same | `content.startsWith('appId: myApp')` |
| GA3 | `file content contains commands: line` | `startSession` | same | `content.includes('commands:')` |
| GA4 | `creates nested parent directories` | `startSession` | `tmpDir/a/b/c/out.yaml` | No ENOENT thrown; file created |
| GA5 | `truncates file on second call` | `startSession` | Call twice: appId `first`, then `second` | File does NOT contain `first`; contains `second` |
| GA6 | `wait command serialises to scalar` | `appendCommand` | `{ type: 'wait', ms: 2000 }` | Appended text contains `- wait: 2000` |
| GA7 | `screenshot command serialises to scalar` | `appendCommand` | `{ type: 'screenshot', path: 'screenshots/step-1.png' }` | Appended text contains `- screenshot: screenshots/step-1.png` |
| GA8 | `tapOn with testId selector serialises to nested item` | `appendCommand` | `{ type: 'tapOn', selector: { testId: 'login-submit' } }` | File contains `- tapOn:` followed by `    testId: login-submit` |
| GA9 | `goto command serialises to scalar` | `appendCommand` | `{ type: 'goto', url: 'https://example.com' }` | File contains `- goto:` with the URL value |
| GA10 | `inputText command serialises to scalar` | `appendCommand` | `{ type: 'inputText', text: 'hello world' }` | File contains `- inputText: hello world` |
| GA11 | `multiple sequential calls append in order` | `appendCommand` | 3 commands: wait 1000, screenshot, tapOn | All 3 appear in written order; no interleaving |
| GA12 | `js-yaml.load returns object with appId and commands array` | round-trip | startSession + 2 appendCommand | `typeof parsed.appId === 'string'` and `Array.isArray(parsed.commands)` |
| GA13 | `commands array length matches call count` | round-trip | startSession + 3 appendCommand | `parsed.commands.length === 3` |
| GA14 | `wait command round-trips` | round-trip | `{ type: 'wait', ms: 2000 }` | `parsed.commands[0].wait === 2000` |
| GA15 | `tapOn with testId round-trips` | round-trip | `{ type: 'tapOn', selector: { testId: 'login-submit' } }` | `parsed.commands[0].tapOn.testId === 'login-submit'` |

---

## Tests — Generator B

*Perspective: edge cases, null-payload commands, crash-safety guarantee, and error-resilience.*

| # | Test name | Suite | Input | Assertion |
|---|-----------|-------|-------|-----------|
| GB1 | `header file ends with newline` | `startSession` | `tmpDir/out.yaml`, appId `myApp` | `content.endsWith('\n')` |
| GB2 | `deeply nested path (4 levels) is created` | `startSession` | `tmpDir/w/x/y/z/out.yaml` | No throw; `fs.existsSync` true |
| GB3 | `calling twice leaves only second call content` | `startSession` | First: appId `alpha`; second: appId `beta` | File has zero occurrences of `alpha`; one of `beta` |
| GB4 | `appId with dots and hyphens preserved verbatim` | `startSession` | `appId='com.example.my-app'` | Parsed object has `appId === 'com.example.my-app'` |
| GB5 | `each appendCommand call is independent of previous calls` | `appendCommand` | Write one cmd; manually truncate file; write second cmd; verify second is present | Second cmd appears correctly without first; no stale state |
| GB6 | `wait 500 serialises correctly (variant ms value)` | `appendCommand` | `{ type: 'wait', ms: 500 }` | File contains `- wait: 500` |
| GB7 | `assertVisible with testId serialises to nested item` | `appendCommand` | `{ type: 'assertVisible', selector: { testId: 'submit-btn' } }` | File contains `- assertVisible:` then `    testId: submit-btn` |
| GB8 | `tapOn with string selector serialises as scalar` | `appendCommand` | `{ type: 'tapOn', selector: 'Login Button' }` | File contains `- tapOn:` with `Login Button` as value (quoted or unquoted) |
| GB9 | `reload (no-payload) serialises and parses back` | `appendCommand` | `{ type: 'reload' }` | js-yaml.load parses list item; key `reload` present (value may be null) |
| GB10 | `pressKey serialises to scalar` | `appendCommand` | `{ type: 'pressKey', key: 'Enter' }` | File contains `- pressKey: Enter` |
| GB11 | `goBack (no-payload) serialises and parses back` | `appendCommand` | `{ type: 'goBack' }` | js-yaml.load parses list item; key `goBack` present |
| GB12 | `5 mixed commands round-trip correctly` | round-trip | goto + tapOn + inputText + wait + screenshot | All 5 items in `parsed.commands`; each has the correct command-type key |
| GB13 | `output does not throw on js-yaml.load` | round-trip | Any valid session + 1 command | No exception from `yaml.load()` |
| GB14 | `assertVisible with text selector round-trips` | round-trip | `{ type: 'assertVisible', selector: { text: 'Submit' } }` | `parsed.commands[0].assertVisible.text === 'Submit'` |
| GB15 | `screenshot path with subdirectory round-trips` | round-trip | `{ type: 'screenshot', path: 'runs/2026/shot.png' }` | `parsed.commands[0].screenshot === 'runs/2026/shot.png'` |

---

## Tests

*Consolidator + Arbiter — Final Approved Test Plan*

**Deduplication notes:** GA1 and a subset of GB1 were merged (file creation check); GB2 supersedes GA4 (deeper path); GB3 replaces GA5 (stricter assertion — zero occurrences of first appId, not just presence of second). All tests are Vitest unit tests using real `fs` + `os.tmpdir()` isolated per-test directories; `afterEach` removes the temp directory.

**Arbiter resolution — GB5 crash-safety test:** GA had no explicit crash-safety test. GB5's approach (truncate file between two independent calls) cleanly verifies that no module-level buffer accumulates state between calls. Approved as written.

**Arbiter resolution — null-payload commands:** GB9 (reload) and GB11 (goBack) cover the null-payload edge case that neither Generator explicitly planned for in their structural tests. Both kept; the Coder must pick a serialisation that (a) produces valid YAML and (b) round-trips through `commandParser.ts` (which ignores the value for these commands).

**Arbiter resolution — GA14/GA15 vs GB12:** GA14/GA15 are scalar round-trips on individual commands; GB12 covers 5 mixed commands in a single round-trip. Both perspectives are valuable. All kept — they test different things.

**Removed as redundant:** GB6 (wait 500 — structural variant of GA6/T08, no new behaviour); GB15 (screenshot with subdirectory — structural variant of GA7/T09). GB13 (no js-yaml throw) is subsumed by the round-trip tests but kept as an explicit smoke test (T23) because it tests YAML syntactic validity independently of shape correctness.

| # | Source | Suite | Test description | Inputs | Expected outcome | How to run |
|---|--------|-------|-----------------|--------|-----------------|------------|
| T01 | GA1 | `startSession` | Creates file at the given path | `tmpDir/out.yaml`, `appId='myApp'` | `fs.existsSync(path)` is true | `npx vitest run --reporter=verbose` |
| T02 | GA2 | `startSession` | File content starts with `appId: myApp` | same as T01 | `content.startsWith('appId: myApp')` | `npx vitest run --reporter=verbose` |
| T03 | GA3 | `startSession` | File content contains `commands:` line | same as T01 | `content.includes('\ncommands:')` | `npx vitest run --reporter=verbose` |
| T04 | GB1 | `startSession` | Header ends with a newline | same as T01 | `content.endsWith('\n')` | `npx vitest run --reporter=verbose` |
| T05 | GB2 | `startSession` | Creates all parent directories (4-level deep path) | `tmpDir/w/x/y/z/out.yaml` | No ENOENT thrown; file created | `npx vitest run --reporter=verbose` |
| T06 | GB3 | `startSession` | Truncates file on second call — zero occurrences of first appId | Call twice: `appId='alpha'` then `appId='beta'` | File has 0 occurrences of `alpha`; exactly one of `beta` | `npx vitest run --reporter=verbose` |
| T07 | GB4 | `startSession` | appId with dots and hyphens preserved verbatim | `appId='com.example.my-app'` | `js-yaml.load(content).appId === 'com.example.my-app'` | `npx vitest run --reporter=verbose` |
| T08 | GA6 | `appendCommand` | `wait` serialises to `- wait: 2000` | `{ type: 'wait', ms: 2000 }` | File content includes `- wait: 2000` | `npx vitest run --reporter=verbose` |
| T09 | GA7 | `appendCommand` | `screenshot` serialises to `- screenshot: screenshots/step-1.png` | `{ type: 'screenshot', path: 'screenshots/step-1.png' }` | File includes `- screenshot: screenshots/step-1.png` | `npx vitest run --reporter=verbose` |
| T10 | GA8 | `appendCommand` | `tapOn` with `testId` selector produces nested YAML item | `{ type: 'tapOn', selector: { testId: 'login-submit' } }` | File contains `- tapOn:` on one line and `    testId: login-submit` on next | `npx vitest run --reporter=verbose` |
| T11 | GA9 | `appendCommand` | `goto` serialises with the URL as value | `{ type: 'goto', url: 'https://example.com' }` | File contains a list item with key `goto` and URL as value | `npx vitest run --reporter=verbose` |
| T12 | GA10 | `appendCommand` | `inputText` serialises to `- inputText: hello world` | `{ type: 'inputText', text: 'hello world' }` | File includes `- inputText: hello world` | `npx vitest run --reporter=verbose` |
| T13 | GB8 | `appendCommand` | `tapOn` with string selector serialises as scalar | `{ type: 'tapOn', selector: 'Login Button' }` | File contains `- tapOn:` with `Login Button` as the value (quoted or bare) | `npx vitest run --reporter=verbose` |
| T14 | GB7 | `appendCommand` | `assertVisible` with `testId` produces nested YAML item | `{ type: 'assertVisible', selector: { testId: 'submit-btn' } }` | File contains `- assertVisible:` then `    testId: submit-btn` | `npx vitest run --reporter=verbose` |
| T15 | GB9 | `appendCommand` | `reload` (null-payload) serialises to a valid YAML list item | `{ type: 'reload' }` | `js-yaml.load` parses file; `commands[n]` has key `reload` (value may be `null`) | `npx vitest run --reporter=verbose` |
| T16 | GB11 | `appendCommand` | `goBack` (null-payload) serialises to a valid YAML list item | `{ type: 'goBack' }` | `js-yaml.load` parses file; `commands[n]` has key `goBack` | `npx vitest run --reporter=verbose` |
| T17 | GB10 | `appendCommand` | `pressKey` serialises to `- pressKey: Enter` | `{ type: 'pressKey', key: 'Enter' }` | File includes `- pressKey: Enter` | `npx vitest run --reporter=verbose` |
| T18 | GA11 | `appendCommand` | Multiple sequential calls append in written order | 3 commands: wait 1000, screenshot `out.png`, tapOn `{ testId: 'x' }` | All 3 appear in file in declaration order | `npx vitest run --reporter=verbose` |
| T19 | GB5 | `appendCommand` | Crash-safe: each call independent of prior calls | Write cmd1; truncate file manually; write cmd2 at same path | cmd2 appears correctly; no stale content from cmd1 | `npx vitest run --reporter=verbose` |
| T20 | GA12 | round-trip | `js-yaml.load` returns object with string `appId` and array `commands` | startSession + 2 appendCommand | `typeof parsed.appId === 'string'` and `Array.isArray(parsed.commands)` | `npx vitest run --reporter=verbose` |
| T21 | GA13 | round-trip | `commands` array length equals `appendCommand` call count | startSession + 3 appendCommand | `parsed.commands.length === 3` | `npx vitest run --reporter=verbose` |
| T22 | GA14+GA15 | round-trip | `wait` and `tapOn` commands round-trip to correct YAML shape | wait 2000, then tapOn `{ testId: 'login-submit' }` | `commands[0].wait === 2000`; `commands[1].tapOn.testId === 'login-submit'` | `npx vitest run --reporter=verbose` |
| T23 | GB12 | round-trip | 5 mixed commands (goto + tapOn + inputText + wait + screenshot) all present in output | 5 distinct Command values | `parsed.commands` has 5 items; each has exactly the expected command-type key | `npx vitest run --reporter=verbose` |
| T24 | GB14 | round-trip | `assertVisible` with `text` selector round-trips | `{ type: 'assertVisible', selector: { text: 'Submit' } }` | `parsed.commands[0].assertVisible.text === 'Submit'` | `npx vitest run --reporter=verbose` |
| T25 | GB13 | round-trip | Output YAML does not throw on `js-yaml.load` (syntactic validity smoke test) | Any valid session + at least 1 command | No exception thrown by `yaml.load()` | `npx vitest run --reporter=verbose` |

**Total approved test cases: 25**

**Coder instructions:**
- Test file location: `recorder-app/src/yamlWriter.test.ts`
- Import `os` and `path` for temp-dir construction; `crypto.randomUUID()` for per-test isolation
- Use `afterEach(() => fs.rmSync(testDir, { recursive: true, force: true }))` for cleanup
- T15/T16 (null-payload): serialise as `{ [cmd.type]: null }` — `yaml.dump` renders `reload: null\n`; commandParser ignores the value
- T13 (string selector): `yaml.dump({ tapOn: 'Login Button' })` → `tapOn: Login Button\n` (bare scalar, no quotes needed unless special chars present)
- Run command for all tests: `npx vitest run --reporter=verbose` from `recorder-app/`

---

## Code Artifacts

| File | Description |
|------|-------------|
| `recorder-app/package.json` | Package manifest — name: `@uivisor/recorder`, type: module, deps: js-yaml + @uivisor/core, devDeps: vitest + typescript |
| `recorder-app/tsconfig.json` | TypeScript config — strict: true, moduleResolution: bundler, target: ES2022 |
| `recorder-app/src/yamlWriter.ts` | `startSession` + `appendCommand` exports; private `commandToRecord` with exhaustive switch; private `selectorToObject` helper |
| `recorder-app/src/yamlWriter.test.ts` | 25 Vitest unit tests covering all approved test cases (T01–T25) |

Root `package.json` updated to add `recorder-app` to the `workspaces` array.

---

## Test Results

**Run:** `npm test` from `recorder-app/` (vitest run)

```
 ✓ src/yamlWriter.test.ts (25 tests) 23ms

 Test Files  1 passed (1)
      Tests  25 passed (25)
   Duration  382ms
```

**TypeScript:** `tsc --noEmit` from `recorder-app/` — 0 errors, 0 warnings.

---

## Quality Gate

**Verdict: PASS**
- Tests: 25/25 pass
- TypeScript: tsc --noEmit exits 0
- All 11 ACs satisfied

## PR

https://github.com/plaktoz/uivisor/pull/22
