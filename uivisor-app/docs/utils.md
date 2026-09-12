# utils/

Shared utility functions. Currently one file.

---

## patterns.ts

### `matchesPattern(pattern: string, actual: string): boolean`

Wildcard string matcher where `*` matches zero or more characters at any position.

- **No `*` in pattern** — falls back to exact string comparison (`pattern === actual`).
- **`*` present** — converts the pattern to an anchored regex: escapes all regex metacharacters, then replaces `*` with `.*`. Tests the result.

**Examples:**

| Pattern | Actual | Result |
|---|---|---|
| `/dashboard` | `/dashboard` | `true` |
| `/dashboard` | `/dashboardX` | `false` |
| `/user/*/settings` | `/user/42/settings` | `true` |
| `*error*` | `Something went error here` | `true` |

**Used by:**
- `driver/commands.ts` — `executeAssertUrl` for URL path wildcard matching.
- `matcher/index.ts` — `buildTextLocator` for wildcard text matching in selectors.

No internal imports.
