/**
 * tests/unit/sibling-timeout-parser.test.ts
 *
 * Unit tests for the sibling `timeout:` key in `parseSessionedCommand`
 * (S8, T6). Covers AC39–AC47, AC72 and AC75 (parse-time half).
 */

import { describe, it, expect } from 'vitest';
import { parseSessionedCommand } from '../../src/parser/commandParser';

// ─── Parsing and placement (AC39–AC43, AC72) ──────────────────────────────────

describe('sibling timeout: parsing and placement', () => {
  it('AC39: a sibling timeout on a string-selector command parses and is carried on the step', () => {
    const sc = parseSessionedCommand({ assertVisible: 'data-testid=int-never-rendered', timeout: 1500 });
    expect(sc.timeout).toBe(1500);
    expect(sc.command).toEqual({ type: 'assertVisible', selector: 'data-testid=int-never-rendered' });
  });

  it('AC40 (a): a sibling timeout written before the command key still resolves to the command', () => {
    const sc = parseSessionedCommand({ timeout: 1500, tapOn: { testId: 'int-never-rendered' } });
    expect(sc.command.type).toBe('tapOn');
    expect(sc.timeout).toBe(1500);
  });

  it('AC40 (b): session plus a sibling timeout in any key order both survive parsing', () => {
    const sc = parseSessionedCommand({ session: 'b', tapOn: { testId: 'int-never-rendered' }, timeout: 1500 });
    expect(sc).toEqual({
      session: 'b',
      timeout: 1500,
      command: { type: 'tapOn', selector: { testId: 'int-never-rendered' } },
    });
  });

  // Every element-trait YAML form (Constraints table), including both forms of `inputText`.
  const ELEMENT_CASES: Array<[string, unknown]> = [
    ['tapOn', { tapOn: 'data-testid=x' }],
    ['doubleClick', { doubleClick: 'data-testid=x' }],
    ['hover', { hover: 'data-testid=x' }],
    ['inputText (shorthand)', { inputText: 'hello' }],
    ['inputText (targeted/object form)', { inputText: { element: 'data-testid=x', text: 'hello' } }],
    ['clearText', { clearText: 'data-testid=x' }],
    ['selectOption', { selectOption: { testId: 'x', value: 'v' } }],
    ['check', { check: 'data-testid=x' }],
    ['uncheck', { uncheck: 'data-testid=x' }],
    ['assertVisible', { assertVisible: 'data-testid=x' }],
    ['assertNotVisible', { assertNotVisible: 'data-testid=x' }],
    ['assertText', { assertText: { testId: 'x', expected: 'hi' } }],
    ['assertValue', { assertValue: { testId: 'x', expected: 'hi' } }],
    ['assertEnabled', { assertEnabled: 'data-testid=x' }],
    ['assertDisabled', { assertDisabled: 'data-testid=x' }],
    ['assertChecked', { assertChecked: 'data-testid=x' }],
    ['assertUnchecked', { assertUnchecked: 'data-testid=x' }],
    ['assertUrl', { assertUrl: '/x' }],
    ['assertCount', { assertCount: { css: '.row', expected: 1 } }],
    ['within', { within: { testId: 'card', do: [{ tapOn: 'data-testid=x' }] } }],
  ];

  it.each(ELEMENT_CASES)('AC41: a sibling timeout is accepted on every element-trait command (%s)', (_label, raw) => {
    const step = { ...(raw as Record<string, unknown>), timeout: 2000 };
    const sc = parseSessionedCommand(step);
    expect(sc.timeout).toBe(2000);
  });

  // Every navigation-trait command, `waitForPageLoad` without an inner timeout.
  const NAVIGATION_CASES: Array<[string, unknown]> = [
    ['goto', { goto: 'http://x' }],
    ['reload', { reload: null }],
    ['goBack', { goBack: null }],
    ['goForward', { goForward: null }],
    ['waitForPageLoad', { waitForPageLoad: null }],
  ];

  it.each(NAVIGATION_CASES)('AC41: a sibling timeout is accepted on every navigation-trait command (%s)', (_label, raw) => {
    const step = { ...(raw as Record<string, unknown>), timeout: 2000 };
    const sc = parseSessionedCommand(step);
    expect(sc.timeout).toBe(2000);
  });

  it('AC42: a sibling timeout inside a within do: block parses on the inner step', () => {
    const sc = parseSessionedCommand({
      within: { 'data-testid': 'card', do: [{ assertVisible: { testId: 'inner-never' }, timeout: 1000 }] },
    });
    expect(sc.command.type).toBe('within');
    const inner = (sc.command as { do: Array<{ timeout?: number }> }).do[0];
    expect(inner?.timeout).toBe(1000);
  });

  it('AC43 setup (parse-only half): a child flow step keeps its own sibling timeout value unconditionally', () => {
    const sc = parseSessionedCommand({ assertVisible: 'data-testid=int-delayed', timeout: 4000 });
    expect(sc.timeout).toBe(4000);
  });
});

// ─── Q17 / Q19 trait and placement errors (AC44–AC46, AC72) ──────────────────

describe('sibling timeout: trait checks (Q17/Q19)', () => {
  const NONE_TRAIT_CASES: Array<[string, unknown]> = [
    ['wait', { wait: 100 }],
    ['waitFor', { waitFor: 100 }],
    ['scroll', { scroll: 'down' }],
    ['setViewport', { setViewport: 'mobile' }],
    ['screenshot', { screenshot: 'a.png' }],
    ['setVar', { setVar: 'a=1' }],
    ['testVarSet', { testVarSet: 'a' }],
    ['unsetVar', { unsetVar: 'a' }],
    ['runFlow', { runFlow: './x.yaml' }],
    ['pressKey', { pressKey: 'Enter' }],
  ];

  it.each(NONE_TRAIT_CASES)('AC44: timeout on %s throws "timeout is not supported on %s"', (key, raw) => {
    const step = { ...(raw as Record<string, unknown>), timeout: 1000 };
    expect(() => parseSessionedCommand(step)).toThrow(`timeout is not supported on ${key}`);
  });

  it('AC45 (a): the Q17 error also fires for a none-trait command inside a top-level within do: block', () => {
    expect(() =>
      parseSessionedCommand({
        within: { testId: 'card', do: [{ pressKey: 'Enter', timeout: 1000 }] },
      }),
    ).toThrow('timeout is not supported on pressKey');
  });

  it('AC46: waitForPageLoad with both an inner and a sibling timeout throws the exact "use one" message', () => {
    expect(() =>
      parseSessionedCommand({ waitForPageLoad: { path: '/x', timeout: 3000 }, timeout: 3000 }),
    ).toThrow('waitForPageLoad: timeout given both inside the command and as a sibling key; use one');
  });

  it('AC72: parse-time acceptance of timeout: follows COMMAND_TRAITS for every YAML command key', () => {
    const ELEMENT_AND_NAV_KEYS: Array<[string, unknown]> = [
      ['tapOn', { tapOn: 'data-testid=x' }],
      ['doubleClick', { doubleClick: 'data-testid=x' }],
      ['hover', { hover: 'data-testid=x' }],
      ['inputText', { inputText: 'hello' }],
      ['clearText', { clearText: 'data-testid=x' }],
      ['selectOption', { selectOption: { testId: 'x', value: 'v' } }],
      ['check', { check: 'data-testid=x' }],
      ['uncheck', { uncheck: 'data-testid=x' }],
      ['assertVisible', { assertVisible: 'data-testid=x' }],
      ['assertNotVisible', { assertNotVisible: 'data-testid=x' }],
      ['assertText', { assertText: { testId: 'x', expected: 'hi' } }],
      ['assertValue', { assertValue: { testId: 'x', expected: 'hi' } }],
      ['assertEnabled', { assertEnabled: 'data-testid=x' }],
      ['assertDisabled', { assertDisabled: 'data-testid=x' }],
      ['assertChecked', { assertChecked: 'data-testid=x' }],
      ['assertUnchecked', { assertUnchecked: 'data-testid=x' }],
      ['assertUrl', { assertUrl: '/x' }],
      ['assertCount', { assertCount: { css: '.row', expected: 1 } }],
      ['within', { within: { testId: 'card', do: [{ tapOn: 'data-testid=x' }] } }],
      ['goto', { goto: 'http://x' }],
      ['reload', { reload: null }],
      ['goBack', { goBack: null }],
      ['goForward', { goForward: null }],
      ['waitForPageLoad', { waitForPageLoad: null }],
    ];
    const NONE_KEYS = NONE_TRAIT_CASES;

    for (const [, raw] of ELEMENT_AND_NAV_KEYS) {
      const step = { ...(raw as Record<string, unknown>), timeout: 1000 };
      expect(() => parseSessionedCommand(step)).not.toThrow();
    }
    for (const [key, raw] of NONE_KEYS) {
      const step = { ...(raw as Record<string, unknown>), timeout: 1000 };
      expect(() => parseSessionedCommand(step)).toThrow(`timeout is not supported on ${key}`);
    }
  });
});

// ─── Literal value validation (AC47) ──────────────────────────────────────────

describe('sibling timeout: literal value validation (AC47)', () => {
  const INVALID_CASES: Array<[unknown, string]> = [
    [0, '0'],
    [-5, '-5'],
    [1.5, '1.5'],
    ['abc', 'abc'],
    [true, 'true'],
    [null, 'null'],
  ];

  it.each(INVALID_CASES)('rejects timeout: %s with "timeout must be a positive integer, got %s"', (raw, expected) => {
    expect(() => parseSessionedCommand({ tapOn: 'x', timeout: raw })).toThrow(
      `timeout must be a positive integer, got ${expected}`,
    );
  });

  it('AC47: timeout: "3000" (quoted digit string) is accepted as 3000, not rejected', () => {
    const sc = parseSessionedCommand({ tapOn: 'x', timeout: '3000' });
    expect(sc.timeout).toBe(3000);
  });
});

// ─── Reporter / label stability (AC75, parse side) ────────────────────────────

describe('sibling timeout: reporter label stability (AC75)', () => {
  it('the parsed Command is identical whether or not a sibling timeout is present', () => {
    const withTimeout = parseSessionedCommand({ tapOn: 'data-testid=int-tap-btn', timeout: 3000 });
    const withoutTimeout = parseSessionedCommand({ tapOn: 'data-testid=int-tap-btn' });
    expect(withTimeout.command).toEqual(withoutTimeout.command);
  });
});

// ─── PASSES on both versions ───────────────────────────────────────────────────

describe('PASSES on both versions', () => {
  it('existing session-only extraction with no timeout key present is unaffected', () => {
    const sc = parseSessionedCommand({ session: 'b', tapOn: 'data-testid=x' });
    expect(sc).toEqual({ session: 'b', command: { type: 'tapOn', selector: 'data-testid=x' } });
  });

  it('inner waitForPageLoad timeout: 0 still parses', () => {
    const sc = parseSessionedCommand({ waitForPageLoad: { timeout: 0 } });
    expect(sc.command).toEqual({ type: 'waitForPageLoad', timeout: 0 });
  });

  it('inner waitForPageLoad timeout: "5000" (a string) still throws', () => {
    expect(() => parseSessionedCommand({ waitForPageLoad: { timeout: '5000' } })).toThrow();
  });
});
