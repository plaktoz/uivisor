import * as fs from 'fs';
import * as path from 'path';
import type { Page, Locator } from 'playwright';
import type { Selector, Command, CommandResult, RunContext, SessionedCommand } from '@uivisor/core';
import { resolveSelector, resolveContainerLocator } from '../matcher/index.js';
import { matchesPattern } from '../utils/patterns.js';

// ─── Scoped page factory ──────────────────────────────────────────────────────

/**
 * Create a Proxy around `realPage` that routes locator-query methods through
 * the given `scope` Locator. Non-locator Page methods (goto, keyboard, etc.)
 * are delegated to the real page unchanged.
 *
 * This lets `resolveSelector(scopedPage, selector)` automatically resolve
 * within `scope`'s subtree without modifying `resolveSelector`'s signature.
 */
function createScopedPage(realPage: Page, scope: Locator): Page {
  const overrides: Record<string, unknown> = {
    locator: (css: string, opts?: unknown) => scope.locator(css, opts as never),
    getByText: (text: string | RegExp, opts?: unknown) =>
      (scope as unknown as Page).getByText(text as string, opts as never),
    getByLabel: (text: string, opts?: unknown) =>
      (scope as unknown as Page).getByLabel(text, opts as never),
    getByRole: (role: string, opts?: unknown) =>
      (scope as unknown as Page).getByRole(role as Parameters<Page['getByRole']>[0], opts as never),
    getByPlaceholder: (text: string, opts?: unknown) =>
      (scope as unknown as Page).getByPlaceholder(text, opts as never),
    getByTestId: (id: string) => scope.getByTestId(id),
  };

  return new Proxy(realPage, {
    get(target, prop: string) {
      if (prop in overrides) {
        return overrides[prop];
      }
      const val = (target as unknown as Record<string, unknown>)[prop];
      return typeof val === 'function' ? (val as Function).bind(target) : val;
    },
  });
}

// ─── Navigation commands ──────────────────────────────────────────────────────

export async function executeGoto(page: Page, url: string): Promise<void> {
  try {
    await page.goto(url, { waitUntil: 'load' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Navigation failed: ${url} — ${msg}`);
  }
}

// ─── Tap / interaction commands ───────────────────────────────────────────────

export async function executeTapOn(page: Page, selector: Selector, ctx: RunContext): Promise<void> {
  const locator = await resolveSelector(page, selector);
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
  const locator = await resolveSelector(page, element);
  try {
    await locator.fill(text, { timeout: 5000 });
  } catch {
    throw new Error('Element not found for inputText targeted.');
  }
}

// ─── Assert commands ──────────────────────────────────────────────────────────

export async function executeAssertVisible(page: Page, selector: Selector): Promise<void> {
  const locator = await resolveSelector(page, selector);
  try {
    await locator.waitFor({ state: 'visible', timeout: 5000 });
  } catch {
    throw new Error('Expected: visible\nGot: element not found');
  }
}

export async function executeAssertNotVisible(page: Page, selector: Selector): Promise<void> {
  const locator = await resolveSelector(page, selector);
  try {
    await locator.waitFor({ state: 'hidden', timeout: 5000 });
  } catch {
    throw new Error('Expected: not visible\nGot: visible');
  }
}

export async function executeWait(ms: number): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, ms));
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
    locator = await resolveSelector(page, selector);
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
    locator = await resolveSelector(page, selector);
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
    locator = await resolveSelector(page, selector);
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
    locator = await resolveSelector(page, selector);
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
    locator = await resolveSelector(page, selector);
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
    locator = await resolveSelector(page, selector);
    await locator.waitFor({ state: 'attached', timeout: 5000 });
  } catch {
    throw new Error(`Expected: unchecked\nGot: element not found`);
  }
  const checked = await locator.isChecked();
  if (checked) {
    throw new Error(`Expected: unchecked\nGot: checked`);
  }
}

export async function executePressKey(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
}

export async function executeSelectOption(page: Page, selector: Selector, value: string): Promise<void> {
  let locator: Locator;
  try {
    locator = await resolveSelector(page, selector);
    await locator.waitFor({ state: 'attached', timeout: 5000 });
  } catch {
    throw new Error('Element not found.');
  }
  try {
    await locator.selectOption(value, { timeout: 5000 });
  } catch {
    throw new Error('Option not found.');
  }
}

export async function executeCheck(page: Page, selector: Selector): Promise<void> {
  const locator = await resolveSelector(page, selector);
  try {
    await locator.check({ timeout: 5000 });
  } catch {
    throw new Error('Element not found.');
  }
}

export async function executeUncheck(page: Page, selector: Selector): Promise<void> {
  const locator = await resolveSelector(page, selector);
  try {
    await locator.uncheck({ timeout: 5000 });
  } catch {
    throw new Error('Element not found.');
  }
}

export async function executeHover(page: Page, selector: Selector): Promise<void> {
  const locator = await resolveSelector(page, selector);
  try {
    await locator.hover({ timeout: 5000 });
  } catch {
    throw new Error('Element not found.');
  }
}

export async function executeDoubleClick(page: Page, selector: Selector): Promise<void> {
  const locator = await resolveSelector(page, selector);
  try {
    await locator.dblclick({ timeout: 5000 });
  } catch {
    throw new Error('Element not found.');
  }
}

export async function executeClearText(page: Page, selector: Selector): Promise<void> {
  const locator = await resolveSelector(page, selector);
  try {
    await locator.clear({ timeout: 5000 });
  } catch {
    throw new Error('Element not found.');
  }
}

export async function executeReload(page: Page): Promise<void> {
  await page.reload({ waitUntil: 'load' });
}

export async function executeGoBack(page: Page): Promise<void> {
  const urlBefore = page.url();
  await page.goBack({ waitUntil: 'commit' });
  const urlAfter = page.url();
  if (urlAfter === urlBefore || urlAfter.startsWith('about:')) {
    throw new Error('No previous page in history.');
  }
}

export async function executeGoForward(page: Page): Promise<void> {
  const urlBefore = page.url();
  await page.goForward({ waitUntil: 'commit' });
  const urlAfter = page.url();
  if (urlAfter === urlBefore || urlAfter.startsWith('about:')) {
    throw new Error('No next page in history.');
  }
}

export async function executeSetViewport(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
}

export async function executeScreenshot(page: Page, screenshotPath: string, runDir: string): Promise<string> {
  const resolvedPath = path.resolve(runDir, screenshotPath);
  const dir = path.dirname(resolvedPath);
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: resolvedPath });
  return resolvedPath;
}

export async function executeWaitFor(ms: number): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, ms));
}

// ─── Within scoping command ───────────────────────────────────────────────────

/**
 * Callback type for dispatching a single Command inside `executeWithin`.
 * The caller (dispatcher) provides this to avoid a circular import.
 */
export type WithinDispatch = (
  page: Page,
  cmd: Command,
  ctx: RunContext,
) => Promise<CommandResult>;

/**
 * Execute a `within` scoping block:
 *
 * 1. Resolve the container selector from the page root.
 * 2. Validate cardinality — throw if 0 containers found, or if `nth` is out of range.
 * 3. Build a scoped page whose locator methods are rooted at the selected container.
 * 4. Dispatch each command in `do` using `dispatch(scopedPage, cmd, ctx)`.
 * 5. Return the collected `CommandResult[]`.
 */
export async function executeWithin(
  page: Page,
  cmd: { type: 'within'; selector: string; nth?: number; do: SessionedCommand[] },
  ctx: RunContext,
  dispatch: WithinDispatch,
): Promise<CommandResult[]> {
  // 1. Resolve container (lenient: accepts ≥1 match for nth support)
  const containerLoc = await resolveContainerLocator(page, cmd.selector);
  const count = await containerLoc.count();

  // 2. Validate
  if (count === 0) {
    throw new Error(`within: No container found for selector '${cmd.selector}'`);
  }
  if (cmd.nth !== undefined && cmd.nth >= count) {
    throw new Error(
      `within: nth=${cmd.nth} requested but only ${count} containers matched selector '${cmd.selector}'`,
    );
  }

  // 3. Select target container
  const target = cmd.nth !== undefined ? containerLoc.nth(cmd.nth) : containerLoc;

  // 4. Create a scoped page (all locator queries scoped to target)
  const scopedPage = createScopedPage(page, target);

  // 5. Dispatch each do-command with the scoped page
  const results: CommandResult[] = [];
  for (const sc of cmd.do) {
    const r = await dispatch(scopedPage, sc.command, ctx);
    results.push(r);
    if (!r.passed) break; // stop on first failure (same semantics as top-level flow)
  }

  return results;
}
