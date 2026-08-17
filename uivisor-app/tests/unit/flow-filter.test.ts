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
import type { FlowFile } from '../../src/types';

function makeFlow(partial: Partial<FlowFile> & { filePath: string }): FlowFile {
  return {
    baseUrl: 'http://localhost',
    commands: [],
    tags: [],
    shared: false,
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

// ─── Shared-flow filtering ────────────────────────────────────────────────────

describe('filterFlows — shared flow filtering', () => {
  // AC10: shared flows are excluded from included list silently
  it('AC10: excludes shared flows from directory scan results', () => {
    const flows = [
      makeFlow({ filePath: 'login.yaml', shared: false }),
      makeFlow({ filePath: 'helpers/setup.yaml', shared: true }),
      makeFlow({ filePath: 'checkout.yaml', shared: false }),
    ];

    const { included, excluded } = filterFlows(flows, []);
    expect(included).not.toContain('helpers/setup.yaml');
    expect(excluded).toContain('helpers/setup.yaml');
  });

  it('shared flows are reported in the excluded list', () => {
    const flows = [
      makeFlow({ filePath: 'shared/login-steps.yaml', shared: true }),
      makeFlow({ filePath: 'shared/nav.yaml', shared: true }),
      makeFlow({ filePath: 'main.yaml', shared: false }),
    ];

    const { excluded } = filterFlows(flows, []);
    expect(excluded).toHaveLength(2);
    expect(excluded).toContain('shared/login-steps.yaml');
    expect(excluded).toContain('shared/nav.yaml');
  });

  it('shared flows are excluded even when they match the tag filter', () => {
    const flows = [
      makeFlow({ filePath: 'shared/login.yaml', shared: true, tags: ['smoke'] }),
      makeFlow({ filePath: 'login-test.yaml', shared: false, tags: ['smoke'] }),
    ];

    const { included } = filterFlows(flows, ['smoke']);
    expect(included).not.toContain('shared/login.yaml');
    expect(included).toContain('login-test.yaml');
  });

  // All flows shared → included is empty
  it('returns empty included array when all flows are shared', () => {
    const flows = [
      makeFlow({ filePath: 'a.yaml', shared: true }),
      makeFlow({ filePath: 'b.yaml', shared: true }),
    ];

    const { included } = filterFlows(flows, []);
    expect(included).toHaveLength(0);
  });
});

// ─── Single shared-flow direct target guard ────────────────────────────────────

describe('isSingleSharedFlowTarget', () => {
  it('AC11: detects a single shared flow passed as a direct target', async () => {
    const { isSingleSharedFlowTarget } = await import('../../src/cli/filter');
    expect(isSingleSharedFlowTarget(makeFlow({ filePath: 'shared.yaml', shared: true }))).toBe(true);
  });

  it('returns false for a non-shared flow', async () => {
    const { isSingleSharedFlowTarget } = await import('../../src/cli/filter');
    expect(isSingleSharedFlowTarget(makeFlow({ filePath: 'test.yaml', shared: false }))).toBe(false);
  });
});
