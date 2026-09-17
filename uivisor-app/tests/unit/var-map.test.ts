/**
 * tests/unit/var-map.test.ts
 *
 * Unit tests for the VarMap factory (T11 — 14 tests).
 * Written before implementing varMap.ts (TDD).
 */

import { describe, it, expect } from 'vitest';
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
