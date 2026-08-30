# Signoff Package: feat-assertion-commands

**Run:** feat-assertion-commands
**Epic:** epic-add-more-ui-test-capability
**Date:** 2026-08-30
**Status:** ready to merge

---

## Feature Summary

Added 7 new YAML assertion commands to the uivisor DSL:

| Command | What it checks |
|---|---|
| `assertText` | Element's visible text equals expected string (exact, trimmed) |
| `assertValue` | Form field's current value equals expected string |
| `assertCount` | Number of elements matching a CSS selector equals expected integer |
| `assertEnabled` | Element is not disabled |
| `assertDisabled` | Element has `disabled` attribute |
| `assertChecked` | Checkbox/radio is checked |
| `assertUnchecked` | Checkbox/radio is unchecked |

All commands follow the existing `assertVisible` error pattern (`Expected: …\nGot: …`) and accept the full `Selector` union except `assertCount` which uses a raw CSS string.

## Files Changed

- `src/types.ts` — 7 new `Command` union members
- `src/engine/commandParser.ts` — 7 new parser cases
- `src/driver/commands.ts` — 7 new executor functions
- `src/engine/dispatcher.ts` — 7 new dispatch cases
- `src/reporter/console.ts`, `html.ts`, `markdown.ts` — exhaustiveness fixes
- `tests/fixtures/test-page.html` — 8 new fixture elements
- `tests/unit/parser.test.ts` — 9 new unit tests
- `tests/integration/commands.test.ts` — 21 new integration tests + freshCtx fix

## Test Results

- Unit tests: 62/62 passing
- Integration tests: 59/59 passing
- No regressions (pre-existing 6 reporter failures unchanged)

## Commit

`0fa0abb` — feat-assertion-commands: add assertText, assertValue, assertCount, assertEnabled, assertDisabled, assertChecked, assertUnchecked
