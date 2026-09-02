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
export function resolveSelector(el) {
    // P1: data-testid
    const testId = el.getAttribute('data-testid');
    if (testId)
        return { testId };
    // P2: visible text ≤ 60 chars, skip whitespace-only
    const text = el.textContent?.trim() ?? '';
    if (text.length > 0)
        return { text: text.slice(0, 60) };
    // P3: explicit role + accessible name
    const role = el.getAttribute('role');
    if (role) {
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel)
            return { role, name: ariaLabel };
        const labelledBy = el.getAttribute('aria-labelledby');
        if (labelledBy) {
            const labelEl = el.ownerDocument?.getElementById(labelledBy);
            if (labelEl?.textContent?.trim())
                return { role, name: labelEl.textContent.trim() };
        }
    }
    // P4: associated <label> via for/id or wrapping ancestor
    const id = el.getAttribute('id');
    if (id) {
        const labelEl = el.ownerDocument?.querySelector(`label[for="${id}"]`);
        if (labelEl?.textContent?.trim())
            return { label: labelEl.textContent.trim() };
    }
    let ancestor = el.parentElement;
    while (ancestor) {
        if (ancestor.tagName.toLowerCase() === 'label' && ancestor.textContent?.trim()) {
            return { label: ancestor.textContent.trim() };
        }
        ancestor = ancestor.parentElement;
    }
    // P5: placeholder
    const placeholder = el.getAttribute('placeholder');
    if (placeholder)
        return { placeholder };
    // P6: CSS fallback
    let css = el.tagName.toLowerCase();
    const elId = el.getAttribute('id');
    if (elId)
        css += `#${elId}`;
    el.classList.forEach(c => { css += `.${c}`; });
    return { css };
}
//# sourceMappingURL=selectorHeuristics.js.map