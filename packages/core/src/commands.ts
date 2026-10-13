import * as fs from 'fs';
import * as path from 'path';
import type { Page, Locator } from 'playwright';
import type { Selector, CommandResult, RunContext, SessionedCommand, PlaywrightContext } from './types.js';
import { resolveLocator, resolveContainerLocator, resolveNotVisible, selectorLabel } from './playwrightLocator.js';
import { createDeadline, retryUntil, DEFAULT_TIMEOUTS, type Deadline } from './deadline.js';

function elementDeadline(deadline?: Deadline): Deadline {
  return deadline ?? createDeadline(DEFAULT_TIMEOUTS.defaultTimeout);
}

function navigationDeadline(deadline?: Deadline): Deadline {
  return deadline ?? createDeadline(DEFAULT_TIMEOUTS.navigationTimeout);
}

/** `true` when `err` is a Playwright-shaped TimeoutError (checked by `.name`, not `instanceof`). */
function isTimeoutError(err: unknown): boolean {
  return (err as { name?: string } | null | undefined)?.name === 'TimeoutError';
}

// ─── Wildcard pattern matcher ─────────────────────────────────────────────────

/**
 * Wildcard pattern matcher utility.
 *
 * `*` is the sole glob wildcard — matches zero or more characters at any position.
 * When the pattern contains no `*`, comparison is exact (case-sensitive).
 */
export function matchesPattern(pattern: string, actual: string): boolean {
  if (!pattern.includes('*')) return pattern === actual;
  // Convert glob pattern to anchored regex:
  // escape all regex special chars except *, then replace * with .*
  const regexStr = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(actual);
}

// ─── Scoped page factory ──────────────────────────────────────────────────────

/**
 * Create a Proxy around `realPage` that routes locator-query methods through
 * the given `scope` Locator. Non-locator Page methods (goto, keyboard, etc.)
 * are delegated to the real page unchanged.
 *
 * This lets `resolveLocator(scopedPage, selector)` automatically resolve
 * within `scope`'s subtree without modifying `resolveLocator`'s signature.
 */
export function createScopedPage(realPage: Page, scope: Locator): Page {
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

export async function executeGoto(page: Page, url: string, deadline?: Deadline): Promise<void> {
  const d = navigationDeadline(deadline);
  try {
    await page.goto(url, { waitUntil: 'load', timeout: d.pwTimeout() });
  } catch (err: unknown) {
    if (isTimeoutError(err)) {
      throw new Error(`Navigation failed: ${url} — timed out after ${d.timeoutMs}ms`);
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Navigation failed: ${url} — ${msg}`);
  }
}

// ─── Tap / interaction commands ───────────────────────────────────────────────

export async function executeTapOn(
  page: Page,
  selector: Selector,
  ctx: PlaywrightContext,
  deadline?: Deadline,
): Promise<void> {
  const d = elementDeadline(deadline);
  const locator = await resolveLocator(page, selector, undefined, d);
  try {
    await locator.click({ timeout: d.pwTimeout() });
  } catch {
    throw new Error(`Element not actionable after ${d.timeoutMs}ms: ${selectorLabel(selector)}`);
  }
  ctx.lastTappedLocator = locator;
  ctx.lastTappedLabel = selectorLabel(selector);
}

export async function executeInputText(ctx: PlaywrightContext, text: string, deadline?: Deadline): Promise<void> {
  if (ctx.lastTappedLocator === null) {
    throw new Error('inputText shorthand used before any tapOn');
  }
  const d = elementDeadline(deadline);
  try {
    await ctx.lastTappedLocator.fill(text, { timeout: d.pwTimeout() });
  } catch {
    throw new Error(`Element not actionable after ${d.timeoutMs}ms: ${ctx.lastTappedLabel}`);
  }
}

export async function executeInputTextTargeted(
  page: Page,
  element: Selector,
  text: string,
  deadline?: Deadline,
): Promise<void> {
  const d = elementDeadline(deadline);
  const locator = await resolveLocator(page, element, undefined, d);
  try {
    await locator.fill(text, { timeout: d.pwTimeout() });
  } catch {
    throw new Error(`Element not actionable after ${d.timeoutMs}ms: ${selectorLabel(element)}`);
  }
}

// ─── Assert commands ──────────────────────────────────────────────────────────

export async function executeAssertVisible(page: Page, selector: Selector, deadline?: Deadline): Promise<void> {
  const d = elementDeadline(deadline);
  const locator = await resolveLocator(page, selector, undefined, d);
  try {
    await locator.waitFor({ state: 'visible', timeout: d.pwTimeout() });
  } catch {
    throw new Error('Expected: visible\nGot: element not found');
  }
}

export async function executeAssertNotVisible(page: Page, selector: Selector, deadline?: Deadline): Promise<void> {
  const d = elementDeadline(deadline);
  if (!(await resolveNotVisible(page, selector, d))) {
    throw new Error('Expected: not visible\nGot: visible');
  }
}

export async function executeWait(ms: number): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, ms));
}

export async function executeAssertUrl(page: Page, expectedPath: string, deadline?: Deadline): Promise<void> {
  const d = elementDeadline(deadline);
  const result = await retryUntil<true, string>(d, async () => {
    const url = new URL(page.url());
    const actual = url.pathname + url.search + url.hash;
    if (matchesPattern(expectedPath, actual)) return { done: true, value: true };
    return { done: false, last: actual };
  });
  if (!result.done) {
    throw new Error(`Expected: ${expectedPath}\nGot: ${result.last}`);
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

export async function executeAssertText(
  page: Page,
  selector: Selector,
  expected: string,
  deadline?: Deadline,
): Promise<void> {
  const d = elementDeadline(deadline);
  const locator = await resolveLocator(page, selector, undefined, d);
  try {
    await locator.waitFor({ state: 'visible', timeout: d.pwTimeout() });
  } catch {
    throw new Error(`Expected: ${expected}\nGot: element not found`);
  }
  const actual = (await locator.innerText()).trim();
  if (actual !== expected) {
    throw new Error(`Expected: ${expected}\nGot: ${actual}`);
  }
}

export async function executeAssertValue(
  page: Page,
  selector: Selector,
  expected: string,
  deadline?: Deadline,
): Promise<void> {
  const d = elementDeadline(deadline);
  const locator = await resolveLocator(page, selector, undefined, d);
  try {
    await locator.waitFor({ state: 'attached', timeout: d.pwTimeout() });
  } catch {
    throw new Error(`Expected: ${expected}\nGot: element not found`);
  }
  const actual = await locator.inputValue();
  if (actual !== expected) {
    throw new Error(`Expected: ${expected}\nGot: ${actual}`);
  }
}

export async function executeAssertCount(page: Page, css: string, expected: number, deadline?: Deadline): Promise<void> {
  const d = elementDeadline(deadline);
  const result = await retryUntil<true, number>(d, async () => {
    const actual = await page.locator(css).count();
    if (actual === expected) return { done: true, value: true };
    return { done: false, last: actual };
  });
  if (!result.done) {
    throw new Error(`Expected: ${expected}\nGot: ${result.last}`);
  }
}

export async function executeAssertEnabled(page: Page, selector: Selector, deadline?: Deadline): Promise<void> {
  const d = elementDeadline(deadline);
  const locator = await resolveLocator(page, selector, undefined, d);
  try {
    await locator.waitFor({ state: 'attached', timeout: d.pwTimeout() });
  } catch {
    throw new Error(`Expected: enabled\nGot: element not found`);
  }
  const enabled = await locator.isEnabled();
  if (!enabled) {
    throw new Error(`Expected: enabled\nGot: disabled`);
  }
}

export async function executeAssertDisabled(page: Page, selector: Selector, deadline?: Deadline): Promise<void> {
  const d = elementDeadline(deadline);
  const locator = await resolveLocator(page, selector, undefined, d);
  try {
    await locator.waitFor({ state: 'attached', timeout: d.pwTimeout() });
  } catch {
    throw new Error(`Expected: disabled\nGot: element not found`);
  }
  const disabled = await locator.isDisabled();
  if (!disabled) {
    throw new Error(`Expected: disabled\nGot: enabled`);
  }
}

export async function executeAssertChecked(page: Page, selector: Selector, deadline?: Deadline): Promise<void> {
  const d = elementDeadline(deadline);
  const locator = await resolveLocator(page, selector, undefined, d);
  try {
    await locator.waitFor({ state: 'attached', timeout: d.pwTimeout() });
  } catch {
    throw new Error(`Expected: checked\nGot: element not found`);
  }
  const checked = await locator.isChecked();
  if (!checked) {
    throw new Error(`Expected: checked\nGot: unchecked`);
  }
}

export async function executeAssertUnchecked(page: Page, selector: Selector, deadline?: Deadline): Promise<void> {
  const d = elementDeadline(deadline);
  const locator = await resolveLocator(page, selector, undefined, d);
  try {
    await locator.waitFor({ state: 'attached', timeout: d.pwTimeout() });
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

export async function executeSelectOption(
  page: Page,
  selector: Selector,
  value: string,
  deadline?: Deadline,
): Promise<void> {
  const d = elementDeadline(deadline);
  const locator = await resolveLocator(page, selector, undefined, d);
  try {
    await locator.waitFor({ state: 'attached', timeout: d.pwTimeout() });
    await locator.selectOption(value, { timeout: d.pwTimeout() });
  } catch {
    throw new Error('Option not found.');
  }
}

export async function executeCheck(page: Page, selector: Selector, deadline?: Deadline): Promise<void> {
  const d = elementDeadline(deadline);
  const locator = await resolveLocator(page, selector, undefined, d);
  try {
    await locator.check({ timeout: d.pwTimeout() });
  } catch {
    throw new Error(`Element not actionable after ${d.timeoutMs}ms: ${selectorLabel(selector)}`);
  }
}

export async function executeUncheck(page: Page, selector: Selector, deadline?: Deadline): Promise<void> {
  const d = elementDeadline(deadline);
  const locator = await resolveLocator(page, selector, undefined, d);
  try {
    await locator.uncheck({ timeout: d.pwTimeout() });
  } catch {
    throw new Error(`Element not actionable after ${d.timeoutMs}ms: ${selectorLabel(selector)}`);
  }
}

export async function executeHover(page: Page, selector: Selector, deadline?: Deadline): Promise<void> {
  const d = elementDeadline(deadline);
  const locator = await resolveLocator(page, selector, undefined, d);
  try {
    await locator.hover({ timeout: d.pwTimeout() });
  } catch {
    throw new Error(`Element not actionable after ${d.timeoutMs}ms: ${selectorLabel(selector)}`);
  }
}

export async function executeDoubleClick(page: Page, selector: Selector, deadline?: Deadline): Promise<void> {
  const d = elementDeadline(deadline);
  const locator = await resolveLocator(page, selector, undefined, d);
  try {
    await locator.dblclick({ timeout: d.pwTimeout() });
  } catch {
    throw new Error(`Element not actionable after ${d.timeoutMs}ms: ${selectorLabel(selector)}`);
  }
}

export async function executeClearText(page: Page, selector: Selector, deadline?: Deadline): Promise<void> {
  const d = elementDeadline(deadline);
  const locator = await resolveLocator(page, selector, undefined, d);
  try {
    await locator.clear({ timeout: d.pwTimeout() });
  } catch {
    throw new Error(`Element not actionable after ${d.timeoutMs}ms: ${selectorLabel(selector)}`);
  }
}

export async function executeReload(page: Page, deadline?: Deadline): Promise<void> {
  const d = navigationDeadline(deadline);
  try {
    await page.reload({ waitUntil: 'load', timeout: d.pwTimeout() });
  } catch (err: unknown) {
    if (isTimeoutError(err)) {
      throw new Error(`reload timed out after ${d.timeoutMs}ms`);
    }
    throw err;
  }
}

export async function executeGoBack(page: Page, deadline?: Deadline): Promise<void> {
  const d = navigationDeadline(deadline);
  const urlBefore = page.url();
  try {
    await page.goBack({ waitUntil: 'commit', timeout: d.pwTimeout() });
  } catch (err: unknown) {
    if (isTimeoutError(err)) {
      throw new Error(`goBack timed out after ${d.timeoutMs}ms`);
    }
    throw err;
  }
  const urlAfter = page.url();
  if (urlAfter === urlBefore || urlAfter.startsWith('about:')) {
    throw new Error('No previous page in history.');
  }
}

export async function executeGoForward(page: Page, deadline?: Deadline): Promise<void> {
  const d = navigationDeadline(deadline);
  const urlBefore = page.url();
  try {
    await page.goForward({ waitUntil: 'commit', timeout: d.pwTimeout() });
  } catch (err: unknown) {
    if (isTimeoutError(err)) {
      throw new Error(`goForward timed out after ${d.timeoutMs}ms`);
    }
    throw err;
  }
  const urlAfter = page.url();
  if (urlAfter === urlBefore || urlAfter.startsWith('about:')) {
    throw new Error('No next page in history.');
  }
}

export async function executeSetViewport(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
}

export async function executeScreenshot(page: Page, screenshotPath: string, basePath: string): Promise<string> {
  const resolvedPath = path.resolve(basePath, screenshotPath);
  const dir = path.dirname(resolvedPath);
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: resolvedPath });
  return resolvedPath;
}

export async function executeWaitFor(ms: number): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, ms));
}

export async function executeWaitForPageLoad(
  page: Page,
  path?: string,
  timeout?: number,
  deadline?: Deadline,
): Promise<void> {
  const d = deadline ?? createDeadline(timeout ?? 30000);
  const glob = path ? '**/' + path.replace(/^\//, '') : undefined;
  try {
    if (glob) {
      await page.waitForURL(glob, { timeout: d.pwTimeout() });
    }
    await page.waitForLoadState('networkidle', { timeout: d.pwTimeout() });
  } catch (err: unknown) {
    if (isTimeoutError(err)) {
      throw new Error(`waitForPageLoad timed out after ${d.timeoutMs}ms`);
    }
    throw err;
  }
}

// ─── Within scoping command ───────────────────────────────────────────────────

/**
 * Callback type for dispatching a single step inside `executeWithin`.
 * The caller (dispatcher) provides this to avoid a circular import.
 */
export type WithinDispatch = (
  page: Page,
  step: SessionedCommand,
  ctx: RunContext,
) => Promise<CommandResult>;

/**
 * Execute a `within` scoping block:
 *
 * 1. Validate `nth` up front (no resolution attempt for a malformed `nth`).
 * 2. Resolve the container selector from the page root, waiting up to `deadline`
 *    (default: the built-in element budget). The deadline bounds ONLY this lookup —
 *    it is never forwarded to the `do:` steps (Q18).
 * 3. Build a scoped page whose locator methods are rooted at the selected container.
 * 4. Dispatch each step in `do` using `dispatch(scopedPage, step, ctx)`.
 * 5. Return the collected `CommandResult[]`.
 */
export async function executeWithin(
  page: Page,
  cmd: { type: 'within'; selector: string; nth?: number; do: SessionedCommand[] },
  ctx: RunContext,
  dispatch: WithinDispatch,
  deadline?: Deadline,
): Promise<CommandResult[]> {
  // 1. Validate nth before any resolution attempt
  if (cmd.nth !== undefined && cmd.nth < 0) {
    throw new Error(`within: nth must be a non-negative integer, got ${cmd.nth}`);
  }

  // 2. Resolve container (lenient: accepts ≥1 match for nth support); throws its own
  //    "No container found" / "nth=… requested but only …" errors at the deadline.
  const containerLoc = await resolveContainerLocator(page, cmd.selector, { nth: cmd.nth, deadline });

  // 3. Select target container
  const target = cmd.nth !== undefined ? containerLoc.nth(cmd.nth) : containerLoc;

  // 4. Create a scoped page (all locator queries scoped to target)
  const scopedPage = createScopedPage(page, target);

  // 5. Dispatch each do-step with the scoped page (whole step, no `within` deadline)
  const results: CommandResult[] = [];
  for (const sc of cmd.do) {
    const r = await dispatch(scopedPage, sc, ctx);
    results.push(r);
    if (!r.passed) break; // stop on first failure (same semantics as top-level flow)
  }

  return results;
}
