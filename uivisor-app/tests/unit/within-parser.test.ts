/**
 * tests/unit/within-parser.test.ts
 *
 * Unit tests for `within` parsing in commandParser.ts.
 * Covers: TC-032, TC-037, TC-039, TC-042, TC-043, TC-044
 */

import { describe, it, expect } from 'vitest';
import { parseCommand } from '../../src/parser/commandParser';
import type { Command, SessionedCommand } from '@uivisor/core';

// ─── TC-032: basic parsing ────────────────────────────────────────────────────

describe('within parser — basic shape (TC-032)', () => {
  it('produces correct Command shape from valid YAML object', () => {
    const result = parseCommand({ within: { text: 'Alice', do: [{ tapOn: 'Delete' }] } });

    expect(result.type).toBe('within');
    if (result.type !== 'within') return;

    expect(result.selector).toBe('text=Alice');
    expect(result.nth).toBeUndefined();
    expect(Array.isArray(result.do)).toBe(true);
    expect(result.do).toHaveLength(1);

    const inner = result.do[0] as SessionedCommand;
    expect(inner.command.type).toBe('tapOn');
  });

  it('do array contains fully parsed inner commands', () => {
    const result = parseCommand({ within: { text: 'Alice', do: [{ tapOn: 'Delete' }] } });
    if (result.type !== 'within') throw new Error('wrong type');

    const inner = result.do[0] as SessionedCommand;
    const innerCmd = inner.command as Command;
    expect(innerCmd.type).toBe('tapOn');
  });
});

// ─── TC-037: nth field parsed as a number ────────────────────────────────────

describe('within parser — nth field (TC-037)', () => {
  it('parses nth as a JavaScript number', () => {
    const result = parseCommand({ within: { text: 'Row', nth: 1, do: [{ tapOn: 'Edit' }] } });

    expect(result.type).toBe('within');
    if (result.type !== 'within') return;

    expect(result.selector).toBe('text=Row');
    expect(result.nth).toBe(1);
    expect(typeof result.nth).toBe('number');
  });

  it('throws on non-integer nth (string)', () => {
    expect(() =>
      parseCommand({ within: { text: 'Row', nth: 'first', do: [{ tapOn: 'Edit' }] } })
    ).toThrow(/nth/i);
  });

  it('throws on float nth', () => {
    expect(() =>
      parseCommand({ within: { text: 'Row', nth: 1.5, do: [{ tapOn: 'Edit' }] } })
    ).toThrow(/nth/i);
  });
});

// ─── TC-039: 2-level nested within ───────────────────────────────────────────

describe('within parser — nested within (TC-039)', () => {
  it('parses 2-level nested within recursively', () => {
    const result = parseCommand({
      within: {
        text: 'Section A',
        do: [
          {
            within: {
              text: 'Subsection',
              do: [{ tapOn: 'Save' }],
            },
          },
        ],
      },
    });

    expect(result.type).toBe('within');
    if (result.type !== 'within') return;

    expect(result.selector).toBe('text=Section A');
    const outerDo = result.do;
    expect(outerDo).toHaveLength(1);

    const inner = (outerDo[0] as SessionedCommand).command;
    expect(inner.type).toBe('within');
    if (inner.type !== 'within') return;

    expect(inner.selector).toBe('text=Subsection');
    const innerDo = inner.do;
    expect(innerDo).toHaveLength(1);

    const deepest = (innerDo[0] as SessionedCommand).command;
    expect(deepest.type).toBe('tapOn');
  });
});

// ─── TC-042: do key is never included in selector ────────────────────────────

describe('within parser — do key excluded from selector (TC-042)', () => {
  it('selector is "text=Section", not containing "do"', () => {
    const result = parseCommand({
      within: { text: 'Section', do: [{ tapOn: 'Save' }] },
    });

    expect(result.type).toBe('within');
    if (result.type !== 'within') return;

    expect(result.selector).toBe('text=Section');
    expect(result.selector).not.toContain('do');
    expect(Array.isArray(result.do)).toBe(true);
  });
});

// ─── TC-043: nth optional ─────────────────────────────────────────────────────

describe('within parser — nth optional (TC-043)', () => {
  it('absent nth produces undefined', () => {
    const result = parseCommand({ within: { text: 'Row', do: [{ tapOn: 'Edit' }] } });

    expect(result.type).toBe('within');
    if (result.type !== 'within') return;

    expect(result.nth).toBeUndefined();
  });

  it('nth: 2 is parsed as number 2', () => {
    const result = parseCommand({ within: { text: 'Row', nth: 2, do: [{ tapOn: 'Edit' }] } });

    expect(result.type).toBe('within');
    if (result.type !== 'within') return;

    expect(result.nth).toBe(2);
  });
});

// ─── TC-044: missing do key is a parse error ─────────────────────────────────

describe('within parser — missing do key (TC-044)', () => {
  it('throws when do key is missing', () => {
    expect(() =>
      parseCommand({ within: { text: 'Alice' } })
    ).toThrow(/do.*within|within.*do/i);
  });
});

// ─── TC-048–TC-051: nth must be non-negative (issue #44) ─────────────────────

describe('within parser — nth must be non-negative (issue #44)', () => {
  it('TC-048: nth:-1 throws with message referencing both "nth" and "non-negative"', () => {
    expect(() =>
      parseCommand({ within: { text: 'Row', nth: -1, do: [{ tapOn: 'Edit' }] } })
    ).toThrow(/nth.*non.?negative|non.?negative.*nth/i);
  });

  it('TC-049: nth:-2 is also rejected (guard not hard-coded to -1)', () => {
    expect(() =>
      parseCommand({ within: { text: 'Row', nth: -2, do: [{ tapOn: 'Edit' }] } })
    ).toThrow(/nth/i);
  });

  it('TC-050: nth:0 is valid; result.nth equals 0 and is a number', () => {
    const result = parseCommand({ within: { text: 'Row', nth: 0, do: [{ tapOn: 'Edit' }] } });
    expect(result.type).toBe('within');
    if (result.type !== 'within') return;
    expect(result.nth).toBe(0);
    expect(typeof result.nth).toBe('number');
  });

  it('TC-051: nth:-0 is treated as 0 (JS -0 === 0) and does not throw', () => {
    const result = parseCommand({ within: { text: 'Row', nth: -0, do: [{ tapOn: 'Edit' }] } });
    expect(result.type).toBe('within');
    if (result.type !== 'within') return;
    // Use === rather than toBe: -0 === 0 is true in JS; toBe uses Object.is where they differ
    expect(result.nth === 0).toBe(true);
  });
});
