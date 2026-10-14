import { describe, it, expect } from 'vitest';
import type { Command, CommandResult, FlowFile, FlowResult, ProgressEvent, Selector } from '@uivisor/core';
import {
  abortChecklist,
  applyEvent,
  ChecklistProtocolError,
  finishChecklist,
  formatClock,
  formatDuration,
  planChecklist,
  renderFinal,
  renderLive,
  toRows,
  type Checklist,
} from '../../src/reporter/checklist';
import { width } from '../../src/reporter/cells';

const T0 = 1_000_000;

const goto = (url: string): Command => ({ type: 'goto', url });
const tap = (s: Selector): Command => ({ type: 'tapOn', selector: s });
const visible = (s: string): Command => ({ type: 'assertVisible', selector: s });
const within = (selector: string, ...cmds: Command[]): Command => ({ type: 'within', selector, do: cmds.map((command) => ({ command })) });
const runFlow = (p: string): Command => ({ type: 'runFlow', path: p });

function file(filePath: string, ...cmds: Command[]): FlowFile {
  return { baseUrl: 'http://test', filePath, commands: cmds.map((command) => ({ command })), sessions: [], tags: [] };
}

const start = (command: Command): ProgressEvent => ({ kind: 'stepStart', command });
const pass = (command: Command, durationMs: number): ProgressEvent => ({ kind: 'stepEnd', result: { command, passed: true, durationMs } });
const fail = (command: Command, durationMs: number, extra: Partial<CommandResult> = {}): ProgressEvent =>
  ({ kind: 'stepEnd', result: { command, passed: false, durationMs, ...extra } });
const include = (f: FlowFile): ProgressEvent => ({ kind: 'include', file: f });

function replay(list: Checklist, ...steps: [number, ProgressEvent][]): Checklist {
  return steps.reduce((l, [at, e]) => applyEvent(l, e, T0 + at), list);
}

function flowResult(passed: boolean, passedCommands: number, totalCommands: number, durationMs: number): FlowResult {
  return { filePath: '/flows/my-flow.yaml', passed, commandResults: [], totalCommands, passedCommands, durationMs };
}

const rightAligned = (cols: number, left: string, right: string) => left + ' '.repeat(cols - [...left].length - [...right].length) + right;

const cellWidthOf = width;

const marks = (list: Checklist, now = T0) => toRows(list, now).map((r) => `${'  '.repeat(r.depth - 1)}${r.mark} ${r.label}`);

const login = file('/flows/login.yaml', goto('${base}/login'), tap('login-submit'));
const myFlow = file(
  '/flows/my-flow.yaml',
  runFlow('./login.yaml'),
  tap('text=N3-3'),
  within('[data-testid=slot-picker]', tap('text=12'), within('.inner', tap('text=ok'))),
  visible('done'),
);

describe('checklist model', () => {
  it('plans every top-level step pending, within children nested up front, runFlow unexpanded', () => {
    expect(marks(planChecklist(myFlow, T0))).toEqual([
      'pending runFlow: ./login.yaml',
      'pending tapOn: "text=N3-3"',
      'pending within: [data-testid=slot-picker]',
      '  pending tapOn: "text=12"',
      '  pending within: .inner',
      '    pending tapOn: "text=ok"',
      'pending assertVisible: "done"',
    ]);
  });

  it('expands runFlow on include and updates its children before the runFlow step ends', () => {
    const list = replay(planChecklist(myFlow, T0),
      [0, start(runFlow('./login.yaml'))],
      [5, include(login)],
      [5, start(goto('http://test/login'))],
      [400, pass(goto('http://test/login'), 395)],
      [400, start(tap('login-submit'))],
    );
    expect(marks(list)).toEqual([
      'running runFlow: ./login.yaml',
      '  passed goto: http://test/login',
      '  running tapOn: "login-submit"',
      'pending tapOn: "text=N3-3"',
      'pending within: [data-testid=slot-picker]',
      '  pending tapOn: "text=12"',
      '  pending within: .inner',
      '    pending tapOn: "text=ok"',
      'pending assertVisible: "done"',
    ]);
  });

  it('labels a pending step with its raw command and a started step with the interpolated one', () => {
    const list = replay(planChecklist(myFlow, T0), [0, start(runFlow('./login.yaml'))], [1, include(login)]);
    expect(marks(list)[1], 'pending child keeps ${var}').toBe('  pending goto: ${base}/login');

    const started = applyEvent(list, start(goto('http://test/login')), T0 + 2);
    expect(marks(started)[1]).toBe('  running goto: http://test/login');
  });

  it('skips the rest of a within as soon as one of its children fails, and the rest of the flow once it ends', () => {
    const w = myFlow.commands[2].command;
    const list = replay(planChecklist(file('/flows/my-flow.yaml', w, visible('done')), T0),
      [0, start(w)],
      [0, start(tap('text=12'))],
      [10, fail(tap('text=12'), 10, { message: 'boom' })],
      [10, fail(w, 10)],
    );
    expect(marks(list), 'flow still running').toEqual([
      'failed within: [data-testid=slot-picker]',
      '  failed tapOn: "text=12"',
      '  skipped within: .inner',
      '    skipped tapOn: "text=ok"',
      'pending assertVisible: "done"',
    ]);
    expect(marks(finishChecklist(list, flowResult(false, 0, 2, 10))).at(-1)).toBe('skipped assertVisible: "done"');
  });

  it('within whose container is missing fails with its message and skips every child', () => {
    const w = within('.missing', tap('a'), tap('b'));
    const list = replay(planChecklist(file('/f.yaml', w), T0),
      [0, start(w)],
      [30, fail(w, 30, { message: "within: No container found for selector '.missing'", screenshotPath: '/s/1.png' })],
    );
    const rows = toRows(list, T0 + 30);
    expect(rows.map((r) => r.mark)).toEqual(['failed', 'skipped', 'skipped']);
    expect(rows[0].details).toEqual(['Screenshot: /s/1.png', "within: No container found for selector '.missing'"]);
  });

  it('puts failure details on the step where the failure originated, not on its ancestors', () => {
    const list = replay(planChecklist(myFlow, T0),
      [0, start(runFlow('./login.yaml'))],
      [0, include(login)],
      [0, start(goto('http://test/login'))],
      [50, fail(goto('http://test/login'), 50, { message: 'nav failed', expected: 'Login', got: 'Error\npage', screenshotPath: '/s/f.png' })],
      [50, fail(runFlow('./login.yaml'), 50, { message: 'nav failed' })],
    );
    const rows = toRows(list, T0 + 50);
    expect(rows[0].details, 'runFlow repeats nothing').toEqual([]);
    expect(rows[1].details, 'message is omitted when Expected is present; multi-line values split').toEqual([
      'Expected: Login', 'Got: Error', 'page', 'Screenshot: /s/f.png',
    ]);
    expect(rows[2].mark, 'rest of the included flow is skipped').toBe('skipped');
  });

  it('a runFlow that fails before include shows its own message', () => {
    const list = replay(planChecklist(myFlow, T0),
      [0, start(runFlow('./login.yaml'))],
      [1, fail(runFlow('./login.yaml'), 1, { message: 'Flow file not found: /flows/login.yaml' })],
    );
    expect(toRows(list, T0 + 1)[0].details).toEqual(['Flow file not found: /flows/login.yaml']);
  });

  it('abort marks running steps interrupted and pending ones skipped, and keeps an existing end', () => {
    const list = replay(planChecklist(myFlow, T0), [0, start(runFlow('./login.yaml'))], [0, include(login)], [0, start(goto('x'))]);
    const aborted = abortChecklist(list, T0 + 700);
    expect(toRows(aborted, T0 + 9999).map((r) => [r.mark, r.ms])).toEqual([
      ['interrupted', 700], ['interrupted', 700], ['skipped', null],
      ['skipped', null], ['skipped', null], ['skipped', null], ['skipped', null], ['skipped', null], ['skipped', null],
    ]);
    expect(abortChecklist(aborted, T0 + 900).end, 'second abort keeps the first time').toEqual({ kind: 'aborted', at: T0 + 700 });

    const finished = finishChecklist(list, flowResult(true, 4, 4, 1));
    expect(abortChecklist(finished, T0).end.kind, 'abort after finish keeps the result').toBe('finished');
  });

  it('rejects event streams that break the bracket structure', () => {
    const fresh = planChecklist(myFlow, T0);
    expect(() => applyEvent(fresh, pass(tap('x'), 1), T0), 'stepEnd with nothing running').toThrow(ChecklistProtocolError);
    expect(() => applyEvent(fresh, start(tap('x')), T0), 'start of an unplanned command type').toThrow(ChecklistProtocolError);
    expect(() => applyEvent(fresh, include(login), T0), 'include with no runFlow open').toThrow(ChecklistProtocolError);

    const inRunFlow = applyEvent(fresh, start(runFlow('./login.yaml')), T0);
    expect(() => applyEvent(inRunFlow, start(goto('x')), T0), 'child before include').toThrow(ChecklistProtocolError);
    const included = applyEvent(inRunFlow, include(login), T0);
    expect(() => applyEvent(included, include(login), T0), 'second include').toThrow(ChecklistProtocolError);

    const ended = finishChecklist(fresh, flowResult(true, 0, 0, 0));
    expect(() => applyEvent(ended, start(runFlow('./login.yaml')), T0), 'event after the flow ended').toThrow(ChecklistProtocolError);
  });

  it('a notice event is not part of the step tree and leaves the checklist unchanged', () => {
    const fresh = planChecklist(myFlow, T0);
    const inRunFlow = applyEvent(fresh, start(runFlow('./login.yaml')), T0);
    // Notices may arrive while a runFlow step is open, before its include (per ProgressEvent's doc).
    expect(applyEvent(inRunFlow, { kind: 'notice', message: 'child.yaml: defaultTimeout ignored (inherited from top.yaml)' }, T0)).toBe(inRunFlow);
  });
});

describe('formatting', () => {
  it('formats durations and the header clock', () => {
    expect([0, 400, 1_149, 38_200, 59_999, 62_000, 3_600_000].map(formatDuration)).toEqual(['0.0s', '0.4s', '1.1s', '38.2s', '59.9s', '1m02s', '60m00s']);
    expect([0, 41_900, 723_000].map(formatClock)).toEqual(['00:00', '00:41', '12:03']);
  });
});

function midRun(): Checklist {
  const flow = file('/flows/my-flow.yaml', runFlow('./login.yaml'), tap('text=N3-3'), tap({ css: 'h6' }), tap('text=12'), { type: 'inputText', text: '${date}' });
  return replay(planChecklist(flow, T0),
    [0, start(runFlow('./login.yaml'))],
    [0, include(login)],
    [0, start(goto('http://test/login'))],
    [1_100, pass(goto('http://test/login'), 1_100)],
    [1_100, start(tap('login-submit'))],
    [1_300, pass(tap('login-submit'), 200)],
    [1_300, pass(runFlow('./login.yaml'), 1_300)],
    [1_300, start(tap('text=N3-3'))],
    [1_700, pass(tap('text=N3-3'), 400)],
    [1_700, start(tap({ css: 'h6' }))],
  );
}

describe('renderLive', () => {
  it('draws the in-place frame: header, nested rows, spinner and live timer on the running step', () => {
    const now = T0 + 3_800;
    expect(renderLive(midRun(), now, { columns: 61, rows: 24 })).toEqual([
      rightAligned(60, '▶ my-flow.yaml', '(step 3 of 5 · 00:03)'),
      rightAligned(60, '  ✓ runFlow: ./login.yaml', '1.3s'),
      rightAligned(60, '    ✓ goto: http://test/login', '1.1s'),
      rightAligned(60, '    ✓ tapOn: "login-submit"', '0.2s'),
      rightAligned(60, '  ✓ tapOn: "text=N3-3"', '0.4s'),
      rightAligned(60, '  ◑ tapOn: {"css":"h6"}', '2.1s…'),
      '  ○ tapOn: "text=12"',
      '  ○ inputText: ${date}',
    ]);
  });

  it('derives the spinner glyph from the clock', () => {
    const glyphAt = (ms: number) => [...renderLive(midRun(), T0 + ms, { columns: 80, rows: 24 })[5]][2];
    expect([3_800, 3_900, 4_000, 4_100, 4_200].map(glyphAt), 'T0 + 3800 is tick 10038').toEqual(['◑', '◒', '◐', '◓', '◑']);
  });

  it('lists every step pending before the first command runs', () => {
    const frame = renderLive(planChecklist(myFlow, T0), T0, { columns: 80, rows: 24 });
    expect(frame[0]).toMatch(/^▶ my-flow\.yaml +\(step 1 of 4 · 00:00\)$/);
    expect(frame.slice(1).map((l) => l.trimStart()[0])).toEqual(['○', '○', '○', '○', '○', '○', '○']);
  });

  it('truncates long labels with … and keeps the time column', () => {
    const frame = renderLive(midRun(), T0 + 3_800, { columns: 30, rows: 24 });
    expect(frame[2]).toBe('    ✓ goto: http://test… 1.1s');
    expect(frame[5]).toBe(rightAligned(29, '  ◑ tapOn: {"css":"h6"}', '2.1s…'));
  });

  it('windows a tall checklist around the running step with … N more markers', () => {
    const many = file('/flows/long.yaml', ...Array.from({ length: 30 }, (_, i) => tap(`s${i}`)));
    let list = planChecklist(many, T0);
    for (let i = 0; i < 20; i++) list = replay(list, [0, start(tap(`s${i}`))], [0, pass(tap(`s${i}`), 100)]);
    list = applyEvent(list, start(tap('s20')), T0);

    const frame = renderLive(list, T0, { columns: 40, rows: 10 });
    expect(frame).toEqual([
      rightAligned(39, '▶ long.yaml', '(step 21 of 30 · 00:00)'),
      '  … 16 more',
      rightAligned(39, '  ✓ tapOn: "s16"', '0.1s'),
      rightAligned(39, '  ✓ tapOn: "s17"', '0.1s'),
      rightAligned(39, '  ✓ tapOn: "s18"', '0.1s'),
      rightAligned(39, '  ✓ tapOn: "s19"', '0.1s'),
      rightAligned(39, '  ◐ tapOn: "s20"', '0.0s…'),
      '  ○ tapOn: "s21"',
      '  … 8 more',
    ]);
  });

  it('keeps a failed step and its details in view when nothing is running', () => {
    const many = file('/flows/long.yaml', ...Array.from({ length: 30 }, (_, i) => tap(`s${i}`)));
    let list = planChecklist(many, T0);
    for (let i = 0; i < 25; i++) list = replay(list, [0, start(tap(`s${i}`))], [0, pass(tap(`s${i}`), 100)]);
    list = replay(list, [0, start(tap('s25'))], [0, fail(tap('s25'), 100, { message: 'line one\nline two' })]);

    const frame = renderLive(list, T0, { columns: 40, rows: 8 });
    expect(frame.length).toBe(7);
    expect(frame).toContain(rightAligned(39, '  ✗ tapOn: "s25"', '0.1s'));
    expect(frame).toContain('    line one');
    expect(frame).toContain('    line two');
  });

  it('shows control characters in a label as escapes so a step stays on one line', () => {
    const text = 'a\nb\r\tc\u001b[31m';
    const list = applyEvent(planChecklist(file('/flows/my-flow.yaml', { type: 'inputText', text }), T0), start({ type: 'inputText', text }), T0);
    const frame = renderLive(list, T0, { columns: 80, rows: 24 });

    expect(frame).toHaveLength(2);
    expect(frame[1]).toMatch(/^ {2}. inputText: a\\nb\\r\\tc\\u001b\[31m +0\.0s…$/);
    for (const line of frame) expect(line).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/);
  });

  it('measures double-width labels in terminal cells, never exceeding columns - 1', () => {
    const cjk = '日本語のテキストを入力します'.repeat(2);
    const list = replay(planChecklist(file('/flows/my-flow.yaml', { type: 'inputText', text: cjk }), T0),
      [0, start({ type: 'inputText', text: cjk })]);
    for (const columns of [20, 30, 60]) {
      const frame = renderLive(list, T0, { columns, rows: 24 });
      expect(frame).toHaveLength(2);
      for (const line of frame) expect(cellWidthOf(line), `${columns} columns`).toBeLessThanOrEqual(columns - 1);
      expect(frame[1]).toContain('…');
      expect(frame[1].endsWith('0.0s…')).toBe(true);
    }
  });

  it('counts emoji as two cells and combining marks as none', () => {
    const emoji = '🙂'.repeat(30);
    const combining = 'e\u0301'.repeat(30);
    for (const text of [emoji, combining]) {
      const list = applyEvent(planChecklist(file('/flows/my-flow.yaml', { type: 'inputText', text }), T0), start({ type: 'inputText', text }), T0);
      const frame = renderLive(list, T0, { columns: 40, rows: 24 });
      for (const line of frame) expect(cellWidthOf(line)).toBeLessThanOrEqual(39);
    }
  });

  it('escapes control characters and truncates wide characters in failure details', () => {
    const list = replay(midRun(),
      [3_000, fail(tap({ css: 'h6' }), 1_300, { message: `bad\tvalue ${'語'.repeat(40)}` })],
    );
    const frame = renderLive(list, T0 + 3_000, { columns: 30, rows: 24 });
    for (const line of frame) expect(cellWidthOf(line)).toBeLessThanOrEqual(29);
    expect(frame.some((l) => l.includes('bad\\tvalue'))).toBe(true);
  });

  it('never wraps or scrolls, whatever the terminal size', () => {
    const list = replay(midRun(),
      [3_000, fail(tap({ css: 'h6' }), 1_300, { message: `${'x'.repeat(200)}\n${'y'.repeat(90)}`, screenshotPath: `/very/${'deep/'.repeat(30)}shot.png` })],
    );
    for (let rows = 1; rows <= 30; rows++) {
      for (let columns = 1; columns <= 120; columns += 7) {
        const frame = renderLive(list, T0 + 3_000, { columns, rows });
        expect(frame.length, `${columns}x${rows} height`).toBeLessThanOrEqual(Math.max(1, rows - 1));
        for (const line of frame) expect([...line].length, `${columns}x${rows} width`).toBeLessThanOrEqual(Math.max(1, columns - 1));
      }
    }
  });
});

describe('renderFinal', () => {
  it('leaves every step untruncated with durations, skipped marks, details and the plain footer', () => {
    const shot = `/very/${'deep/'.repeat(20)}shot.png`;
    const list = replay(midRun(), [3_000, fail(tap({ css: 'h6' }), 1_300, { message: 'not found', screenshotPath: shot })]);
    const lines = renderFinal(finishChecklist(list, flowResult(false, 2, 5, 3_000)), 50);
    expect(lines).toEqual([
      rightAligned(49, '▶ my-flow.yaml', '(00:03)'),
      rightAligned(49, '  ✓ runFlow: ./login.yaml', '1.3s'),
      rightAligned(49, '    ✓ goto: http://test/login', '1.1s'),
      rightAligned(49, '    ✓ tapOn: "login-submit"', '0.2s'),
      rightAligned(49, '  ✓ tapOn: "text=N3-3"', '0.4s'),
      rightAligned(49, '  ✗ tapOn: {"css":"h6"}', '1.3s'),
      `    Screenshot: ${shot}`,
      '    not found',
      '  – tapOn: "text=12"',
      '  – inputText: ${date}',
      'FAILED — 2/5 commands passed',
    ]);
  });

  it('ends an aborted flow with the interrupted step and no footer', () => {
    const lines = renderFinal(abortChecklist(midRun(), T0 + 2_500), 50);
    expect(lines[5]).toBe(rightAligned(49, '  ✗ tapOn: {"css":"h6"}', '0.8s interrupted'));
    expect(lines.at(-1)).toBe('  – inputText: ${date}');
  });
});
