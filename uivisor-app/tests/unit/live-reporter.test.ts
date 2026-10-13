import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import type { Command, FlowFile, FlowResult } from '@uivisor/core';
import { createLiveReporter } from '../../src/reporter/live';
import { createPlainReporter } from '../../src/reporter/run-reporter';

const HIDE = '\x1b[?25l';
const SHOW = '\x1b[?25h';
const ESC = '\x1b';

const goto: Command = { type: 'goto', url: 'http://test/a' };
const tap: Command = { type: 'tapOn', selector: 'go' };

const flow: FlowFile = {
  baseUrl: 'http://test',
  filePath: '/flows/demo.yaml',
  commands: [{ command: goto }, { command: tap }],
  sessions: [],
  tags: [],
};

const passed: FlowResult = {
  filePath: '/flows/demo.yaml',
  passed: true,
  totalCommands: 2,
  passedCommands: 2,
  durationMs: 700,
  commandResults: [
    { command: goto, passed: true, durationMs: 300 },
    { command: tap, passed: true, durationMs: 400 },
  ],
};

function setup(term: { columns?: number; rows?: number } = { columns: 60, rows: 20 }) {
  const writes: string[] = [];
  let t = 50_000;
  let tick: (() => void) | null = null;
  const proc = Object.assign(new EventEmitter(), { exit: vi.fn() });
  const reporter = createLiveReporter({
    out: { ...term, write: (s: string) => writes.push(s) },
    now: () => t,
    unrefInterval: (_ms, fn) => {
      tick = fn;
      return { stop: () => { tick = null; } };
    },
    proc,
    plain: createPlainReporter(),
  });
  return {
    reporter,
    writes,
    proc,
    advance: (ms: number) => { t += ms; },
    tick: () => tick?.(),
    ticking: () => tick !== null,
    screen: () => writes.join(''),
  };
}

let stdout: string;
beforeEach(() => {
  stdout = '';
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
    stdout += String(chunk);
    return true;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('live reporter', () => {
  it('hides the cursor and lists every step pending before the first command runs', () => {
    const s = setup();
    s.reporter.startFlow(flow);

    expect(s.writes[0]).toBe(HIDE);
    const frame = s.writes[1].split('\n');
    expect(frame[0]).toMatch(/^▶ demo\.yaml +\(step 1 of 2 · 00:00\)$/);
    expect(frame.slice(1)).toEqual(['  ○ goto: http://test/a', '  ○ tapOn: "go"', '']);
  });

  it('repaints on the ticker, in one write that rewinds over the previous frame', () => {
    const s = setup();
    s.reporter.startFlow(flow);
    s.reporter.onProgress({ kind: 'stepStart', command: goto });
    expect(s.writes, 'events alone do not write').toHaveLength(2);

    s.advance(1_200);
    s.tick();
    expect(s.writes).toHaveLength(3);
    expect(s.writes[2].startsWith(`${ESC}[3F${ESC}[J`), 'rewinds the 3 painted lines and clears below').toBe(true);
    expect(s.writes[2]).toMatch(/ goto: http:\/\/test\/a +1\.2s…\n/);

    s.tick();
    expect(s.writes, 'an unchanged frame is not rewritten').toHaveLength(3);
  });

  it('leaves the finished block in place, and starts the next flow below it', () => {
    const s = setup();
    s.reporter.startFlow(flow);
    s.reporter.onProgress({ kind: 'stepStart', command: goto });
    s.reporter.onProgress({ kind: 'stepEnd', result: passed.commandResults[0] });
    s.reporter.onProgress({ kind: 'stepStart', command: tap });
    s.reporter.onProgress({ kind: 'stepEnd', result: passed.commandResults[1] });
    s.reporter.endFlow(passed);

    const committed = s.writes[2];
    expect(committed.startsWith(`${ESC}[3F${ESC}[J`)).toBe(true);
    expect(committed.slice(`${ESC}[3F${ESC}[J`.length).split('\n')).toEqual([
      expect.stringMatching(/^▶ demo\.yaml +\(00:00\)$/),
      expect.stringMatching(/^  ✓ goto: http:\/\/test\/a +0\.3s$/),
      expect.stringMatching(/^  ✓ tapOn: "go" +0\.4s$/),
      'PASSED — 2/2 commands passed',
      '',
    ]);

    s.tick();
    expect(s.writes, 'nothing repaints between flows').toHaveLength(3);

    s.reporter.startFlow(flow);
    expect(s.writes[3].includes(ESC), 'the next flow does not rewind into the committed block').toBe(false);
  });

  it('close shows the cursor once, stops the ticker and removes its process hooks', () => {
    const s = setup();
    s.reporter.startFlow(flow);
    expect(s.proc.listenerCount('exit')).toBe(1);
    expect(s.proc.listenerCount('SIGINT')).toBe(1);

    s.reporter.endFlow(passed);
    s.reporter.close();
    s.reporter.close();

    expect(s.screen().split(SHOW)).toHaveLength(2);
    expect(s.screen().endsWith(SHOW)).toBe(true);
    expect(s.ticking()).toBe(false);
    expect(s.proc.listenerCount('exit')).toBe(0);
    expect(s.proc.listenerCount('SIGINT')).toBe(0);
  });

  it('close mid-flow commits the interrupted state before showing the cursor', () => {
    const s = setup();
    s.reporter.startFlow(flow);
    s.reporter.onProgress({ kind: 'stepStart', command: goto });
    s.advance(900);
    s.reporter.close();

    const last = s.writes.slice(-2);
    expect(last[0]).toMatch(/✗ goto: http:\/\/test\/a +0\.9s interrupted\n  – tapOn: "go"\n$/);
    expect(last[1]).toBe(SHOW);
  });

  it('shows the cursor if the process exits while the checklist is up', () => {
    const s = setup();
    s.reporter.startFlow(flow);
    s.proc.emit('exit');
    expect(s.writes.at(-1)).toBe(SHOW);
  });

  it('on Ctrl-C with no other handler, restores the terminal then exits 130', () => {
    const s = setup();
    s.reporter.startFlow(flow);
    s.proc.emit('SIGINT');

    expect(s.writes.at(-1)).toBe(SHOW);
    expect(s.proc.exit).toHaveBeenCalledWith(130);
    expect(s.proc.listenerCount('SIGINT')).toBe(0);
  });

  it('on Ctrl-C with another handler installed (Playwright), restores the terminal and leaves exiting to it', () => {
    const s = setup();
    const playwright = vi.fn();
    s.proc.on('SIGINT', playwright);
    s.reporter.startFlow(flow);
    s.proc.emit('SIGINT');

    expect(s.writes.at(-1)).toBe(SHOW);
    expect(playwright).toHaveBeenCalledOnce();
    expect(s.proc.exit).not.toHaveBeenCalled();
    expect(s.proc.listenerCount('SIGINT'), 'only the other handler remains').toBe(1);
  });

  it('falls back to plain output for the rest of the run when the event stream is inconsistent', () => {
    const s = setup();
    s.reporter.startFlow(flow);
    s.reporter.onProgress({ kind: 'stepEnd', result: passed.commandResults[0] });

    expect(s.writes.at(-1), 'terminal restored').toBe(SHOW);
    expect(s.proc.listenerCount('SIGINT')).toBe(0);
    expect(stdout, 'plain header printed so the flow is not lost').toBe('▶ Running: demo.yaml\n');

    const before = s.writes.length;
    s.reporter.onProgress({ kind: 'stepStart', command: goto });
    s.reporter.endFlow(passed);
    s.reporter.startFlow(flow);
    s.reporter.endFlow(passed);
    s.reporter.close();

    expect(s.writes.length, 'nothing more reaches the live terminal').toBe(before);
    const plainFlow = '▶ Running: demo.yaml\n  ✓ goto: http://test/a\n  ✓ tapOn: "go"\nPASSED — 2/2 commands passed\n';
    expect(stdout).toBe(plainFlow + plainFlow);
  });

  it('prints the run aggregate exactly as plain does', () => {
    const s = setup();
    s.reporter.runEnd({ flows: [], totalFlows: 2, passedFlows: 2, failedFlows: 0, durationMs: 0 });
    expect(stdout).toBe('\n2 flows passed, 0 flows failed\n');
    expect(s.writes).toEqual([]);
  });

  it.each([
    ['is not a terminal', {}],
    ['is a pty that reports 0x0', { columns: 0, rows: 0 }],
  ])('assumes 80x24 when the output %s', (_, term) => {
    const s = setup(term);
    s.reporter.startFlow({ ...flow, commands: [{ command: { type: 'goto', url: `http://test/${'x'.repeat(200)}` } }] });
    const lines = s.writes[1].split('\n');
    expect(lines[1]).toHaveLength(79);
  });
});
