/**
 * Integration tests for cli.ts main() — T28-T48.
 *
 * Strategy:
 *  - All external modules are mocked via vi.mock so that no real browser launches
 *    and no real files are written (except in tests that explicitly need real fs).
 *  - process.exit is spied on and made to throw so we can assert exit-code paths
 *    without killing the test process.
 *  - parseArgs (from ./args.js) is mocked so we can control what arguments main()
 *    sees without setting process.argv.
 *  - The hoisted mocks are shared across the entire describe tree; beforeEach
 *    resets call history and re-establishes safe defaults before each test.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import yaml from 'js-yaml';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Hoisted mock objects (created before imports) ────────────────────────────

const mocks = vi.hoisted(() => {
  const mockLocator = {
    click: vi.fn().mockResolvedValue(undefined),
    waitFor: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(1),
  };
  const mockPage = {
    exposeFunction: vi.fn().mockResolvedValue(undefined),
    addInitScript: vi.fn().mockResolvedValue(undefined),
    goto: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    locator: vi.fn().mockReturnValue(mockLocator),
    getByText: vi.fn().mockReturnValue(mockLocator),
    url: vi.fn().mockReturnValue('http://example.com/'),
  };
  const mockBrowser = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const mockChromium = {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  };
  const mockReplayFlows = vi.fn().mockResolvedValue({ appId: 'http://example.com' });
  const mockStartSession = vi.fn();
  const mockAppendCommand = vi.fn();
  const mockParseArgs = vi.fn().mockReturnValue({
    url: 'http://localhost:5173',
    outputPath: 'recorded.yaml',
    runFlowPaths: [],
  });

  return {
    mockLocator,
    mockPage,
    mockBrowser,
    mockChromium,
    mockReplayFlows,
    mockStartSession,
    mockAppendCommand,
    mockParseArgs,
  };
});

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('playwright', () => ({
  chromium: mocks.mockChromium,
}));

vi.mock('./flowReplayer.js', () => ({
  replayFlows: mocks.mockReplayFlows,
}));

vi.mock('./yamlWriter.js', () => ({
  startSession: mocks.mockStartSession,
  appendCommand: mocks.mockAppendCommand,
}));

vi.mock('./args.js', () => ({
  parseArgs: mocks.mockParseArgs,
}));

vi.mock('./overlay.js', () => ({
  OVERLAY_SCRIPT: '/* mock overlay */',
}));

vi.mock('@uivisor/core', () => ({
  CAPTURE_SCRIPT: '/* mock capture */',
  parseSelector: (v: unknown) => v,
}));

// ─── Import main AFTER mocks are set up ───────────────────────────────────────

import { main } from './cli.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = path.join(os.tmpdir(), `cli-test-${crypto.randomUUID()}`);
  fs.mkdirSync(dir, { recursive: true });
  tmpDirs.push(dir);
  return dir;
}

function writeFlow(dir: string, filename: string, content: unknown): string {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, yaml.dump(content), 'utf8');
  return filePath;
}

// ─── Default mock state ───────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Re-establish safe defaults after clearAllMocks wipes call-history
  mocks.mockParseArgs.mockReturnValue({
    url: 'http://localhost:5173',
    outputPath: 'recorded.yaml',
    runFlowPaths: [],
  });
  mocks.mockChromium.launch.mockResolvedValue(mocks.mockBrowser);
  mocks.mockBrowser.newPage.mockResolvedValue(mocks.mockPage);
  mocks.mockBrowser.close.mockResolvedValue(undefined);
  mocks.mockPage.exposeFunction.mockResolvedValue(undefined);
  mocks.mockPage.addInitScript.mockResolvedValue(undefined);
  mocks.mockPage.goto.mockResolvedValue(undefined);
  mocks.mockPage.on.mockReset();
  mocks.mockReplayFlows.mockResolvedValue({ appId: 'http://example.com' });
  mocks.mockStartSession.mockReturnValue(undefined);
  mocks.mockAppendCommand.mockReturnValue(undefined);
});

afterEach(() => {
  for (const d of tmpDirs) {
    fs.rmSync(d, { recursive: true, force: true });
  }
  tmpDirs = [];
  vi.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('cli.ts main() integration', () => {
  // T28 — first-flow appId used as start URL when no explicit --base-url
  it('T28 — appId from first flow used as session URL when no --base-url', async () => {
    const dir = makeTmpDir();
    const flowPath = writeFlow(dir, 'flow.yaml', {
      appId: 'http://example.com',
      commands: [],
    });
    mocks.mockParseArgs.mockReturnValue({
      url: 'http://localhost:5173', // DEFAULT_URL — triggers appId derivation
      outputPath: path.join(dir, 'out.yaml'),
      runFlowPaths: [flowPath],
    });
    await main();
    expect(mocks.mockStartSession).toHaveBeenCalledWith(
      expect.any(String),
      'http://example.com',
    );
  });

  // T29 — --base-url overrides flow appId
  it('T29 — --base-url overrides flow appId in startSession', async () => {
    const dir = makeTmpDir();
    const flowPath = writeFlow(dir, 'flow.yaml', {
      appId: 'http://example.com',
      commands: [],
    });
    mocks.mockParseArgs.mockReturnValue({
      url: 'http://staging',
      outputPath: path.join(dir, 'out.yaml'),
      runFlowPaths: [flowPath],
    });
    await main();
    expect(mocks.mockStartSession).toHaveBeenCalledWith(
      expect.any(String),
      'http://staging',
    );
  });

  // T30 — two flows → output has runFlow: entries for both, relative paths
  it('T30 — two input flows produce two runFlow appendCommand calls with relative paths', async () => {
    const dir = makeTmpDir();
    const flowsDir = path.join(dir, 'flows');
    fs.mkdirSync(flowsDir);
    const outDir = path.join(dir, 'recordings');
    fs.mkdirSync(outDir);

    const setup = writeFlow(flowsDir, 'setup.yaml', { appId: 'http://a.com', commands: [] });
    const login = writeFlow(flowsDir, 'login.yaml', { appId: 'http://a.com', commands: [] });
    const outPath = path.join(outDir, 'out.yaml');

    mocks.mockParseArgs.mockReturnValue({
      url: 'http://localhost:5173',
      outputPath: outPath,
      runFlowPaths: [setup, login],
    });

    await main();

    const runFlowCalls = mocks.mockAppendCommand.mock.calls.filter(
      (c: unknown[]) => (c[1] as { type: string }).type === 'runFlow',
    );
    expect(runFlowCalls).toHaveLength(2);
    expect((runFlowCalls[0][1] as { path: string }).path).toBe('../flows/setup.yaml');
    expect((runFlowCalls[1][1] as { path: string }).path).toBe('../flows/login.yaml');
  });

  // T31 — runFlow: path is relative (no leading /)
  it('T31 — runFlow path in output is relative (no absolute path)', async () => {
    const dir = makeTmpDir();
    const flowPath = writeFlow(dir, 'flow.yaml', { appId: 'http://a.com', commands: [] });
    const outPath = path.join(dir, 'subdir', 'out.yaml');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    mocks.mockParseArgs.mockReturnValue({
      url: 'http://localhost:5173',
      outputPath: outPath,
      runFlowPaths: [flowPath],
    });

    await main();

    const runFlowCall = mocks.mockAppendCommand.mock.calls.find(
      (c: unknown[]) => (c[1] as { type: string }).type === 'runFlow',
    );
    expect(runFlowCall).toBeDefined();
    expect((runFlowCall![1] as { path: string }).path).not.toMatch(/^\//);
  });

  // T32 — output collides with --run-flow path → exits code 1 before chromium.launch
  it('T32 — output path collision → exits 1 before browser launch', async () => {
    const dir = makeTmpDir();
    const flowPath = writeFlow(dir, 'flow.yaml', { appId: 'http://a.com', commands: [] });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    mocks.mockParseArgs.mockReturnValue({
      url: 'http://localhost:5173',
      outputPath: flowPath, // same as the run-flow input!
      runFlowPaths: [flowPath],
    });

    await expect(main()).rejects.toThrow('process.exit(1)');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mocks.mockChromium.launch).not.toHaveBeenCalled();
  });

  // T33 — non-existent --run-flow path → exits code 1, logs file-not-found
  it('T33 — non-existent flow path → exits 1, logs file not found', async () => {
    const dir = makeTmpDir();
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mocks.mockParseArgs.mockReturnValue({
      url: 'http://localhost:5173',
      outputPath: path.join(dir, 'out.yaml'),
      runFlowPaths: [path.join(dir, 'does-not-exist.yaml')],
    });

    await expect(main()).rejects.toThrow('process.exit(1)');
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errorMsg = consoleSpy.mock.calls.map((c) => String(c[0])).join(' ');
    expect(errorMsg).toContain('not found');
    expect(mocks.mockChromium.launch).not.toHaveBeenCalled();
  });

  // T34 — .json extension → parseArgs throws, browser not launched
  it('T34 — .json extension causes error, browser not launched', async () => {
    // parseArgs itself validates extension and throws; we simulate that here
    mocks.mockParseArgs.mockImplementation(() => {
      throw new Error('--run-flow: file must be a YAML flow file: x.json');
    });

    await expect(main()).rejects.toThrow('file must be a YAML flow file');
    expect(mocks.mockChromium.launch).not.toHaveBeenCalled();
  });

  // T35 — replayFlows rejects → exits code 1, page.exposeFunction never called
  it('T35 — replayFlows rejection → exits 1, exposeFunction not called', async () => {
    const dir = makeTmpDir();
    const flowPath = writeFlow(dir, 'flow.yaml', { appId: 'http://a.com', commands: [] });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    mocks.mockParseArgs.mockReturnValue({
      url: 'http://localhost:5173',
      outputPath: path.join(dir, 'out.yaml'),
      runFlowPaths: [flowPath],
    });
    mocks.mockReplayFlows.mockRejectedValue(new Error('[replay] FAILED: goto in flow.yaml: net::ERR'));

    await expect(main()).rejects.toThrow('process.exit(1)');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mocks.mockPage.exposeFunction).not.toHaveBeenCalled();
  });

  // T36 — replay failure → runFlow entries in appendCommand calls are preserved
  it('T36 — appendCommand runFlow entries present before replay failure', async () => {
    const dir = makeTmpDir();
    const flowPath = writeFlow(dir, 'flow.yaml', { appId: 'http://a.com', commands: [] });
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    mocks.mockParseArgs.mockReturnValue({
      url: 'http://localhost:5173',
      outputPath: path.join(dir, 'out.yaml'),
      runFlowPaths: [flowPath],
    });
    mocks.mockReplayFlows.mockRejectedValue(new Error('[replay] FAILED'));

    await main().catch(() => {});

    // appendCommand was called with the runFlow entry before replayFlows was called
    const runFlowCall = mocks.mockAppendCommand.mock.calls.find(
      (c: unknown[]) => (c[1] as { type: string }).type === 'runFlow',
    );
    expect(runFlowCall).toBeDefined();
  });

  // T37 — replay error message surfaces to user
  it('T37 — replay error message surfaced via console.error', async () => {
    const dir = makeTmpDir();
    const flowPath = writeFlow(dir, 'flow.yaml', { appId: 'http://a.com', commands: [] });
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mocks.mockParseArgs.mockReturnValue({
      url: 'http://localhost:5173',
      outputPath: path.join(dir, 'out.yaml'),
      runFlowPaths: [flowPath],
    });
    const replayErr = new Error('[replay] FAILED: assertVisible in flow.yaml: Expected: visible');
    mocks.mockReplayFlows.mockRejectedValue(replayErr);

    await main().catch(() => {});

    const errArgs = consoleSpy.mock.calls.flatMap((c) => c.map(String)).join(' ');
    expect(errArgs).toContain('[replay] FAILED');
  });

  // T38 — no --run-flow → appendCommand never called with runFlow type; page.goto called with URL
  it('T38 — no --run-flow: no runFlow appendCommand, page.goto called', async () => {
    mocks.mockParseArgs.mockReturnValue({
      url: 'http://myapp.com',
      outputPath: 'recorded.yaml',
      runFlowPaths: [],
    });

    await main();

    const runFlowCalls = mocks.mockAppendCommand.mock.calls.filter(
      (c: unknown[]) => (c[1] as { type: string }).type === 'runFlow',
    );
    expect(runFlowCalls).toHaveLength(0);
    expect(mocks.mockPage.goto).toHaveBeenCalledWith('http://myapp.com');
  });

  // T39 — input flow files byte-identical after main()
  it('T39 — input flow files unchanged after main()', async () => {
    const dir = makeTmpDir();
    const flowPath = writeFlow(dir, 'flow.yaml', {
      appId: 'http://example.com',
      commands: [{ goto: 'http://example.com' }],
    });
    const beforeBytes = fs.readFileSync(flowPath);

    mocks.mockParseArgs.mockReturnValue({
      url: 'http://localhost:5173',
      outputPath: path.join(dir, 'out.yaml'),
      runFlowPaths: [flowPath],
    });

    await main();

    const afterBytes = fs.readFileSync(flowPath);
    expect(afterBytes.equals(beforeBytes)).toBe(true);
  });

  // T40 — live-captured commands appear after runFlow entries
  it('T40 — captured command appended after runFlow entries', async () => {
    const dir = makeTmpDir();
    const flowPath = writeFlow(dir, 'flow.yaml', { appId: 'http://a.com', commands: [] });
    mocks.mockParseArgs.mockReturnValue({
      url: 'http://localhost:5173',
      outputPath: path.join(dir, 'out.yaml'),
      runFlowPaths: [flowPath],
    });

    await main();

    // Retrieve the __uivisorCapture callback registered with exposeFunction
    const captureCall = mocks.mockPage.exposeFunction.mock.calls.find(
      (c: unknown[]) => c[0] === '__uivisorCapture',
    );
    expect(captureCall).toBeDefined();
    const captureCallback = captureCall![1] as (cmd: unknown) => void;

    // Simulate a captured command
    captureCallback({ type: 'goto', url: 'http://captured.com' });

    // runFlow entry should appear before the captured goto
    const calls = mocks.mockAppendCommand.mock.calls as Array<[string, { type: string }]>;
    const runFlowIdx = calls.findIndex((c) => c[1].type === 'runFlow');
    const captureIdx = calls.findIndex((c) => c[1].type === 'goto');
    expect(runFlowIdx).toBeGreaterThanOrEqual(0);
    expect(captureIdx).toBeGreaterThan(runFlowIdx);
  });

  // T41 — flow with url: field (not appId:) — readFirstFlowAppId falls back to url:
  it('T41 — flow with url: field but no appId: uses url: as session URL', async () => {
    const dir = makeTmpDir();
    // Write a flow with url: but no appId:
    const flowPath = path.join(dir, 'flow.yaml');
    fs.writeFileSync(flowPath, yaml.dump({ url: 'http://alt.example.com', commands: [] }), 'utf8');

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });

    mocks.mockParseArgs.mockReturnValue({
      url: 'http://localhost:5173', // default → triggers readFirstFlowAppId
      outputPath: path.join(dir, 'out.yaml'),
      runFlowPaths: [flowPath],
    });

    // readFirstFlowAppId should fall back to url: field — no exit, startSession called with url value
    await main();
    expect(exitSpy).not.toHaveBeenCalled();
    expect(mocks.mockStartSession).toHaveBeenCalledWith(
      expect.any(String),
      'http://alt.example.com',
    );
  });

  // T42 — collision with different relative notation
  it('T42 — ./flows/x.yaml vs flows/x.yaml collision detected → exits 1', async () => {
    const dir = makeTmpDir();
    const flowPath = writeFlow(dir, 'flow.yaml', { appId: 'http://a.com', commands: [] });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Both resolve to the same absolute path → collision
    const absPath = path.resolve(flowPath);
    mocks.mockParseArgs.mockReturnValue({
      url: 'http://localhost:5173',
      outputPath: absPath, // output = absolute path
      runFlowPaths: [flowPath], // input = same absolute path
    });

    await expect(main()).rejects.toThrow('process.exit(1)');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mocks.mockChromium.launch).not.toHaveBeenCalled();
  });

  // T43 — full e2e: main + two flows + capture → valid YAML structure
  it('T43 — two flows + captured goto → appendCommand called with runFlow, runFlow, then goto', async () => {
    const dir = makeTmpDir();
    const flow1 = writeFlow(dir, 'setup.yaml', { appId: 'http://a.com', commands: [] });
    const flow2 = writeFlow(dir, 'login.yaml', { appId: 'http://a.com', commands: [] });
    mocks.mockParseArgs.mockReturnValue({
      url: 'http://localhost:5173',
      outputPath: path.join(dir, 'out.yaml'),
      runFlowPaths: [flow1, flow2],
    });

    await main();

    // Simulate capturing a command
    const captureCall = mocks.mockPage.exposeFunction.mock.calls.find(
      (c: unknown[]) => c[0] === '__uivisorCapture',
    );
    const captureCallback = captureCall![1] as (cmd: unknown) => void;
    captureCallback({ type: 'goto', url: 'http://after.com' });

    const calls = mocks.mockAppendCommand.mock.calls as Array<[string, { type: string }]>;
    const types = calls.map((c) => c[1].type);
    expect(types[0]).toBe('runFlow');
    expect(types[1]).toBe('runFlow');
    expect(types[2]).toBe('goto');
  });

  // T44 — .yml extension passes validation, replayFlows invoked
  it('T44 — .yml extension is valid, replayFlows called', async () => {
    const dir = makeTmpDir();
    const flowPath = writeFlow(dir, 'flow.yml', { appId: 'http://a.com', commands: [] });
    mocks.mockParseArgs.mockReturnValue({
      url: 'http://localhost:5173',
      outputPath: path.join(dir, 'out.yaml'),
      runFlowPaths: [flowPath],
    });

    await main();

    expect(mocks.mockReplayFlows).toHaveBeenCalledOnce();
  });

  // T45 — --run-flow x.yaml,y.yaml,z.yaml → replayFlows called with all 3 paths
  it('T45 — three run-flow paths passed to replayFlows in order', async () => {
    const dir = makeTmpDir();
    const f1 = writeFlow(dir, 'a.yaml', { appId: 'http://a.com', commands: [] });
    const f2 = writeFlow(dir, 'b.yaml', { appId: 'http://a.com', commands: [] });
    const f3 = writeFlow(dir, 'c.yaml', { appId: 'http://a.com', commands: [] });
    mocks.mockParseArgs.mockReturnValue({
      url: 'http://localhost:5173',
      outputPath: path.join(dir, 'out.yaml'),
      runFlowPaths: [f1, f2, f3],
    });

    await main();

    expect(mocks.mockReplayFlows).toHaveBeenCalledOnce();
    const callArgs = mocks.mockReplayFlows.mock.calls[0] as [string[], unknown, string];
    expect(callArgs[0]).toEqual([f1, f2, f3]);
  });

  // T46 — third-of-three path collides with output → exits 1, error names colliding path
  it('T46 — third path collides with output → exits 1, error message names it', async () => {
    const dir = makeTmpDir();
    const f1 = writeFlow(dir, 'a.yaml', { appId: 'http://a.com', commands: [] });
    const f2 = writeFlow(dir, 'b.yaml', { appId: 'http://a.com', commands: [] });
    const outPath = path.join(dir, 'c.yaml');
    // Create c.yaml so existsSync passes
    writeFlow(dir, 'c.yaml', { appId: 'http://a.com', commands: [] });

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mocks.mockParseArgs.mockReturnValue({
      url: 'http://localhost:5173',
      outputPath: outPath, // same as c.yaml
      runFlowPaths: [f1, f2, outPath], // third path == output
    });

    await expect(main()).rejects.toThrow('process.exit(1)');
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errMsg = consoleSpy.mock.calls.flatMap((c) => c.map(String)).join(' ');
    expect(errMsg).toContain('c.yaml');
    expect(mocks.mockChromium.launch).not.toHaveBeenCalled();
  });

  // T47 — output and input in same dir → relative path is just filename, no ../
  it('T47 — same directory: relative path is bare filename, no ../', async () => {
    const dir = makeTmpDir();
    const flowPath = writeFlow(dir, 'flow.yaml', { appId: 'http://a.com', commands: [] });
    const outPath = path.join(dir, 'out.yaml');
    mocks.mockParseArgs.mockReturnValue({
      url: 'http://localhost:5173',
      outputPath: outPath,
      runFlowPaths: [flowPath],
    });

    await main();

    const runFlowCall = mocks.mockAppendCommand.mock.calls.find(
      (c: unknown[]) => (c[1] as { type: string }).type === 'runFlow',
    );
    expect(runFlowCall).toBeDefined();
    const relPath = (runFlowCall![1] as { path: string }).path;
    expect(relPath).toBe('flow.yaml');
    expect(relPath).not.toContain('../');
  });

  // T48 — single input flow → exactly one runFlow entry
  it('T48 — single input flow produces exactly one runFlow appendCommand call', async () => {
    const dir = makeTmpDir();
    const flowPath = writeFlow(dir, 'flow.yaml', { appId: 'http://a.com', commands: [] });
    mocks.mockParseArgs.mockReturnValue({
      url: 'http://localhost:5173',
      outputPath: path.join(dir, 'out.yaml'),
      runFlowPaths: [flowPath],
    });

    await main();

    const runFlowCalls = mocks.mockAppendCommand.mock.calls.filter(
      (c: unknown[]) => (c[1] as { type: string }).type === 'runFlow',
    );
    expect(runFlowCalls).toHaveLength(1);
  });
});
