import { describe, it, expect } from 'vitest';
import { parseArgs } from './args.js';

// ---------------------------------------------------------------------------
// --run-flow flag parsing tests
// ---------------------------------------------------------------------------
describe('parseArgs --run-flow', () => {
  // T01 — single path returned as one-element array
  it('single path returns runFlowPaths: [\'a.yaml\']', () => {
    const result = parseArgs(['node', 'cli.js', '--run-flow', 'a.yaml']);
    expect(result.runFlowPaths).toEqual(['a.yaml']);
  });

  // T02 — comma-separated two paths returns length-2 array
  it('comma-separated two paths returns length-2 array', () => {
    const result = parseArgs(['node', 'cli.js', '--run-flow', 'a.yaml,b.yaml']);
    expect(result.runFlowPaths).toHaveLength(2);
    expect(result.runFlowPaths).toEqual(['a.yaml', 'b.yaml']);
  });

  // T03 — three paths order preserved
  it('three paths: length-3 array with order preserved', () => {
    const result = parseArgs(['node', 'cli.js', '--run-flow', 'x.yaml,y.yaml,z.yaml']);
    expect(result.runFlowPaths).toHaveLength(3);
    expect(result.runFlowPaths).toEqual(['x.yaml', 'y.yaml', 'z.yaml']);
  });

  // T04 — no --run-flow flag → runFlowPaths is empty array (not undefined)
  it('no --run-flow flag → runFlowPaths is empty array', () => {
    const result = parseArgs(['node', 'cli.js']);
    expect(result.runFlowPaths).toEqual([]);
  });

  // T05 — no --run-flow flag → url and outputPath defaults unchanged
  it('no --run-flow flag → url and outputPath use defaults', () => {
    const result = parseArgs(['node', 'cli.js']);
    expect(result.url).toBe('http://localhost:5173');
    expect(result.outputPath).toBe('recorded.yaml');
  });

  // T06 — .json extension throws containing error message and path
  it('--run-flow flow.json throws with message and path', () => {
    expect(() => parseArgs(['node', 'cli.js', '--run-flow', 'flow.json'])).toThrow(
      '--run-flow: file must be a YAML flow file',
    );
    expect(() => parseArgs(['node', 'cli.js', '--run-flow', 'flow.json'])).toThrow('flow.json');
  });

  // T07 — no extension throws extension error
  it('--run-flow flow (no extension) throws extension error', () => {
    expect(() => parseArgs(['node', 'cli.js', '--run-flow', 'flow'])).toThrow(
      '--run-flow: file must be a YAML flow file',
    );
  });

  // T08 — mixed valid/invalid paths throws containing the invalid path
  it('--run-flow valid.yaml,broken.txt throws containing broken.txt', () => {
    expect(() => parseArgs(['node', 'cli.js', '--run-flow', 'valid.yaml,broken.txt'])).toThrow(
      'broken.txt',
    );
  });

  // T09 — .yml extension accepted — does NOT throw, returns path as-is
  it('--run-flow setup.yml does not throw and returns [\'setup.yml\']', () => {
    const result = parseArgs(['node', 'cli.js', '--run-flow', 'setup.yml']);
    expect(result.runFlowPaths).toEqual(['setup.yml']);
  });

  // T10 — --run-flow with no following arg throws "requires a value"
  it('--run-flow with no value throws containing "requires a value"', () => {
    expect(() => parseArgs(['node', 'cli.js', '--run-flow'])).toThrow('requires a value');
  });

  // T11 — paths stored exactly as supplied (not resolved)
  it('paths stored as supplied — relative path preserved verbatim', () => {
    const result = parseArgs(['node', 'cli.js', '--run-flow', './flows/setup.yaml']);
    expect(result.runFlowPaths).toEqual(['./flows/setup.yaml']);
  });

  // T12 — combined flags all parsed correctly
  it('combined --run-flow, --output, --base-url all parsed correctly', () => {
    const result = parseArgs([
      'node',
      'cli.js',
      '--run-flow',
      'a.yaml,b.yaml',
      '--output',
      'out.yaml',
      '--base-url',
      'http://x',
    ]);
    expect(result.runFlowPaths).toEqual(['a.yaml', 'b.yaml']);
    expect(result.outputPath).toBe('out.yaml');
    expect(result.url).toBe('http://x');
  });

  // T13 — runFlowPaths always present (not undefined) with or without flag
  it('runFlowPaths is always defined regardless of whether flag is given', () => {
    const withFlag = parseArgs(['node', 'cli.js', '--run-flow', 'a.yaml']);
    const withoutFlag = parseArgs(['node', 'cli.js']);
    expect(withFlag.runFlowPaths).toBeDefined();
    expect(withoutFlag.runFlowPaths).toBeDefined();
  });
});
