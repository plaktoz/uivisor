# Signoff Package: feat-yaml-serialiser

**Feature:** YAML serialiser — crash-safe `startSession` / `appendCommand` for recorder-app
**Epic:** epic-complete-recording-experience (F4 of 7)
**Date:** 2026-09-02
**Status:** Quality Gate PASS — ready to merge

---

## Feature Summary

Adds `recorder-app/src/yamlWriter.ts` to the new `@uivisor/recorder` package. Exports two functions:

- **`startSession(outputPath, appId)`** — creates (or truncates) the output file, creates parent directories recursively, and writes the YAML document header (`appId: <appId>\ncommands:\n`). Uses `fs.writeFileSync`, guaranteeing a clean slate on every call.
- **`appendCommand(outputPath, cmd)`** — converts a `Command` value to a YAML list item via a private `commandToRecord` switch, then calls `fs.appendFileSync`. No in-memory buffer is maintained; each call is fully independent of all prior calls, making the serialiser crash-safe.

The output format is compatible with `uivisor-app`'s `loadAndParse`: the command type is the YAML map key, the payload is the value (e.g. `- wait: 2000`, `- tapOn:\n  testId: login-submit`).

---

## Files Delivered

| File | Change | Description |
|------|--------|-------------|
| `recorder-app/package.json` | NEW | `@uivisor/recorder` package manifest — type: module, deps: js-yaml ^4.1.0 + @uivisor/core, devDeps: vitest + typescript |
| `recorder-app/tsconfig.json` | NEW | TypeScript config — strict: true, moduleResolution: bundler, target: ES2022 |
| `recorder-app/src/yamlWriter.ts` | NEW | `startSession` + `appendCommand` exports; private `commandToRecord` exhaustive switch; private `selectorToObject` helper |
| `recorder-app/src/yamlWriter.test.ts` | NEW | 25 Vitest unit tests (T01–T25) covering all 11 ACs |
| `package.json` (root) | MODIFIED | Added `recorder-app` to workspaces array |

---

## Test Results

```
 ✓ src/yamlWriter.test.ts (25 tests) 23ms

 Test Files  1 passed (1)
      Tests  25 passed (25)
   Duration  ~389ms
```

**TypeScript:** `tsc --noEmit` — 0 errors, 0 warnings.

**Quality Gate:** PASS — 25/25 tests, tsc clean, all 11 ACs satisfied.

---

## Acceptance Criteria

| # | Criterion | Status |
|---|-----------|--------|
| AC1 | `recorder-app/package.json` and `recorder-app/tsconfig.json` exist with correct config | PASS |
| AC2 | `startSession` writes exact header `appId: <appId>\ncommands:\n` | PASS |
| AC3 | `startSession` calls `fs.mkdirSync(dir, { recursive: true })` before writing | PASS |
| AC4 | `appendCommand` uses `fs.appendFileSync` — no in-memory accumulation | PASS |
| AC5 | `appendCommand` is crash-safe — no module-level buffer | PASS |
| AC6 | `js-yaml.load(file)` returns object with string `appId` and array `commands` | PASS |
| AC7 | `tapOn` with `testId` selector serialises as `- tapOn:\n    testId: login-submit\n` | PASS |
| AC8 | `wait 2000` serialises as `- wait: 2000\n` | PASS |
| AC9 | `screenshot` serialises as `- screenshot: screenshots/step-1.png\n` | PASS |
| AC10 | Round-trip: N `appendCommand` calls → `commands` array length N, correct values | PASS |
| AC11 | All source TypeScript compiles with `strict: true`, zero `any` types | PASS |

---

## Usage Example

```typescript
import { startSession, appendCommand } from '@uivisor/recorder';

// Initialise a new recording session
startSession('flows/recorded.yaml', 'my-app');

// Append commands as the user interacts
appendCommand('flows/recorded.yaml', { type: 'goto', url: 'https://example.com/login' });
appendCommand('flows/recorded.yaml', { type: 'tapOn', selector: { testId: 'login-submit' } });
appendCommand('flows/recorded.yaml', { type: 'inputText', text: 'hello@example.com' });
appendCommand('flows/recorded.yaml', { type: 'wait', ms: 500 });
appendCommand('flows/recorded.yaml', { type: 'screenshot', path: 'screenshots/step-1.png' });
appendCommand('flows/recorded.yaml', { type: 'reload' });
```

Resulting `flows/recorded.yaml`:

```yaml
appId: my-app
commands:
- goto: https://example.com/login
- tapOn:
    testId: login-submit
- inputText: hello@example.com
- wait: 500
- screenshot: screenshots/step-1.png
- reload: null
```

This file can be executed directly with `uivisor test flows/recorded.yaml`.
