import type { VarMap } from '@uivisor/core';

/**
 * Create a layered VarMap seeded from a base record.
 *
 * - `get(name)` checks runtime layer, then base, then returns undefined.
 * - `set(name, value)` writes into the runtime layer (base is never mutated).
 * - `unset(name)` removes from runtime layer and marks the key as explicitly unset
 *   so it is hidden even if present in base.
 * - `toRecord()` returns a merged snapshot (base ← runtime, minus unset keys).
 */
export function createVarMap(base: Record<string, string>): VarMap {
  const runtimeMap = new Map<string, string>();
  const unsetKeys = new Set<string>();

  return {
    get(name: string): string | undefined {
      if (unsetKeys.has(name)) return undefined;
      if (runtimeMap.has(name)) return runtimeMap.get(name);
      return Object.prototype.hasOwnProperty.call(base, name) ? base[name] : undefined;
    },

    set(name: string, value: string): void {
      unsetKeys.delete(name);
      runtimeMap.set(name, value);
    },

    unset(name: string): void {
      runtimeMap.delete(name);
      unsetKeys.add(name);
    },

    toRecord(): Record<string, string> {
      // Start with a copy of base
      const result: Record<string, string> = { ...base };
      // Remove explicitly unset keys
      for (const key of unsetKeys) {
        delete result[key];
      }
      // Apply runtime overrides
      for (const [key, value] of runtimeMap) {
        result[key] = value;
      }
      return result;
    },
  };
}
