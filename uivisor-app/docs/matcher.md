# matcher/

Selector resolution layer. Translates YAML `Selector` values (objects, pipe strings, or bare strings) into Playwright `Locator` instances.

---

## index.ts

### `resolveSelector(page, selector, scope?): Promise<Locator>`

Resolves a YAML selector to a Playwright `Locator` that matches exactly one element.

**Three resolution strategies, tried in order:**

#### 1. Object selector

When `selector` is an object, dispatches directly to the matching Playwright API:

| Key | Playwright call |
|---|---|
| `{ css }` | `page.locator(css)` |
| `{ testId }` | `page.getByTestId(testId)` |
| `{ text }` | `page.getByText(text)` |
| `{ role, name }` | `page.getByRole(role, { name })` |
| `{ label }` | `page.getByLabel(label)` |
| `{ placeholder }` | `page.getByPlaceholder(placeholder)` |

When `scope` is provided, all queries are rooted in that `Locator` instead of `page`.

#### 2. Pipe-syntax string (`attr=value|attr=value|...`)

When the string contains `=`:
- Splits on `|`, parses each `attr=value` segment.
- Tries segments left-to-right; returns the first locator with exactly 1 match.
- Throws a diagnostic listing all tried segments if none match.

**Supported `attr` values in pipe syntax:**

| Attr | Resolution |
|---|---|
| `testId` | `getByTestId` |
| `text` | `getByText` (exact or wildcard `*`) |
| `label` | `getByLabel` |
| `role` | `getByRole` |
| `placeholder` | `getByPlaceholder` |
| any other | CSS `[attr="value"]` with wildcard position support (`*` at start/end/both/middle → `$=`, `^=`, `*=`) |

#### 3. Bare string (no `=`)

Cascades through attributes in order: `data-testid → text → name → id → placeholder`. Returns the first with exactly 1 match. Throws with a suggestion to use pipe syntax if none match.

---

### `resolveContainerLocator(page, selector): Promise<Locator>`

Same parsing logic as `resolveSelector`, but accepts `count >= 1` instead of exactly 1. Used by `executeWithin` to select among multiple matching containers before applying `nth`.

---

### Private helpers

| Helper | Purpose |
|---|---|
| `buildAttrCss(attr, value)` | Builds CSS `[attr="v"]` / `^=` / `$=` / `*=` based on `*` position in `value` |
| `buildTextLocator(root, value)` | Exact `getByText` or regex-based wildcard when `value` contains `*` |
| `buildLocatorForAttr(root, attr, value)` | Dispatches to `getByLabel`, `getByRole`, or `buildAttrCss`/`buildTextLocator` |
| `parsePipeString(raw)` | Splits and validates each `attr=value` pipe segment |

**Internal imports:** `utils/patterns` (`matchesPattern`)
