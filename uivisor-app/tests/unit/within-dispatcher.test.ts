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

// ─── TC-B-W: within + xpath selector (AC11 + AC12) ──────────────────────────

describe('executeWithin — xpath container selector (AC11)', () => {

  // TC-B-W-001 [FAILING before T3+T4]
  it('TC-B-W-001: xpath container count=1 — inner dispatch IS called (scoping succeeds)', async () => {
    const containerLoc = makeLocator(1);

    const page: Page = {
      locator: vi.fn().mockImplementation((selector: string) => {
        if (selector === 'xpath=//div[@data-role="dialog"]') return containerLoc;
        return makeLocator(0);
      }),
      getByText: vi.fn().mockReturnValue(makeLocator(0)),
      getByLabel: vi.fn().mockReturnValue(makeLocator(0)),
      getByRole: vi.fn().mockReturnValue(makeLocator(0)),
      getByPlaceholder: vi.fn().mockReturnValue(makeLocator(0)),
      getByTestId: vi.fn().mockReturnValue(makeLocator(0)),
    } as unknown as Page;

    const innerDispatch: WithinDispatch = vi.fn().mockResolvedValue({
      commandResults: [],
      passed: true,
      filePath: '',
      totalCommands: 0,
      passedCommands: 0,
      durationMs: 0,
    });

    const cmd = {
      type: 'within' as const,
      selector: 'xpath=//div[@data-role="dialog"]',
      do: [{ command: { type: 'tapOn' as const, selector: 'text=OK' } }],
    };

    await executeWithin(page, cmd, makeCtx(), innerDispatch);

    expect(innerDispatch).toHaveBeenCalledOnce();
  });

  // TC-B-W-002 [FAILING before T3+T4]
  it('TC-B-W-002: xpath container count=0 — throws "No container found" error mentioning xpath selector; inner dispatch NOT called', async () => {
    const page: Page = {
      locator: vi.fn().mockReturnValue(makeLocator(0)),
      getByText: vi.fn().mockReturnValue(makeLocator(0)),
      getByLabel: vi.fn().mockReturnValue(makeLocator(0)),
      getByRole: vi.fn().mockReturnValue(makeLocator(0)),
      getByPlaceholder: vi.fn().mockReturnValue(makeLocator(0)),
      getByTestId: vi.fn().mockReturnValue(makeLocator(0)),
    } as unknown as Page;

    const innerDispatch: WithinDispatch = vi.fn();

    const cmd = {
      type: 'within' as const,
      selector: 'xpath=//div[@class="missing"]',
      do: [],
    };

    await expect(
      executeWithin(page, cmd, makeCtx(), innerDispatch)
    ).rejects.toThrow(
      /No container found.*xpath=\/\/div\[@class="missing"\]/
    );

    expect(innerDispatch).not.toHaveBeenCalled();
  });

  // TC-B-W-003 [FAILING before T5] — AC12: within container with xpath union |
  it('TC-B-W-003: xpath container with union | ("xpath=//a | //b") — throws XPath union conflict; inner dispatch NOT called', async () => {
    const page: Page = {
      locator: vi.fn().mockReturnValue(makeLocator(0)),
      getByText: vi.fn().mockReturnValue(makeLocator(0)),
      getByLabel: vi.fn().mockReturnValue(makeLocator(0)),
      getByRole: vi.fn().mockReturnValue(makeLocator(0)),
      getByPlaceholder: vi.fn().mockReturnValue(makeLocator(0)),
      getByTestId: vi.fn().mockReturnValue(makeLocator(0)),
    } as unknown as Page;

    const innerDispatch: WithinDispatch = vi.fn();

    const cmd = {
      type: 'within' as const,
      selector: 'xpath=//a | //b',
      do: [],
    };

    await expect(
      executeWithin(page, cmd, makeCtx(), innerDispatch)
    ).rejects.toThrow(/XPath union.*conflicts/i);

    expect(innerDispatch).not.toHaveBeenCalled();
  });

  // TC-B-W-004 [FAILING before T3+T4]
  it('TC-B-W-004: xpath container count=3, nth=1 (0-based: 2nd container) — inner dispatch called; nth(1) called on container', async () => {
    const nth0 = makeLocator(0);
    const nth1 = makeLocator(0);
    const nth2 = makeLocator(0);
    const containerLoc = {
      count: vi.fn().mockResolvedValue(3),
      nth: vi.fn().mockImplementation((n: number) => {
        if (n === 0) return nth0;
        if (n === 1) return nth1;
        if (n === 2) return nth2;
        return nth0;
      }),
    } as unknown as import('playwright').Locator;

    const page: Page = {
      locator: vi.fn().mockImplementation((selector: string) => {
        if (selector === 'xpath=//tr') return containerLoc;
        return makeLocator(0);
      }),
      getByText: vi.fn().mockReturnValue(makeLocator(0)),
      getByLabel: vi.fn().mockReturnValue(makeLocator(0)),
      getByRole: vi.fn().mockReturnValue(makeLocator(0)),
      getByPlaceholder: vi.fn().mockReturnValue(makeLocator(0)),
      getByTestId: vi.fn().mockReturnValue(makeLocator(0)),
    } as unknown as Page;

    const innerDispatch: WithinDispatch = vi.fn().mockResolvedValue({
      passed: true,
      message: undefined,
      command: { type: 'goto', url: 'http://test' },
      durationMs: 0,
    });

    const cmd = {
      type: 'within' as const,
      selector: 'xpath=//tr',
      nth: 1, // 0-based: selects 2nd container → containerLoc.nth(1)
      do: [{ command: { type: 'goto' as const, url: 'http://test' } }],
    };

    await executeWithin(page, cmd, makeCtx(), innerDispatch);

    // nth=1 (0-based) → containerLoc.nth(1) called
    expect(containerLoc.nth).toHaveBeenCalledWith(1);
    expect(innerDispatch).toHaveBeenCalledOnce();
  });

  // TC-B-W-005 [FAILING before T3+T4]
  it('TC-B-W-005: xpath container count=1, nth=3 out of range — throws "nth out of range" error; inner dispatch NOT called', async () => {
    const containerLoc = makeLocator(1);

    const page: Page = {
      locator: vi.fn().mockImplementation((selector: string) => {
        if (selector === 'xpath=//div') return containerLoc;
        return makeLocator(0);
      }),
      getByText: vi.fn().mockReturnValue(makeLocator(0)),
      getByLabel: vi.fn().mockReturnValue(makeLocator(0)),
      getByRole: vi.fn().mockReturnValue(makeLocator(0)),
      getByPlaceholder: vi.fn().mockReturnValue(makeLocator(0)),
      getByTestId: vi.fn().mockReturnValue(makeLocator(0)),
    } as unknown as Page;

    const innerDispatch: WithinDispatch = vi.fn();

    const cmd = {
      type: 'within' as const,
      selector: 'xpath=//div',
      nth: 3,
      do: [],
    };

    await expect(
      executeWithin(page, cmd, makeCtx(), innerDispatch)
    ).rejects.toThrow(/nth=3.*only 1.*containers/i);

    expect(innerDispatch).not.toHaveBeenCalled();
  });

});
