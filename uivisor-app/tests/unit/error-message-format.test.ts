/**
 * tests/unit/error-message-format.test.ts
 *
 * Tests for error message formatting in dispatcher (T15 — 8 tests).
 * Written before T8 implementation (TDD).
 */

import { describe, it, expect, vi } from 'vitest';
import type { Page } from 'playwright';
import type { RunContext, Command } from '@uivisor/core';
import { dispatch } from '../../src/engine/dispatcher';
import { createVarMap } from '../../src/engine/varMap';

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
  return {
    lastTappedLocator: null,
    callStack: new Set(),
    indentLevel: 0,
    runDir: '/tmp',
    sessions: new Map(),
    defaultSessionId: '__default__',
    varMap: createVarMap(vars),
    methodRunner: { call: async () => { throw new Error('not impl'); } },
  };
}

describe('error message format: interpolation failures', () => {
  it('undefined var with no default produces a clear error message containing the var name', async () => {
    const ctx = makeCtx({});
    const result = await dispatch(
      makePage(),
      { type: 'goto', url: '${undeclaredVar}' },
      ctx,
    );
    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/undeclaredVar/);
  });

  it('testVarSet fails with message naming the missing variable', async () => {
    const ctx = makeCtx();
    const result = await dispatch(
      makePage(),
      { type: 'testVarSet', name: 'notSet' } as Command,
      ctx,
    );
    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/notSet/);
  });

  it('testVarSet equality fails with Expected/Got in message', async () => {
    const ctx = makeCtx();
    ctx.varMap.set('x', '5');
    const result = await dispatch(
      makePage(),
      { type: 'testVarSet', name: 'x', expected: '99' } as Command,
      ctx,
    );
    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/5|99/);
  });
});

describe('error message format: method call failures', () => {
  it('method failure message contains "setVar failed:"', async () => {
    const ctx = makeCtx();
    ctx.methodRunner = {
      call: vi.fn().mockRejectedValue(
        new Error('setVar failed: myMethod() threw: something went wrong'),
      ) as unknown as typeof ctx.methodRunner.call,
    };
    const result = await dispatch(
      makePage(),
      { type: 'setVar', name: 'x', method: 'myMethod', args: [] } as Command,
      ctx,
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain('setVar failed:');
  });

  it('method failure message contains the method name', async () => {
    const ctx = makeCtx();
    ctx.methodRunner = {
      call: vi.fn().mockRejectedValue(
        new Error('setVar failed: specificMethod() threw: error here'),
      ) as unknown as typeof ctx.methodRunner.call,
    };
    const result = await dispatch(
      makePage(),
      { type: 'setVar', name: 'x', method: 'specificMethod', args: [] } as Command,
      ctx,
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain('specificMethod');
  });

  it('method failure message contains the underlying error', async () => {
    const ctx = makeCtx();
    ctx.methodRunner = {
      call: vi.fn().mockRejectedValue(
        new Error('setVar failed: fn() threw: underlying cause here'),
      ) as unknown as typeof ctx.methodRunner.call,
    };
    const result = await dispatch(
      makePage(),
      { type: 'setVar', name: 'x', method: 'fn', args: [] } as Command,
      ctx,
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain('underlying cause here');
  });
});

describe('error message format: arg parsing', () => {
  it('numeric arg is passed as number to methodRunner', async () => {
    const ctx = makeCtx();
    const callFn = vi.fn().mockResolvedValue('123456');
    ctx.methodRunner = { call: callFn as unknown as typeof ctx.methodRunner.call };
    await dispatch(
      makePage(),
      { type: 'setVar', name: 'code', method: 'random', args: ['6'] } as Command,
      ctx,
    );
    expect(callFn).toHaveBeenCalledWith('random', [6]);
  });

  it('string literal arg has quotes stripped before passing to methodRunner', async () => {
    const ctx = makeCtx();
    const callFn = vi.fn().mockResolvedValue('20261001');
    ctx.methodRunner = { call: callFn as unknown as typeof ctx.methodRunner.call };
    await dispatch(
      makePage(),
      { type: 'setVar', name: 'd', method: 'today', args: ["'YYYYMMDD'"] } as Command,
      ctx,
    );
    expect(callFn).toHaveBeenCalledWith('today', ['YYYYMMDD']);
  });
});
