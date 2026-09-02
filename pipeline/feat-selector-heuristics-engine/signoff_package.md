# Signoff Package: feat-selector-heuristics-engine

## Feature Summary

Adds `resolveSelector(el: Element): Selector` to `@uivisor/core` — a pure, synchronous browser-DOM function that inspects any `Element` and returns the highest-priority stable selector for it. The function walks a six-level priority chain: `data-testid` attribute → trimmed visible text (≤ 60 chars) → explicit ARIA role + accessible name → associated `<label>` text → `placeholder` attribute → CSS tag/id/class fallback. The CSS fallback required adding a new `{ css: string }` variant to the existing `Selector` union type. The module has no Node.js or Playwright imports and is safe to inject into a browser content script.

## Files Delivered

| File | Change |
|---|---|
| `packages/core/src/types.ts` | Added `\| { css: string }` variant to `Selector` union |
| `packages/core/src/selectorParser.ts` | Added `css` case before the throw |
| `packages/core/src/selectorHeuristics.ts` | NEW — `resolveSelector(el: Element): Selector` |
| `packages/core/src/index.ts` | Re-exports `resolveSelector` |
| `packages/core/package.json` | Added vitest / jsdom devDeps and `test` script |
| `packages/core/vitest.config.ts` | NEW — jsdom environment for Vitest |
| `packages/core/src/selectorHeuristics.test.ts` | NEW — 21-test suite covering all ACs |

## Test Results

```
 RUN  v3.2.7

 ✓ src/selectorHeuristics.test.ts (21 tests) 17ms

 Test Files  1 passed (1)
      Tests  21 passed (21)
   Duration  655ms
```

`tsc --noEmit` exits 0. All 13 acceptance criteria satisfied.

## Usage

```typescript
import { resolveSelector } from '@uivisor/core';

// In a browser content script or Playwright addInitScript context:
document.addEventListener('click', (event) => {
  const el = event.target as Element;
  const selector = resolveSelector(el);
  // e.g. { testId: 'submit-btn' }  or  { text: 'Sign in' }  or  { css: 'button.primary' }
  console.log(selector);
});
```

Priority chain (highest → lowest):
1. `{ testId: value }` — when `data-testid` is present and non-empty
2. `{ text: value }` — trimmed `textContent` ≤ 60 chars, non-empty
3. `{ role: value, name: accessibleName }` — explicit ARIA `role` + `aria-label`/`aria-labelledby`
4. `{ label: labelText }` — linked `<label>` (by `for`/`id` or wrapping ancestor)
5. `{ placeholder: value }` — non-empty `placeholder` attribute
6. `{ css: cssSelector }` — `tag#id.class1.class2` fallback
