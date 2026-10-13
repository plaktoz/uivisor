/**
 * tests/unit/timeout-config.test.ts
 *
 * Unit tests for the `defaultTimeout`/`navigationTimeout` header and shared-config
 * keys (S10, T7). Covers AC57 (parse side), AC65, AC66, AC67, AC68, AC69.
 *
 * External dependencies (fs, js-yaml) are isolated by mocking src/parser/reader.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/parser/reader');

import { loadAndParse } from '../../src/parser/index';
import * as reader from '../../src/parser/reader';

describe('timeout header/config keys', () => {
  const mockReadYamlFile = vi.mocked(reader.readYamlFile);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Header acceptance (AC65, AC67) ─────────────────────────────────────────

  it('AC65: a flow header with defaultTimeout and navigationTimeout parses without an Unknown header key error', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://localhost',
      defaultTimeout: 15000,
      navigationTimeout: 30000,
      commands: [{ goto: 'http://localhost' }],
    });
    expect(() => loadAndParse('/flows/f.yaml')).not.toThrow();
  });

  it('AC67 (a): sla stays an ordinary var when set in the shared config', () => {
    mockReadYamlFile
      .mockReturnValueOnce({
        appId: 'http://localhost',
        config: 'cfg.yaml',
        commands: [{ setVar: 's=${sla}' }, { testVarSet: { name: 's', expected: '3000' } }],
      })
      .mockReturnValueOnce({ sla: 3000 });
    const result = loadAndParse('/flows/f.yaml');
    expect(result.vars).toMatchObject({ sla: '3000' });
  });

  it('AC67 (b): a flow header containing sla fails to parse with today\'s Unknown header key error', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://localhost',
      sla: 3000,
      commands: [{ goto: 'http://localhost' }],
    });
    expect(() => loadAndParse('/flows/f.yaml')).toThrow('Unknown header key: sla in /flows/f.yaml');
  });

  it('AC67 (c): a flow header containing loading fails to parse with today\'s Unknown header key error', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://localhost',
      loading: {},
      commands: [{ goto: 'http://localhost' }],
    });
    expect(() => loadAndParse('/flows/f.yaml')).toThrow('Unknown header key: loading in /flows/f.yaml');
  });

  // ─── Reserved keys stop becoming vars (AC66) ────────────────────────────────

  it('AC66: defaultTimeout and navigationTimeout are stripped from file.vars when set in the shared config, other config vars survive', () => {
    mockReadYamlFile
      .mockReturnValueOnce({
        appId: 'http://localhost',
        config: 'cfg.yaml',
        commands: [{ goto: 'http://localhost' }],
      })
      .mockReturnValueOnce({ defaultTimeout: 15000, navigationTimeout: 30000, base: 'http://x' });
    const result = loadAndParse('/flows/f.yaml');
    expect(result.vars).not.toHaveProperty('defaultTimeout');
    expect(result.vars).not.toHaveProperty('navigationTimeout');
    expect(result.vars).toMatchObject({ base: 'http://x' });
  });

  // ─── Literal validation (AC68) ──────────────────────────────────────────────

  const HEADER_INVALID_CASES: Array<[unknown, string]> = [
    [0, '0'],
    [-1, '-1'],
    [1.5, '1.5'],
    ['abc', 'abc'],
    [true, 'true'],
  ];

  it.each(HEADER_INVALID_CASES)('AC68: header defaultTimeout: %s throws "Invalid defaultTimeout: ... got %s in <file>"', (raw, expected) => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://localhost',
      defaultTimeout: raw,
      commands: [{ goto: 'http://localhost' }],
    });
    expect(() => loadAndParse('/flows/f.yaml')).toThrow(
      `Invalid defaultTimeout: must be a positive integer, got ${expected} in /flows/f.yaml`,
    );
  });

  it('AC68: header navigationTimeout: 0 throws the parallel navigationTimeout message', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://localhost',
      navigationTimeout: 0,
      commands: [{ goto: 'http://localhost' }],
    });
    expect(() => loadAndParse('/flows/f.yaml')).toThrow(
      'Invalid navigationTimeout: must be a positive integer, got 0 in /flows/f.yaml',
    );
  });

  it('AC68: config defaultTimeout: 0 throws with the config path (as written) as the source', () => {
    mockReadYamlFile
      .mockReturnValueOnce({
        appId: 'http://localhost',
        config: 'cfg.yaml',
        commands: [{ goto: 'http://localhost' }],
      })
      .mockReturnValueOnce({ defaultTimeout: 0 });
    expect(() => loadAndParse('/flows/f.yaml')).toThrow(
      'Invalid defaultTimeout: must be a positive integer, got 0 in cfg.yaml',
    );
  });

  it('AC68: config navigationTimeout: -1 throws the config-source format', () => {
    mockReadYamlFile
      .mockReturnValueOnce({
        appId: 'http://localhost',
        config: 'cfg.yaml',
        commands: [{ goto: 'http://localhost' }],
      })
      .mockReturnValueOnce({ navigationTimeout: -1 });
    expect(() => loadAndParse('/flows/f.yaml')).toThrow(
      'Invalid navigationTimeout: must be a positive integer, got -1 in cfg.yaml',
    );
  });

  it('AC68: a digit-only string header value ("15000") is accepted, not rejected', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://localhost',
      defaultTimeout: '15000',
      commands: [{ goto: 'http://localhost' }],
    });
    const result = loadAndParse('/flows/f.yaml');
    expect(result.timeouts?.header.defaultTimeout).toBe(15000);
  });

  it('AC68 / AC57 (a): a ${var}-resolved digit string header value is accepted', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://localhost',
      vars: { t: 1250 },
      defaultTimeout: '${t}',
      commands: [{ goto: 'http://localhost' }],
    });
    const result = loadAndParse('/flows/f.yaml');
    expect(result.timeouts?.header.defaultTimeout).toBe(1250);
  });

  // ─── Child-flow validation still runs (AC69) ────────────────────────────────

  it('AC69: a child flow with header defaultTimeout: 0 fails to parse with the Invalid-defaultTimeout message', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://localhost',
      defaultTimeout: 0,
      commands: [{ goto: 'http://localhost' }],
    });
    expect(() => loadAndParse('/flows/child.yaml')).toThrow(
      /Invalid defaultTimeout: must be a positive integer, got 0/,
    );
  });

  // ─── ${var} resolution timing for header/config values (AC57) ──────────────

  it('AC57 (b): a shared-config value "${env.UIV_T}" resolves at parse time from the environment', () => {
    process.env['UIV_T'] = '1350';
    try {
      mockReadYamlFile
        .mockReturnValueOnce({
          appId: 'http://localhost',
          config: 'cfg.yaml',
          commands: [{ goto: 'http://localhost' }],
        })
        .mockReturnValueOnce({ defaultTimeout: '${env.UIV_T}' });
      const result = loadAndParse('/flows/f.yaml');
      expect(result.timeouts?.config.defaultTimeout).toBe(1350);
    } finally {
      delete process.env['UIV_T'];
    }
  });

  it('AC57 (c): a header value "${fromSetVar}" only ever set by a later setVar fails to parse with an empty-string value', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://localhost',
      defaultTimeout: '${fromSetVar}',
      commands: [{ goto: 'http://localhost' }],
    });
    expect(() => loadAndParse('/flows/f.yaml')).toThrow(
      'Invalid defaultTimeout: must be a positive integer, got  in /flows/f.yaml',
    );
  });
});

describe('PASSES on both versions', () => {
  const mockReadYamlFile = vi.mocked(reader.readYamlFile);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('an existing header/config test for an unrelated key (base) is unaffected', () => {
    mockReadYamlFile
      .mockReturnValueOnce({
        appId: 'http://localhost',
        config: 'cfg.yaml',
        commands: [{ goto: 'http://${base}' }],
      })
      .mockReturnValueOnce({ base: 'example.com' });
    const result = loadAndParse('/flows/f.yaml');
    expect(result.vars).toMatchObject({ base: 'example.com' });
  });
});
