# parser/

YAML-to-`FlowFile` pipeline. Five files handle reading, validation, variable interpolation, command parsing, and the top-level orchestration.

---

## reader.ts

### `readYamlFile(filePath: string): unknown`

Reads a file with `fs.readFileSync` and parses it with `js-yaml.load()`. On `YAMLException`, re-throws with a human-friendly `filename:line: message` error. Returns the parsed value as `unknown`. No internal imports.

---

## validator.ts

Three validation functions called by `parser/index.ts` after reading raw YAML.

### `validateHeader(raw, filePath?): string`

- Asserts all top-level keys are in the allowed set: `appId`, `url`, `commands`, `tags`, `shared`, `sessions`, `vars`, `config`.
- Validates `tags` is an array of non-empty strings.
- Validates `shared` is a boolean if present.
- Returns the base URL string from `appId` or `url`. Throws if neither is present.

### `validateCommandList(rawCommands): void`

Asserts `rawCommands` is a non-empty array.

### `validateSessions(raw, filePath?): SessionDef[]`

Returns `[]` when `raw` is null/undefined. Otherwise validates the sessions array:
- Each item must be an object with a non-empty `id` string matching `/^[a-zA-Z0-9_-]+$/`, max 64 chars.
- `id` must not be `__default__`.
- No duplicate `id` values.
- Copies optional `label` string.

No internal imports.

---

## interpolate.ts

Config loading. The `${...}` interpolation functions, `validateVars`, `flattenVars`, and `parseRunFlow` live in `@uivisor/core` (`packages/core/src/interpolate.ts`), which recorder-app also uses. They are described under [Interpolation](#interpolation-uivisorcore).

### `loadConfigFile(configPath, flowFilePath): Record<string, string>`

Resolves the config path relative to the flow file's directory, reads and parses it as YAML, flattens it, then resolves `${env.*}` expressions in all values (using empty vars — only env vars are available at config load time).

**Internal imports:** `parser/reader` (`readYamlFile`). `flattenVars` and `interpolateValue` come from `@uivisor/core`.

### Interpolation (`@uivisor/core`)

#### `resolveRef(inner, vars, strict = false): string`

Resolves a single interpolation expression of the form `name:default`. Reads from `process.env` for `env.*` names; otherwise from the vars map. Returns the default if the resolved value is undefined or empty string. With `strict`, an absent variable with no default throws `UnresolvedVariableError` (`Variable "name" is not defined`); otherwise it resolves to `''`.

#### `interpolateValue(value, vars, strict = false): string`

Forward-scan over a string, replacing all `${...}` expressions via `resolveRef`. Throws on unclosed `${`.

#### `interpolateObject(obj, vars, strict = false): unknown`

Deep-walks any value (string, array, object, primitive) and calls `interpolateValue` on string leaves. Never mutates input.

#### `validateVars(raw, filePath?): void`

Asserts `vars` is a plain object (not null, not array).

#### `flattenVars(raw, filePath?): Record<string, string>`

Recursively walks a nested YAML object, joining keys with `.` to form dotted paths (e.g. `db.host`). Rules:
- Names must match `/^[a-zA-Z_][a-zA-Z0-9_.]*$/`.
- `env` and `env.*` are reserved — throws if used.
- Array values are rejected.
- Empty or invalid names throw.
- Duplicate keys throw.
- Number/boolean/null leaves are coerced to strings.

#### `parseRunFlow(value): RunFlowCommand`

Parses the value of a `runFlow:` command, either a path string or `{ file, vars }`. `file` must be a non-empty string, any other key throws, and `vars` must be a map that is run through `flattenVars`. Every error starts with `Invalid runFlow:`.

---

## commandParser.ts

### `parseCommand(raw: unknown): Command`

Takes a raw YAML object (one top-level key = command name) and returns a typed `Command` union member. Handles all 30+ command types. Notable validations:
- `wait` requires an integer.
- `waitFor` requires a positive integer.
- `scroll` direction must be in `{up, down, left, right}`.
- `setViewport` resolves named presets (`mobile` 390×844, `tablet` 768×1024, `desktop` 1280×800) or validates explicit positive integer dimensions.
- `within` recursively parses the `do` array via `parseSessionedCommand`.
- `runFlow` delegates to `parseRunFlow` from `@uivisor/core`.

### `parseSessionedCommand(raw: unknown): SessionedCommand`

Strips the optional `session` string field before delegating to `parseCommand`, then re-attaches it. This is the function called by `parser/index.ts` for each command in the YAML `commands` list.

**External imports only:** `@uivisor/core` (`parseSelector`, `parseRunFlow`)

---

## index.ts

### `loadAndParse(filePath: string): FlowFile`

Full YAML-to-`FlowFile` pipeline in three passes.

**Pass 1 — Load and config resolution:**
1. `readYamlFile` — read raw YAML.
2. If `config:` is present, interpolate `${env.*}` only and call `loadConfigFile` to load external vars.

**Pass 2 — Variable merging:**
1. `validateVars` then `flattenVars` on inline `vars:` block.
2. Merge with config vars (config wins on conflicts).

**Pass 3 — Interpolation and parsing:**
1. `interpolateObject` on the entire document using the merged vars.
2. `validateHeader` — validate keys, get `baseUrl`.
3. `validateCommandList`, `validateSessions`.
4. `parseSessionedCommand` for each command.
5. Validate that any `session:` field references a declared session ID.

**Returns `FlowFile`:**

```ts
{
  baseUrl: string;
  filePath: string;
  commands: SessionedCommand[];
  sessions: SessionDef[];
  tags: string[];
  shared: boolean;
  vars: Record<string, string>;
}
```

**Internal imports:** `parser/reader`, `parser/validator`, `parser/commandParser`, `parser/interpolate`. `validateVars`, `flattenVars`, `interpolateValue`, and `interpolateObject` come from `@uivisor/core`.
