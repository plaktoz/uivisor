import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';
import type { Page } from 'playwright';
import type { Command, Selector, SessionedCommand, PlaywrightContext } from '@uivisor/core';
import {
  parseSelector,
  resolveContainerLocator,
  createScopedPage,
  executeGoto,
  executeTapOn,
  executeInputText,
  executeInputTextTargeted,
  executeAssertVisible,
  executeAssertNotVisible,
  executeAssertUrl,
  executeWait,
  executeWaitFor,
  executeScroll,
  executeAssertText,
  executeAssertValue,
  executeAssertCount,
  executeAssertEnabled,
  executeAssertDisabled,
  executeAssertChecked,
  executeAssertUnchecked,
  executePressKey,
  executeSelectOption,
  executeCheck,
  executeUncheck,
  executeHover,
  executeDoubleClick,
  executeClearText,
  executeReload,
  executeGoBack,
  executeGoForward,
  executeSetViewport,
  executeScreenshot,
} from '@uivisor/core';

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
  ctx: PlaywrightContext,
  fileAbsPath: string,
  callStack: Set<string>,
): Promise<void> {
  switch (cmd.type) {
    case 'goto':
      await executeGoto(page, cmd.url);
      break;

    case 'tapOn':
      await executeTapOn(page, cmd.selector, ctx);
      break;

    case 'inputText':
      await executeInputText(ctx, cmd.text);
      break;

    case 'inputTextTargeted':
      await executeInputTextTargeted(page, cmd.element, cmd.text);
      break;

    case 'assertVisible':
      await executeAssertVisible(page, cmd.selector);
      break;

    case 'assertNotVisible':
      await executeAssertNotVisible(page, cmd.selector);
      break;

    case 'assertUrl':
      await executeAssertUrl(page, cmd.path);
      break;

    case 'wait':
      await executeWait(cmd.ms);
      break;

    case 'waitFor':
      await executeWaitFor(cmd.ms);
      break;

    case 'scroll':
      await executeScroll(page, cmd.direction);
      break;

    case 'assertText':
      await executeAssertText(page, cmd.selector, cmd.expected);
      break;

    case 'assertValue':
      await executeAssertValue(page, cmd.selector, cmd.expected);
      break;

    case 'assertCount':
      await executeAssertCount(page, cmd.css, cmd.expected);
      break;

    case 'assertEnabled':
      await executeAssertEnabled(page, cmd.selector);
      break;

    case 'assertDisabled':
      await executeAssertDisabled(page, cmd.selector);
      break;

    case 'assertChecked':
      await executeAssertChecked(page, cmd.selector);
      break;

    case 'assertUnchecked':
      await executeAssertUnchecked(page, cmd.selector);
      break;

    case 'pressKey':
      await executePressKey(page, cmd.key);
      break;

    case 'selectOption':
      await executeSelectOption(page, cmd.selector, cmd.value);
      break;

    case 'check':
      await executeCheck(page, cmd.selector);
      break;

    case 'uncheck':
      await executeUncheck(page, cmd.selector);
      break;

    case 'hover':
      await executeHover(page, cmd.selector);
      break;

    case 'doubleClick':
      await executeDoubleClick(page, cmd.selector);
      break;

    case 'clearText':
      await executeClearText(page, cmd.selector);
      break;

    case 'reload':
      await executeReload(page);
      break;

    case 'goBack':
      await executeGoBack(page);
      break;

    case 'goForward':
      await executeGoForward(page);
      break;

    case 'setViewport':
      await executeSetViewport(page, cmd.width, cmd.height);
      break;

    case 'screenshot':
      await executeScreenshot(page, cmd.path, path.dirname(fileAbsPath));
      break;

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
  ctx: PlaywrightContext,
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
    const ctx: PlaywrightContext = { lastTappedLocator: null };
    try {
      await replayFlowFile(absPath, page, ctx, stack);
    } finally {
      stack.delete(absPath);
    }
  }

  return { appId };
}
