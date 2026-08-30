# Signoff Package: feat-interaction-commands

**Run:** feat-interaction-commands
**Epic:** epic-add-more-ui-test-capability
**Date:** 2026-08-30
**Status:** complete

---

## Feature Summary

Added 7 new YAML interaction commands to the uivisor DSL:

| Command | What it does |
|---|---|
| `pressKey` | Fires a keyboard key press globally (`page.keyboard.press`) |
| `selectOption` | Selects an option in a `<select>` by value |
| `check` | Checks a checkbox or radio button |
| `uncheck` | Unchecks a checkbox or radio button |
| `hover` | Moves the pointer over an element |
| `doubleClick` | Double-clicks an element |
| `clearText` | Clears all text from an input field |

All selector-based commands accept the full existing `Selector` union. `pressKey` takes a plain string key name. `selectOption` takes a selector plus `value`.

## Files Changed

- `src/types.ts` — 7 new `Command` union members
- `src/parser/commandParser.ts` — 7 new parser cases
- `src/driver/commands.ts` — 7 new executor functions
- `src/engine/dispatcher.ts` — 7 new dispatch cases + imports
- `src/reporter/console.ts`, `html.ts`, `markdown.ts` — exhaustiveness fixes
- `tests/fixtures/test-page.html` — 4 new fixture elements
- `tests/unit/parser.test.ts` — 10 new unit tests
- `tests/integration/commands.test.ts` — 17 new integration tests + freshCtx fix

## Test Results

- Unit tests: 63/63 passing
- Integration tests: 54/54 passing
- No regressions (pre-existing 6 reporter failures unchanged)

## Commit

`edb37a2` — feat-interaction-commands: add pressKey, selectOption, check, uncheck, hover, doubleClick, clearText

## PR

https://github.com/plaktoz/uivisor/pull/9
