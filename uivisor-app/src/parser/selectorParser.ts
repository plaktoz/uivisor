import type { Selector } from '../types.js';

export function parseSelector(raw: unknown): Selector {
  if (typeof raw === 'string') {
    return raw;
  }
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if ('text' in obj) return { text: obj['text'] as string };
    if ('role' in obj && 'name' in obj) return { role: obj['role'] as string, name: obj['name'] as string };
    if ('label' in obj) return { label: obj['label'] as string };
    if ('placeholder' in obj) return { placeholder: obj['placeholder'] as string };
    if ('testId' in obj) return { testId: obj['testId'] as string };
    const key = Object.keys(obj)[0] ?? 'unknown';
    throw new Error(`Unrecognized selector type: ${key}`);
  }
  throw new Error(`Unrecognized selector type: ${String(raw)}`);
}
