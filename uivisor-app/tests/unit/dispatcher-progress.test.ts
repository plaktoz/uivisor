import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Locator, Page } from 'playwright';
import type { Command, FlowFile, ProgressEvent, RunContext } from '@uivisor/core';
import { dispatch } from '../../src/engine/dispatcher';
import { runFlow } from '../../src/engine/index';
import { createVarMap } from '../../src/engine/varMap';

function makeLocator(count: number): Locator {
  const loc: Record<string, unknown> = {
    count: vi.fn().mockResolvedValue(count),
    locator: vi.fn().mockReturnThis(),
    getByText: vi.fn().mockReturnThis(),
    getByLabel: vi.fn().mockReturnThis(),
    getByRole: vi.fn().mockReturnThis(),
    getByPlaceholder: vi.fn().mockReturnThis(),
    getByTestId: vi.fn().mockReturnThis(),
    waitFor: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
  };
  loc['nth'] = vi.fn().mockReturnValue(loc);
  return loc as unknown as Locator;
}

function pageWhereOnlyTextMatches(): Page {
  return {
    url: vi.fn().mockReturnValue('http://test/'),
    locator: vi.fn().mockReturnValue(makeLocator(0)),
    getByText: vi.fn().mockReturnValue(makeLocator(1)),
    getByLabel: vi.fn().mockReturnValue(makeLocator(0)),
    getByRole: vi.fn().mockReturnValue(makeLocator(0)),
    getByPlaceholder: vi.fn().mockReturnValue(makeLocator(0)),
    getByTestId: vi.fn().mockReturnValue(makeLocator(0)),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('')),
  } as unknown as Page;
}

function record(): { ctx: RunContext; events: ProgressEvent[]; page: Page } {
  const events: ProgressEvent[] = [];
  const page = pageWhereOnlyTextMatches();
  const ctx: RunContext = {
    lastTappedLocator: null,
    callStack: new Set(),
    indentLevel: 0,
    runDir: os.tmpdir(),
    sessions: new Map([['main', page]]),
    defaultSessionId: 'main',
    varMap: createVarMap({}),
    methodRunner: { call: async () => { throw new Error('not impl'); } },
    onProgress: (e) => events.push(e),
  };
  return { ctx, events, page };
}

function trace(events: ProgressEvent[]): string[] {
  return events.map((e) => {
    switch (e.kind) {
      case 'stepStart': return `+${e.command.type}`;
      case 'stepEnd': return `-${e.result.command.type}${e.result.passed ? '✓' : '✗'}`;
      case 'include': return `@${path.basename(e.file.filePath)}`;
    }
  });
}

function assertWellBracketed(events: ProgressEvent[]): void {
  const open: { type: Command['type']; children: number }[] = [];
  for (const e of events) {
    const top = open[open.length - 1];
    if (e.kind === 'stepStart') {
      if (top) top.children++;
      open.push({ type: e.command.type, children: 0 });
    } else if (e.kind === 'stepEnd') {
      expect(top, 'stepEnd has an open step').toBeDefined();
      expect(e.result.command.type, 'stepEnd closes the innermost open step').toBe(top!.type);
      open.pop();
    } else {
      expect(top?.type, 'include arrives inside an open runFlow').toBe('runFlow');
      expect(top!.children, 'include arrives before the first child').toBe(0);
    }
  }
  expect(open, 'every stepStart has a stepEnd').toEqual([]);
}

function tmpFlow(name: string, body: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uivisor-progress-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, body, 'utf8');
  return file;
}

function flow(commands: Command[], filePath = '/top.yaml'): FlowFile {
  return { baseUrl: 'http://test', filePath, commands: commands.map((command) => ({ command })), sessions: [], tags: [] };
}

describe('dispatch progress events', () => {
  it('top-level flow brackets each command and halts after the first failure', async () => {
    const { ctx, events, page } = record();
    await runFlow(flow([
      { type: 'setVar', name: 'a', value: '1' },
      { type: 'testVarSet', name: 'missing' },
      { type: 'setVar', name: 'b', value: '2' },
    ]), page, ctx);

    expect(trace(events)).toEqual(['+setVar', '-setVar✓', '+testVarSet', '-testVarSet✗']);
    assertWellBracketed(events);
  });

  it('stepStart carries the interpolated command and stepEnd the result dispatch returns', async () => {
    const { ctx, events, page } = record();
    ctx.varMap.set('who', 'alice');
    const result = await dispatch(page, { command: { type: 'setVar', name: 'x', value: '${who}' } }, ctx);

    expect(events[0]).toEqual({ kind: 'stepStart', command: { type: 'setVar', name: 'x', value: 'alice' } });
    expect(events[1]).toEqual({ kind: 'stepEnd', result });
  });

  it('interpolation failure still brackets the step, with the raw command', async () => {
    const { ctx, events, page } = record();
    const raw: Command = { type: 'setVar', name: 'x', value: '${nope}' };
    const result = await dispatch(page, { command: raw }, ctx);

    expect(result.passed).toBe(false);
    expect(events).toEqual([
      { kind: 'stepStart', command: raw },
      { kind: 'stepEnd', result },
    ]);
  });

  it('runFlow emits include after loading, then the child steps, inside its own bracket', async () => {
    const child = tmpFlow('child.yaml', 'appId: http://test\ncommands:\n  - setVar: c1=one\n  - setVar: c2=two\n');
    const { ctx, events, page } = record();
    await runFlow(flow([
      { type: 'runFlow', path: child },
      { type: 'setVar', name: 'after', value: 'x' },
    ]), page, ctx);

    expect(trace(events)).toEqual([
      '+runFlow', '@child.yaml', '+setVar', '-setVar✓', '+setVar', '-setVar✓', '-runFlow✓',
      '+setVar', '-setVar✓',
    ]);
    const include = events[1] as Extract<ProgressEvent, { kind: 'include' }>;
    expect(include.file.commands.map((sc) => sc.command.type), 'include carries the child plan').toEqual(['setVar', 'setVar']);
    assertWellBracketed(events);
  });

  it('nested within emits each do child inside its parent bracket', async () => {
    const { ctx, events, page } = record();
    await dispatch(page, {
      command: {
        type: 'within',
        selector: 'text=Outer',
        do: [
          { command: { type: 'setVar', name: 'a', value: '1' } },
          { command: { type: 'within', selector: 'text=Inner', do: [{ command: { type: 'setVar', name: 'b', value: '2' } }] } },
          { command: { type: 'setVar', name: 'c', value: '3' } },
        ],
      },
    }, ctx);

    expect(trace(events)).toEqual([
      '+within', '+setVar', '-setVar✓', '+within', '+setVar', '-setVar✓', '-within✓', '+setVar', '-setVar✓', '-within✓',
    ]);
    assertWellBracketed(events);
  });

  it('within whose container is missing ends without starting any child', async () => {
    const { ctx, events, page } = record();
    await dispatch(page, { command: { type: 'within', selector: 'css=.absent', do: [{ command: { type: 'setVar', name: 'a', value: '1' } }] } }, ctx);

    expect(trace(events)).toEqual(['+within', '-within✗']);
  });

  it('runFlow to a missing file brackets the step with no include', async () => {
    const { ctx, events, page } = record();
    await dispatch(page, { command: { type: 'runFlow', path: '/definitely/not/here.yaml' } }, ctx);

    expect(trace(events)).toEqual(['+runFlow', '-runFlow✗']);
  });

  it('runFlow to an unparsable file brackets the step with no include', async () => {
    const broken = tmpFlow('broken.yaml', 'appId: http://test\ncommands: 42\n');
    const { ctx, events, page } = record();
    const result = await dispatch(page, { command: { type: 'runFlow', path: broken } }, ctx);

    expect(result.passed).toBe(false);
    expect(trace(events)).toEqual(['+runFlow', '-runFlow✗']);
  });

  it('child flow that throws mid-run still closes the runFlow bracket', async () => {
    const child = tmpFlow('ghost.yaml', 'appId: http://test\nsessions:\n  - id: ghost\ncommands:\n  - session: ghost\n    setVar: g=1\n');
    const { ctx, events, page } = record();
    const result = await dispatch(page, { command: { type: 'runFlow', path: child } }, ctx);

    expect(result.message).toMatch(/Unknown session: "ghost"/);
    expect(trace(events)).toEqual(['+runFlow', '@ghost.yaml', '-runFlow✗']);
    assertWellBracketed(events);
  });

  it('a failure inside a child flow halts the child and fails the runFlow step', async () => {
    const child = tmpFlow('fails.yaml', 'appId: http://test\ncommands:\n  - testVarSet: missing\n  - setVar: never=1\n');
    const { ctx, events, page } = record();
    await runFlow(flow([
      { type: 'runFlow', path: child },
      { type: 'setVar', name: 'after', value: 'x' },
    ]), page, ctx);

    expect(trace(events)).toEqual(['+runFlow', '@fails.yaml', '+testVarSet', '-testVarSet✗', '-runFlow✗']);
    assertWellBracketed(events);
  });
});
