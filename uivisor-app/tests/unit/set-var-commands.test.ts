/**
 * tests/unit/set-var-commands.test.ts
 *
 * Dispatcher unit tests for setVar / testVarSet / unsetVar (T15 — 14 tests).
 * Written before T8/T9 implementation (TDD).
 */

import { describe, it, expect, vi } from 'vitest';
import type { Page } from 'playwright';
import type { RunContext, Command } from '@uivisor/core';
import { dispatch } from '../../src/engine/dispatcher';
import { createVarMap } from '../../src/engine/varMap';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePage(): Page {
  return {
    goto: vi.fn().mockResolvedValue(null),
    url: vi.fn().mockReturnValue('http://test/'),
    locator: vi.fn().mockReturnValue({ waitFor: vi.fn(), click: vi.fn() }),
    getByText: vi.fn().mockReturnValue({ waitFor: vi.fn(), click: vi.fn() }),
    getByRole: vi.fn().mockReturnValue({ waitFor: vi.fn(), click: vi.fn() }),
    getByLabel: vi.fn().mockReturnValue({ waitFor: vi.fn(), click: vi.fn() }),
    getByPlaceholder: vi.fn().mockReturnValue({ waitFor: vi.fn(), click: vi.fn() }),
    getByTestId: vi.fn().mockReturnValue({ waitFor: vi.fn(), click: vi.fn() }),
    evaluate: vi.fn().mockResolvedValue(undefined),
    keyboard: { press: vi.fn().mockResolvedValue(undefined) },
    reload: vi.fn().mockResolvedValue(null),
    goBack: vi.fn().mockResolvedValue(null),
    goForward: vi.fn().mockResolvedValue(null),
    setViewportSize: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('')),
    waitForURL: vi.fn().mockResolvedValue(undefined),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
  } as unknown as Page;
}

function makeCtx(vars: Record<string, string> = {}): RunContext {
  const varMap = createVarMap(vars);
  const methodRunner = {
    call: async (_name: string, _args: unknown[]): Promise<string> => {
      throw new Error('not implemented');
    },
  };
  return {
    lastTappedLocator: null,
    callStack: new Set(),
    indentLevel: 0,
    runDir: '/tmp',
    sessions: new Map(),
    defaultSessionId: '__default__',
    varMap,
    methodRunner,
  };
}

// ─── setVar — static form ─────────────────────────────────────────────────────

describe('setVar — static form', () => {
  it('stores the value in ctx.varMap', async () => {
    const ctx = makeCtx();
    const cmd: Command = { type: 'setVar', name: 'myVar', value: 'hello' };
    const result = await dispatch(makePage(), cmd, ctx);
    expect(result.passed).toBe(true);
    expect(ctx.varMap.get('myVar')).toBe('hello');
  });

  it('interpolates ${...} in value before storing', async () => {
    const ctx = makeCtx({ greeting: 'world' });
    const cmd: Command = { type: 'setVar', name: 'msg', value: 'hello ${greeting}' };
    const result = await dispatch(makePage(), cmd, ctx);
    expect(result.passed).toBe(true);
    expect(ctx.varMap.get('msg')).toBe('hello world');
  });

  it('overrides an existing variable', async () => {
    const ctx = makeCtx({ num: '1' });
    ctx.varMap.set('num', '1');
    const cmd: Command = { type: 'setVar', name: 'num', value: '2' };
    await dispatch(makePage(), cmd, ctx);
    expect(ctx.varMap.get('num')).toBe('2');
  });
});

// ─── setVar — method form ─────────────────────────────────────────────────────

describe('setVar — method form', () => {
  it('calls methodRunner and stores the result', async () => {
    const ctx = makeCtx();
    ctx.methodRunner = {
      call: vi.fn().mockResolvedValue('generated-uuid') as unknown as typeof ctx.methodRunner.call,
    };
    const cmd: Command = { type: 'setVar', name: 'id', method: 'uuid', args: [] };
    const result = await dispatch(makePage(), cmd, ctx);
    expect(result.passed).toBe(true);
    expect(ctx.varMap.get('id')).toBe('generated-uuid');
  });

  it('passes processed args to methodRunner', async () => {
    const ctx = makeCtx();
    const callFn = vi.fn().mockResolvedValue('20261001');
    ctx.methodRunner = { call: callFn as unknown as typeof ctx.methodRunner.call };
    const cmd: Command = { type: 'setVar', name: 'date', method: 'today', args: ["'YYYYMMDD'"] };
    const result = await dispatch(makePage(), cmd, ctx);
    expect(result.passed).toBe(true);
    // Quotes stripped from string arg
    expect(callFn).toHaveBeenCalledWith('today', ['YYYYMMDD']);
  });

  it('returns passed: false if methodRunner throws', async () => {
    const ctx = makeCtx();
    ctx.methodRunner = {
      call: vi.fn().mockRejectedValue(new Error('setVar failed: boom() threw: oops')) as unknown as typeof ctx.methodRunner.call,
    };
    const cmd: Command = { type: 'setVar', name: 'x', method: 'boom', args: [] };
    const result = await dispatch(makePage(), cmd, ctx);
    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/setVar failed.*boom.*oops/);
  });
});

// ─── testVarSet — existence form ─────────────────────────────────────────────

describe('testVarSet — existence form', () => {
  it('passes when the variable exists and is non-empty', async () => {
    const ctx = makeCtx();
    ctx.varMap.set('userId', 'abc-123');
    const cmd: Command = { type: 'testVarSet', name: 'userId' };
    const result = await dispatch(makePage(), cmd, ctx);
    expect(result.passed).toBe(true);
  });

  it('fails when the variable is absent', async () => {
    const ctx = makeCtx();
    const cmd: Command = { type: 'testVarSet', name: 'missing' };
    const result = await dispatch(makePage(), cmd, ctx);
    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/missing|not.*set|undefined/i);
  });

  it('fails when the variable exists but is empty string', async () => {
    const ctx = makeCtx();
    ctx.varMap.set('emptyVar', '');
    const cmd: Command = { type: 'testVarSet', name: 'emptyVar' };
    const result = await dispatch(makePage(), cmd, ctx);
    expect(result.passed).toBe(false);
  });
});

// ─── testVarSet — equality form ───────────────────────────────────────────────

describe('testVarSet — equality form', () => {
  it('passes when variable equals expected', async () => {
    const ctx = makeCtx();
    ctx.varMap.set('num', '5');
    const cmd: Command = { type: 'testVarSet', name: 'num', expected: '5' };
    const result = await dispatch(makePage(), cmd, ctx);
    expect(result.passed).toBe(true);
  });

  it('fails when variable does not equal expected', async () => {
    const ctx = makeCtx();
    ctx.varMap.set('num', '5');
    const cmd: Command = { type: 'testVarSet', name: 'num', expected: '6' };
    const result = await dispatch(makePage(), cmd, ctx);
    expect(result.passed).toBe(false);
  });

  it('fails when variable is absent in equality form', async () => {
    const ctx = makeCtx();
    const cmd: Command = { type: 'testVarSet', name: 'absent', expected: 'val' };
    const result = await dispatch(makePage(), cmd, ctx);
    expect(result.passed).toBe(false);
  });
});

// ─── unsetVar ────────────────────────────────────────────────────────────────

describe('unsetVar', () => {
  it('removes a variable from varMap', async () => {
    const ctx = makeCtx();
    ctx.varMap.set('toRemove', 'value');
    const cmd: Command = { type: 'unsetVar', name: 'toRemove' };
    const result = await dispatch(makePage(), cmd, ctx);
    expect(result.passed).toBe(true);
    expect(ctx.varMap.get('toRemove')).toBeUndefined();
  });

  it('is a no-op (passes) when variable does not exist', async () => {
    const ctx = makeCtx();
    const cmd: Command = { type: 'unsetVar', name: 'nonexistent' };
    const result = await dispatch(makePage(), cmd, ctx);
    expect(result.passed).toBe(true);
  });
});
