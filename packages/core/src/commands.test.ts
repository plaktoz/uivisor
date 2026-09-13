import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Page } from 'playwright';
import type { Command } from './types.js';
import { executeWaitForPageLoad } from './commands.js';

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
});
