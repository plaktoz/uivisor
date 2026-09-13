import { describe, it, expect, vi } from 'vitest';
import type { Page } from 'playwright';
import { executeWaitForLoad } from './commands.js';

describe('executeWaitForLoad', () => {
  // T49
  it('T49 — no selector calls waitForLoadState("networkidle",{timeout:30000}), not waitForSelector', async () => {
    const page = {
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn(),
    } as unknown as Page;
    await executeWaitForLoad(page);
    expect(page.waitForLoadState).toHaveBeenCalledOnce();
    expect(page.waitForLoadState).toHaveBeenCalledWith('networkidle', { timeout: 30000 });
    expect(page.waitForSelector).not.toHaveBeenCalled();
  });

  // T50
  it('T50 — with selector calls waitForSelector(sel,{state:"visible",timeout:30000}), not waitForLoadState', async () => {
    const page = {
      waitForLoadState: vi.fn(),
      waitForSelector: vi.fn().mockResolvedValue(null),
    } as unknown as Page;
    await executeWaitForLoad(page, '#btn');
    expect(page.waitForSelector).toHaveBeenCalledOnce();
    expect(page.waitForSelector).toHaveBeenCalledWith('#btn', { state: 'visible', timeout: 30000 });
    expect(page.waitForLoadState).not.toHaveBeenCalled();
  });

  // T51
  it('T51 — no-selector: waitForLoadState rejection propagates (message matches /timeout/i)', async () => {
    const page = {
      waitForLoadState: vi.fn().mockRejectedValue(new Error('Timeout 30000ms exceeded')),
      waitForSelector: vi.fn(),
    } as unknown as Page;
    await expect(executeWaitForLoad(page)).rejects.toThrow(/timeout/i);
  });

  // T52
  it('T52 — selector: waitForSelector rejection propagates (message matches /timeout/i)', async () => {
    const page = {
      waitForLoadState: vi.fn(),
      waitForSelector: vi.fn().mockRejectedValue(new Error('Timeout 30000ms exceeded')),
    } as unknown as Page;
    await expect(executeWaitForLoad(page, '#main')).rejects.toThrow(/timeout/i);
  });

  // T53
  it('T53 — undefined selector routes to networkidle', async () => {
    const page = {
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn(),
    } as unknown as Page;
    await executeWaitForLoad(page, undefined);
    expect(page.waitForLoadState).toHaveBeenCalledWith('networkidle', { timeout: 30000 });
    expect(page.waitForSelector).not.toHaveBeenCalled();
  });

  // T54
  it('T54 — string selector "42" causes waitForSelector to be called with "42"', async () => {
    const page = {
      waitForLoadState: vi.fn(),
      waitForSelector: vi.fn().mockResolvedValue(null),
    } as unknown as Page;
    await executeWaitForLoad(page, String(42));
    expect(page.waitForSelector).toHaveBeenCalledWith('42', { state: 'visible', timeout: 30000 });
    expect(page.waitForLoadState).not.toHaveBeenCalled();
  });

  // T55
  it('T55 — empty-string selector routes to networkidle (falsy guard)', async () => {
    const page = {
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn(),
    } as unknown as Page;
    await executeWaitForLoad(page, '');
    expect(page.waitForLoadState).toHaveBeenCalledWith('networkidle', { timeout: 30000 });
    expect(page.waitForSelector).not.toHaveBeenCalled();
  });
});
