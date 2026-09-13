import { describe, it, expect } from 'vitest';
import { compactWithinBlocks } from '../../src/compact/compactWithin.js';

describe('compactWithinBlocks', () => {
  // AC1: Two consecutive same-selector+nth within blocks → merged, do concatenated
  it('AC1: merges two consecutive within blocks with same selector and nth', () => {
    const doc = {
      commands: [
        { within: { 'data-testid': 'row', nth: 0, do: [{ tapOn: 'btn-a' }] } },
        { within: { 'data-testid': 'row', nth: 0, do: [{ tapOn: 'btn-b' }] } },
      ],
    };
    const result = compactWithinBlocks(doc) as any;
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].within.do).toEqual([{ tapOn: 'btn-a' }, { tapOn: 'btn-b' }]);
  });

  // AC2: Same selector, different nth → NOT merged
  it('AC2: does not merge within blocks with same selector but different nth', () => {
    const doc = {
      commands: [
        { within: { text: 'row', nth: 0, do: [{ tapOn: 'btn-a' }] } },
        { within: { text: 'row', nth: 1, do: [{ tapOn: 'btn-b' }] } },
      ],
    };
    const result = compactWithinBlocks(doc) as any;
    expect(result.commands).toHaveLength(2);
    expect(result.commands[0].within.do).toEqual([{ tapOn: 'btn-a' }]);
    expect(result.commands[1].within.do).toEqual([{ tapOn: 'btn-b' }]);
  });

  // AC3: Same selector, one has nth and other doesn't → NOT merged
  it('AC3: does not merge within blocks where one has nth and the other does not', () => {
    const doc = {
      commands: [
        { within: { text: 'row', nth: 0, do: [{ tapOn: 'btn-a' }] } },
        { within: { text: 'row', do: [{ tapOn: 'btn-b' }] } },
      ],
    };
    const result = compactWithinBlocks(doc) as any;
    expect(result.commands).toHaveLength(2);
    expect(result.commands[0].within.do).toEqual([{ tapOn: 'btn-a' }]);
    expect(result.commands[1].within.do).toEqual([{ tapOn: 'btn-b' }]);
  });

  // AC4: Different selector keys → NOT merged
  it('AC4: does not merge within blocks with different selector keys', () => {
    const doc = {
      commands: [
        { within: { text: 'row', do: [{ tapOn: 'btn-a' }] } },
        { within: { 'data-testid': 'row', do: [{ tapOn: 'btn-b' }] } },
      ],
    };
    const result = compactWithinBlocks(doc) as any;
    expect(result.commands).toHaveLength(2);
    expect(result.commands[0].within.do).toEqual([{ tapOn: 'btn-a' }]);
    expect(result.commands[1].within.do).toEqual([{ tapOn: 'btn-b' }]);
  });

  // AC5: Same selector key, different values → NOT merged
  it('AC5: does not merge within blocks with same selector key but different values', () => {
    const doc = {
      commands: [
        { within: { text: 'Alice', do: [{ tapOn: 'btn-a' }] } },
        { within: { text: 'Bob', do: [{ tapOn: 'btn-b' }] } },
      ],
    };
    const result = compactWithinBlocks(doc) as any;
    expect(result.commands).toHaveLength(2);
    expect(result.commands[0].within.do).toEqual([{ tapOn: 'btn-a' }]);
    expect(result.commands[1].within.do).toEqual([{ tapOn: 'btn-b' }]);
  });

  // AC6: Non-within command between two mergeable blocks → both remain separate
  it('AC6: does not merge within blocks separated by a non-within command', () => {
    const doc = {
      commands: [
        { within: { text: 'row', do: [{ tapOn: 'btn-a' }] } },
        { tapOn: 'some-button' },
        { within: { text: 'row', do: [{ tapOn: 'btn-b' }] } },
      ],
    };
    const result = compactWithinBlocks(doc) as any;
    expect(result.commands).toHaveLength(3);
    expect(result.commands[0].within.do).toEqual([{ tapOn: 'btn-a' }]);
    expect(result.commands[1]).toEqual({ tapOn: 'some-button' });
    expect(result.commands[2].within.do).toEqual([{ tapOn: 'btn-b' }]);
  });

  // AC7: Three consecutive mergeable blocks → one block with all do actions
  it('AC7: merges three consecutive within blocks with same selector into one', () => {
    const doc = {
      commands: [
        { within: { text: 'row', do: [{ tapOn: 'btn-a' }] } },
        { within: { text: 'row', do: [{ tapOn: 'btn-b' }] } },
        { within: { text: 'row', do: [{ tapOn: 'btn-c' }] } },
      ],
    };
    const result = compactWithinBlocks(doc) as any;
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].within.do).toEqual([
      { tapOn: 'btn-a' },
      { tapOn: 'btn-b' },
      { tapOn: 'btn-c' },
    ]);
  });

  // AC8: No within blocks → commands unchanged
  it('AC8: returns commands unchanged when there are no within blocks', () => {
    const doc = {
      commands: [{ tapOn: 'button-1' }, { tapOn: 'button-2' }, { assertVisible: 'some-text' }],
    };
    const result = compactWithinBlocks(doc) as any;
    expect(result.commands).toHaveLength(3);
    expect(result.commands).toEqual(doc.commands);
  });

  // AC9: Empty commands array → unchanged
  it('AC9: returns empty commands array unchanged', () => {
    const doc = { commands: [] };
    const result = compactWithinBlocks(doc) as any;
    expect(result.commands).toEqual([]);
  });

  // Edge: nth:0 vs absent nth → not merged
  it('Edge: nth:0 and absent nth are not merged (0 is falsy but distinct from absent)', () => {
    const doc = {
      commands: [
        { within: { text: 'row', nth: 0, do: [{ tapOn: 'btn-a' }] } },
        { within: { text: 'row', do: [{ tapOn: 'btn-b' }] } },
      ],
    };
    const result = compactWithinBlocks(doc) as any;
    expect(result.commands).toHaveLength(2);
  });

  // Edge: within with 0 selector keys → pass through unchanged
  it('Edge: within with 0 selector keys passes through unchanged', () => {
    const doc = {
      commands: [{ within: { do: [{ tapOn: 'btn-a' }] } }],
    };
    const result = compactWithinBlocks(doc) as any;
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0]).toEqual({ within: { do: [{ tapOn: 'btn-a' }] } });
  });

  // Edge: within with 2+ selector keys → pass through unchanged
  it('Edge: within with 2+ selector keys passes through unchanged', () => {
    const doc = {
      commands: [
        { within: { text: 'row', 'data-testid': 'cell', do: [{ tapOn: 'btn-a' }] } },
        { within: { text: 'row', 'data-testid': 'cell', do: [{ tapOn: 'btn-b' }] } },
      ],
    };
    const result = compactWithinBlocks(doc) as any;
    expect(result.commands).toHaveLength(2);
    expect(result.commands[0]).toEqual({
      within: { text: 'row', 'data-testid': 'cell', do: [{ tapOn: 'btn-a' }] },
    });
    expect(result.commands[1]).toEqual({
      within: { text: 'row', 'data-testid': 'cell', do: [{ tapOn: 'btn-b' }] },
    });
  });

  // Additional: mixed scenario with merging and non-merging blocks
  it('merges only consecutive matching within blocks, leaves others intact', () => {
    const doc = {
      commands: [
        { within: { text: 'Alice', do: [{ tapOn: 'edit' }] } },
        { within: { text: 'Alice', do: [{ tapOn: 'save' }] } },
        { within: { text: 'Bob', do: [{ tapOn: 'edit' }] } },
        { within: { text: 'Bob', do: [{ tapOn: 'save' }] } },
      ],
    };
    const result = compactWithinBlocks(doc) as any;
    expect(result.commands).toHaveLength(2);
    expect(result.commands[0].within.text).toBe('Alice');
    expect(result.commands[0].within.do).toEqual([{ tapOn: 'edit' }, { tapOn: 'save' }]);
    expect(result.commands[1].within.text).toBe('Bob');
    expect(result.commands[1].within.do).toEqual([{ tapOn: 'edit' }, { tapOn: 'save' }]);
  });

  // Additional: selector value is coerced to string for comparison
  it('coerces selector value to string when computing withinKey', () => {
    const doc = {
      commands: [
        { within: { nth: 2, 'data-index': 5, do: [{ tapOn: 'btn-a' }] } },
        { within: { nth: 2, 'data-index': 5, do: [{ tapOn: 'btn-b' }] } },
      ],
    };
    const result = compactWithinBlocks(doc) as any;
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].within.do).toEqual([{ tapOn: 'btn-a' }, { tapOn: 'btn-b' }]);
  });

  // Additional: non-object doc passes through
  it('passes through non-object doc unchanged', () => {
    expect(compactWithinBlocks(null)).toBe(null);
    expect(compactWithinBlocks(42)).toBe(42);
    expect(compactWithinBlocks('string')).toBe('string');
  });

  // Additional: doc without commands passes through
  it('passes through doc without commands key unchanged', () => {
    const doc = { steps: [{ tapOn: 'btn' }] };
    const result = compactWithinBlocks(doc) as any;
    expect(result).toEqual(doc);
  });
});

// ─── compactWithinBlocks — generator B ───────────────────────────────────────

describe('compactWithinBlocks — generator B', () => {

  // ── basic merge: same selector, no nth ───────────────────────────────────

  it('B-01: merges two consecutive within blocks with identical selector into one block', () => {
    const input = {
      commands: [
        { within: { text: 'Alice', do: [{ tapOn: 'Edit' }] } },
        { within: { text: 'Alice', do: [{ tapOn: 'Save' }] } },
      ],
    };
    const result = compactWithinBlocks(input) as any;
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].within.do).toHaveLength(2);
  });

  it('B-02: merged block preserves first block\'s `do` items before second block\'s', () => {
    const input = {
      commands: [
        { within: { text: 'Alice', do: [{ tapOn: 'Edit' }] } },
        { within: { text: 'Alice', do: [{ tapOn: 'Save' }] } },
      ],
    };
    const result = compactWithinBlocks(input) as any;
    expect(result.commands[0].within.do[0]).toEqual({ tapOn: 'Edit' });
    expect(result.commands[0].within.do[1]).toEqual({ tapOn: 'Save' });
  });

  // ── nth: identical value merges, differing value does not ────────────────

  it('B-03: merges blocks that share both selector and nth', () => {
    const input = {
      commands: [
        { within: { text: 'Row', nth: 3, do: [{ tapOn: 'Edit' }] } },
        { within: { text: 'Row', nth: 3, do: [{ tapOn: 'Delete' }] } },
      ],
    };
    const result = compactWithinBlocks(input) as any;
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].within.nth).toBe(3);
    expect(result.commands[0].within.do).toHaveLength(2);
  });

  it('B-04: nth values 1 vs 2 prevent merge even when selector matches', () => {
    const input = {
      commands: [
        { within: { text: 'Row', nth: 1, do: [{ tapOn: 'A' }] } },
        { within: { text: 'Row', nth: 2, do: [{ tapOn: 'B' }] } },
      ],
    };
    const result = compactWithinBlocks(input) as any;
    expect(result.commands).toHaveLength(2);
  });

  it('B-05: nth:0 vs absent nth are NOT merged (0 !== undefined)', () => {
    const input = {
      commands: [
        { within: { text: 'Row', nth: 0, do: [{ tapOn: 'A' }] } },
        { within: { text: 'Row', do: [{ tapOn: 'B' }] } },
      ],
    };
    const result = compactWithinBlocks(input) as any;
    expect(result.commands).toHaveLength(2);
  });

  it('B-06: absent nth vs nth:0 are NOT merged (undefined !== 0)', () => {
    const input = {
      commands: [
        { within: { text: 'Row', do: [{ tapOn: 'A' }] } },
        { within: { text: 'Row', nth: 0, do: [{ tapOn: 'B' }] } },
      ],
    };
    const result = compactWithinBlocks(input) as any;
    expect(result.commands).toHaveLength(2);
  });

  // ── selector value mismatch ───────────────────────────────────────────────

  it('B-07: different selector values block merge', () => {
    const input = {
      commands: [
        { within: { text: 'Alice', do: [{ tapOn: 'Edit' }] } },
        { within: { text: 'Bob', do: [{ tapOn: 'Edit' }] } },
      ],
    };
    const result = compactWithinBlocks(input) as any;
    expect(result.commands).toHaveLength(2);
  });

  it('B-08: different selector key types block merge even with same value', () => {
    const input = {
      commands: [
        { within: { text: 'row', do: [{ tapOn: 'A' }] } },
        { within: { 'data-testid': 'row', do: [{ tapOn: 'B' }] } },
      ],
    };
    const result = compactWithinBlocks(input) as any;
    expect(result.commands).toHaveLength(2);
  });

  // ── non-within separator ─────────────────────────────────────────────────

  it('B-09: a non-within command between two mergeable blocks acts as a separator', () => {
    const input = {
      commands: [
        { within: { text: 'Row', do: [{ tapOn: 'A' }] } },
        { goto: 'http://example.com' },
        { within: { text: 'Row', do: [{ tapOn: 'B' }] } },
      ],
    };
    const result = compactWithinBlocks(input) as any;
    expect(result.commands).toHaveLength(3);
  });

  it('B-10: the separating non-within command is preserved in place', () => {
    const input = {
      commands: [
        { within: { text: 'Row', do: [{ tapOn: 'A' }] } },
        { tapOn: 'separator-button' },
        { within: { text: 'Row', do: [{ tapOn: 'B' }] } },
      ],
    };
    const result = compactWithinBlocks(input) as any;
    expect(result.commands[1]).toEqual({ tapOn: 'separator-button' });
  });

  // ── 3+ consecutive → collapse to 1 ───────────────────────────────────────

  it('B-11: three consecutive same-selector within blocks collapse to one', () => {
    const input = {
      commands: [
        { within: { text: 'Row', do: [{ tapOn: 'A' }] } },
        { within: { text: 'Row', do: [{ tapOn: 'B' }] } },
        { within: { text: 'Row', do: [{ tapOn: 'C' }] } },
      ],
    };
    const result = compactWithinBlocks(input) as any;
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].within.do).toHaveLength(3);
    expect(result.commands[0].within.do).toEqual([
      { tapOn: 'A' },
      { tapOn: 'B' },
      { tapOn: 'C' },
    ]);
  });

  // ── mixed run ────────────────────────────────────────────────────────────

  it('B-12: [A,A,goto,A,A] produces 2 merged within blocks plus the goto', () => {
    const input = {
      commands: [
        { within: { text: 'Row', do: [{ tapOn: 'A1' }] } },
        { within: { text: 'Row', do: [{ tapOn: 'A2' }] } },
        { goto: 'http://example.com' },
        { within: { text: 'Row', do: [{ tapOn: 'A3' }] } },
        { within: { text: 'Row', do: [{ tapOn: 'A4' }] } },
      ],
    };
    const result = compactWithinBlocks(input) as any;
    expect(result.commands).toHaveLength(3);
    expect(result.commands[0].within.do).toEqual([{ tapOn: 'A1' }, { tapOn: 'A2' }]);
    expect(result.commands[1]).toEqual({ goto: 'http://example.com' });
    expect(result.commands[2].within.do).toEqual([{ tapOn: 'A3' }, { tapOn: 'A4' }]);
  });

  // ── empty / no-within commands ────────────────────────────────────────────

  it('B-13: empty commands array is returned unchanged', () => {
    const input = { commands: [] };
    const result = compactWithinBlocks(input) as any;
    expect(result.commands).toEqual([]);
  });

  it('B-14: commands with no within blocks pass through unchanged', () => {
    const input = {
      commands: [{ tapOn: 'btn1' }, { assertVisible: 'label' }, { goto: 'http://x.com' }],
    };
    const result = compactWithinBlocks(input) as any;
    expect(result.commands).toHaveLength(3);
    expect(result.commands).toEqual(input.commands);
  });

  // ── 0 selector keys (only `do`) → pass through ───────────────────────────

  it('B-15: within block with only a `do` key (0 selector keys) passes through as-is', () => {
    const only = { within: { do: [{ tapOn: 'X' }] } };
    const input = { commands: [only] };
    const result = compactWithinBlocks(input) as any;
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0]).toEqual(only);
  });

  it('B-16: two adjacent 0-selector-key within blocks are NOT merged', () => {
    const input = {
      commands: [
        { within: { do: [{ tapOn: 'X' }] } },
        { within: { do: [{ tapOn: 'Y' }] } },
      ],
    };
    const result = compactWithinBlocks(input) as any;
    expect(result.commands).toHaveLength(2);
  });

  // ── 2+ selector keys → pass through ──────────────────────────────────────

  it('B-17: within with 2 selector keys passes through without merging', () => {
    const block = { within: { text: 'Row', 'data-testid': 'cell', do: [{ tapOn: 'A' }] } };
    const input = { commands: [block, block] };
    const result = compactWithinBlocks(input) as any;
    expect(result.commands).toHaveLength(2);
    expect(result.commands[0]).toEqual(block);
    expect(result.commands[1]).toEqual(block);
  });

  // ── immutability ─────────────────────────────────────────────────────────

  it('B-18: does not mutate the input document', () => {
    const input = {
      commands: [
        { within: { text: 'Row', do: [{ tapOn: 'A' }] } },
        { within: { text: 'Row', do: [{ tapOn: 'B' }] } },
      ],
    };
    const snapshot = JSON.stringify(input);
    compactWithinBlocks(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('B-19: does not mutate `do` arrays of the original command objects', () => {
    const cmd1 = { within: { text: 'Row', do: [{ tapOn: 'A' }] } };
    const cmd2 = { within: { text: 'Row', do: [{ tapOn: 'B' }] } };
    const originalLen1 = cmd1.within.do.length;
    const originalLen2 = cmd2.within.do.length;
    compactWithinBlocks({ commands: [cmd1, cmd2] });
    expect(cmd1.within.do).toHaveLength(originalLen1);
    expect(cmd2.within.do).toHaveLength(originalLen2);
  });

  it('B-20: returns a new document object (not the same reference)', () => {
    const input = { commands: [{ within: { text: 'Row', do: [{ tapOn: 'A' }] } }] };
    const result = compactWithinBlocks(input);
    expect(result).not.toBe(input);
  });

  // ── preserves other top-level doc fields ─────────────────────────────────

  it('B-21: preserves other top-level fields on the document alongside commands', () => {
    const input = {
      appId: 'http://localhost:3000',
      vars: { env: 'staging' },
      commands: [
        { within: { text: 'Row', do: [{ tapOn: 'A' }] } },
        { within: { text: 'Row', do: [{ tapOn: 'B' }] } },
      ],
    };
    const result = compactWithinBlocks(input) as any;
    expect(result.appId).toBe('http://localhost:3000');
    expect(result.vars).toEqual({ env: 'staging' });
  });
});
