import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import { describe, it, expect, afterEach } from 'vitest';
import { startSession, appendCommand } from './yamlWriter.js';

let testDir = '';

afterEach(() => {
  if (testDir) {
    fs.rmSync(testDir, { recursive: true, force: true });
    testDir = '';
  }
});

function makeTmpDir(): string {
  testDir = path.join(os.tmpdir(), `yaml-writer-${crypto.randomUUID()}`);
  return testDir;
}

// ---------------------------------------------------------------------------
// startSession tests
// ---------------------------------------------------------------------------
describe('startSession', () => {
  // T01 — Creates file at the given path
  it('creates file at the given path', () => {
    const dir = makeTmpDir();
    const outPath = path.join(dir, 'out.yaml');
    startSession(outPath, 'myApp');
    expect(fs.existsSync(outPath)).toBe(true);
  });

  // T02 — File content starts with appId header
  it('file content starts with appId: myApp', () => {
    const dir = makeTmpDir();
    const outPath = path.join(dir, 'out.yaml');
    startSession(outPath, 'myApp');
    const content = fs.readFileSync(outPath, 'utf8');
    expect(content.startsWith('appId: myApp')).toBe(true);
  });

  // T03 — File content contains commands: line
  it('file content contains commands: line', () => {
    const dir = makeTmpDir();
    const outPath = path.join(dir, 'out.yaml');
    startSession(outPath, 'myApp');
    const content = fs.readFileSync(outPath, 'utf8');
    expect(content.includes('\ncommands:')).toBe(true);
  });

  // T04 — Header ends with a newline
  it('header ends with a newline', () => {
    const dir = makeTmpDir();
    const outPath = path.join(dir, 'out.yaml');
    startSession(outPath, 'myApp');
    const content = fs.readFileSync(outPath, 'utf8');
    expect(content.endsWith('\n')).toBe(true);
  });

  // T05 — Creates all parent directories (4-level deep path)
  it('creates all parent directories (4-level deep path)', () => {
    const dir = makeTmpDir();
    const outPath = path.join(dir, 'w', 'x', 'y', 'z', 'out.yaml');
    startSession(outPath, 'myApp');
    expect(fs.existsSync(outPath)).toBe(true);
  });

  // T06 — Truncates file on second call — zero occurrences of first appId
  it('truncates file on second call — zero occurrences of first appId', () => {
    const dir = makeTmpDir();
    const outPath = path.join(dir, 'out.yaml');
    startSession(outPath, 'alpha');
    startSession(outPath, 'beta');
    const content = fs.readFileSync(outPath, 'utf8');
    const alphaCount = (content.match(/alpha/g) ?? []).length;
    const betaCount = (content.match(/beta/g) ?? []).length;
    expect(alphaCount).toBe(0);
    expect(betaCount).toBe(1);
  });

  // T07 — appId with dots and hyphens preserved verbatim
  it('appId with dots and hyphens preserved verbatim', () => {
    const dir = makeTmpDir();
    const outPath = path.join(dir, 'out.yaml');
    startSession(outPath, 'com.example.my-app');
    const content = fs.readFileSync(outPath, 'utf8');
    const parsed = yaml.load(content) as Record<string, unknown>;
    expect(parsed['appId']).toBe('com.example.my-app');
  });
});

// ---------------------------------------------------------------------------
// appendCommand tests
// ---------------------------------------------------------------------------
describe('appendCommand', () => {
  // T08 — wait serialises to - wait: 2000
  it('wait serialises to - wait: 2000', () => {
    const dir = makeTmpDir();
    const outPath = path.join(dir, 'out.yaml');
    startSession(outPath, 'testApp');
    appendCommand(outPath, { type: 'wait', ms: 2000 });
    const content = fs.readFileSync(outPath, 'utf8');
    expect(content).toContain('- wait: 2000');
  });

  // T09 — screenshot serialises to - screenshot: screenshots/step-1.png
  it('screenshot serialises to - screenshot: screenshots/step-1.png', () => {
    const dir = makeTmpDir();
    const outPath = path.join(dir, 'out.yaml');
    startSession(outPath, 'testApp');
    appendCommand(outPath, { type: 'screenshot', path: 'screenshots/step-1.png' });
    const content = fs.readFileSync(outPath, 'utf8');
    expect(content).toContain('- screenshot: screenshots/step-1.png');
  });

  // T10 — tapOn with testId selector produces nested YAML item
  it('tapOn with testId selector produces nested YAML item', () => {
    const dir = makeTmpDir();
    const outPath = path.join(dir, 'out.yaml');
    startSession(outPath, 'testApp');
    appendCommand(outPath, { type: 'tapOn', selector: { testId: 'login-submit' } });
    const content = fs.readFileSync(outPath, 'utf8');
    expect(content).toContain('- tapOn:');
    expect(content).toContain('    testId: login-submit');
  });

  // T11 — goto serialises with the URL as value
  it('goto serialises with the URL as value', () => {
    const dir = makeTmpDir();
    const outPath = path.join(dir, 'out.yaml');
    startSession(outPath, 'testApp');
    appendCommand(outPath, { type: 'goto', url: 'https://example.com' });
    const content = fs.readFileSync(outPath, 'utf8');
    expect(content).toContain('- goto:');
    expect(content).toContain('https://example.com');
  });

  // T12 — inputText serialises to - inputText: hello world
  it('inputText serialises to - inputText: hello world', () => {
    const dir = makeTmpDir();
    const outPath = path.join(dir, 'out.yaml');
    startSession(outPath, 'testApp');
    appendCommand(outPath, { type: 'inputText', text: 'hello world' });
    const content = fs.readFileSync(outPath, 'utf8');
    expect(content).toContain('- inputText: hello world');
  });

  // T13 — tapOn with string selector serialises as scalar
  it('tapOn with string selector serialises as scalar', () => {
    const dir = makeTmpDir();
    const outPath = path.join(dir, 'out.yaml');
    startSession(outPath, 'testApp');
    appendCommand(outPath, { type: 'tapOn', selector: 'Login Button' });
    const content = fs.readFileSync(outPath, 'utf8');
    expect(content).toContain('- tapOn:');
    expect(content).toContain('Login Button');
  });

  // T14 — assertVisible with testId produces nested YAML item
  it('assertVisible with testId produces nested YAML item', () => {
    const dir = makeTmpDir();
    const outPath = path.join(dir, 'out.yaml');
    startSession(outPath, 'testApp');
    appendCommand(outPath, { type: 'assertVisible', selector: { testId: 'submit-btn' } });
    const content = fs.readFileSync(outPath, 'utf8');
    expect(content).toContain('- assertVisible:');
    expect(content).toContain('    testId: submit-btn');
  });

  // T15 — reload (null-payload) serialises to a valid YAML list item
  it('reload (null-payload) serialises to a valid YAML list item', () => {
    const dir = makeTmpDir();
    const outPath = path.join(dir, 'out.yaml');
    startSession(outPath, 'testApp');
    appendCommand(outPath, { type: 'reload' });
    const content = fs.readFileSync(outPath, 'utf8');
    const parsed = yaml.load(content) as { commands: Record<string, unknown>[] };
    expect(parsed.commands).toBeDefined();
    expect('reload' in parsed.commands[0]!).toBe(true);
  });

  // T16 — goBack (null-payload) serialises to a valid YAML list item
  it('goBack (null-payload) serialises to a valid YAML list item', () => {
    const dir = makeTmpDir();
    const outPath = path.join(dir, 'out.yaml');
    startSession(outPath, 'testApp');
    appendCommand(outPath, { type: 'goBack' });
    const content = fs.readFileSync(outPath, 'utf8');
    const parsed = yaml.load(content) as { commands: Record<string, unknown>[] };
    expect(parsed.commands).toBeDefined();
    expect('goBack' in parsed.commands[0]!).toBe(true);
  });

  // T17 — pressKey serialises to - pressKey: Enter
  it('pressKey serialises to - pressKey: Enter', () => {
    const dir = makeTmpDir();
    const outPath = path.join(dir, 'out.yaml');
    startSession(outPath, 'testApp');
    appendCommand(outPath, { type: 'pressKey', key: 'Enter' });
    const content = fs.readFileSync(outPath, 'utf8');
    expect(content).toContain('- pressKey: Enter');
  });

  // T18 — Multiple sequential calls append in written order
  it('multiple sequential calls append in written order', () => {
    const dir = makeTmpDir();
    const outPath = path.join(dir, 'out.yaml');
    startSession(outPath, 'testApp');
    appendCommand(outPath, { type: 'wait', ms: 1000 });
    appendCommand(outPath, { type: 'screenshot', path: 'out.png' });
    appendCommand(outPath, { type: 'tapOn', selector: { testId: 'x' } });
    const content = fs.readFileSync(outPath, 'utf8');
    const waitPos = content.indexOf('wait: 1000');
    const screenshotPos = content.indexOf('screenshot: out.png');
    const tapOnPos = content.indexOf('tapOn:');
    expect(waitPos).toBeGreaterThan(-1);
    expect(screenshotPos).toBeGreaterThan(-1);
    expect(tapOnPos).toBeGreaterThan(-1);
    expect(waitPos).toBeLessThan(screenshotPos);
    expect(screenshotPos).toBeLessThan(tapOnPos);
  });

  // T19 — Crash-safe: each call independent of prior calls
  it('crash-safe: each call independent of prior calls', () => {
    const dir = makeTmpDir();
    const outPath = path.join(dir, 'out.yaml');
    startSession(outPath, 'testApp');
    appendCommand(outPath, { type: 'wait', ms: 100 });
    // Manually truncate (simulate crash/restart)
    fs.writeFileSync(outPath, `appId: testApp\ncommands:\n`, 'utf8');
    appendCommand(outPath, { type: 'screenshot', path: 'after-restart.png' });
    const content = fs.readFileSync(outPath, 'utf8');
    expect(content).toContain('screenshot: after-restart.png');
    expect(content).not.toContain('wait: 100');
  });
});

// ---------------------------------------------------------------------------
// round-trip tests
// ---------------------------------------------------------------------------
describe('round-trip', () => {
  // T20 — js-yaml.load returns object with string appId and array commands
  it('js-yaml.load returns object with string appId and array commands', () => {
    const dir = makeTmpDir();
    const outPath = path.join(dir, 'out.yaml');
    startSession(outPath, 'myApp');
    appendCommand(outPath, { type: 'wait', ms: 500 });
    appendCommand(outPath, { type: 'screenshot', path: 'shot.png' });
    const content = fs.readFileSync(outPath, 'utf8');
    const parsed = yaml.load(content) as { appId: unknown; commands: unknown };
    expect(typeof parsed.appId).toBe('string');
    expect(Array.isArray(parsed.commands)).toBe(true);
  });

  // T21 — commands array length equals appendCommand call count
  it('commands array length equals appendCommand call count', () => {
    const dir = makeTmpDir();
    const outPath = path.join(dir, 'out.yaml');
    startSession(outPath, 'myApp');
    appendCommand(outPath, { type: 'wait', ms: 1000 });
    appendCommand(outPath, { type: 'screenshot', path: 'a.png' });
    appendCommand(outPath, { type: 'pressKey', key: 'Tab' });
    const content = fs.readFileSync(outPath, 'utf8');
    const parsed = yaml.load(content) as { commands: unknown[] };
    expect(parsed.commands.length).toBe(3);
  });

  // T22 — wait and tapOn commands round-trip to correct YAML shape
  it('wait and tapOn commands round-trip to correct YAML shape', () => {
    const dir = makeTmpDir();
    const outPath = path.join(dir, 'out.yaml');
    startSession(outPath, 'myApp');
    appendCommand(outPath, { type: 'wait', ms: 2000 });
    appendCommand(outPath, { type: 'tapOn', selector: { testId: 'login-submit' } });
    const content = fs.readFileSync(outPath, 'utf8');
    const parsed = yaml.load(content) as { commands: Record<string, unknown>[] };
    expect((parsed.commands[0] as { wait: number }).wait).toBe(2000);
    expect((parsed.commands[1] as { tapOn: { testId: string } }).tapOn.testId).toBe('login-submit');
  });

  // T23 — 5 mixed commands (goto + tapOn + inputText + wait + screenshot) all present
  it('5 mixed commands all present in output', () => {
    const dir = makeTmpDir();
    const outPath = path.join(dir, 'out.yaml');
    startSession(outPath, 'myApp');
    appendCommand(outPath, { type: 'goto', url: 'https://example.com' });
    appendCommand(outPath, { type: 'tapOn', selector: { testId: 'btn' } });
    appendCommand(outPath, { type: 'inputText', text: 'hello' });
    appendCommand(outPath, { type: 'wait', ms: 500 });
    appendCommand(outPath, { type: 'screenshot', path: 'final.png' });
    const content = fs.readFileSync(outPath, 'utf8');
    const parsed = yaml.load(content) as { commands: Record<string, unknown>[] };
    expect(parsed.commands).toHaveLength(5);
    expect('goto' in parsed.commands[0]!).toBe(true);
    expect('tapOn' in parsed.commands[1]!).toBe(true);
    expect('inputText' in parsed.commands[2]!).toBe(true);
    expect('wait' in parsed.commands[3]!).toBe(true);
    expect('screenshot' in parsed.commands[4]!).toBe(true);
  });

  // T24 — assertVisible with text selector round-trips
  it('assertVisible with text selector round-trips', () => {
    const dir = makeTmpDir();
    const outPath = path.join(dir, 'out.yaml');
    startSession(outPath, 'myApp');
    appendCommand(outPath, { type: 'assertVisible', selector: { text: 'Submit' } });
    const content = fs.readFileSync(outPath, 'utf8');
    const parsed = yaml.load(content) as { commands: Record<string, unknown>[] };
    expect((parsed.commands[0] as { assertVisible: { text: string } }).assertVisible.text).toBe('Submit');
  });

  // T25 — Output YAML does not throw on js-yaml.load (syntactic validity smoke test)
  it('output YAML does not throw on js-yaml.load', () => {
    const dir = makeTmpDir();
    const outPath = path.join(dir, 'out.yaml');
    startSession(outPath, 'myApp');
    appendCommand(outPath, { type: 'goto', url: 'https://example.com' });
    const content = fs.readFileSync(outPath, 'utf8');
    expect(() => yaml.load(content)).not.toThrow();
  });
});
