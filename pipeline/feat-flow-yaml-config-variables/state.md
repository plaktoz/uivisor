# Pipeline State: feat-flow-yaml-config-variables

**Task:** Load config for the flow YAML file by defining values in the YAML (e.g. varA:1), allow varA to be used in multiple places in the YAML, support loading from env variables, and use a default value when no value is provided.
**Started:** 2026-09-05
**Status:** in_progress

## Worktree
**Path:** .worktrees/feat-flow-yaml-config-variables
**Branch:** feat-flow-yaml-config-variables
**Created:** 2026-09-05
**Status:** active

## Gate 0: Execution Plan

**Classification:** feature
**Complexity:** medium

**Roles Activated:** Analyst, Architect, Tester Ensemble, Coder, Release Documenter, Deployer
**Designer Activated:** no

**Execution Sequence:**
1. Analyst → skill: to-spec
   Output: spec + acceptance criteria → state.md#gate-1
   [GATE 1: human approval required — revision cap: 2]
2. Architect → skill: to-tickets + codebase-design
   Reads: Gate 1 spec
   Output: feature/task breakdown table → state.md#feature-task-breakdown
3. Tester Ensemble Phase 1 → skill: tdd
   Reads: spec + acceptance criteria
   3a. tester_generator_a + tester_generator_b in parallel → each generates test cases
       → copy generator_a raw output to state.md#tests-generator-a
       → copy generator_b raw output to state.md#tests-generator-b
   3b. tester_consolidator → reads both sections, deduplicates → state.md#tests
   3c. tester_arbiter → resolves any generator disagreements before finalizing
   Output: unit tests + integration tests → state.md#tests
4. Coder → skill: implement
   Reads: spec + tests from state.md
   Working directory: .worktrees/feat-flow-yaml-config-variables
   Output: source files → state.md#code-artifacts
5. Tester Ensemble Phase 2 → skill: tdd + code-review
   Reads: state.md#tests + all source files
   Output: test results → state.md#test-results
   Retry cap: 3 | Review cap: 2
6. Quality Gate → skill: quality (tester_arbiter, autonomous)
   Output: pass/fail verdict → state.md#quality-gate
   [GATE 3: human approval required before deploying]
7. Build Verification (autonomous — after Quality Gate PASS)
   Output: build_check.md
8. Release Documenter → skill: proj-deploy
   Output: signoff_package.md
9. Deployer → skill: proj-deploy
10. Delivery Manager (autonomous — no gate)
    Output: retro.md

## Gate 1: Spec

# PRD: Flow Variable Interpolation

## 1. Summary

This feature adds a configuration variable system to uivisor flow YAML files. Authors can declare named variables in a top-level `vars:` block, reference an external YAML config file via a `config:` header field, and reference those variables anywhere in the same file using `${varName}` interpolation syntax. A variable's value is resolved from four sources in priority order: environment variable override, config file value, inline `vars:` value, and a hard-coded fallback default in the expression (`${varName:fallback}`). This eliminates copy-paste repetition of values like base URLs, test credentials, and port numbers, and allows the same flow to be driven by CI environment variables or shared config files without modifying the YAML on disk.

## 2. Scope

**In scope:**
- A new `vars:` top-level YAML block for declaring inline variable values; supports flat key-value pairs or arbitrarily nested cascade format (flattened to dotted keys at load time)
- A new `config:` header field pointing to an external YAML file of variable definitions; the path itself supports `${env.VAR:default}` interpolation; the file supports the same flat or cascade format as `vars:`
- `${varName}` interpolation in string-typed YAML values anywhere in the file (header fields, command arguments, selector strings)
- `${env.VAR_NAME}` syntax to read a value from `process.env` at parse time
- A colon-delimited default: `${varName:default}` and `${env.VAR_NAME:default}`
- Combining env + default in one expression: `${env.VAR_NAME:fallbackValue}`
- Config file values may themselves contain `${env.VAR_NAME}` / `${env.VAR_NAME:default}` expressions, resolved at config-load time
- `vars:` and `config:` may coexist; config file values take precedence over `vars:` inline values for the same key
- Variables scoped to the file in which they are declared; they do not leak into sub-flows called via `runFlow`
- Variable substitution applied to the `appId`/`url` header string as well as all command string fields

**Out of scope:**
- Cross-file variable sharing or inheritance
- Variable interpolation inside non-string YAML values (integers, booleans such as `wait`, `shared`, `setViewport` dimensions)
- Dynamic/computed expressions (arithmetic, conditionals, concatenation beyond a single reference)
- Variable values that themselves reference other variables (no recursive interpolation)
- CLI flag overrides for variable values (a follow-on feature)
- Secret masking in reporter output

## 3. YAML Syntax

### 3.1 Inline variable declaration

`vars:` supports both flat and cascade (nested) format. Both produce the same flattened key map.

**Flat:**
```yaml
appId: http://localhost:${server.port}/login
vars:
  server.host: localhost
  server.port: "5173"
  data.username: alice
  data.password: password1
```

**Cascade (equivalent):**
```yaml
appId: http://localhost:${server.port}/login
vars:
  server:
    host: localhost
    port: "5173"
  data:
    username: alice
    password: password1
commands:
  - goto: "http://${server.host}:${server.port}/login"
  - inputText:
      element: { testId: "login-username" }
      text: "${data.username}"
  - inputText:
      element: { testId: "login-password" }
      text: "${data.password}"
  - tapOn:
      testId: "login-submit"
  - assertUrl: "/tasks"
```

### 3.1b External config file

The `config:` path is resolved using env-only interpolation before any `vars:` are loaded:

```yaml
# flow file
appId: http://localhost:${port}/login
config: ${env.testflow.config:testflow.config}
vars:
  port: "5173"          # overridden by config file if config also declares 'port'
commands:
  - goto: "http://localhost:${port}/login"
  - inputText:
      element: { testId: "login-username" }
      text: "${username}"
```

```yaml
# testflow.config  (external YAML config file — cascade format)
server:
  host: ${env.APP_HOST:localhost}
  port: ${env.APP_PORT:3000}
data:
  username: ${env.TEST_USERNAME:alice}
  password: ${env.TEST_PASSWORD:secret}
  page1:
    button1: My Button
    title: Welcome
```

Flattens to: `server.host`, `server.port`, `data.username`, `data.password`, `data.page1.button1`, `data.page1.title`.

With this config, `${port}` resolves to `"3000"` (config wins over `vars:`), and `${username}` resolves to the value of `TEST_USERNAME` env var, or `"alice"` if unset.

### 3.2 Reference syntax

| Expression | Resolution |
|---|---|
| `${varName}` | Value from `vars:` block |
| `${env.MY_VAR}` | Value of `process.env.MY_VAR` |
| `${varName:default}` | Value from `vars:`, falling back to `default` if missing or empty |
| `${env.MY_VAR:fallback}` | Value of `process.env.MY_VAR`, falling back to `fallback` if unset or empty |

### 3.3 Environment variable override

If an environment variable is defined with the same name as a `vars:` key, it takes precedence over the inline value.

### 3.4 Default values

```yaml
vars:
  username: alice
commands:
  - inputText:
      element:
        testId: "login-username"
      text: "${username:guest}"
  - inputText:
      element:
        testId: "login-password"
      text: "${password:secret123}"
```

### 3.5 Multiple references in one string

```yaml
vars:
  host: localhost
  port: "5173"
commands:
  - goto: "http://${host}:${port}/dashboard"
```

### 3.6 Literal `${`

Write `$\{` to produce a literal `${` in output.

## 4. Acceptance Criteria

**Variable declaration**
1. A flow YAML with a `vars:` block is parsed without error; values are available for interpolation.
2. `vars:` is optional — flow files without it behave identically to current behavior.
3. `vars:` is added to `VALID_HEADER_KEYS` so it does not trigger "Unknown header key".
4. Variable names (after flattening) must match `^[a-zA-Z_][a-zA-Z0-9_.]*$`; otherwise parse error naming the offending key. Names equal to `env` or starting with `env.` are reserved and cause a parse error.
5. Duplicate variable names (after flattening) in `vars:` cause a parse error naming the duplicate key.
6. Leaf variable values are coerced to strings: integer → `"5173"`, boolean → `"true"`/`"false"`, null → `""`. A non-scalar leaf (nested object or array) is a parse error: `Invalid vars value for "${key}": must be a scalar in <filePath>`.
6a. Both `vars:` (in the flow file) and config files support flat key-value pairs or arbitrarily nested cascade YAML; nested objects are flattened to dotted keys by joining each level with `.` (e.g. `data.page1.button1`).
6b. Flat and cascade formats may be mixed within the same `vars:` block or config file.

**Interpolation**
7. `${varName}` in any string field is replaced with the resolved value before the field is used.
8. Interpolation is applied to the `appId`/`url` header field.
9. Interpolation is applied to all string-typed command fields: URLs in `goto`, text in `inputText`/`inputTextTargeted`, path strings in `runFlow` and `screenshot`, expected strings in `assertText`/`assertValue`/`assertUrl`, key in `pressKey`, value in `selectOption`, and selector string shorthand values.
10. Interpolation is NOT applied to integer or boolean fields (`wait`, `waitFor`, `setViewport` dimensions, `assertCount` expected, `shared`).
11. A string with multiple `${...}` expressions has all of them replaced independently.
12. No second pass of interpolation is performed after all expressions resolve.

**Environment variable resolution**
13. If `process.env` contains a key matching a declared variable name (case-sensitive), that env value takes precedence over the inline `vars:` value.
14. `${env.VAR_NAME}` reads `process.env.VAR_NAME` regardless of whether `VAR_NAME` is in `vars:`.
15. When `process.env.VAR_NAME` is undefined/empty and no default is specified, the expression resolves to `""`.

**Default values**
16. `${varName:default_value}` resolves to `default_value` when `varName` is not declared or its resolved value is empty.
17. `${env.MY_VAR:fallback}` resolves to `fallback` when `process.env.MY_VAR` is unset or empty.
18. The default value portion is treated as a literal string; it is not itself interpolated.
19. A default value may contain any characters except `}`; a `:` in the default portion is treated as a literal character (only the first `:` inside `${...}` acts as the delimiter).

**Priority order**
20. Resolution priority: `process.env.foo` (non-empty) > config file value for `foo` (non-empty) > `vars.foo` (declared + non-empty) > default in expression > empty string.

**FlowFile type**
21. `FlowFile` gains an optional `vars` field `Record<string, string>` containing the fully-resolved variable map. Sub-flows via `runFlow` receive their own separate `vars` map.

**Interpolation timing**
22. Variable substitution occurs after `readYamlFile` returns but before `validateHeader`, `validateCommandList`, and `parseCommand` process the values.

**Config file loading**
23. A flow YAML with a `config:` header field loads variables from the specified YAML file; the file must exist or a parse error is thrown: `Config file not found: <path> (referenced in <flowFilePath>)`.
24. The `config:` value is resolved using env-only interpolation (only `${env.VAR}` and `${env.VAR:default}` expressions); `${varName}` refs to `vars:` are not available at this stage.
25. The config file supports flat or cascade YAML format; the same flattening and validation rules as `vars:` apply (scalar leaf values, valid dotted names, no duplicate keys after flattening).
26. Config file values may contain `${env.VAR_NAME}` and `${env.VAR_NAME:default}` expressions; these are resolved at config-load time using `process.env`.
27. When `config:` and `vars:` are both present and declare the same key, the config file value takes precedence over the `vars:` inline value.
28. `config:` is added to `VALID_HEADER_KEYS`.

## 5. Error Cases

| Condition | Error message |
|---|---|
| `vars:` value is an object or array | `Invalid vars value for "${key}": must be a scalar in <filePath>` |
| Variable name fails regex | `Invalid variable name "${key}": must match ^[a-zA-Z_][a-zA-Z0-9_.]*$ in <filePath>` |
| Variable name is `env` or starts with `env.` | `Reserved variable name "${key}": "env" and "env.*" are reserved in <filePath>` |
| Duplicate variable name | `Duplicate variable "${key}" in vars block in <filePath>` |
| `${` with no closing `}` | `Malformed variable expression (missing closing "}") in <filePath>` |
| Config file not found | `Config file not found: <path> (referenced in <flowFilePath>)` |
| Config file is not a flat YAML map (e.g. nested object, array at root) | `Invalid config file: must be a flat key-value map in <configFilePath>` |
| Undeclared var, no env, no default | Silently resolves to `""` (existing validators may then throw if the result is invalid) |

## 6. Files to Change

| File | Change |
|---|---|
| `packages/core/src/types.ts` | Add `vars?: Record<string, string>` to `FlowFile` |
| `uivisor-app/src/parser/validator.ts` | Add `'vars'` to `VALID_HEADER_KEYS`; add `validateVars()` |
| `uivisor-app/src/parser/interpolate.ts` | New file: `flattenVars()` (recursive dotted-key flattener), `resolveVars()`, `interpolateValue()`, `interpolateObject()`, `loadConfigFile()` |
| `uivisor-app/src/parser/index.ts` | Resolve `config:` path (env-only), load config file if present, merge var sources per priority, interpolate raw object before passing to validators |
| `uivisor-app/tests/unit/parser.test.ts` | Add test suite for all ACs above |

**Last checkpoint:** Architect complete at 2026-09-05

## Feature & Task Breakdown

| ID | Title | File(s) | Depends On | Status |
|---|---|---|---|---|
| T-01 | Add `vars` field to `FlowFile` type | `packages/core/src/types.ts` | — | open |
| T-02 | Accept `vars`/`config` header keys; export `validateVars` | `uivisor-app/src/parser/validator.ts` | — | open |
| T-03 | Implement `flattenVars` | `uivisor-app/src/parser/interpolate.ts` (new) | — | open |
| T-04 | Implement `resolveRef`, `interpolateValue`, `interpolateObject` | `uivisor-app/src/parser/interpolate.ts` | T-03 | open |
| T-05 | Implement `loadConfigFile` | `uivisor-app/src/parser/interpolate.ts` | T-03, T-04 | open |
| T-06 | Wire two-pass bootstrap in `loadAndParse` | `uivisor-app/src/parser/index.ts` | T-01, T-02, T-03, T-04, T-05 | open |
| T-07 | Add interpolation test suite | `uivisor-app/tests/unit/parser.test.ts` | T-06 | open |

**Independent (can be coded in parallel):** T-01, T-02, T-03

## Seam Notes

- **T-01 → T-06:** `FlowFile.vars?: Record<string, string>` — T-06 populates it with `mergedVars`
- **T-02 → T-06:** `validateVars(raw, filePath)` checks top-level shape only; `VALID_HEADER_KEYS` must include `'vars'` and `'config'`
- **T-03 → T-05, T-06:** `flattenVars(raw, filePath)` is the single point of truth for name validation, reserved-name rejection, non-scalar leaf rejection, duplicate detection
- **T-04 → T-05, T-06:** `interpolateValue(value, vars)` and `interpolateObject(obj, vars)` — T-05 calls with `{}` (env-only); T-06 calls with full `mergedVars`
- **T-05 → T-06:** `loadConfigFile(configPath, flowFilePath)` returns flat `Record<string,string>` with env refs already resolved

## Codebase Design Notes

1. **Never mutate `raw`** — `interpolateObject` must deep-copy; `raw` stays untouched, `doc` is the interpolated result
2. **Error message format** — `<message> in ${filePath}` suffix, matching `validator.ts` convention exactly
3. **Config path resolves relative to flow file** — use `path.dirname(path.resolve(flowFilePath))`, not `process.cwd()`
4. **Bootstrap order is strict** — config path → config vars → inline vars → merge → full interpolation → validate → parse; comment the passes in `index.ts`
5. **Reserved-name guard lives in `flattenVars`** — not in `validateVars`; applies uniformly to both `vars:` and config files
6. **Unclosed `${` requires forward-scan** — naive regex silently skips unclosed; must throw parse error
7. **Env-only for config path = `interpolateValue(path, {})`** — empty vars map gives env-only resolution naturally; no separate function needed

## Tests — Generator A (tester_generator_a)

TC-A-001: flattenVars — flat vars block parsed without error | AC:1 | unit
TC-A-002: flattenVars — nested cascade flattened with dot-join | AC:6a | unit
TC-A-003: flattenVars — mixed flat and nested in same block | AC:6b | unit
TC-A-004: flattenVars — integer leaf coerced to string | AC:6 | unit
TC-A-005: flattenVars — boolean true coerced to "true" | AC:6 | unit
TC-A-006: flattenVars — boolean false coerced to "false" | AC:6 | unit
TC-A-007: flattenVars — null coerced to "" | AC:6 | unit
TC-A-008: flattenVars — array leaf causes parse error | AC:6 | unit
TC-A-009: flattenVars — empty object leaf causes parse error | AC:6 | unit
TC-A-010: flattenVars — name starts with digit → parse error | AC:4 | unit
TC-A-011: flattenVars — name contains hyphen → parse error | AC:4 | unit
TC-A-012: flattenVars — valid name with underscores and digits passes | AC:4 | unit
TC-A-013: flattenVars — reserved name "env" → parse error | AC:4 | unit
TC-A-014: flattenVars — reserved name "env.PATH" → parse error | AC:4 | unit
TC-A-015: flattenVars — duplicate key after flattening → parse error | AC:5 | unit
TC-A-016: flattenVars — empty vars block returns {} | AC:2 | unit
TC-A-017: flattenVars — 3-level deep nesting flattened correctly | AC:6a | unit
TC-A-018: resolveRef — resolves declared variable by name | AC:7 | unit
TC-A-019: resolveRef — resolves env.VAR_NAME from process.env | AC:14 | unit
TC-A-020: resolveRef — env.VAR_NAME resolves to "" when undefined | AC:15 | unit
TC-A-021: resolveRef — env.VAR:default returns default when env unset | AC:17 | unit
TC-A-022: resolveRef — env.VAR:default returns env value when env set | AC:17 | unit
TC-A-023: resolveRef — ${var:default} returns declared value when non-empty | AC:16 | unit
TC-A-024: resolveRef — ${var:default} returns default when var not declared | AC:16 | unit
TC-A-025: resolveRef — ${var:default} returns default when var is "" | AC:16 | unit
TC-A-026: resolveRef — default containing ":" uses only first ":" as delimiter | AC:19 | unit
TC-A-027: resolveRef — default containing special chars treated literally | AC:19 | unit
TC-A-028: resolveRef — process.env takes precedence over vars | AC:13,20 | unit
TC-A-029: resolveRef — undeclared var, no env, no default → "" | AC:15 | unit
TC-A-030: interpolateValue — single expression replaced | AC:7 | unit
TC-A-031: interpolateValue — multiple expressions in string all replaced | AC:11 | unit
TC-A-032: interpolateValue — string with no expressions returned unchanged | AC:7 | unit
TC-A-033: interpolateValue — integer value returned as-is | AC:10 | unit
TC-A-034: interpolateValue — boolean value returned as-is | AC:10 | unit
TC-A-035: interpolateValue — unclosed "${"  → parse error | error | unit
TC-A-036: interpolateValue — no second pass: resolved value with "${...}" not re-evaluated | AC:12 | unit
TC-A-037: interpolateObject — all string fields in flat object interpolated | AC:7,9 | unit
TC-A-038: interpolateObject — integer and boolean fields left untouched | AC:10 | unit
TC-A-039: interpolateObject — recursively interpolates nested objects | AC:7 | unit
TC-A-040: loadConfigFile — loads and flattens valid YAML | AC:23,25 | unit
TC-A-041: loadConfigFile — file not found → parse error with path | AC:23 | unit
TC-A-042: loadConfigFile — YAML list (not map) → parse error | AC:error | unit
TC-A-043: loadConfigFile — config values with ${env.VAR} resolved at load time | AC:26 | unit
TC-A-044: loadConfigFile — env.VAR:default in config value uses default when unset | AC:26 | unit
TC-A-045: loadConfigFile — config path resolved via env before file opened | AC:24 | unit
TC-A-046: loadConfigFile — config path default used when env unset | AC:24 | unit
TC-A-047: loadAndParse — no vars: block parses identically to current behavior | AC:2 | integration
TC-A-048: loadAndParse — vars: block values interpolated into goto URL | AC:1,8,22 | integration
TC-A-049: loadAndParse — vars: and config: in VALID_HEADER_KEYS | AC:3,28 | integration
TC-A-050: loadAndParse — config values override vars values | AC:23,27 | integration
TC-A-051: loadAndParse — FlowFile.vars contains fully-resolved map | AC:21 | integration
TC-A-052: loadAndParse — interpolation applied to inputText field | AC:9 | integration
TC-A-053: loadAndParse — interpolation applied to assertText expected | AC:9 | integration
TC-A-054: loadAndParse — wait integer field not interpolated | AC:10 | integration
TC-A-055: loadAndParse — interpolation applied to runFlow path | AC:9 | integration
TC-A-056: loadAndParse — priority: process.env > config > vars | AC:20 | integration

## Tests — Generator B (tester_generator_b)

TC-B-001: flattenVars — flat vars parsed without error | AC:1 | unit
TC-B-002: flattenVars — undefined raw returns {} | AC:2 | unit
TC-B-003: flattenVars — integer leaf coerced to string | AC:6 | unit
TC-B-004: flattenVars — boolean true coerced to "true" | AC:6 | unit
TC-B-005: flattenVars — boolean false coerced to "false" | AC:6 | unit
TC-B-006: flattenVars — null leaf coerced to "" | AC:6 | unit
TC-B-007: flattenVars — empty object {} leaf → parse error | AC:6 | unit
TC-B-008: flattenVars — 2-level cascade flattened with dot | AC:6a | unit
TC-B-009: flattenVars — 3-level cascade flattened with dots | AC:6a | unit
TC-B-010: flattenVars — mixed flat and cascade in same block | AC:6b | unit
TC-B-011: flattenVars — name starting with digit → parse error | AC:4 | unit
TC-B-012: flattenVars — name containing hyphen → parse error | AC:4 | unit
TC-B-013: flattenVars — empty string name → parse error | AC:4 | unit
TC-B-014: flattenVars — lone dot name → parse error | AC:4 | unit
TC-B-015: flattenVars — name exactly "env" → parse error | AC:4 | unit
TC-B-016: flattenVars — cascade producing "env.MY_VAR" → parse error | AC:4 | unit
TC-B-017: flattenVars — duplicate after flattening (flat + cascade collision) → parse error naming key | AC:5 | unit
TC-B-018: flattenVars — leading underscore is valid | AC:4 | unit
TC-B-019: flattenVars — dotted name from cascade passes regex | AC:4,6a | unit
TC-B-020: resolveRef — simple lookup from vars | AC:7 | unit
TC-B-021: resolveRef — process.env overrides vars (case-sensitive) | AC:13,20 | unit
TC-B-022: resolveRef — ${env.VAR} reads process.env ignoring vars | AC:14 | unit
TC-B-023: resolveRef — missing var, no env, no default → "" | AC:15 | unit
TC-B-024: resolveRef — ${var:default} uses default when var missing | AC:16 | unit
TC-B-025: resolveRef — ${var:default} uses default when var is "" | AC:16 | unit
TC-B-026: resolveRef — ${env.VAR:fallback} uses fallback when env unset | AC:17 | unit
TC-B-027: resolveRef — ${env.VAR:fallback} uses fallback when env is "" | AC:17 | unit
TC-B-028: resolveRef — default with ":" — only first ":" is delimiter | AC:19 | unit
TC-B-029: resolveRef — ${foo:} — empty default resolves to "" | AC:16 | unit
TC-B-030: resolveRef — default portion containing ${...} is literal, not interpolated | AC:18 | unit
TC-B-031: interpolateValue — unclosed "${"  → parse error | error | unit
TC-B-032: interpolateValue — single substitution | AC:7 | unit
TC-B-033: interpolateValue — multiple expressions replaced independently | AC:11 | unit
TC-B-034: interpolateValue — no second pass on resolved value | AC:12 | unit
TC-B-035: interpolateValue — number passed through unchanged | AC:10 | unit
TC-B-036: interpolateValue — boolean passed through unchanged | AC:10 | unit
TC-B-037: interpolateObject — string fields interpolated | AC:9 | unit
TC-B-038: interpolateObject — integer field not interpolated | AC:10 | unit
TC-B-039: interpolateObject — boolean field not interpolated | AC:10 | unit
TC-B-040: interpolateObject — appId field interpolated | AC:8 | unit
TC-B-041: interpolateObject — url field interpolated | AC:8 | unit
TC-B-042: interpolateObject — selector string interpolated | AC:9 | unit
TC-B-043: interpolateObject — screenshot path interpolated | AC:9 | unit
TC-B-044: interpolateObject — runFlow path interpolated | AC:9 | unit
TC-B-045: loadConfigFile — valid YAML loaded and flattened | AC:23,25 | unit
TC-B-046: loadConfigFile — missing file → hard error | AC:23 | unit
TC-B-047: loadConfigFile — YAML array root → parse error | AC:error | unit
TC-B-048: loadConfigFile — ${env.VAR:default} in config values resolved | AC:26 | unit
TC-B-049: loadConfigFile — cascade nesting in config file flattened | AC:25 | unit
TC-B-050: loadConfigFile — config with only env refs and no static values | AC:26 | unit
TC-B-051: loadAndParse — config wins over vars for same key | AC:27 | integration
TC-B-052: loadAndParse — process.env wins over config for same key | AC:20 | integration
TC-B-053: loadAndParse — FlowFile.vars contains fully resolved map | AC:21 | integration
TC-B-054: loadAndParse — interpolation runs after readYamlFile, before validators | AC:22 | integration
TC-B-055: loadAndParse — no vars/config → same as current behavior | AC:2 | integration
TC-B-056: loadAndParse — overlapping and non-overlapping keys from vars + config | AC:20,27 | integration
TC-B-057: loadAndParse — config: not rejected as unknown header key | AC:3,28 | integration
TC-B-058: loadAndParse — vars: not rejected as unknown header key | AC:3 | integration
TC-B-059: loadAndParse — config: path resolved via env-only interpolation | AC:24 | integration

## Tests

### Attribution

| AC | Generator A | Generator B |
|---|---|---|
| AC:1 | ✓ | ✓ |
| AC:2 | ✓ | ✓ |
| AC:3 | ✓ | ✓ |
| AC:4 | ✓ | ✓ |
| AC:5 | ✓ | ✓ |
| AC:6 | ✓ | ✓ |
| AC:6a | ✓ | ✓ |
| AC:6b | ✓ | ✓ |
| AC:7 | ✓ | ✓ |
| AC:8 | ✓ | ✓ |
| AC:9 | ✓ | ✓ |
| AC:10 | ✓ | ✓ |
| AC:11 | ✓ | ✓ |
| AC:12 | ✓ | ✓ |
| AC:13 | ✓ | ✓ |
| AC:14 | ✓ | ✓ |
| AC:15 | ✓ | ✓ |
| AC:16 | ✓ | ✓ |
| AC:17 | ✓ | ✓ |
| AC:18 | — | ✓ |
| AC:19 | ✓ | ✓ |
| AC:20 | ✓ | ✓ |
| AC:21 | ✓ | ✓ |
| AC:22 | ✓ | ✓ |
| AC:23 | ✓ | ✓ |
| AC:24 | ✓ | ✓ |
| AC:25 | ✓ | ✓ |
| AC:26 | ✓ | ✓ |
| AC:27 | ✓ | ✓ |
| AC:28 | ✓ | ✓ |

**Unique to A:** 13  **Unique to B:** 15  **Shared:** 44  **Total after dedup:** 72

### Consolidated test plan

TC-001: flattenVars — flat vars block parsed without error | Function: flattenVars | AC:1 | unit | Source: both
TC-002: flattenVars — undefined or empty input returns {} | Function: flattenVars | AC:2 | unit | Source: both
TC-003: flattenVars — integer leaf coerced to string | Function: flattenVars | AC:6 | unit | Source: both
TC-004: flattenVars — boolean true coerced to "true" | Function: flattenVars | AC:6 | unit | Source: both
TC-005: flattenVars — boolean false coerced to "false" | Function: flattenVars | AC:6 | unit | Source: both
TC-006: flattenVars — null coerced to "" | Function: flattenVars | AC:6 | unit | Source: both
TC-007: flattenVars — array leaf causes parse error | Function: flattenVars | AC:6 | unit | Source: A
TC-008: flattenVars — empty object {} leaf causes parse error | Function: flattenVars | AC:6 | unit | Source: both
TC-009: flattenVars — 2-level cascade flattened with dot-join | Function: flattenVars | AC:6a | unit | Source: both
TC-010: flattenVars — 3-level deep nesting flattened correctly | Function: flattenVars | AC:6a | unit | Source: both
TC-011: flattenVars — mixed flat and cascade in same block | Function: flattenVars | AC:6b | unit | Source: both
TC-012: flattenVars — name starting with digit → parse error | Function: flattenVars | AC:4 | unit | Source: both
TC-013: flattenVars — name containing hyphen → parse error | Function: flattenVars | AC:4 | unit | Source: both
TC-014: flattenVars — empty string name → parse error | Function: flattenVars | AC:4 | unit | Source: B
TC-015: flattenVars — lone dot "." name → parse error | Function: flattenVars | AC:4 | unit | Source: B
TC-016: flattenVars — leading underscore is valid | Function: flattenVars | AC:4 | unit | Source: both
TC-017: flattenVars — reserved name "env" → parse error | Function: flattenVars | AC:4 | unit | Source: both
TC-018: flattenVars — cascade producing "env.MY_VAR" → parse error | Function: flattenVars | AC:4 | unit | Source: both
TC-019: flattenVars — flat+cascade collision → parse error naming key | Function: flattenVars | AC:5 | unit | Source: both
TC-020: flattenVars — dotted name from cascade passes regex | Function: flattenVars | AC:4,6a | unit | Source: B
TC-021: resolveRef — resolves declared variable | Function: resolveRef | AC:7 | unit | Source: both
TC-022: resolveRef — ${env.VAR_NAME} reads process.env ignoring vars | Function: resolveRef | AC:14 | unit | Source: both
TC-023: resolveRef — env.VAR_NAME undefined → "" | Function: resolveRef | AC:15 | unit | Source: A
TC-024: resolveRef — process.env beats vars (case-sensitive) | Function: resolveRef | AC:13,20 | unit | Source: both
TC-025: resolveRef — undeclared var, no env, no default → "" | Function: resolveRef | AC:15 | unit | Source: both
TC-026: resolveRef — ${var:default} returns var value when non-empty | Function: resolveRef | AC:16 | unit | Source: A
TC-027: resolveRef — ${var:default} returns default when var missing | Function: resolveRef | AC:16 | unit | Source: both
TC-028: resolveRef — ${var:default} returns default when var is "" | Function: resolveRef | AC:16 | unit | Source: both
TC-029: resolveRef — ${foo:} empty default resolves to "" | Function: resolveRef | AC:16 | unit | Source: B
TC-030: resolveRef — ${env.VAR:fallback} fallback when env unset | Function: resolveRef | AC:17 | unit | Source: both
TC-031: resolveRef — ${env.VAR:fallback} fallback when env is "" | Function: resolveRef | AC:17 | unit | Source: B
TC-032: resolveRef — ${env.VAR:fallback} returns env value when set | Function: resolveRef | AC:17 | unit | Source: A
TC-033: resolveRef — default with ":" uses only first ":" as delimiter | Function: resolveRef | AC:19 | unit | Source: both
TC-034: resolveRef — default containing ${...} treated literally (no re-interpolation) | Function: resolveRef | AC:18 | unit | Source: B
TC-035: resolveRef — default with special chars treated literally | Function: resolveRef | AC:19 | unit | Source: A
TC-036: interpolateValue — single expression replaced | Function: interpolateValue | AC:7 | unit | Source: both
TC-037: interpolateValue — multiple expressions all replaced independently | Function: interpolateValue | AC:11 | unit | Source: both
TC-038: interpolateValue — no-expression string returned unchanged | Function: interpolateValue | AC:7 | unit | Source: A
TC-039: interpolateValue — integer passed through unchanged | Function: interpolateValue | AC:10 | unit | Source: both
TC-040: interpolateValue — boolean passed through unchanged | Function: interpolateValue | AC:10 | unit | Source: both
TC-041: interpolateValue — unclosed "${" → parse error | Function: interpolateValue | AC:error | unit | Source: both
TC-042: interpolateValue — no second pass on resolved value | Function: interpolateValue | AC:12 | unit | Source: both
TC-043: interpolateObject — string fields in flat object interpolated | Function: interpolateObject | AC:7,9 | unit | Source: both
TC-044: interpolateObject — integer field not interpolated | Function: interpolateObject | AC:10 | unit | Source: both
TC-045: interpolateObject — boolean field not interpolated | Function: interpolateObject | AC:10 | unit | Source: both
TC-046: interpolateObject — appId header interpolated | Function: interpolateObject | AC:8 | unit | Source: B
TC-047: interpolateObject — url header interpolated | Function: interpolateObject | AC:8 | unit | Source: B
TC-048: interpolateObject — selector string interpolated | Function: interpolateObject | AC:9 | unit | Source: B
TC-049: interpolateObject — screenshot path interpolated | Function: interpolateObject | AC:9 | unit | Source: B
TC-050: interpolateObject — runFlow path interpolated | Function: interpolateObject | AC:9 | unit | Source: B
TC-051: interpolateObject — nested objects recursively interpolated | Function: interpolateObject | AC:7 | unit | Source: A
TC-052: loadConfigFile — valid YAML loaded and cascade-flattened | Function: loadConfigFile | AC:23,25 | unit | Source: both
TC-053: loadConfigFile — missing file → parse error with path | Function: loadConfigFile | AC:23 | unit | Source: both
TC-054: loadConfigFile — YAML array root → parse error | Function: loadConfigFile | AC:error | unit | Source: both
TC-055: loadConfigFile — ${env.VAR} in config values resolved at load time | Function: loadConfigFile | AC:26 | unit | Source: both
TC-056: loadConfigFile — ${env.VAR:default} in config uses default when unset | Function: loadConfigFile | AC:26 | unit | Source: both
~~TC-057: REMOVED — path interpolation belongs in loadAndParse, not loadConfigFile (AC:24 covered by TC-072)~~
~~TC-058: REMOVED — same reason as TC-057~~
TC-059: loadConfigFile — cascade nesting in config file flattened | Function: loadConfigFile | AC:25 | unit | Source: B
TC-060: loadConfigFile — config with only env refs, no static values | Function: loadConfigFile | AC:26 | unit | Source: B
TC-061: loadAndParse — no vars/config → same as current behavior | Function: loadAndParse | AC:2 | integration | Source: both
TC-062: loadAndParse — vars interpolated into goto URL and appId | Function: loadAndParse | AC:1,8,22 | integration | Source: both
TC-063: loadAndParse — vars: and config: accepted as valid header keys | Function: loadAndParse | AC:3,28 | integration | Source: both
TC-064: loadAndParse — config file value overrides vars for same key | Function: loadAndParse | AC:23,27 | integration | Source: both
TC-065: loadAndParse — FlowFile.vars contains fully resolved map | Function: loadAndParse | AC:21 | integration | Source: both
TC-066: loadAndParse — inputText field interpolated | Function: loadAndParse | AC:9 | integration | Source: A
TC-067: loadAndParse — assertText expected interpolated | Function: loadAndParse | AC:9 | integration | Source: A
TC-068: loadAndParse — wait integer not interpolated | Function: loadAndParse | AC:10 | integration | Source: A
TC-069: loadAndParse — runFlow path interpolated | Function: loadAndParse | AC:9 | integration | Source: A
TC-070: loadAndParse — priority: process.env > config > vars | Function: loadAndParse | AC:20 | integration | Source: both
TC-071: loadAndParse — overlapping + non-overlapping keys merged correctly | Function: loadAndParse | AC:20,27 | integration | Source: B
TC-072: loadAndParse — config: path via env-only interpolation | Function: loadAndParse | AC:24 | integration | Source: B

## Run Estimates

**Complexity:** medium
**Duration:** ~38–74 min  (no retries: ~38 min)
**Cost:** ~$0.22–$0.42  (cap: $5.00)
**Tokens:** ~30K–75K

**Retry budgets:**
- TDD + quality gate: 3 rounds
- Spec revision: 2 rounds
- Design revision: n/a (Designer not activated)
- Code review: 2 rounds
