import * as path from 'path';
import * as fs from 'fs';
import type { Page } from 'playwright';
import type { Command, CommandResult, RunContext, FlowFile, FlowResult, SessionedCommand } from '@uivisor/core';
import { interpolateObject, interpolateValue } from '../parser/interpolate.js';
import { parsePositiveInt } from '../utils/positiveInt.js';
import {
  executeGoto,
  executeTapOn,
  executeInputText,
  executeInputTextTargeted,
  executeAssertVisible,
  executeAssertNotVisible,
  executeAssertUrl,
  executeWait,
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
  executeWaitFor,
  executeWaitForPageLoad,
  executeWithin,
} from '../driver/commands.js';
import { captureScreenshot } from '../reporter/screenshot.js';
import { loadAndParse } from '../parser/index.js';

type RunFlowFn = (file: FlowFile, page: Page, ctx: RunContext) => Promise<FlowResult>;

let _runFlowImpl: RunFlowFn | null = null;

export function registerRunFlow(fn: RunFlowFn): void {
  _runFlowImpl = fn;
}

/** Walk a FlowResult tree and return the first failure message found */
function extractFailureMessage(result: FlowResult): string | undefined {
  for (const cr of result.commandResults) {
    if (!cr.passed) {
      if (cr.nestedResult) return extractFailureMessage(cr.nestedResult);
      return cr.message;
    }
  }
  return undefined;
}

/**
 * Coerce a value that may be a string (post-interpolation) to a number.
 * Throws if the resulting value is not a finite integer.
 */
function toInt(value: number | string, label: string): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isInteger(n)) {
    throw new Error(`${label} must be an integer, got "${value}"`);
  }
  return n;
}

let _screenshotCounter = 0;

export function resetScreenshotCounter(): void {
  _screenshotCounter = 0;
}

export async function dispatch(
  page: Page,
  step: SessionedCommand,
  ctx: RunContext,
  flowStem = 'flow',
  flowDir = process.cwd(),
): Promise<CommandResult> {
  const start = Date.now();
  const cmd = step.command;

  // ── Lazy interpolation: resolve ${...} in command at dispatch time ──────────
  // This is strict mode: an absent variable with no default is an error.
  // The sibling `timeout` (if any) is resolved in the same try block, so an
  // undefined var or an invalid resolved value shares the flow-context logic below.
  let resolvedCmd: Command;
  try {
    resolvedCmd = interpolateObject(cmd, ctx.varMap.toRecord(), true) as Command;

    if (step.timeout !== undefined && typeof step.timeout !== 'number') {
      const resolved = interpolateValue(step.timeout, ctx.varMap.toRecord(), true);
      if (parsePositiveInt(resolved) === undefined) {
        throw new Error(`timeout must be a positive integer, got "${resolved}"`);
      }
    }
  } catch (err: unknown) {
    let message = err instanceof Error ? err.message : String(err);
    if (message.includes('is not defined') || message.includes('Unclosed ${')) {
      const stack = Array.from(ctx.callStack);
      if (stack.length > 0) {
        const currentFlow = stack[stack.length - 1];
        if (stack.length >= 2) {
          const parentFlow = stack[stack.length - 2];
          message = `${message} (in child flow ${currentFlow}, called from ${parentFlow})`;
        } else {
          message = `${message} (in flow ${currentFlow})`;
        }
      }
    }
    return { command: cmd, passed: false, message, durationMs: Date.now() - start };
  }

  // Handle runFlow specially
  if (resolvedCmd.type === 'runFlow') {
    const absPath = path.resolve(flowDir, resolvedCmd.path);

    // Check file exists
    if (!fs.existsSync(absPath)) {
      return {
        command: resolvedCmd,
        passed: false,
        message: `Flow file not found: ${absPath}`,
        durationMs: Date.now() - start,
      };
    }

    // Check circular reference
    if (ctx.callStack.has(absPath)) {
      return {
        command: resolvedCmd,
        passed: false,
        message: `Circular flow reference detected: ${absPath}`,
        durationMs: Date.now() - start,
      };
    }

    const preCallStates = new Map<string, { hasRuntime: boolean; runtimeValue?: string; isUnset: boolean }>();
    let callStackAdded = false;
    let indentLevelIncreased = false;

    try {
      const file = loadAndParse(absPath);

      // ── Variable scoping and defaults merging ──
      const overrides = resolvedCmd.vars ?? {};
      const defaults = file.vars ?? {};

      // Identify scoped keys:
      // 1. Any key in overrides is a scoped override.
      // 2. Any key in defaults that is NOT already in the varMap is a scoped default.
      const scopedKeys = new Set<string>();
      for (const key of Object.keys(overrides)) {
        scopedKeys.add(key);
      }
      for (const key of Object.keys(defaults)) {
        if (ctx.varMap.get(key) === undefined) {
          scopedKeys.add(key);
        }
      }

      // Capture pre-call state of scoped keys
      for (const key of scopedKeys) {
        preCallStates.set(key, {
          hasRuntime: ctx.varMap.hasRuntime(key),
          runtimeValue: ctx.varMap.hasRuntime(key) ? ctx.varMap.get(key) : undefined,
          isUnset: ctx.varMap.isUnset(key),
        });
      }

      // Apply child defaults first (fill-in only for keys that are undefined)
      for (const [key, value] of Object.entries(defaults)) {
        if (ctx.varMap.get(key) === undefined) {
          ctx.varMap.set(key, value);
        }
      }

      // Apply call-site overrides (highest precedence)
      for (const [key, value] of Object.entries(overrides)) {
        ctx.varMap.set(key, value);
      }

      ctx.callStack.add(absPath);
      callStackAdded = true;
      ctx.indentLevel++;
      indentLevelIncreased = true;

      const runFn = _runFlowImpl!;
      const nestedResult = await runFn(file, page, ctx);

      return {
        command: resolvedCmd,
        passed: nestedResult.passed,
        nestedResult,
        message: nestedResult.passed ? undefined : extractFailureMessage(nestedResult),
        durationMs: Date.now() - start,
      };
    } catch (err: unknown) {
      let message = err instanceof Error ? err.message : String(err);
      if (message.includes('is not defined') || message.includes('Unclosed ${')) {
        const stack = Array.from(ctx.callStack);
        // Include the child flow path being initialized if it wasn't added to callStack yet
        const childPath = absPath;
        if (stack.length > 0) {
          const parentFlow = stack[stack.length - 1];
          message = `${message} (in child flow ${childPath}, called from ${parentFlow})`;
        } else {
          message = `${message} (in flow ${childPath})`;
        }
      }
      return {
        command: resolvedCmd,
        passed: false,
        message,
        durationMs: Date.now() - start,
      };
    } finally {
      if (indentLevelIncreased) {
        ctx.indentLevel--;
      }
      if (callStackAdded) {
        ctx.callStack.delete(absPath);
      }
      // Restore pre-call state of scoped keys
      for (const [key, state] of preCallStates.entries()) {
        if (state.hasRuntime) {
          ctx.varMap.set(key, state.runtimeValue!);
        } else if (state.isUnset) {
          ctx.varMap.unset(key);
        } else {
          ctx.varMap.delete(key);
        }
      }
    }
  }

  // Use the interpolated command for all subsequent processing
  const c = resolvedCmd;

  let capturedScreenshotPath: string | undefined;

  try {
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
        await executeWait(toInt(c.ms as unknown as number | string, 'wait ms'));
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
        await executeAssertCount(page, c.css, toInt(c.expected as unknown as number | string, 'assertCount expected'));
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
      case 'goBack':
        await executeGoBack(page);
        break;
      case 'goForward':
        await executeGoForward(page);
        break;
      case 'setViewport':
        await executeSetViewport(
          page,
          toInt(c.width as unknown as number | string, 'setViewport width'),
          toInt(c.height as unknown as number | string, 'setViewport height'),
        );
        break;
      case 'screenshot':
        capturedScreenshotPath = await executeScreenshot(page, c.path, ctx.runDir);
        break;
      case 'waitFor':
        await executeWaitFor(toInt(c.ms as unknown as number | string, 'waitFor ms'));
        break;

      case 'waitForPageLoad':
        await executeWaitForPageLoad(
          page,
          c.path,
          c.timeout !== undefined ? toInt(c.timeout as unknown as number | string, 'waitForPageLoad timeout') : undefined,
        );
        break;

      case 'within': {
        // T10 will have executeWithin hand whole steps to this callback; until then,
        // wrap the inner Command as a bare step (no sibling timeout on `within`'s do: items yet).
        const nestedResults = await executeWithin(page, c, ctx, (p, nc, cx) =>
          dispatch(p, { command: nc }, cx, flowStem, flowDir),
        );
        const allPassed = nestedResults.every((r) => r.passed);
        const nestedResult = {
          filePath: '',
          passed: allPassed,
          commandResults: nestedResults,
          totalCommands: nestedResults.length,
          passedCommands: nestedResults.filter((r) => r.passed).length,
          durationMs: nestedResults.reduce((sum, r) => sum + (r.durationMs ?? 0), 0),
        };
        return {
          command: c,
          passed: allPassed,
          nestedResult,
          message: allPassed ? undefined : nestedResults.find((r) => !r.passed)?.message,
          durationMs: Date.now() - start,
        };
      }

      case 'crossOriginIframeWarning':
        // recorder-only event; should never reach the executor
        throw new Error(`crossOriginIframeWarning is a recorder-only event and cannot be executed`);

      case 'setVar': {
        // Process method call args: strip single quotes, parse integers
        function processArg(raw: string): string | number {
          if (/^\d+$/.test(raw)) return parseInt(raw, 10);
          if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1);
          return raw;
        }

        if ('method' in c) {
          // Method form
          const resolvedArgs = c.args.map(processArg);
          const result = await ctx.methodRunner.call(c.method, resolvedArgs);
          ctx.varMap.set(c.name, result);
        } else {
          // Static form — value already interpolated by the pre-dispatch step
          ctx.varMap.set(c.name, c.value);
        }
        break;
      }

      case 'testVarSet': {
        const actual = ctx.varMap.get(c.name);
        if (actual === undefined || actual === '') {
          throw new Error(`testVarSet: variable "${c.name}" is not set or is empty`);
        }
        if ('expected' in c && c.expected !== undefined) {
          if (actual !== c.expected) {
            throw new Error(
              `testVarSet: variable "${c.name}"\nExpected: ${c.expected}\nGot: ${actual}`,
            );
          }
        }
        break;
      }

      case 'unsetVar': {
        ctx.varMap.unset(c.name);
        break;
      }

      default: {
        // TypeScript exhaustiveness guard — this branch is unreachable at runtime.
        // If a new Command type is added without a case here, tsc will fail.
        const _exhaustive: never = c;
        throw new Error(
          `Unhandled command type: ${(_exhaustive as Command & { type: string }).type}`,
        );
      }
    }
    return { command: c, passed: true, screenshotPath: capturedScreenshotPath, durationMs: Date.now() - start };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    let expected: string | undefined;
    let got: string | undefined;

    // Parse Expected:/Got: from structured error messages
    if (message.includes('Expected:') && message.includes('Got:')) {
      const parts = message.split('\n');
      for (const part of parts) {
        if (part.startsWith('Expected:')) expected = part.replace('Expected:', '').trim();
        if (part.startsWith('Got:')) got = part.replace('Got:', '').trim();
      }
    }

    // Capture screenshot for visual failures
    let screenshotPath: string | undefined;
    try {
      _screenshotCounter++;
      screenshotPath = await captureScreenshot(page, flowStem, _screenshotCounter, ctx.runDir);
    } catch {
      // screenshot failure is non-fatal
    }

    return {
      command: c,
      passed: false,
      message,
      expected,
      got,
      screenshotPath,
      durationMs: Date.now() - start,
    };
  }
}
