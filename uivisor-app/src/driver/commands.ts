import type { Page, Locator } from 'playwright';
import type { Selector, RunContext } from '../types.js';
import { resolveSelector } from '../matcher/index.js';

export async function executeGoto(page: Page, url: string): Promise<void> {
  try {
    await page.goto(url, { waitUntil: 'load' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Navigation failed: ${url} — ${msg}`);
  }
}

export async function executeTapOn(page: Page, selector: Selector, ctx: RunContext): Promise<void> {
  const locator = resolveSelector(page, selector);
  try {
    await locator.click({ timeout: 5000 });
  } catch {
    throw new Error('Element not found.');
  }
  ctx.lastTappedLocator = locator;
}

export async function executeInputText(ctx: RunContext, text: string): Promise<void> {
  if (ctx.lastTappedLocator === null) {
    throw new Error('inputText shorthand used before any tapOn');
  }
  await ctx.lastTappedLocator.fill(text);
}

export async function executeInputTextTargeted(page: Page, element: Selector, text: string): Promise<void> {
  const locator = resolveSelector(page, element);
  try {
    await locator.fill(text, { timeout: 5000 });
  } catch {
    throw new Error('Element not found for inputText targeted.');
  }
}

export async function executeAssertVisible(page: Page, selector: Selector): Promise<void> {
  const locator = resolveSelector(page, selector);
  try {
    await locator.waitFor({ state: 'visible', timeout: 5000 });
  } catch {
    throw new Error('Expected: visible\nGot: element not found');
  }
}

export async function executeAssertNotVisible(page: Page, selector: Selector): Promise<void> {
  const locator = resolveSelector(page, selector);
  try {
    await locator.waitFor({ state: 'hidden', timeout: 5000 });
  } catch {
    throw new Error('Expected: not visible\nGot: visible');
  }
}

export async function executeWait(ms: number): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, ms));
}

function matchesPattern(pattern: string, actual: string): boolean {
  if (!pattern.includes('*')) return pattern === actual;
  const regex = new RegExp(
    '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'
  );
  return regex.test(actual);
}

export async function executeAssertUrl(page: Page, expectedPath: string): Promise<void> {
  const url = new URL(page.url());
  const actual = url.pathname + url.search + url.hash;
  if (!matchesPattern(expectedPath, actual)) {
    throw new Error(`Expected: ${expectedPath}\nGot: ${actual}`);
  }
}

export async function executeScroll(page: Page, direction: 'up' | 'down' | 'left' | 'right'): Promise<void> {
  await page.evaluate((dir) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (dir === 'down') window.scrollBy(0, h);
    else if (dir === 'up') window.scrollBy(0, -h);
    else if (dir === 'right') window.scrollBy(w, 0);
    else if (dir === 'left') window.scrollBy(-w, 0);
  }, direction);
}

export async function executeAssertText(page: Page, selector: Selector, expected: string): Promise<void> {
  let locator: Locator;
  try {
    locator = resolveSelector(page, selector);
    await locator.waitFor({ state: 'visible', timeout: 5000 });
  } catch {
    throw new Error(`Expected: ${expected}\nGot: element not found`);
  }
  const actual = (await locator.innerText()).trim();
  if (actual !== expected) {
    throw new Error(`Expected: ${expected}\nGot: ${actual}`);
  }
}

export async function executeAssertValue(page: Page, selector: Selector, expected: string): Promise<void> {
  let locator: Locator;
  try {
    locator = resolveSelector(page, selector);
    await locator.waitFor({ state: 'attached', timeout: 5000 });
  } catch {
    throw new Error(`Expected: ${expected}\nGot: element not found`);
  }
  const actual = await locator.inputValue();
  if (actual !== expected) {
    throw new Error(`Expected: ${expected}\nGot: ${actual}`);
  }
}

export async function executeAssertCount(page: Page, css: string, expected: number): Promise<void> {
  const actual = await page.locator(css).count();
  if (actual !== expected) {
    throw new Error(`Expected: ${expected}\nGot: ${actual}`);
  }
}

export async function executeAssertEnabled(page: Page, selector: Selector): Promise<void> {
  let locator: Locator;
  try {
    locator = resolveSelector(page, selector);
    await locator.waitFor({ state: 'attached', timeout: 5000 });
  } catch {
    throw new Error(`Expected: enabled\nGot: element not found`);
  }
  const enabled = await locator.isEnabled();
  if (!enabled) {
    throw new Error(`Expected: enabled\nGot: disabled`);
  }
}

export async function executeAssertDisabled(page: Page, selector: Selector): Promise<void> {
  let locator: Locator;
  try {
    locator = resolveSelector(page, selector);
    await locator.waitFor({ state: 'attached', timeout: 5000 });
  } catch {
    throw new Error(`Expected: disabled\nGot: element not found`);
  }
  const disabled = await locator.isDisabled();
  if (!disabled) {
    throw new Error(`Expected: disabled\nGot: enabled`);
  }
}

export async function executeAssertChecked(page: Page, selector: Selector): Promise<void> {
  let locator: Locator;
  try {
    locator = resolveSelector(page, selector);
    await locator.waitFor({ state: 'attached', timeout: 5000 });
  } catch {
    throw new Error(`Expected: checked\nGot: element not found`);
  }
  const checked = await locator.isChecked();
  if (!checked) {
    throw new Error(`Expected: checked\nGot: unchecked`);
  }
}

export async function executeAssertUnchecked(page: Page, selector: Selector): Promise<void> {
  let locator: Locator;
  try {
    locator = resolveSelector(page, selector);
    await locator.waitFor({ state: 'attached', timeout: 5000 });
  } catch {
    throw new Error(`Expected: unchecked\nGot: element not found`);
  }
  const checked = await locator.isChecked();
  if (checked) {
    throw new Error(`Expected: unchecked\nGot: checked`);
  }
}
