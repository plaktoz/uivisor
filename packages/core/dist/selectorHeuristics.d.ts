import type { Selector } from './types.js';
/**
 * Resolves the highest-priority Selector for a given DOM Element.
 * This is a pure browser-DOM function — it has no Node.js or Playwright imports.
 *
 * Priority chain (highest → lowest):
 *   1. data-testid attribute (non-empty)
 *   2. trimmed textContent (non-empty, ≤ 60 chars)
 *   3. explicit role + accessible name (aria-label or aria-labelledby)
 *   4. associated <label> text (for/id linkage or wrapping ancestor)
 *   5. placeholder attribute (non-empty)
 *   6. CSS fallback: tag#id.class1.class2
 */
export declare function resolveSelector(el: Element): Selector;
//# sourceMappingURL=selectorHeuristics.d.ts.map