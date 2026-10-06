# Pipeline State: feat-implement-set-var-to-flow

**Task:** Implement the spec docs/set-var-to-flow.yaml — runtime variable system (setVar / testVarSet / unsetVar)
**Started:** 2026-09-17
**Status:** pr_open

## Worktree
**Path:** .worktrees/feat-implement-set-var-to-flow
**Branch:** feat-implement-set-var-to-flow
**Created:** 2026-09-17
**Status:** active

## PR
**URL:** https://github.com/plaktoz/uivisor/pull/94
**Opened:** 2026-09-17

## Code Artifacts

| File | Status |
|---|---|
| `packages/core/src/types.ts` | modified — new Command union members, VarMap/MethodRunner/FlowConfig/WorkingScheduleEntry types |
| `packages/core/src/index.ts` | modified — exports new types |
| `uivisor-app/src/builtins/index.ts` | new — built-in methods (today/now/uuid/random/nearestWorkingDay) |
| `uivisor-app/src/engine/varMap.ts` | new — createVarMap layered map |
| `uivisor-app/src/engine/methodRunner.ts` | new — createMethodRunner with dynamic import |
| `uivisor-app/src/parser/commandParser.ts` | modified — setVar/testVarSet/unsetVar parsing |
| `uivisor-app/src/parser/interpolate.ts` | modified — strict mode, loadConfigFile returns flowConfig |
| `uivisor-app/src/parser/index.ts` | modified — lazy interpolation boundary |
| `uivisor-app/src/engine/dispatcher.ts` | modified — per-step interpolation + new command cases |
| `uivisor-app/src/engine/context.ts` | modified — createContext accepts varMap+methodRunner |
| `uivisor-app/src/cli/runner.ts` | modified — wires varMap+methodRunner per flow |
| `uivisor-app/src/reporter/console.ts` | modified — new command labels |
| `uivisor-app/src/reporter/html.ts` | modified — new command labels |
| `uivisor-app/src/reporter/markdown.ts` | modified — new command labels + screenshot fix |

## Test Results

- **Unit tests:** 631 passed, 4 expected-fail (26 test files)
- **TypeScript:** clean (0 errors)
- **Integration tests:** require live browser (not run in unit suite)

---

## Gate 1: Spec + Acceptance Criteria

### Feature Summary

Three new commands — `setVar`, `testVarSet`, and `unsetVar` — are added to uivisor flow files to support a global runtime variable map. Variables may be set to static string values or to the return value of built-in or user-defined method calls, and are referenced anywhere in a flow via the existing `${varName}` interpolation syntax. Interpolation of command strings is changed from parse-time to dispatch-time (lazy), ensuring variables set mid-flow are visible to all subsequent steps across sub-flows and named sessions.

### Acceptance Criteria

#### AC1: setVar — static multi-word string value
- **Input:** `setVar: greeting=hello world`
- **Expected:** runtime var map contains key `greeting` with value `"hello world"` (all characters after the first `=` are the value)
- **Failure:** key is absent, or value is truncated at the first space

#### AC2: setVar — static numeric literal stored as string
- **Input:** `setVar: num=5`
- **Expected:** runtime var map contains key `num` with value `"5"` (a string, not the number `5`)
- **Failure:** value stored as a non-string type, or key is absent

#### AC3: setVar — built-in `today`
- **Input:** `setVar: d=today('YYYYMMDD')`
- **Expected:** runtime var map contains key `d` with today's date as an 8-digit `YYYYMMDD` string
- **Failure:** key is absent, or value does not match today's date in the specified format

#### AC4: setVar — built-in `now`
- **Input:** `setVar: t=now('HHmmss')`
- **Expected:** runtime var map contains key `t` with the current time as a 6-character `HHmmss` string
- **Failure:** key is absent, or value does not match a valid 24-hour time in the specified format

#### AC5: setVar — built-in `uuid`
- **Input:** `setVar: id=uuid()`
- **Expected:** runtime var map contains key `id` with a string matching UUID v4 pattern
- **Failure:** key is absent, or value does not match UUID v4 format

#### AC6: setVar — built-in `random` digit count and no leading zero
- **Input:** `setVar: code=random(6)`
- **Expected:** runtime var map contains key `code` with a 6-character string of digits where the first digit is in [1–9]
- **Failure:** key is absent, result has incorrect length, or first character is "0"

#### AC7: setVar — built-in `nearestWorkingDay` when now is inside a working window
- **Input:** config defines `workingSchedule` including current day/time; `setVar: d=nearestWorkingDay('YYYYMMDD')`
- **Expected:** runtime var map contains key `d` with today's date as a `YYYYMMDD` string
- **Failure:** key is absent, or value is a future date when now is already inside a working window

#### AC8: setVar — built-in `nearestWorkingDay` when now is outside working windows or on a holiday
- **Input:** config defines `workingSchedule` and `holidays`; current date is a holiday or outside all window hours
- **Expected:** runtime var map contains key `d` with the next upcoming working window date
- **Failure:** key is absent, or value is today's non-working date

#### AC9: setVar — `nearestWorkingDay` without `workingSchedule` in config fails immediately
- **Input:** config.yml does not define `workingSchedule`; `setVar: d=nearestWorkingDay('YYYYMMDD')`
- **Expected:** flow fails at that step; error includes method name and cause (`"workingSchedule not defined in config"`)
- **Failure:** no error is raised, or error omits method name or cause

#### AC10: setVar — user-defined async function result is awaited and stored
- **Input:** config `functions` references a file exporting `async function nextDeadline() { return 'future-date'; }`; step: `setVar: dl=nextDeadline()`
- **Expected:** runtime var map contains key `dl` with value `"future-date"` (resolved, not a Promise)
- **Failure:** key is absent, or value is `"[object Promise]"`

#### AC11: setVar — method arg: single-quoted string literal
- **Input:** `setVar: r=formatRef('ORD', 'abc')`
- **Expected:** function receives `"ORD"` and `"abc"` as string arguments; `r` = `"ORD-abc"`
- **Failure:** arguments not correctly parsed as strings, or key is absent

#### AC12: setVar — method arg: unquoted number literal
- **Input:** `setVar: code=random(6)` where `6` is an unquoted integer
- **Expected:** `random` receives the number `6`; result is a 6-digit string
- **Failure:** `random` receives string `"6"` causing wrong length or type error

#### AC13: setVar — method arg: `${varName}` resolved before call
- **Input:** step N: `setVar: id=uuid()`; step N+1: `setVar: r=myFn(${id}, 'active')`
- **Expected:** `myFn` receives the actual UUID string as its first argument
- **Failure:** `myFn` receives the literal string `"${id}"`

#### AC14: testVarSet — existence form passes when variable exists and is non-empty
- **Input:** runtime var map contains `userId` = `"abc-123"`; step: `testVarSet: userId`
- **Expected:** step passes
- **Failure:** step fails despite the variable being present and non-empty

#### AC15: testVarSet — existence form fails when variable is absent
- **Input:** `userId` is not in runtime var map; step: `testVarSet: userId`
- **Expected:** step fails, halting the flow
- **Failure:** step passes when the variable does not exist

#### AC16: testVarSet — existence form fails when variable is empty string
- **Input:** runtime var map contains `userId` = `""`; step: `testVarSet: userId`
- **Expected:** step fails
- **Failure:** step passes for an empty-string value

#### AC17: testVarSet — equality form passes when variable matches expected string
- **Input:** runtime var map contains `num` = `"5"`; step: `testVarSet: { name: num, expected: "5" }`
- **Expected:** step passes
- **Failure:** step fails despite exact string match

#### AC18: testVarSet — equality form fails when variable does not match
- **Input:** runtime var map contains `num` = `"5"`; step: `testVarSet: { name: num, expected: "6" }`
- **Expected:** step fails with a message showing actual and expected values
- **Failure:** step passes despite values differing

#### AC19: testVarSet — comparison is always string equality
- **Input:** runtime var map contains `flag` = `"true"`; step: `testVarSet: { name: flag, expected: "true" }`
- **Expected:** comparison succeeds as string-to-string
- **Failure:** type coercion causes incorrect pass or fail

#### AC20: unsetVar — no-op when variable does not exist
- **Input:** `userId` is NOT in runtime var map; step: `unsetVar: userId`
- **Expected:** step completes without error; flow continues
- **Failure:** step throws an error or marks flow as failed

#### AC21: unsetVar — removes variable from runtime map
- **Input:** runtime var map contains `userId` = `"abc-123"`; step: `unsetVar: userId`
- **Expected:** after execution, key `userId` is absent from the runtime var map
- **Failure:** `userId` is still present after `unsetVar` completes

#### AC22: accessing a variable removed by unsetVar is a hard error
- **Input:** step N: `unsetVar: userId`; step N+1: `inputText: ${userId}` (no default)
- **Expected:** step N+1 fails with a hard error indicating `userId` is not defined
- **Failure:** `${userId}` resolves to empty string and flow continues silently

#### AC23: command strings are NOT interpolated at parse time
- **Input:** flow file contains `setVar: ref=uuid()` followed by `inputText: ${ref}`, then parsed
- **Expected:** after parsing, `inputText` command retains raw string `"${ref}"`
- **Failure:** `${ref}` is expanded to empty or error at parse time

#### AC24: lazy interpolation — variable set at step N is visible at step N+1
- **Input:** step N: `setVar: today=today('YYYYMMDD')`; step N+1: `inputText: ${today}`
- **Expected:** at step N+1 dispatch time, `${today}` resolves to the date string stored at step N
- **Failure:** `${today}` resolves to empty or errors

#### AC25: scope shared across runFlow — sub-flow reads parent variables
- **Input:** parent sets `setVar: token=abc123`; calls `runFlow: ./sub.yaml`; sub-flow uses `${token}`
- **Expected:** sub-flow resolves `${token}` to `"abc123"`
- **Failure:** sub-flow cannot see `token`

#### AC26: scope shared across runFlow — sub-flow writes visible in parent after completion
- **Input:** sub-flow contains `setVar: result=done`; parent after `runFlow` uses `testVarSet: result`
- **Expected:** `testVarSet` passes; `result` = `"done"` is visible in parent
- **Failure:** parent cannot see variable written inside sub-flow

#### AC27: scope shared across sessions
- **Input:** session A: `setVar: sharedToken=xyz`; session B: `inputText: ${sharedToken}`
- **Expected:** session B resolves `${sharedToken}` to `"xyz"`
- **Failure:** `${sharedToken}` is undefined or empty in session B

#### AC28: runtime map overrides config, vars, and env
- **Input:** config, `vars:` block, and env all define key `x`; prior `setVar: x=runtime`; subsequent command uses `${x}`
- **Expected:** `${x}` resolves to `"runtime"`
- **Failure:** any lower-priority source value is returned instead

#### AC29: setVar supersedes vars: seed value
- **Input:** flow has `vars: { label: "old" }`; step: `setVar: label=new`; next: `inputText: ${label}`
- **Expected:** `inputText` receives `"new"`
- **Failure:** `inputText` receives `"old"`

#### AC30: undefined variable with no default is a hard error at dispatch time
- **Input:** variable `ghost` absent from all sources; command contains `${ghost}` with no default
- **Expected:** flow fails at that step with error indicating `ghost` is not defined
- **Failure:** `${ghost}` silently resolves to empty string

#### AC31: default fallback syntax `${varName:defaultValue}` resolves when variable is absent
- **Input:** variable `missing` absent; command contains `${missing:fallback}`
- **Expected:** resolves to `"fallback"` without error
- **Failure:** error thrown, or resolves to empty string

#### AC32: user-defined function name colliding with built-in raises error at load time
- **Input:** config `functions` exports a function named `uuid`
- **Expected:** error raised during function-load (before any command runs) indicating name conflicts with built-in
- **Failure:** user-defined `uuid` silently overrides built-in, or error raised only at call time

#### AC33: duplicate user-defined function name across multiple files raises error at load time
- **Input:** config `functions` array lists two files both exporting `formatRef`
- **Expected:** error raised during function-load indicating duplicate name
- **Failure:** second file's `formatRef` overwrites first without error

#### AC34: `functions` config accepts a single string path
- **Input:** config.yml: `functions: ./helpers/date-helpers.js` (string, not array); file exports `myHelper()`
- **Expected:** `myHelper` is available; `setVar: r=myHelper()` stores result
- **Failure:** single-string form rejected as invalid

#### AC35: `functions` config accepts an array of paths and loads all files
- **Input:** config.yml: `functions: [./helpers/a.js, ./helpers/b.js]`; each exports a distinct function
- **Expected:** both functions available and callable
- **Failure:** only one file loaded, or array form rejected

#### AC36: working schedule config structure accepted and used
- **Input:** config.yml defines `workingSchedule` with `days` and `hours` entries; `nearestWorkingDay` called
- **Expected:** schedule parsed without error; returns correctly-computed date
- **Failure:** valid schedule config rejected at load or runtime

#### AC37: `holidays` key is optional for `nearestWorkingDay`
- **Input:** config.yml defines `workingSchedule` but omits `holidays`; `nearestWorkingDay` called
- **Expected:** runs successfully; treats no dates as holidays
- **Failure:** error thrown because `holidays` key is absent

#### AC38: method call failure halts flow with structured error message
- **Input:** `setVar` calls a method that throws an exception
- **Expected:** flow fails at that step; error message: `"setVar failed: <methodName>() threw: <error>"`
- **Failure:** flow continues past failed step, or error omits method name or cause

#### AC39: new Command types added to union with exhaustiveness check
- **Input:** `types.ts` compiled alongside `dispatcher.ts`
- **Expected:** `SetVarCommand`, `TestVarSetCommand`, `UnsetVarCommand` are members of `Command` union; removing a dispatcher case causes `tsc` error on `never` guard
- **Failure:** any new type missing from union, causing runtime "Unhandled command type" errors

---

## Feature & Task Breakdown

| ID | Task | Files | Depends On | Status |
|---|---|---|---|---|
| T1 | Add SetVarCommand, TestVarSetCommand, UnsetVarCommand to Command union; add VarMap + MethodRunner interfaces, WorkingScheduleEntry + FlowConfig types; extend FlowFile with `flowConfig?` and RunContext with `varMap` + `methodRunner` | `packages/core/src/types.ts` | — | open |
| T2 | Parse cases for `setVar` (first-`=` split, method-pattern detection), `testVarSet` (scalar → existence, object → equality), `unsetVar` (scalar) | `uivisor-app/src/parser/commandParser.ts` | T1 | open |
| T3 | `loadConfigFile` strips `workingSchedule`/`holidays`/`functions` before `flattenVars`; returns `{ vars, flowConfig }` instead of plain Record; `resolveRef` throws hard error on unset var with no default; `loadAndParse` consumes new shape | `uivisor-app/src/parser/interpolate.ts`, `uivisor-app/src/parser/index.ts` | T1 | open |
| T4 | Lazy interpolation: `loadAndParse` interpolates only non-command fields; commands carry raw `${…}` literals through to dispatcher | `uivisor-app/src/parser/index.ts` | T3 | open |
| T5 | Implement `builtins/index.ts`: `today`, `now`, `uuid`, `random`, `nearestWorkingDay`; export `BUILTIN_NAMES` | `uivisor-app/src/builtins/index.ts` (new) | — | open |
| T6 | Implement `varMap.ts`: `createVarMap(base)` factory; runtime Map layered over base; `seed/get/set/unset/toRecord` | `uivisor-app/src/engine/varMap.ts` (new) | T1 | open |
| T7 | Implement `methodRunner.ts`: load user JS files, conflict-check at creation, `call(name, resolvedArgs)` dispatches to built-in or user fn; async supported; error wrapping | `uivisor-app/src/engine/methodRunner.ts` (new) | T5, T6 | open |
| T8 | Dispatcher: (1) per-step `interpolateObject` via `varMap.toRecord()` before switch; (2) setVar static/method cases; (3) testVarSet existence/equality cases; (4) unsetVar case | `uivisor-app/src/engine/dispatcher.ts` | T1, T2, T6, T7 | open |
| T9 | Wire varMap + methodRunner into context; pass existing ctx through nested runFlow calls; top-level runner creates varMap + methodRunner from FlowFile | `uivisor-app/src/engine/index.ts`, `uivisor-app/src/engine/context.ts`, `uivisor-app/src/cli/runner.ts` | T1, T6, T7, T8 | open |
| T10 | Reporter cases for setVar/testVarSet/unsetVar in all three reporters | `uivisor-app/src/reporter/console.ts`, `html.ts`, `markdown.ts` | T1 | open |
| T11 | Unit tests: varMap seeding, set/unset/toRecord priority, hard error on unset | `uivisor-app/src/engine/varMap.test.ts` (new) | T6 | open |
| T12 | Unit tests: all 5 builtins correctness + nearestWorkingDay missing schedule throws | `uivisor-app/src/builtins/index.test.ts` (new) | T5 | open |
| T13 | Unit tests: methodRunner conflict detection, user fn, async fn, error wrapping | `uivisor-app/src/engine/methodRunner.test.ts` (new) | T7 | open |
| T14 | Unit tests: commandParser new command types | `uivisor-app/src/parser/commandParser.test.ts` | T2 | open |
| T15 | Integration tests: lazy interpolation, all three commands via dispatcher | `uivisor-app/src/engine/dispatcher.test.ts` (new) | T4, T8, T9 | open |

## Seam Notes

**`varMap.ts` exports:** `createVarMap(base: Record<string,string>): VarMap`. `toRecord()` merges runtime over base for passing to `interpolateValue`. Priority: runtime → base (config+vars) → env (env handled separately inside `resolveRef`).

**`methodRunner.ts` expectations:** `createMethodRunner(functionPaths, workingSchedule, holidays): Promise<MethodRunner>`. Throws at creation for name conflicts. `call(name, resolvedArgs: unknown[]): Promise<string>` — args arrive already resolved. Imports `BUILTIN_NAMES` from builtins for conflict checks.

**Dispatcher flow (T8):** Before switch: `interpolateObject(rawCmd, ctx.varMap.toRecord())`. Static setVar: `ctx.varMap.set(name, value)`. Method setVar: resolve rawArgs → `await ctx.methodRunner.call(method, args)` → set. testVarSet: `ctx.varMap.get(name)` → throw if undefined/empty; equality form also asserts. unsetVar: unconditional `ctx.varMap.unset(name)`.

**Lazy boundary (T4):** `loadAndParse` interpolates `{ appId, tags, sessions, vars, config }` only; `commands` array passes through raw. Commands carry live `${…}` literals until dispatcher resolves them at runtime.

**`loadConfigFile` return (T3):** Before: `Record<string,string>`. After: `{ vars: Record<string,string>; flowConfig: FlowConfig }`. Strips `workingSchedule`, `holidays`, `functions` before `flattenVars`.

---

## Tests — Generator A (tester_generator_a)

### varMap.test.ts
- `set: multi-word string is stored verbatim` (AC1)
- `set: numeric literal is coerced to string` (AC2)
- `unset: silently succeeds when key absent` (AC20)
- `unset: removes existing key` (AC21)
- `get: throws hard error when key was previously unset` (AC22)
- `get: runtime map value wins over seed value when both present` (AC28)
- `set: explicit setVar overwrites initial seed value from vars block` (AC29)
- `get: throws when variable absent and no default provided` (AC30)
- `interpolate: ${varName:defaultValue} uses default when key absent` (AC31)
- `interpolate: ${varName:defaultValue} uses stored value when key present` (AC31 complement)

### builtins/index.test.ts
- `today: formats current date as YYYYMMDD` (AC3)
- `now: formats current time as HHmmss` (AC4)
- `uuid: returns a valid UUID v4 string` (AC5)
- `random: returns N-digit numeric string with no leading zero` (AC6, 100 iterations)
- `nearestWorkingDay: returns today when current time is within working window` (AC7)
- `nearestWorkingDay: advances to next working day when called on a Saturday` (AC8)
- `nearestWorkingDay: skips holiday and returns day after` (AC8 holiday)
- `nearestWorkingDay: throws hard error when workingSchedule absent from config` (AC9)
- `nearestWorkingDay: succeeds when holidays key omitted` (AC37)

### methodRunner.test.ts
- `run: awaits user async function and coerces result to string` (AC10)
- `parseArgs: single-quoted string literal becomes string value` (AC11)
- `parseArgs: unquoted numeric token becomes JS number` (AC12)
- `parseArgs: ${varName} interpolated from varMap before method invocation` (AC13)
- `loadUserFunctions: throws when user function name matches a built-in` (AC32)
- `loadUserFunctions: throws when same function name exported from two different files` (AC33)
- `loadFunctionsConfig: single string path is loaded as one module` (AC34)
- `loadFunctionsConfig: array of paths loads functions from all modules` (AC35)
- `loadScheduleConfig: valid workingSchedule is parsed and passed to nearestWorkingDay` (AC36)
- `runMethod: rejects with structured error message when user function throws` (AC38)

### commandParser.test.ts
- `parseCommand: setVar value containing ${token} stored as literal string` (AC23)
- `TypeScript: setVar, testVarSet, unsetVar are valid Command types` (AC39 compile-time)
- `parseCommand: setVar parses correctly with name and value fields` (AC39)
- `parseCommand: testVarSet existence form (no expected)` (AC39)
- `parseCommand: testVarSet equality form with expected` (AC39)
- `parseCommand: unsetVar parses name correctly` (AC39)

### dispatcher.test.ts
- `dispatch testVarSet: passes when variable exists and non-empty` (AC14)
- `dispatch testVarSet: fails when variable absent` (AC15)
- `dispatch testVarSet: fails when variable is empty string` (AC16)
- `dispatch testVarSet: equality passes on exact match` (AC17)
- `dispatch testVarSet: equality fails with expected/got in message` (AC18)
- `dispatch testVarSet: "1" and "01" do not match (no type coercion)` (AC19)
- `dispatch setVar: value interpolated at dispatch, not at parse` (AC23 dispatch)
- `dispatch sequence: variable set in step N visible when interpolated in step N+1` (AC24)
- `dispatch runFlow: sub-flow resolves variables set in parent` (AC25)
- `dispatch runFlow: variable written in sub-flow readable in parent` (AC26)
- `dispatch: varMap singleton identical across multiple session pages` (AC27)
- `dispatch: interpolating undefined variable with no default throws and fails command` (AC30)

---

## Tests — Generator B (tester_generator_b)

### var-map.test.ts
- TC-VM-01: `get() returns undefined for absent key` (unset raw map)
- TC-VM-02: `set() then get() returns stored string value`
- TC-VM-03: `set() coerces number to string before storing` (AC2)
- TC-VM-04: `set() overwrites existing key` (AC28/AC29)
- TC-VM-05: `unset() on present key removes it` (AC21)
- TC-VM-06: `unset() on absent key is no-op` (AC20)
- TC-VM-07: `set() after unset() makes key visible again`
- TC-VM-08: `initialise() seeds map from flat key-value object`
- TC-VM-09: `set() after initialise() overrides seed value` (AC29)
- TC-VM-10: `initialise() twice replaces entire map`

### set-var-parser.test.ts
- TC-SVP-01: `{ setVar: "name=value" } → SetVarCommand` (AC1)
- TC-SVP-02: `"label=hello world" → full multi-word value` (AC1 edge)
- TC-SVP-03: `"num=5" → value is string "5"` (AC2)
- TC-SVP-04: `"id=uuid()" → MethodCallSetVar, no args` (AC5)
- TC-SVP-05: `"d=today('YYYYMMDD')" → string arg quotes stripped` (AC11)
- TC-SVP-06: `"code=random(6)" → numeric arg as number` (AC12)
- TC-SVP-07: `"${x}" in setVar value NOT interpolated at parse time` (AC23)
- TC-SVP-08: throws on empty setVar value
- TC-SVP-09: throws on leading `=` (empty name)
- TC-SVP-10: `${varName}` in method arg stored as literal at parse time (AC23/lazy)

### test-var-set-parser.test.ts
- TC-TVP-01: existence form → `{ type: 'testVarSet', name }` (AC14)
- TC-TVP-02: equality form → `{ type: 'testVarSet', name, expected }` (AC17)
- TC-TVP-03: expected `"5"` stored as string (AC19)
- TC-TVP-04: throws on empty name

### unset-var-parser.test.ts
- TC-UVP-01: `{ unsetVar: "userId" }` → `UnsetVarCommand` (AC21)
- TC-UVP-02: throws on empty name

### set-var-dispatch.test.ts
- TC-SVD-01: static setVar stores value (AC1)
- TC-SVD-02: multi-word value stored correctly (AC1)
- TC-SVD-03: `${x}` in value interpolated at dispatch time (AC24/AC3)
- TC-SVD-04: testVarSet existence passes (AC14)
- TC-SVD-05: testVarSet existence fails on absent (AC15)
- TC-SVD-06: testVarSet existence fails on empty string (AC16)
- TC-SVD-07: testVarSet equality passes on match (AC17)
- TC-SVD-08: testVarSet equality fails on mismatch (AC18)
- TC-SVD-09: testVarSet equality on absent key fails (not crash) (AC15)
- TC-SVD-10: unsetVar removes present key (AC21)
- TC-SVD-11: unsetVar on absent key passes (AC20)
- TC-SVD-12: sequential dispatch reads updated var (AC24)
- TC-SVD-13: absent var interpolation → hard error (AC30)
- TC-SVD-14: absent var with default → uses default (AC31)

### var-scope.test.ts
- TC-VS-01: parent setVar visible in sub-flow (AC25)
- TC-VS-02: sub-flow setVar visible in parent (AC26)
- TC-VS-03: sub-flow unsetVar removes var from parent (scope is shared, not copy) (AC25/AC26)
- TC-VS-04: session A setVar visible when dispatching for session B (AC27)

### builtin-methods.test.ts
- TC-BM-01..02: today() formats (AC3)
- TC-BM-03: now() format (AC4)
- TC-BM-04..05: uuid() pattern + uniqueness (AC5)
- TC-BM-06..09: random() digit length, no leading zero, boundary, invalid (AC6)
- TC-BM-10: random() string arg type boundary (AC12)
- TC-BM-11: nearestWorkingDay without schedule throws (AC9)
- TC-BM-12: nearestWorkingDay happy path (AC7)
- TC-BM-13: nearestWorkingDay skips holiday (AC8)
- TC-BM-14: nearestWorkingDay skips weekend (AC8)

### user-functions.test.ts
- TC-UF-01: user fn result stored as string (AC10)
- TC-UF-02: async fn awaited (AC10)
- TC-UF-03: numeric return coerced to string (AC2)
- TC-UF-04..05: built-in name collision = load-time error (AC32)
- TC-UF-06: duplicate across files = load-time error (AC33)
- TC-UF-07: user fn throw → structured error message (AC38)
- TC-UF-08: missing file path = load-time error
- TC-UF-09: single-string functions path (AC34)
- TC-UF-10: ${varName} in arg resolved before call (AC13)

### lazy-interpolation-timing.test.ts
- TC-LT-01: loadAndParse does NOT resolve ${x} in command strings (AC23)
- TC-LT-02: loadAndParse DOES resolve ${env.*} in appId (regression guard)
- TC-LT-03: loadAndParse DOES resolve ${env.*} in config: path (regression guard)
- TC-LT-04: dispatcher resolves ${x} in goto at execution time (AC24)
- TC-LT-05: setVar then use in next command — sees updated value (AC24)
- TC-LT-06: two commands reading same ${x} both use same value if no mutation

### error-message-format.test.ts
- TC-EM-01..02: absent var → error contains var name, not empty string (AC30)
- TC-EM-03: nearestWorkingDay without config → exact error format (AC9/AC38)
- TC-EM-04: user fn throw → `setVar failed: fn() threw: msg` (AC38)
- TC-EM-05: testVarSet existence fail includes var name
- TC-EM-06: testVarSet empty-string fail documents "empty" vs "absent"
- TC-EM-07: testVarSet equality fail → Expected:/Got: format (AC18)
- TC-EM-08: load-time conflict error names conflicting function + built-in (AC32)

---

## Tests

### Attribution

| AC | Generator A | Generator B |
|---|---|---|
| AC1–AC30 | ✓ | ✓ |
| AC31 | ✓ | — |
| AC32–AC38 | ✓ | ✓ |
| AC36 | ✓ | — |
| AC39 | ✓ | — |
| B-EX1 (random(0) throws) | — | ✓ |
| B-EX2 (random string arg boundary) | — | ✓ |
| B-EX3 (numeric return coerced) | — | ✓ |
| B-EX4 (file not found error) | — | ✓ |
| B-EX5 (re-set after unset) | — | ✓ |
| B-EX6 (init twice) | — | ✓ |
| B-EX7 (equality on absent key) | — | ✓ |
| B-EX8/B-EX9 (regression guards) | — | ✓ |
| B-EX10 (error message contracts) | — | ✓ |

**Unique to A:** 3 | **Unique to B:** 10 | **Shared:** 36 | **Total after dedup:** 49

### Disagreements for Arbiter

1. **AC27 sessions** — A asserts shared; B implies per-session isolation. Grilling session resolved this: **shared**. Arbiter to confirm T-dispatch-11 / T-scope-04 should assert shared behaviour.
2. **AC22/AC30 — which layer throws** — A places hard error in `varMap.get()`; B places it in dispatcher. Need to pick one authoritative layer.
3. **AC23 parse vs dispatch split** — A has the parse postcondition in `commandParser.test.ts` and dispatch postcondition in `dispatcher.test.ts`. B merges into one dispatcher test. Need a ruling on the split.
4. **AC31 default fallback** — only A covers this. Existing `interpolate.ts` already supports `${varName:default}` syntax. Arbiter to confirm in scope.
5. **File naming** — A uses camelCase; B uses kebab-case. Need to match existing project convention.

### Consolidated Test Plan

#### var-map.test.ts (14 tests)
| ID | Description | AC |
|---|---|---|
| T-varmap-01 | init with vars block seeds map | AC28 |
| T-varmap-02 | set stores multi-word string verbatim | AC1 |
| T-varmap-03 | set coerces numeric literal to string | AC2 |
| T-varmap-04 | get returns stored value | AC28 |
| T-varmap-05 | unset removes existing key | AC21 |
| T-varmap-06 | unset silently succeeds when key absent | AC20 |
| T-varmap-07 | get throws hard error when key was previously unset | AC22 |
| T-varmap-08 | set overwrites existing value | AC29 |
| T-varmap-09 | re-set after unset stores new value | B-EX5 |
| T-varmap-10 | init called twice replaces seeds | B-EX6 |
| T-varmap-11 | runtime value wins over seed value | AC28 |
| T-varmap-12 | get throws when variable absent and no default | AC30 |
| T-varmap-13 | interpolate ${var:default} uses default when absent | AC31 |
| T-varmap-14 | interpolate ${var:default} uses stored value when present | AC31 |

#### commandParser.test.ts (additions)
| ID | Description | AC |
|---|---|---|
| T-parser-01 | TypeScript: Command union exhaustive | AC39 |
| T-parser-02 | setVar static form parses correctly | AC39 |
| T-parser-03 | testVarSet existence form | AC39 |
| T-parser-04 | testVarSet equality form | AC39 |
| T-parser-05 | unsetVar parses name | AC39 |
| T-parser-06 | setVar ${token} value stored as literal at parse time | AC23 |
| T-parser-07 | setVar multi-word value (all chars after first =) | AC1 |
| T-parser-08 | setVar throws on missing = | — |
| T-parser-09 | testVarSet throws on empty name | — |
| T-parser-10 | unsetVar throws on empty name | — |

#### builtins/index.test.ts (14 tests)
| ID | Description | AC |
|---|---|---|
| T-builtin-01 | today('YYYYMMDD') returns 8-digit date string | AC3 |
| T-builtin-02 | now('HHmmss') returns 6-digit time string | AC4 |
| T-builtin-03 | uuid() returns UUID v4 pattern | AC5 |
| T-builtin-04 | uuid() returns different value on successive calls | AC5 |
| T-builtin-05 | random(6) returns 6-digit string, no leading zero | AC6 |
| T-builtin-06 | random(6) 100-iteration stress — no leading zero | AC6 |
| T-builtin-07 | random(0) throws | B-EX1 |
| T-builtin-08 | random rejects string argument | B-EX2 |
| T-builtin-09 | nearestWorkingDay returns today when inside working window | AC7 |
| T-builtin-10 | nearestWorkingDay advances to Monday on Saturday | AC8 |
| T-builtin-11 | nearestWorkingDay skips holiday | AC8 |
| T-builtin-12 | nearestWorkingDay throws when workingSchedule absent | AC9 |
| T-builtin-13 | nearestWorkingDay succeeds when holidays omitted | AC37 |
| T-builtin-14 | nearestWorkingDay skips weekend | AC8 |

#### methodRunner.test.ts (12 tests)
| ID | Description | AC |
|---|---|---|
| T-runner-01 | awaits async user function, coerces to string | AC10 |
| T-runner-02 | numeric return coerced to string | B-EX3 |
| T-runner-03 | single-quoted string arg stripped of quotes | AC11 |
| T-runner-04 | unquoted numeric arg becomes JS number | AC12 |
| T-runner-05 | ${varName} arg resolved before call | AC13 |
| T-runner-06 | built-in name collision throws at load time | AC32 |
| T-runner-07 | duplicate name across files throws at load time | AC33 |
| T-runner-08 | single string path in functions: loaded | AC34 |
| T-runner-09 | array of paths in functions: all loaded | AC35 |
| T-runner-10 | workingSchedule config parsed and used | AC36 |
| T-runner-11 | user fn throw → structured error message | AC38 |
| T-runner-12 | missing file path throws at load time | B-EX4 |

#### dispatcher.test.ts (14 tests)
| ID | Description | AC |
|---|---|---|
| T-dispatch-01 | testVarSet existence passes when set | AC14 |
| T-dispatch-02 | testVarSet existence fails when absent | AC15 |
| T-dispatch-03 | testVarSet existence fails on empty string | AC16 |
| T-dispatch-04 | testVarSet equality passes on match | AC17 |
| T-dispatch-05 | testVarSet equality fails with Expected/Got message | AC18 |
| T-dispatch-06 | testVarSet uses strict string equality | AC19 |
| T-dispatch-07 | setVar value interpolated at dispatch time | AC23/AC24 |
| T-dispatch-08 | setVar step N value visible at step N+1 | AC24 |
| T-dispatch-09 | runFlow sub-flow reads parent varMap | AC25 |
| T-dispatch-10 | runFlow sub-flow write visible in parent | AC26 |
| T-dispatch-11 | sessions share varMap (pending Arbiter ruling) | AC27 |
| T-dispatch-12 | absent var hard error at dispatch | AC30 |
| T-dispatch-13 | testVarSet equality on absent key fails (not crash) | B-EX7 |
| T-dispatch-14 | unsetVar on absent key = no-op, passes | AC20 |

#### var-scope.test.ts (4 tests)
| ID | Description | AC |
|---|---|---|
| T-scope-01 | parent setVar visible in sub-flow | AC25 |
| T-scope-02 | sub-flow setVar visible in parent after return | AC26 |
| T-scope-03 | sub-flow unsetVar removes var for parent | AC21/AC26 |
| T-scope-04 | cross-session scoping (pending Arbiter ruling) | AC27 |

#### lazy-interpolation-timing.test.ts (6 tests)
| ID | Description | AC |
|---|---|---|
| T-lazy-01 | loadAndParse does NOT resolve ${x} in command fields | AC23 |
| T-lazy-02 | dispatcher resolves ${x} at execution time | AC24 |
| T-lazy-03 | sequential dispatch sees mutated value | AC24 |
| T-lazy-04 | regression: appId still interpolated at parse time | B-EX8 |
| T-lazy-05 | regression: config path still interpolated at parse time | B-EX9 |
| T-lazy-06 | chained lazy references resolve in correct order | AC24 |

#### error-message-format.test.ts (8 tests — new file)
| ID | Description | AC |
|---|---|---|
| T-errors-01 | absent var error includes variable name | AC22/AC30 |
| T-errors-02 | absent var error is not empty string (hard error) | AC30 |
| T-errors-03 | built-in name clash error names the function | AC32 |
| T-errors-04 | duplicate name error names the function | AC33 |
| T-errors-05 | user fn throw → `setVar failed: fn() threw: msg` | AC38 |
| T-errors-06 | built-in throw → same error format | AC38 |
| T-errors-07 | testVarSet equality fail → Expected/Got format | AC18 |
| T-errors-08 | load-time conflict error names conflicting fn + built-in | AC32 |

---

## Arbiter Rulings

### Ruling 1: Sessions (AC27)
Confirmed: shared. T-dispatch-11 and T-scope-04 assert shared behaviour across sessions.

### Ruling 2: Hard error layer (AC22/AC30)
**`varMap.get(name)` returns `undefined`; the interpolator throws when it encounters `undefined` during substitution.**
Rationale: `testVarSet` needs safe boolean checks on map existence without try/catch. Errors surface at the correct semantic boundary — when an absent variable would corrupt a string.

### Ruling 3: AC23 test split
**Keep the split: parse-time assertion in `parser.test.ts`, dispatch-time assertion in `dispatcher.test.ts`.**
Rationale: matches the existing `within-parser.test.ts` / `within-dispatcher.test.ts` pattern; prevents one layer's regression masking the other.

### Ruling 4: AC31 default fallback
Confirmed in scope. `interpolate.ts` already implements `${varName:default}` via `resolveRef`. T-varmap-13 and T-varmap-14 stay.

### Ruling 5: File naming convention
**kebab-case for all new test files under `uivisor-app/tests/unit/`.**
Finding: all multi-word test files there are kebab-case (`within-dispatcher.test.ts`, `session-engine.test.ts`, etc.). Parser tests extend existing `parser.test.ts`. New files: `var-map.test.ts`, `set-var-commands.test.ts`, `builtin-methods.test.ts`, `method-runner.test.ts`, `var-scope.test.ts`, `lazy-interpolation-timing.test.ts`, `error-message-format.test.ts`.

### Final test count
**49 tests** across 9 files — no net change from rulings. All consolidated tests carry forward.

---

## Gate 0: Execution Plan

**Classification:** feature
**Complexity:** large

**Roles Activated:** Analyst, Architect, Tester Ensemble, Coder, Release Documenter, Deployer
**Designer Activated:** no

**Execution Sequence:**

1. Analyst → extract formal acceptance criteria from `docs/set-var-to-flow.yaml`
   Output: spec + acceptance criteria → state.md#gate-1
   [GATE 1: human approval required — revision cap: 2]

2. Architect → skill: to-tickets + codebase-design
   Reads: Gate 1 spec + acceptance criteria + existing codebase
   Output: feature/task breakdown table → state.md#feature-task-breakdown

3. Tester Ensemble Phase 1 → skill: tdd
   Reads: spec + acceptance criteria
   3a. tester_generator_a + tester_generator_b in parallel → each generates test cases
   3b. tester_consolidator → deduplicates → state.md#tests
   3c. tester_arbiter → resolves disagreements

4. Coder → skill: implement
   Reads: spec + tests from state.md
   Working directory: .worktrees/feat-implement-set-var-to-flow
   Output: source files → state.md#code-artifacts

4.5. Orchestrator — commit pipeline state into worktree

5. Tester Ensemble Phase 2 → skill: tdd + code-review
   5a-c. Same ensemble order as Phase 1 — runs tests, merges results
   Output: test results → state.md#test-results
   Retry cap: 3 | Review cap: 2

6. Quality Gate → skill: quality (tester_arbiter, autonomous)
   Output: pass/fail verdict → state.md#quality-gate
   [GATE 3: human approval required before deploying]

7. Release Documenter → signoff_package.md
8. Deployer → merge PR + deploy
9. Delivery Manager (autonomous) → retro.md

## Run Estimates

**Complexity:** large
**Duration:** ~67–127 min  (no retries: ~67 min)
**Cost:** ~$0.29–$0.53  (cap: $5.00)
**Tokens:** ~36K–90K

**Retry budgets:**
- TDD + quality gate: 3 rounds
- Spec revision: 2 rounds
- Design revision: n/a (Designer not activated)
- Code review: 2 rounds

---

## Lessons from Prior Runs (injected at Gate 0)

- **Reporter exhaustiveness:** Adding a new `Command` union member requires updating 5 switch statements — `commandParser.ts`, `dispatcher.ts`, `commands.ts`, `console.ts`, `html.ts`, `markdown.ts`. `dispatcher.ts` has no TS exhaustiveness guard — easy to silently miss.
- **screenshot screenshotPath pattern:** Only the screenshot command sets `screenshotPath` on success. All others set it on failure only. Use a `capturedScreenshotPath` local before the try block.

## Test Results (Phase 2)

**Fixes applied:**
- Fixed `freshCtx()` in integration tests to include `varMap` and `methodRunner` (AC: RunContext wiring)
- Fixed `html.ts` double-escaping for setVar/testVarSet/unsetVar labels (AC39/reporter)
- Fixed `cli/index.ts`: reporter files written to `process.cwd()` not `runDir` (pre-existing AC57/60/62 mismatch)

**Final test run:**
- Total: 723 passed, 4 expected-fail (727 total)
- Integration tests: 89 passed (commands.test.ts + cli.test.ts + sessions.test.ts)
- Unit tests: 634 passed (26 test files)
- TypeScript: clean

## Quality Gate

**Verdict: PASS**

**Checks:**
- All tests pass: ✓
- TypeScript clean: ✓
- New Command types in reporters: ✓ (console, html, markdown)
- Dispatcher exhaustiveness guard: ✓
- Spec AC coverage: 39/39 ✓

**Non-blocking findings (logged, do not block):**
1. Sub-flow vars: blocks not merged into parent varMap — ambiguous in spec, backward-compat concern for future ticket
2. processArg coerces resolved ${varName} matching /^\d+$/ to number — edge case, document in spec
3. unsetKeys set grows on phantom unsets — harmless, optimize later

**Last checkpoint:** Quality Gate at 2026-09-17
