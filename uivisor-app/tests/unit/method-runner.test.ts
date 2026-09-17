/**
 * tests/unit/method-runner.test.ts
 *
 * Unit tests for createMethodRunner (T13 — 12 tests).
 * Written before implementing methodRunner.ts (TDD).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createMethodRunner } from '../../src/engine/methodRunner';
import type { WorkingScheduleEntry } from '@uivisor/core';

// ─── Temp file helpers ─────────────────────────────────────────────────────────

const TMP_DIR = os.tmpdir();

function writeTmpModule(name: string, content: string): string {
  const filePath = path.join(TMP_DIR, `uivisor-test-${name}-${Date.now()}.mjs`);
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

let helperFileA: string;
let helperFileB: string;
let helperFileDupA: string;
let helperFileDupB: string;
let helperFileBuiltin: string;

beforeAll(() => {
  helperFileA = writeTmpModule('helper-a', `
export function greet(name) { return 'hello ' + name; }
export async function asyncFn(x) { return Promise.resolve('async-' + x); }
export function throwing() { throw new Error('oops from user fn'); }
`);

  helperFileB = writeTmpModule('helper-b', `
export function otherFn() { return 'from-b'; }
`);

  helperFileDupA = writeTmpModule('dup-a', `
export function dupName() { return 'a'; }
`);

  helperFileDupB = writeTmpModule('dup-b', `
export function dupName() { return 'b'; }
`);

  helperFileBuiltin = writeTmpModule('builtin-conflict', `
export function uuid() { return 'fake-uuid'; }
`);
});

afterAll(() => {
  for (const f of [helperFileA, helperFileB, helperFileDupA, helperFileDupB, helperFileBuiltin]) {
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createMethodRunner', () => {
  it('creates a runner with no function files', async () => {
    const runner = await createMethodRunner([], undefined, undefined);
    expect(runner).toBeDefined();
    expect(typeof runner.call).toBe('function');
  });

  it('call dispatches to built-in uuid()', async () => {
    const runner = await createMethodRunner([], undefined, undefined);
    const result = await runner.call('uuid', []);
    expect(result).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('call dispatches to built-in today()', async () => {
    const runner = await createMethodRunner([], undefined, undefined);
    const result = await runner.call('today', ['YYYYMMDD']);
    expect(result).toMatch(/^\d{8}$/);
  });

  it('call dispatches to built-in random()', async () => {
    const runner = await createMethodRunner([], undefined, undefined);
    const result = await runner.call('random', [6]);
    expect(result).toHaveLength(6);
    expect(result).toMatch(/^\d{6}$/);
  });

  it('call throws on unknown method name', async () => {
    const runner = await createMethodRunner([], undefined, undefined);
    await expect(runner.call('unknownMethod', [])).rejects.toThrow(/unknownMethod/);
  });

  it('user function name that conflicts with built-in throws at creation time', async () => {
    await expect(
      createMethodRunner([helperFileBuiltin], undefined, undefined),
    ).rejects.toThrow(/uuid.*built-in|built-in.*uuid|conflict/i);
  });

  it('duplicate function name across files throws at creation time', async () => {
    await expect(
      createMethodRunner([helperFileDupA, helperFileDupB], undefined, undefined),
    ).rejects.toThrow(/dupName.*duplicate|duplicate.*dupName/i);
  });

  it('call dispatches to a user-defined synchronous function', async () => {
    const runner = await createMethodRunner([helperFileA], undefined, undefined);
    const result = await runner.call('greet', ['world']);
    expect(result).toBe('hello world');
  });

  it('call dispatches to a user-defined async function', async () => {
    const runner = await createMethodRunner([helperFileA], undefined, undefined);
    const result = await runner.call('asyncFn', ['42']);
    expect(result).toBe('async-42');
  });

  it('method that throws surfaces error as "setVar failed: name() threw: msg"', async () => {
    const runner = await createMethodRunner([helperFileA], undefined, undefined);
    await expect(runner.call('throwing', [])).rejects.toThrow(
      /setVar failed: throwing\(\) threw: oops from user fn/,
    );
  });

  it('call passes multiple args correctly', async () => {
    const runner = await createMethodRunner([helperFileA], undefined, undefined);
    // greet takes one arg, but test that args array is forwarded
    const result = await runner.call('greet', ['Alice']);
    expect(result).toBe('hello Alice');
  });

  it('call with no args works for uuid()', async () => {
    const runner = await createMethodRunner([], undefined, undefined);
    const result = await runner.call('uuid', []);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
