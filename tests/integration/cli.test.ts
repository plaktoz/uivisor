// @integration
/**
 * tests/integration/cli.test.ts
 *
 * Integration tests for CLI-level behavior:
 *   - Error handling and flow halt on failure (ACs 48–51)
 *   - Exit codes: exit 1 on any failure, exit 0 on all pass (ACs 52–53)
 *   - HTML and Markdown report file generation (ACs 57, 60, 63)
 *   - --reporter compatibility with --headed and --slow-mo (AC 62)
 *
 * Strategy:
 *   - The CLI entry point (src/cli/index.ts) is invoked via `tsx` so tests
 *     run against source without a pre-build step.
 *   - A local HTTP server serves tests/fixtures/test-page.html.
 *   - Temporary .yaml flow files and a temporary working directory are used
 *     so report files do not leak into the project root.
 *
 * Run with:   npx vitest run tests/integration/cli.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const CLI_ENTRY = path.join(PROJECT_ROOT, 'src/cli/index.ts');
const FIXTURE_HTML = path.resolve(__dirname, '../fixtures/test-page.html');

let baseUrl: string;
let server: http.Server;

/** Run the webt CLI via tsx and collect stdout / stderr / exitCode */
function runWebt(
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn('npx', ['tsx', CLI_ENTRY, ...args], {
      cwd,
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });
  });
}

/** Write a temporary flow YAML file into cwd, return its basename */
function writeFlow(cwd: string, name: string, content: string): string {
  const p = path.join(cwd, name);
  fs.writeFileSync(p, content, 'utf8');
  return p;
}

/** Create a temporary working directory and return its path */
function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'webt-cli-test-'));
}

// ─── Global setup ─────────────────────────────────────────────────────────────

beforeAll(async () => {
  const fixtureContent = fs.readFileSync(FIXTURE_HTML, 'utf8');
  server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fixtureContent);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}`;
}, 20_000);

afterAll(() => {
  server?.close();
});

// ─── Exit codes (ACs 52–53) ───────────────────────────────────────────────────

describe('exit codes', () => {
  // AC53: all commands pass → exit 0
  it('AC53: exits with code 0 when all commands pass', async () => {
    const cwd = makeTmpDir();
    writeFlow(cwd, 'pass.yaml',
      `url: ${baseUrl}\ncommands:\n  - goto: ${baseUrl}\n  - assertVisible: "Welcome, user"\n`,
    );

    const { exitCode } = await runWebt(['test', 'pass.yaml'], cwd);
    expect(exitCode).toBe(0);
  }, 30_000);

  // AC52: any command fails → exit 1
  it('AC52: exits with code 1 when any command fails', async () => {
    const cwd = makeTmpDir();
    writeFlow(cwd, 'fail.yaml',
      `url: ${baseUrl}\ncommands:\n  - goto: ${baseUrl}\n  - assertVisible: "TextThatDefinitelyDoesNotExistXYZ"\n`,
    );

    const { exitCode } = await runWebt(['test', 'fail.yaml'], cwd);
    expect(exitCode).toBe(1);
  }, 30_000);
});

// ─── Error handling / flow halt (ACs 48–51) ───────────────────────────────────

describe('error handling', () => {
  // AC48: network error on goto → command ✗, flow halts
  it('AC48: network error on goto halts the flow and exits 1', async () => {
    const cwd = makeTmpDir();
    writeFlow(cwd, 'net-err.yaml',
      `url: ${baseUrl}\ncommands:\n  - goto: "http://127.0.0.1:1"\n  - assertVisible: "Should not reach here"\n`,
    );

    const { exitCode, stdout } = await runWebt(['test', 'net-err.yaml'], cwd);

    expect(exitCode).toBe(1);
    expect(stdout).toMatch(/Navigation failed/i);
    // The assertVisible after the failed goto should not appear as passed
    expect(stdout).not.toMatch(/✓.*assertVisible/);
  }, 30_000);

  // AC49: tapOn timeout → ✗ + screenshot
  it('AC49: tapOn that times out saves a screenshot and marks ✗', async () => {
    const cwd = makeTmpDir();
    writeFlow(cwd, 'tap-timeout.yaml',
      `url: ${baseUrl}\ncommands:\n  - goto: ${baseUrl}\n  - tapOn: "ButtonThatNeverExists__XYZ"\n`,
    );

    const { exitCode, stdout } = await runWebt(['test', 'tap-timeout.yaml'], cwd);

    expect(exitCode).toBe(1);
    expect(stdout).toMatch(/Element not found/i);
    // AC38: screenshot file referenced in output
    expect(stdout).toMatch(/screenshots\/.*-fail-\d+\.png/);

    // AC39: screenshot file should exist on disk
    const screenshotsDir = path.join(cwd, 'screenshots');
    if (fs.existsSync(screenshotsDir)) {
      const files = fs.readdirSync(screenshotsDir);
      expect(files.some((f) => f.endsWith('.png'))).toBe(true);
    }
  }, 30_000);

  // AC50: assertVisible timeout → ✗, subsequent commands do NOT execute
  it('AC50: assertVisible timeout halts the flow; later commands do not run', async () => {
    const cwd = makeTmpDir();
    writeFlow(cwd, 'assert-halt.yaml',
      [
        `url: ${baseUrl}`,
        'commands:',
        `  - goto: ${baseUrl}`,
        '  - assertVisible: "TextThatNeverExists__XYZ"',
        '  - assertVisible: "This line should be unreachable"',
      ].join('\n'),
    );

    const { exitCode, stdout } = await runWebt(['test', 'assert-halt.yaml'], cwd);

    expect(exitCode).toBe(1);
    // Second assertVisible should NOT have been attempted
    expect(stdout).not.toMatch(/✓.*This line should be unreachable/);
  }, 30_000);

  // AC51: nested flow failure propagates to parent → parent also fails
  it('AC51: a failed nested flow marks the runFlow command ✗ and halts the parent', async () => {
    const cwd = makeTmpDir();
    const subFlowPath = writeFlow(cwd, 'sub-fail.yaml',
      `url: ${baseUrl}\ncommands:\n  - assertVisible: "NeverExists__XYZ"\n`,
    );
    writeFlow(cwd, 'parent.yaml',
      `url: ${baseUrl}\ncommands:\n  - goto: ${baseUrl}\n  - runFlow: "./${path.basename(subFlowPath)}"\n  - assertVisible: "ShouldNotReachHere"\n`,
    );

    const { exitCode, stdout } = await runWebt(['test', 'parent.yaml'], cwd);

    expect(exitCode).toBe(1);
    // Parent's post-runFlow assertVisible should not have passed
    expect(stdout).not.toMatch(/✓.*ShouldNotReachHere/);
  }, 30_000);
});

// ─── Reporter file generation (ACs 57, 60, 63) ───────────────────────────────

describe('reporter files', () => {
  // AC57: --reporter html generates webt-report.html
  it('AC57: --reporter html creates webt-report.html in the working directory', async () => {
    const cwd = makeTmpDir();
    writeFlow(cwd, 'flow.yaml',
      `url: ${baseUrl}\ncommands:\n  - goto: ${baseUrl}\n  - assertVisible: "Welcome, user"\n`,
    );

    await runWebt(['test', 'flow.yaml', '--reporter', 'html'], cwd);

    const reportPath = path.join(cwd, 'webt-report.html');
    expect(fs.existsSync(reportPath)).toBe(true);
  }, 30_000);

  // AC58: generated HTML is non-empty and starts with expected tags
  it('AC58: webt-report.html is a non-empty self-contained HTML file', async () => {
    const cwd = makeTmpDir();
    writeFlow(cwd, 'flow.yaml',
      `url: ${baseUrl}\ncommands:\n  - goto: ${baseUrl}\n`,
    );

    await runWebt(['test', 'flow.yaml', '--reporter', 'html'], cwd);

    const reportPath = path.join(cwd, 'webt-report.html');
    const content = fs.readFileSync(reportPath, 'utf8');
    expect(content.length).toBeGreaterThan(100);
    expect(content).toMatch(/<html|<!DOCTYPE html>/i);
    // Must not reference external CDN URLs (self-contained requirement)
    expect(content).not.toMatch(/<link[^>]+href=["']https?:/i);
    expect(content).not.toMatch(/<script[^>]+src=["']https?:/i);
  }, 30_000);

  // AC60: --reporter md generates webt-report.md
  it('AC60: --reporter md creates webt-report.md in the working directory', async () => {
    const cwd = makeTmpDir();
    writeFlow(cwd, 'flow.yaml',
      `url: ${baseUrl}\ncommands:\n  - goto: ${baseUrl}\n  - assertVisible: "Welcome, user"\n`,
    );

    await runWebt(['test', 'flow.yaml', '--reporter', 'md'], cwd);

    const reportPath = path.join(cwd, 'webt-report.md');
    expect(fs.existsSync(reportPath)).toBe(true);
  }, 30_000);

  // AC61: generated MD contains summary and flow sections
  it('AC61: webt-report.md contains a summary header and per-flow section', async () => {
    const cwd = makeTmpDir();
    writeFlow(cwd, 'flow.yaml',
      `url: ${baseUrl}\ncommands:\n  - goto: ${baseUrl}\n  - assertVisible: "Welcome, user"\n`,
    );

    await runWebt(['test', 'flow.yaml', '--reporter', 'md'], cwd);

    const content = fs.readFileSync(path.join(cwd, 'webt-report.md'), 'utf8');
    // Must have at least one heading
    expect(content).toMatch(/^#+\s/m);
    // Should reference the flow file
    expect(content).toContain('flow.yaml');
  }, 30_000);

  // AC63: no --reporter flag → no report files written
  it('AC63: no report file is created when --reporter is not supplied', async () => {
    const cwd = makeTmpDir();
    writeFlow(cwd, 'flow.yaml',
      `url: ${baseUrl}\ncommands:\n  - goto: ${baseUrl}\n`,
    );

    await runWebt(['test', 'flow.yaml'], cwd);

    expect(fs.existsSync(path.join(cwd, 'webt-report.html'))).toBe(false);
    expect(fs.existsSync(path.join(cwd, 'webt-report.md'))).toBe(false);
  }, 30_000);

  // AC62: --reporter html + --headed are compatible (does not crash)
  it('AC62: --reporter html and --headed can be combined without error', async () => {
    const cwd = makeTmpDir();
    writeFlow(cwd, 'flow.yaml',
      `url: ${baseUrl}\ncommands:\n  - goto: ${baseUrl}\n`,
    );

    const { exitCode } = await runWebt(
      ['test', 'flow.yaml', '--headed', '--reporter', 'html'],
      cwd,
    );
    expect(exitCode).toBe(0);
    expect(fs.existsSync(path.join(cwd, 'webt-report.html'))).toBe(true);
  }, 30_000);

  // AC62: --reporter md + --slow-mo are compatible
  it('AC62: --reporter md and --slow-mo can be combined without error', async () => {
    const cwd = makeTmpDir();
    writeFlow(cwd, 'flow.yaml',
      `url: ${baseUrl}\ncommands:\n  - goto: ${baseUrl}\n`,
    );

    const { exitCode } = await runWebt(
      ['test', 'flow.yaml', '--slow-mo', '50', '--reporter', 'md'],
      cwd,
    );
    expect(exitCode).toBe(0);
    expect(fs.existsSync(path.join(cwd, 'webt-report.md'))).toBe(true);
  }, 30_000);
});

// ─── Console output format (ACs 35–37, 40) ────────────────────────────────────

describe('console output format', () => {
  // AC35: first line of flow output = "▶ Running: <filename>"
  it('AC35: stdout starts with "▶ Running: <filename>"', async () => {
    const cwd = makeTmpDir();
    writeFlow(cwd, 'my-flow.yaml',
      `url: ${baseUrl}\ncommands:\n  - goto: ${baseUrl}\n`,
    );

    const { stdout } = await runWebt(['test', 'my-flow.yaml'], cwd);
    expect(stdout).toContain('▶ Running: my-flow.yaml');
  }, 30_000);

  // AC36: passing command = line with ✓
  it('AC36: passing commands are shown with ✓', async () => {
    const cwd = makeTmpDir();
    writeFlow(cwd, 'flow.yaml',
      `url: ${baseUrl}\ncommands:\n  - goto: ${baseUrl}\n`,
    );

    const { stdout } = await runWebt(['test', 'flow.yaml'], cwd);
    expect(stdout).toContain('✓');
  }, 30_000);

  // AC37: failing command = line with ✗
  it('AC37: failing commands are shown with ✗', async () => {
    const cwd = makeTmpDir();
    writeFlow(cwd, 'flow.yaml',
      `url: ${baseUrl}\ncommands:\n  - goto: ${baseUrl}\n  - assertVisible: "NeverExistsXYZ"\n`,
    );

    const { stdout } = await runWebt(['test', 'flow.yaml'], cwd);
    expect(stdout).toContain('✗');
  }, 30_000);

  // AC40: summary line shows PASSED/FAILED with N/M counts
  it('AC40: summary line shows PASSED for an all-pass run', async () => {
    const cwd = makeTmpDir();
    writeFlow(cwd, 'flow.yaml',
      `url: ${baseUrl}\ncommands:\n  - goto: ${baseUrl}\n`,
    );

    const { stdout } = await runWebt(['test', 'flow.yaml'], cwd);
    expect(stdout).toMatch(/PASSED/);
  }, 30_000);

  it('AC40: summary line shows FAILED count for a failing run', async () => {
    const cwd = makeTmpDir();
    writeFlow(cwd, 'flow.yaml',
      `url: ${baseUrl}\ncommands:\n  - goto: ${baseUrl}\n  - assertVisible: "NeverExistsXYZ"\n`,
    );

    const { stdout } = await runWebt(['test', 'flow.yaml'], cwd);
    expect(stdout).toMatch(/FAILED/);
  }, 30_000);

  // AC41: no screenshot directory created on all-pass
  it('AC41: screenshots/ directory is NOT created when all commands pass', async () => {
    const cwd = makeTmpDir();
    writeFlow(cwd, 'pass.yaml',
      `url: ${baseUrl}\ncommands:\n  - goto: ${baseUrl}\n  - assertVisible: "Welcome, user"\n`,
    );

    await runWebt(['test', 'pass.yaml'], cwd);

    expect(fs.existsSync(path.join(cwd, 'screenshots'))).toBe(false);
  }, 30_000);

  // AC45: directory mode reports each file and aggregate summary
  it('AC45: directory mode prints results for each flow and an aggregate summary', async () => {
    const cwd = makeTmpDir();
    writeFlow(cwd, 'flow-a.yaml',
      `url: ${baseUrl}\ncommands:\n  - goto: ${baseUrl}\n`,
    );
    writeFlow(cwd, 'flow-b.yaml',
      `url: ${baseUrl}\ncommands:\n  - goto: ${baseUrl}\n  - assertVisible: "Welcome, user"\n`,
    );

    const { stdout } = await runWebt(['test', '.'], cwd);

    // Both files should appear in output
    expect(stdout).toContain('flow-a.yaml');
    expect(stdout).toContain('flow-b.yaml');
    // Aggregate summary (e.g. "2 flows passed")
    expect(stdout).toMatch(/2 flow|flows passed|flows failed/i);
  }, 30_000);

  // AC46: empty directory → exit non-zero + informative message
  it('AC46: empty directory (no .yaml files) exits non-zero with an informative message', async () => {
    const cwd = makeTmpDir();
    // No yaml files written

    const { exitCode, stdout, stderr } = await runWebt(['test', '.'], cwd);

    expect(exitCode).not.toBe(0);
    const combined = stdout + stderr;
    expect(combined).toMatch(/No flow files found/i);
  }, 30_000);

  // AC47: missing file target → exit non-zero
  it('AC47: missing target file exits non-zero with "File not found" message', async () => {
    const cwd = makeTmpDir();

    const { exitCode, stdout, stderr } = await runWebt(['test', 'ghost.yaml'], cwd);

    expect(exitCode).not.toBe(0);
    const combined = stdout + stderr;
    expect(combined).toMatch(/File not found.*ghost\.yaml/i);
  }, 30_000);
});
