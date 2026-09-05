/**
 * tests/unit/within-reporters.test.ts
 *
 * Unit tests for `within` label in all three reporters.
 * Covers: TC-049, TC-050, TC-051, TC-052, TC-053, TC-054, TC-055
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConsoleReporter } from '../../src/reporter/console';
import { generateHtmlReport } from '../../src/reporter/html';
import { generateMarkdownReport } from '../../src/reporter/markdown';
import type { Command, CommandResult, FlowResult, RunResult } from '@uivisor/core';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function withinCmd(selector: string): Command {
  return {
    type: 'within',
    selector,
    do: [],
  };
}

function makeInnerResult(cmdType: string): CommandResult {
  return {
    command: { type: 'tapOn', selector: 'Delete' } as Command,
    passed: true,
    durationMs: 5,
  };
}

function makeWithinResult(
  selector: string,
  innerResults: CommandResult[],
  passed = true,
): CommandResult {
  return {
    command: withinCmd(selector),
    passed,
    nestedResult: {
      filePath: '',
      passed,
      commandResults: innerResults,
      totalCommands: innerResults.length,
      passedCommands: innerResults.filter((r) => r.passed).length,
      durationMs: 10,
    },
    durationMs: 15,
  };
}

function makeFlowResult(results: CommandResult[]): FlowResult {
  const passed = results.every((r) => r.passed);
  return {
    filePath: '/test/flow.yaml',
    passed,
    commandResults: results,
    totalCommands: results.length,
    passedCommands: results.filter((r) => r.passed).length,
    durationMs: 50,
  };
}

function makeRunResult(flows: FlowResult[]): RunResult {
  return {
    flows,
    totalFlows: flows.length,
    passedFlows: flows.filter((f) => f.passed).length,
    failedFlows: flows.filter((f) => !f.passed).length,
    durationMs: 100,
  };
}

// ─── Console reporter (TC-049, TC-050, TC-051) ────────────────────────────────

describe('ConsoleReporter — within label (TC-049, TC-050, TC-051)', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let reporter: ConsoleReporter;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
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

  // TC-050: label string is "within: text=Alice"
  it('TC-050: _cmdSummary/reportCommand outputs "within: text=Alice"', () => {
    const result = makeWithinResult('text=Alice', []);
    reporter.reportCommand(result, 0);
    expect(capturedOutput()).toContain('within: text=Alice');
  });

  // TC-049: nested tapOn result also appears in output
  it('TC-049: nested tapOn result label appears in output', () => {
    const innerResult = makeInnerResult('tapOn');
    const result = makeWithinResult('text=Alice', [innerResult]);
    reporter.reportCommand(result, 0);
    const out = capturedOutput();
    expect(out).toContain('within: text=Alice');
    expect(out).toContain('tapOn');
  });

  // TC-051: nested results appear AFTER the within line
  it('TC-051: nested do results appear after the within line', () => {
    const inner1: CommandResult = {
      command: { type: 'tapOn', selector: 'Delete' } as Command,
      passed: true,
      durationMs: 5,
    };
    const inner2: CommandResult = {
      command: { type: 'goto', url: 'http://inner/' } as Command,
      passed: true,
      durationMs: 5,
    };
    const result = makeWithinResult('text=Alice', [inner1, inner2]);
    reporter.reportCommand(result, 0);
    const out = capturedOutput();

    const withinIdx = out.indexOf('within: text=Alice');
    const tapOnIdx = out.indexOf('tapOn');
    const gotoIdx = out.indexOf('goto');

    expect(withinIdx).toBeGreaterThanOrEqual(0);
    expect(tapOnIdx).toBeGreaterThan(withinIdx);
    expect(gotoIdx).toBeGreaterThan(withinIdx);
  });
});

// ─── HTML reporter (TC-052, TC-053) ──────────────────────────────────────────

describe('HTML reporter — within label (TC-052, TC-053)', () => {
  // TC-053: cmdLabel returns "within: text=Alice"
  it('TC-053: HTML output contains "within: text=Alice"', () => {
    const innerResult: CommandResult = {
      command: { type: 'tapOn', selector: 'Delete' } as Command,
      passed: true,
      durationMs: 5,
    };
    const withinResult = makeWithinResult('text=Alice', [innerResult]);
    const flowResult = makeFlowResult([withinResult]);
    const runResult = makeRunResult([flowResult]);

    const html = generateHtmlReport(runResult);
    expect(html).toContain('within: text=Alice');
  });

  // TC-052: nested tapOn also appears in HTML
  it('TC-052: nested tapOn label appears in HTML after within', () => {
    const innerResult: CommandResult = {
      command: { type: 'tapOn', selector: 'Delete' } as Command,
      passed: true,
      durationMs: 5,
    };
    const withinResult = makeWithinResult('text=Alice', [innerResult]);
    const flowResult = makeFlowResult([withinResult]);
    const runResult = makeRunResult([flowResult]);

    const html = generateHtmlReport(runResult);
    const withinIdx = html.indexOf('within: text=Alice');
    const tapOnIdx = html.indexOf('tapOn');
    expect(withinIdx).toBeGreaterThanOrEqual(0);
    expect(tapOnIdx).toBeGreaterThan(withinIdx);
  });
});

// ─── Markdown reporter (TC-054, TC-055) ──────────────────────────────────────

describe('Markdown reporter — within label (TC-054, TC-055)', () => {
  // TC-055: cmdLabel returns "within: text=Alice"
  it('TC-055: Markdown output contains "within: text=Alice"', () => {
    const innerResult: CommandResult = {
      command: { type: 'tapOn', selector: 'Delete' } as Command,
      passed: true,
      durationMs: 5,
    };
    const withinResult = makeWithinResult('text=Alice', [innerResult]);
    const flowResult = makeFlowResult([withinResult]);
    const runResult = makeRunResult([flowResult]);

    const md = generateMarkdownReport(runResult);
    expect(md).toContain('within: text=Alice');
  });

  // TC-054: nested result also appears in Markdown
  it('TC-054: nested tapOn label appears in Markdown output', () => {
    const innerResult: CommandResult = {
      command: { type: 'tapOn', selector: 'Delete' } as Command,
      passed: true,
      durationMs: 5,
    };
    const withinResult = makeWithinResult('text=Alice', [innerResult]);
    const flowResult = makeFlowResult([withinResult]);
    const runResult = makeRunResult([flowResult]);

    const md = generateMarkdownReport(runResult);
    expect(md).toContain('within: text=Alice');
    expect(md).toContain('tapOn');
  });
});
