import * as path from 'path';
import type { RunResult, FlowResult, CommandResult } from '@uivisor/core';
import { commandLabel } from './label.js';

function renderCommandTable(results: CommandResult[]): string {
  let table = '| Status | Command | Duration |\n|--------|---------|----------|\n';
  for (const r of results) {
    const icon = r.passed ? '✓' : '✗';
    const label = commandLabel(r.command).replace(/\|/g, '\\|');
    table += `| ${icon} | ${label} | ${r.durationMs}ms |\n`;
    if (!r.passed) {
      if (r.expected) table += `| | Expected: ${r.expected} / Got: ${r.got ?? ''} | |\n`;
    }
    if (r.screenshotPath) {
      table += `| | ![screenshot](${r.screenshotPath}) | |\n`;
    }
    if (r.nestedResult) {
      table += '\n**Nested flow:**\n\n' + renderCommandTable(r.nestedResult.commandResults);
    }
  }
  return table;
}

function renderFlow(flow: FlowResult): string {
  const filename = path.basename(flow.filePath);
  const status = flow.passed ? 'PASSED' : 'FAILED';
  return `## ${filename}\n\n**Status:** ${status} — ${flow.passedCommands}/${flow.totalCommands} commands passed (${flow.durationMs}ms)\n\n${renderCommandTable(flow.commandResults)}\n`;
}

export function generateMarkdownReport(result: RunResult): string {
  const lines: string[] = [];
  lines.push('# UIVisor Test Report\n');
  lines.push('## Summary\n');
  lines.push(`${result.totalFlows} flow total — ${result.passedFlows} passed, ${result.failedFlows} failed (${result.durationMs}ms)\n`);
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total flows | ${result.totalFlows} |`);
  lines.push(`| Passed | ${result.passedFlows} |`);
  lines.push(`| Failed | ${result.failedFlows} |`);
  lines.push(`| Duration | ${result.durationMs}ms |`);
  lines.push('');
  for (const flow of result.flows) {
    lines.push(renderFlow(flow));
  }
  return lines.join('\n');
}
