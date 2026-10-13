import type { Command } from '@uivisor/core';
import { runFlowLabel } from './runFlowLabel.js';

export function commandLabel(cmd: Command): string {
  switch (cmd.type) {
    case 'goto': return `goto: ${cmd.url}`;
    case 'tapOn': return `tapOn: ${JSON.stringify(cmd.selector)}`;
    case 'inputText': return `inputText: ${cmd.text}`;
    case 'inputTextTargeted': return `inputTextTargeted: ${JSON.stringify(cmd.element)}`;
    case 'assertVisible': return `assertVisible: ${JSON.stringify(cmd.selector)}`;
    case 'assertNotVisible': return `assertNotVisible: ${JSON.stringify(cmd.selector)}`;
    case 'assertUrl': return `assertUrl: ${cmd.path}`;
    case 'wait': return `wait: ${cmd.ms}ms`;
    case 'runFlow': return runFlowLabel(cmd);
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
    case 'waitForPageLoad': return cmd.path ? `waitForPageLoad: ${cmd.path}` : 'waitForPageLoad';
    case 'goBack': return 'goBack';
    case 'goForward': return 'goForward';
    case 'setViewport': return `setViewport: ${cmd.width}x${cmd.height}`;
    case 'screenshot': return `screenshot: ${cmd.path}`;
    case 'waitFor': return `waitFor: ${cmd.ms}ms`;
    case 'within': return `within: ${cmd.selector}`;
    case 'crossOriginIframeWarning': return `crossOriginIframeWarning: ${cmd.src}`;
    case 'setVar':
      if ('method' in cmd) {
        return `setVar: ${cmd.name}=${cmd.method}(${cmd.args.join(', ')})`;
      }
      return `setVar: ${cmd.name}=${cmd.value}`;
    case 'testVarSet':
      if ('expected' in cmd && cmd.expected !== undefined) {
        return `testVarSet: ${cmd.name} == ${cmd.expected}`;
      }
      return `testVarSet: ${cmd.name}`;
    case 'unsetVar': return `unsetVar: ${cmd.name}`;
  }
}
