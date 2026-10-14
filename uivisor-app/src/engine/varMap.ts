import type { VarMap, VarScope } from '@uivisor/core';

const UNSET = Symbol('unset');

interface Frame {
  readonly overrides: Map<string, string | typeof UNSET>;
  readonly defaults: Map<string, string>;
}

/** Create a layered VarMap seeded from a base record. */
export function createVarMap(base: Record<string, string>): VarMap {
  const runtime = new Map<string, string>();
  const tombstones = new Set<string>();
  const frames: Frame[] = [];

  function ownerIndex(name: string): number {
    for (let i = frames.length - 1; i >= 0; i--) {
      if (frames[i]!.overrides.has(name)) return i;
    }
    return -1;
  }

  function admittedDefault(name: string, fromFrame: number): string | undefined {
    for (let i = fromFrame; i < frames.length; i++) {
      const value = frames[i]!.defaults.get(name);
      if (value !== undefined) return value;
    }
    return undefined;
  }

  function get(name: string): string | undefined {
    const owner = ownerIndex(name);
    if (owner >= 0) {
      const binding = frames[owner]!.overrides.get(name)!;
      return binding !== UNSET ? binding : admittedDefault(name, owner + 1);
    }
    return (
      runtime.get(name) ??
      admittedDefault(name, 0) ??
      (tombstones.has(name) || !Object.hasOwn(base, name) ? undefined : base[name])
    );
  }

  return {
    get,

    set(name: string, value: string): void {
      const owner = ownerIndex(name);
      if (owner >= 0) {
        frames[owner]!.overrides.set(name, value);
        return;
      }
      tombstones.delete(name);
      runtime.set(name, value);
    },

    unset(name: string): void {
      const owner = ownerIndex(name);
      if (owner >= 0) {
        frames[owner]!.overrides.set(name, UNSET);
      } else {
        runtime.delete(name);
        tombstones.add(name);
      }
      for (let i = owner + 1; i < frames.length; i++) {
        frames[i]!.defaults.delete(name);
      }
    },

    toRecord(): Record<string, string> {
      const names = new Set([...Object.keys(base), ...runtime.keys()]);
      for (const frame of frames) {
        for (const name of frame.overrides.keys()) names.add(name);
        for (const name of frame.defaults.keys()) names.add(name);
      }
      const result: Record<string, string> = {};
      for (const name of names) {
        const value = get(name);
        if (value !== undefined) result[name] = value;
      }
      return result;
    },

    async withScope<T>(scope: VarScope, run: () => Promise<T>): Promise<T> {
      const admitted = new Map<string, string>();
      for (const [name, value] of Object.entries(scope.defaults)) {
        if (!Object.hasOwn(scope.overrides, name) && get(name) === undefined) {
          admitted.set(name, value);
        }
      }
      const depth = frames.length;
      frames.push({ overrides: new Map(Object.entries(scope.overrides)), defaults: admitted });
      try {
        return await run();
      } finally {
        frames.length = depth;
      }
    },
  };
}
