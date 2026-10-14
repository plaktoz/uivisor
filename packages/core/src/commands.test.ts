import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Page, Locator } from 'playwright';
import type { Command, PlaywrightContext, RunContext, SessionedCommand } from './types.js';
import {
  executeWaitForPageLoad,
  executeGoto,
  executeTapOn,
  executeInputText,
  executeInputTextTargeted,
  executeAssertVisible,
  executeAssertNotVisible,
  executeAssertUrl,
  executeAssertText,
  executeAssertValue,
  executeAssertCount,
  executeAssertEnabled,
  executeAssertDisabled,
  executeAssertChecked,
  executeAssertUnchecked,
  executeSelectOption,
  executeCheck,
  executeUncheck,
  executeHover,
  executeDoubleClick,
  executeClearText,
  executeReload,
  executeGoBack,
  executeGoForward,
  executeWithin,
  type WithinDispatch,
} from './commands.js';
import { createDeadline, type Clock, type Deadline } from './deadline.js';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/** Deterministic clock: `sleep` advances time instantly. */
function makeFakeClock(): Clock {
  let t = 0;
  return {
    now: () => t,
    sleep: async (ms: number) => { t += ms; },
  };
}

type LocatorOverrides = Partial<Record<string, unknown>>;

/** A mock Locator with every method `commands.ts` might call, each a `vi.fn()`. */
function makeLocator(count: number | (() => number), overrides: LocatorOverrides = {}): Locator {
  const countFn = typeof count === 'function' ? count : () => count;
  const loc: Record<string, unknown> = {
    count: vi.fn().mockImplementation(async () => countFn()),
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    check: vi.fn().mockResolvedValue(undefined),
    uncheck: vi.fn().mockResolvedValue(undefined),
    hover: vi.fn().mockResolvedValue(undefined),
    dblclick: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    selectOption: vi.fn().mockResolvedValue(undefined),
    waitFor: vi.fn().mockResolvedValue(undefined),
    innerText: vi.fn().mockResolvedValue(''),
    inputValue: vi.fn().mockResolvedValue(''),
    isEnabled: vi.fn().mockResolvedValue(true),
    isDisabled: vi.fn().mockResolvedValue(false),
    isChecked: vi.fn().mockResolvedValue(true),
    isVisible: vi.fn().mockResolvedValue(false),
    nth: vi.fn().mockReturnThis(),
    locator: vi.fn().mockReturnThis(),
    getByText: vi.fn().mockReturnThis(),
    getByLabel: vi.fn().mockReturnThis(),
    getByRole: vi.fn().mockReturnThis(),
    getByPlaceholder: vi.fn().mockReturnThis(),
    getByTestId: vi.fn().mockReturnThis(),
    ...overrides,
  };
  return loc as unknown as Locator;
}

/**
 * A mock Page whose `getByText` returns `target` (so `'text=Foo'` pipe-syntax
 * selectors resolve to it) and every other locator-query method returns an
 * empty (`count=0`) locator.
 */
function makeTextPage(target: Locator, overrides: Partial<Record<string, unknown>> = {}): Page {
  return {
    getByText: vi.fn().mockReturnValue(target),
    getByLabel: vi.fn().mockReturnValue(makeLocator(0)),
    getByRole: vi.fn().mockReturnValue(makeLocator(0)),
    getByPlaceholder: vi.fn().mockReturnValue(makeLocator(0)),
    getByTestId: vi.fn().mockReturnValue(makeLocator(0)),
    locator: vi.fn().mockReturnValue(makeLocator(0)),
    url: vi.fn().mockReturnValue('http://test/'),
    ...overrides,
  } as unknown as Page;
}

function makeCtx(): PlaywrightContext {
  return { lastTappedLocator: null };
}

// ─── waitForPageLoad (pre-existing C-01, C-02, C-13–C-19) ────────────────────

describe('waitForPageLoad', () => {
  // C-01, C-02: TypeScript compile-time (these pass by compilation alone)
  const _a: Command = { type: 'waitForPageLoad' };
  const _b: Command = { type: 'waitForPageLoad', path: '/x', timeout: 500 };
  void _a; void _b;

  let page: {
    waitForLoadState: ReturnType<typeof vi.fn>;
    waitForURL: ReturnType<typeof vi.fn>;
    waitForSelector: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    page = {
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      waitForURL: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn(),
    };
  });

  // C-13: bare form
  it('bare: calls waitForLoadState(networkidle, {timeout:30000}); waitForURL not called', async () => {
    await executeWaitForPageLoad(page as unknown as Page);
    expect(page.waitForLoadState).toHaveBeenCalledWith('networkidle', { timeout: 30000 });
    expect(page.waitForURL).not.toHaveBeenCalled();
  });

  // C-14: path only
  it('path-only: calls waitForURL first then waitForLoadState, both timeout 30000', async () => {
    const callOrder: string[] = [];
    page.waitForURL.mockImplementation(() => { callOrder.push('url'); return Promise.resolve(); });
    page.waitForLoadState.mockImplementation(() => { callOrder.push('load'); return Promise.resolve(); });
    await executeWaitForPageLoad(page as unknown as Page, '/dashboard');
    expect(callOrder).toEqual(['url', 'load']);
    expect(page.waitForURL).toHaveBeenCalledWith('**/dashboard', { timeout: 30000 });
    expect(page.waitForLoadState).toHaveBeenCalledWith('networkidle', { timeout: 30000 });
  });

  // C-15: path + timeout
  it('path+timeout: both calls use provided timeout', async () => {
    await executeWaitForPageLoad(page as unknown as Page, '/x', 5000);
    expect(page.waitForURL).toHaveBeenCalledWith('**/x', { timeout: 5000 });
    expect(page.waitForLoadState).toHaveBeenCalledWith('networkidle', { timeout: 5000 });
  });

  // C-16: path + timeout=0
  it('path+timeout=0: both calls get {timeout:0}, not omitted', async () => {
    await executeWaitForPageLoad(page as unknown as Page, '/path', 0);
    expect(page.waitForURL).toHaveBeenCalledWith('**/path', { timeout: 0 });
    expect(page.waitForLoadState).toHaveBeenCalledWith('networkidle', { timeout: 0 });
  });

  // C-17: timeout-only (no path)
  it('timeout-only: only waitForLoadState called', async () => {
    await executeWaitForPageLoad(page as unknown as Page, undefined, 5000);
    expect(page.waitForURL).not.toHaveBeenCalled();
    expect(page.waitForLoadState).toHaveBeenCalledWith('networkidle', { timeout: 5000 });
  });

  // C-18: no-leading-slash normalization
  it('no-leading-slash path: glob becomes **/path', async () => {
    await executeWaitForPageLoad(page as unknown as Page, 'dashboard');
    expect(page.waitForURL).toHaveBeenCalledWith('**/dashboard', { timeout: 30000 });
  });

  // C-19: rejection propagates
  it('waitForLoadState rejection propagates', async () => {
    page.waitForLoadState.mockRejectedValue(new Error('Timeout exceeded'));
    await expect(executeWaitForPageLoad(page as unknown as Page)).rejects.toThrow('Timeout exceeded');
  });

  // AC37: one shared budget across both waits — the remaining time (not a
  // fresh budget) is passed to the second wait, floored at 1ms (never 0,
  // since `timeout: 0` means "unbounded" and must not be produced by chance).
  it('AC37: one budget — remaining time shrinks between waitForURL and waitForLoadState, floored at 1ms', async () => {
    const nowSeq = [0, 50, 150]; // start=0; call#1 sees now=50 (remaining 50); call#2 sees now=150 (remaining 0 -> floor 1)
    let i = 0;
    const clock: Clock = { now: () => nowSeq[Math.min(i++, nowSeq.length - 1)], sleep: async () => {} };
    const d = createDeadline(100, clock);
    await executeWaitForPageLoad(page as unknown as Page, '/x', undefined, d);
    expect(page.waitForURL).toHaveBeenCalledWith('**/x', { timeout: 50 });
    expect(page.waitForLoadState).toHaveBeenCalledWith('networkidle', { timeout: 1 });
  });

  // AC33/AC35: TimeoutError -> embeds <T>ms; other errors propagate unmodified
  it('TimeoutError -> "waitForPageLoad timed out after <T>ms"', async () => {
    page.waitForLoadState.mockRejectedValue({ name: 'TimeoutError' });
    const d = createDeadline(4321, makeFakeClock());
    await expect(executeWaitForPageLoad(page as unknown as Page, undefined, undefined, d)).rejects.toThrow(
      'waitForPageLoad timed out after 4321ms',
    );
  });
});

// ─── executeGoto (AC33–AC35, AC73) ────────────────────────────────────────────

describe('executeGoto', () => {
  it('calls page.goto with {waitUntil:"load", timeout: d.pwTimeout()}', async () => {
    const page = { goto: vi.fn().mockResolvedValue(undefined) } as unknown as Page;
    await executeGoto(page, 'http://x/y', createDeadline(12345, makeFakeClock()));
    expect(page.goto).toHaveBeenCalledWith('http://x/y', { waitUntil: 'load', timeout: 12345 });
  });

  it('AC33: TimeoutError -> "Navigation failed: <url> — timed out after <T>ms"', async () => {
    const page = { goto: vi.fn().mockRejectedValue({ name: 'TimeoutError' }) } as unknown as Page;
    await expect(executeGoto(page, 'http://x/y', createDeadline(2000, makeFakeClock()))).rejects.toThrow(
      'Navigation failed: http://x/y — timed out after 2000ms',
    );
  });

  it('other error keeps today\'s wrapping: "Navigation failed: <url> — <msg>"', async () => {
    const page = { goto: vi.fn().mockRejectedValue(new Error('net::ERR_FAILED')) } as unknown as Page;
    await expect(executeGoto(page, 'http://x/y', createDeadline(2000, makeFakeClock()))).rejects.toThrow(
      'Navigation failed: http://x/y — net::ERR_FAILED',
    );
  });

  it('AC73: default navigationTimeout (30000ms) applies when no deadline is given', async () => {
    const page = { goto: vi.fn().mockRejectedValue({ name: 'TimeoutError' }) } as unknown as Page;
    await expect(executeGoto(page, 'http://x/')).rejects.toThrow(
      'Navigation failed: http://x/ — timed out after 30000ms',
    );
  });
});

// ─── executeTapOn (AC31, AC36, AC38) ──────────────────────────────────────────

describe('executeTapOn', () => {
  it('AC31: resolution timeout throws "Element not found after <T>ms: <selector>"', async () => {
    const page = makeTextPage(makeLocator(0));
    await expect(
      executeTapOn(page, 'text=Foo', makeCtx(), createDeadline(1000, makeFakeClock())),
    ).rejects.toThrow('Element not found after 1000ms: text=Foo');
  });

  it('AC38: interaction timeout after successful resolution throws "Element not actionable after <T>ms: <selector>"', async () => {
    const target = makeLocator(1, { click: vi.fn().mockRejectedValue(new Error('x')) });
    const page = makeTextPage(target);
    await expect(
      executeTapOn(page, 'text=Foo', makeCtx(), createDeadline(1234, makeFakeClock())),
    ).rejects.toThrow('Element not actionable after 1234ms: text=Foo');
  });

  it('AC36: one budget — remaining time after resolution (not a fresh budget) is passed to click', async () => {
    const clock = makeFakeClock();
    const d = createDeadline(2000, clock);
    let calls = 0;
    const target = makeLocator(() => (calls++ === 0 ? 0 : 1));
    const page = makeTextPage(target);
    await executeTapOn(page, 'text=Foo', makeCtx(), d);
    // Resolution took one 100ms retry interval, so 1900ms should remain.
    expect(target.click).toHaveBeenCalledWith({ timeout: 1900 });
  });

  it('success stores ctx.lastTappedLocator and ctx.lastTappedLabel = selectorLabel(selector)', async () => {
    const target = makeLocator(1);
    const page = makeTextPage(target);
    const ctx = makeCtx();
    await executeTapOn(page, 'text=Foo', ctx, createDeadline(1000, makeFakeClock()));
    expect(ctx.lastTappedLocator).toBe(target);
    expect(ctx.lastTappedLabel).toBe('text=Foo');
  });

  it('AC73: default elementDeadline (5000ms) applies when no deadline is given', async () => {
    const target = makeLocator(1, { click: vi.fn().mockRejectedValue(new Error('x')) });
    const page = makeTextPage(target);
    await expect(executeTapOn(page, 'text=Foo', makeCtx())).rejects.toThrow(
      'Element not actionable after 5000ms: text=Foo',
    );
  });
});

// ─── executeInputText shorthand (AC32 revised) ───────────────────────────────

describe('executeInputText (shorthand)', () => {
  it('throws "inputText shorthand used before any tapOn" when nothing was tapped (unchanged)', async () => {
    await expect(executeInputText(makeCtx(), 'hi')).rejects.toThrow(
      'inputText shorthand used before any tapOn',
    );
  });

  it('AC32 revised: not-actionable message names the last-tapped selector as written', async () => {
    const locator = makeLocator(1, { fill: vi.fn().mockRejectedValue(new Error('x')) });
    const ctx: PlaywrightContext = { lastTappedLocator: locator, lastTappedLabel: 'text=Username' };
    await expect(
      executeInputText(ctx, 'hi', createDeadline(777, makeFakeClock())),
    ).rejects.toThrow('Element not actionable after 777ms: text=Username');
  });
});

// ─── executeInputTextTargeted (AC31, AC38) ───────────────────────────────────

describe('executeInputTextTargeted', () => {
  it('AC31: resolution timeout throws "Element not found after <T>ms: <selector>"', async () => {
    const page = makeTextPage(makeLocator(0));
    await expect(
      executeInputTextTargeted(page, 'text=Foo', 'hi', createDeadline(900, makeFakeClock())),
    ).rejects.toThrow('Element not found after 900ms: text=Foo');
  });

  it('AC38: not-actionable after resolution throws "Element not actionable after <T>ms: <selector>"', async () => {
    const target = makeLocator(1, { fill: vi.fn().mockRejectedValue(new Error('x')) });
    const page = makeTextPage(target);
    await expect(
      executeInputTextTargeted(page, 'text=Foo', 'hi', createDeadline(900, makeFakeClock())),
    ).rejects.toThrow('Element not actionable after 900ms: text=Foo');
  });
});

// ─── Assertions (AC19–AC30) ───────────────────────────────────────────────────

describe('executeAssertVisible', () => {
  it('AC31: resolution failure throws "Element not found after..." (not the old wrapped message)', async () => {
    const page = makeTextPage(makeLocator(0));
    await expect(
      executeAssertVisible(page, 'text=Foo', createDeadline(1000, makeFakeClock())),
    ).rejects.toThrow('Element not found after 1000ms: text=Foo');
  });

  it('resolved but condition check fails: keeps old "Expected: visible\\nGot: element not found"', async () => {
    const target = makeLocator(1, { waitFor: vi.fn().mockRejectedValue(new Error('x')) });
    const page = makeTextPage(target);
    await expect(
      executeAssertVisible(page, 'text=Foo', createDeadline(500, makeFakeClock())),
    ).rejects.toThrow('Expected: visible\nGot: element not found');
  });
});

describe('executeAssertText', () => {
  it('reads the condition once (no retry) and reports the mismatch', async () => {
    const target = makeLocator(1, { innerText: vi.fn().mockResolvedValue('wrong') });
    const page = makeTextPage(target);
    await expect(
      executeAssertText(page, 'text=Foo', 'right', createDeadline(500, makeFakeClock())),
    ).rejects.toThrow('Expected: right\nGot: wrong');
    expect(target.innerText).toHaveBeenCalledOnce();
  });

  it('AC31: resolution failure throws "Element not found after..."', async () => {
    const page = makeTextPage(makeLocator(0));
    await expect(
      executeAssertText(page, 'text=Foo', 'right', createDeadline(500, makeFakeClock())),
    ).rejects.toThrow('Element not found after 500ms: text=Foo');
  });
});

describe('executeAssertValue', () => {
  it('reads the condition once and reports the mismatch', async () => {
    const target = makeLocator(1, { inputValue: vi.fn().mockResolvedValue('wrong') });
    const page = makeTextPage(target);
    await expect(
      executeAssertValue(page, 'text=Foo', 'right', createDeadline(500, makeFakeClock())),
    ).rejects.toThrow('Expected: right\nGot: wrong');
    expect(target.inputValue).toHaveBeenCalledOnce();
  });
});

describe('executeAssertEnabled / executeAssertDisabled / executeAssertChecked / executeAssertUnchecked', () => {
  it('executeAssertEnabled: resolution failure throws "Element not found after..."', async () => {
    const page = makeTextPage(makeLocator(0));
    await expect(
      executeAssertEnabled(page, 'text=Foo', createDeadline(300, makeFakeClock())),
    ).rejects.toThrow('Element not found after 300ms: text=Foo');
  });

  it('executeAssertEnabled: condition mismatch keeps old text, read once', async () => {
    const target = makeLocator(1, { isEnabled: vi.fn().mockResolvedValue(false) });
    const page = makeTextPage(target);
    await expect(
      executeAssertEnabled(page, 'text=Foo', createDeadline(300, makeFakeClock())),
    ).rejects.toThrow('Expected: enabled\nGot: disabled');
    expect(target.isEnabled).toHaveBeenCalledOnce();
  });

  it('executeAssertDisabled: condition mismatch keeps old text', async () => {
    const target = makeLocator(1, { isDisabled: vi.fn().mockResolvedValue(false) });
    const page = makeTextPage(target);
    await expect(
      executeAssertDisabled(page, 'text=Foo', createDeadline(300, makeFakeClock())),
    ).rejects.toThrow('Expected: disabled\nGot: enabled');
  });

  it('executeAssertChecked: condition mismatch keeps old text', async () => {
    const target = makeLocator(1, { isChecked: vi.fn().mockResolvedValue(false) });
    const page = makeTextPage(target);
    await expect(
      executeAssertChecked(page, 'text=Foo', createDeadline(300, makeFakeClock())),
    ).rejects.toThrow('Expected: checked\nGot: unchecked');
  });

  it('executeAssertUnchecked: condition mismatch keeps old text', async () => {
    const target = makeLocator(1, { isChecked: vi.fn().mockResolvedValue(true) });
    const page = makeTextPage(target);
    await expect(
      executeAssertUnchecked(page, 'text=Foo', createDeadline(300, makeFakeClock())),
    ).rejects.toThrow('Expected: unchecked\nGot: checked');
  });
});

// ─── B2: state read after resolution carries its own (remaining) timeout ────

describe('B2: innerText/inputValue/isEnabled/isDisabled/isChecked time out after resolution', () => {
  it('executeAssertText: innerText never resolves in time -> "Element not found after <T>ms: <selector>"; receives { timeout: remaining }', async () => {
    const target = makeLocator(1, { innerText: vi.fn().mockRejectedValue(new Error('timeout')) });
    const page = makeTextPage(target);
    await expect(
      executeAssertText(page, 'text=Foo', 'right', createDeadline(300, makeFakeClock())),
    ).rejects.toThrow('Element not found after 300ms: text=Foo');
    expect(target.innerText).toHaveBeenCalledWith({ timeout: 300 });
  });

  it('executeAssertValue: inputValue never resolves in time -> "Element not found after <T>ms: <selector>"; receives { timeout: remaining }', async () => {
    const target = makeLocator(1, { inputValue: vi.fn().mockRejectedValue(new Error('timeout')) });
    const page = makeTextPage(target);
    await expect(
      executeAssertValue(page, 'text=Foo', 'right', createDeadline(300, makeFakeClock())),
    ).rejects.toThrow('Element not found after 300ms: text=Foo');
    expect(target.inputValue).toHaveBeenCalledWith({ timeout: 300 });
  });

  it('executeAssertEnabled: isEnabled never resolves in time -> "Element not found after <T>ms: <selector>"; receives { timeout: remaining }', async () => {
    const target = makeLocator(1, { isEnabled: vi.fn().mockRejectedValue(new Error('timeout')) });
    const page = makeTextPage(target);
    await expect(
      executeAssertEnabled(page, 'text=Foo', createDeadline(300, makeFakeClock())),
    ).rejects.toThrow('Element not found after 300ms: text=Foo');
    expect(target.isEnabled).toHaveBeenCalledWith({ timeout: 300 });
  });

  it('executeAssertDisabled: isDisabled never resolves in time -> "Element not found after <T>ms: <selector>"; receives { timeout: remaining }', async () => {
    const target = makeLocator(1, { isDisabled: vi.fn().mockRejectedValue(new Error('timeout')) });
    const page = makeTextPage(target);
    await expect(
      executeAssertDisabled(page, 'text=Foo', createDeadline(300, makeFakeClock())),
    ).rejects.toThrow('Element not found after 300ms: text=Foo');
    expect(target.isDisabled).toHaveBeenCalledWith({ timeout: 300 });
  });

  it('executeAssertChecked: isChecked never resolves in time -> "Element not found after <T>ms: <selector>"; receives { timeout: remaining }', async () => {
    const target = makeLocator(1, { isChecked: vi.fn().mockRejectedValue(new Error('timeout')) });
    const page = makeTextPage(target);
    await expect(
      executeAssertChecked(page, 'text=Foo', createDeadline(300, makeFakeClock())),
    ).rejects.toThrow('Element not found after 300ms: text=Foo');
    expect(target.isChecked).toHaveBeenCalledWith({ timeout: 300 });
  });

  it('executeAssertUnchecked: isChecked never resolves in time -> "Element not found after <T>ms: <selector>"; receives { timeout: remaining }', async () => {
    const target = makeLocator(1, { isChecked: vi.fn().mockRejectedValue(new Error('timeout')) });
    const page = makeTextPage(target);
    await expect(
      executeAssertUnchecked(page, 'text=Foo', createDeadline(300, makeFakeClock())),
    ).rejects.toThrow('Element not found after 300ms: text=Foo');
    expect(target.isChecked).toHaveBeenCalledWith({ timeout: 300 });
  });
});

describe('executeAssertNotVisible (AC23 revised)', () => {
  it('uses resolveNotVisible; a visible match -> "Expected: not visible\\nGot: visible"', async () => {
    const target = makeLocator(1, { isVisible: vi.fn().mockResolvedValue(true) });
    const page = makeTextPage(target);
    await expect(
      executeAssertNotVisible(page, 'text=Foo', createDeadline(300, makeFakeClock())),
    ).rejects.toThrow('Expected: not visible\nGot: visible');
  });

  it('passes when there is no visible match (count=0)', async () => {
    const page = makeTextPage(makeLocator(0));
    await expect(
      executeAssertNotVisible(page, 'text=Foo', createDeadline(300, makeFakeClock())),
    ).resolves.toBeUndefined();
  });
});

describe('executeAssertUrl (AC29: retry until deadline, report last observed)', () => {
  it('matches immediately — no retry needed', async () => {
    const page = { url: vi.fn().mockReturnValue('http://x/dashboard') } as unknown as Page;
    await expect(
      executeAssertUrl(page, '/dashboard', createDeadline(500, makeFakeClock())),
    ).resolves.toBeUndefined();
    expect(page.url).toHaveBeenCalledTimes(1);
  });

  it('retries until the deadline, then reports the last observed path in Expected:/Got: format', async () => {
    const page = { url: vi.fn().mockReturnValue('http://x/other') } as unknown as Page;
    await expect(
      executeAssertUrl(page, '/dashboard', createDeadline(300, makeFakeClock())),
    ).rejects.toThrow('Expected: /dashboard\nGot: /other');
    expect((page.url as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(1);
  });

  it('eventually matches after retrying a few times', async () => {
    let n = 0;
    const page = {
      url: vi.fn().mockImplementation(() => (n++ < 2 ? 'http://x/other' : 'http://x/dashboard')),
    } as unknown as Page;
    await expect(
      executeAssertUrl(page, '/dashboard', createDeadline(1000, makeFakeClock())),
    ).resolves.toBeUndefined();
    expect(n).toBeGreaterThanOrEqual(3);
  });
});

describe('executeAssertCount (AC30: retry until deadline, report last observed)', () => {
  it('retries until the deadline, then reports the last observed count', async () => {
    const countLocator = makeLocator(3);
    const page = { locator: vi.fn().mockReturnValue(countLocator) } as unknown as Page;
    await expect(
      executeAssertCount(page, '.row', 5, createDeadline(300, makeFakeClock())),
    ).rejects.toThrow('Expected: 5\nGot: 3');
  });

  it('eventually matches after retrying', async () => {
    let n = 0;
    const countLocator = { count: vi.fn().mockImplementation(async () => (n++ < 2 ? 1 : 5)) } as unknown as Locator;
    const page = { locator: vi.fn().mockReturnValue(countLocator) } as unknown as Page;
    await expect(
      executeAssertCount(page, '.row', 5, createDeadline(1000, makeFakeClock())),
    ).resolves.toBeUndefined();
  });
});

// ─── executeSelectOption (AC31, Errata E3 carve-out) ─────────────────────────

describe('executeSelectOption', () => {
  it('AC31: resolution failure throws "Element not found after..." (resolves outside the carve-out catch)', async () => {
    const page = makeTextPage(makeLocator(0));
    await expect(
      executeSelectOption(page, 'text=Foo', 'bar', createDeadline(400, makeFakeClock())),
    ).rejects.toThrow('Element not found after 400ms: text=Foo');
  });

  it('Errata E3: resolved but waitFor(attached) fails -> literal "Option not found." (no timeout/selector embedded)', async () => {
    const target = makeLocator(1, { waitFor: vi.fn().mockRejectedValue(new Error('x')) });
    const page = makeTextPage(target);
    await expect(
      executeSelectOption(page, 'text=Foo', 'bar', createDeadline(400, makeFakeClock())),
    ).rejects.toThrow('Option not found.');
  });

  it('Errata E3: resolved and attached, but selectOption itself fails -> literal "Option not found."', async () => {
    const target = makeLocator(1, { selectOption: vi.fn().mockRejectedValue(new Error('x')) });
    const page = makeTextPage(target);
    await expect(
      executeSelectOption(page, 'text=Foo', 'bar', createDeadline(400, makeFakeClock())),
    ).rejects.toThrow('Option not found.');
  });
});

// ─── check / uncheck / hover / doubleClick / clearText (AC31, AC38) ─────────

describe('executeCheck / executeUncheck / executeHover / executeDoubleClick / executeClearText', () => {
  const cases: Array<[
    string,
    (page: Page, selector: string, d: Deadline) => Promise<void>,
    string,
  ]> = [
    ['check', (p, s, d) => executeCheck(p, s, d), 'check'],
    ['uncheck', (p, s, d) => executeUncheck(p, s, d), 'uncheck'],
    ['hover', (p, s, d) => executeHover(p, s, d), 'hover'],
    ['doubleClick', (p, s, d) => executeDoubleClick(p, s, d), 'dblclick'],
    ['clearText', (p, s, d) => executeClearText(p, s, d), 'clear'],
  ];

  it.each(cases)('%s: not-actionable after resolution throws "Element not actionable after <T>ms: <selector>"', async (_name, fn, method) => {
    const target = makeLocator(1, { [method]: vi.fn().mockRejectedValue(new Error('x')) });
    const page = makeTextPage(target);
    await expect(fn(page, 'text=Foo', createDeadline(321, makeFakeClock()))).rejects.toThrow(
      'Element not actionable after 321ms: text=Foo',
    );
  });

  it.each(cases)('%s: resolution failure throws "Element not found after <T>ms: <selector>"', async (_name, fn) => {
    const page = makeTextPage(makeLocator(0));
    await expect(fn(page, 'text=Foo', createDeadline(321, makeFakeClock()))).rejects.toThrow(
      'Element not found after 321ms: text=Foo',
    );
  });
});

// ─── executeReload / executeGoBack / executeGoForward (AC33–AC35) ───────────

describe('executeReload', () => {
  it('calls page.reload with {waitUntil:"load", timeout: d.pwTimeout()}', async () => {
    const page = { reload: vi.fn().mockResolvedValue(undefined) } as unknown as Page;
    await executeReload(page, createDeadline(5000, makeFakeClock()));
    expect(page.reload).toHaveBeenCalledWith({ waitUntil: 'load', timeout: 5000 });
  });

  it('TimeoutError -> "reload timed out after <T>ms"', async () => {
    const page = { reload: vi.fn().mockRejectedValue({ name: 'TimeoutError' }) } as unknown as Page;
    await expect(executeReload(page, createDeadline(2500, makeFakeClock()))).rejects.toThrow(
      'reload timed out after 2500ms',
    );
  });

  it('other error propagates unmodified (no wrapping — unlike goto, no wrapping existed before)', async () => {
    const page = { reload: vi.fn().mockRejectedValue(new Error('boom')) } as unknown as Page;
    await expect(executeReload(page, createDeadline(2500, makeFakeClock()))).rejects.toThrow('boom');
  });

  it('AC73: default navigationTimeout (30000ms) applies when no deadline is given', async () => {
    const page = { reload: vi.fn().mockRejectedValue({ name: 'TimeoutError' }) } as unknown as Page;
    await expect(executeReload(page)).rejects.toThrow('reload timed out after 30000ms');
  });
});

describe('executeGoBack', () => {
  it('calls page.goBack with {waitUntil:"commit", timeout: d.pwTimeout()}', async () => {
    const page = {
      goBack: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValueOnce('http://a/').mockReturnValueOnce('http://b/'),
    } as unknown as Page;
    await executeGoBack(page, createDeadline(1000, makeFakeClock()));
    expect(page.goBack).toHaveBeenCalledWith({ waitUntil: 'commit', timeout: 1000 });
  });

  it('TimeoutError -> "goBack timed out after <T>ms"', async () => {
    const page = {
      goBack: vi.fn().mockRejectedValue({ name: 'TimeoutError' }),
      url: vi.fn().mockReturnValue('http://a/'),
    } as unknown as Page;
    await expect(executeGoBack(page, createDeadline(1500, makeFakeClock()))).rejects.toThrow(
      'goBack timed out after 1500ms',
    );
  });

  it('other error propagates unmodified', async () => {
    const page = {
      goBack: vi.fn().mockRejectedValue(new Error('boom')),
      url: vi.fn().mockReturnValue('http://a/'),
    } as unknown as Page;
    await expect(executeGoBack(page, createDeadline(1500, makeFakeClock()))).rejects.toThrow('boom');
  });

  it('history check unchanged: no previous page throws "No previous page in history."', async () => {
    const page = {
      goBack: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue('http://a/'),
    } as unknown as Page;
    await expect(executeGoBack(page, createDeadline(1000, makeFakeClock()))).rejects.toThrow(
      'No previous page in history.',
    );
  });
});

describe('executeGoForward', () => {
  it('calls page.goForward with {waitUntil:"commit", timeout: d.pwTimeout()}', async () => {
    const page = {
      goForward: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValueOnce('http://a/').mockReturnValueOnce('http://b/'),
    } as unknown as Page;
    await executeGoForward(page, createDeadline(1000, makeFakeClock()));
    expect(page.goForward).toHaveBeenCalledWith({ waitUntil: 'commit', timeout: 1000 });
  });

  it('TimeoutError -> "goForward timed out after <T>ms"', async () => {
    const page = {
      goForward: vi.fn().mockRejectedValue({ name: 'TimeoutError' }),
      url: vi.fn().mockReturnValue('http://a/'),
    } as unknown as Page;
    await expect(executeGoForward(page, createDeadline(1800, makeFakeClock()))).rejects.toThrow(
      'goForward timed out after 1800ms',
    );
  });

  it('history check unchanged: no next page throws "No next page in history."', async () => {
    const page = {
      goForward: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue('http://a/'),
    } as unknown as Page;
    await expect(executeGoForward(page, createDeadline(1000, makeFakeClock()))).rejects.toThrow(
      'No next page in history.',
    );
  });
});

// ─── executeWithin (AC24–AC27, Q18) ───────────────────────────────────────────

describe('executeWithin — AC24-27, Q18', () => {
  it('validates nth<0 before any resolution attempt (no container lookup, no dispatch)', async () => {
    const getByText = vi.fn();
    const page = {
      getByText,
      getByLabel: vi.fn(),
      getByRole: vi.fn(),
      getByPlaceholder: vi.fn(),
      getByTestId: vi.fn(),
      locator: vi.fn(),
    } as unknown as Page;
    const dispatchFn: WithinDispatch = vi.fn();
    const cmd = { type: 'within' as const, selector: 'text=Row', nth: -1, do: [] };

    await expect(executeWithin(page, cmd, {} as RunContext, dispatchFn)).rejects.toThrow(/nth/i);
    expect(getByText).not.toHaveBeenCalled();
    expect(dispatchFn).not.toHaveBeenCalled();
  });

  it('the callback receives the WHOLE step (with its own sibling `timeout`), not a bare command', async () => {
    const container = makeLocator(1);
    const page = makeTextPage(container);
    const dispatchFn: WithinDispatch = vi.fn().mockResolvedValue({
      passed: true,
      command: { type: 'goto', url: 'x' },
      durationMs: 0,
    });
    const step: SessionedCommand = { command: { type: 'tapOn', selector: 'text=OK' }, timeout: 1234 };
    const cmd = { type: 'within' as const, selector: 'text=Row', do: [step] };

    await executeWithin(page, cmd, {} as RunContext, dispatchFn);

    expect(dispatchFn).toHaveBeenCalledTimes(1);
    const [, passedStep] = (dispatchFn as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(passedStep).toBe(step);
  });

  it('Q18: the within deadline bounds only the container lookup — a non-matching container fails before any dispatch, regardless of the do: list', async () => {
    const page = makeTextPage(makeLocator(0));
    const dispatchFn: WithinDispatch = vi.fn();
    const cmd = {
      type: 'within' as const,
      selector: 'text=Row',
      do: [{ command: { type: 'goto' as const, url: 'x' } }],
    };
    const d = createDeadline(300, makeFakeClock());

    await expect(executeWithin(page, cmd, {} as RunContext, dispatchFn, d)).rejects.toThrow(
      "within: No container found after 300ms for selector 'text=Row'",
    );
    expect(dispatchFn).not.toHaveBeenCalled();
  });

  it('stops dispatching on the first failed step and returns only the results so far', async () => {
    const container = makeLocator(1);
    const page = makeTextPage(container);
    const dispatchFn: WithinDispatch = vi
      .fn()
      .mockResolvedValueOnce({ passed: false, message: 'nope', command: { type: 'goto', url: 'x' }, durationMs: 0 })
      .mockResolvedValueOnce({ passed: true, command: { type: 'goto', url: 'y' }, durationMs: 0 });
    const cmd = {
      type: 'within' as const,
      selector: 'text=Row',
      do: [
        { command: { type: 'goto' as const, url: 'x' } },
        { command: { type: 'goto' as const, url: 'y' } },
      ],
    };

    const results = await executeWithin(page, cmd, {} as RunContext, dispatchFn);

    expect(results).toHaveLength(1);
    expect(dispatchFn).toHaveBeenCalledTimes(1);
  });

  it('all steps pass: returns a CommandResult for every do: entry', async () => {
    const container = makeLocator(1);
    const page = makeTextPage(container);
    const dispatchFn: WithinDispatch = vi
      .fn()
      .mockResolvedValue({ passed: true, command: { type: 'goto', url: 'x' }, durationMs: 0 });
    const cmd = {
      type: 'within' as const,
      selector: 'text=Row',
      do: [
        { command: { type: 'goto' as const, url: 'x' } },
        { command: { type: 'goto' as const, url: 'y' } },
      ],
    };

    const results = await executeWithin(page, cmd, {} as RunContext, dispatchFn);

    expect(results).toHaveLength(2);
    expect(dispatchFn).toHaveBeenCalledTimes(2);
  });
});
