/**
 * tests/unit/timeouts-precedence.test.ts
 *
 * Unit tests for the pure timeout-precedence functions in
 * src/engine/timeouts.ts (S7, T9): resolveRunTimeouts, stepTimeoutMs,
 * timeoutNotice. These are not wired into the engine yet (T11).
 *
 * Covers AC51-54 (resolveRunTimeouts), AC51/AC35/AC70 (stepTimeoutMs),
 * AC58-62/AC80 (timeoutNotice, using the Gate 1 Revision 1 text for
 * AC59/AC60/AC61/AC80, which supersedes the originals).
 */

import { describe, it, expect } from 'vitest';
import type { FlowFile, TimeoutSettings } from '@uivisor/core';
import { resolveRunTimeouts, stepTimeoutMs, timeoutNotice } from '../../src/engine/timeouts';

function flowFile(timeouts: FlowFile['timeouts']): Pick<FlowFile, 'timeouts'> {
  return { timeouts };
}

describe('resolveRunTimeouts', () => {
  // AC51
  it('AC51: no CLI, no header, no config → DEFAULT_TIMEOUTS', () => {
    const result = resolveRunTimeouts({}, flowFile(undefined));
    expect(result).toEqual({ defaultTimeout: 5000, navigationTimeout: 30000 });
  });

  it('AC51: config-only sets defaultTimeout', () => {
    const result = resolveRunTimeouts({}, flowFile({ header: {}, config: { defaultTimeout: 1100 } }));
    expect(result.defaultTimeout).toBe(1100);
  });

  it('AC51: header sets defaultTimeout', () => {
    const result = resolveRunTimeouts({}, flowFile({ header: { defaultTimeout: 1200 }, config: {} }));
    expect(result.defaultTimeout).toBe(1200);
  });

  it('AC51: CLI beats header for defaultTimeout', () => {
    const result = resolveRunTimeouts(
      { defaultTimeout: 1300 },
      flowFile({ header: { defaultTimeout: 1200 }, config: {} }),
    );
    expect(result.defaultTimeout).toBe(1300);
  });

  // AC52: analogous chain for navigationTimeout
  it('AC52: no CLI, no header, no config → navigationTimeout built-in 30000', () => {
    const result = resolveRunTimeouts({}, flowFile(undefined));
    expect(result.navigationTimeout).toBe(30000);
  });

  it('AC52: config-only sets navigationTimeout', () => {
    const result = resolveRunTimeouts({}, flowFile({ header: {}, config: { navigationTimeout: 2100 } }));
    expect(result.navigationTimeout).toBe(2100);
  });

  it('AC52: header sets navigationTimeout', () => {
    const result = resolveRunTimeouts({}, flowFile({ header: { navigationTimeout: 2200 }, config: {} }));
    expect(result.navigationTimeout).toBe(2200);
  });

  it('AC52: CLI beats header for navigationTimeout', () => {
    const result = resolveRunTimeouts(
      { navigationTimeout: 2300 },
      flowFile({ header: { navigationTimeout: 2200 }, config: {} }),
    );
    expect(result.navigationTimeout).toBe(2300);
  });

  // AC53
  it('AC53 (a): only navigationTimeout set in header leaves defaultTimeout at the built-in 5000', () => {
    const result = resolveRunTimeouts({}, flowFile({ header: { navigationTimeout: 1000 }, config: {} }));
    expect(result).toEqual({ defaultTimeout: 5000, navigationTimeout: 1000 });
  });

  it('AC53 (b): only CLI --timeout set leaves navigationTimeout at the built-in 30000', () => {
    const result = resolveRunTimeouts({ defaultTimeout: 1000 }, flowFile({}));
    expect(result).toEqual({ defaultTimeout: 1000, navigationTimeout: 30000 });
  });

  // AC54
  it('AC54: header beats shared config for defaultTimeout (not the vars rule where config wins)', () => {
    const result = resolveRunTimeouts(
      {},
      flowFile({ header: { defaultTimeout: 1200 }, config: { defaultTimeout: 4000 } }),
    );
    expect(result.defaultTimeout).toBe(1200);
  });

  it('AC54: header beats shared config for navigationTimeout too', () => {
    const result = resolveRunTimeouts(
      {},
      flowFile({ header: { navigationTimeout: 1200 }, config: { navigationTimeout: 4000 } }),
    );
    expect(result.navigationTimeout).toBe(1200);
  });
});

describe('stepTimeoutMs', () => {
  it('AC51 (sibling-layer unit): returns the "own" value over the run defaultTimeout for an element command', () => {
    const run: TimeoutSettings = { defaultTimeout: 1200, navigationTimeout: 30000 };
    expect(stepTimeoutMs('tapOn', 1400, run)).toBe(1400);
  });

  it('returns the run defaultTimeout when own is undefined, for an element command', () => {
    const run: TimeoutSettings = { defaultTimeout: 1200, navigationTimeout: 30000 };
    expect(stepTimeoutMs('tapOn', undefined, run)).toBe(1200);
  });

  it('returns the run navigationTimeout for a navigation command when own is undefined', () => {
    const run: TimeoutSettings = { defaultTimeout: 1200, navigationTimeout: 1500 };
    expect(stepTimeoutMs('goto', undefined, run)).toBe(1500);
  });

  it('AC35/Q19 composition: returns the "own" value (which for waitForPageLoad may be the inner timeout) over the run navigationTimeout', () => {
    const run: TimeoutSettings = { defaultTimeout: 5000, navigationTimeout: 3000 };
    expect(stepTimeoutMs('waitForPageLoad', 1000, run)).toBe(1000);
  });

  it('AC70/none-trait: returns undefined for a none-trait command regardless of own or run values', () => {
    const run: TimeoutSettings = { defaultTimeout: 5000, navigationTimeout: 30000 };
    expect(stepTimeoutMs('wait', 1000, run)).toBeUndefined();
  });
});

describe('timeoutNotice', () => {
  const run: TimeoutSettings = { defaultTimeout: 1000, navigationTimeout: 1500 };

  // AC58
  it('AC58 setup: returns null when the child sets no timeout keys', () => {
    const child = { timeouts: { header: {}, config: {} } } as FlowFile;
    expect(timeoutNotice(child, run, 'top.yaml')).toBeNull();
  });

  // AC59 (revised)
  it('AC59 (revised): fires for defaultTimeout only when the child\'s own config value differs from the effective run value', () => {
    const child = {
      filePath: '/abs/child.yaml',
      timeouts: { header: {}, config: { defaultTimeout: 4000 } },
    } as FlowFile;
    const result = timeoutNotice(child, { defaultTimeout: 5000, navigationTimeout: 30000 }, '/abs/top.yaml');
    expect(result).toBe('child.yaml: defaultTimeout ignored (inherited from top.yaml)');
  });

  // AC60 (revised, a)
  it('AC60 (revised, a): lists both keys, in defaultTimeout-then-navigationTimeout order, in one line, when both differ', () => {
    const child = {
      filePath: '/abs/child.yaml',
      timeouts: { header: { defaultTimeout: 4000, navigationTimeout: 6000 }, config: {} },
    } as FlowFile;
    const result = timeoutNotice(child, run, '/abs/top.yaml');
    expect(result).toBe('child.yaml: defaultTimeout, navigationTimeout ignored (inherited from top.yaml)');
  });

  // AC60 (revised, b)
  it('AC60 (revised, b): lists only defaultTimeout when only that key is set and differs', () => {
    const child = {
      filePath: '/abs/child2.yaml',
      timeouts: { header: { defaultTimeout: 4000 }, config: {} },
    } as FlowFile;
    const result = timeoutNotice(child, run, '/abs/top.yaml');
    expect(result).toBe('child2.yaml: defaultTimeout ignored (inherited from top.yaml)');
  });

  // AC61 (revised, a)
  it('AC61 (revised, a): returns null when the child sets neither key', () => {
    const child = {
      filePath: '/abs/child.yaml',
      timeouts: { header: {}, config: {} },
    } as FlowFile;
    expect(timeoutNotice(child, run, '/abs/top.yaml')).toBeNull();
  });

  // AC61 (revised, b)
  it('AC61 (revised, b): returns null when the child\'s config value equals the effective run value', () => {
    const child = {
      filePath: '/abs/child.yaml',
      timeouts: { header: {}, config: { defaultTimeout: 1000 } },
    } as FlowFile;
    expect(timeoutNotice(child, run, '/abs/top.yaml')).toBeNull();
  });

  // AC80 (a)
  it('AC80 (a): returns null when the child\'s header value for defaultTimeout equals the effective value, with no other key set', () => {
    const child = {
      filePath: '/abs/child.yaml',
      timeouts: { header: { defaultTimeout: 1000 }, config: {} },
    } as FlowFile;
    expect(timeoutNotice(child, run, '/abs/top.yaml')).toBeNull();
  });

  // AC80 (b)
  it('AC80 (b): lists only the key that differs, omitting the one that\'s equal', () => {
    const child = {
      filePath: '/abs/child.yaml',
      timeouts: { header: { defaultTimeout: 1000, navigationTimeout: 9000 }, config: {} },
    } as FlowFile;
    const result = timeoutNotice(child, run, '/abs/top.yaml');
    expect(result).toBe('child.yaml: navigationTimeout ignored (inherited from top.yaml)');
  });

  // AC62
  it('AC62: is given the top-level path, not the immediate caller\'s path, so a grandchild\'s notice names the top-level flow', () => {
    const leaf = {
      filePath: '/abs/leaf.yaml',
      timeouts: { header: { defaultTimeout: 4000 }, config: {} },
    } as FlowFile;
    const result = timeoutNotice(leaf, run, '/abs/top.yaml');
    expect(result).toBe('leaf.yaml: defaultTimeout ignored (inherited from top.yaml)');
    expect(result).not.toContain('mid.yaml');
  });
});
