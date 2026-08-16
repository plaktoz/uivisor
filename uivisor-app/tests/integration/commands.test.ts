// @integration
/**
 * tests/integration/commands.test.ts
 *
 * Integration tests for all 9 webt commands against a real Playwright browser.
 * Covers ACs 7–27 (goto, tapOn, inputText, assertVisible, assertNotVisible, wait,
 * scroll, runFlow) plus nested-flow behavior (ACs 54–56).
 *
 * Setup:
 *   - A local HTTP server serves tests/fixtures/test-page.html on a random port.
 *   - A headless Chromium browser is launched once for the suite.
 *   - Each test navigates to the fixture page unless stated otherwise.
 *   - Temporary YAML files for runFlow tests are written to os.tmpdir().
 *
 * Run with:   npx vitest run tests/integration/commands.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { dispatch } from '../../src/engine/dispatcher';
import { runFlow } from '../../src/engine/index';
import type { RunContext, FlowFile } from '../../src/types';

// ─── Global setup ─────────────────────────────────────────────────────────────

let server: http.Server;
let baseUrl: string;
let browser: Browser;
let page: Page;

const fixturePath = path.resolve(__dirname, '../fixtures/test-page.html');

beforeAll(async () => {
  // Serve the fixture HTML over HTTP so Playwright's security model is satisfied
  const fixtureContent = fs.readFileSync(fixturePath, 'utf8');
  server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fixtureContent);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}`;

  browser = await chromium.launch({ headless: true });
}, 30_000);

afterAll(async () => {
  await browser?.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(async () => {
  page = await browser.newPage();
  await page.goto(baseUrl);
});

afterEach(async () => {
  await page.close();
});

/** Convenience: create a fresh RunContext for each test */
function freshCtx(): RunContext {
  return {
    lastTappedLocator: null,
    callStack: new Set(),
    indentLevel: 0,
  };
}

/** Write a temporary YAML flow file and return its path */
function writeTmpFlow(content: string): string {
  const file = path.join(os.tmpdir(), `webt-test-${Date.now()}-${Math.random().toString(36).slice(2)}.yaml`);
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

// ─── goto (ACs 7–8) ───────────────────────────────────────────────────────────

describe('goto', () => {
  // AC7: navigates and marks ✓ after page load
  it('AC7: navigates to a reachable URL and returns passed: true', async () => {
    const ctx = freshCtx();
    const result = await dispatch(page, { type: 'goto', url: baseUrl }, ctx);
    expect(result.passed).toBe(true);
    expect(result.command.type).toBe('goto');
  });

  it('AC7: sets durationMs > 0 after navigation', async () => {
    const ctx = freshCtx();
    const result = await dispatch(page, { type: 'goto', url: baseUrl }, ctx);
    expect(result.durationMs).toBeGreaterThan(0);
  });

  // AC8: unreachable URL → ✗ "Navigation failed"
  it('AC8: marks command failed with "Navigation failed" for unreachable URL', async () => {
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      { type: 'goto', url: 'http://127.0.0.1:1' },
      ctx,
    );
    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/Navigation failed/i);
  }, 15_000);
});

// ─── tapOn (ACs 9–11) ────────────────────────────────────────────────────────

describe('tapOn', () => {
  // AC9: text match → click + ✓
  it('AC9: clicking an element by text returns passed: true', async () => {
    const ctx = freshCtx();
    const result = await dispatch(page, { type: 'tapOn', selector: 'Sign In' }, ctx);
    expect(result.passed).toBe(true);
  });

  // AC10: element not found → ✗ "Element not found."
  it('AC10: returns passed: false with "Element not found" when text does not exist', async () => {
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      { type: 'tapOn', selector: 'ButtonThatDoesNotExistXYZ' },
      ctx,
    );
    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/Element not found/i);
  }, 10_000);

  // AC11: role+name ARIA match → click + ✓
  it('AC11: clicking by role+name ARIA returns passed: true', async () => {
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      { type: 'tapOn', selector: { role: 'button', name: 'Submit' } },
      ctx,
    );
    expect(result.passed).toBe(true);
  });

  // AC9: tapOn updates RunContext.lastTappedLocator
  it('tapOn sets lastTappedLocator on RunContext after a successful click', async () => {
    const ctx = freshCtx();
    expect(ctx.lastTappedLocator).toBeNull();
    await dispatch(page, { type: 'tapOn', selector: 'Sign In' }, ctx);
    expect(ctx.lastTappedLocator).not.toBeNull();
  });
});

// ─── inputText shorthand (ACs 12–13) ─────────────────────────────────────────

describe('inputText shorthand', () => {
  // AC12: after tapOn, types into last-tapped element
  it('AC12: types text into the email input after tapping it', async () => {
    const ctx = freshCtx();
    // First tap the email input (by its label)
    await dispatch(page, { type: 'tapOn', selector: { label: 'Email' } }, ctx);
    const result = await dispatch(page, { type: 'inputText', text: 'user@example.com' }, ctx);
    expect(result.passed).toBe(true);

    // Confirm the value is in the input
    const value = await page.locator('#email-input').inputValue();
    expect(value).toBe('user@example.com');
  });

  // AC13: inputText shorthand before any tapOn → error
  it('AC13: throws or fails when inputText shorthand is used before any tapOn', async () => {
    const ctx = freshCtx();
    const result = await dispatch(page, { type: 'inputText', text: 'hello' }, ctx);
    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/inputText shorthand used before any tapOn/i);
  });
});

// ─── inputText targeted (ACs 14–15) ──────────────────────────────────────────

describe('inputText targeted', () => {
  // AC14: matching element → focus, clear, type
  it('AC14: focuses, clears, and types into the matched element', async () => {
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      {
        type: 'inputTextTargeted',
        element: { label: 'Email' },
        text: 'typed@example.com',
      },
      ctx,
    );
    expect(result.passed).toBe(true);

    const value = await page.locator('#email-input').inputValue();
    expect(value).toBe('typed@example.com');
  });

  it('AC14: clears any pre-existing value before typing', async () => {
    const ctx = freshCtx();
    // Pre-fill the input
    await page.locator('#email-input').fill('old@value.com');

    await dispatch(
      page,
      { type: 'inputTextTargeted', element: { label: 'Email' }, text: 'new@value.com' },
      ctx,
    );

    const value = await page.locator('#email-input').inputValue();
    expect(value).toBe('new@value.com');
  });

  // AC15: no element match → ✗
  it('AC15: returns passed: false when targeted element does not exist', async () => {
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      { type: 'inputTextTargeted', element: 'NonExistentLabel', text: 'text' },
      ctx,
    );
    expect(result.passed).toBe(false);
  }, 10_000);
});

// ─── assertVisible (ACs 16–17) ───────────────────────────────────────────────

describe('assertVisible', () => {
  // AC16: visible element → ✓
  it('AC16: returns passed: true for a visible element', async () => {
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      { type: 'assertVisible', selector: 'Welcome, user' },
      ctx,
    );
    expect(result.passed).toBe(true);
  });

  // AC17: element not visible → ✗ with expected/got
  it('AC17: returns passed: false with expected/got for a missing element', async () => {
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      { type: 'assertVisible', selector: 'This text does not exist on the page' },
      ctx,
    );
    expect(result.passed).toBe(false);
    expect(result.expected).toMatch(/visible/i);
    expect(result.got).toMatch(/element not found|not visible/i);
  }, 10_000);
});

// ─── assertNotVisible (ACs 18–19) ────────────────────────────────────────────

describe('assertNotVisible', () => {
  // AC18: element not visible → ✓
  it('AC18: returns passed: true when element is not visible', async () => {
    // The fixture has #error-message hidden by default
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      { type: 'assertNotVisible', selector: 'Error message' },
      ctx,
    );
    expect(result.passed).toBe(true);
  });

  // AC19: element is visible → ✗ with expected/got
  it('AC19: returns passed: false with expected/got when element IS visible', async () => {
    // Make the error message visible first
    await page.locator('#show-error-btn').click();
    await page.locator('#error-message').waitFor({ state: 'visible' });

    const ctx = freshCtx();
    const result = await dispatch(
      page,
      { type: 'assertNotVisible', selector: 'Error message' },
      ctx,
    );
    expect(result.passed).toBe(false);
    expect(result.expected).toMatch(/not visible/i);
    expect(result.got).toMatch(/visible/i);
  });
});

// ─── wait (ACs 20–21) ────────────────────────────────────────────────────────

describe('wait', () => {
  // AC20: pauses ~500ms (±100ms)
  it('AC20: pauses for approximately the specified milliseconds', async () => {
    const ctx = freshCtx();
    const start = Date.now();
    const result = await dispatch(page, { type: 'wait', ms: 500 }, ctx);
    const elapsed = Date.now() - start;
    expect(result.passed).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(400);
    expect(elapsed).toBeLessThan(700);
  });
});

// ─── scroll (ACs 22–23) ───────────────────────────────────────────────────────

describe('scroll', () => {
  // AC22: scroll down scrolls downward (scrollY increases)
  it('AC22: scroll down increases page scrollY', async () => {
    const ctx = freshCtx();
    const before = await page.evaluate(() => window.scrollY);
    const result = await dispatch(page, { type: 'scroll', direction: 'down' }, ctx);
    const after = await page.evaluate(() => window.scrollY);
    expect(result.passed).toBe(true);
    expect(after).toBeGreaterThan(before);
  });

  // AC23: scroll up reduces scrollY (after scrolling down first)
  it('AC23: scroll up decreases page scrollY after scrolling down', async () => {
    const ctx = freshCtx();
    // Scroll down first
    await page.evaluate(() => window.scrollBy(0, 500));
    const before = await page.evaluate(() => window.scrollY);
    const result = await dispatch(page, { type: 'scroll', direction: 'up' }, ctx);
    const after = await page.evaluate(() => window.scrollY);
    expect(result.passed).toBe(true);
    expect(after).toBeLessThan(before);
  });

  // AC23: scroll left and right
  it('AC23: scroll right returns passed: true', async () => {
    const ctx = freshCtx();
    const result = await dispatch(page, { type: 'scroll', direction: 'right' }, ctx);
    expect(result.passed).toBe(true);
  });

  it('AC23: scroll left returns passed: true', async () => {
    const ctx = freshCtx();
    const result = await dispatch(page, { type: 'scroll', direction: 'left' }, ctx);
    expect(result.passed).toBe(true);
  });
});

// ─── runFlow (ACs 25–27) ──────────────────────────────────────────────────────

describe('runFlow', () => {
  // AC25: existing nested flow runs and its FlowResult is embedded
  it('AC25: running a nested flow returns passed: true and embeds a nestedResult', async () => {
    const subFlowPath = writeTmpFlow(
      `url: ${baseUrl}\ncommands:\n  - assertVisible: "Welcome, user"\n`,
    );

    try {
      const ctx = freshCtx();
      ctx.callStack.add('/parent-flow.yaml');

      const result = await dispatch(page, { type: 'runFlow', path: subFlowPath }, ctx);
      expect(result.passed).toBe(true);
      expect(result.nestedResult).toBeDefined();
      expect(result.nestedResult?.passed).toBe(true);
    } finally {
      fs.unlinkSync(subFlowPath);
    }
  });

  // AC26: missing file → ✗ "Flow file not found: <path>"
  it('AC26: returns failed result with "Flow file not found" for a missing file', async () => {
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      { type: 'runFlow', path: '/absolutely/nonexistent/flow.yaml' },
      ctx,
    );
    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/Flow file not found/i);
    expect(result.message).toContain('/absolutely/nonexistent/flow.yaml');
  });

  // AC27: circular reference → error
  it('AC27: detects a circular flow reference and returns a failed result', async () => {
    const fileA = writeTmpFlow(''); // placeholder, will be overwritten with reference to B
    const fileB = writeTmpFlow(`url: ${baseUrl}\ncommands:\n  - runFlow: "${fileA}"\n`);
    // Now write A to reference B
    fs.writeFileSync(
      fileA,
      `url: ${baseUrl}\ncommands:\n  - runFlow: "${fileB}"\n`,
      'utf8',
    );

    try {
      const ctx = freshCtx();
      const result = await dispatch(page, { type: 'runFlow', path: fileA }, ctx);
      expect(result.passed).toBe(false);
      expect(result.message).toMatch(/circular.*flow|circular.*reference/i);
    } finally {
      fs.unlinkSync(fileA);
      fs.unlinkSync(fileB);
    }
  });

  // AC55: runFlow result = nested outcome
  it('AC55: failed nested flow sets passed: false on the runFlow CommandResult', async () => {
    const subFlowPath = writeTmpFlow(
      `url: ${baseUrl}\ncommands:\n  - assertVisible: "TextThatDoesNotExistXYZ"\n`,
    );

    try {
      const ctx = freshCtx();
      ctx.callStack.add('/parent.yaml');

      const result = await dispatch(page, { type: 'runFlow', path: subFlowPath }, ctx);
      expect(result.passed).toBe(false);
      expect(result.nestedResult?.passed).toBe(false);
    } finally {
      fs.unlinkSync(subFlowPath);
    }
  }, 15_000);
});

// ─── runFlow + engine integration (ACs 54, 56) ────────────────────────────────

describe('runFlow nesting via engine', () => {
  // AC54: nested commands are indented at indentLevel + 1
  it('AC54: nested flow runs at indentLevel 1 when parent is at level 0', async () => {
    const subFlowPath = writeTmpFlow(
      `url: ${baseUrl}\ncommands:\n  - assertVisible: "Welcome, user"\n`,
    );

    const parentFlow: FlowFile = {
      baseUrl,
      filePath: '/parent.yaml',
      commands: [{ type: 'goto', url: baseUrl }, { type: 'runFlow', path: subFlowPath }],
    };

    try {
      const ctx = freshCtx();
      const result = await runFlow(parentFlow, page, ctx);
      expect(result.passed).toBe(true);

      // The runFlow command result has a nested result with its own commandResults
      const runFlowResult = result.commandResults.find(
        (r) => r.command.type === 'runFlow',
      );
      expect(runFlowResult?.nestedResult?.commandResults).toHaveLength(1);
    } finally {
      fs.unlinkSync(subFlowPath);
    }
  });

  // AC56: two levels of nesting
  it('AC56: two levels of nesting run without error', async () => {
    const level2Path = writeTmpFlow(
      `url: ${baseUrl}\ncommands:\n  - assertVisible: "Welcome, user"\n`,
    );
    const level1Path = writeTmpFlow(
      `url: ${baseUrl}\ncommands:\n  - runFlow: "${level2Path}"\n`,
    );

    const parentFlow: FlowFile = {
      baseUrl,
      filePath: '/root.yaml',
      commands: [{ type: 'goto', url: baseUrl }, { type: 'runFlow', path: level1Path }],
    };

    try {
      const ctx = freshCtx();
      const result = await runFlow(parentFlow, page, ctx);
      expect(result.passed).toBe(true);
    } finally {
      fs.unlinkSync(level1Path);
      fs.unlinkSync(level2Path);
    }
  });
});

// ─── Selector types in real browser (ACs 28–33 in integration context) ────────

describe('selectors in real browser via tapOn', () => {
  it('string shorthand resolves to an element and can be clicked', async () => {
    const ctx = freshCtx();
    const result = await dispatch(page, { type: 'tapOn', selector: 'Sign In' }, ctx);
    expect(result.passed).toBe(true);
  });

  it('{ text } explicit selector resolves to an element', async () => {
    const ctx = freshCtx();
    const result = await dispatch(page, { type: 'tapOn', selector: { text: 'Sign In' } }, ctx);
    expect(result.passed).toBe(true);
  });

  it('{ role, name } ARIA selector resolves to the submit button', async () => {
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      { type: 'tapOn', selector: { role: 'button', name: 'Submit' } },
      ctx,
    );
    expect(result.passed).toBe(true);
  });

  it('{ label } selector resolves to the email input', async () => {
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      { type: 'tapOn', selector: { label: 'Email' } },
      ctx,
    );
    expect(result.passed).toBe(true);
  });

  it('{ placeholder } selector resolves to the email input', async () => {
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      { type: 'tapOn', selector: { placeholder: 'Enter email' } },
      ctx,
    );
    expect(result.passed).toBe(true);
  });

  it('{ testId } selector resolves to the submit button', async () => {
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      { type: 'tapOn', selector: { testId: 'submit-btn' } },
      ctx,
    );
    expect(result.passed).toBe(true);
  });
});
