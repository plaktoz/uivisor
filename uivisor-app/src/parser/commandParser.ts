import { type Command, type SessionedCommand, parseSelector } from '@uivisor/core';

const SCROLL_DIRECTIONS = new Set(['up', 'down', 'left', 'right']);

export function parseCommand(raw: unknown): Command {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`Invalid command: ${String(raw)}`);
  }
  const obj = raw as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) throw new Error('Empty command object');
  const key = keys[0] as string;
  const value = obj[key];

  switch (key) {
    case 'goto':
      return { type: 'goto', url: value as string };

    case 'tapOn':
      return { type: 'tapOn', selector: parseSelector(value) };

    case 'inputText': {
      if (typeof value === 'string') {
        return { type: 'inputText', text: value };
      }
      if (typeof value === 'object' && value !== null && 'element' in (value as object)) {
        const v = value as { element: unknown; text: string };
        return { type: 'inputTextTargeted', element: parseSelector(v.element), text: v.text };
      }
      return { type: 'inputText', text: String(value) };
    }

    case 'assertVisible':
      return { type: 'assertVisible', selector: parseSelector(value) };

    case 'assertNotVisible':
      return { type: 'assertNotVisible', selector: parseSelector(value) };

    case 'assertUrl':
      return { type: 'assertUrl', path: value as string };

    case 'wait': {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        throw new Error(`Type error: wait value must be an integer, got ${String(value)}`);
      }
      return { type: 'wait', ms: value };
    }

    case 'runFlow':
      return { type: 'runFlow', path: value as string };

    case 'scroll': {
      if (!SCROLL_DIRECTIONS.has(value as string)) {
        throw new Error(`Invalid scroll direction: ${String(value)}`);
      }
      return { type: 'scroll', direction: value as 'up' | 'down' | 'left' | 'right' };
    }

    case 'assertText': {
      const v = value as Record<string, unknown>;
      const expected = v['expected'] as string;
      const { expected: _e, ...selectorRaw } = v;
      return { type: 'assertText', selector: parseSelector(selectorRaw), expected };
    }
    case 'assertValue': {
      const v = value as Record<string, unknown>;
      const expected = v['expected'] as string;
      const { expected: _e, ...selectorRaw } = v;
      return { type: 'assertValue', selector: parseSelector(selectorRaw), expected };
    }
    case 'assertCount': {
      const v = value as { css: string; expected: number };
      if (!Number.isInteger(v.expected)) {
        throw new Error(`assertCount expected must be an integer, got ${String(v.expected)}`);
      }
      return { type: 'assertCount', css: v.css, expected: v.expected };
    }
    case 'assertEnabled':
      return { type: 'assertEnabled', selector: parseSelector(value) };
    case 'assertDisabled':
      return { type: 'assertDisabled', selector: parseSelector(value) };
    case 'assertChecked':
      return { type: 'assertChecked', selector: parseSelector(value) };
    case 'assertUnchecked':
      return { type: 'assertUnchecked', selector: parseSelector(value) };

    case 'pressKey':
      return { type: 'pressKey', key: value as string };

    case 'selectOption': {
      const v = value as Record<string, unknown>;
      const val = v['value'] as string;
      const { value: _v, ...selectorRaw } = v;
      return { type: 'selectOption', selector: parseSelector(selectorRaw), value: val };
    }

    case 'check':
      return { type: 'check', selector: parseSelector(value) };
    case 'uncheck':
      return { type: 'uncheck', selector: parseSelector(value) };
    case 'hover':
      return { type: 'hover', selector: parseSelector(value) };
    case 'doubleClick':
      return { type: 'doubleClick', selector: parseSelector(value) };
    case 'clearText':
      return { type: 'clearText', selector: parseSelector(value) };

    case 'reload':
      return { type: 'reload' };
    case 'goBack':
      return { type: 'goBack' };
    case 'goForward':
      return { type: 'goForward' };

    case 'setViewport': {
      const PRESETS: Record<string, { width: number; height: number }> = {
        mobile:  { width: 390,  height: 844  },
        tablet:  { width: 768,  height: 1024 },
        desktop: { width: 1280, height: 800  },
      };
      if (typeof value === 'string') {
        const preset = PRESETS[value];
        if (!preset) {
          throw new Error(`Unknown viewport preset: ${value}. Valid presets: mobile, tablet, desktop`);
        }
        return { type: 'setViewport', width: preset.width, height: preset.height };
      }
      const v = value as { width: number; height: number };
      if (!Number.isInteger(v.width) || !Number.isInteger(v.height) || v.width <= 0 || v.height <= 0) {
        throw new Error('setViewport width and height must be positive integers');
      }
      return { type: 'setViewport', width: v.width, height: v.height };
    }

    case 'screenshot':
      return { type: 'screenshot', path: value as string };

    case 'waitFor': {
      if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
        throw new Error(`waitFor ms must be a positive integer, got ${String(value)}`);
      }
      return { type: 'waitFor', ms: value };
    }

    case 'within': {
      if (typeof value !== 'object' || value === null) {
        throw new Error(`within value must be an object with a selector key and a do array`);
      }
      const withinObj = value as Record<string, unknown>;

      // Extract required `do` array
      if (!('do' in withinObj)) {
        throw new Error(`within: missing required 'do' key`);
      }
      const doRaw = withinObj['do'];
      if (!Array.isArray(doRaw)) {
        throw new Error(`within: 'do' must be an array of commands`);
      }
      const doCommands = doRaw.map((item) => parseSessionedCommand(item));

      // Extract optional `nth`
      let nth: number | undefined;
      if ('nth' in withinObj) {
        const rawNth = withinObj['nth'];
        if (typeof rawNth !== 'number' || !Number.isInteger(rawNth)) {
          throw new Error(`within: nth must be an integer, got ${String(rawNth)}`);
        }
        nth = rawNth;
      }

      // Build selector from remaining key(s) (exclude 'do' and 'nth')
      const selectorKeys = Object.keys(withinObj).filter((k) => k !== 'do' && k !== 'nth');
      if (selectorKeys.length === 0) {
        throw new Error(`within: missing selector key (e.g. text: Alice)`);
      }
      if (selectorKeys.length > 1) {
        throw new Error(
          `within: multiple selector keys are not allowed: ${selectorKeys.join(', ')}. ` +
          `Use a single key (e.g. text: Alice) or pipe syntax via a selector string.`,
        );
      }
      const selAttr = selectorKeys[0] as string;
      const selValue = withinObj[selAttr];
      const selector = `${selAttr}=${String(selValue)}`;

      return { type: 'within', selector, nth, do: doCommands };
    }

    default:
      throw new Error(`Unknown command: ${key}`);
  }
}

export function parseSessionedCommand(raw: unknown): SessionedCommand {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`Invalid command: ${String(raw)}`);
  }
  const obj = raw as Record<string, unknown>;
  // Extract session field before passing to parseCommand (parseCommand throws on unknown keys)
  const session = typeof obj['session'] === 'string' ? obj['session'] : undefined;
  const { session: _session, ...rest } = obj;
  const command = parseCommand(rest);
  return session !== undefined ? { session, command } : { command };
}
