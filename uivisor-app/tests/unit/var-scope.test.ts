/**
 * tests/unit/var-scope.test.ts
 *
 * Tests that varMap is shared across sessions and nested runFlow calls (T15 — 4 tests).
 * Written before T8/T9 implementation (TDD).
 */

import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Page } from 'playwright';
import type { FlowFile, RunContext } from '@uivisor/core';
import { createVarMap } from '../../src/engine/varMap';
import { runFlow } from '../../src/engine/index';

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

function makeCtx(pageA: Page, pageB?: Page): RunContext {
  const varMap = createVarMap({});
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

describe('var scope: nested runFlow with overrides and defaults', () => {
  it('uses child flow defaults when not overridden by caller', async () => {
    const pageA = makePage();
    const ctx = makeCtx(pageA);

    const tmpDir = os.tmpdir();
    const subFlowPath = path.join(tmpDir, `uivisor-sub-defaults-${Date.now()}.yaml`);
    fs.writeFileSync(
      subFlowPath,
      `appId: http://test\nvars:\n  childDefault: "defaultValue"\ncommands:\n  - testVarSet: childDefault\n`,
      'utf8',
    );

    const testFlow = flow([
      { command: { type: 'runFlow', path: subFlowPath } },
    ]);

    try {
      const result = await runFlow(testFlow, pageA, ctx);
      expect(result.passed).toBe(true);
      // Child defaults should be removed from parent scope after the call
      expect(ctx.varMap.get('childDefault')).toBeUndefined();
    } finally {
      fs.unlinkSync(subFlowPath);
    }
  });

  it('allows call-site overrides to override child defaults and shared map, restoring them after return', async () => {
    const pageA = makePage();
    const ctx = makeCtx(pageA);

    const tmpDir = os.tmpdir();
    const subFlowPath = path.join(tmpDir, `uivisor-sub-overrides-${Date.now()}.yaml`);
    fs.writeFileSync(
      subFlowPath,
      `appId: http://test\nvars:\n  userNric: "S111"\ncommands:\n  - testVarSet: userNric\n`,
      'utf8',
    );

    // Initial state: userNric is not in parent map, but parent has another var that child will use.
    ctx.varMap.set('someOtherVar', 'parentVal');

    const testFlow = flow([
      {
        command: {
          type: 'runFlow',
          path: subFlowPath,
          vars: {
            userNric: 'S999',
          },
        },
      },
    ]);

    try {
      const result = await runFlow(testFlow, pageA, ctx);
      expect(result.passed).toBe(true);
      // Scoped override userNric is removed/restored after return
      expect(ctx.varMap.get('userNric')).toBeUndefined();
    } finally {
      fs.unlinkSync(subFlowPath);
    }
  });

  it('can call same sub-flow twice with different vars', async () => {
    const pageA = makePage();
    const ctx = makeCtx(pageA);

    const tmpDir = os.tmpdir();
    const subFlowPath = path.join(tmpDir, `uivisor-sub-double-${Date.now()}.yaml`);
    fs.writeFileSync(
      subFlowPath,
      `appId: http://test\nvars:\n  item: "defaultItem"\ncommands:\n  - testVarSet: item\n`,
      'utf8',
    );

    const testFlow = flow([
      {
        command: {
          type: 'runFlow',
          path: subFlowPath,
          vars: {
            item: 'apple',
          },
        },
      },
      {
        command: {
          type: 'runFlow',
          path: subFlowPath,
          vars: {
            item: 'banana',
          },
        },
      },
    ]);

    try {
      const result = await runFlow(testFlow, pageA, ctx);
      expect(result.passed).toBe(true);
      expect(ctx.varMap.get('item')).toBeUndefined();
    } finally {
      fs.unlinkSync(subFlowPath);
    }
  });

  it('returns a clear error when a variable is unresolved, naming both child flow and call site', async () => {
    const pageA = makePage();
    const ctx = makeCtx(pageA);

    const tmpDir = os.tmpdir();
    const subFlowPath = path.join(tmpDir, `uivisor-sub-unresolved-${Date.now()}.yaml`);
    fs.writeFileSync(
      subFlowPath,
      `appId: http://test\ncommands:\n  - goto: "http://test/\${unresolvedVar}"\n`,
      'utf8',
    );

    const parentFlowPath = path.join(tmpDir, `uivisor-parent-unresolved-${Date.now()}.yaml`);
    fs.writeFileSync(
      parentFlowPath,
      `appId: http://test\ncommands:\n  - runFlow: "${subFlowPath}"\n`,
      'utf8',
    );

    const testFlow: FlowFile = {
      baseUrl: 'http://test',
      filePath: parentFlowPath,
      commands: [
        { command: { type: 'runFlow', path: subFlowPath } },
      ],
      sessions: [],
      tags: [],
    };

    try {
      const result = await runFlow(testFlow, pageA, ctx);
      expect(result.passed).toBe(false);
      
      const failedResult = result.commandResults.find(r => r.command.type === 'runFlow');
      expect(failedResult).toBeDefined();
      expect(failedResult?.message).toContain('Variable "unresolvedVar" is not defined');
      expect(failedResult?.message).toContain(`in child flow ${subFlowPath}`);
      expect(failedResult?.message).toContain(`called from ${parentFlowPath}`);
    } finally {
      fs.unlinkSync(subFlowPath);
      fs.unlinkSync(parentFlowPath);
    }
  });
});
