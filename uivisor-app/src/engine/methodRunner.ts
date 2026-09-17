import type { MethodRunner, WorkingScheduleEntry } from '@uivisor/core';
import {
  today,
  now,
  uuid,
  random,
  nearestWorkingDay,
  BUILTIN_NAMES,
} from '../builtins/index.js';

/** A callable user-defined function (sync or async). */
type UserFn = (...args: unknown[]) => unknown | Promise<unknown>;

/**
 * Async factory: load user JS files, validate no name conflicts,
 * and return a MethodRunner that dispatches to built-ins or user functions.
 *
 * Throws at creation time if:
 *  - a user function name matches a built-in name
 *  - two user files export the same function name
 */
export async function createMethodRunner(
  functionPaths: string[],
  workingSchedule: WorkingScheduleEntry[] | undefined,
  holidays: string[] | undefined,
): Promise<MethodRunner> {
  const userFunctions = new Map<string, UserFn>();
  const nameToFile = new Map<string, string>(); // for conflict reporting

  for (const filePath of functionPaths) {
    let mod: Record<string, unknown>;
    try {
      // Dynamic import; file must be an ES module
      mod = (await import(filePath)) as Record<string, unknown>;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to load function file "${filePath}": ${msg}`);
    }

    for (const [name, value] of Object.entries(mod)) {
      if (name === 'default') continue; // skip default export
      if (typeof value !== 'function') continue;

      // Check built-in conflict
      if (BUILTIN_NAMES.has(name)) {
        throw new Error(
          `Function name conflict: "${name}" is a built-in; user-defined functions must not shadow built-ins`,
        );
      }

      // Check duplicate across files
      if (nameToFile.has(name)) {
        throw new Error(
          `Duplicate function name "${name}" found in both "${nameToFile.get(name)}" and "${filePath}"`,
        );
      }

      userFunctions.set(name, value as UserFn);
      nameToFile.set(name, filePath);
    }
  }

  return {
    async call(name: string, resolvedArgs: unknown[]): Promise<string> {
      // Try built-ins first
      try {
        if (name === 'today') {
          return String(today(resolvedArgs[0] as string));
        }
        if (name === 'now') {
          return String(now(resolvedArgs[0] as string));
        }
        if (name === 'uuid') {
          return String(uuid());
        }
        if (name === 'random') {
          return String(random(resolvedArgs[0] as number));
        }
        if (name === 'nearestWorkingDay') {
          return String(nearestWorkingDay(resolvedArgs[0] as string, workingSchedule, holidays));
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`setVar failed: ${name}() threw: ${msg}`);
      }

      // Try user-defined functions
      const fn = userFunctions.get(name);
      if (!fn) {
        throw new Error(`Unknown method: "${name}"`);
      }

      try {
        const result = await Promise.resolve(fn(...resolvedArgs));
        return String(result);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`setVar failed: ${name}() threw: ${msg}`);
      }
    },
  };
}
