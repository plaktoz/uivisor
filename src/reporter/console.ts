import * as path from 'path';
import type { CommandResult, FlowResult, RunResult } from '../types.js';

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

  private _cmdSummary(cmd: import('../types.js').Command): string {
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
    }
  }
}
