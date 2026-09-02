import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
