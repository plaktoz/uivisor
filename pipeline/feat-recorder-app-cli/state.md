# Pipeline State: feat-recorder-app-cli

**Task:** `recorder-app/` package with `uivisor-record` binary; `args.ts` (`--output`, `--base-url`, `--help`); mount capture layer + overlay + YAML writer; terminal echo of each command; session end on `page.on('close')` and `SIGINT` — both flush and exit 0; integration smoke test
**Epic:** epic-complete-recording-experience
**Started:** 2026-09-02
**Status:** merged
**PR:** https://github.com/plaktoz/uivisor/pull/25

---

## Gate 0

**Classification:** feature
**Complexity:** medium
**Execution:** standard 7-step sequence
**ETA:** ~38–55 min, ~$0.12–$0.28

---

## Gate 1: Acceptance Criteria

- AC1: `recorder-app/src/args.ts` exports `parseArgs(argv: string[]): RecordArgs`; default url `"http://localhost:5173"`, default output `"recorded.yaml"`
- AC2: `--output` / `-o <file>` sets `outputPath`
- AC3: `--base-url <url>` overrides positional url
- AC4: `--help` / `-h` prints usage to stdout and calls `process.exit(0)`
- AC5: `recorder-app/src/cli.ts` imports `parseArgs` from `./args.js`, `startSession`/`appendCommand` from `./yamlWriter.js`, `CAPTURE_SCRIPT` from `@uivisor/core`, and `OVERLAY_SCRIPT` from `./overlay.js`
- AC6: CLI calls `startSession(outputPath, url)` before opening browser
- AC7: `page.exposeFunction('__uivisorCapture', ...)` and `page.exposeFunction('__uivisorOverlay', ...)` both call `appendCommand` and `console.log`
- AC8: `page.addInitScript(CAPTURE_SCRIPT)` and `page.addInitScript(OVERLAY_SCRIPT)` called before `page.goto(url)`
- AC9: `page.on('close', ...)` and `process.on('SIGINT', ...)` both call `browser.close()` then `process.exit(0)`
- AC10: `recorder-app/package.json` has `"bin": { "uivisor-record": "./dist/cli.js" }` and `playwright` in `dependencies`
- AC11: `tsconfig.build.json` extends base, sets `noEmit: false` + `outDir: "dist"`; `"build"` script uses `tsc -p tsconfig.build.json`
- AC12: `parseArgs` unit tests cover: no args (defaults), `--output`, `-o`, `--base-url`, positional url, `--help` exit

---

## Gate 2: Architect

- T1: `args.ts` — `parseArgs` + `RecordArgs` type
- T2: `cli.ts` — session lifecycle (Playwright setup, exposeFunction ×2, addInitScript ×2, goto, close handlers)
- T3: `tsconfig.build.json` + update `package.json` (bin + playwright dep + updated build script)
- T4: `cli.test.ts` — `parseArgs` unit tests

---

## Tests — Generator A

### Suite: parseArgs unit tests

```
describe('parseArgs', () => {
  it('no args: defaults url=http://localhost:5173, outputPath=recorded.yaml')
  it('positional url: sets url')
  it('--output <file>: sets outputPath')
  it('-o <file>: sets outputPath (short alias)')
  it('--base-url <url>: overrides url')
  it('--help: prints usage and exits 0')
  it('unknown flag: throws Error')
})
```

---

## Tests — Generator B

### Suite: parseArgs unit tests

```
describe('parseArgs', () => {
  it('no args: default url and outputPath')
  it('positional arg sets url')
  it('--output <file>: sets outputPath')
  it('-o <file>: short alias for --output')
  it('--base-url <url>: overrides url, beats positional')
  it('--help: calls process.exit(0)')
  it('-h: calls process.exit(0)')
  it('unknown flag: throws Error')
  it('--output without value: throws Error')
  it('--base-url without value: throws Error')
})
```

---

## Tests

### Final consolidated test plan (arbiter)

```
describe('parseArgs', () => {
  // setup: vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); })

  it('no args: url defaults to http://localhost:5173 and outputPath to recorded.yaml')
  it('positional url sets url')
  it('--output <file> sets outputPath')
  it('-o <file> sets outputPath (short alias)')
  it('--base-url <url> overrides url')
  it('--base-url beats positional url when both provided')
  it('--help prints to stdout and calls process.exit(0)')
  it('-h calls process.exit(0)')
  it('unknown flag throws Error')
  it('--output without value throws Error')
})
```

---

## Coder Progress

- [x] T1: args.ts
- [x] T2: cli.ts
- [x] T3: tsconfig.build.json + package.json
- [x] T4: cli.test.ts
- [x] Tests green (67/67)
- [x] Committed (7c2d83f)
- [x] PR open (https://github.com/plaktoz/uivisor/pull/25)
