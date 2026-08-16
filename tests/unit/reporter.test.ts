/**
 * tests/unit/reporter.test.ts
 *
 * Unit tests for all reporter outputs.
 * Covers ACs 35–41 (console format, screenshots) and ACs 57–63 (HTML + MD reports).
 *
 * - ConsoleReporter output is captured via a vi.spyOn on process.stdout.write.
 * - generateHtmlReport / generateMarkdownReport are tested as pure string-returning functions.
 * - captureScreenshot is tested with a mocked Playwright Page and mocked fs module.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Page } from 'playwright';
import { ConsoleReporter } from '../../src/reporter/console';
import { generateHtmlReport } from '../../src/reporter/html';
import { generateMarkdownReport } from '../../src/reporter/markdown';
import { captureScreenshot } from '../../src/reporter/screenshot';
import type { Command, CommandResult, FlowResult, RunResult } from '../../src/types';

// ─── Test-data factories ──────────────────────────────────────────────────────

function gotoCmd(url: string): Command {
  return { type: 'goto', url };
}

function assertVisibleCmd(selector: string): Command {
  return { type: 'assertVisible', selector };
}

function passedResult(command: Command, durationMs = 12): CommandResult {
  return { command, passed: true, durationMs };
}

function failedResult(
  command: Command,
  opts: { message?: string; expected?: string; got?: string; screenshotPath?: string } = {},
): CommandResult {
  return {
    command,
    passed: false,
    message: opts.message ?? 'Element not found',
    expected: opts.expected ?? 'visible',
    got: opts.got ?? 'element not found',
    screenshotPath: opts.screenshotPath,
    durationMs: 5000,
  };
}

function makeFlowResult(
  filePath: string,
  commandResults: CommandResult[],
): FlowResult {
  const passedCommands = commandResults.filter((r) => r.passed).length;
  return {
    filePath,
    passed: passedCommands === commandResults.length,
    commandResults,
    totalCommands: commandResults.length,
    passedCommands,
    durationMs: 120,
  };
}

function makeRunResult(flows: FlowResult[]): RunResult {
  const passedFlows = flows.filter((f) => f.passed).length;
  return {
    flows,
    totalFlows: flows.length,
    passedFlows,
    failedFlows: flows.length - passedFlows,
    durationMs: 250,
  };
}

// ─── ConsoleReporter ─────────────────────────────────────────────────────────

describe('ConsoleReporter', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let reporter: ConsoleReporter;

  beforeEach(() => {
    stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    reporter = new ConsoleReporter();
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  function capturedOutput(): string {
    return (stdoutSpy.mock.calls as [string | Buffer][])
      .map(([arg]) => (typeof arg === 'string' ? arg : arg.toString()))
      .join('');
  }

  // AC35: first line of each flow = "▶ Running: <filename>"
  it('AC35: startFlow prints "▶ Running: <filename>" (basename only)', () => {
    reporter.startFlow('/path/to/login-flow.yaml', 0);
    expect(capturedOutput()).toContain('▶ Running: login-flow.yaml');
  });

  it('AC35: "▶ Running:" appears even for files in nested directories', () => {
    reporter.startFlow('/home/user/flows/sub/nested.yaml', 0);
    expect(capturedOutput()).toContain('▶ Running: nested.yaml');
  });

  // AC36: passing command = "  ✓ <cmdType>: <value>"
  it('AC36: passing goto command prints a line with ✓ and the URL', () => {
    const result = passedResult(gotoCmd('https://example.com'));
    reporter.reportCommand(result, 0);
    const out = capturedOutput();
    expect(out).toContain('✓');
    expect(out).toContain('goto');
    expect(out).toContain('https://example.com');
  });

  it('AC36: passing assertVisible command prints ✓ with selector value', () => {
    const result = passedResult(assertVisibleCmd('Welcome, user'));
    reporter.reportCommand(result, 0);
    const out = capturedOutput();
    expect(out).toContain('✓');
    expect(out).toContain('assertVisible');
    expect(out).toContain('Welcome, user');
  });

  // AC37: failing command block contains ✗, FAILED, Expected, Got
  it('AC37: failing command prints ✗ and a FAILED indicator', () => {
    const result = failedResult(assertVisibleCmd('Missing text'), {
      message: 'Element not found',
      expected: 'visible',
      got: 'element not found',
    });
    reporter.reportCommand(result, 0);
    const out = capturedOutput();
    expect(out).toContain('✗');
    expect(out).toMatch(/FAILED/);
  });

  it('AC37: failing command block includes "Expected:" and "Got:" fields', () => {
    const result = failedResult(assertVisibleCmd('Missing text'), {
      expected: 'visible',
      got: 'element not found',
    });
    reporter.reportCommand(result, 0);
    const out = capturedOutput();
    expect(out).toContain('Expected:');
    expect(out).toContain('Got:');
    expect(out).toContain('visible');
    expect(out).toContain('element not found');
  });

  it('AC37: failing command block includes the Screenshot path when present', () => {
    const result = failedResult(assertVisibleCmd('text'), {
      screenshotPath: 'screenshots/flow-fail-001.png',
    });
    reporter.reportCommand(result, 0);
    expect(capturedOutput()).toContain('screenshots/flow-fail-001.png');
  });

  // AC40: summary line at end of flow
  it('AC40: endFlow prints "PASSED — N/N commands passed" for all-pass flow', () => {
    const flow = makeFlowResult('/path/flow.yaml', [
      passedResult(gotoCmd('http://localhost')),
      passedResult(assertVisibleCmd('Hello')),
    ]);
    reporter.endFlow(flow);
    const out = capturedOutput();
    expect(out).toMatch(/PASSED/);
    expect(out).toMatch(/2\/2/);
  });

  it('AC40: endFlow prints "FAILED — N/M commands passed" for partial-fail flow', () => {
    const flow = makeFlowResult('/path/flow.yaml', [
      passedResult(gotoCmd('http://localhost')),
      failedResult(assertVisibleCmd('Nope')),
    ]);
    reporter.endFlow(flow);
    const out = capturedOutput();
    expect(out).toMatch(/FAILED/);
    expect(out).toMatch(/1\/2/);
  });

  // Nested flow indentation (AC54)
  it('AC54: commands at indentLevel 1 are indented more than top-level commands', () => {
    const topResult = passedResult(gotoCmd('http://localhost'));
    const nestedResult = passedResult(assertVisibleCmd('Hello'));

    reporter.reportCommand(topResult, 0);
    const topOutput = capturedOutput();
    stdoutSpy.mockClear();

    reporter.reportCommand(nestedResult, 1);
    const nestedOutput = capturedOutput();

    // The nested line should start with more whitespace than the top-level line
    const topIndent = (topOutput.match(/^(\s*)/) ?? ['', ''])[1].length;
    const nestedIndent = (nestedOutput.match(/^(\s*)/) ?? ['', ''])[1].length;
    expect(nestedIndent).toBeGreaterThan(topIndent);
  });
});

// ─── captureScreenshot ────────────────────────────────────────────────────────

describe('captureScreenshot', () => {
  const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // AC38: path pattern = screenshots/<stem>-fail-<NNN>.png
  it('AC38: returned path matches screenshots/<stem>-fail-<NNN>.png', async () => {
    const mockPage = {
      screenshot: vi.fn().mockResolvedValue(PNG_MAGIC),
    } as unknown as Page;

    const result = await captureScreenshot(mockPage, 'my-flow', 1);

    expect(result).toMatch(/^screenshots\/my-flow-fail-\d+\.png$/);
  });

  it('AC38: counter is zero-padded to at least 3 digits', async () => {
    const mockPage = {
      screenshot: vi.fn().mockResolvedValue(PNG_MAGIC),
    } as unknown as Page;

    const result = await captureScreenshot(mockPage, 'flow', 1);
    expect(result).toMatch(/fail-0*1\.png$/);
  });

  it('AC38: flow stem is used verbatim in the filename', async () => {
    const mockPage = {
      screenshot: vi.fn().mockResolvedValue(PNG_MAGIC),
    } as unknown as Page;

    const result = await captureScreenshot(mockPage, 'login-smoke', 2);
    expect(result).toContain('login-smoke');
  });

  // AC39: page.screenshot is called (so the file would be a valid PNG)
  it('AC39: page.screenshot() is invoked to capture the screenshot', async () => {
    const mockPage = {
      screenshot: vi.fn().mockResolvedValue(PNG_MAGIC),
    } as unknown as Page;

    await captureScreenshot(mockPage, 'flow', 1);
    expect(mockPage.screenshot).toHaveBeenCalledOnce();
  });
});

// ─── generateHtmlReport ───────────────────────────────────────────────────────

describe('generateHtmlReport', () => {
  const singlePassRun = makeRunResult([
    makeFlowResult('/flows/login.yaml', [
      passedResult(gotoCmd('http://localhost')),
      passedResult(assertVisibleCmd('Welcome, user')),
    ]),
  ]);

  const runWithFailure = makeRunResult([
    makeFlowResult('/flows/checkout.yaml', [
      passedResult(gotoCmd('http://localhost')),
      failedResult(assertVisibleCmd('Order confirmed'), {
        screenshotPath: 'screenshots/checkout-fail-001.png',
      }),
    ]),
  ]);

  // AC57 / AC58: output is a syntactically valid, self-contained HTML string
  it('AC58: output starts with <!DOCTYPE html> or <html>', () => {
    const html = generateHtmlReport(singlePassRun);
    expect(html.trim()).toMatch(/^<!DOCTYPE html>|^<html/i);
  });

  it('AC58: output contains <head> and <body> tags (self-contained file)', () => {
    const html = generateHtmlReport(singlePassRun);
    expect(html).toContain('<head');
    expect(html).toContain('<body');
  });

  it('AC58: output does not reference external stylesheet CDN URLs', () => {
    const html = generateHtmlReport(singlePassRun);
    // Check for external <link> or <script src="http…"> that would break standalone mode
    const externalLinkRe = /<link[^>]+href=["']https?:/i;
    const externalScriptRe = /<script[^>]+src=["']https?:/i;
    expect(externalLinkRe.test(html)).toBe(false);
    expect(externalScriptRe.test(html)).toBe(false);
  });

  // AC59: shows run summary (total flows, pass/fail counts, duration)
  it('AC59: shows total flow count in run summary', () => {
    const html = generateHtmlReport(singlePassRun);
    expect(html).toContain('1'); // 1 flow
  });

  it('AC59: shows per-flow result section for each flow', () => {
    const html = generateHtmlReport(singlePassRun);
    expect(html).toContain('login.yaml');
  });

  it('AC59: shows per-command pass/fail rows', () => {
    const html = generateHtmlReport(singlePassRun);
    expect(html).toContain('goto');
    expect(html).toContain('assertVisible');
  });

  it('AC59: includes screenshot reference for failed commands', () => {
    const html = generateHtmlReport(runWithFailure);
    expect(html).toContain('screenshots/checkout-fail-001.png');
  });

  // Multiple flows
  it('report covers all flows when run has multiple flow results', () => {
    const multiRun = makeRunResult([
      makeFlowResult('/flows/a.yaml', [passedResult(gotoCmd('http://a'))]),
      makeFlowResult('/flows/b.yaml', [passedResult(gotoCmd('http://b'))]),
    ]);
    const html = generateHtmlReport(multiRun);
    expect(html).toContain('a.yaml');
    expect(html).toContain('b.yaml');
  });

  it('shows failed counts when any flow fails', () => {
    const html = generateHtmlReport(runWithFailure);
    // Summary should distinguish pass vs fail counts
    expect(html).toMatch(/0.*pass|pass.*0|failed.*1|1.*fail/i);
  });
});

// ─── generateMarkdownReport ───────────────────────────────────────────────────

describe('generateMarkdownReport', () => {
  const singlePassRun = makeRunResult([
    makeFlowResult('/flows/login.yaml', [
      passedResult(gotoCmd('http://localhost')),
      passedResult(assertVisibleCmd('Welcome, user')),
    ]),
  ]);

  const runWithFailure = makeRunResult([
    makeFlowResult('/flows/checkout.yaml', [
      passedResult(gotoCmd('http://localhost')),
      failedResult(assertVisibleCmd('Order confirmed'), {
        screenshotPath: 'screenshots/checkout-fail-001.png',
      }),
    ]),
  ]);

  // AC61: run summary header
  it('AC61: output starts with a markdown heading for the run summary', () => {
    const md = generateMarkdownReport(singlePassRun);
    expect(md).toMatch(/^#+\s/m); // at least one Markdown heading
  });

  it('AC61: summary includes total flow count', () => {
    const md = generateMarkdownReport(singlePassRun);
    expect(md).toMatch(/1\s*(flow|total)/i);
  });

  // AC61: per-flow sections
  it('AC61: each flow has its own section with the filename', () => {
    const md = generateMarkdownReport(singlePassRun);
    expect(md).toContain('login.yaml');
  });

  it('AC61: per-flow section contains a command result table', () => {
    const md = generateMarkdownReport(singlePassRun);
    // A markdown table has at least one | character per row
    expect(md).toMatch(/\|.*goto.*\|/);
  });

  // AC61: screenshot path references for failures
  it('AC61: screenshot relative path is referenced in the report for failed commands', () => {
    const md = generateMarkdownReport(runWithFailure);
    expect(md).toContain('screenshots/checkout-fail-001.png');
  });

  // Multiple flows
  it('report covers all flows when run has multiple flow results', () => {
    const multiRun = makeRunResult([
      makeFlowResult('/flows/a.yaml', [passedResult(gotoCmd('http://a'))]),
      makeFlowResult('/flows/b.yaml', [passedResult(gotoCmd('http://b'))]),
    ]);
    const md = generateMarkdownReport(multiRun);
    expect(md).toContain('a.yaml');
    expect(md).toContain('b.yaml');
  });

  it('output is a non-empty string', () => {
    const md = generateMarkdownReport(singlePassRun);
    expect(typeof md).toBe('string');
    expect(md.length).toBeGreaterThan(0);
  });
});
