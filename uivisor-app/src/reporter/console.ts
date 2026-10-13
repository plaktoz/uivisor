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
      for (const line of failureLines(result)) process.stdout.write(`${indent}  ${line}\n`);

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
    process.stdout.write(`${flowSummary(result)}\n`);
  }

  runEnd(result: RunResult): void {
    if (result.totalFlows > 1) {
      process.stdout.write(`\n${result.passedFlows} flows passed, ${result.failedFlows} flows failed\n`);
    }
  }
}

export function failureLines(r: CommandResult): string[] {
  const lines: string[] = [];
  if (r.expected) lines.push(`Expected: ${r.expected}`);
  if (r.got) lines.push(`Got: ${r.got}`);
  if (r.screenshotPath) lines.push(`Screenshot: ${r.screenshotPath}`);
  if (r.message && !r.expected) lines.push(r.message);
  return lines;
}

export function flowSummary(result: FlowResult): string {
  return `${result.passed ? 'PASSED' : 'FAILED'} — ${result.passedCommands}/${result.totalCommands} commands passed`;
}
