import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FlowFile, FlowResult, RunResult } from '@uivisor/core';
import { createPlainReporter, resolveConsoleMode } from '../../src/reporter/run-reporter';

let out: string;

beforeEach(() => {
  out = '';
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
    out += String(chunk);
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const file: FlowFile = {
  baseUrl: 'http://test',
  filePath: '/flows/checkout.yaml',
  commands: [],
  sessions: [],
  tags: [],
};

const result: FlowResult = {
  filePath: '/flows/checkout.yaml',
  passed: false,
  totalCommands: 3,
  passedCommands: 1,
  durationMs: 900,
  commandResults: [
    {
      command: { type: 'runFlow', path: './login.yaml' },
      passed: true,
      durationMs: 400,
      nestedResult: {
        filePath: '/flows/login.yaml',
        passed: true,
        totalCommands: 1,
        passedCommands: 1,
        durationMs: 390,
        commandResults: [{ command: { type: 'goto', url: 'http://test/login' }, passed: true, durationMs: 390 }],
      },
    },
    {
      command: { type: 'assertText', selector: 'h1', expected: 'Cart' },
      passed: false,
      message: 'assertText failed\nExpected: Cart\nGot: Home',
      expected: 'Cart',
      got: 'Home',
      screenshotPath: '/shots/fail-001.png',
      durationMs: 500,
    },
  ],
};

describe('createPlainReporter', () => {
  it('prints today\'s append-only bytes: header up front, steps and footer after the flow', () => {
    const plain = createPlainReporter();

    plain.startFlow(file);
    expect(out, 'only the header is printed before the flow runs').toBe('▶ Running: checkout.yaml\n');

    plain.onProgress({ kind: 'stepStart', command: { type: 'goto', url: 'http://test' } });
    expect(out, 'progress events print nothing').toBe('▶ Running: checkout.yaml\n');

    plain.endFlow(result);
    plain.close();
    expect(out).toBe(
      '▶ Running: checkout.yaml\n' +
      '  ✓ runFlow: ./login.yaml\n' +
      '    ▶ Running: login.yaml\n' +
      '    ✓ goto: http://test/login\n' +
      '  ✗ assertText: "h1" expected: Cart — FAILED\n' +
      '    Expected: Cart\n' +
      '    Got: Home\n' +
      '    Screenshot: /shots/fail-001.png\n' +
      'FAILED — 1/3 commands passed\n',
    );
  });

  it('prints a notice event as its own line', () => {
    const plain = createPlainReporter();

    plain.startFlow(file);
    plain.onProgress({ kind: 'notice', message: 'child.yaml: defaultTimeout ignored (inherited from top.yaml)' });
    expect(out).toBe(
      '▶ Running: checkout.yaml\n' +
      'child.yaml: defaultTimeout ignored (inherited from top.yaml)\n',
    );
  });

  it('prints the run aggregate only when more than one flow ran', () => {
    const plain = createPlainReporter();
    const run = (totalFlows: number): RunResult => ({ flows: [], totalFlows, passedFlows: 1, failedFlows: totalFlows - 1, durationMs: 0 });

    plain.runEnd(run(1));
    expect(out).toBe('');

    plain.runEnd(run(2));
    expect(out).toBe('\n1 flows passed, 1 flows failed\n');
  });
});

describe('resolveConsoleMode', () => {
  it('auto draws live only on a real terminal', () => {
    expect(resolveConsoleMode('auto', { isTTY: true }, { TERM: 'xterm-256color' })).toBe('live');
    expect(resolveConsoleMode('auto', { isTTY: true }, {}), 'TERM unset').toBe('live');
    expect(resolveConsoleMode('auto', { isTTY: true }, { TERM: 'dumb' })).toBe('plain');
    expect(resolveConsoleMode('auto', { isTTY: false }, {})).toBe('plain');
    expect(resolveConsoleMode('auto', {}, {}), 'pipes have no isTTY').toBe('plain');
  });

  it('a forced style wins', () => {
    expect(resolveConsoleMode('live', {}, { TERM: 'dumb' })).toBe('live');
    expect(resolveConsoleMode('plain', { isTTY: true }, {})).toBe('plain');
  });
});
