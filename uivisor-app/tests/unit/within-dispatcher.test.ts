/**
 * tests/unit/within-dispatcher.test.ts
 *
 * Unit tests for within dispatch in dispatcher.ts and executeWithin in commands.ts.
 * Covers: TC-045, TC-047 (executeWithin unit), plus T-06 dispatcher integration.
 */

import { describe, it, expect, vi } from 'vitest';
import type { Page, Locator } from 'playwright';
import type { RunContext, Command } from '@uivisor/core';
import { executeWithin, WithinDispatch } from '../../src/driver/commands';
import { dispatch } from '../../src/engine/dispatcher';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeLocator(count: number, options?: { nth?: (n: number) => Locator }) {
  const loc: Record<string, unknown> = {
    count: vi.fn().mockResolvedValue(count),
    locator: vi.fn().mockReturnThis(),
    getByText: vi.fn().mockReturnThis(),
    getByLabel: vi.fn().mockReturnThis(),
    getByRole: vi.fn().mockReturnThis(),
    getByPlaceholder: vi.fn().mockReturnThis(),
    getByTestId: vi.fn().mockReturnThis(),
    waitFor: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
  };
  if (options?.nth) {
    loc['nth'] = options.nth;
  } else {
    loc['nth'] = vi.fn().mockReturnValue(loc);
  }
  return loc as unknown as Locator;
}

function makePage(containerCount = 1): Page {
  const containerLoc = makeLocator(containerCount);
  return {
    goto: vi.fn().mockResolvedValue(null),
    url: vi.fn().mockReturnValue('http://test/'),
    locator: vi.fn().mockReturnValue(makeLocator(0)),
    getByText: vi.fn().mockReturnValue(containerLoc),
    getByLabel: vi.fn().mockReturnValue(makeLocator(0)),
    getByRole: vi.fn().mockReturnValue(makeLocator(0)),
    getByPlaceholder: vi.fn().mockReturnValue(makeLocator(0)),
    getByTestId: vi.fn().mockReturnValue(makeLocator(0)),
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

function makeCtx(): RunContext {
  return {
    lastTappedLocator: null,
    callStack: new Set(),
    indentLevel: 0,
    runDir: '/tmp',
    sessions: new Map(),
    defaultSessionId: 'main',
  };
}

// ─── TC-045: executeWithin — container not found ──────────────────────────────

describe('executeWithin — container not found (TC-045)', () => {
  it('throws exact error when container count=0', async () => {
    // Page where text cascade returns count=0 for everything
    const page: Page = {
      locator: vi.fn().mockReturnValue(makeLocator(0)),
      getByText: vi.fn().mockReturnValue(makeLocator(0)),
      getByLabel: vi.fn().mockReturnValue(makeLocator(0)),
      getByRole: vi.fn().mockReturnValue(makeLocator(0)),
      getByPlaceholder: vi.fn().mockReturnValue(makeLocator(0)),
      getByTestId: vi.fn().mockReturnValue(makeLocator(0)),
    } as unknown as Page;

    const dispatch: WithinDispatch = vi.fn();
    const cmd = {
      type: 'within' as const,
      selector: 'text=NoSuchRow',
      do: [],
    };

    await expect(executeWithin(page, cmd, makeCtx(), dispatch)).rejects.toThrow(
      "within: No container found for selector 'text=NoSuchRow'"
    );
    // Inner dispatch must NOT run when container not found
    expect(dispatch).not.toHaveBeenCalled();
  });
});

// ─── TC-047: executeWithin — nth out of range ────────────────────────────────

describe('executeWithin — nth out of range (TC-047)', () => {
  it('throws exact error message when nth exceeds available containers', async () => {
    // text=Row returns count=2 (2 containers)
    const page: Page = {
      locator: vi.fn().mockReturnValue(makeLocator(0)),
      getByText: vi.fn().mockReturnValue(makeLocator(2)),
      getByLabel: vi.fn().mockReturnValue(makeLocator(0)),
      getByRole: vi.fn().mockReturnValue(makeLocator(0)),
      getByPlaceholder: vi.fn().mockReturnValue(makeLocator(0)),
      getByTestId: vi.fn().mockReturnValue(makeLocator(0)),
    } as unknown as Page;

    const dispatchFn: WithinDispatch = vi.fn();
    const cmd = {
      type: 'within' as const,
      selector: 'text=Row',
      nth: 5,
      do: [],
    };

    await expect(executeWithin(page, cmd, makeCtx(), dispatchFn)).rejects.toThrow(
      "within: nth=5 requested but only 2 containers matched selector 'text=Row'"
    );
    expect(dispatchFn).not.toHaveBeenCalled();
  });
});

// ─── T-06: dispatcher — within case ──────────────────────────────────────────

describe('dispatcher — within command dispatch', () => {
  it('within command returns passed:true with nestedResult when container is found', async () => {
    // Page returns text=Alice container with count=1
    const containerLoc = makeLocator(1);
    const page: Page = {
      goto: vi.fn().mockResolvedValue(null),
      url: vi.fn().mockReturnValue('http://test/'),
      locator: vi.fn().mockReturnValue(makeLocator(0)),
      getByText: vi.fn().mockReturnValue(containerLoc),
      getByLabel: vi.fn().mockReturnValue(makeLocator(0)),
      getByRole: vi.fn().mockReturnValue(makeLocator(0)),
      getByPlaceholder: vi.fn().mockReturnValue(makeLocator(0)),
      getByTestId: vi.fn().mockReturnValue(makeLocator(0)),
      evaluate: vi.fn().mockResolvedValue(undefined),
      keyboard: { press: vi.fn().mockResolvedValue(undefined) },
      reload: vi.fn().mockResolvedValue(null),
      goBack: vi.fn().mockResolvedValue(null),
      goForward: vi.fn().mockResolvedValue(null),
      setViewportSize: vi.fn().mockResolvedValue(undefined),
      screenshot: vi.fn().mockResolvedValue(Buffer.from('')),
      viewportSize: vi.fn().mockReturnValue({ width: 1280, height: 720 }),
    } as unknown as Page;

    const cmd: Command = {
      type: 'within',
      selector: 'text=Alice',
      do: [{ command: { type: 'goto', url: 'http://test/inner' } }],
    };

    const result = await dispatch(page, cmd, makeCtx());

    expect(result.passed).toBe(true);
    expect(result.nestedResult).toBeDefined();
    expect(result.nestedResult!.commandResults).toHaveLength(1);
    expect(result.nestedResult!.commandResults[0].passed).toBe(true);
  });

  it('within command returns passed:false with error when container not found', async () => {
    const page: Page = {
      goto: vi.fn().mockResolvedValue(null),
      url: vi.fn().mockReturnValue('http://test/'),
      locator: vi.fn().mockReturnValue(makeLocator(0)),
      getByText: vi.fn().mockReturnValue(makeLocator(0)),
      getByLabel: vi.fn().mockReturnValue(makeLocator(0)),
      getByRole: vi.fn().mockReturnValue(makeLocator(0)),
      getByPlaceholder: vi.fn().mockReturnValue(makeLocator(0)),
      getByTestId: vi.fn().mockReturnValue(makeLocator(0)),
      evaluate: vi.fn().mockResolvedValue(undefined),
      keyboard: { press: vi.fn().mockResolvedValue(undefined) },
      reload: vi.fn().mockResolvedValue(null),
      goBack: vi.fn().mockResolvedValue(null),
      goForward: vi.fn().mockResolvedValue(null),
      setViewportSize: vi.fn().mockResolvedValue(undefined),
      screenshot: vi.fn().mockResolvedValue(Buffer.from('')),
      viewportSize: vi.fn().mockReturnValue({ width: 1280, height: 720 }),
    } as unknown as Page;

    const cmd: Command = {
      type: 'within',
      selector: 'text=NoSuchRow',
      do: [],
    };

    const result = await dispatch(page, cmd, makeCtx());

    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/within.*No container found.*text=NoSuchRow/i);
  });
});
