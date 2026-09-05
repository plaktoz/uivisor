/**
 * tests/unit/session-engine.test.ts
 *
 * Engine unit tests for session routing (AC-3, AC-4, AC-5, AC-14).
 * Uses mock Page objects — no real browser required.
 *
 * Imports runFlow from engine/index which also registers _runFlowImpl so
 * nested runFlow commands dispatched from sub-flows resolve correctly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Page } from 'playwright';
import type { FlowFile, RunContext, SessionedCommand } from '@uivisor/core';
import { runFlow } from '../../src/engine/index';

// ─── Mock page helpers ─────────────────────────────────────────────────────────

function makeLocator() {
  return {
    waitFor: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    focus: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    check: vi.fn().mockResolvedValue(undefined),
    uncheck: vi.fn().mockResolvedValue(undefined),
    hover: vi.fn().mockResolvedValue(undefined),
    dblclick: vi.fn().mockResolvedValue(undefined),
    selectOption: vi.fn().mockResolvedValue(undefined),
    innerText: vi.fn().mockResolvedValue(''),
    inputValue: vi.fn().mockResolvedValue(''),
    isChecked: vi.fn().mockResolvedValue(false),
    isEnabled: vi.fn().mockResolvedValue(true),
    isDisabled: vi.fn().mockResolvedValue(false),
    count: vi.fn().mockResolvedValue(0),
  };
}

function makePage(url = 'http://test/'): Page {
  const locator = makeLocator();
  return {
    goto: vi.fn().mockResolvedValue(null),
    url: vi.fn().mockReturnValue(url),
    getByText: vi.fn().mockReturnValue(locator),
    getByRole: vi.fn().mockReturnValue(locator),
    getByLabel: vi.fn().mockReturnValue(locator),
    getByPlaceholder: vi.fn().mockReturnValue(locator),
    getByTestId: vi.fn().mockReturnValue(locator),
    locator: vi.fn().mockReturnValue(locator),
    evaluate: vi.fn().mockResolvedValue(undefined),
    keyboard: { press: vi.fn().mockResolvedValue(undefined) },
    reload: vi.fn().mockResolvedValue(null),
    goBack: vi.fn().mockResolvedValue(null),
    goForward: vi.fn().mockResolvedValue(null),
    setViewportSize: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('')),
    viewportSize: vi.fn().mockReturnValue({ width: 1280, height: 720 }),
  } as unknown as Page;
}

/** Make a RunContext with alice (default) and bob sessions */
function makeCtx(pageA: Page, pageB: Page, defaultId = 'alice'): RunContext {
  return {
    lastTappedLocator: null,
    callStack: new Set(),
    indentLevel: 0,
    runDir: os.tmpdir(),
    sessions: new Map([['alice', pageA], ['bob', pageB]]),
    defaultSessionId: defaultId,
  };
}

/** Minimal FlowFile factory for unit tests */
const flow = (cmds: SessionedCommand[]): FlowFile => ({
  baseUrl: 'http://test',
  filePath: '/flow.yaml',
  commands: cmds,
  sessions: [],
  tags: [],
  shared: false,
});

/** Write a temporary YAML flow file and return its path */
function writeTmpFlow(content: string): string {
  const file = path.join(
    os.tmpdir(),
    `webt-engine-test-${Date.now()}-${Math.random().toString(36).slice(2)}.yaml`,
  );
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

// ─── AC-3: Per-command routing ─────────────────────────────────────────────────

describe('AC-3: per-command session routing', () => {
  it('session:alice on goto → pageA.goto called; pageB.goto not called', async () => {
    const pageA = makePage();
    const pageB = makePage();
    const ctx = makeCtx(pageA, pageB);

    await runFlow(
      flow([{ session: 'alice', command: { type: 'goto', url: 'http://test/a' } }]),
      pageA,
      ctx,
    );

    expect(pageA.goto).toHaveBeenCalledWith('http://test/a', { waitUntil: 'load' });
    expect(pageB.goto).not.toHaveBeenCalled();
  });

  it('consecutive commands: alice gets /a, bob gets /b — each called once', async () => {
    const pageA = makePage();
    const pageB = makePage();
    const ctx = makeCtx(pageA, pageB);

    await runFlow(
      flow([
        { session: 'alice', command: { type: 'goto', url: 'http://test/a' } },
        { session: 'bob',   command: { type: 'goto', url: 'http://test/b' } },
      ]),
      pageA,
      ctx,
    );

    expect(pageA.goto).toHaveBeenCalledOnce();
    expect(pageA.goto).toHaveBeenCalledWith('http://test/a', { waitUntil: 'load' });
    expect(pageB.goto).toHaveBeenCalledOnce();
    expect(pageB.goto).toHaveBeenCalledWith('http://test/b', { waitUntil: 'load' });
  });

  it('untagged assertVisible with defaultSessionId=alice → alice getByText called, bob not', async () => {
    const pageA = makePage();
    const pageB = makePage();
    const ctx = makeCtx(pageA, pageB, 'alice');

    await runFlow(
      flow([{ command: { type: 'assertVisible', selector: 'some-text' } }]),
      pageA,
      ctx,
    );

    expect(pageA.getByText).toHaveBeenCalledWith('some-text', { exact: true });
    expect(pageB.getByText).not.toHaveBeenCalled();
  });
});

// ─── AC-4: Default session routing ─────────────────────────────────────────────

describe('AC-4: default session routing', () => {
  it('untagged command routes to ctx.defaultSessionId (alice)', async () => {
    const pageA = makePage();
    const pageB = makePage();
    const ctx = makeCtx(pageA, pageB, 'alice');

    await runFlow(
      flow([{ command: { type: 'goto', url: 'http://test/default' } }]),
      pageA,
      ctx,
    );

    expect(pageA.goto).toHaveBeenCalledWith('http://test/default', { waitUntil: 'load' });
    expect(pageB.goto).not.toHaveBeenCalled();
  });

  it('explicit bob command followed by untagged → untagged still routes to alice (default unchanged)', async () => {
    const pageA = makePage();
    const pageB = makePage();
    const ctx = makeCtx(pageA, pageB, 'alice');

    await runFlow(
      flow([
        { session: 'bob', command: { type: 'goto', url: 'http://test/bob' } },
        // untagged — should go to alice (the default)
        { command: { type: 'goto', url: 'http://test/alice' } },
      ]),
      pageA,
      ctx,
    );

    expect(pageA.goto).toHaveBeenCalledWith('http://test/alice', { waitUntil: 'load' });
    // bob should only have been called for its explicit command
    expect(pageB.goto).toHaveBeenCalledOnce();
    expect(pageB.goto).toHaveBeenCalledWith('http://test/bob', { waitUntil: 'load' });
    // defaultSessionId must remain 'alice' after the bob command
    expect(ctx.defaultSessionId).toBe('alice');
  });
});

// ─── AC-5: runFlow + session: → defaultSessionId restored ──────────────────────

describe('AC-5: runFlow with session: restores defaultSessionId', () => {
  it('defaultSessionId is alice again after sub-flow runs with session:bob', async () => {
    const subFlowPath = writeTmpFlow(
      `appId: http://test\ncommands:\n  - goto: http://test/bob-sub\n`,
    );

    const pageA = makePage();
    const pageB = makePage();
    const ctx = makeCtx(pageA, pageB, 'alice');

    try {
      await runFlow(
        flow([
          { session: 'bob', command: { type: 'runFlow', path: subFlowPath } },
        ]),
        pageA,
        ctx,
      );

      // Sub-flow ran on bob's page
      expect(pageB.goto).toHaveBeenCalledWith('http://test/bob-sub', { waitUntil: 'load' });
      // defaultSessionId restored to alice
      expect(ctx.defaultSessionId).toBe('alice');
    } finally {
      fs.unlinkSync(subFlowPath);
    }
  });

  it('defaultSessionId is restored even when sub-flow command fails', async () => {
    const subFlowPath = writeTmpFlow(
      `appId: http://test\ncommands:\n  - goto: http://test/bob-fail\n`,
    );

    const pageA = makePage();
    // pageB.goto rejects → sub-flow command fails
    const pageB = {
      ...makePage(),
      goto: vi.fn().mockRejectedValue(new Error('net::ERR_NAME_NOT_RESOLVED')),
    } as unknown as Page;
    const ctx = makeCtx(pageA, pageB, 'alice');

    try {
      const result = await runFlow(
        flow([
          { session: 'bob', command: { type: 'runFlow', path: subFlowPath } },
        ]),
        pageA,
        ctx,
      );

      // The sub-flow failed
      expect(result.passed).toBe(false);
      // defaultSessionId still restored
      expect(ctx.defaultSessionId).toBe('alice');
    } finally {
      fs.unlinkSync(subFlowPath);
    }
  });
});

// ─── AC-14: assertUrl is session-scoped ────────────────────────────────────────

describe('AC-14: assertUrl routes to the specified session page', () => {
  it('session:bob assertUrl → pageB.url() called; pageA.url() not called', async () => {
    const pageA = makePage('http://test/alice-page');
    const pageB = makePage('http://test/bob-page');
    const ctx = makeCtx(pageA, pageB);

    const result = await runFlow(
      flow([{ session: 'bob', command: { type: 'assertUrl', path: '/bob-page' } }]),
      pageA,
      ctx,
    );

    expect(result.passed).toBe(true);
    expect(pageB.url).toHaveBeenCalled();
    expect(pageA.url).not.toHaveBeenCalled();
  });

  it('wrong session URL → result.passed false; expected and actual in result', async () => {
    const pageA = makePage('http://test/');
    // bob is on /wrong-page but we assert /bob-page
    const pageB = makePage('http://test/wrong-page');
    const ctx = makeCtx(pageA, pageB);

    const result = await runFlow(
      flow([{ session: 'bob', command: { type: 'assertUrl', path: '/bob-page' } }]),
      pageA,
      ctx,
    );

    expect(result.passed).toBe(false);
    const cmdResult = result.commandResults[0];
    // dispatch parses Expected:/Got: into separate fields
    expect(cmdResult.expected).toBe('/bob-page');
    expect(cmdResult.got).toBe('/wrong-page');
  });
});
