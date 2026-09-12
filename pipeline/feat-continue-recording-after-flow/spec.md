# Spec: Continue Recording After Flow Replay

**Feature:** `feat-continue-recording-after-flow`
**Author:** Analyst
**Date:** 2026-09-12
**Status:** Draft — awaiting Gate 1 approval

---

## 1. Overview

Add a `--run-flow` flag to `uivisor-record`. When supplied, the recorder first replays one or more existing flow files (in sequence) through Playwright to bring the browser to a known state, then enters live-recording mode. New user interactions are written to a new output file that begins with `runFlow:` references to each input flow followed by the newly captured commands. The input flow files are never modified.

---

## 2. CLI Interface

### New flag

```
--run-flow <paths>
```

- **Type:** string (comma-delimited list of one or more file paths)
- **Aliases:** none
- **Position:** named flag, not positional
- **Default:** none (flag is optional)
- **Example:**
  ```
  uivisor-record --run-flow ./setup.yaml,./login.yaml --output ./tests/new-flow.yaml
  ```

### Updated `RecordArgs` interface (in `args.ts`)

```ts
export interface RecordArgs {
  url: string;
  outputPath: string;
  runFlowPaths: string[];   // NEW: [] when flag absent
}
```

### Interaction with `url` / positional argument

- When `--run-flow` is given and no `url` / `--base-url` is supplied by the user, `url` is derived at startup by reading the `appId:` (or `url:`) field from the **first** flow file listed.
- If the user also supplies an explicit `url` or `--base-url`, that value overrides the derived one.
- `url` is still used as the `appId:` value written to the output file header.

### Updated HELP text

```
uivisor-record [url] [options]

Arguments:
  url                        URL to open in Playwright browser (default: "http://localhost:5173")

Options:
  -o, --output <file>        Output YAML file path (default: "recorded.yaml")
  --base-url <url>           Base URL override (overrides positional url)
  --run-flow <paths>         Comma-delimited list of flow YAML files to replay before recording.
                             The output file will reference these flows via runFlow: entries.
  -h, --help                 Show help
```

### Validation rules

| Rule | Error message |
|---|---|
| Each path in `--run-flow` must exist on disk | `--run-flow: file not found: <path>` |
| Each path in `--run-flow` must end in `.yaml` or `.yml` | `--run-flow: file must be a YAML flow file: <path>` |
| Output path must not equal any input flow path (after `path.resolve`) | `--run-flow: output file "<out>" would overwrite input flow "<input>" — use a different --output path` |
| First flow file must have a parseable `appId:` or `url:` header | `--run-flow: cannot read appId from first flow file: <path>` |

Validation is performed in `parseArgs` for path-count/extension checks, and in a new `validateRunFlowPaths(args)` helper called in `cli.ts` before the browser is launched, for the file-not-found and appId checks.

---

## 3. Behaviour Spec

### 3.1 Startup sequence (when `--run-flow` is present)

1. `parseArgs` populates `runFlowPaths: string[]` (paths as supplied, not resolved).
2. CLI validates each path: exists, ends with `.yaml`/`.yml`, output path not in input list.
3. CLI reads the `appId:` (or `url:`) field from the first input flow using `js-yaml.load`. If `url` was not explicitly set by the caller, assign this value to `url`.
4. `startSession(outputPath, url)` is called once, creating the output file.
5. For each input flow path (in order), `appendCommand(outputPath, { type: 'runFlow', path: <relative-path> })` is called, writing a `runFlow:` entry to the output file. The path written is **relative from the output file's directory to the input flow file** (computed using `path.relative(path.dirname(outputPath), path.resolve(inputPath))`).
6. The Playwright browser is launched (`chromium.launch`).
7. The flows are replayed in sequence through Playwright (see §3.2). If any flow fails, the recorder aborts with a non-zero exit code and an error message; the partial output file is left on disk.
8. `__uivisorCapture` and `__uivisorOverlay` are exposed on the page (same as today).
9. `CAPTURE_SCRIPT` and `OVERLAY_SCRIPT` are injected (same as today).
10. The page is now in live-recording mode. All subsequent user interactions are appended to the output file after the `runFlow:` entries.

### 3.2 Replay execution

- Each input flow file is loaded and its commands are executed in order through Playwright.
- Replay must support all command types currently implemented in uivisor-app's dispatcher (goto, tapOn, inputText, assertVisible, assertUrl, assertText, wait, waitFor, scroll, pressKey, selectOption, check, uncheck, hover, doubleClick, clearText, reload, goBack, goForward, setViewport, screenshot, within, runFlow, inputTextTargeted, assertNotVisible, assertValue, assertCount, assertEnabled, assertDisabled, assertChecked, assertUnchecked).
- Replay uses the same Playwright page instance that will be used for recording.
- Replay commands are **not** written to the output file (only the `runFlow:` reference is written in step 5).
- If a replayed `runFlow:` command is encountered inside an input flow, it is executed recursively (nested flows are supported).
- If an assertion command fails during replay (e.g., `assertVisible` cannot find the element), the recorder stops with a non-zero exit code and logs: `[replay] FAILED: <command> in <file>: <message>`. The output file is preserved as-is (with the `runFlow:` header entries but no user-captured commands).
- Console progress logging during replay: `[replay] <file>: <n>/<total> commands`.

### 3.3 Output file structure

Given:
```
uivisor-record --run-flow ./flows/setup.yaml,./flows/login.yaml --output ./recordings/checkout.yaml
```

The output file `./recordings/checkout.yaml` will contain:
```yaml
appId: http://localhost:5173
commands:
- runFlow: ../flows/setup.yaml
- runFlow: ../flows/login.yaml
- # ... newly recorded commands appended here
```

### 3.4 Normal operation (no `--run-flow`)

When `--run-flow` is absent, behaviour is identical to today.

---

## 4. Acceptance Criteria

**AC1 — New flag parsed correctly**
Given `--run-flow a.yaml,b.yaml`, `parseArgs` returns `runFlowPaths: ['a.yaml', 'b.yaml']`.

**AC2 — Multiple paths split on comma**
Given `--run-flow x.yaml,y.yaml,z.yaml`, `runFlowPaths` has length 3 with the three paths in order.

**AC3 — Output file contains runFlow references before any recorded commands**
Given two input flows and a recording session, the output YAML lists `runFlow: <path1>` then `runFlow: <path2>` as the first two commands.

**AC4 — runFlow paths in output are relative to the output file**
If output is `recordings/out.yaml` and input is `flows/setup.yaml`, the entry written is `runFlow: ../flows/setup.yaml`.

**AC5 — Input flow files are not modified**
After the recorder runs, both input flow YAML files are byte-for-byte identical to before.

**AC6 — Output path collision rejected**
If `--output flows/setup.yaml` and `--run-flow flows/setup.yaml` resolve to the same path, the CLI exits with non-zero and prints the collision error message before launching the browser.

**AC7 — appId derived from first flow when url not supplied**
Given no positional url/--base-url and `--run-flow flows/setup.yaml` (which has `appId: http://example.com`), the output file header is `appId: http://example.com`.

**AC8 — Explicit url overrides appId from flow**
Given `--run-flow setup.yaml --base-url http://staging.example.com`, the output header is `appId: http://staging.example.com`.

**AC9 — Replay failure aborts recording with non-zero exit**
If any command in an input flow fails during replay (e.g., `assertVisible` target not found), the recorder exits with code 1 and does not enter live-recording mode.

**AC10 — Replay failure message identifies file and command**
The error output for a replay failure contains the flow filename and the command type/selector that failed.

**AC11 — Nested runFlow in input flows executed recursively**
If an input flow contains `runFlow: ./sub.yaml`, the sub-flow's commands are executed during replay (but only the top-level `runFlow:` reference is written to the output file).

**AC12 — No --run-flow: behaviour unchanged**
Running `uivisor-record http://localhost:5173` without `--run-flow` produces identical output and behaviour to the current implementation.

**AC13 — Missing file rejected with clear error**
If any path in `--run-flow` does not exist, the CLI exits with code 1 and prints `--run-flow: file not found: <path>`.

**AC14 — Non-YAML extension rejected**
If a path in `--run-flow` ends with `.json` (or no extension), the CLI exits with code 1 and prints the extension error message.

---

## 5. Out of Scope

- Modifying or merging the replayed commands into the output file (only `runFlow:` references are written, not the expanded commands).
- Pausing replay mid-flow to allow manual steps between input flows.
- Replaying flows from remote URLs (all paths are local filesystem paths).
- Multi-session (`sessions:`) support in input flows for the initial release — the recorder uses a single-page model.
- Tag filtering (`--tag`) for the replayed flows.
- Variable substitution (`vars:`) in the replayed flows (the replayer uses the raw command values as parsed).

---

## 6. Open Questions

**OQ1 — Replay engine location**
The replay logic (executing Playwright commands from a flow YAML) is currently only in `uivisor-app/src/engine/`. The recorder-app has no dependency on uivisor-app. Implementation options:
- (a) Move the Playwright execution engine to `@uivisor/core` so both packages can share it.
- (b) Add `@uivisor/app` as a dependency of `@uivisor/recorder` within the monorepo.
- (c) Inline a self-contained replayer in `recorder-app/src/flowReplayer.ts`.

The Architect must choose. Option (a) is cleanest long-term; option (c) avoids touching the package graph. See §7 for affected files.

**OQ2 — vars:/config: in input flows**
The replayer may encounter flows that use variable interpolation (`vars:` or `config:`). This spec marks multi-session and tag support as out of scope, but `vars:/config:` support is ambiguous. Recommend: the replayer calls `loadAndParse` (if option a or b) or a minimal parser that resolves vars, so flows with env substitution work correctly.

---

## 7. Files to Change

| File | Change |
|---|---|
| `recorder-app/src/args.ts` | Add `runFlowPaths: string[]` to `RecordArgs`; parse `--run-flow` flag; update HELP text |
| `recorder-app/src/cli.ts` | Add `validateRunFlowPaths`; call replay before exposing capture functions; derive `url` from first flow if not set |
| `recorder-app/src/yamlWriter.ts` | No changes required (existing `appendCommand` handles `runFlow` type correctly) |
| `recorder-app/src/flowReplayer.ts` | NEW: `replayFlows(paths, page, outputPath)` — loads each flow YAML and executes commands through Playwright; handles nested `runFlow:` |
| `recorder-app/src/args.test.ts` | NEW: add unit tests for `--run-flow` flag parsing (ACs 1, 2, 6, 12, 13, 14) |
| `recorder-app/src/flowReplayer.test.ts` | NEW: unit + integration tests for `replayFlows` (ACs 3–5, 7–11) |
| `packages/core/src/` OR `uivisor-app/src/engine/` | Possibly move or export Playwright execution engine — Architect's call (OQ1) |
