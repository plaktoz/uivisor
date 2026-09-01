import * as path from 'path';
import * as fs from 'fs';
import type { Page } from 'playwright';
import type { Command, CommandResult, RunContext, FlowFile, FlowResult } from '@uivisor/core';
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

let _screenshotCounter = 0;

export function resetScreenshotCounter(): void {
  _screenshotCounter = 0;
}

export async function dispatch(
  page: Page,
  cmd: Command,
  ctx: RunContext,
  flowStem = 'flow',
  flowDir = process.cwd(),
): Promise<CommandResult> {
  const start = Date.now();

  // Handle runFlow specially
  if (cmd.type === 'runFlow') {
    const absPath = path.resolve(flowDir, cmd.path);

    // Check file exists
    if (!fs.existsSync(absPath)) {
      return {
        command: cmd,
        passed: false,
        message: `Flow file not found: ${absPath}`,
        durationMs: Date.now() - start,
      };
    }

    // Check circular reference
    if (ctx.callStack.has(absPath)) {
      return {
        command: cmd,
        passed: false,
        message: `Circular flow reference detected: ${absPath}`,
        durationMs: Date.now() - start,
      };
    }

    try {
      const file = loadAndParse(absPath);
      ctx.callStack.add(absPath);
      ctx.indentLevel++;

      const runFn = _runFlowImpl!;
      const nestedResult = await runFn(file, page, ctx);

      ctx.indentLevel--;
      ctx.callStack.delete(absPath);

      return {
        command: cmd,
        passed: nestedResult.passed,
        nestedResult,
        message: nestedResult.passed ? undefined : extractFailureMessage(nestedResult),
        durationMs: Date.now() - start,
      };
    } catch (err: unknown) {
      ctx.indentLevel--;
      ctx.callStack.delete(absPath);
      const message = err instanceof Error ? err.message : String(err);
      return {
        command: cmd,
        passed: false,
        message,
        durationMs: Date.now() - start,
      };
    }
  }

  let capturedScreenshotPath: string | undefined;

  try {
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
        capturedScreenshotPath = await executeScreenshot(page, cmd.path, ctx.runDir);
        break;
      case 'waitFor':
        await executeWaitFor(cmd.ms);
        break;
    }
    return { command: cmd, passed: true, screenshotPath: capturedScreenshotPath, durationMs: Date.now() - start };
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
      command: cmd,
      passed: false,
      message,
      expected,
      got,
      screenshotPath,
      durationMs: Date.now() - start,
    };
  }
}
