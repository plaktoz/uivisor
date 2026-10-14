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

  // ── --tag flag ─────────────────────────────────────────────────────────────

  it('no --tag flag → tags: []', () => {
    const result = parseArgs(argv('test', 'flow.yaml'));
    expect(result.tags).toEqual([]);
  });

  it('single --tag smoke → tags: ["smoke"]', () => {
    const result = parseArgs(argv('test', 'flow.yaml', '--tag', 'smoke'));
    expect(result.tags).toEqual(['smoke']);
  });

  it('--tag smoke --tag auth → tags: ["smoke", "auth"] (OR semantics)', () => {
    const result = parseArgs(argv('test', 'flow.yaml', '--tag', 'smoke', '--tag', 'auth'));
    expect(result.tags).toEqual(['smoke', 'auth']);
  });

  it('--tag can be combined with --headed', () => {
    const result = parseArgs(argv('test', 'flow.yaml', '--headed', '--tag', 'smoke'));
    expect(result.headed).toBe(true);
    expect(result.tags).toEqual(['smoke']);
  });

  it('--tag can be combined with --reporter html', () => {
    const result = parseArgs(argv('test', 'flow.yaml', '--tag', 'smoke', '--reporter', 'html'));
    expect(result.tags).toEqual(['smoke']);
    expect(result.reporter).toBe('html');
  });
});

describe('--reporter console style', () => {
  function argv(...args: string[]): string[] {
    return ['node', 'uivisor', ...args];
  }

  it('defaults to auto with no file report', () => {
    const result = parseArgs(argv('test', 'flow.yaml'));
    expect(result.console).toBe('auto');
    expect(result.reporter).toBeNull();
  });

  it.each(['plain', 'live'] as const)('--reporter %s sets the console style without a file report', (style) => {
    const result = parseArgs(argv('test', 'flow.yaml', '--reporter', style));
    expect(result.console).toBe(style);
    expect(result.reporter).toBeNull();
  });

  it('a file report and a console style combine in either order', () => {
    for (const args of [['--reporter', 'md', '--reporter', 'live'], ['--reporter', 'live', '--reporter', 'md']]) {
      const result = parseArgs(argv('test', 'flow.yaml', ...args));
      expect(result.reporter, args.join(' ')).toBe('md');
      expect(result.console, args.join(' ')).toBe('live');
    }
  });

  it('the last value wins within each slot', () => {
    const result = parseArgs(argv('test', 'flow.yaml', '--reporter', 'live', '--reporter', 'html', '--reporter', 'plain', '--reporter', 'md'));
    expect(result.console).toBe('plain');
    expect(result.reporter).toBe('md');
  });

  it('usage lists the console styles', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as never);
    expect(() => parseArgs(argv('test'))).toThrow('exit');
    expect(String(write.mock.calls[0][0])).toContain('[--reporter html|md|plain|live (repeatable)]');
    write.mockRestore();
    exit.mockRestore();
  });
});

// ─── --output-dir flag ────────────────────────────────────────────────────────
//
// Decisions documented here so the intent is clear when reading failures:
//
//   • Multiple --output-dir flags:  last value wins (simplest; consistent with
//     how --reporter and --slow-mo behave when repeated).
//   • Empty string value:           stored as-is ("").
//   • Flag-like token as value:     the sequential parser consumes the next
//     token unconditionally, so `--output-dir --headed` stores "--headed" as
//     the outputDir and never sets headed:true.  This is a known parser
//     limitation — callers must not rely on detection of "missing value".
//
// NOTE: makeRunDir() in src/cli/index.ts is unexported.  Its contract
//   (path.resolve(outputDir ?? 'target') passed to mkdirSync) is intentionally
//   omitted here and should be covered either by an integration test or by
//   exporting makeRunDir for unit testing in a future iteration.

describe('--output-dir flag', () => {
  function argv(...args: string[]): string[] {
    return ['/usr/bin/node', '/usr/local/bin/uivisor', ...args];
  }

  // ── Absence / presence baseline ────────────────────────────────────────────

  it('no --output-dir flag → outputDir: undefined', () => {
    const result = parseArgs(argv('test', 'flow.yaml'));
    expect(result.outputDir).toBeUndefined();
  });

  it('--output-dir with absolute path → stored as-is', () => {
    const result = parseArgs(argv('test', 'flow.yaml', '--output-dir', '/abs/path'));
    expect(result.outputDir).toBe('/abs/path');
  });

  it('--output-dir with relative path → raw string preserved (no resolution in parseArgs)', () => {
    const result = parseArgs(argv('test', 'flow.yaml', '--output-dir', './relative/path'));
    expect(result.outputDir).toBe('./relative/path');
  });

  // ── Edge values ────────────────────────────────────────────────────────────

  it('--output-dir at end of argv with no following value → outputDir: undefined', () => {
    // The parser only consumes a value when i+1 < args.length; with no token
    // after the flag the condition is false and outputDir stays undefined.
    const result = parseArgs(argv('test', 'flow.yaml', '--output-dir'));
    expect(result.outputDir).toBeUndefined();
  });

  it('--output-dir "" → outputDir stored as empty string', () => {
    const result = parseArgs(argv('test', 'flow.yaml', '--output-dir', ''));
    expect(result.outputDir).toBe('');
  });

  it('--output-dir with path containing spaces → stored as-is', () => {
    const result = parseArgs(argv('test', 'flow.yaml', '--output-dir', '/path/with spaces'));
    expect(result.outputDir).toBe('/path/with spaces');
  });

  it('--output-dir with Windows-style path → stored as-is (no path normalisation)', () => {
    const result = parseArgs(argv('test', 'flow.yaml', '--output-dir', 'C:\\Users\\out'));
    expect(result.outputDir).toBe('C:\\Users\\out');
  });

  it('multiple --output-dir flags → last value wins', () => {
    const result = parseArgs(
      argv('test', 'flow.yaml', '--output-dir', '/first', '--output-dir', '/last'),
    );
    expect(result.outputDir).toBe('/last');
  });

  it('--output-dir followed immediately by a flag-like token → token consumed as value', () => {
    // '--slow-mo' is taken as the outputDir value; '500' falls through the
    // else-branch and is discarded, so slowMo stays at its default of 0.
    const result = parseArgs(argv('test', 'flow.yaml', '--output-dir', '--slow-mo', '500'));
    expect(result.outputDir).toBe('--slow-mo');
    expect(result.slowMo).toBe(0);
  });

  // ── Combinations ───────────────────────────────────────────────────────────

  it('--output-dir /out --headed → both flags parsed', () => {
    const result = parseArgs(argv('test', 'flow.yaml', '--output-dir', '/out', '--headed'));
    expect(result.outputDir).toBe('/out');
    expect(result.headed).toBe(true);
  });

  it('--output-dir /out --reporter html → both flags parsed', () => {
    const result = parseArgs(
      argv('test', 'flow.yaml', '--output-dir', '/out', '--reporter', 'html'),
    );
    expect(result.outputDir).toBe('/out');
    expect(result.reporter).toBe('html');
  });

  it('--output-dir /out --tag smoke → outputDir, tag, and target all captured', () => {
    const result = parseArgs(argv('test', 'flow.yaml', '--output-dir', '/out', '--tag', 'smoke'));
    expect(result.target).toBe('flow.yaml');
    expect(result.outputDir).toBe('/out');
    expect(result.tags).toEqual(['smoke']);
  });

  it('target positional captured correctly when --output-dir follows it', () => {
    const result = parseArgs(argv('test', 'flow.yaml', '--output-dir', '/out'));
    expect(result.target).toBe('flow.yaml');
    expect(result.outputDir).toBe('/out');
  });

  // ── Usage string rename ─────────────────────────────────────────────────────

  it('usage string shown on missing target contains "uivisor" (not "webt")', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    // 'test' subcommand present but no target → triggers usage + exit
    parseArgs(['/usr/bin/node', '/usr/local/bin/uivisor', 'test']);

    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('uivisor'));
    expect(writeSpy).not.toHaveBeenCalledWith(expect.stringContaining('webt'));

    writeSpy.mockRestore();
    exitSpy.mockRestore();
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

// ─── --timeout / --navigation-timeout (AC55, T8) ───────────────────────────────

describe('parseArgs: --timeout / --navigation-timeout', () => {
  function argv(...args: string[]): string[] {
    return ['/usr/bin/node', '/usr/local/bin/uivisor', ...args];
  }

  it('AC55 (a): --timeout 7000 --navigation-timeout 40000 are both parsed onto the result', () => {
    const result = parseArgs(argv('test', 'f.yaml', '--timeout', '7000', '--navigation-timeout', '40000'));
    expect(result.timeout).toBe(7000);
    expect(result.navigationTimeout).toBe(40000);
  });

  it('AC55 (a, absence): neither flag given leaves both fields absent (undefined), not a default value', () => {
    const result = parseArgs(argv('test', 'f.yaml'));
    expect(result.timeout).toBeUndefined();
    expect(result.navigationTimeout).toBeUndefined();
  });

  it('AC55 (b): --timeout 0 writes the exact error and exits 1', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    parseArgs(argv('test', 'f.yaml', '--timeout', '0'));

    expect(writeSpy).toHaveBeenCalledWith('Error: --timeout must be a positive integer, got "0"\n');
    expect(exitSpy).toHaveBeenCalledWith(1);

    writeSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('AC55 (c): --timeout abc writes the exact error and exits 1', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    parseArgs(argv('test', 'f.yaml', '--timeout', 'abc'));

    expect(writeSpy).toHaveBeenCalledWith('Error: --timeout must be a positive integer, got "abc"\n');
    expect(exitSpy).toHaveBeenCalledWith(1);

    writeSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('AC55 (d): --navigation-timeout -1 writes the exact error (navigation flag name) and exits 1', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    parseArgs(argv('test', 'f.yaml', '--navigation-timeout', '-1'));

    expect(writeSpy).toHaveBeenCalledWith('Error: --navigation-timeout must be a positive integer, got "-1"\n');
    expect(exitSpy).toHaveBeenCalledWith(1);

    writeSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('AC55 (e): --timeout as the last argument with no value writes the error with an empty-string raw value and exits 1', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    parseArgs(argv('test', 'f.yaml', '--timeout'));

    expect(writeSpy).toHaveBeenCalledWith('Error: --timeout must be a positive integer, got ""\n');
    expect(exitSpy).toHaveBeenCalledWith(1);

    writeSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('AC55: the usage/help output includes "[--timeout <ms>] [--navigation-timeout <ms>]"', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    parseArgs(argv('test'));

    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining('[--timeout <ms>] [--navigation-timeout <ms>]'),
    );

    writeSpy.mockRestore();
    exitSpy.mockRestore();
  });

  // Arbiter ruling 4: greedy-consume (no lookahead for another flag) and given-twice (last wins).

  it('arbiter ruling: --timeout immediately followed by another flag greedily consumes it as the raw value', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    parseArgs(argv('test', 'f.yaml', '--timeout', '--headed'));

    expect(writeSpy).toHaveBeenCalledWith('Error: --timeout must be a positive integer, got "--headed"\n');
    expect(exitSpy).toHaveBeenCalledWith(1);

    writeSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('arbiter ruling: --timeout given twice — the last occurrence wins', () => {
    const result = parseArgs(argv('test', 'f.yaml', '--timeout', '1000', '--timeout', '2000'));
    expect(result.timeout).toBe(2000);
  });
});
