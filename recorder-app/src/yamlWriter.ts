import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import type { Command } from '@uivisor/core';

function selectorToObject(selector: unknown): Record<string, unknown> {
  if (typeof selector === 'string') {
    return { text: selector };
  }
  return selector as Record<string, unknown>;
}

function commandToRecord(cmd: Command): Record<string, unknown> {
  switch (cmd.type) {
    case 'goto':
      return { goto: cmd.url };

    case 'tapOn':
      return { tapOn: cmd.selector };

    case 'inputText':
      return { inputText: cmd.text };

    case 'inputTextTargeted':
      return { inputText: { element: cmd.element, text: cmd.text } };

    case 'assertVisible':
      return { assertVisible: cmd.selector };

    case 'assertNotVisible':
      return { assertNotVisible: cmd.selector };

    case 'wait':
      return { wait: cmd.ms };

    case 'assertUrl':
      return { assertUrl: cmd.path };

    case 'runFlow':
      return { runFlow: cmd.path };

    case 'scroll':
      return { scroll: cmd.direction };

    case 'assertText': {
      const sel = selectorToObject(cmd.selector);
      return { assertText: { ...sel, expected: cmd.expected } };
    }

    case 'assertValue': {
      const sel = selectorToObject(cmd.selector);
      return { assertValue: { ...sel, expected: cmd.expected } };
    }

    case 'assertCount':
      return { assertCount: { css: cmd.css, expected: cmd.expected } };

    case 'assertEnabled':
      return { assertEnabled: cmd.selector };

    case 'assertDisabled':
      return { assertDisabled: cmd.selector };

    case 'assertChecked':
      return { assertChecked: cmd.selector };

    case 'assertUnchecked':
      return { assertUnchecked: cmd.selector };

    case 'pressKey':
      return { pressKey: cmd.key };

    case 'selectOption': {
      const sel = selectorToObject(cmd.selector);
      return { selectOption: { ...sel, value: cmd.value } };
    }

    case 'check':
      return { check: cmd.selector };

    case 'uncheck':
      return { uncheck: cmd.selector };

    case 'hover':
      return { hover: cmd.selector };

    case 'doubleClick':
      return { doubleClick: cmd.selector };

    case 'clearText':
      return { clearText: cmd.selector };

    case 'reload':
      return { reload: null };

    case 'goBack':
      return { goBack: null };

    case 'goForward':
      return { goForward: null };

    case 'setViewport':
      return { setViewport: { width: cmd.width, height: cmd.height } };

    case 'screenshot':
      return { screenshot: cmd.path };

    case 'waitFor':
      return { waitFor: cmd.ms };

    default: {
      const _exhaustive: never = cmd;
      throw new Error(`Unknown command type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export function startSession(outputPath: string, appId: string): void {
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, `appId: ${appId}\ncommands:\n`, 'utf8');
}

export function appendCommand(outputPath: string, cmd: Command): void {
  const record = commandToRecord(cmd);
  const fragment = yaml.dump(record, { lineWidth: -1 });
  const item = '- ' + fragment.trimEnd().split('\n').join('\n  ') + '\n';
  fs.appendFileSync(outputPath, item, 'utf8');
}
