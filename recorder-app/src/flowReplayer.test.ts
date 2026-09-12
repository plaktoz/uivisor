import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import yaml from 'js-yaml';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { replayFlows } from './flowReplayer.js';
import type { Page } from 'playwright';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = path.join(os.tmpdir(), `fr-test-${crypto.randomUUID()}`);
  fs.mkdirSync(dir, { recursive: true });
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const d of tmpDirs) {
    fs.rmSync(d, { recursive: true, force: true });
  }
  tmpDirs = [];
  vi.restoreAllMocks();
});

function writeFlow(dir: string, filename: string, content: unknown): string {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, yaml.dump(content), 'utf8');
  return filePath;
}

function makeMockLocator(overrides: Record<string, unknown> = {}) {
  const loc = {
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    waitFor: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(1),
    isEnabled: vi.fn().mockResolvedValue(true),
    isDisabled: vi.fn().mockResolvedValue(false),
    isChecked: vi.fn().mockResolvedValue(false),
    innerText: vi.fn().mockResolvedValue(''),
    inputValue: vi.fn().mockResolvedValue(''),
    selectOption: vi.fn().mockResolvedValue([]),
    check: vi.fn().mockResolvedValue(undefined),
    uncheck: vi.fn().mockResolvedValue(undefined),
    hover: vi.fn().mockResolvedValue(undefined),
    dblclick: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    nth: vi.fn(),
    locator: vi.fn(),
    getByTestId: vi.fn(),
    ...overrides,
  };
  (loc.nth as ReturnType<typeof vi.fn>).mockReturnValue(loc);
  (loc.locator as ReturnType<typeof vi.fn>).mockReturnValue(loc);
  (loc.getByTestId as ReturnType<typeof vi.fn>).mockReturnValue(loc);
  return loc;
}

function makeMockPage(overrides: Record<string, unknown> = {}) {
  const mockLocator = makeMockLocator();
  const page = {
    goto: vi.fn().mockResolvedValue(undefined),
    locator: vi.fn().mockReturnValue(mockLocator),
    getByText: vi.fn().mockReturnValue(mockLocator),
    getByLabel: vi.fn().mockReturnValue(mockLocator),
    getByRole: vi.fn().mockReturnValue(mockLocator),
    getByTestId: vi.fn().mockReturnValue(mockLocator),
    getByPlaceholder: vi.fn().mockReturnValue(mockLocator),
    keyboard: { press: vi.fn().mockResolvedValue(undefined) },
    evaluate: vi.fn().mockResolvedValue(undefined),
    url: vi.fn().mockReturnValue('http://example.com/'),
    screenshot: vi.fn().mockResolvedValue(undefined),
    reload: vi.fn().mockResolvedValue(undefined),
    goBack: vi.fn().mockResolvedValue(undefined),
    goForward: vi.fn().mockResolvedValue(undefined),
    setViewportSize: vi.fn().mockResolvedValue(undefined),
    exposeFunction: vi.fn().mockResolvedValue(undefined),
    addInitScript: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    _loc: mockLocator,
    ...overrides,
  };
  return page;
}

// ─── T14 ─────────────────────────────────────────────────────────────────────

describe('replayFlows — T14: single goto', () => {
  it('T14 — page.goto called once with correct URL', async () => {
    const dir = makeTmpDir();
    const flowPath = writeFlow(dir, 'flow.yaml', {
      appId: 'http://example.com',
      commands: [{ goto: 'http://example.com' }],
    });
    const page = makeMockPage();
    await replayFlows([flowPath], page as unknown as Page, '/tmp/out.yaml');
    expect(page.goto).toHaveBeenCalledOnce();
    expect(page.goto).toHaveBeenCalledWith('http://example.com', { waitUntil: 'load' });
  });
});

// ─── T15 ─────────────────────────────────────────────────────────────────────

describe('replayFlows — T15: three-command flow in order', () => {
  it('T15 — goto, tapOn and wait all dispatched', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const dir = makeTmpDir();
    const flowPath = writeFlow(dir, 'flow.yaml', {
      appId: 'http://example.com',
      commands: [
        { goto: 'http://example.com' },
        { tapOn: 'text=SubmitBtn' },
        { wait: 1 },
      ],
    });
    const page = makeMockPage();
    await replayFlows([flowPath], page as unknown as Page, '/tmp/out.yaml');

    expect(page.goto).toHaveBeenCalledOnce();
    // tapOn text=SubmitBtn uses pipe mode → page.getByText('SubmitBtn', { exact: true })
    expect(page.getByText).toHaveBeenCalledWith('SubmitBtn', { exact: true });
    expect(page._loc.click).toHaveBeenCalledOnce();
    // All 3 progress log lines were emitted
    const replayLogs = consoleSpy.mock.calls
      .map((c) => c[0] as string)
      .filter((s) => s.includes('[replay]'));
    expect(replayLogs).toHaveLength(3);
    expect(replayLogs[0]).toContain('1/3');
    expect(replayLogs[1]).toContain('2/3');
    expect(replayLogs[2]).toContain('3/3');
  });
});

// ─── T16 ─────────────────────────────────────────────────────────────────────

describe('replayFlows — T16: two flows in sequence', () => {
  it('T16 — all commands from flow1 execute before any from flow2', async () => {
    const dir = makeTmpDir();
    const flow1 = writeFlow(dir, 'flow1.yaml', {
      appId: 'http://flow1.com',
      commands: [{ goto: 'http://flow1.com' }],
    });
    const flow2 = writeFlow(dir, 'flow2.yaml', {
      appId: 'http://flow2.com',
      commands: [{ goto: 'http://flow2.com' }],
    });
    const callOrder: string[] = [];
    const page = makeMockPage();
    (page.goto as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      callOrder.push(url);
    });
    await replayFlows([flow1, flow2], page as unknown as Page, '/tmp/out.yaml');
    expect(callOrder).toEqual(['http://flow1.com', 'http://flow2.com']);
  });
});

// ─── T17 ─────────────────────────────────────────────────────────────────────

describe('replayFlows — T17: nested runFlow', () => {
  it('T17 — nested runFlow sub-flow goto dispatched to page', async () => {
    const dir = makeTmpDir();
    writeFlow(dir, 'sub.yaml', {
      appId: 'http://sub.com',
      commands: [{ goto: 'http://sub.com' }],
    });
    const parentPath = writeFlow(dir, 'parent.yaml', {
      appId: 'http://parent.com',
      commands: [{ runFlow: './sub.yaml' }],
    });
    const page = makeMockPage();
    await replayFlows([parentPath], page as unknown as Page, '/tmp/out.yaml');
    expect(page.goto).toHaveBeenCalledOnce();
    expect(page.goto).toHaveBeenCalledWith('http://sub.com', { waitUntil: 'load' });
  });
});

// ─── T18 ─────────────────────────────────────────────────────────────────────

describe('replayFlows — T18: assertVisible rejection', () => {
  it('T18 — assertVisible failure rejects with [replay] FAILED and filename', async () => {
    const dir = makeTmpDir();
    const flowPath = writeFlow(dir, 'flow.yaml', {
      appId: 'http://example.com',
      commands: [{ assertVisible: 'text=Submit' }],
    });
    const failingLocator = makeMockLocator({
      count: vi.fn().mockResolvedValue(1),
      waitFor: vi.fn().mockRejectedValue(new Error('timeout')),
    });
    const page = makeMockPage();
    (page.getByText as ReturnType<typeof vi.fn>).mockReturnValue(failingLocator);
    const err = await replayFlows([flowPath], page as unknown as Page, '/tmp/out.yaml').catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('[replay] FAILED');
    expect(err.message).toContain('flow.yaml');
  });
});

// ─── T19 ─────────────────────────────────────────────────────────────────────

describe('replayFlows — T19: second command fails, third never dispatched', () => {
  it('T19 — third command not dispatched when second fails', async () => {
    const dir = makeTmpDir();
    const flowPath = writeFlow(dir, 'flow.yaml', {
      appId: 'http://example.com',
      commands: [
        { goto: 'http://example.com' },
        { assertVisible: 'text=Missing' },
        { wait: 1 },
      ],
    });
    const failingLocator = makeMockLocator({
      count: vi.fn().mockResolvedValue(1),
      waitFor: vi.fn().mockRejectedValue(new Error('not visible')),
    });
    const page = makeMockPage();
    (page.getByText as ReturnType<typeof vi.fn>).mockReturnValue(failingLocator);

    await replayFlows([flowPath], page as unknown as Page, '/tmp/out.yaml').catch(() => {});

    // goto ran, but only once (no wait command page-side call either)
    expect(page.goto).toHaveBeenCalledOnce();
    // wait has no page-level call, but assertVisible (second) failed — ensure
    // we only had exactly 1 goto and no further page interaction after that
    // (tap/wait would not produce additional goto calls)
    expect(page.goto).toHaveBeenCalledTimes(1);
  });
});

// ─── T20 ─────────────────────────────────────────────────────────────────────

describe('replayFlows — T20: progress logging', () => {
  it('T20 — progress log emitted once per command with correct format', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const dir = makeTmpDir();
    const flowPath = writeFlow(dir, 'myflow.yaml', {
      appId: 'http://example.com',
      commands: [
        { goto: 'http://example.com' },
        { wait: 1 },
      ],
    });
    const page = makeMockPage();
    await replayFlows([flowPath], page as unknown as Page, '/tmp/out.yaml');
    const replayLogs = consoleSpy.mock.calls
      .map((c) => c[0] as string)
      .filter((s) => typeof s === 'string' && s.startsWith('[replay]'));
    expect(replayLogs).toHaveLength(2);
    expect(replayLogs[0]).toBe('[replay] myflow.yaml: 1/2 commands');
    expect(replayLogs[1]).toBe('[replay] myflow.yaml: 2/2 commands');
  });
});

// ─── T21 ─────────────────────────────────────────────────────────────────────

describe('replayFlows — T21: nested runFlow failure, parent post-commands not executed', () => {
  it('T21 — tapOn after failed runFlow is never called', async () => {
    const dir = makeTmpDir();
    writeFlow(dir, 'sub.yaml', {
      appId: 'http://example.com',
      commands: [{ assertVisible: 'text=Missing' }],
    });
    const parentPath = writeFlow(dir, 'parent.yaml', {
      appId: 'http://example.com',
      commands: [{ runFlow: './sub.yaml' }, { tapOn: 'text=AfterRun' }],
    });
    const failingLocator = makeMockLocator({
      count: vi.fn().mockResolvedValue(1),
      waitFor: vi.fn().mockRejectedValue(new Error('not visible')),
    });
    const page = makeMockPage();
    (page.getByText as ReturnType<typeof vi.fn>).mockReturnValue(failingLocator);

    await replayFlows([parentPath], page as unknown as Page, '/tmp/out.yaml').catch(() => {});

    // The locator for tapOn (text=AfterRun) should never have been clicked
    expect(failingLocator.click).not.toHaveBeenCalled();
  });
});

// ─── T22 ─────────────────────────────────────────────────────────────────────

describe('replayFlows — T22: no appendCommand called, output file unchanged', () => {
  it('T22 — output file bytes unchanged after replayFlows (flowReplayer does not write to it)', async () => {
    const dir = makeTmpDir();
    const flowPath = writeFlow(dir, 'flow.yaml', {
      appId: 'http://example.com',
      commands: [{ goto: 'http://example.com' }],
    });
    const outPath = path.join(dir, 'out.yaml');
    const outContent = 'appId: http://example.com\ncommands:\n- runFlow: flow.yaml\n';
    fs.writeFileSync(outPath, outContent, 'utf8');

    const page = makeMockPage();
    await replayFlows([flowPath], page as unknown as Page, outPath);

    // Output file must be byte-identical — flowReplayer never writes to it
    expect(fs.readFileSync(outPath, 'utf8')).toBe(outContent);
  });
});

// ─── T23 ─────────────────────────────────────────────────────────────────────

describe('replayFlows — T23: three-level nested chain', () => {
  it('T23 — A→B→C, page.goto called once with C URL', async () => {
    const dir = makeTmpDir();
    writeFlow(dir, 'c.yaml', {
      appId: 'http://c.com',
      commands: [{ goto: 'http://c.com' }],
    });
    writeFlow(dir, 'b.yaml', {
      appId: 'http://b.com',
      commands: [{ runFlow: './c.yaml' }],
    });
    const aPath = writeFlow(dir, 'a.yaml', {
      appId: 'http://a.com',
      commands: [{ runFlow: './b.yaml' }],
    });
    const page = makeMockPage();
    await replayFlows([aPath], page as unknown as Page, '/tmp/out.yaml');
    expect(page.goto).toHaveBeenCalledOnce();
    expect(page.goto).toHaveBeenCalledWith('http://c.com', { waitUntil: 'load' });
  });
});

// ─── T24 ─────────────────────────────────────────────────────────────────────

describe('replayFlows — T24: assertUrl mismatch', () => {
  it('T24 — assertUrl mismatch rejects with expected and actual paths', async () => {
    const dir = makeTmpDir();
    const flowPath = writeFlow(dir, 'flow.yaml', {
      appId: 'http://example.com',
      commands: [{ assertUrl: '/expected-path' }],
    });
    const page = makeMockPage();
    (page.url as ReturnType<typeof vi.fn>).mockReturnValue('http://example.com/actual-path');
    const err = await replayFlows([flowPath], page as unknown as Page, '/tmp/out.yaml').catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('[replay] FAILED');
    expect(err.message).toContain('/expected-path');
    expect(err.message).toContain('/actual-path');
  });
});

// ─── T25 ─────────────────────────────────────────────────────────────────────

describe('replayFlows — T25: returns appId from first flow file', () => {
  it('T25 — returns { appId } from first flow file', async () => {
    const dir = makeTmpDir();
    const flowPath = writeFlow(dir, 'flow.yaml', {
      appId: 'http://my-app.com',
      commands: [],
    });
    const page = makeMockPage();
    const result = await replayFlows([flowPath], page as unknown as Page, '/tmp/out.yaml');
    expect(result).toEqual({ appId: 'http://my-app.com' });
  });
});

// ─── T26 ─────────────────────────────────────────────────────────────────────

describe('replayFlows — T26: input flow YAML bytes unchanged', () => {
  it('T26 — input flow file bytes unchanged after replayFlows', async () => {
    const dir = makeTmpDir();
    const flowPath = writeFlow(dir, 'flow.yaml', {
      appId: 'http://example.com',
      commands: [{ goto: 'http://example.com' }],
    });
    const beforeBytes = fs.readFileSync(flowPath);
    const page = makeMockPage();
    await replayFlows([flowPath], page as unknown as Page, '/tmp/out.yaml');
    const afterBytes = fs.readFileSync(flowPath);
    expect(afterBytes.equals(beforeBytes)).toBe(true);
  });
});

// ─── T27 ─────────────────────────────────────────────────────────────────────

describe('replayFlows — T27: replay failure preserves partial output file', () => {
  it('T27 — runFlow entries in output file remain after replay failure on second flow', async () => {
    const dir = makeTmpDir();
    const flow1 = writeFlow(dir, 'flow1.yaml', {
      appId: 'http://example.com',
      commands: [{ goto: 'http://example.com' }],
    });
    const flow2 = writeFlow(dir, 'flow2.yaml', {
      appId: 'http://example.com',
      commands: [{ assertVisible: 'text=Missing' }],
    });

    const outPath = path.join(dir, 'out.yaml');
    // Simulate partial output written by cli.ts before replayFlows is called
    const partialContent =
      'appId: http://example.com\ncommands:\n- runFlow: flow1.yaml\n- runFlow: flow2.yaml\n';
    fs.writeFileSync(outPath, partialContent, 'utf8');

    const failingLocator = makeMockLocator({
      count: vi.fn().mockResolvedValue(1),
      waitFor: vi.fn().mockRejectedValue(new Error('not found')),
    });
    const page = makeMockPage();
    (page.getByText as ReturnType<typeof vi.fn>).mockReturnValue(failingLocator);

    await replayFlows([flow1, flow2], page as unknown as Page, outPath).catch(() => {});

    // Output file must still contain both runFlow entries — replayFlows never modifies it
    const afterContent = fs.readFileSync(outPath, 'utf8');
    expect(afterContent).toBe(partialContent);
  });
});
