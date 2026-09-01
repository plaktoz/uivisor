import * as path from 'path';
import type { RunResult, FlowResult, CommandResult } from '@uivisor/core';

function cmdLabel(cmd: CommandResult['command']): string {
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

function renderCommandTable(results: CommandResult[]): string {
  let table = '| Status | Command | Duration |\n|--------|---------|----------|\n';
  for (const r of results) {
    const icon = r.passed ? '✓' : '✗';
    const label = cmdLabel(r.command).replace(/\|/g, '\\|');
    table += `| ${icon} | ${label} | ${r.durationMs}ms |\n`;
    if (!r.passed) {
      if (r.expected) table += `| | Expected: ${r.expected} / Got: ${r.got ?? ''} | |\n`;
      if (r.screenshotPath) {
        table += `| | ![screenshot](${r.screenshotPath}) | |\n`;
      }
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
  lines.push('# webt Test Report\n');
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
