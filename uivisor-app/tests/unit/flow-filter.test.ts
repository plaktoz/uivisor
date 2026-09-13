/**
 * tests/unit/flow-filter.test.ts
 *
 * Unit tests for tag and shared-flow filtering logic.
 * Covers ACs 3–5, 7, 10–11 from the tag/shared flow spec.
 *
 * filterFlows is a pure function — no I/O, no mocking needed.
 */

import { describe, it, expect } from 'vitest';
import { filterFlows } from '../../src/cli/filter';
import type { FlowFile } from '@uivisor/core';

function makeFlow(partial: Partial<FlowFile> & { filePath: string }): FlowFile {
  return {
    baseUrl: 'http://localhost',
    commands: [],
    tags: [],
    ...partial,
  };
}

// ─── Tag filtering ────────────────────────────────────────────────────────────

describe('filterFlows — tag filtering', () => {
  // AC5: no tags filter → all non-shared flows included
  it('AC5: returns all non-shared flows when tags filter is empty', () => {
    const flows = [
      makeFlow({ filePath: 'a.yaml', tags: ['smoke'] }),
      makeFlow({ filePath: 'b.yaml', tags: [] }),
      makeFlow({ filePath: 'c.yaml', tags: ['auth'] }),
    ];

    const { included } = filterFlows(flows, []);
    expect(included).toHaveLength(3);
    expect(included).toContain('a.yaml');
    expect(included).toContain('b.yaml');
    expect(included).toContain('c.yaml');
  });

  // AC3: single tag → only matching flows run
  it('AC3: includes only flows that match the specified tag', () => {
    const flows = [
      makeFlow({ filePath: 'login.yaml', tags: ['smoke'] }),
      makeFlow({ filePath: 'checkout.yaml', tags: ['checkout'] }),
      makeFlow({ filePath: 'untagged.yaml', tags: [] }),
    ];

    const { included } = filterFlows(flows, ['smoke']);
    expect(included).toEqual(['login.yaml']);
  });

  // AC4: multiple tags → OR semantics
  it('AC4: includes flows matching any of the specified tags (OR semantics)', () => {
    const flows = [
      makeFlow({ filePath: 'login.yaml', tags: ['smoke'] }),
      makeFlow({ filePath: 'register.yaml', tags: ['auth'] }),
      makeFlow({ filePath: 'checkout.yaml', tags: ['checkout'] }),
    ];

    const { included } = filterFlows(flows, ['smoke', 'auth']);
    expect(included).toHaveLength(2);
    expect(included).toContain('login.yaml');
    expect(included).toContain('register.yaml');
    expect(included).not.toContain('checkout.yaml');
  });

  // Untagged flows are excluded when a tag filter is active
  it('excludes untagged flows when a tag filter is given', () => {
    const flows = [
      makeFlow({ filePath: 'tagged.yaml', tags: ['smoke'] }),
      makeFlow({ filePath: 'untagged.yaml', tags: [] }),
    ];

    const { included } = filterFlows(flows, ['smoke']);
    expect(included).not.toContain('untagged.yaml');
  });

  // AC7: zero matches → included is empty (caller handles error output)
  it('AC7: returns empty included array when no flows match the tag', () => {
    const flows = [
      makeFlow({ filePath: 'login.yaml', tags: ['smoke'] }),
    ];

    const { included } = filterFlows(flows, ['missing-tag']);
    expect(included).toHaveLength(0);
  });

  // Flow with multiple tags — any match includes it
  it('includes a multi-tagged flow if any of its tags match the filter', () => {
    const flows = [
      makeFlow({ filePath: 'full.yaml', tags: ['smoke', 'regression', 'auth'] }),
    ];

    const { included } = filterFlows(flows, ['regression']);
    expect(included).toContain('full.yaml');
  });
});

