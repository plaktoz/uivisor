# engine/

Runtime execution layer. Four files: `context.ts` creates per-run state, `index.ts` iterates commands, `dispatcher.ts` routes each command to the right driver function, `varMap.ts` holds the layered variable map.

---

## context.ts

### `createContext(runDir, sessions, defaultSessionId): RunContext`

Factory that returns a new `RunContext`. Initial state:

| Field | Initial value | Purpose |
|---|---|---|
| `runDir` | passed in | Path for screenshot output |
| `sessions` | passed in | `Map<string, Page>` of active session pages |
| `defaultSessionId` | passed in | Session used when a command has no explicit `session:` field |
| `lastTappedLocator` | `null` | Set by `executeTapOn`; consumed by bare `executeInputText` |
| `callStack` | `new Set()` | Cycle detection for nested `runFlow` commands |
| `indentLevel` | `0` | Console indent depth for nested flow output |

No internal imports.

---

## index.ts

### `runFlow(file: FlowFile, page: Page, ctx: RunContext): Promise<FlowResult>`

Iterates `file.commands` (a `SessionedCommand[]`) and drives each through `dispatch`.

Adds `file.filePath` to `ctx.callStack` on entry and removes it on every exit, so the top-level file and every included file take part in cycle detection. This is the only place that writes `callStack`.

**Per-command logic:**
- Resolves the target page from `ctx.sessions` using `cmd.session` (falls back to `ctx.defaultSessionId`).
- When a `runFlow` command carries an explicit `session`, temporarily overrides `ctx.defaultSessionId` so nested flows inherit that session as their default.
- Collects each `CommandResult`; halts the loop on the first failure.

**Returns `FlowResult`:**

```ts
{
  passed: boolean;
  commandResults: CommandResult[];
  totalCommands: number;
  passedCommands: number;
  durationMs: number;
}
```

Calls `registerRunFlow(runFlow)` on module load to inject itself into the dispatcher (avoids circular import — see `dispatcher.ts`).

**Internal imports:** `engine/dispatcher` (`dispatch`, `registerRunFlow`)

---

## dispatcher.ts

### `dispatch(page, cmd, ctx, flowStem?, flowDir?): Promise<CommandResult>`

Central command dispatcher. Called for every command in a flow, including recursively for `within` blocks.

**Interpolation:** every command is interpolated in strict mode against `ctx.varMap.toRecord()` before dispatch. For `runFlow` this resolves `${...}` in the call-site `vars:` against the caller's map. An `UnresolvedVariableError` fails the step with `Variable "x" is not defined in flow "<flowStem>"`, plus ` at <runFlowLabel(cmd)>` when the command is a `runFlow`.

**`runFlow` special case (handled before the main switch):**
1. Resolves the nested flow file path.
2. Checks the file exists.
3. Checks `ctx.callStack` for circular references and fails the step if the file is already in the stack.
4. Calls `loadAndParse`. Nothing has been entered yet, so a parse failure needs no undo.
5. Increments `ctx.indentLevel`.
6. Calls the late-bound `_runFlowImpl` (registered via `registerRunFlow` at startup) inside `ctx.varMap.withScope({ overrides: cmd.vars ?? {}, defaults: file.vars ?? {} }, ...)`. The scope closes on every exit path. See `varMap.ts`.
7. On a nested failure, appends `, included from flow "<flowStem>" via <runFlowLabel(cmd)>` to the first failing message of the nested result. Each level appends its own clause.
8. Decrements `ctx.indentLevel` in a `finally`.

**All other commands:** routed to the corresponding `execute*` function from `driver/commands.ts` via a `switch` on `cmd.type`.

**On any thrown error:**
- Parses `Expected:` / `Got:` structured lines from the error message.
- Auto-captures a failure screenshot via `captureScreenshot` using a module-level counter (reset by `resetScreenshotCounter`).
- Returns a failed `CommandResult` with the error message and screenshot path.

### `registerRunFlow(fn: RunFlowFn): void`

Late-binding injection point. Called by `engine/index.ts` at startup to register `runFlow` without creating a circular import between `dispatcher` and `index`.

### `resetScreenshotCounter(): void`

Resets the module-level screenshot counter to 0. Called by `cli/runner.ts` before each flow.

**Internal imports:** all `execute*` functions from `driver/commands`, `reporter/screenshot` (`captureScreenshot`), `reporter/runFlowLabel` (`runFlowLabel`), `parser/index` (`loadAndParse`), `parser/interpolate` (`interpolateObject`, `UnresolvedVariableError`)

---

## varMap.ts

### `createVarMap(base): VarMap`

Layered variable map for one top-level run. Layers, first hit wins on read:

1. The innermost open scope that overrides the name. An unset override hides every layer below it.
2. `runtime`: `setVar` writes outside any override.
3. Admitted defaults of open scopes. Under an unset override, only defaults of scopes opened inside it count.
4. Tombstones from `unsetVar`, then `base` (the top-level file's `vars:` and `config:`).

`set` and `unset` of a name that an open scope overrides write into that scope and end with it. Otherwise they write to `runtime` and tombstones, and `unset` also drops the name from admitted defaults. `toRecord()` is derived from `get`, so `toRecord()[k] === get(k)` for every name.

`withScope(scope, run)` admits each default whose name is not an override of the same scope and is not visible when the scope opens. It runs `run`, then truncates the scope stack to its depth at entry in a `finally`.
