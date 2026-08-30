# screenshot command sets screenshotPath on success, not failure

**Role:** Coder / Architect
**Epic:** epic-add-more-ui-test-capability
**Feature:** feat-page-control-and-utilities

## Lesson

Every other command sets `CommandResult.screenshotPath` only on **failure** (auto-captured error screenshot). The `screenshot` command is the one exception — it sets `screenshotPath` on **success**, containing the resolved path to the user's intentional capture.

This requires a local variable outside the `try` block in the dispatcher so the success return path can include it:

```typescript
// Before the try block:
let capturedScreenshotPath: string | undefined;

// Inside switch:
case 'screenshot':
  capturedScreenshotPath = await executeScreenshot(page, cmd.path, ctx.runDir);
  break;

// Success return (note: includes screenshotPath for ALL commands now):
return { command: cmd, passed: true, screenshotPath: capturedScreenshotPath, durationMs: Date.now() - start };
```

For all other commands, `capturedScreenshotPath` remains `undefined`, so `screenshotPath` is absent on their success results — no change in existing behaviour.

## Why it matters

The AC for `screenshot` (AC9) specifically asserts `result.screenshotPath` is defined and points to the PNG. If the executor return value is not captured and threaded through the success path, the test fails even though the file was written to disk.
