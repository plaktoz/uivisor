/**
 * Shared positive-integer predicate (S9). Accepts an integer number > 0, or a
 * digit-only string (`/^\d+$/`, so "007" is 7) whose value is > 0. Everything
 * else returns `undefined`; each caller owns its error message.
 */
export function parsePositiveInt(raw: unknown): number | undefined {
  if (typeof raw === 'number') return Number.isInteger(raw) && raw > 0 ? raw : undefined;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) {
    const n = Number(raw);
    return n > 0 ? n : undefined;
  }
  return undefined;
}
