import * as path from 'path';
import type { CommandResult, FlowResult, RunResult } from '@uivisor/core';
import { commandLabel } from './label.js';

export class ConsoleReporter {
  startFlow(filePath: string, _indentLevel: number): void {
    const filename = path.basename(filePath);
    process.stdout.write(`▶ Running: ${filename}\n`);
  }

  reportCommand(result: CommandResult, indentLevel: number): void {
    const indent = '  '.repeat(indentLevel + 1);
    const cmdSummary = commandLabel(result.command);

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
}
