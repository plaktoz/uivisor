# overlay.ts

Exports a single string constant — a self-contained browser IIFE injected via `page.addInitScript()`.

---

## `OVERLAY_SCRIPT: string`

A pure browser JavaScript string with no `import` statements and no Node.js built-ins. Designed to be safely injected into any page by Playwright.

### What the injected script does

#### HUD

Creates a `<div id="uivisor-hud">` pinned to the bottom-right corner of the viewport showing the three shortcut labels. The HUD is idempotent — re-injection does not duplicate it.

#### Keyboard shortcuts

Listens for `keydown` events on `document`:

| Shortcut | Action |
|---|---|
| `Shift+A` | Opens the assertion picker modal |
| `Shift+W` | Prompts for milliseconds, emits `{ wait: N }` |
| `Shift+S` or `PrintScreen` | Increments a counter, emits `{ screenshot: 'screenshots/step-N.png' }` |
| `Escape` | Closes and removes the picker from the DOM |

#### Assertion picker (`data-testid="uivisor-picker"`)

A modal with 8 assertion buttons:

| Button | Emitted command | Input source |
|---|---|---|
| `assertVisible` | `{ assertVisible: selector }` | Focused element's `data-testid` |
| `assertNotVisible` | `{ assertNotVisible: selector }` | Focused element's `data-testid` |
| `assertEnabled` | `{ assertEnabled: selector }` | Focused element's `data-testid` |
| `assertDisabled` | `{ assertDisabled: selector }` | Focused element's `data-testid` |
| `assertChecked` | `{ assertChecked: selector }` | Focused element's `data-testid` |
| `assertUnchecked` | `{ assertUnchecked: selector }` | Focused element's `data-testid` |
| `assertText` | `{ assertText: { selector, expected } }` | `window.prompt` for expected text |
| `assertValue` | `{ assertValue: { selector, expected } }` | `window.prompt` for expected value |
| `assertUrl` | `{ assertUrl: window.location.href }` | Current URL |

Picker stays open if a `window.prompt` is cancelled. All buttons close the picker after emitting (except on prompt cancel).

#### Emit guard

Every `emit()` call checks `typeof window.__uivisorOverlay === 'function'` before invoking. Safe if the function is not yet bound or is later overwritten.

---

## Design note

`OVERLAY_SCRIPT` contains no `import` or `require()` — verified by `overlay.test.ts` via static analysis. This ensures it can be embedded as a raw string and injected into any browser context without bundler involvement.
