/**
 * tests/unit/reporter-md-screenshot.test.ts
 *
 * Regression tests for the screenshot-image rendering bug in markdown.ts.
 *
 * Bug: `renderCommandTable` in markdown.ts gates the entire `screenshotPath`
 * markdown-image block inside `if (!r.passed)`. A `screenshot` command always
 * passes, so the captured image is never emitted in the markdown report.
 *
 * The three groups below must behave as follows:
 *
 *   1. Passing screenshot command with screenshotPath  → FAILS before fix, PASSES after.
 *   2. Failing command with screenshotPath             → PASSES before and after (regression guard).
 *   3. No screenshotPath                               → PASSES before and after (sanity check).
 */

import { describe, it, expect } from 'vitest';
import type { CommandResult, FlowResult, RunResult } from '@uivisor/core';
import { generateMarkdownReport } from '../../src/reporter/markdown';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFlowResult(commandResults: CommandResult[]): FlowResult {
  const passedCommands = commandResults.filter((r) => r.passed).length;
  return {
    filePath: '/flows/test.yaml',
    passed: passedCommands === commandResults.length,
    commandResults,
    totalCommands: commandResults.length,
    passedCommands,
    durationMs: 100,
  };
}

function makeRunResult(flows: FlowResult[]): RunResult {
  const passedFlows = flows.filter((f) => f.passed).length;
  return {
    flows,
    totalFlows: flows.length,
    passedFlows,
    failedFlows: flows.length - passedFlows,
    durationMs: 200,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('generateMarkdownReport — screenshot image rendering', () => {

  // ── Group 1: PASSING screenshot command must render its captured image ─────
  //    These tests FAIL before the fix because the screenshotPath block is
  //    inside `if (!r.passed)` and is never entered for passing results.

  it('renders ![screenshot]( for a PASSING screenshot command that has screenshotPath', () => {
    const run = makeRunResult([
      makeFlowResult([
        {
          command: { type: 'screenshot', path: 'shots/page.png' },
          passed: true,
          screenshotPath: 'screenshots/run-001/page-captured.png',
          durationMs: 80,
        },
      ]),
    ]);

    const md = generateMarkdownReport(run);

    // FAILS before fix: the img block lives inside if (!r.passed), so it is
    // skipped entirely for a passing command.
    expect(md).toContain('![screenshot](');
  });

  it('references the screenshotPath value in the markdown for a PASSING screenshot result', () => {
    // Use a screenshotPath distinct from cmd.path so it can only appear if the
    // screenshotPath rendering block actually ran.
    const DISTINCT_PATH = 'screenshots/run-001/page-captured.png';

    const run = makeRunResult([
      makeFlowResult([
        {
          command: { type: 'screenshot', path: 'shots/other.png' },
          passed: true,
          screenshotPath: DISTINCT_PATH,
          durationMs: 80,
        },
      ]),
    ]);

    const md = generateMarkdownReport(run);

    // 'shots/other.png' appears via the command label; DISTINCT_PATH can only
    // appear if the screenshotPath block executed.
    // FAILS before fix: block is gated on !r.passed.
    expect(md).toContain(DISTINCT_PATH);
  });

  // ── Group 2: FAILING command with screenshotPath — regression guard ────────
  //    This already works before the fix. It must continue to work after.

  it('still renders ![screenshot]( for a FAILING command that has screenshotPath', () => {
    const SCREENSHOT_PATH = 'screenshots/run-001/failure.png';

    const run = makeRunResult([
      makeFlowResult([
        {
          command: { type: 'assertVisible', selector: 'h1' },
          passed: false,
          message: 'Element not found',
          expected: 'visible',
          got: 'not found',
          screenshotPath: SCREENSHOT_PATH,
          durationMs: 5000,
        },
      ]),
    ]);

    const md = generateMarkdownReport(run);

    expect(md).toContain('![screenshot](');
    expect(md).toContain(SCREENSHOT_PATH);
  });

  // ── Group 3: no screenshotPath → no ![screenshot]( — sanity check ─────────
  //    Passes before and after the fix.

  it('does NOT render ![screenshot]( when screenshotPath is absent', () => {
    const run = makeRunResult([
      makeFlowResult([
        {
          command: { type: 'goto', url: 'http://localhost' },
          passed: true,
          durationMs: 50,
        },
      ]),
    ]);

    const md = generateMarkdownReport(run);

    expect(md).not.toContain('![screenshot](');
  });
});
