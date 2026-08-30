# Epic Signoff: add more ui test capability

**Epic:** epic-add-more-ui-test-capability
**Completed:** 2026-08-30
**Status:** complete

---

## Overview

Expanded the uivisor YAML DSL from 9 commands to 30 commands across three sequential feature runs. All new commands follow the existing key/value pattern, accept the full `Selector` union where applicable, and are covered by unit parser tests and integration tests against a live Playwright browser.

---

## Features Delivered

| # | Feature | PR | Commands Added |
|---|---|---|---|
| 1 | Assertion Commands | [#8](https://github.com/plaktoz/uivisor/pull/8) | `assertText`, `assertValue`, `assertCount`, `assertEnabled`, `assertDisabled`, `assertChecked`, `assertUnchecked` |
| 2 | Interaction Commands | [#9](https://github.com/plaktoz/uivisor/pull/9) | `pressKey`, `selectOption`, `check`, `uncheck`, `hover`, `doubleClick`, `clearText` |
| 3 | Page Control & Utilities | [#10](https://github.com/plaktoz/uivisor/pull/10) | `reload`, `goBack`, `goForward`, `setViewport`, `screenshot`, `waitFor` |

---

## Command Reference (new commands only)

### Assertions (Feature 1)

| Command | YAML example | What it checks |
|---|---|---|
| `assertText` | `assertText: { label: Name, expected: Alice }` | Element visible text = expected (exact, trimmed) |
| `assertValue` | `assertValue: { placeholder: Email, expected: alice@example.com }` | Form field value = expected |
| `assertCount` | `assertCount: { css: .item, expected: 3 }` | CSS selector match count = expected |
| `assertEnabled` | `assertEnabled: { role: button, name: Submit }` | Element is not disabled |
| `assertDisabled` | `assertDisabled: { testId: save-btn }` | Element has `disabled` attribute |
| `assertChecked` | `assertChecked: { label: Accept terms }` | Checkbox/radio is checked |
| `assertUnchecked` | `assertUnchecked: { label: Newsletter }` | Checkbox/radio is unchecked |

### Interactions (Feature 2)

| Command | YAML example | What it does |
|---|---|---|
| `pressKey` | `pressKey: Enter` | Fires keyboard key globally |
| `selectOption` | `selectOption: { label: Country, value: US }` | Selects `<select>` option by value |
| `check` | `check: { label: I agree }` | Checks a checkbox |
| `uncheck` | `uncheck: { label: I agree }` | Unchecks a checkbox |
| `hover` | `hover: { text: More options }` | Moves pointer over element |
| `doubleClick` | `doubleClick: { testId: editable-cell }` | Double-clicks element |
| `clearText` | `clearText: { placeholder: Search }` | Clears text from input |

### Page Control & Utilities (Feature 3)

| Command | YAML example | What it does |
|---|---|---|
| `reload` | `reload: ~` | Reloads the page |
| `goBack` | `goBack: ~` | Navigates back in history |
| `goForward` | `goForward: ~` | Navigates forward in history |
| `setViewport` | `setViewport: mobile` | Sets viewport (preset or `{ width, height }`) |
| `screenshot` | `screenshot: screenshots/step1.png` | Saves PNG, path in `screenshotPath` |
| `waitFor` | `waitFor: 1500` | Waits N milliseconds |

Viewport presets: `mobile` → 390×844, `tablet` → 768×1024, `desktop` → 1280×800.

---

## Test Results (final state)

| Suite | Tests | Result |
|---|---|---|
| unit/parser | 77 | all pass |
| unit/matcher | 13 | all pass |
| unit/reporter | 30 | all pass |
| unit/args | 27 | all pass |
| unit/flow-filter | 12 | all pass |
| integration/commands | 66 | all pass |
| integration/cli | 22 | 6 pre-existing failures (reporter file path bug, unrelated to this epic) |
| **Total** | **247** | **241 pass** |

No regressions introduced across any of the 3 features.

---

## Signoff Packages

- [feat-assertion-commands/signoff_package.md](../feat-assertion-commands/signoff_package.md)
- [feat-interaction-commands/signoff_package.md](../feat-interaction-commands/signoff_package.md)
- [feat-page-control-and-utilities/signoff_package.md](../feat-page-control-and-utilities/signoff_package.md)
