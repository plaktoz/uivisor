# Signoff Package: feat-page-control-and-utilities

**Run:** feat-page-control-and-utilities
**Epic:** epic-add-more-ui-test-capability
**Date:** 2026-08-30
**Status:** complete

---

## Feature Summary

Added 6 new YAML page-control and utility commands to the uivisor DSL:

| Command | What it does |
|---|---|
| `reload` | Reloads the current page (`waitUntil: 'load'`) |
| `goBack` | Navigates back in browser history; fails if no real prior page |
| `goForward` | Navigates forward in browser history; fails if no forward page |
| `setViewport` | Resizes the viewport — accepts named presets (`mobile`/`tablet`/`desktop`) or explicit `{ width, height }` |
| `screenshot` | Captures a PNG to a path relative to `runDir`; surfaces resolved path via `screenshotPath` on success |
| `waitFor` | Waits N milliseconds (positive integer); explicit-named alias for `wait` |

### Notable implementation details

- `goBack`/`goForward` use `waitUntil: 'commit'` with a URL-before/after check to correctly handle same-document (hash fragment) navigations while still rejecting `about:blank` back-navigations as "no history".
- `screenshot` is the only command where `CommandResult.screenshotPath` is set on _success_ (not failure). The dispatcher introduces a `capturedScreenshotPath` local before the `try` block.
- `setViewport` presets resolve to pixels at parse time: `mobile` → 390×844, `tablet` → 768×1024, `desktop` → 1280×800.

## Files Changed

- `src/types.ts` — 6 new `Command` union members
- `src/parser/commandParser.ts` — 6 new parser cases with preset table and validation
- `src/driver/commands.ts` — 6 new executor functions + `fs`/`path` imports
- `src/engine/dispatcher.ts` — 6 new dispatch cases + `capturedScreenshotPath` + updated success return
- `src/reporter/console.ts`, `html.ts`, `markdown.ts` — exhaustiveness fixes (6 new cases each)
- `tests/unit/parser.test.ts` — 14 new unit tests (ACs 13–25)
- `tests/integration/commands.test.ts` — 12 new integration tests (ACs 1–12)

## Test Results

- Unit tests: 77/77 passing
- Integration tests: 66/66 passing
- No regressions (pre-existing 6 reporter failures unchanged)
- Total suite: 241/247 passing

## PR

https://github.com/plaktoz/uivisor/pull/10
