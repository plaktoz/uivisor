import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Command } from '@uivisor/core';
import { parseArgs } from './args.js';

describe('parseArgs', () => {
  beforeEach(() => {
    vi.spyOn(process, 'exit').mockImplementation((_code?: string | number | null) => {
      throw new Error('process.exit called');
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('no args: url defaults to http://localhost:5173 and outputPath to recorded.yaml', () => {
    const result = parseArgs(['node', 'script.js']);
    expect(result.url).toBe('http://localhost:5173');
    expect(result.outputPath).toBe('recorded.yaml');
  });

  it('positional url sets url', () => {
    const result = parseArgs(['node', 'script.js', 'http://localhost:3000']);
    expect(result.url).toBe('http://localhost:3000');
    expect(result.outputPath).toBe('recorded.yaml');
  });

  it('--output <file> sets outputPath', () => {
    const result = parseArgs(['node', 'script.js', '--output', 'flows/my.yaml']);
    expect(result.outputPath).toBe('flows/my.yaml');
    expect(result.url).toBe('http://localhost:5173');
  });

  it('-o <file> sets outputPath (short alias)', () => {
    const result = parseArgs(['node', 'script.js', '-o', 'out.yaml']);
    expect(result.outputPath).toBe('out.yaml');
  });

  it('--base-url <url> overrides url', () => {
    const result = parseArgs(['node', 'script.js', '--base-url', 'https://example.com']);
    expect(result.url).toBe('https://example.com');
  });

  it('--base-url beats positional url when both provided', () => {
    const result = parseArgs(['node', 'script.js', 'http://localhost:3000', '--base-url', 'https://example.com']);
    expect(result.url).toBe('https://example.com');
  });

  it('--help prints to stdout and calls process.exit(0)', () => {
    expect(() => parseArgs(['node', 'script.js', '--help'])).toThrow('process.exit called');
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it('-h calls process.exit(0)', () => {
    expect(() => parseArgs(['node', 'script.js', '-h'])).toThrow('process.exit called');
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it('unknown flag throws Error', () => {
    expect(() => parseArgs(['node', 'script.js', '--unknown'])).toThrow(/Unknown flag/);
  });

  it('--output without value throws Error', () => {
    expect(() => parseArgs(['node', 'script.js', '--output'])).toThrow();
  });
});

// ---------------------------------------------------------------------------
// TC-15 / TC-16 — CLI emits goto as first appendCommand call
// ---------------------------------------------------------------------------
describe('TC-15/TC-16: cli emits goto as first appendCommand, url matches CLI arg', () => {
  let appendCommandMock: ReturnType<typeof vi.fn>;
  let startSessionMock: ReturnType<typeof vi.fn>;
  const savedArgv = process.argv.slice();

  beforeEach(() => {
    vi.resetModules();

    appendCommandMock = vi.fn();
    startSessionMock = vi.fn();

    // Mock playwright so no real browser is launched
    vi.doMock('playwright', () => ({
      chromium: {
        launch: vi.fn().mockResolvedValue({
          newPage: vi.fn().mockResolvedValue({
            exposeFunction: vi.fn().mockResolvedValue(undefined),
            addInitScript: vi.fn().mockResolvedValue(undefined),
            goto: vi.fn().mockResolvedValue(null),
            on: vi.fn(), // page.on('close', ...) — never fires; main() returns after page.goto
          }),
          close: vi.fn().mockResolvedValue(undefined),
        }),
      },
    }));

    // Mock yamlWriter to spy on appendCommand and startSession
    vi.doMock('./yamlWriter.js', () => ({
      startSession: startSessionMock,
      appendCommand: appendCommandMock,
    }));

    // Mock process.exit so the SIGINT handler doesn't kill the test process
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    process.argv = savedArgv;
    vi.restoreAllMocks();
  });

  it('TC-15: appendCommand is called with goto as the FIRST invocation, url matches CLI arg', async () => {
    const testUrl = 'http://localhost:9991/tc15';
    process.argv = ['node', 'cli.js', testUrl];

    // Dynamically import the cli module (triggers main() execution)
    await import('./cli.js');

    // Drain the microtask queue so all awaits inside main() complete
    await vi.waitFor(() => {
      expect(appendCommandMock).toHaveBeenCalled();
    });

    // First appendCommand call must be the goto
    const firstCall = appendCommandMock.mock.calls[0] as [string, Command];
    expect(firstCall[1]).toEqual({ type: 'goto', url: testUrl });
  });

  it('TC-16: goto URL in appendCommand matches the CLI argument', async () => {
    const testUrl = 'http://localhost:9992/tc16';
    process.argv = ['node', 'cli.js', testUrl];

    await import('./cli.js');

    await vi.waitFor(() => {
      expect(appendCommandMock).toHaveBeenCalled();
    });

    const gotoCall = appendCommandMock.mock.calls.find(
      ([, cmd]: [string, Command]) => (cmd as { type: string }).type === 'goto',
    ) as [string, Command] | undefined;

    expect(gotoCall).toBeDefined();
    expect((gotoCall![1] as { type: string; url: string }).url).toBe(testUrl);
  });
});
