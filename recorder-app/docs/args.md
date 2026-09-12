# args.ts

CLI argument parser for the `uivisor-record` binary.

---

## `parseArgs(argv: string[]): RecordArgs`

Parses `process.argv` into a `RecordArgs` object.

```ts
interface RecordArgs {
  url: string;        // default: "http://localhost:5173"
  outputPath: string; // default: "recorded.yaml"
}
```

**Supported flags:**

| Flag | Alias | Description |
|---|---|---|
| positional | — | Target URL (first non-flag argument) |
| `--output <path>` | `-o` | Output YAML file path |
| `--base-url <url>` | — | Base URL — takes precedence over positional URL |
| `--help` | `-h` | Print usage and exit 0 |

**Error behaviour:**
- Throws on unknown flags.
- Throws if a flag that expects a value is missing its argument.

No internal imports.
