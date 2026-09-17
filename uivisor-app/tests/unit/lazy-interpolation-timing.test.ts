/**
 * tests/unit/lazy-interpolation-timing.test.ts
 *
 * Tests that commands are NOT interpolated at parse time (lazy evaluation).
 * After T4, commands in FlowFile retain raw ${...} literals.
 * These tests will be RED until T4 (lazy interpolation) is implemented.
 * Written before T4 (TDD).
 */

import { describe, it, expect, vi } from 'vitest';
import type { Page } from 'playwright';
import type { RunContext } from '@uivisor/core';
import { createVarMap } from '../../src/engine/varMap';
import { dispatch } from '../../src/engine/dispatcher';

vi.mock('../../src/parser/reader');
import { loadAndParse } from '../../src/parser/index';
import * as reader from '../../src/parser/reader';
const mockReadYamlFile = vi.mocked(reader.readYamlFile);

function makePage(): Page {
  return {
    goto: vi.fn().mockResolvedValue(null),
    url: vi.fn().mockReturnValue('http://test/'),
    locator: vi.fn().mockReturnValue({ waitFor: vi.fn(), click: vi.fn(), count: vi.fn().mockResolvedValue(0) }),
    getByText: vi.fn().mockReturnValue({ waitFor: vi.fn(), click: vi.fn(), count: vi.fn().mockResolvedValue(0) }),
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

describe('lazy interpolation: commands retain raw ${...} literals after loadAndParse', () => {
  it('goto command url with ${varName} is stored raw (not interpolated at parse time)', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://test',
      vars: { baseUrl: 'http://localhost:3000' },
      commands: [{ goto: '${baseUrl}/path' }],
    });

    const file = loadAndParse('/flow.yaml');
    const cmd = file.commands[0]!.command;
    expect(cmd.type).toBe('goto');
    if (cmd.type === 'goto') {
      // After lazy interpolation: url should be raw '${baseUrl}/path', not resolved
      expect(cmd.url).toBe('${baseUrl}/path');
    }
  });

  it('inputText command with ${var} is stored raw (not resolved at parse time)', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://test',
      vars: { myText: 'hello' },
      commands: [{ inputText: '${myText}' }],
    });

    const file = loadAndParse('/flow.yaml');
    const cmd = file.commands[0]!.command;
    expect(cmd.type).toBe('inputText');
    if (cmd.type === 'inputText') {
      expect(cmd.text).toBe('${myText}');
    }
  });
});

describe('lazy interpolation: ${...} is resolved at dispatch time', () => {
  it('goto url ${...} is resolved from varMap at dispatch time', async () => {
    const page = makePage();
    const ctx = makeCtx({ baseUrl: 'http://localhost:3000' });

    // Simulate a command that has a raw ${...} literal (as stored after lazy parse)
    const result = await dispatch(
      page,
      { type: 'goto', url: '${baseUrl}/dashboard' },
      ctx,
    );
    expect(result.passed).toBe(true);
    expect(vi.mocked(page.goto)).toHaveBeenCalledWith(
      'http://localhost:3000/dashboard',
      expect.anything(),
    );
  });

  it('dispatch fails with clear error when ${...} var is not in varMap', async () => {
    const page = makePage();
    const ctx = makeCtx({});

    const result = await dispatch(
      page,
      { type: 'goto', url: '${missingVar}/path' },
      ctx,
    );
    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/missingVar|not.*defined|undefined/i);
  });

  it('setVar value ${...} is resolved from current varMap at dispatch time', async () => {
    const page = makePage();
    const ctx = makeCtx({ prefix: 'USER' });

    const result = await dispatch(
      page,
      { type: 'setVar', name: 'label', value: '${prefix}_123' },
      ctx,
    );
    expect(result.passed).toBe(true);
    expect(ctx.varMap.get('label')).toBe('USER_123');
  });

  it('vars set by earlier setVar are available in later command interpolation', async () => {
    const page = makePage();
    const ctx = makeCtx({});

    // Step 1: set a var
    await dispatch(page, { type: 'setVar', name: 'userId', value: 'abc123' }, ctx);

    // Step 2: use it in goto
    const result = await dispatch(
      page,
      { type: 'goto', url: 'http://example.com/${userId}' },
      ctx,
    );
    expect(result.passed).toBe(true);
    expect(vi.mocked(page.goto)).toHaveBeenCalledWith(
      'http://example.com/abc123',
      expect.anything(),
    );
  });
});
