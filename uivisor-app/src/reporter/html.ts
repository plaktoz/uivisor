import * as fs from 'fs';
import * as path from 'path';
import type { RunResult, FlowResult, CommandResult } from '@uivisor/core';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
    case 'within': return `within: ${escapeHtml(cmd.selector)}`;
  }
}

function renderCommandRows(results: CommandResult[], indent = 0): string {
  return results.map((r) => {
    const icon = r.passed ? '✓' : '✗';
    const status = r.passed ? 'pass' : 'fail';
    const label = escapeHtml(cmdLabel(r.command));
    const padding = indent > 0 ? ` style="padding-left:${indent * 20}px"` : '';
    let row = `<tr class="${status}"><td${padding}>${icon}</td><td>${label}</td><td>${r.durationMs}ms</td></tr>\n`;
    if (!r.passed) {
      if (r.expected) row += `<tr class="fail-detail"><td colspan="3">&nbsp;&nbsp;Expected: ${escapeHtml(r.expected)} / Got: ${escapeHtml(r.got ?? '')}</td></tr>\n`;
      if (r.screenshotPath) {
        let imgTag = '';
        try {
          const buf = fs.readFileSync(r.screenshotPath);
          imgTag = `<img src="data:image/png;base64,${buf.toString('base64')}" alt="screenshot" style="max-width:400px">`;
        } catch {
          imgTag = `<a href="${escapeHtml(r.screenshotPath)}">${escapeHtml(r.screenshotPath)}</a>`;
        }
        row += `<tr class="fail-detail"><td colspan="3">${escapeHtml(r.screenshotPath)}<br>${imgTag}</td></tr>\n`;
      }
    }
    if (r.nestedResult) {
      row += renderCommandRows(r.nestedResult.commandResults, indent + 1);
    }
    return row;
  }).join('');
}

function renderFlow(flow: FlowResult): string {
  const filename = path.basename(flow.filePath);
  const status = flow.passed ? 'PASSED' : 'FAILED';
  return `
<section>
  <h2>${escapeHtml(filename)} — <span class="${flow.passed ? 'pass' : 'fail'}">${status}</span></h2>
  <p>${flow.passedCommands}/${flow.totalCommands} commands passed &bull; ${flow.durationMs}ms</p>
  <table>
    <thead><tr><th></th><th>Command</th><th>Duration</th></tr></thead>
    <tbody>
      ${renderCommandRows(flow.commandResults)}
    </tbody>
  </table>
</section>`;
}

export function generateHtmlReport(result: RunResult): string {
  const css = `
    body { font-family: sans-serif; margin: 20px; }
    h1 { color: #333; }
    h2 { margin-top: 24px; }
    table { border-collapse: collapse; width: 100%; margin-top: 8px; }
    th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
    th { background: #f5f5f5; }
    .pass { color: #2a7; }
    .fail { color: #c22; }
    .fail-detail { background: #fff5f5; font-size: 0.9em; }
    img { display: block; margin-top: 4px; }
    .summary { background: #f9f9f9; padding: 12px; border-radius: 4px; margin-bottom: 16px; }
  `;

  const summaryRows = `
    <tr><td>Total flows</td><td>${result.totalFlows}</td></tr>
    <tr><td>Passed</td><td class="pass">${result.passedFlows}</td></tr>
    <tr><td>Failed</td><td class="${result.failedFlows > 0 ? 'fail' : ''}">${result.failedFlows}</td></tr>
    <tr><td>Duration</td><td>${result.durationMs}ms</td></tr>
  `;

  const flowSections = result.flows.map(renderFlow).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>webt Test Report</title>
  <style>${css}</style>
</head>
<body>
  <h1>webt Test Report</h1>
  <div class="summary">
    <table>${summaryRows}</table>
  </div>
  ${flowSections}
</body>
</html>`;
}
