// FILE: uivisor-app/tests/unit/reporter/html-screenshot.test.ts
/**
 * Unit tests for screenshot image rendering in generateHtmlReport.
 *
 * Bug: the <img> tag (and the entire screenshotPath row) is rendered inside
 * the `if (!r.passed)` block in html.ts.  A `screenshot` command always
 * produces `passed: true`, so the image is never shown for passing screenshot
 * commands.
 *
 * Tests:
 *  - TC-SCR-01 (failing): passing screenshot result → HTML contains <img
 *  - TC-SCR-02 (regression): failing result with screenshotPath → HTML still contains <img
 *  - TC-SCR-03 (regression): result with no screenshotPath → HTML has no <img
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Command, CommandResult, FlowResult, RunResult } from '@uivisor/core';

// ─── Mock fs so html.ts can "read" screenshot files without real disk access ──

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

import * as fs from 'fs';
import { generateHtmlReport } from '../../../src/reporter/html';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SCREENSHOT_PATH = 'screenshots/my-flow-001.png';
const FAKE_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes

function screenshotCmd(): Command {
  return { type: 'screenshot', path: SCREENSHOT_PATH };
}

function assertVisibleCmd(selector: string): Command {
  return { type: 'assertVisible', selector };
}

function passedScreenshotResult(): CommandResult {
  return {
    command: screenshotCmd(),
    passed: true,
    screenshotPath: SCREENSHOT_PATH,
    durationMs: 30,
  };
}

function failedResultWithScreenshot(): CommandResult {
  return {
    command: assertVisibleCmd('Order confirmed'),
    passed: false,
    message: 'Element not found',
    expected: 'visible',
    got: 'element not found',
    screenshotPath: SCREENSHOT_PATH,
    durationMs: 5000,
  };
}

function passedResultNoScreenshot(): CommandResult {
  return {
    command: { type: 'goto', url: 'http://localhost' },
    passed: true,
    durationMs: 12,
  };
}

function makeFlowResult(commandResults: CommandResult[]): FlowResult {
  const passedCommands = commandResults.filter((r) => r.passed).length;
  return {
    filePath: '/flows/test-flow.yaml',
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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('generateHtmlReport — screenshot image rendering', () => {
  beforeEach(() => {
    // Make readFileSync return a valid PNG buffer so html.ts renders an <img> tag
    vi.mocked(fs.readFileSync).mockReturnValue(FAKE_PNG);
  });

  // TC-SCR-01 — this test FAILS with the current code because screenshotPath
  // rendering is gated inside `if (!r.passed)`, which is never entered when
  // the screenshot command passes.
  it('TC-SCR-01: renders <img> tag for a passing screenshot command', () => {
    const runResult = makeRunResult([
      makeFlowResult([passedScreenshotResult()]),
    ]);

    const html = generateHtmlReport(runResult);

    expect(html).toContain('<img');
  });

  // TC-SCR-02 — regression: failing command with screenshotPath must still
  // render the <img> tag after the fix is applied.
  it('TC-SCR-02: renders <img> tag for a failing command that has a screenshotPath', () => {
    const runResult = makeRunResult([
      makeFlowResult([failedResultWithScreenshot()]),
    ]);

    const html = generateHtmlReport(runResult);

    expect(html).toContain('<img');
    expect(html).toContain(SCREENSHOT_PATH);
  });

  // TC-SCR-03 — regression: commands without screenshotPath must not produce
  // spurious <img> tags.
  it('TC-SCR-03: does not render <img> tag when screenshotPath is absent', () => {
    const runResult = makeRunResult([
      makeFlowResult([passedResultNoScreenshot()]),
    ]);

    const html = generateHtmlReport(runResult);

    expect(html).not.toContain('<img');
  });
});
