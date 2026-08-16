/**
 * tests/unit/args.test.ts
 *
 * Unit tests for CLI argument parsing and target resolution.
 * Covers ACs 42–47.
 *
 * - parseArgs: process.argv → ParsedArgs (headed, slowMo, reporter, target)
 * - resolveTarget: file-or-dir string → string[] of .yaml paths
 *
 * Filesystem calls are mocked so no real I/O happens.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs');

import * as fs from 'fs';
import { parseArgs } from '../../src/cli/args';
import { resolveTarget } from '../../src/cli/resolver';

// ─── parseArgs ────────────────────────────────────────────────────────────────

describe('parseArgs', () => {
  /**
   * Simulate argv the way Node.js delivers it:
   *   argv[0] = node binary path
   *   argv[1] = script path
   *   argv[2+] = user args
   */
  function argv(...args: string[]): string[] {
    return ['/usr/bin/node', '/usr/local/bin/webt', ...args];
  }

  // AC42: no --headed flag → headless (default)
  it('AC42: no --headed flag → headed: false', () => {
    const result = parseArgs(argv('test', 'flow.yaml'));
    expect(result.headed).toBe(false);
  });

  // AC43: --headed flag → headed mode
  it('AC43: --headed flag sets headed: true', () => {
    const result = parseArgs(argv('test', 'flow.yaml', '--headed'));
    expect(result.headed).toBe(true);
  });

  // AC44: --slow-mo <ms> is parsed
  it('AC44: --slow-mo 500 sets slowMo: 500', () => {
    const result = parseArgs(argv('test', 'flow.yaml', '--slow-mo', '500'));
    expect(result.slowMo).toBe(500);
  });

  it('AC44: --slow-mo 0 sets slowMo: 0', () => {
    const result = parseArgs(argv('test', 'flow.yaml', '--slow-mo', '0'));
    expect(result.slowMo).toBe(0);
  });

  it('default slowMo is 0 when --slow-mo is not supplied', () => {
    const result = parseArgs(argv('test', 'flow.yaml'));
    expect(result.slowMo).toBe(0);
  });

  // --reporter html
  it('--reporter html sets reporter: "html"', () => {
    const result = parseArgs(argv('test', 'flow.yaml', '--reporter', 'html'));
    expect(result.reporter).toBe('html');
  });

  // --reporter md
  it('--reporter md sets reporter: "md"', () => {
    const result = parseArgs(argv('test', 'flow.yaml', '--reporter', 'md'));
    expect(result.reporter).toBe('md');
  });

  // AC63: no --reporter flag → reporter: null
  it('AC63: no --reporter flag → reporter: null', () => {
    const result = parseArgs(argv('test', 'flow.yaml'));
    expect(result.reporter).toBeNull();
  });

  // Target is captured
  it('captures the target positional argument', () => {
    const result = parseArgs(argv('test', 'flows/login.yaml'));
    expect(result.target).toBe('flows/login.yaml');
  });

  it('captures a directory as the target', () => {
    const result = parseArgs(argv('test', 'flows/'));
    expect(result.target).toBe('flows/');
  });

  // AC62: --headed and --reporter can be combined
  it('AC62: --headed and --reporter html can be used together', () => {
    const result = parseArgs(argv('test', 'flow.yaml', '--headed', '--reporter', 'html'));
    expect(result.headed).toBe(true);
    expect(result.reporter).toBe('html');
  });

  // AC62: --slow-mo and --reporter can be combined
  it('AC62: --slow-mo and --reporter md can be used together', () => {
    const result = parseArgs(argv('test', 'flow.yaml', '--slow-mo', '200', '--reporter', 'md'));
    expect(result.slowMo).toBe(200);
    expect(result.reporter).toBe('md');
  });

  // AC62: all three flags together
  it('AC62: --headed --slow-mo --reporter can all be combined', () => {
    const result = parseArgs(
      argv('test', 'flow.yaml', '--headed', '--slow-mo', '100', '--reporter', 'html'),
    );
    expect(result.headed).toBe(true);
    expect(result.slowMo).toBe(100);
    expect(result.reporter).toBe('html');
  });
});

// ─── resolveTarget ────────────────────────────────────────────────────────────

describe('resolveTarget', () => {
  const mockExistsSync = vi.mocked(fs.existsSync);
  const mockStatSync = vi.mocked(fs.statSync);
  const mockReaddirSync = vi.mocked(fs.readdirSync);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Single file ────────────────────────────────────────────────────────────

  it('returns [filePath] when target is a single existing .yaml file', () => {
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as unknown as fs.Stats);

    const result = resolveTarget('flows/login.yaml');
    expect(result).toEqual(['flows/login.yaml']);
  });

  // AC47: file does not exist → throws "File not found: <target>"
  it('AC47: throws "File not found: nonexistent.yaml" when file is missing', () => {
    mockExistsSync.mockReturnValue(false);

    expect(() => resolveTarget('nonexistent.yaml')).toThrow(
      'File not found: nonexistent.yaml',
    );
  });

  it('AC47: error message for missing file includes the exact path given', () => {
    mockExistsSync.mockReturnValue(false);

    expect(() => resolveTarget('path/to/missing.yaml')).toThrow(
      'File not found: path/to/missing.yaml',
    );
  });

  // ── Directory mode ─────────────────────────────────────────────────────────

  // AC45: directory with YAML files → sorted list
  it('AC45: returns all .yaml files found in a directory', () => {
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isDirectory: () => true } as unknown as fs.Stats);
    mockReaddirSync.mockReturnValue([
      'checkout.yaml',
      'login.yaml',
      'README.md',
      'helper.ts',
    ] as unknown as fs.Dirent[]);

    const result = resolveTarget('flows/');
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.endsWith('.yaml'))).toBe(true);
  });

  it('AC45: files from directory are returned with the directory prefix in the path', () => {
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isDirectory: () => true } as unknown as fs.Stats);
    mockReaddirSync.mockReturnValue(['login.yaml'] as unknown as fs.Dirent[]);

    const result = resolveTarget('flows/');
    expect(result[0]).toContain('login.yaml');
  });

  // AC46: empty directory → error "No flow files found in: <dir>"
  it('AC46: throws "No flow files found in: flows/" when directory has no .yaml files', () => {
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isDirectory: () => true } as unknown as fs.Stats);
    mockReaddirSync.mockReturnValue(['README.md', 'config.json'] as unknown as fs.Dirent[]);

    expect(() => resolveTarget('flows/')).toThrow('No flow files found in: flows/');
  });

  it('AC46: throws the correct error message when the directory is completely empty', () => {
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isDirectory: () => true } as unknown as fs.Stats);
    mockReaddirSync.mockReturnValue([] as unknown as fs.Dirent[]);

    expect(() => resolveTarget('flows/')).toThrow('No flow files found in: flows/');
  });

  it('AC46: error includes the directory path that was searched', () => {
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isDirectory: () => true } as unknown as fs.Stats);
    mockReaddirSync.mockReturnValue([] as unknown as fs.Dirent[]);

    expect(() => resolveTarget('tests/e2e/')).toThrow(
      /No flow files found in:.*tests\/e2e\//,
    );
  });

  // Non-.yaml extensions are ignored
  it('ignores non-.yaml files in a directory', () => {
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isDirectory: () => true } as unknown as fs.Stats);
    mockReaddirSync.mockReturnValue([
      'flow.yaml',
      'flow.yml',   // .yml is not the webt extension
      'README.md',
      'tsconfig.json',
    ] as unknown as fs.Dirent[]);

    const result = resolveTarget('flows/');
    // Only .yaml files
    expect(result.every((p) => p.endsWith('.yaml'))).toBe(true);
    expect(result).toHaveLength(1);
  });
});
