# reporter/

Four files produce different forms of test output: live console feedback, HTML report, Markdown report, and automatic failure screenshots.

---

## console.ts

### `class ConsoleReporter`

Writes live test output to `process.stdout` as flows execute.

| Method | Output |
|---|---|
| `startFlow(filePath, _indentLevel)` | `▶ Running: filename` |
| `reportCommand(result, indentLevel)` | `✓` or `✗` with indentation; on failure also prints Expected/Got values, screenshot path, and recursively calls `_printNested` for any nested flow result; on passing `runFlow` also calls `_printNested` to show nested commands |
| `endFlow(result)` | `PASSED` / `FAILED` with command counts |
| `runEnd(result)` | Multi-flow summary line (shown only when more than one flow ran) |

**Private helpers:**

- `_printNested(nestedResult, indentLevel)` — recursively prints nested flow results with increased indentation.
- `_cmdSummary(cmd)` — returns a human-readable one-line label for any `Command` type (e.g. `tapOn [testId="submit-btn"]`, `assertText "Welcome"`).

No internal imports.

---

## html.ts

### `generateHtmlReport(result: RunResult): string`

Builds a self-contained HTML report string (no external CSS or JS dependencies).

**Structure:**
- Summary table: total flows, passed flows, failed flows, total duration.
- One `<section>` per flow with a command-level `<table>`.
- Failure rows include Expected/Got values.
- Screenshot rows embed the PNG as a base64 `<img>` tag (read from disk at report time); falls back to a hyperlink if the file cannot be read.
- Nested flow results are rendered recursively with `padding-left` indentation.

All user-originating strings pass through `escapeHtml` to prevent XSS in the report output.

**Private helpers:** `escapeHtml`, `cmdLabel`, `renderCommandRows`, `renderFlow`. No internal imports.

---

## markdown.ts

### `generateMarkdownReport(result: RunResult): string`

Builds a Markdown report string.

**Structure:**
```
# UIVisor Test Report
## Summary
| Flows | Passed | Failed | Duration |
...
## <flow filename>
| Status | Command | Duration |
...
```

- Failure rows include Expected/Got inline.
- Screenshot rows reference the PNG basename as `![image](basename.png)` for portability.
- Nested flows are separated with a `**Nested flow:**` header.

**Private helpers:** `cmdLabel`, `renderCommandTable`, `renderFlow`. No internal imports.

---

## screenshot.ts

### `captureScreenshot(page, flowStem, counter, runDir): Promise<string>`

Captures an automatic failure screenshot.

- Creates `<runDir>/screenshots/` if it does not exist.
- Writes `<flowStem>-fail-<NNN>.png` (counter zero-padded to 3 digits).
- Returns the absolute path.

Called by `engine/dispatcher.ts` on any command failure. The counter is module-level and reset by `dispatcher.resetScreenshotCounter()` between flows. No internal imports.
