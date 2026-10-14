/**
 * tests/unit/var-scope.test.ts
 *
 * Tests that varMap is shared across sessions and nested runFlow calls (T15 — 4 tests).
 * Written before T8/T9 implementation (TDD).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Page } from 'playwright';
import type { FlowFile, RunContext } from '@uivisor/core';
import { createVarMap } from '../../src/engine/varMap';
import { runFlow } from '../../src/engine/index';
import { dispatch } from '../../src/engine/dispatcher';

function makeLocator() {
  return {
    waitFor: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    innerText: vi.fn().mockResolvedValue(''),
    inputValue: vi.fn().mockResolvedValue(''),
    isChecked: vi.fn().mockResolvedValue(false),
    isEnabled: vi.fn().mockResolvedValue(true),
    isDisabled: vi.fn().mockResolvedValue(false),
    count: vi.fn().mockResolvedValue(0),
  };
}

function makePage(url = 'http://test/'): Page {
  const loc = makeLocator();
  return {
    goto: vi.fn().mockResolvedValue(null),
    url: vi.fn().mockReturnValue(url),
    getByText: vi.fn().mockReturnValue(loc),
    getByRole: vi.fn().mockReturnValue(loc),
    getByLabel: vi.fn().mockReturnValue(loc),
    getByPlaceholder: vi.fn().mockReturnValue(loc),
    getByTestId: vi.fn().mockReturnValue(loc),
    locator: vi.fn().mockReturnValue(loc),
    evaluate: vi.fn().mockResolvedValue(undefined),
    keyboard: { press: vi.fn().mockResolvedValue(undefined) },
    reload: vi.fn().mockResolvedValue(null),
    goBack: vi.fn().mockResolvedValue(null),
    goForward: vi.fn().mockResolvedValue(null),
    setViewportSize: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('')),
    waitForURL: vi.fn().mockResolvedValue(undefined),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
  } as unknown as Page;
}

function makeCtx(pageA: Page, pageB?: Page, base: Record<string, string> = {}): RunContext {
  const varMap = createVarMap(base);
  const sessions = new Map<string, Page>([['alice', pageA]]);
  if (pageB) sessions.set('bob', pageB);
  return {
    lastTappedLocator: null,
    callStack: new Set(),
    indentLevel: 0,
    runDir: os.tmpdir(),
    sessions,
    defaultSessionId: 'alice',
    varMap,
    methodRunner: { call: async () => { throw new Error('not impl'); } },
  };
}

function flow(cmds: FlowFile['commands']): FlowFile {
  return {
    baseUrl: 'http://test',
    filePath: '/flow.yaml',
    commands: cmds,
    sessions: [],
    tags: [],
  };
}

describe('var scope: shared varMap across sessions', () => {
  it('setVar in alice session is visible to bob session', async () => {
    const pageA = makePage();
    const pageB = makePage();
    const ctx = makeCtx(pageA, pageB);

    // Flow: alice sets a var, bob reads it via testVarSet
    const testFlow = flow([
      { session: 'alice', command: { type: 'setVar', name: 'shared', value: 'yes' } },
      { session: 'bob', command: { type: 'testVarSet', name: 'shared' } },
    ]);

    const result = await runFlow(testFlow, pageA, ctx);
    expect(result.passed).toBe(true);
  });

  it('unsetVar in one session removes var for all sessions', async () => {
    const pageA = makePage();
    const pageB = makePage();
    const ctx = makeCtx(pageA, pageB);
    ctx.varMap.set('shared', 'value');

    const testFlow = flow([
      { session: 'alice', command: { type: 'unsetVar', name: 'shared' } },
      { session: 'bob', command: { type: 'testVarSet', name: 'shared' } },
    ]);

    const result = await runFlow(testFlow, pageA, ctx);
    expect(result.passed).toBe(false); // bob's testVarSet fails because var was unset
  });
});

describe('var scope: shared varMap across nested runFlow', () => {
  it('setVar in parent flow is visible in sub-flow via runFlow', async () => {
    const pageA = makePage();
    const ctx = makeCtx(pageA);

    const tmpDir = os.tmpdir();
    const subFlowPath = path.join(tmpDir, `uivisor-sub-${Date.now()}.yaml`);
    fs.writeFileSync(
      subFlowPath,
      `appId: http://test\ncommands:\n  - testVarSet: parentVar\n`,
      'utf8',
    );

    ctx.varMap.set('parentVar', 'fromParent');

    const testFlow = flow([
      { command: { type: 'runFlow', path: subFlowPath } },
    ]);

    try {
      const result = await runFlow(testFlow, pageA, ctx);
      expect(result.passed).toBe(true);
    } finally {
      fs.unlinkSync(subFlowPath);
    }
  });

  it('setVar in sub-flow is visible in parent after runFlow completes', async () => {
    const pageA = makePage();
    const ctx = makeCtx(pageA);

    const tmpDir = os.tmpdir();
    const subFlowPath = path.join(tmpDir, `uivisor-sub2-${Date.now()}.yaml`);
    fs.writeFileSync(
      subFlowPath,
      `appId: http://test\ncommands:\n  - setVar: subResult=done\n`,
      'utf8',
    );

    const testFlow = flow([
      { command: { type: 'runFlow', path: subFlowPath } },
      { command: { type: 'testVarSet', name: 'subResult' } },
    ]);

    try {
      const result = await runFlow(testFlow, pageA, ctx);
      expect(result.passed).toBe(true);
    } finally {
      fs.unlinkSync(subFlowPath);
    }
  });
});

describe('runFlow with vars: scoping', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uivisor-runflow-vars-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function writeFile(name: string, body: string): string {
    const filePath = path.join(dir, name);
    fs.writeFileSync(filePath, body, 'utf8');
    return filePath;
  }

  function mainFlow(cmds: FlowFile['commands']): FlowFile {
    return { ...flow(cmds), filePath: path.join(dir, 'main.yaml') };
  }

  const call = (file: string, vars?: Record<string, string>): FlowFile['commands'][number] => ({
    command: vars ? { type: 'runFlow', path: file, vars } : { type: 'runFlow', path: file },
  });
  const expectVar = (name: string, expected: string): FlowFile['commands'][number] => ({
    command: { type: 'testVarSet', name, expected },
  });

  async function runMain(ctx: RunContext, cmds: FlowFile['commands']) {
    const result = await runFlow(mainFlow(cmds), ctx.sessions.get('alice')!, ctx);
    const failed = result.commandResults.find((r) => !r.passed);
    expect(failed?.message, 'first failure').toBeUndefined();
    expect(result.passed).toBe(true);
    return result;
  }

  it('a call-site override is visible in the child and the caller value returns after', async () => {
    const ctx = makeCtx(makePage(), undefined, { u: 'A' });
    writeFile('child.yaml', `appId: http://test\ncommands:\n  - testVarSet: { name: u, expected: B }\n`);

    await runMain(ctx, [call('./child.yaml', { u: 'B' }), expectVar('u', 'A')]);
  });

  it('a child default applies inside the child and is absent after', async () => {
    const ctx = makeCtx(makePage());
    writeFile('child.yaml', `appId: http://test\nvars:\n  t: 5\ncommands:\n  - testVarSet: { name: t, expected: "5" }\n`);

    await runMain(ctx, [call('./child.yaml')]);
    expect(ctx.varMap.get('t')).toBeUndefined();
  });

  it('a child config value outranks its inline vars as a default', async () => {
    const ctx = makeCtx(makePage());
    writeFile('child.yml', `t: from-config\n`);
    writeFile(
      'child.yaml',
      `appId: http://test\nconfig: child.yml\nvars:\n  t: inline\ncommands:\n  - testVarSet: { name: t, expected: from-config }\n`,
    );

    await runMain(ctx, [call('./child.yaml')]);
  });

  it('a caller value outranks the child default', async () => {
    const ctx = makeCtx(makePage(), undefined, { t: 'main' });
    writeFile('child.yaml', `appId: http://test\nvars:\n  t: child\ncommands:\n  - testVarSet: { name: t, expected: main }\n`);

    await runMain(ctx, [call('./child.yaml'), expectVar('t', 'main')]);
  });

  it('call-site vars are interpolated against the caller map', async () => {
    const ctx = makeCtx(makePage(), undefined, { admin: 'root' });
    writeFile('child.yaml', `appId: http://test\ncommands:\n  - testVarSet: { name: u, expected: root }\n`);

    await runMain(ctx, [call('./child.yaml', { u: '${admin}' })]);
    expect(ctx.varMap.get('u')).toBeUndefined();
  });

  it('a child setVar of an overridden name is undone on return', async () => {
    const ctx = makeCtx(makePage());
    writeFile(
      'child.yaml',
      `appId: http://test\ncommands:\n  - testVarSet: { name: u, expected: B }\n  - setVar: u=C\n  - testVarSet: { name: u, expected: C }\n`,
    );

    await runMain(ctx, [
      { command: { type: 'setVar', name: 'u', value: 'A' } },
      call('./child.yaml', { u: 'B' }),
      expectVar('u', 'A'),
    ]);
  });

  it('a child setVar of a name that arrived as a child default survives the return', async () => {
    const ctx = makeCtx(makePage());
    writeFile('child.yaml', `appId: http://test\nvars:\n  t: 5\ncommands:\n  - setVar: t=9\n`);

    await runMain(ctx, [call('./child.yaml'), expectVar('t', '9')]);
  });

  it('the same name overridden at two depths unwinds level by level', async () => {
    const ctx = makeCtx(makePage(), undefined, { x: 'orig' });
    writeFile('c.yaml', `appId: http://test\ncommands:\n  - testVarSet: { name: x, expected: "2" }\n`);
    writeFile(
      'b.yaml',
      [
        'appId: http://test',
        'commands:',
        '  - testVarSet: { name: x, expected: "1" }',
        '  - runFlow: { file: ./c.yaml, vars: { x: 2 } }',
        '  - testVarSet: { name: x, expected: "1" }',
        '',
      ].join('\n'),
    );

    await runMain(ctx, [call('./b.yaml', { x: '1' }), expectVar('x', 'orig')]);
  });

  it('a child default fills a name the caller unset, and the name stays unset after', async () => {
    const ctx = makeCtx(makePage(), undefined, { k: 'base' });
    writeFile('child.yaml', `appId: http://test\nvars:\n  k: d\ncommands:\n  - testVarSet: { name: k, expected: d }\n`);

    await runMain(ctx, [{ command: { type: 'unsetVar', name: 'k' } }, call('./child.yaml')]);
    expect(ctx.varMap.get('k')).toBeUndefined();
  });

  it('the same child can be called twice with different vars', async () => {
    const ctx = makeCtx(makePage());
    writeFile('child.yaml', `appId: http://test\nvars:\n  item: dflt\ncommands:\n  - setVar: last=\${item}\n`);

    await runMain(ctx, [
      call('./child.yaml', { item: 'apple' }),
      expectVar('last', 'apple'),
      call('./child.yaml', { item: 'banana' }),
      expectVar('last', 'banana'),
      call('./child.yaml'),
      expectVar('last', 'dflt'),
    ]);
    expect(ctx.varMap.get('item')).toBeUndefined();
  });

  describe('every exit path restores the caller state', () => {
    const entryStack = () => new Set(['/outer.yaml']);

    async function callOnce(ctx: RunContext, file: string) {
      return dispatch(ctx.sessions.get('alice')!, { command: { type: 'runFlow', path: file, vars: { u: 'B' } } }, ctx, 'main', dir);
    }

    function expectRestored(ctx: RunContext) {
      expect(ctx.varMap.get('u')).toBe('A');
      expect(ctx.varMap.get('t')).toBeUndefined();
      expect(ctx.indentLevel).toBe(0);
      expect([...ctx.callStack]).toEqual(['/outer.yaml']);
    }

    it.each([
      ['the child fails mid-flow', `appId: http://test\nvars:\n  t: 5\ncommands:\n  - setVar: u=C\n  - testVarSet: missing\n`, /missing/],
      ['the child cannot be loaded', `appId: http://test\nconfig: nope.yml\ncommands:\n  - goto: http://test\n`, /Config file not found/],
      [
        'the child throws while running',
        `appId: http://test\nvars:\n  t: 5\nsessions:\n  - id: ghost\ncommands:\n  - session: ghost\n    goto: http://test\n`,
        /Unknown session: "ghost"/,
      ],
    ])('when %s', async (_label, body, message) => {
      const ctx = makeCtx(makePage(), undefined, { u: 'A' });
      ctx.callStack = entryStack();
      writeFile('child.yaml', body);
      writeFile('ok.yaml', `appId: http://test\ncommands:\n  - testVarSet: { name: u, expected: B }\n`);

      const failed = await callOnce(ctx, './child.yaml');
      expect(failed.passed).toBe(false);
      expect(failed.message).toMatch(message);
      expectRestored(ctx);

      const retried = await callOnce(ctx, './ok.yaml');
      expect(retried.message).toBeUndefined();
      expect(retried.passed).toBe(true);
      expectRestored(ctx);
    });
  });

  it('a self-include of the top-level flow is reported as circular', async () => {
    const ctx = makeCtx(makePage());
    writeFile('main.yaml', `appId: http://test\ncommands:\n  - goto: http://test\n`);

    const result = await runFlow(mainFlow([call('./main.yaml')]), ctx.sessions.get('alice')!, ctx);

    expect(result.passed).toBe(false);
    expect(result.commandResults[0]?.message).toMatch(/Circular flow reference detected/);
    expect(ctx.callStack.size).toBe(0);
  });
});

describe('runFlow errors name the flow and the call site', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uivisor-runflow-errors-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function writeFile(name: string, body: string): void {
    fs.writeFileSync(path.join(dir, name), body, 'utf8');
  }

  async function runMain(cmds: FlowFile['commands']) {
    const ctx = makeCtx(makePage());
    const main: FlowFile = { ...flow(cmds), filePath: path.join(dir, 'main.yaml') };
    const result = await runFlow(main, ctx.sessions.get('alice')!, ctx);
    expect(result.passed).toBe(false);
    return result.commandResults.at(-1)!;
  }

  it('an unresolved variable at the top level names the flow', async () => {
    const failed = await runMain([{ command: { type: 'goto', url: 'http://test/${otp}' } }]);
    expect(failed.message).toBe('Variable "otp" is not defined in flow "main"');
  });

  it('an unresolved variable in a child names the child and the call site', async () => {
    writeFile('child.yaml', 'appId: http://test\ncommands:\n  - goto: "http://test/${otp}"\n');

    const failed = await runMain([{ command: { type: 'runFlow', path: './child.yaml' } }]);

    expect(failed.message).toBe(
      'Variable "otp" is not defined in flow "child", included from flow "main" via runFlow: ./child.yaml',
    );
  });

  it('an unresolved variable in the call-site vars names the caller and the runFlow, and the child never runs', async () => {
    writeFile('child.yaml', 'appId: http://test\ncommands:\n  - goto: http://test\n');

    const failed = await runMain([
      { command: { type: 'runFlow', path: './child.yaml', vars: { u: '${adminNric}', t: '3' } } },
    ]);

    expect(failed.message).toBe(
      'Variable "adminNric" is not defined in flow "main" at runFlow: ./child.yaml (u=${adminNric}, t=3)',
    );
    expect(failed.nestedResult).toBeUndefined();
  });

  it('a failure two levels deep carries one included-from clause per level, innermost first', async () => {
    writeFile('otp.yaml', 'appId: http://test\ncommands:\n  - goto: "http://test/${otp}"\n');
    writeFile('login.yaml', 'appId: http://test\ncommands:\n  - runFlow: ./otp.yaml\n');

    const failed = await runMain([{ command: { type: 'runFlow', path: './login.yaml', vars: { u: 'S1' } } }]);

    expect(failed.message).toBe(
      'Variable "otp" is not defined in flow "otp", included from flow "login" via runFlow: ./otp.yaml' +
        ', included from flow "main" via runFlow: ./login.yaml (u=S1)',
    );
  });

  it('any other failure in a child also names the call site', async () => {
    writeFile('child.yaml', 'appId: http://test\ncommands:\n  - testVarSet: missing\n');

    const failed = await runMain([{ command: { type: 'runFlow', path: './child.yaml' } }]);

    expect(failed.message).toBe(
      'testVarSet: variable "missing" is not set or is empty, included from flow "main" via runFlow: ./child.yaml',
    );
  });
});
