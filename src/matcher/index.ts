import type { Page, Locator } from 'playwright';
import type { Selector } from '../types.js';

export function resolveSelector(page: Page, selector: Selector): Locator {
  if (typeof selector === 'string') {
    return page.getByText(selector);
  }
  if ('text' in selector) return page.getByText((selector as { text: string }).text);
  if ('role' in selector) {
    const s = selector as { role: string; name: string };
    return page.getByRole(s.role as Parameters<Page['getByRole']>[0], { name: s.name });
  }
  if ('label' in selector) return page.getByLabel((selector as { label: string }).label);
  if ('placeholder' in selector) return page.getByPlaceholder((selector as { placeholder: string }).placeholder);
  if ('testId' in selector) return page.getByTestId((selector as { testId: string }).testId);

  const key = Object.keys(selector as object)[0] ?? 'unknown';
  throw new Error(`Unrecognized selector type: ${key}`);
}
