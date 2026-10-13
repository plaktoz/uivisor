import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';
import type { Page } from 'playwright';
import type { Command, Selector, SessionedCommand, PlaywrightContext } from '@uivisor/core';
import {
  flattenVars,
  interpolateObject,
  parseRunFlow,
  parseSelector,
  validateVars,
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
  executeWaitForPageLoad,
} from '@uivisor/core';

// ─── YAML command parser ──────────────────────────────────────────────────────

/** Matches a method call on the right-hand side of a setVar shorthand: name(args...) */
const METHOD_CALL_RE = /^([a-zA-Z_][a-zA-Z0-9_]*)\((.*)\)$/s;

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
      return parseRunFlow(val);

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

    case 'waitForPageLoad': {
      if (val === null || val === undefined) return { type: 'waitForPageLoad' };
      if (typeof val === 'string') return { type: 'waitForPageLoad', path: val };
      const obj = val as Record<string, unknown>;
      const path = typeof obj['path'] === 'string' && obj['path'] !== '' ? obj['path'] : undefined;
      const rawTimeout = obj['timeout'];
      let timeout: number | undefined;
      if (rawTimeout !== null && rawTimeout !== undefined) {
        if (typeof rawTimeout !== 'number' || !Number.isInteger(rawTimeout) || rawTimeout < 0) {
          throw new Error(`waitForPageLoad: timeout must be 0 (no timeout) or a positive integer, got ${rawTimeout}`);
        }
        timeout = rawTimeout;
      }
      return { type: 'waitForPageLoad', ...(path !== undefined && { path }), ...(timeout !== undefined && { timeout }) };
    }

    case 'setVar': {
      if (typeof val === 'string') {
        // Shorthand: "name=value" or "name=method(args)" — split on the first '='
        const eqIdx = val.indexOf('=');
        if (eqIdx === -1) {
          throw new Error(`setVar: expected "name=value" or "name=method(args)", got: ${val}`);
        }
        const name = val.slice(0, eqIdx);
        const rhs = val.slice(eqIdx + 1);
        if (name.trim() === '') throw new Error('setVar: variable name must not be empty');
        const methodMatch = METHOD_CALL_RE.exec(rhs);
        if (methodMatch) {
          const argsStr = methodMatch[2];
          const args = argsStr.trim() === '' ? [] : argsStr.split(',').map((a) => a.trim());
          return { type: 'setVar', name, method: methodMatch[1], args };
        }
        return { type: 'setVar', name, value: rhs };
      }
      const obj = val as Record<string, unknown>;
      if ('method' in obj) {
        return {
          type: 'setVar',
          name: String(obj.name),
          method: String(obj.method),
          args: Array.isArray(obj.args) ? (obj.args as unknown[]).map(String) : [],
        };
      }
      return { type: 'setVar', name: String(obj.name), value: String(obj.value) };
    }

    case 'testVarSet': {
      if (typeof val === 'string') return { type: 'testVarSet', name: val };
      const obj = val as Record<string, unknown>;
      return {
        type: 'testVarSet',
        name: String(obj.name),
        ...(obj.expected !== undefined && { expected: String(obj.expected) }),
      };
    }

    case 'unsetVar':
      return { type: 'unsetVar', name: String(val) };

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
      const parsedNth = nth !== undefined ? Number(nth) : undefined;
      if (parsedNth !== undefined && parsedNth < 0) {
        throw new Error(`within: nth must be a non-negative integer, got ${parsedNth}`);
      }
      return {
        type: 'within',
        selector,
        nth: parsedNth,
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
  vars?: Record<string, unknown>;
  commands: Record<string, unknown>[];
}

function loadFlowYaml(absPath: string): { appId: string; vars: Record<string, string>; commands: Command[] } {
  const content = fs.readFileSync(absPath, 'utf8');
  const raw = yaml.load(content) as RawFlowFile;

  if (!raw || typeof raw !== 'object') {
    throw new Error(`Invalid flow file (not a YAML object): ${absPath}`);
  }

  const appId = String(raw.appId ?? '');
  const rawCommands = Array.isArray(raw.commands) ? raw.commands : [];
  const commands = rawCommands.map((r) => parseCommand(r));

  let vars: Record<string, string> = {};
  if (raw.vars !== undefined) {
    validateVars(raw.vars, absPath);
    vars = flattenVars(raw.vars, absPath);
  }

  return { appId, vars, commands };
}

// ─── Playwright command dispatcher ───────────────────────────────────────────

async function dispatchCommand(
  page: Page,
  cmd: Command,
  ctx: PlaywrightContext,
  fileAbsPath: string,
  callStack: Set<string>,
  varMap: Map<string, string>,
): Promise<void> {
  // A `within` block's `do:` steps are interpolated when each is dispatched, so a
  // setVar earlier in the block is visible to later steps.
  const c =
    cmd.type === 'within'
      ? { ...(interpolateObject({ ...cmd, do: [] }, Object.fromEntries(varMap), true) as typeof cmd), do: cmd.do }
      : (interpolateObject(cmd, Object.fromEntries(varMap), true) as Command);
  switch (c.type) {
    case 'goto':
      await executeGoto(page, c.url);
      break;

    case 'tapOn':
      await executeTapOn(page, c.selector, ctx);
      break;

    case 'inputText':
      await executeInputText(ctx, c.text);
      break;

    case 'inputTextTargeted':
      await executeInputTextTargeted(page, c.element, c.text);
      break;

    case 'assertVisible':
      await executeAssertVisible(page, c.selector);
      break;

    case 'assertNotVisible':
      await executeAssertNotVisible(page, c.selector);
      break;

    case 'assertUrl':
      await executeAssertUrl(page, c.path);
      break;

    case 'wait':
      await executeWait(c.ms);
      break;

    case 'waitFor':
      await executeWaitFor(c.ms);
      break;

    case 'scroll':
      await executeScroll(page, c.direction);
      break;

    case 'assertText':
      await executeAssertText(page, c.selector, c.expected);
      break;

    case 'assertValue':
      await executeAssertValue(page, c.selector, c.expected);
      break;

    case 'assertCount':
      await executeAssertCount(page, c.css, c.expected);
      break;

    case 'assertEnabled':
      await executeAssertEnabled(page, c.selector);
      break;

    case 'assertDisabled':
      await executeAssertDisabled(page, c.selector);
      break;

    case 'assertChecked':
      await executeAssertChecked(page, c.selector);
      break;

    case 'assertUnchecked':
      await executeAssertUnchecked(page, c.selector);
      break;

    case 'pressKey':
      await executePressKey(page, c.key);
      break;

    case 'selectOption':
      await executeSelectOption(page, c.selector, c.value);
      break;

    case 'check':
      await executeCheck(page, c.selector);
      break;

    case 'uncheck':
      await executeUncheck(page, c.selector);
      break;

    case 'hover':
      await executeHover(page, c.selector);
      break;

    case 'doubleClick':
      await executeDoubleClick(page, c.selector);
      break;

    case 'clearText':
      await executeClearText(page, c.selector);
      break;

    case 'reload':
      await executeReload(page);
      break;

    case 'waitForPageLoad':
      await executeWaitForPageLoad(page, c.path, c.timeout);
      break;

    case 'goBack':
      await executeGoBack(page);
      break;

    case 'goForward':
      await executeGoForward(page);
      break;

    case 'setViewport':
      await executeSetViewport(page, c.width, c.height);
      break;

    case 'screenshot':
      await executeScreenshot(page, c.path, path.dirname(fileAbsPath));
      break;

    case 'runFlow': {
      const flowDir = path.dirname(fileAbsPath);
      const nestedAbsPath = path.resolve(flowDir, c.path);

      if (!fs.existsSync(nestedAbsPath)) {
        throw new Error(`Flow file not found: ${nestedAbsPath}`);
      }
      if (callStack.has(nestedAbsPath)) {
        throw new Error(`Circular flow reference detected: ${nestedAbsPath}`);
      }

      callStack.add(nestedAbsPath);
      try {
        // Share replay context so lastTappedLocator persists across nested flows
        await replayFlowFile(nestedAbsPath, page, ctx, callStack, varMap, c.vars);
      } finally {
        callStack.delete(nestedAbsPath);
      }
      break;
    }

    case 'within': {
      const containerLoc = await resolveContainerLocator(page, c.selector);
      const count = await containerLoc.count();

      if (count === 0) {
        throw new Error(`within: No container found for selector '${c.selector}'`);
      }
      if (c.nth !== undefined && c.nth < 0) {
        throw new Error(`within: nth must be a non-negative integer, got ${c.nth}`);
      }
      if (c.nth !== undefined && c.nth >= count) {
        throw new Error(
          `within: nth=${c.nth} requested but only ${count} containers matched selector '${c.selector}'`,
        );
      }

      const target = c.nth !== undefined ? containerLoc.nth(c.nth) : containerLoc;
      const scopedPage = createScopedPage(page, target);

      // Share ctx and varMap so vars are visible inside the within block
      for (const sc of c.do) {
        await dispatchCommand(scopedPage, sc.command, ctx, fileAbsPath, callStack, varMap);
      }
      break;
    }

    case 'setVar':
      if ('method' in c) {
        throw new Error(`setVar with method is not supported in the recorder replayer`);
      }
      varMap.set(c.name, c.value);
      break;

    case 'testVarSet': {
      const actual = varMap.get(c.name);
      if (actual === undefined || actual === '') {
        throw new Error(`testVarSet: variable "${c.name}" is not set or is empty`);
      }
      if (c.expected !== undefined && actual !== c.expected) {
        throw new Error(`testVarSet: variable "${c.name}"\nExpected: ${c.expected}\nGot: ${actual}`);
      }
      break;
    }

    case 'unsetVar':
      varMap.delete(c.name);
      break;

    case 'crossOriginIframeWarning':
      // recorder-only event; should never reach the executor
      throw new Error(`crossOriginIframeWarning is a recorder-only event and cannot be executed`);

    default: {
      // TypeScript exhaustiveness guard — unreachable at runtime if all types are handled
      const _exhaustive: never = c;
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
  parentVarMap?: Map<string, string>,
  callSiteVars?: Readonly<Record<string, string>>,
): Promise<void> {
  const { vars, commands } = loadFlowYaml(absPath);
  const total = commands.length;
  const fileName = path.basename(absPath);

  // A nested flow shares the caller's varMap, so its setVar/unsetVar survive the return.
  // Only the file's `vars:` defaults (fill-in for unset keys) and the call-site runFlow vars
  // are scoped to this call: their prior state is restored afterwards.
  const varMap: Map<string, string> = parentVarMap ?? new Map();
  const scoped = new Map<string, string | undefined>();
  for (const key of Object.keys(callSiteVars ?? {})) scoped.set(key, varMap.get(key));
  for (const key of Object.keys(vars)) {
    if (!varMap.has(key) && !scoped.has(key)) scoped.set(key, undefined);
  }
  for (const [key, value] of Object.entries(vars)) {
    if (!varMap.has(key)) varMap.set(key, value);
  }
  for (const [key, value] of Object.entries(callSiteVars ?? {})) varMap.set(key, value);

  try {
    for (let i = 0; i < total; i++) {
      console.log(`[replay] ${fileName}: ${i + 1}/${total} commands`);
      const cmd = commands[i];
      try {
        await dispatchCommand(page, cmd, ctx, absPath, callStack, varMap);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`[replay] FAILED: ${cmd.type} in ${fileName}: ${message}`);
      }
    }
  } finally {
    for (const [key, prior] of scoped) {
      if (prior === undefined) varMap.delete(key);
      else varMap.set(key, prior);
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Replay one or more flow YAML files sequentially using the supplied Playwright page.
 *
 * - Reads YAML with js-yaml. Variables declared in each flow's `vars:` block are
 *   interpolated at dispatch time. `setVar`/`unsetVar`/`testVarSet` commands are
 *   supported (method-based setVar is not supported and will throw).
 * - Dispatches all command types directly through the Playwright page.
 * - Nested runFlow: commands inside a flow are executed recursively; circular
 *   references are detected via callStack and rejected.
 * - Replay commands are NOT written to the output file.
 * - Progress is logged to stdout: "[replay] <file>: <n>/<total> commands".
 * - Assertion failures reject with: "[replay] FAILED: <type> in <file>: <message>".
 *   So does a reference to an undefined variable that has no `${name:default}`.
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
    // Each top-level flow gets a fresh lastTappedLocator context and its own varMap
    const ctx: PlaywrightContext = { lastTappedLocator: null };
    try {
      await replayFlowFile(absPath, page, ctx, stack);
    } finally {
      stack.delete(absPath);
    }
  }

  return { appId };
}
