// TODO(arch): migrate shared dispatch to @uivisor/core

import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';
import type { Page, Locator } from 'playwright';
import type { Command, Selector, SessionedCommand } from '@uivisor/core';
import { parseSelector } from '@uivisor/core';

// ─── Replay context ───────────────────────────────────────────────────────────

interface ReplayContext {
  lastTappedLocator: Locator | null;
}

// ─── Inline wildcard pattern matcher (mirrors uivisor-app/src/utils/patterns) ─

function matchesPattern(pattern: string, actual: string): boolean {
  if (!pattern.includes('*')) return pattern === actual;
  const regexStr = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${regexStr}$`).test(actual);
}

// ─── Inline Playwright selector resolution ────────────────────────────────────

type PageRoot = Page | Locator;

function resolveAttrLocator(root: PageRoot, attr: string, value: string): Locator {
  switch (attr) {
    case 'text':
      return (root as Page).getByText(value, { exact: true });
    case 'label':
      return (root as Page).getByLabel(value);
    case 'role':
      return (root as Page).getByRole(value as Parameters<Page['getByRole']>[0]);
    default:
      // data-*, id, name, placeholder, and other plain attributes
      return (root as Page).locator(`[${attr}="${value}"]`);
  }
}

async function resolveLocator(page: Page, selector: Selector): Promise<Locator> {
  // Object selector forms — direct Playwright dispatch
  if (typeof selector !== 'string') {
    if ('css' in selector) return page.locator(selector.css);
    if ('testId' in selector) return page.getByTestId(selector.testId);
    if ('text' in selector) return page.getByText(selector.text);
    if ('role' in selector)
      return page.getByRole(selector.role as Parameters<Page['getByRole']>[0], {
        name: selector.name,
      });
    if ('label' in selector) return page.getByLabel(selector.label);
    if ('placeholder' in selector) return page.getByPlaceholder(selector.placeholder);
    const key = Object.keys(selector as object)[0] ?? 'unknown';
    throw new Error(`Unrecognized selector type: ${key}`);
  }

  // Pipe mode: attr=value|attr=value — try each segment left-to-right
  if (selector.includes('=')) {
    const segments = selector.split('|');
    for (const seg of segments) {
      const eqIdx = seg.indexOf('=');
      if (eqIdx === -1) continue;
      const attr = seg.slice(0, eqIdx);
      const value = seg.slice(eqIdx + 1);
      const loc = resolveAttrLocator(page, attr, value);
      if ((await loc.count()) === 1) return loc;
    }
    throw new Error(`No unique element found for selector '${selector}'`);
  }

  // Cascade mode: bare string — data-testid → text → name → id → placeholder
  for (const attr of ['data-testid', 'text', 'name', 'id', 'placeholder'] as const) {
    const loc =
      attr === 'text'
        ? page.getByText(selector, { exact: true })
        : page.locator(`[${attr}="${selector}"]`);
    if ((await loc.count()) === 1) return loc;
  }
  throw new Error(`No unique element found for bare selector '${selector}'`);
}

/**
 * Like resolveLocator but accepts count >= 1 (for within container resolution).
 */
async function resolveContainerLocator(page: Page, selector: string): Promise<Locator> {
  if (selector.includes('=')) {
    const segments = selector.split('|');
    for (const seg of segments) {
      const eqIdx = seg.indexOf('=');
      if (eqIdx === -1) continue;
      const attr = seg.slice(0, eqIdx);
      const value = seg.slice(eqIdx + 1);
      const loc = resolveAttrLocator(page, attr, value);
      if ((await loc.count()) >= 1) return loc;
    }
  } else {
    for (const attr of ['data-testid', 'text', 'name', 'id', 'placeholder'] as const) {
      const loc =
        attr === 'text'
          ? page.getByText(selector, { exact: true })
          : page.locator(`[${attr}="${selector}"]`);
      if ((await loc.count()) >= 1) return loc;
    }
  }
  throw new Error(`within: No container found for selector '${selector}'`);
}

/**
 * Create a Proxy around realPage that routes locator-query methods through
 * the given scope Locator. Non-locator Page methods are delegated unchanged.
 */
function createScopedPage(realPage: Page, scope: Locator): Page {
  const overrides: Record<string, unknown> = {
    locator: (css: string, opts?: unknown) => scope.locator(css, opts as never),
    getByText: (text: string | RegExp, opts?: unknown) =>
      (scope as unknown as Page).getByText(text as string, opts as never),
    getByLabel: (text: string, opts?: unknown) =>
      (scope as unknown as Page).getByLabel(text, opts as never),
    getByRole: (role: string, opts?: unknown) =>
      (scope as unknown as Page).getByRole(
        role as Parameters<Page['getByRole']>[0],
        opts as never,
      ),
    getByPlaceholder: (text: string, opts?: unknown) =>
      (scope as unknown as Page).getByPlaceholder(text, opts as never),
    getByTestId: (id: string) => scope.getByTestId(id),
  };
  return new Proxy(realPage, {
    get(target, prop: string) {
      if (prop in overrides) return overrides[prop];
      const val = (target as unknown as Record<string, unknown>)[prop];
      return typeof val === 'function'
        ? (val as (...args: unknown[]) => unknown).bind(target)
        : val;
    },
  });
}

// ─── YAML command parser ──────────────────────────────────────────────────────

function parseCommand(record: Record<string, unknown>): Command {
  const key = Object.keys(record)[0];
  if (!key) throw new Error('Empty command record');
  const val = record[key];

  switch (key) {
    case 'goto':
      return { type: 'goto', url: String(val) };

    case 'tapOn':
      return { type: 'tapOn', selector: parseSelector(val) };

    case 'inputText': {
      if (typeof val === 'string' || typeof val === 'number') {
        return { type: 'inputText', text: String(val) };
      }
      // Targeted form: { element: Selector, text: string }
      const obj = val as Record<string, unknown>;
      if ('element' in obj) {
        return {
          type: 'inputTextTargeted',
          element: parseSelector(obj.element),
          text: String(obj.text),
        };
      }
      return { type: 'inputText', text: String(obj.text ?? '') };
    }

    case 'assertVisible':
      return { type: 'assertVisible', selector: parseSelector(val) };

    case 'assertNotVisible':
      return { type: 'assertNotVisible', selector: parseSelector(val) };

    case 'wait':
      return { type: 'wait', ms: Number(val) };

    case 'assertUrl':
      return { type: 'assertUrl', path: String(val) };

    case 'runFlow':
      return { type: 'runFlow', path: String(val) };

    case 'scroll':
      return { type: 'scroll', direction: String(val) as 'up' | 'down' | 'left' | 'right' };

    case 'assertText': {
      const { expected, ...selectorPart } = val as Record<string, unknown>;
      return {
        type: 'assertText',
        selector: parseSelector(selectorPart),
        expected: String(expected),
      };
    }

    case 'assertValue': {
      const { expected, ...selectorPart } = val as Record<string, unknown>;
      return {
        type: 'assertValue',
        selector: parseSelector(selectorPart),
        expected: String(expected),
      };
    }

    case 'assertCount': {
      const obj = val as Record<string, unknown>;
      return { type: 'assertCount', css: String(obj.css), expected: Number(obj.expected) };
    }

    case 'assertEnabled':
      return { type: 'assertEnabled', selector: parseSelector(val) };

    case 'assertDisabled':
      return { type: 'assertDisabled', selector: parseSelector(val) };

    case 'assertChecked':
      return { type: 'assertChecked', selector: parseSelector(val) };

    case 'assertUnchecked':
      return { type: 'assertUnchecked', selector: parseSelector(val) };

    case 'pressKey':
      return { type: 'pressKey', key: String(val) };

    case 'selectOption': {
      const { value, ...selectorPart } = val as Record<string, unknown>;
      return {
        type: 'selectOption',
        selector: parseSelector(selectorPart),
        value: String(value),
      };
    }

    case 'check':
      return { type: 'check', selector: parseSelector(val) };

    case 'uncheck':
      return { type: 'uncheck', selector: parseSelector(val) };

    case 'hover':
      return { type: 'hover', selector: parseSelector(val) };

    case 'doubleClick':
      return { type: 'doubleClick', selector: parseSelector(val) };

    case 'clearText':
      return { type: 'clearText', selector: parseSelector(val) };

    case 'reload':
      return { type: 'reload' };

    case 'goBack':
      return { type: 'goBack' };

    case 'goForward':
      return { type: 'goForward' };

    case 'setViewport': {
      const obj = val as Record<string, unknown>;
      return { type: 'setViewport', width: Number(obj.width), height: Number(obj.height) };
    }

    case 'screenshot':
      return { type: 'screenshot', path: String(val) };

    case 'waitFor':
      return { type: 'waitFor', ms: Number(val) };

    case 'within': {
      const obj = val as Record<string, unknown>;
      const { do: doArr, nth, ...rest } = obj;
      // The single remaining key is the attribute; its value is the selector value.
      const attrEntries = Object.entries(rest);
      if (attrEntries.length !== 1) {
        throw new Error(
          `within: expected exactly one selector key, got: ${Object.keys(rest).join(', ') || '(none)'}`,
        );
      }
      const [attr, attrVal] = attrEntries[0];
      const selector = `${attr}=${String(attrVal)}`;
      const doCommands: SessionedCommand[] = (doArr as Record<string, unknown>[]).map((r) => ({
        command: parseCommand(r),
      }));
      return {
        type: 'within',
        selector,
        nth: nth !== undefined ? Number(nth) : undefined,
        do: doCommands,
      };
    }

    default:
      throw new Error(`Unknown command key: '${key}'`);
  }
}

// ─── YAML file loader ─────────────────────────────────────────────────────────

interface RawFlowFile {
  appId: string;
  commands: Record<string, unknown>[];
}

function loadFlowYaml(absPath: string): { appId: string; commands: Command[] } {
  const content = fs.readFileSync(absPath, 'utf8');
  const raw = yaml.load(content) as RawFlowFile;

  if (!raw || typeof raw !== 'object') {
    throw new Error(`Invalid flow file (not a YAML object): ${absPath}`);
  }

  const appId = String(raw.appId ?? '');
  const rawCommands = Array.isArray(raw.commands) ? raw.commands : [];
  const commands = rawCommands.map((r) => parseCommand(r));

  return { appId, commands };
}

// ─── Playwright command dispatcher ───────────────────────────────────────────

async function dispatchCommand(
  page: Page,
  cmd: Command,
  ctx: ReplayContext,
  fileAbsPath: string,
  callStack: Set<string>,
): Promise<void> {
  switch (cmd.type) {
    case 'goto':
      try {
        await page.goto(cmd.url, { waitUntil: 'load' });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Navigation failed: ${cmd.url} — ${msg}`);
      }
      break;

    case 'tapOn': {
      const loc = await resolveLocator(page, cmd.selector);
      try {
        await loc.click({ timeout: 5000 });
      } catch {
        throw new Error('Element not found.');
      }
      ctx.lastTappedLocator = loc;
      break;
    }

    case 'inputText':
      if (ctx.lastTappedLocator === null) {
        throw new Error('inputText shorthand used before any tapOn');
      }
      await ctx.lastTappedLocator.fill(cmd.text);
      break;

    case 'inputTextTargeted': {
      const loc = await resolveLocator(page, cmd.element);
      try {
        await loc.fill(cmd.text, { timeout: 5000 });
      } catch {
        throw new Error('Element not found for inputText targeted.');
      }
      break;
    }

    case 'assertVisible': {
      const loc = await resolveLocator(page, cmd.selector);
      try {
        await loc.waitFor({ state: 'visible', timeout: 5000 });
      } catch {
        throw new Error('Expected: visible\nGot: element not found');
      }
      break;
    }

    case 'assertNotVisible': {
      const loc = await resolveLocator(page, cmd.selector);
      try {
        await loc.waitFor({ state: 'hidden', timeout: 5000 });
      } catch {
        throw new Error('Expected: not visible\nGot: visible');
      }
      break;
    }

    case 'assertUrl': {
      const url = new URL(page.url());
      const actual = url.pathname + url.search + url.hash;
      if (!matchesPattern(cmd.path, actual)) {
        throw new Error(`Expected: ${cmd.path}\nGot: ${actual}`);
      }
      break;
    }

    case 'wait':
      await new Promise<void>((r) => setTimeout(r, cmd.ms));
      break;

    case 'waitFor':
      await new Promise<void>((r) => setTimeout(r, cmd.ms));
      break;

    case 'scroll':
      await page.evaluate((dir) => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (dir === 'down') window.scrollBy(0, h);
        else if (dir === 'up') window.scrollBy(0, -h);
        else if (dir === 'right') window.scrollBy(w, 0);
        else if (dir === 'left') window.scrollBy(-w, 0);
      }, cmd.direction);
      break;

    case 'assertText': {
      const loc = await resolveLocator(page, cmd.selector);
      try {
        await loc.waitFor({ state: 'visible', timeout: 5000 });
      } catch {
        throw new Error(`Expected: ${cmd.expected}\nGot: element not found`);
      }
      const actual = (await loc.innerText()).trim();
      if (actual !== cmd.expected) {
        throw new Error(`Expected: ${cmd.expected}\nGot: ${actual}`);
      }
      break;
    }

    case 'assertValue': {
      const loc = await resolveLocator(page, cmd.selector);
      try {
        await loc.waitFor({ state: 'attached', timeout: 5000 });
      } catch {
        throw new Error(`Expected: ${cmd.expected}\nGot: element not found`);
      }
      const actual = await loc.inputValue();
      if (actual !== cmd.expected) {
        throw new Error(`Expected: ${cmd.expected}\nGot: ${actual}`);
      }
      break;
    }

    case 'assertCount': {
      const actual = await page.locator(cmd.css).count();
      if (actual !== cmd.expected) {
        throw new Error(`Expected: ${cmd.expected}\nGot: ${actual}`);
      }
      break;
    }

    case 'assertEnabled': {
      const loc = await resolveLocator(page, cmd.selector);
      try {
        await loc.waitFor({ state: 'attached', timeout: 5000 });
      } catch {
        throw new Error('Expected: enabled\nGot: element not found');
      }
      if (!(await loc.isEnabled())) {
        throw new Error('Expected: enabled\nGot: disabled');
      }
      break;
    }

    case 'assertDisabled': {
      const loc = await resolveLocator(page, cmd.selector);
      try {
        await loc.waitFor({ state: 'attached', timeout: 5000 });
      } catch {
        throw new Error('Expected: disabled\nGot: element not found');
      }
      if (!(await loc.isDisabled())) {
        throw new Error('Expected: disabled\nGot: enabled');
      }
      break;
    }

    case 'assertChecked': {
      const loc = await resolveLocator(page, cmd.selector);
      try {
        await loc.waitFor({ state: 'attached', timeout: 5000 });
      } catch {
        throw new Error('Expected: checked\nGot: element not found');
      }
      if (!(await loc.isChecked())) {
        throw new Error('Expected: checked\nGot: unchecked');
      }
      break;
    }

    case 'assertUnchecked': {
      const loc = await resolveLocator(page, cmd.selector);
      try {
        await loc.waitFor({ state: 'attached', timeout: 5000 });
      } catch {
        throw new Error('Expected: unchecked\nGot: element not found');
      }
      if (await loc.isChecked()) {
        throw new Error('Expected: unchecked\nGot: checked');
      }
      break;
    }

    case 'pressKey':
      await page.keyboard.press(cmd.key);
      break;

    case 'selectOption': {
      const loc = await resolveLocator(page, cmd.selector);
      try {
        await loc.waitFor({ state: 'attached', timeout: 5000 });
      } catch {
        throw new Error('Element not found.');
      }
      try {
        await loc.selectOption(cmd.value, { timeout: 5000 });
      } catch {
        throw new Error('Option not found.');
      }
      break;
    }

    case 'check': {
      const loc = await resolveLocator(page, cmd.selector);
      try {
        await loc.check({ timeout: 5000 });
      } catch {
        throw new Error('Element not found.');
      }
      break;
    }

    case 'uncheck': {
      const loc = await resolveLocator(page, cmd.selector);
      try {
        await loc.uncheck({ timeout: 5000 });
      } catch {
        throw new Error('Element not found.');
      }
      break;
    }

    case 'hover': {
      const loc = await resolveLocator(page, cmd.selector);
      try {
        await loc.hover({ timeout: 5000 });
      } catch {
        throw new Error('Element not found.');
      }
      break;
    }

    case 'doubleClick': {
      const loc = await resolveLocator(page, cmd.selector);
      try {
        await loc.dblclick({ timeout: 5000 });
      } catch {
        throw new Error('Element not found.');
      }
      break;
    }

    case 'clearText': {
      const loc = await resolveLocator(page, cmd.selector);
      try {
        await loc.clear({ timeout: 5000 });
      } catch {
        throw new Error('Element not found.');
      }
      break;
    }

    case 'reload':
      await page.reload({ waitUntil: 'load' });
      break;

    case 'goBack': {
      const urlBefore = page.url();
      await page.goBack({ waitUntil: 'commit' });
      const urlAfter = page.url();
      if (urlAfter === urlBefore || urlAfter.startsWith('about:')) {
        throw new Error('No previous page in history.');
      }
      break;
    }

    case 'goForward': {
      const urlBefore = page.url();
      await page.goForward({ waitUntil: 'commit' });
      const urlAfter = page.url();
      if (urlAfter === urlBefore || urlAfter.startsWith('about:')) {
        throw new Error('No next page in history.');
      }
      break;
    }

    case 'setViewport':
      await page.setViewportSize({ width: cmd.width, height: cmd.height });
      break;

    case 'screenshot': {
      // Resolve screenshot path relative to the flow file's directory
      const screenshotPath = path.resolve(path.dirname(fileAbsPath), cmd.path);
      fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath });
      break;
    }

    case 'runFlow': {
      const flowDir = path.dirname(fileAbsPath);
      const nestedAbsPath = path.resolve(flowDir, cmd.path);

      if (!fs.existsSync(nestedAbsPath)) {
        throw new Error(`Flow file not found: ${nestedAbsPath}`);
      }
      if (callStack.has(nestedAbsPath)) {
        throw new Error(`Circular flow reference detected: ${nestedAbsPath}`);
      }

      callStack.add(nestedAbsPath);
      try {
        // Share replay context so lastTappedLocator persists across nested flows
        await replayFlowFile(nestedAbsPath, page, ctx, callStack);
      } finally {
        callStack.delete(nestedAbsPath);
      }
      break;
    }

    case 'within': {
      const containerLoc = await resolveContainerLocator(page, cmd.selector);
      const count = await containerLoc.count();

      if (count === 0) {
        throw new Error(`within: No container found for selector '${cmd.selector}'`);
      }
      if (cmd.nth !== undefined && cmd.nth >= count) {
        throw new Error(
          `within: nth=${cmd.nth} requested but only ${count} containers matched selector '${cmd.selector}'`,
        );
      }

      const target = cmd.nth !== undefined ? containerLoc.nth(cmd.nth) : containerLoc;
      const scopedPage = createScopedPage(page, target);

      // Share ctx so lastTappedLocator is visible inside the within block
      for (const sc of cmd.do) {
        await dispatchCommand(scopedPage, sc.command, ctx, fileAbsPath, callStack);
      }
      break;
    }

    default: {
      // TypeScript exhaustiveness guard — unreachable at runtime if all types are handled
      const _exhaustive: never = cmd;
      throw new Error(
        `Unhandled command type: ${(_exhaustive as Command & { type: string }).type}`,
      );
    }
  }
}

// ─── Per-file replay ──────────────────────────────────────────────────────────

async function replayFlowFile(
  absPath: string,
  page: Page,
  ctx: ReplayContext,
  callStack: Set<string>,
): Promise<void> {
  const { commands } = loadFlowYaml(absPath);
  const total = commands.length;
  const fileName = path.basename(absPath);

  for (let i = 0; i < total; i++) {
    console.log(`[replay] ${fileName}: ${i + 1}/${total} commands`);
    const cmd = commands[i];
    try {
      await dispatchCommand(page, cmd, ctx, absPath, callStack);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`[replay] FAILED: ${cmd.type} in ${fileName}: ${message}`);
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Replay one or more flow YAML files sequentially using the supplied Playwright page.
 *
 * - Reads YAML with js-yaml (no variable interpolation — out of scope).
 * - Dispatches all command types directly through the Playwright page.
 * - Nested runFlow: commands inside a flow are executed recursively; circular
 *   references are detected via callStack and rejected.
 * - Replay commands are NOT written to the output file.
 * - Progress is logged to stdout: "[replay] <file>: <n>/<total> commands".
 * - Assertion failures reject with: "[replay] FAILED: <type> in <file>: <message>".
 *
 * @param flowPaths  Paths as supplied to --run-flow (resolved from process.cwd()).
 * @param page       Playwright Page instance shared with the recorder.
 * @param outputPath Path of the output recording file (used by cli.ts to write
 *                   runFlow: entries — not used by replayFlows itself).
 * @param callStack  Circular-ref guard; pass a fresh new Set() for top-level calls.
 * @returns          { appId } from the first flow's YAML header.
 */
export async function replayFlows(
  flowPaths: string[],
  page: Page,
  _outputPath: string,
  callStack?: Set<string>,
): Promise<{ appId: string }> {
  if (flowPaths.length === 0) {
    throw new Error('replayFlows: no flow paths provided');
  }

  // Read appId from the first flow before executing anything
  const firstAbsPath = path.resolve(flowPaths[0]);
  const { appId } = loadFlowYaml(firstAbsPath);

  const stack = callStack ?? new Set<string>();

  for (const flowPath of flowPaths) {
    const absPath = path.resolve(flowPath);

    if (!fs.existsSync(absPath)) {
      throw new Error(`Flow file not found: ${absPath}`);
    }
    if (stack.has(absPath)) {
      throw new Error(`Circular flow reference: ${absPath}`);
    }

    stack.add(absPath);
    // Each top-level flow gets a fresh lastTappedLocator context
    const ctx: ReplayContext = { lastTappedLocator: null };
    try {
      await replayFlowFile(absPath, page, ctx, stack);
    } finally {
      stack.delete(absPath);
    }
  }

  return { appId };
}
