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
      makePage(), { command: { type: 'goto', url: '${undeclaredVar}' } },
      ctx,
    );
    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/undeclaredVar/);
  });

  it('testVarSet fails with message naming the missing variable', async () => {
    const ctx = makeCtx();
    const result = await dispatch(
      makePage(), { command: { type: 'testVarSet', name: 'notSet' } as Command },
      ctx,
    );
    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/notSet/);
  });

  it('testVarSet equality fails with Expected/Got in message', async () => {
    const ctx = makeCtx();
    ctx.varMap.set('x', '5');
    const result = await dispatch(
      makePage(), { command: { type: 'testVarSet', name: 'x', expected: '99' } as Command },
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
      makePage(), { command: { type: 'setVar', name: 'x', method: 'myMethod', args: [] } as Command },
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
      makePage(), { command: { type: 'setVar', name: 'x', method: 'specificMethod', args: [] } as Command },
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
      makePage(), { command: { type: 'setVar', name: 'x', method: 'fn', args: [] } as Command },
      ctx,
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain('underlying cause here');
  });
});

describe('error message format: sibling timeout resolution at dispatch (AC48–AC50, T5)', () => {
  // AC48: happy path — "${t}" resolves from a runtime var set by an earlier setVar,
  // so dispatch is not blocked by validation and the command proceeds.
  // The budget/deadline plumbing that would make a mismatched element actually
  // wait `t` ms lands in T11 (stepTimeoutMs / createDeadline wiring); this test
  // covers T5's half: dispatch-time resolution of the sibling value.
  it('AC48: a sibling timeout "${t}" set by an earlier setVar resolves without error', async () => {
    const page = makePage();
    const ctx = makeCtx();

    await dispatch(page, { command: { type: 'setVar', name: 't', value: '1300' } }, ctx);
    const result = await dispatch(
      page,
      { command: { type: 'goto', url: 'http://test/' }, timeout: '${t}' },
      ctx,
    );

    expect(result.passed).toBe(true);
  });

  it('AC49: "${var}" resolving to an invalid value fails the command immediately with the exact quoted-value message', async () => {
    const page = makePage();
    const ctx = makeCtx();
    await dispatch(page, { command: { type: 'setVar', name: 't', value: 'abc' } }, ctx);

    const start = Date.now();
    const result = await dispatch(
      page,
      { command: { type: 'tapOn', selector: 'x' }, timeout: '${t}' },
      ctx,
    );

    expect(Date.now() - start).toBeLessThan(500);
    expect(result.passed).toBe(false);
    expect(result.message).toBe('timeout must be a positive integer, got "abc"');
    // No resolution attempt should have been made before the invalid value was rejected.
    expect(page.locator).not.toHaveBeenCalled();
  });

  it('AC50a: an undefined "${var}" in a top-level flow sibling timeout gets the #100 flow-context suffix', async () => {
    const page = makePage();
    const ctx = makeCtx();
    ctx.callStack.add('/abs/top.yaml');

    const result = await dispatch(
      page,
      { command: { type: 'tapOn', selector: 'x' }, timeout: '${nope}' },
      ctx,
    );

    expect(result.passed).toBe(false);
    expect(result.message).toBe('Variable "nope" is not defined (in flow /abs/top.yaml)');
  });

  it('AC50b: the same undefined "${var}" inside a child flow gets the child+caller context suffix', async () => {
    const page = makePage();
    const ctx = makeCtx();
    ctx.callStack.add('/abs/top.yaml');
    ctx.callStack.add('/abs/child.yaml');

    const result = await dispatch(
      page,
      { command: { type: 'tapOn', selector: 'x' }, timeout: '${nope}' },
      ctx,
    );

    expect(result.passed).toBe(false);
    expect(result.message).toBe(
      'Variable "nope" is not defined (in child flow /abs/child.yaml, called from /abs/top.yaml)',
    );
  });
});

describe('error message format: arg parsing', () => {
  it('numeric arg is passed as number to methodRunner', async () => {
    const ctx = makeCtx();
    const callFn = vi.fn().mockResolvedValue('123456');
    ctx.methodRunner = { call: callFn as unknown as typeof ctx.methodRunner.call };
    await dispatch(
      makePage(), { command: { type: 'setVar', name: 'code', method: 'random', args: ['6'] } as Command },
      ctx,
    );
    expect(callFn).toHaveBeenCalledWith('random', [6]);
  });

  it('string literal arg has quotes stripped before passing to methodRunner', async () => {
    const ctx = makeCtx();
    const callFn = vi.fn().mockResolvedValue('20261001');
    ctx.methodRunner = { call: callFn as unknown as typeof ctx.methodRunner.call };
    await dispatch(
      makePage(), { command: { type: 'setVar', name: 'd', method: 'today', args: ["'YYYYMMDD'"] } as Command },
      ctx,
    );
    expect(callFn).toHaveBeenCalledWith('today', ['YYYYMMDD']);
  });
});
