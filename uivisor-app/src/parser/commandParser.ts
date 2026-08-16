import type { Command } from '../types.js';
import { parseSelector } from './selectorParser.js';

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

    default:
      throw new Error(`Unknown command: ${key}`);
  }
}
