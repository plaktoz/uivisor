# engine/

Runtime execution layer. Three files: `context.ts` creates per-run state, `index.ts` iterates commands, `dispatcher.ts` routes each command to the right driver function.

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

**`runFlow` special case (handled before the main switch):**
1. Resolves the nested flow file path.
2. Checks the file exists.
3. Checks `ctx.callStack` for circular references — throws if the file is already in the stack.
4. Pushes to the call stack, increments `ctx.indentLevel`.
5. Calls the late-bound `_runFlowImpl` (registered via `registerRunFlow` at startup).
6. Pops the call stack, decrements `ctx.indentLevel`.

**All other commands:** routed to the corresponding `execute*` function from `driver/commands.ts` via a `switch` on `cmd.type`.

**On any thrown error:**
- Parses `Expected:` / `Got:` structured lines from the error message.
- Auto-captures a failure screenshot via `captureScreenshot` using a module-level counter (reset by `resetScreenshotCounter`).
- Returns a failed `CommandResult` with the error message and screenshot path.

### `registerRunFlow(fn: RunFlowFn): void`

Late-binding injection point. Called by `engine/index.ts` at startup to register `runFlow` without creating a circular import between `dispatcher` and `index`.

### `resetScreenshotCounter(): void`

Resets the module-level screenshot counter to 0. Called by `cli/runner.ts` before each flow.

**Internal imports:** all `execute*` functions from `driver/commands`, `reporter/screenshot` (`captureScreenshot`), `parser/index` (`loadAndParse`)
