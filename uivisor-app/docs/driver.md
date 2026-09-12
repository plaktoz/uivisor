# driver/

Thin Playwright wrappers. Two files: `browser.ts` manages browser/page lifecycle; `commands.ts` maps every YAML command to the corresponding Playwright call.

---

## browser.ts

### `launchBrowser(options: RunOptions): Promise<{ browser: Browser; page: Page }>`

Launches Chromium via `chromium.launch()` with `headless: !options.headed` and `slowMo: options.slowMo`. Opens one initial page (caller is responsible for closing it).

### `closeBrowser(browser: Browser): Promise<void>`

Calls `browser.close()`.

### `createSessionPages(browser: Browser, sessionIds: string[]): Promise<Map<string, Page>>`

Opens one `browser.newPage()` per session ID, returns a `Map<string, Page>`. Used by `cli/runner.ts` to provision multi-session flows before calling `runFlow`.

No internal imports.

---

## commands.ts

One exported `execute*` function per YAML command type. All functions are `async` and called by `engine/dispatcher.ts`.

### Interaction commands

| Function | Signature | Behaviour |
|---|---|---|
| `executeGoto` | `(page, url)` | `page.goto(url)` |
| `executeTapOn` | `(page, selector, ctx)` | Resolves selector, clicks it, stores the locator on `ctx.lastTappedLocator` for subsequent bare `inputText` |
| `executeInputText` | `(ctx, text)` | Fills `ctx.lastTappedLocator` (shorthand form — no explicit element needed) |
| `executeInputTextTargeted` | `(page, element, text)` | Resolves selector, fills the locator |
| `executePressKey` | `(page, key)` | `page.keyboard.press(key)` |
| `executeSelectOption` | `(page, selector, value)` | Resolves selector, calls `selectOption` |
| `executeCheck` | `(page, selector)` | Resolves, calls `check()` |
| `executeUncheck` | `(page, selector)` | Resolves, calls `uncheck()` |
| `executeHover` | `(page, selector)` | Resolves, calls `hover()` |
| `executeDoubleClick` | `(page, selector)` | Resolves, calls `dblclick()` |
| `executeClearText` | `(page, selector)` | Resolves, calls `fill('')` |
| `executeScroll` | `(page, direction)` | Scrolls by 300px in the given direction via `page.mouse.wheel` |
| `executeReload` | `(page)` | `page.reload()` |
| `executeGoBack` | `(page)` | `page.goBack()` — throws if URL did not change or landed on `about:` |
| `executeGoForward` | `(page)` | `page.goForward()` — same guard as `goBack` |
| `executeSetViewport` | `(page, width, height)` | `page.setViewportSize` — accepts named presets (`mobile` 390×844, `tablet` 768×1024, `desktop` 1280×800) |

### Timing commands

| Function | Signature | Behaviour |
|---|---|---|
| `executeWait` | `(ms)` | `setTimeout` — hard pause |
| `executeWaitFor` | `(ms)` | Alias of `executeWait` |

### Screenshot command

### `executeScreenshot(page, screenshotPath, runDir): Promise<string>`

Creates `<runDir>/screenshots/` if it does not exist, writes the PNG to the resolved path, returns the absolute path.

### Assertion commands (all use 5000 ms timeout)

| Function | What it asserts | Throws with |
|---|---|---|
| `executeAssertVisible` | Element is visible | `Expected:\nGot:` formatted message |
| `executeAssertNotVisible` | Element is not visible | same |
| `executeAssertUrl` | Current URL matches pattern (wildcard `*` supported via `matchesPattern`) | same |
| `executeAssertText` | Element's `innerText` matches expected | same |
| `executeAssertValue` | Element's `inputValue` matches expected | same |
| `executeAssertCount` | CSS selector matches exactly N elements | same |
| `executeAssertEnabled` | Element is enabled | same |
| `executeAssertDisabled` | Element is disabled | same |
| `executeAssertChecked` | Checkbox/radio is checked | same |
| `executeAssertUnchecked` | Checkbox/radio is unchecked | same |

### Scoping

#### `executeWithin(page, cmd, ctx, dispatch): Promise<CommandResult[]>`

Scopes a block of nested commands to a container element.

1. Resolves the container locator via `resolveContainerLocator`.
2. Validates count and `nth` (allows `nth: 0`).
3. Builds a **scoped page proxy** via the module-private `createScopedPage` — a `Proxy` over `Page` that routes all locator-query methods through the container `Locator`, so nested commands resolve selectors relative to the container without any change to `resolveSelector`'s signature.
4. Drives each `do` command through the injected `dispatch` callback.

**Internal imports:** `matcher/index` (`resolveSelector`, `resolveContainerLocator`), `utils/patterns` (`matchesPattern`)
