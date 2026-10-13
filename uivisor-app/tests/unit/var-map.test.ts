/**
 * tests/unit/var-map.test.ts
 *
 * Unit tests for the VarMap factory (T11 — 14 tests).
 * Written before implementing varMap.ts (TDD).
 */

import { describe, it, expect } from 'vitest';
import type { VarMap } from '@uivisor/core';
import { createVarMap } from '../../src/engine/varMap';

describe('createVarMap', () => {
  it('returns a VarMap; get returns undefined when base is empty', () => {
    const vm = createVarMap({});
    expect(vm.get('anything')).toBeUndefined();
  });

  it('get returns undefined for absent key even when base has other keys', () => {
    const vm = createVarMap({ a: '1' });
    expect(vm.get('missing')).toBeUndefined();
  });

  it('get returns base value for key present in base', () => {
    const vm = createVarMap({ greeting: 'hello' });
    expect(vm.get('greeting')).toBe('hello');
  });

  it('set stores a new value and get returns it', () => {
    const vm = createVarMap({});
    vm.set('key', 'value');
    expect(vm.get('key')).toBe('value');
  });

  it('set overrides a base value', () => {
    const vm = createVarMap({ key: 'original' });
    vm.set('key', 'updated');
    expect(vm.get('key')).toBe('updated');
  });

  it('unset removes a runtime-set value; get returns undefined', () => {
    const vm = createVarMap({});
    vm.set('key', 'value');
    vm.unset('key');
    expect(vm.get('key')).toBeUndefined();
  });

  it('unset on absent key is a no-op (does not throw)', () => {
    const vm = createVarMap({});
    expect(() => vm.unset('nonexistent')).not.toThrow();
  });

  it('unset on a base key causes get to return undefined', () => {
    const vm = createVarMap({ baseKey: 'fromBase' });
    vm.unset('baseKey');
    expect(vm.get('baseKey')).toBeUndefined();
  });

  it('toRecord returns all base entries when nothing is overridden', () => {
    const vm = createVarMap({ a: '1', b: '2' });
    expect(vm.toRecord()).toEqual({ a: '1', b: '2' });
  });

  it('toRecord runtime entries override base entries', () => {
    const vm = createVarMap({ a: '1', b: '2' });
    vm.set('a', 'overridden');
    expect(vm.toRecord()).toEqual({ a: 'overridden', b: '2' });
  });

  it('toRecord excludes unset keys (base and runtime)', () => {
    const vm = createVarMap({ a: '1', b: '2' });
    vm.unset('a');
    expect(vm.toRecord()).toEqual({ b: '2' });
  });

  it('does not mutate the base record when set is called', () => {
    const base = { a: '1' };
    const vm = createVarMap(base);
    vm.set('a', 'new');
    expect(base.a).toBe('1');
  });

  it('get returns undefined after set then unset', () => {
    const vm = createVarMap({});
    vm.set('x', 'val');
    vm.unset('x');
    expect(vm.get('x')).toBeUndefined();
  });

  it('toRecord returns a snapshot (mutations to result do not affect vm)', () => {
    const vm = createVarMap({ a: '1' });
    const r1 = vm.toRecord();
    r1['a'] = 'mutated';
    const r2 = vm.toRecord();
    expect(r2['a']).toBe('1');
  });
});

function expectView(vm: VarMap, expected: Record<string, string | undefined>): void {
  const record = vm.toRecord();
  for (const [name, value] of Object.entries(expected)) {
    expect(vm.get(name), `get("${name}")`).toBe(value);
    expect(Object.hasOwn(record, name), `toRecord() has "${name}"`).toBe(value !== undefined);
    expect(record[name], `toRecord()["${name}"]`).toBe(value);
  }
}

const overrides = (o: Record<string, string>) => ({ overrides: o, defaults: {} });
const defaults = (d: Record<string, string>) => ({ overrides: {}, defaults: d });

describe('createVarMap withScope', () => {
  it('returns the value of run', async () => {
    const vm = createVarMap({});
    await expect(vm.withScope(overrides({}), async () => 42)).resolves.toBe(42);
  });

  it('an override shadows the caller value inside the scope and the caller value returns after', async () => {
    const vm = createVarMap({ u: 'A' });
    await vm.withScope(overrides({ u: 'B' }), async () => expectView(vm, { u: 'B' }));
    expectView(vm, { u: 'A' });
  });

  it('an override of an absent name leaves nothing behind', async () => {
    const vm = createVarMap({});
    await vm.withScope(overrides({ u: 'B' }), async () => expectView(vm, { u: 'B' }));
    expectView(vm, { u: undefined });
  });

  it('an override of a runtime value restores the runtime value', async () => {
    const vm = createVarMap({ u: 'base' });
    vm.set('u', 'runtime');
    await vm.withScope(overrides({ u: 'B' }), async () => expectView(vm, { u: 'B' }));
    expectView(vm, { u: 'runtime' });
  });

  it('a default fills in an absent name and is removed after', async () => {
    const vm = createVarMap({});
    await vm.withScope(defaults({ t: '5' }), async () => expectView(vm, { t: '5' }));
    expectView(vm, { t: undefined });
  });

  it.each([
    ['a base value', { t: 'caller' }, undefined, 'caller'],
    ['an empty base value', { t: '' }, undefined, ''],
    ['a runtime value', {}, 'caller', 'caller'],
    ['an empty runtime value', {}, '', ''],
  ])('a default does not replace %s', async (_label, base, runtime, expected) => {
    const vm = createVarMap(base);
    if (runtime !== undefined) vm.set('t', runtime);
    await vm.withScope(defaults({ t: 'child' }), async () => expectView(vm, { t: expected }));
    expectView(vm, { t: expected });
  });

  it('an override of the same scope beats that scope default', async () => {
    const vm = createVarMap({});
    await vm.withScope({ overrides: { t: 'o' }, defaults: { t: 'd' } }, async () => expectView(vm, { t: 'o' }));
    expectView(vm, { t: undefined });
  });

  it('set of a scoped override is discarded on return', async () => {
    const vm = createVarMap({});
    vm.set('u', 'A');
    await vm.withScope(overrides({ u: 'B' }), async () => {
      vm.set('u', 'C');
      expectView(vm, { u: 'C' });
    });
    expectView(vm, { u: 'A' });
  });

  it('set of a fresh name survives the return', async () => {
    const vm = createVarMap({});
    await vm.withScope(overrides({ u: 'B' }), async () => vm.set('fresh', 'v'));
    expectView(vm, { fresh: 'v', u: undefined });
  });

  it('set of a name that arrived as a default survives the return', async () => {
    const vm = createVarMap({});
    await vm.withScope(defaults({ t: '5' }), async () => {
      vm.set('t', '9');
      expectView(vm, { t: '9' });
    });
    expectView(vm, { t: '9' });
  });

  it('nested overrides of the same name unwind in order', async () => {
    const vm = createVarMap({ x: 'orig' });
    await vm.withScope(overrides({ x: '1' }), async () => {
      await vm.withScope(overrides({ x: '2' }), async () => expectView(vm, { x: '2' }));
      expectView(vm, { x: '1' });
    });
    expectView(vm, { x: 'orig' });
  });

  it('set inside a nested scope of a name overridden by an outer scope lands in the outer scope', async () => {
    const vm = createVarMap({ x: 'orig' });
    await vm.withScope(overrides({ x: '1' }), async () => {
      await vm.withScope(overrides({ y: 'b' }), async () => vm.set('x', '7'));
      expectView(vm, { x: '7', y: undefined });
    });
    expectView(vm, { x: 'orig' });
  });

  it('a default fills in a name the caller unset, and the name stays unset after', async () => {
    const vm = createVarMap({ k: 'base' });
    vm.unset('k');
    await vm.withScope(defaults({ k: 'd' }), async () => expectView(vm, { k: 'd' }));
    expectView(vm, { k: undefined });
  });

  it('unset of a scoped override hides it for the rest of the call and the caller value returns after', async () => {
    const vm = createVarMap({ u: 'A' });
    await vm.withScope({ overrides: { u: 'B' }, defaults: { u: 'd' } }, async () => {
      vm.unset('u');
      expectView(vm, { u: undefined });
    });
    expectView(vm, { u: 'A' });
  });

  it('unset of an admitted default hides it for the rest of the call and after', async () => {
    const vm = createVarMap({});
    await vm.withScope(defaults({ t: '5' }), async () => {
      vm.unset('t');
      expectView(vm, { t: undefined });
    });
    expectView(vm, { t: undefined });
  });

  it('an outer child default outranks an inner child default', async () => {
    const vm = createVarMap({});
    await vm.withScope(defaults({ t: 'A' }), async () => {
      await vm.withScope(defaults({ t: 'B' }), async () => expectView(vm, { t: 'A' }));
    });
    expectView(vm, { t: undefined });
  });

  it('an outer unset override does not hide an inner child default', async () => {
    const vm = createVarMap({ x: 'p' });
    await vm.withScope(overrides({ x: 'o' }), async () => {
      vm.unset('x');
      await vm.withScope(defaults({ x: 'd' }), async () => {
        expectView(vm, { x: 'd' });
        vm.unset('x');
        expectView(vm, { x: undefined });
      });
      expectView(vm, { x: undefined });
    });
    expectView(vm, { x: 'p' });
  });

  it('closes the scope when run throws', async () => {
    const vm = createVarMap({ u: 'A' });
    await expect(
      vm.withScope({ overrides: { u: 'B' }, defaults: { t: '5' } }, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expectView(vm, { u: 'A', t: undefined });
  });

  it('two sequential scopes each see their own override and leave the map unchanged', async () => {
    const vm = createVarMap({ keep: 'k' });
    const seen: (string | undefined)[] = [];
    await vm.withScope(overrides({ x: 'a' }), async () => void seen.push(vm.get('x')));
    expect(vm.toRecord()).toEqual({ keep: 'k' });
    await vm.withScope(overrides({ x: 'b' }), async () => void seen.push(vm.get('x')));
    expect(vm.toRecord()).toEqual({ keep: 'k' });
    expect(seen).toEqual(['a', 'b']);
  });

  it('toRecord agrees with get for every name across randomised layer states', async () => {
    const names = ['a', 'b', 'c', 'd'];
    const values = ['', '1', '2'];
    let seed = 0x5eed;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    const pick = <T>(xs: readonly T[]): T => xs[rand(xs.length)]!;
    const randomRecord = () =>
      Object.fromEntries(names.filter(() => rand(3) === 0).map((n) => [n, pick(values)]));

    let checks = 0;
    const checkInvariant = (vm: VarMap) => {
      const record = vm.toRecord();
      for (const name of names) {
        expect(record[name]).toBe(vm.get(name));
        expect(Object.hasOwn(record, name)).toBe(vm.get(name) !== undefined);
      }
      checks++;
    };

    const walk = async (vm: VarMap, depth: number): Promise<void> => {
      for (let step = 0; step < 6; step++) {
        const op = rand(depth < 3 ? 4 : 3);
        if (op === 0) vm.set(pick(names), pick(values));
        else if (op === 1) vm.unset(pick(names));
        else if (op === 2) checkInvariant(vm);
        else await vm.withScope({ overrides: randomRecord(), defaults: randomRecord() }, () => walk(vm, depth + 1));
        checkInvariant(vm);
      }
    };

    for (let run = 0; run < 200; run++) {
      const vm = createVarMap(randomRecord());
      await walk(vm, 0);
    }
    expect(checks).toBeGreaterThan(1000);
  });
});
