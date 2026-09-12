# yamlWriter.ts

Writes and appends to the output YAML flow file. Two public functions and two private helpers.

---

## `startSession(outputPath: string, appId: string): void`

Creates the output file (and any missing parent directories) with an initial YAML header. Truncates any previous content at the same path.

**Written header:**
```yaml
appId: <appId>
commands:
```

Uses `mkdirSync({ recursive: true })` for directory creation and `writeFileSync` for the truncating write.

---

## `appendCommand(outputPath: string, cmd: Command): void`

Converts a `Command` to its YAML representation and appends it to the file as a list item.

**Process:**
1. `commandToRecord(cmd)` — converts the `Command` to a plain `Record<string, unknown>`.
2. `js-yaml.dump(record, { indent: 2 })` — serialises to YAML string.
3. Formats as a YAML list item (`- key: value\n  ...`).
4. `appendFileSync(outputPath, formatted)` — appends to disk.

---

## Private helpers

### `commandToRecord(cmd: Command): Record<string, unknown>`

Exhaustive switch over every `Command` type from `@uivisor/core`. Converts each to a plain object for `js-yaml` serialisation.

Notable cases:
- **`within`** — recursive: maps each sub-command via `commandToRecord`, splits the `selector` string on `=` to produce the container attribute key/value pair for the YAML output.
- **`tapOn`, `assertVisible`, etc.** — selectors that are strings are passed through; object selectors are kept as-is.

### `selectorToObject(selector: string): { text: string }`

Coerces a bare string selector to `{ text: selector }` so it round-trips as a YAML mapping rather than a scalar. Only called for command types where a string selector needs to be written as a mapping.

---

## External imports

- `node:fs` — `mkdirSync`, `writeFileSync`, `appendFileSync`
- `node:path` — `dirname`
- `js-yaml` — `dump`
- `@uivisor/core` — `Command` type
