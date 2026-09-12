# cli/

Entry point and CLI orchestration for the `uivisor` binary. Five files handle argument parsing, file resolution, tag filtering, and the top-level run loop.

---

## args.ts

### `parseArgs(argv: string[]): ParsedArgs`

Parses `process.argv` into a structured object. Skips the `test` subcommand token, reads the next positional as `target`, then scans flags.

```ts
interface ParsedArgs {
  target: string;
  headed: boolean;
  slowMo: number;
  reporter: 'html' | 'md' | null;
  tags: string[];
  outputDir?: string;
}
```

| Flag | Type | Description |
|---|---|---|
| `--headed` | boolean | Run browser in headed mode |
| `--slow-mo <ms>` | number | Delay each Playwright action by N ms |
| `--reporter html\|md` | string | Emit an HTML or Markdown report after the run |
| `--tag <name>` | string (repeatable) | Run only flows matching one of the given tags |
| `--output-dir <path>` | string | Override the default `target/<timestamp>/` run directory |

Exits with code 1 and prints usage if no target is supplied. No internal imports.

---

## resolver.ts

### `resolveTarget(target: string): string[]`

Resolves a CLI target path to an array of `.yaml` file paths.

- **Directory** — returns all `*.yaml` files in that directory (non-recursive, sorted by `readdirSync`).
- **Single file** — wraps it in a one-element array.

Throws `Error` if the path does not exist or if a directory contains no YAML files. No internal imports.

---

## filter.ts

### `filterFlows(flows: FlowFile[], tags: string[]): FilterResult`

Separates flows into `included` and `excluded` arrays based on tag matching.

```ts
interface FilterResult {
  included: string[];   // paths to run
  excluded: string[];   // shared flows (always excluded from direct run)
}
```

- **Shared flows** (`flow.shared === true`) are always placed in `excluded`.
- **Non-shared flows** that do not match any requested tag are silently dropped (neither included nor excluded).
- When `tags` is empty, all non-shared flows are included.

### `isSingleSharedFlowTarget(flow: FlowFile): boolean`

Guard used in `cli/index.ts` to detect when the user directly targets a single shared flow file and print a helpful error. No internal imports.

---

## runner.ts

### `runAll(targets: string[], options: RunOptions): Promise<RunResult>`

Executes all target flows against a single shared Playwright browser.

**Lifecycle:**
1. Launch one Chromium browser via `launchBrowser`.
2. For each target: load/parse the flow, provision session pages (`createSessionPages`), create a `RunContext`, navigate the default page to `file.baseUrl`, call `runFlow`, collect results.
3. Report each command to `ConsoleReporter`.
4. Close all session pages after each flow (even on failure).
5. Close the browser in a top-level `finally`.

Returns a `RunResult` with aggregate pass/fail counts.

**Internal imports:** `driver/browser`, `engine/index`, `engine/context`, `parser/index`, `reporter/console`

---

## index.ts

Top-level `main()` function — the `#!/usr/bin/env node` executable entry point. No exports.

**Orchestration order:**
1. `parseArgs` — resolve CLI flags.
2. Create timestamped run directory `target/<YYYYMMDD-HHmm>/` (or under `--output-dir`).
3. `resolveTarget` — expand target path to `.yaml` file list.
4. `loadAndParse` each flow — exits on parse error.
5. `isSingleSharedFlowTarget` guard — rejects direct shared flow execution.
6. `filterFlows` — apply tag filtering.
7. `runAll` — execute all included flows.
8. Optionally write HTML (`generateHtmlReport`) or Markdown (`generateMarkdownReport`) report to the run directory.
9. Exit 0 on full pass, 1 on any failure.

**Internal imports:** `cli/args`, `cli/resolver`, `cli/runner`, `cli/filter`, `parser/index`, `reporter/html`, `reporter/markdown`
