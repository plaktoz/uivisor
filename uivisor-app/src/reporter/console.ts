import * as path from 'path';
import type { Command, CommandResult, FlowResult, RunResult } from '@uivisor/core';

export class ConsoleReporter {
  startFlow(filePath: string, _indentLevel: number): void {
    const filename = path.basename(filePath);
    process.stdout.write(`▶ Running: ${filename}\n`);
  }

  reportCommand(result: CommandResult, indentLevel: number): void {
    const indent = '  '.repeat(indentLevel + 1);
    const cmdSummary = this._cmdSummary(result.command);

    if (result.passed) {
      process.stdout.write(`${indent}✓ ${cmdSummary}\n`);
    } else {
      process.stdout.write(`${indent}✗ ${cmdSummary} — FAILED\n`);
      if (result.expected) process.stdout.write(`${indent}  Expected: ${result.expected}\n`);
      if (result.got) process.stdout.write(`${indent}  Got: ${result.got}\n`);
      if (result.screenshotPath) process.stdout.write(`${indent}  Screenshot: ${result.screenshotPath}\n`);
      if (result.message && !result.expected) process.stdout.write(`${indent}  ${result.message}\n`);

      // Print nested flow results recursively
      if (result.nestedResult) {
        this._printNested(result.nestedResult, indentLevel + 1);
      }
    }

    // For passing runFlow, print nested commands too
    if (result.passed && result.nestedResult) {
      this._printNested(result.nestedResult, indentLevel + 1);
    }
  }

  private _printNested(nestedResult: FlowResult, indentLevel: number): void {
    const indent = '  '.repeat(indentLevel + 1);
    process.stdout.write(`${indent}▶ Running: ${path.basename(nestedResult.filePath)}\n`);
    for (const r of nestedResult.commandResults) {
      this.reportCommand(r, indentLevel);
    }
  }

  endFlow(result: FlowResult): void {
    const n = result.passedCommands;
    const m = result.totalCommands;
    if (result.passed) {
      process.stdout.write(`PASSED — ${n}/${m} commands passed\n`);
    } else {
      process.stdout.write(`FAILED — ${n}/${m} commands passed\n`);
    }
  }

  runEnd(result: RunResult): void {
    if (result.totalFlows > 1) {
      process.stdout.write(`\n${result.passedFlows} flows passed, ${result.failedFlows} flows failed\n`);
    }
  }

  private _cmdSummary(cmd: Command): string {
    switch (cmd.type) {
      case 'goto': return `goto: ${cmd.url}`;
      case 'tapOn': return `tapOn: ${JSON.stringify(cmd.selector)}`;
      case 'inputText': return `inputText: ${cmd.text}`;
      case 'inputTextTargeted': return `inputTextTargeted: ${JSON.stringify(cmd.element)}`;
      case 'assertVisible': return `assertVisible: ${JSON.stringify(cmd.selector)}`;
      case 'assertNotVisible': return `assertNotVisible: ${JSON.stringify(cmd.selector)}`;
      case 'assertUrl': return `assertUrl: ${cmd.path}`;
      case 'wait': return `wait: ${cmd.ms}ms`;
      case 'runFlow': return `runFlow: ${cmd.path}`;
      case 'scroll': return `scroll: ${cmd.direction}`;
      case 'assertText': return `assertText: ${JSON.stringify(cmd.selector)} expected: ${cmd.expected}`;
      case 'assertValue': return `assertValue: ${JSON.stringify(cmd.selector)} expected: ${cmd.expected}`;
      case 'assertCount': return `assertCount: ${cmd.css} expected: ${cmd.expected}`;
      case 'assertEnabled': return `assertEnabled: ${JSON.stringify(cmd.selector)}`;
      case 'assertDisabled': return `assertDisabled: ${JSON.stringify(cmd.selector)}`;
      case 'assertChecked': return `assertChecked: ${JSON.stringify(cmd.selector)}`;
      case 'assertUnchecked': return `assertUnchecked: ${JSON.stringify(cmd.selector)}`;
      case 'pressKey': return `pressKey: ${cmd.key}`;
      case 'selectOption': return `selectOption: ${JSON.stringify(cmd.selector)} value: ${cmd.value}`;
      case 'check': return `check: ${JSON.stringify(cmd.selector)}`;
      case 'uncheck': return `uncheck: ${JSON.stringify(cmd.selector)}`;
      case 'hover': return `hover: ${JSON.stringify(cmd.selector)}`;
      case 'doubleClick': return `doubleClick: ${JSON.stringify(cmd.selector)}`;
      case 'clearText': return `clearText: ${JSON.stringify(cmd.selector)}`;
      case 'reload': return 'reload';
      case 'goBack': return 'goBack';
      case 'goForward': return 'goForward';
      case 'setViewport': return `setViewport: ${cmd.width}x${cmd.height}`;
      case 'screenshot': return `screenshot: ${cmd.path}`;
      case 'waitFor': return `waitFor: ${cmd.ms}ms`;
    }
  }
}
