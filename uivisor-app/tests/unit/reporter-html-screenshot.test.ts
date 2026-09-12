/**
 * tests/unit/reporter-html-screenshot.test.ts
 *
 * Regression tests for the screenshot-image rendering bug in html.ts.
 *
 * Bug: `renderCommandRows` in html.ts gates the entire `screenshotPath` img
 * block inside `if (!r.passed)`. A `screenshot` command always passes, so its
 * captured PNG is never shown in the HTML report.
 *
 * The three groups below must behave as follows:
 *
 *   1. Passing screenshot with screenshotPath  → FAILS before fix, PASSES after.
 *   2. Failing command with screenshotPath     → PASSES before and after (regression guard).
 *   3. No screenshotPath                       → PASSES before and after (sanity check).
 *
 * fs is mocked so that readFileSync returns a real Buffer (FAKE_PNG), which
 * causes the code path that emits <img src="data:image/png;base64,…"> to run.
 * Without the mock, readFileSync throws and the code falls back to an <a> link.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CommandResult, FlowResult, RunResult } from '@uivisor/core';

// vi.mock is hoisted by vitest before all imports, so `fs` below is auto-mocked.
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

import * as fs from 'fs';
import { generateHtmlReport } from '../../src/reporter/html';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal valid PNG header — enough for buf.toString('base64') to work. */
const FAKE_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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

describe('generateHtmlReport — screenshot image rendering', () => {
  beforeEach(() => {
    vi.mocked(fs.readFileSync).mockReturnValue(FAKE_PNG);
  });

  // ── Group 1: PASSING screenshot command must render its captured image ─────
  //    These three tests all FAIL before the fix because the screenshotPath
  //    block is inside `if (!r.passed)` and is never entered for passing results.

  it('renders an <img> for a PASSING screenshot command that has screenshotPath', () => {
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

    const html = generateHtmlReport(run);

    // FAILS before fix: the img block lives inside if (!r.passed), so it is
    // skipped entirely for a passing command.
    expect(html).toContain('<img ');
  });

  it('embeds a base64 PNG for a PASSING screenshot command that has screenshotPath', () => {
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

    const html = generateHtmlReport(run);

    // FAILS before fix for the same reason.
    expect(html).toContain('data:image/png;base64,');
  });

  it('references the screenshotPath value in HTML for a PASSING screenshot result', () => {
    // Use a screenshotPath that is distinct from cmd.path so it can only appear
    // if the screenshotPath rendering block actually ran.
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

    const html = generateHtmlReport(run);

    // 'shots/other.png' appears via the command label; DISTINCT_PATH can only
    // appear if the screenshotPath block executed.
    // FAILS before fix: block is gated on !r.passed.
    expect(html).toContain(DISTINCT_PATH);
  });

  // ── Group 2: FAILING command with screenshotPath — regression guard ────────
  //    This already works before the fix. It must continue to work after.

  it('still renders an <img> for a FAILING command that has screenshotPath', () => {
    const run = makeRunResult([
      makeFlowResult([
        {
          command: { type: 'assertVisible', selector: 'h1' },
          passed: false,
          message: 'Element not found',
          expected: 'visible',
          got: 'not found',
          screenshotPath: 'screenshots/run-001/failure.png',
          durationMs: 5000,
        },
      ]),
    ]);

    const html = generateHtmlReport(run);

    expect(html).toContain('<img ');
    expect(html).toContain('data:image/png;base64,');
    expect(html).toContain('screenshots/run-001/failure.png');
  });

  // ── Group 3: no screenshotPath → no <img> — sanity check ─────────────────
  //    Passes before and after the fix.

  it('does NOT render an <img> when screenshotPath is absent', () => {
    const run = makeRunResult([
      makeFlowResult([
        {
          command: { type: 'goto', url: 'http://localhost' },
          passed: true,
          durationMs: 50,
        },
      ]),
    ]);

    const html = generateHtmlReport(run);

    expect(html).not.toContain('<img ');
    expect(html).not.toContain('data:image/png;base64,');
  });
});
