// @integration
/**
 * tests/integration/timeouts.test.ts
 *
 * Engine-level browser suite for T11 (engine wiring): confirms `dispatch`,
 * `runFlow`/`runAll` and `createContext` wire the sibling/CLI/header/config/
 * built-in timeout precedence (S7, `engine/timeouts.ts`) into real per-step
 * deadlines, and that the child-flow inheritance notice fires correctly.
 *
 * Setup:
 *   - A local HTTP server serves tests/fixtures/timeouts/*.html, plus
 *     /hang (never responds), /reload-hang (responds to the 1st request for a
 *     given id, then never responds to the 2nd+), /slow?ms=N (responds after
 *     N ms), /quick (responds at once), and a generic 200 page for any other
 *     path.
 *   - A headless Chromium browser is launched once for the suite.
 *   - Temporary YAML (and config) files are written to os.tmpdir().
 *
 * Timing: where an AC says "fails after T ms", the assertion checks the
 * failure happens no earlier than T ms and no later than T + 1000 ms
 * (spec tolerance). Where an AC says "passes promptly", `durationMs` is
 * checked to be under the AC's stated bound.
 *
 * Run with:   npx vitest run tests/integration/timeouts.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { RunContext, FlowFile, TimeoutSettings, ProgressListener } from '@uivisor/core';
import { dispatch } from '../../src/engine/dispatcher';
import { runFlow } from '../../src/engine/index';
import { createContext } from '../../src/engine/context';
import { createVarMap } from '../../src/engine/varMap';
import { resolveRunTimeouts } from '../../src/engine/timeouts';
import { loadAndParse } from '../../src/parser/index';

// ─── Global setup ─────────────────────────────────────────────────────────────

let server: http.Server;
let baseUrl: string;
let browser: Browser;
let page: Page;

const fixturesDir = path.resolve(__dirname, '../fixtures/timeouts');
const reloadHangCounts = new Map<string, number>();

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const pathname = url.pathname;

    if (pathname === '/hang') {
      return; // never respond
    }

    if (pathname === '/reload-hang') {
      const id = url.searchParams.get('id') ?? 'default';
      const n = (reloadHangCounts.get(id) ?? 0) + 1;
      reloadHangCounts.set(id, n);
      if (n === 1) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body>reload-hang-ok</body></html>');
        return;
      }
      // 2nd+ request: never respond, like /hang. The reload's own
      // navigationTimeout aborts the pending request client-side (F1 fix
      // verified this doesn't stall the dispatcher's failure-screenshot path).
      return;
    }

    if (pathname === '/slow') {
      const ms = Number(url.searchParams.get('ms') ?? '0');
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
      }, ms);
      return;
    }

    if (pathname === '/quick') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html><body>quick</body></html>');
      return;
    }

    if (pathname.startsWith('/fixtures/')) {
      const file = path.join(fixturesDir, pathname.replace('/fixtures/', ''));
      if (fs.existsSync(file)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(file, 'utf8'));
        return;
      }
    }

    // Generic 200 page for any other path (base pages, assertUrl probes, etc.)
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<html><body>ok</body></html>');
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
});

afterEach(async () => {
  await page.close();
});

/** Convenience: create a fresh RunContext, optionally with explicit run timeouts. */
function freshCtx(timeouts?: TimeoutSettings): RunContext {
  return createContext(
    os.tmpdir(),
    new Map([['__default__', page]]),
    '__default__',
    createVarMap({}),
    { call: async (name: string) => { throw new Error(`not implemented in test: ${name}`); } },
    timeouts,
  );
}

/** Write a temporary YAML (or any) file into a fresh tmp subdirectory and return its path. */
function writeTmpFile(dir: string, name: string, content: string): string {
  const file = path.join(dir, name);
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

function makeTmpDir(): string {
  const dir = path.join(os.tmpdir(), `uiv-timeouts-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function fixtureUrl(name: string, query = ''): string {
  return `${baseUrl}/fixtures/${name}${query ? '?' + query : ''}`;
}

/**
 * A minimal onProgress listener that records every `notice` event's message, in order, so
 * tests can assert on the emitted ProgressEvent instead of reaching for stdout.
 */
function collectNotices(): { messages: string[]; onProgress: ProgressListener } {
  const messages: string[] = [];
  return {
    messages,
    onProgress: (event) => {
      if (event.kind === 'notice') messages.push(event.message);
    },
  };
}

/** Assert a duration falls within [minMs, maxMs) — the spec's T to T+1000ms tolerance by default. */
function expectElapsed(ms: number, minMs: number, maxMs = minMs + 1000): void {
  expect(ms).toBeGreaterThanOrEqual(minMs);
  expect(ms).toBeLessThan(maxMs);
}

// ─── AC1–AC5: selector forms wait for a delayed element ──────────────────────

describe('AC1-AC5: selector forms wait for a delayed element', () => {
  it('AC1: bare string matches data-testid at cascade step 1', async () => {
    await page.goto(fixtureUrl('delayed.html', 'delay=700'));
    const ctx = freshCtx();
    const result = await dispatch(page, { command: { type: 'assertVisible', selector: 'int-delayed' } }, ctx);
    expect(result.passed).toBe(true);
    expect(result.durationMs).toBeLessThan(2500);
  });

  it('AC2: bare string falls through to the text cascade step', async () => {
    await page.goto(fixtureUrl('delayed.html', 'delay=700'));
    const ctx = freshCtx();
    const result = await dispatch(page, { command: { type: 'assertVisible', selector: 'Delayed content' } }, ctx);
    expect(result.passed).toBe(true);
    expect(result.durationMs).toBeLessThan(2600);
  });

  it('AC3: pipe string waits for its winning segment', async () => {
    await page.goto(fixtureUrl('delayed.html', 'delay=700'));
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      { command: { type: 'tapOn', selector: 'id=int-nope|data-testid=int-delayed' } },
      ctx,
    );
    expect(result.passed).toBe(true);
    expect(result.durationMs).toBeLessThan(2600);
  });

  it('AC4: object selector forms wait within the budget', async () => {
    const forms: Array<{ testId: string } | { css: string } | { text: string }> = [
      { testId: 'int-delayed' },
      { css: '[data-testid="int-delayed"]' },
      { text: 'Delayed content' },
    ];
    for (const selector of forms) {
      const p = await browser.newPage();
      await p.goto(fixtureUrl('delayed.html', 'delay=700'));
      const ctx = createContext(os.tmpdir(), new Map([['__default__', p]]), '__default__');
      const result = await dispatch(p, { command: { type: 'assertVisible', selector } }, ctx);
      await p.close();
      expect(result.passed).toBe(true);
      expect(result.durationMs).toBeLessThan(2500);
    }
  });

  it('AC5: { xpath } form waits for a delayed element', async () => {
    await page.goto(fixtureUrl('delayed.html', 'delay=700'));
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      { command: { type: 'assertVisible', selector: { xpath: "//*[@data-testid='int-delayed']" } } },
      ctx,
    );
    expect(result.passed).toBe(true);
    expect(result.durationMs).toBeLessThan(2500);
  });
});

// ─── AC7/AC8: stability check — cascade and pipe ─────────────────────────────

describe('AC7-AC8: stability check keeps the heading from winning', () => {
  it('AC7: bare tapOn clicks the testid button, not the heading (cascade)', async () => {
    await page.goto(fixtureUrl('delayed.html', 'delay=600'));
    const ctx = freshCtx();
    const tap = await dispatch(page, { command: { type: 'tapOn', selector: 'Submit' } }, ctx);
    expect(tap.passed).toBe(true);
    const assertResult = await dispatch(
      page,
      { command: { type: 'assertVisible', selector: { testId: 'int-submit-result' } } },
      ctx,
    );
    expect(assertResult.passed).toBe(true);
  });

  it('AC8: pipe tapOn clicks the testid button, not the heading', async () => {
    await page.goto(fixtureUrl('delayed.html', 'delay=600'));
    const ctx = freshCtx();
    const tap = await dispatch(
      page,
      { command: { type: 'tapOn', selector: 'data-testid=Submit|text=Submit' } },
      ctx,
    );
    expect(tap.passed).toBe(true);
    const assertResult = await dispatch(
      page,
      { command: { type: 'assertVisible', selector: { testId: 'int-submit-result' } } },
      ctx,
    );
    expect(assertResult.passed).toBe(true);
  });
});

// ─── AC12: duplicate matches collapse ────────────────────────────────────────

describe('AC12: duplicate matches retry until they collapse to one', () => {
  it('AC12: tapOn on a collapsing duplicate passes promptly', async () => {
    await page.goto(fixtureUrl('duplicates.html', 'mode=collapse&collapseAt=800'));
    const ctx = freshCtx();
    const result = await dispatch(page, { command: { type: 'tapOn', selector: 'data-testid=row' } }, ctx);
    expect(result.passed).toBe(true);
    expect(result.durationMs).toBeLessThan(1800);
  });
});

// ─── AC14-AC17: not-found / duplicate error message formats ─────────────────

describe('AC14-AC17: timeout error message formats', () => {
  it('AC14: not-found error for a bare string (cascade), 5 diagnostic lines', async () => {
    await page.goto(fixtureUrl('delayed.html', 'delay=999999'));
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      { command: { type: 'assertVisible', selector: 'int-never-rendered' }, timeout: 1000 },
      ctx,
    );
    expect(result.passed).toBe(false);
    expectElapsed(result.durationMs, 1000);
    const lines = result.message!.split('\n');
    expect(lines[0]).toBe('Element not found after 1000ms: int-never-rendered');
    expect(lines[1]).toBe('  data-testid=int-never-rendered: 0 matches');
    expect(lines[2]).toBe('  text=int-never-rendered: 0 matches');
    expect(lines[3]).toBe('  name=int-never-rendered: 0 matches');
    expect(lines[4]).toBe('  id=int-never-rendered: 0 matches');
    expect(lines[5]).toBe('  placeholder=int-never-rendered: 0 matches');
  });

  it('AC15: not-found error for a pipe string, 2 diagnostic lines', async () => {
    await page.goto(fixtureUrl('delayed.html', 'delay=999999'));
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      { command: { type: 'tapOn', selector: 'id=a-nope|data-testid=b-nope' }, timeout: 1000 },
      ctx,
    );
    expect(result.passed).toBe(false);
    expectElapsed(result.durationMs, 1000);
    const lines = result.message!.split('\n');
    expect(lines[0]).toBe('Element not found after 1000ms: id=a-nope|data-testid=b-nope');
    expect(lines[1]).toBe('  id=a-nope: 0 matches');
    expect(lines[2]).toBe('  data-testid=b-nope: 0 matches');
  });

  it('AC16: not-found error for object and xpath forms (JSON label)', async () => {
    await page.goto(fixtureUrl('delayed.html', 'delay=999999'));
    const ctx1 = freshCtx();
    const r1 = await dispatch(
      page,
      { command: { type: 'assertVisible', selector: { testId: 'int-never-rendered' } }, timeout: 1000 },
      ctx1,
    );
    expect(r1.passed).toBe(false);
    expectElapsed(r1.durationMs, 1000);
    expect(r1.message!.split('\n')[0]).toBe('Element not found after 1000ms: {"testId":"int-never-rendered"}');

    const ctx2 = freshCtx();
    const r2 = await dispatch(
      page,
      { command: { type: 'assertVisible', selector: { xpath: "//*[@id='nope']" } }, timeout: 1000 },
      ctx2,
    );
    expect(r2.passed).toBe(false);
    expectElapsed(r2.durationMs, 1000);
    expect(r2.message!.split('\n')[0]).toBe(`Element not found after 1000ms: {"xpath":"//*[@id='nope']"}`);
  });

  it('AC17: duplicates at the deadline report their counts', async () => {
    await page.goto(fixtureUrl('duplicates.html', 'mode=collapse'));
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      { command: { type: 'tapOn', selector: 'data-testid=row' }, timeout: 1000 },
      ctx,
    );
    expect(result.passed).toBe(false);
    expectElapsed(result.durationMs, 1000);
    const lines = result.message!.split('\n');
    expect(lines[0]).toBe('Element not found after 1000ms: data-testid=row');
    expect(lines[1]).toBe('  data-testid=row: 2 matches');
  });
});

// ─── AC21-AC23: assertNotVisible waiting / not-visible mode ─────────────────

describe('AC21-AC23: assertNotVisible waits, and the not-visible duplicate rule', () => {
  it('AC21: passes promptly once a visible element goes away', async () => {
    await page.goto(fixtureUrl('vanish.html', 'vanishAt=800'));
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      { command: { type: 'assertNotVisible', selector: 'data-testid=int-vanish' } },
      ctx,
    );
    expect(result.passed).toBe(true);
    expect(result.durationMs).toBeLessThan(2500);
  });

  it('AC22: fails at the deadline when the element stays visible', async () => {
    await page.goto(fixtureUrl('vanish.html'));
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      { command: { type: 'assertNotVisible', selector: 'data-testid=int-stays' }, timeout: 1000 },
      ctx,
    );
    expect(result.passed).toBe(false);
    expectElapsed(result.durationMs, 1000);
    expect(result.expected).toBe('not visible');
    expect(result.got).toBe('visible');
  });

  it('AC23(a revised): two hidden duplicates pass promptly', async () => {
    await page.goto(fixtureUrl('duplicates.html', 'mode=hidden'));
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      { command: { type: 'assertNotVisible', selector: 'data-testid=dup' }, timeout: 1000 },
      ctx,
    );
    expect(result.passed).toBe(true);
    expect(result.durationMs).toBeLessThan(1000);
  });

  it('AC23(b revised): one visible + one hidden duplicate fails at the deadline', async () => {
    await page.goto(fixtureUrl('duplicates.html', 'mode=mixed'));
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      { command: { type: 'assertNotVisible', selector: 'data-testid=dup' }, timeout: 1000 },
      ctx,
    );
    expect(result.passed).toBe(false);
    expectElapsed(result.durationMs, 1000);
    expect(result.message).toBe('Expected: not visible\nGot: visible');
  });

  it('AC23(c revised): a duplicate that becomes hidden later passes once it does', async () => {
    await page.goto(fixtureUrl('duplicates.html', 'mode=hide-later&hideAt=800'));
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      { command: { type: 'assertNotVisible', selector: 'data-testid=dup' } },
      ctx,
    );
    expect(result.passed).toBe(true);
    expect(result.durationMs).toBeLessThan(1800);
  });
});

// ─── AC24-AC27: within / assertUrl / assertCount retry ──────────────────────

describe('AC24-AC27: within waits for a delayed container, bounds only the lookup', () => {
  it('AC24: within waits for a delayed container', async () => {
    await page.goto(fixtureUrl('delayed.html', 'delay=700'));
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      {
        command: {
          type: 'within',
          selector: 'data-testid=int-delayed-card',
          do: [{ command: { type: 'assertVisible', selector: { testId: 'int-card-label' } } }],
        },
      },
      ctx,
    );
    expect(result.passed).toBe(true);
    expect(result.durationMs).toBeLessThan(2500);
  });

  it('AC25: within container not-found error at the deadline', async () => {
    await page.goto(fixtureUrl('delayed.html', 'delay=999999'));
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      {
        command: {
          type: 'within',
          selector: 'data-testid=int-never-rendered',
          do: [{ command: { type: 'assertVisible', selector: 'x' } }],
        },
        timeout: 1000,
      },
      ctx,
    );
    expect(result.passed).toBe(false);
    expectElapsed(result.durationMs, 1000);
    const lines = result.message!.split('\n');
    expect(lines[0]).toBe("within: No container found after 1000ms for selector 'data-testid=int-never-rendered'");
    expect(lines[1]).toBe('  data-testid=int-never-rendered: 0 matches');
  });

  it('AC26: within with nth waits for enough containers', async () => {
    await page.goto(fixtureUrl('growing.html', 'growAt=700'));
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      {
        command: {
          type: 'within',
          selector: 'data-testid=item',
          nth: 2,
          // The do: block runs scoped to the resolved (3rd) <li> container itself, which has
          // no descendant with data-testid=item — a trivial `wait: 0` just confirms the nth
          // resolution succeeded without erroring.
          do: [{ command: { type: 'wait', ms: 0 } }],
        },
      },
      ctx,
    );
    expect(result.passed).toBe(true);
    expect(result.durationMs).toBeLessThan(2000);
  });

  it('AC27(a): sibling timeout on within bounds only the container lookup — inner step keeps the run default', async () => {
    await page.goto(fixtureUrl('delayed.html', 'cardDelay=0&innerDelay=2500'));
    const ctx = freshCtx(); // no run timeouts set -> inner assertVisible gets the built-in 5000
    const result = await dispatch(
      page,
      {
        command: {
          type: 'within',
          selector: 'data-testid=card',
          do: [{ command: { type: 'assertVisible', selector: { testId: 'inner' } } }],
        },
        timeout: 1000,
      },
      ctx,
    );
    expect(result.passed).toBe(true);
  }, 10_000);

  it('AC27(b): sibling timeout on within also bounds a delayed container, and fails after it', async () => {
    await page.goto(fixtureUrl('delayed.html', 'cardDelay=1500&innerDelay=2500'));
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      {
        command: {
          type: 'within',
          selector: 'data-testid=card',
          do: [{ command: { type: 'assertVisible', selector: { testId: 'inner' } } }],
        },
        timeout: 1000,
      },
      ctx,
    );
    expect(result.passed).toBe(false);
    expectElapsed(result.durationMs, 1000);
    expect(result.message!.split('\n')[0]).toBe("within: No container found after 1000ms for selector 'data-testid=card'");
  });
});

describe('AC29-AC30: assertUrl and assertCount retry until the deadline', () => {
  it('AC29: assertUrl fails at the deadline with the expected/got message', async () => {
    await page.goto(fixtureUrl('delayed.html'));
    const ctx = freshCtx();
    const result = await dispatch(page, { command: { type: 'assertUrl', path: '/never' }, timeout: 1000 }, ctx);
    expect(result.passed).toBe(false);
    expectElapsed(result.durationMs, 1000);
    expect(result.expected).toBe('/never');
    expect(result.got).toBe('/fixtures/delayed.html');
  });

  it('AC30(a): assertCount passes once the count grows to match', async () => {
    await page.goto(fixtureUrl('growing.html', 'growAt=700'));
    const ctx = freshCtx();
    const result = await dispatch(page, { command: { type: 'assertCount', css: '.row', expected: 3 } }, ctx);
    expect(result.passed).toBe(true);
    expect(result.durationMs).toBeLessThan(2000);
  });

  it('AC30(b): assertCount fails at the deadline reporting the last observed count', async () => {
    await page.goto(fixtureUrl('growing.html', 'growAt=700'));
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      { command: { type: 'assertCount', css: '.row', expected: 5 }, timeout: 1500 },
      ctx,
    );
    expect(result.passed).toBe(false);
    expectElapsed(result.durationMs, 1500);
    expect(result.expected).toBe('5');
    expect(result.got).toBe('3');
  });
});

// ─── AC31-AC38: which timeout each command uses ──────────────────────────────

describe('AC31: every element command uses defaultTimeout for target resolution', () => {
  it('AC31: all 15 element commands fail after the header-equivalent 1200ms with the right line 1', async () => {
    const run: TimeoutSettings = { defaultTimeout: 1200, navigationTimeout: 30000 };
    await page.goto(fixtureUrl('delayed.html', 'delay=999999'));

    const stringForm = (type: string, extra: Record<string, unknown> = {}) => ({
      type,
      selector: 'data-testid=int-never-rendered',
      ...extra,
    });
    const objectForm = (type: string, extra: Record<string, unknown> = {}) => ({
      type,
      selector: { testId: 'int-never-rendered' },
      ...extra,
    });

    const cases: Array<{ command: unknown; expectLine1: string }> = [
      { command: stringForm('tapOn'), expectLine1: 'Element not found after 1200ms: data-testid=int-never-rendered' },
      { command: stringForm('doubleClick'), expectLine1: 'Element not found after 1200ms: data-testid=int-never-rendered' },
      { command: stringForm('hover'), expectLine1: 'Element not found after 1200ms: data-testid=int-never-rendered' },
      { command: { type: 'inputTextTargeted', element: 'data-testid=int-never-rendered', text: 'x' }, expectLine1: 'Element not found after 1200ms: data-testid=int-never-rendered' },
      { command: stringForm('clearText'), expectLine1: 'Element not found after 1200ms: data-testid=int-never-rendered' },
      { command: stringForm('check'), expectLine1: 'Element not found after 1200ms: data-testid=int-never-rendered' },
      { command: stringForm('uncheck'), expectLine1: 'Element not found after 1200ms: data-testid=int-never-rendered' },
      { command: stringForm('assertVisible'), expectLine1: 'Element not found after 1200ms: data-testid=int-never-rendered' },
      { command: stringForm('assertEnabled'), expectLine1: 'Element not found after 1200ms: data-testid=int-never-rendered' },
      { command: stringForm('assertDisabled'), expectLine1: 'Element not found after 1200ms: data-testid=int-never-rendered' },
      { command: stringForm('assertChecked'), expectLine1: 'Element not found after 1200ms: data-testid=int-never-rendered' },
      { command: stringForm('assertUnchecked'), expectLine1: 'Element not found after 1200ms: data-testid=int-never-rendered' },
      { command: objectForm('assertText', { expected: 'x' }), expectLine1: 'Element not found after 1200ms: {"testId":"int-never-rendered"}' },
      { command: objectForm('assertValue', { expected: 'x' }), expectLine1: 'Element not found after 1200ms: {"testId":"int-never-rendered"}' },
      { command: objectForm('selectOption', { value: 'x' }), expectLine1: 'Element not found after 1200ms: {"testId":"int-never-rendered"}' },
    ];

    for (const { command, expectLine1 } of cases) {
      const ctx = freshCtx(run);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await dispatch(page, { command: command as any }, ctx);
      expect(result.passed).toBe(false);
      expectElapsed(result.durationMs, 1200);
      expect(result.message!.split('\n')[0]).toBe(expectLine1);
    }
  }, 60_000);
});

describe('AC32 (revised): inputText shorthand uses defaultTimeout and reports actionability', () => {
  it('AC32: fails after 1000ms with "Element not actionable" naming the tapped selector', async () => {
    await page.goto(fixtureUrl('input-disable.html'));
    const run: TimeoutSettings = { defaultTimeout: 1000, navigationTimeout: 30000 };
    const ctx = freshCtx(run);
    const tap = await dispatch(page, { command: { type: 'tapOn', selector: 'data-testid=int-input' } }, ctx);
    expect(tap.passed).toBe(true);
    const result = await dispatch(page, { command: { type: 'inputText', text: 'hello' } }, ctx);
    expect(result.passed).toBe(false);
    expectElapsed(result.durationMs, 1000);
    expect(result.message!.split('\n')[0]).toBe('Element not actionable after 1000ms: data-testid=int-input');
  });
});

describe('AC33: navigation commands use navigationTimeout', () => {
  it('AC33(a): goto a route that never responds fails after navigationTimeout', async () => {
    // /hang accepts the request and never answers — the never-responding route
    // the spec (AC33) describes. goto's own deadline decides the outcome; the
    // dispatcher's on-failure screenshot capture is now itself bounded (F1 fix,
    // src/reporter/screenshot.ts SCREENSHOT_TIMEOUT_MS), so a page genuinely
    // stuck mid-navigation no longer stalls the step.
    const run: TimeoutSettings = { defaultTimeout: 5000, navigationTimeout: 1500 };
    const ctx = freshCtx(run);
    const result = await dispatch(page, { command: { type: 'goto', url: `${baseUrl}/hang` } }, ctx);
    expect(result.passed).toBe(false);
    expectElapsed(result.durationMs, 1500, 2500);
    expect(result.message).toContain('1500ms');
  });

  it('AC33(b): reload while the reload request hangs fails after navigationTimeout', async () => {
    // First request to /reload-hang settles normally (the initial goto); the
    // reload below is the 2nd request for this id, which the server never
    // answers — a genuine, never-responding reload.
    await page.goto(`${baseUrl}/reload-hang?id=ac33b`);
    const run: TimeoutSettings = { defaultTimeout: 5000, navigationTimeout: 1500 };
    const ctx = freshCtx(run);
    const result = await dispatch(page, { command: { type: 'reload' } }, ctx);
    expect(result.passed).toBe(false);
    expectElapsed(result.durationMs, 1500, 2500);
    expect(result.message).toContain('1500ms');
  });
});

describe('AC35: waitForPageLoad uses its own timeout, else navigationTimeout', () => {
  it('AC35(a): inner timeout wins over header navigationTimeout', async () => {
    await page.goto(fixtureUrl('delayed.html'));
    const run: TimeoutSettings = { defaultTimeout: 5000, navigationTimeout: 3000 };
    const ctx = freshCtx(run);
    const result = await dispatch(
      page,
      { command: { type: 'waitForPageLoad', path: '/never-reached', timeout: 1000 } },
      ctx,
    );
    expect(result.passed).toBe(false);
    expectElapsed(result.durationMs, 1000);
    expect(result.message).toContain('1000ms');
  });

  it('AC35(b): falls back to navigationTimeout with no inner timeout', async () => {
    await page.goto(fixtureUrl('delayed.html'));
    const run: TimeoutSettings = { defaultTimeout: 5000, navigationTimeout: 1500 };
    const ctx = freshCtx(run);
    const result = await dispatch(page, { command: { type: 'waitForPageLoad', path: '/never-reached' } }, ctx);
    expect(result.passed).toBe(false);
    expectElapsed(result.durationMs, 1500);
    expect(result.message).toContain('1500ms');
  });

  it('AC35(c): sibling timeout wins over both the inner value absence and navigationTimeout', async () => {
    await page.goto(fixtureUrl('delayed.html'));
    const run: TimeoutSettings = { defaultTimeout: 5000, navigationTimeout: 3000 };
    const ctx = freshCtx(run);
    const result = await dispatch(
      page,
      { command: { type: 'waitForPageLoad', path: '/never-reached' }, timeout: 1200 },
      ctx,
    );
    expect(result.passed).toBe(false);
    expectElapsed(result.durationMs, 1200);
    expect(result.message).toContain('1200ms');
  });
});

describe('AC36/AC38 (revised): one budget covers resolution and interaction (Q16)', () => {
  it('AC36(a)/AC38: fails no earlier than the budget and no later than +900ms, with the actionable message', async () => {
    await page.goto(fixtureUrl('late-enable.html', 'appear=600&enable=2000'));
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      { command: { type: 'tapOn', selector: 'data-testid=int-late-enable' }, timeout: 800 },
      ctx,
    );
    expect(result.passed).toBe(false);
    // Budget starts at step start, independent of when the button appears (600ms < 800ms budget).
    expectElapsed(result.durationMs, 800, 800 + 900);
    expect(result.message!.split('\n')[0]).toBe('Element not actionable after 800ms: data-testid=int-late-enable');
  });

  it('AC36(b): passes when the element becomes enabled before the budget expires', async () => {
    // Wide margin (enable at 500ms vs. a 1500ms budget) to avoid flakiness under load.
    await page.goto(fixtureUrl('late-enable.html', 'appear=400&enable=500'));
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      { command: { type: 'tapOn', selector: 'data-testid=int-late-enable' }, timeout: 1500 },
      ctx,
    );
    expect(result.passed).toBe(true);
  });
});

describe('AC37: one budget covers both waits in waitForPageLoad', () => {
  it('AC37: fails no later than the navigation-plus-slow time; does not pass', async () => {
    await page.goto(fixtureUrl('spa-nav.html', 'navAt=400&target=/target&slowMs=700'));
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      { command: { type: 'waitForPageLoad', path: '/target' }, timeout: 900 },
      ctx,
    );
    expect(result.passed).toBe(false);
    expect(result.durationMs).toBeLessThan(1900);
  });
});

// ─── AC39-AC48: sibling timeout parsing, placement, var resolution ──────────

describe('AC39-AC48: sibling timeout placement, nesting, child flows, and ${var}', () => {
  it('AC39: sibling timeout on a string-selector command', async () => {
    await page.goto(fixtureUrl('delayed.html', 'delay=999999'));
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      { command: { type: 'assertVisible', selector: 'data-testid=int-never-rendered-2' }, timeout: 1500 },
      ctx,
    );
    expect(result.passed).toBe(false);
    expectElapsed(result.durationMs, 1500);
    expect(result.message!.split('\n')[0]).toBe('Element not found after 1500ms: data-testid=int-never-rendered-2');
  });

  it('AC40: sibling timeout parses in any key order, with session routing intact', async () => {
    const dir = makeTmpDir();
    const flowPath = writeTmpFile(
      dir,
      'ac40.yaml',
      [
        `appId: ${baseUrl}/fixtures/delayed.html?delay=999999`,
        'sessions:',
        '  - id: a',
        '  - id: b',
        'commands:',
        '  - timeout: 1500',
        '    tapOn: data-testid=int-never-rendered',
        '  - session: b',
        '    tapOn:',
        '        testId: int-never-rendered',
        '    timeout: 1500',
      ].join('\n'),
    );
    try {
      const file = loadAndParse(flowPath);
      const sessions = new Map<string, Page>([
        ['a', await browser.newPage()],
        ['b', await browser.newPage()],
      ]);
      try {
        for (const p of sessions.values()) await p.goto(fixtureUrl('delayed.html', 'delay=999999'));
        const ctx = createContext(os.tmpdir(), sessions, 'a');
        const result = await runFlow(file, sessions.get('a')!, ctx);
        expect(result.passed).toBe(false);
        expect(result.commandResults).toHaveLength(1); // halts after the first failure
        const first = result.commandResults[0];
        expectElapsed(first.durationMs, 1500);
        expect(first.command.type).toBe('tapOn');
      } finally {
        for (const p of sessions.values()) await p.close();
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 15_000);

  it('AC42: sibling timeout works inside within do: blocks', async () => {
    await page.goto(fixtureUrl('delayed.html', 'cardDelay=0'));
    const ctx = freshCtx();
    const result = await dispatch(
      page,
      {
        command: {
          type: 'within',
          selector: 'data-testid=card',
          do: [{ command: { type: 'assertVisible', selector: { testId: 'inner-never' } }, timeout: 1000 }],
        },
      },
      ctx,
    );
    expect(result.passed).toBe(false);
    expectElapsed(result.durationMs, 1000);
    expect(result.message!.split('\n')[0]).toBe('Element not found after 1000ms: {"testId":"inner-never"}');
  }, 10_000);

  it('AC43: sibling timeout inside a child flow wins over the inherited header value', async () => {
    const dir = makeTmpDir();
    const topPath = writeTmpFile(
      dir,
      'top.yaml',
      [`appId: ${baseUrl}/fixtures/delayed.html?delay=1500`, 'defaultTimeout: 1000', 'commands:', '  - runFlow: ./child.yaml'].join(
        '\n',
      ),
    );
    writeTmpFile(
      dir,
      'child.yaml',
      [
        `appId: ${baseUrl}/fixtures/delayed.html?delay=1500`,
        'commands:',
        `  - goto: ${baseUrl}/fixtures/delayed.html?delay=1500`,
        '  - timeout: 4000',
        '    assertVisible: data-testid=int-delayed',
      ].join('\n'),
    );
    try {
      const file = loadAndParse(topPath);
      const run = resolveRunTimeouts({}, file);
      const ctx = createContext(os.tmpdir(), new Map([['__default__', page]]), '__default__', createVarMap({}), undefined, run);
      const result = await runFlow(file, page, ctx);
      expect(result.passed).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 10_000);

  it('AC45(b): the Q17 parse error inside a child flow fails the runFlow step', async () => {
    const dir = makeTmpDir();
    const topPath = writeTmpFile(
      dir,
      'top.yaml',
      [`appId: ${baseUrl}/fixtures/delayed.html`, 'commands:', '  - runFlow: ./childbad.yaml'].join('\n'),
    );
    writeTmpFile(
      dir,
      'childbad.yaml',
      [`appId: ${baseUrl}/fixtures/delayed.html`, 'commands:', '  - wait: 100', '    timeout: 1000'].join('\n'),
    );
    try {
      const file = loadAndParse(topPath);
      const ctx = createContext(os.tmpdir(), new Map([['__default__', page]]), '__default__');
      const result = await runFlow(file, page, ctx);
      expect(result.passed).toBe(false);
      expect(result.commandResults[0].message).toContain('timeout is not supported on wait');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('AC48: ${var} in sibling timeout resolves at dispatch from runtime vars', async () => {
    await page.goto(fixtureUrl('delayed.html', 'delay=999999'));
    const ctx = freshCtx();
    ctx.varMap.set('t', '1300');
    const result = await dispatch(
      page,
      { command: { type: 'assertVisible', selector: 'data-testid=int-never-rendered' }, timeout: '${t}' },
      ctx,
    );
    expect(result.passed).toBe(false);
    expectElapsed(result.durationMs, 1300);
    expect(result.message!.split('\n')[0]).toBe('Element not found after 1300ms: data-testid=int-never-rendered');
  });
});

// ─── AC51-AC57: precedence chains ────────────────────────────────────────────

describe('AC51-AC57: precedence chains', () => {
  async function probe(run: TimeoutSettings): Promise<string> {
    await page.goto(fixtureUrl('delayed.html', 'delay=999999'));
    const ctx = freshCtx(run);
    const result = await dispatch(
      page,
      { command: { type: 'assertVisible', selector: 'data-testid=int-never-rendered' } },
      ctx,
    );
    expect(result.passed).toBe(false);
    return result.message!.split('\n')[0];
  }

  it('AC51(1): sibling wins over CLI/header/config/built-in', async () => {
    await page.goto(fixtureUrl('delayed.html', 'delay=999999'));
    const ctx = freshCtx({ defaultTimeout: 1300, navigationTimeout: 30000 }); // simulates CLI layer resolved
    const result = await dispatch(
      page,
      { command: { type: 'assertVisible', selector: 'data-testid=int-never-rendered' }, timeout: 1400 },
      ctx,
    );
    expect(result.message!.split('\n')[0]).toBe('Element not found after 1400ms: data-testid=int-never-rendered');
  });

  it('AC51(2): CLI wins over header/config/built-in (no sibling)', async () => {
    const line = await probe({ defaultTimeout: 1300, navigationTimeout: 30000 });
    expect(line).toBe('Element not found after 1300ms: data-testid=int-never-rendered');
  });

  it('AC51(5, slow): with nothing set, the built-in 5000ms default applies', async () => {
    const line = await probe({ defaultTimeout: 5000, navigationTimeout: 30000 });
    expect(line).toBe('Element not found after 5000ms: data-testid=int-never-rendered');
  }, 10_000);

  it('AC52: sibling wins the navigation chain', async () => {
    await page.goto(fixtureUrl('delayed.html'));
    const ctx = freshCtx({ defaultTimeout: 5000, navigationTimeout: 1300 });
    const result = await dispatch(
      page,
      { command: { type: 'waitForPageLoad', path: '/never-reached' }, timeout: 1400 },
      ctx,
    );
    expect(result.message).toContain('1400ms');
  });

  it('AC53(a): header navigationTimeout does not leak into the element chain', async () => {
    const line = await probe({ defaultTimeout: 5000, navigationTimeout: 1000 });
    expect(line).toBe('Element not found after 5000ms: data-testid=int-never-rendered');
  }, 10_000);

  it('AC53(b): CLI --timeout does not leak into the navigation chain (still running past it)', async () => {
    await page.goto(fixtureUrl('delayed.html'));
    const ctx = freshCtx({ defaultTimeout: 1000, navigationTimeout: 30000 });
    const dispatchPromise = dispatch(
      page,
      { command: { type: 'waitForPageLoad', path: '/never-reached' } },
      ctx,
    );
    const sentinel = Symbol('still-running');
    const race = await Promise.race([
      dispatchPromise,
      new Promise((resolve) => setTimeout(() => resolve(sentinel), 1500)),
    ]);
    expect(race).toBe(sentinel); // navigationTimeout (30000) is still in effect, not the element 1000
    await dispatchPromise; // drain so the test doesn't leave a dangling handle
  }, 35_000);

  it('AC54: header beats the shared config for defaultTimeout', async () => {
    const dir = makeTmpDir();
    writeTmpFile(dir, 'config.yml', 'defaultTimeout: 4000\n');
    const flowPath = writeTmpFile(
      dir,
      'flow.yaml',
      [`appId: ${baseUrl}/fixtures/delayed.html?delay=999999`, 'config: config.yml', 'defaultTimeout: 1200', 'commands:', '  - assertVisible: data-testid=int-never-rendered'].join(
        '\n',
      ),
    );
    try {
      const file = loadAndParse(flowPath);
      const run = resolveRunTimeouts({}, file);
      expect(run.defaultTimeout).toBe(1200);
      const ctx = createContext(os.tmpdir(), new Map([['__default__', page]]), '__default__', createVarMap({}), undefined, run);
      await page.goto(fixtureUrl('delayed.html', 'delay=999999'));
      const result = await runFlow(file, page, ctx);
      expect(result.commandResults[0].message!.split('\n')[0]).toBe(
        'Element not found after 1200ms: data-testid=int-never-rendered',
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('AC56: CLI timeouts apply to every flow in a run', async () => {
    const dir = makeTmpDir();
    const flowA = writeTmpFile(
      dir,
      'a.yaml',
      [`appId: ${baseUrl}/fixtures/delayed.html?delay=999999`, 'commands:', '  - assertVisible: data-testid=int-never-rendered'].join('\n'),
    );
    const flowB = writeTmpFile(
      dir,
      'b.yaml',
      [`appId: ${baseUrl}/fixtures/delayed.html?delay=999999`, 'commands:', '  - assertVisible: data-testid=int-never-rendered-b'].join('\n'),
    );
    try {
      const cli: Partial<TimeoutSettings> = { defaultTimeout: 1300 };
      for (const target of [flowA, flowB]) {
        const file = loadAndParse(target);
        const run = resolveRunTimeouts(cli, file);
        const p = await browser.newPage();
        await p.goto(fixtureUrl('delayed.html', 'delay=999999'));
        const ctx = createContext(os.tmpdir(), new Map([['__default__', p]]), '__default__', createVarMap({}), undefined, run);
        const result = await runFlow(file, p, ctx);
        await p.close();
        expect(result.commandResults[0].message!.split('\n')[0]).toContain('after 1300ms');
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('AC57: ${var} in header and config values resolves at parse time, confirmed end-to-end', async () => {
    const dir = makeTmpDir();
    const flowPath = writeTmpFile(
      dir,
      'flow.yaml',
      [
        `appId: ${baseUrl}/fixtures/delayed.html?delay=999999`,
        'vars:',
        '  t: 1250',
        'defaultTimeout: "${t}"',
        'commands:',
        '  - assertVisible: data-testid=int-never-rendered',
      ].join('\n'),
    );
    try {
      const file = loadAndParse(flowPath);
      const run = resolveRunTimeouts({}, file);
      expect(run.defaultTimeout).toBe(1250);
      const ctx = createContext(os.tmpdir(), new Map([['__default__', page]]), '__default__', createVarMap({}), undefined, run);
      await page.goto(fixtureUrl('delayed.html', 'delay=999999'));
      const result = await runFlow(file, page, ctx);
      expect(result.commandResults[0].message!.split('\n')[0]).toBe(
        'Element not found after 1250ms: data-testid=int-never-rendered',
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ─── AC58-AC64, AC80: child-flow inheritance and the ignored-key notice ─────

describe('AC58-AC64, AC80: child flows inherit timeouts; the notice fires once per differing key', () => {
  function buildTopChild(dir: string, opts: {
    topDefault?: number; topNav?: number;
    childDefault?: number; childNav?: number;
    calls?: number;
  }): { topPath: string; childPath: string } {
    const topHeader = [
      opts.topDefault !== undefined ? `defaultTimeout: ${opts.topDefault}` : null,
      opts.topNav !== undefined ? `navigationTimeout: ${opts.topNav}` : null,
    ].filter(Boolean);
    const calls = opts.calls ?? 1;
    const topPath = writeTmpFile(
      dir,
      'top.yaml',
      [
        `appId: ${baseUrl}/fixtures/delayed.html?delay=999999`,
        ...topHeader,
        'commands:',
        ...Array.from({ length: calls }, () => '  - runFlow: ./child.yaml'),
      ].join('\n'),
    );
    const childHeader = [
      opts.childDefault !== undefined ? `defaultTimeout: ${opts.childDefault}` : null,
      opts.childNav !== undefined ? `navigationTimeout: ${opts.childNav}` : null,
    ].filter(Boolean);
    const childPath = writeTmpFile(
      dir,
      'child.yaml',
      [
        `appId: ${baseUrl}/fixtures/delayed.html?delay=999999`,
        ...childHeader,
        'commands:',
        '  - assertVisible: data-testid=int-never-rendered',
      ].join('\n'),
    );
    return { topPath, childPath };
  }

  it('AC58: child header keys are ignored; the element probe reports the inherited value', async () => {
    const dir = makeTmpDir();
    const { topPath } = buildTopChild(dir, { topDefault: 1000, topNav: 1500, childDefault: 4000, childNav: 6000 });
    try {
      const file = loadAndParse(topPath);
      const run = resolveRunTimeouts({}, file);
      const ctx = createContext(os.tmpdir(), new Map([['__default__', page]]), '__default__', createVarMap({}), undefined, run);
      await page.goto(fixtureUrl('delayed.html', 'delay=999999'));
      const result = await runFlow(file, page, ctx);
      const childResult = result.commandResults[0].nestedResult!;
      expect(childResult.commandResults[0].message!.split('\n')[0]).toBe(
        'Element not found after 1000ms: data-testid=int-never-rendered',
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('AC59 (revised): shared-config keys are ignored too, with a notice when the value differs', async () => {
    const dir = makeTmpDir();
    writeTmpFile(dir, 'child-config.yml', 'defaultTimeout: 4000\n');
    const topPath = writeTmpFile(
      dir,
      'top.yaml',
      [`appId: ${baseUrl}/fixtures/delayed.html?delay=999999`, 'commands:', '  - runFlow: ./child.yaml'].join('\n'),
    );
    writeTmpFile(
      dir,
      'child.yaml',
      [
        `appId: ${baseUrl}/fixtures/delayed.html?delay=999999`,
        'config: child-config.yml',
        'commands:',
        '  - assertVisible: data-testid=int-never-rendered',
      ].join('\n'),
    );
    const notices = collectNotices();
    try {
      const file = loadAndParse(topPath);
      const run = resolveRunTimeouts({}, file);
      const ctx = createContext(os.tmpdir(), new Map([['__default__', page]]), '__default__', createVarMap({}), undefined, run, notices.onProgress);
      await page.goto(fixtureUrl('delayed.html', 'delay=999999'));
      const result = await runFlow(file, page, ctx);
      const childResult = result.commandResults[0].nestedResult!;
      expect(childResult.commandResults[0].message!.split('\n')[0]).toBe(
        'Element not found after 5000ms: data-testid=int-never-rendered',
      );
      expect(notices.messages).toEqual([
        'child.yaml: defaultTimeout ignored (inherited from top.yaml)',
      ]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 10_000);

  it('AC60 (revised)(a): a two-key notice is printed exactly once even when the child runs twice', async () => {
    const dir = makeTmpDir();
    const { topPath } = buildTopChild(dir, { topDefault: 1000, topNav: 1500, childDefault: 4000, childNav: 6000, calls: 2 });
    const notices = collectNotices();
    try {
      const file = loadAndParse(topPath);
      const run = resolveRunTimeouts({}, file);
      const ctx = createContext(os.tmpdir(), new Map([['__default__', page]]), '__default__', createVarMap({}), undefined, run, notices.onProgress);
      await page.goto(fixtureUrl('delayed.html', 'delay=999999'));
      await runFlow(file, page, ctx);
      expect(notices.messages).toEqual([
        'child.yaml: defaultTimeout, navigationTimeout ignored (inherited from top.yaml)',
      ]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('AC60 (revised)(b): a single-key notice for a different child file', async () => {
    const dir = makeTmpDir();
    writeTmpFile(dir, 'child2.yaml', [`appId: ${baseUrl}/fixtures/delayed.html?delay=999999`, 'defaultTimeout: 4000', 'commands:', '  - assertVisible: data-testid=int-never-rendered'].join('\n'));
    const topPath = writeTmpFile(
      dir,
      'top.yaml',
      [`appId: ${baseUrl}/fixtures/delayed.html?delay=999999`, 'commands:', '  - runFlow: ./child2.yaml'].join('\n'),
    );
    const notices = collectNotices();
    try {
      const file = loadAndParse(topPath);
      const run = resolveRunTimeouts({}, file);
      const ctx = createContext(os.tmpdir(), new Map([['__default__', page]]), '__default__', createVarMap({}), undefined, run, notices.onProgress);
      await page.goto(fixtureUrl('delayed.html', 'delay=999999'));
      await runFlow(file, page, ctx);
      expect(notices.messages).toEqual([
        'child2.yaml: defaultTimeout ignored (inherited from top.yaml)',
      ]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('AC61 (revised)(a): no notice when the child sets neither key', async () => {
    const dir = makeTmpDir();
    const { topPath } = buildTopChild(dir, {});
    const notices = collectNotices();
    try {
      const file = loadAndParse(topPath);
      const run = resolveRunTimeouts({}, file);
      const ctx = createContext(os.tmpdir(), new Map([['__default__', page]]), '__default__', createVarMap({}), undefined, run, notices.onProgress);
      await page.goto(fixtureUrl('delayed.html', 'delay=999999'));
      await runFlow(file, page, ctx);
      expect(notices.messages).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('AC61 (revised)(b): no notice when the child shares the same config as the effective value', async () => {
    const dir = makeTmpDir();
    writeTmpFile(dir, 'shared-config.yml', 'defaultTimeout: 1000\n');
    const topPath = writeTmpFile(
      dir,
      'top.yaml',
      [`appId: ${baseUrl}/fixtures/delayed.html?delay=999999`, 'config: shared-config.yml', 'commands:', '  - runFlow: ./child.yaml'].join('\n'),
    );
    writeTmpFile(
      dir,
      'child.yaml',
      [
        `appId: ${baseUrl}/fixtures/delayed.html?delay=999999`,
        'config: shared-config.yml',
        'commands:',
        '  - assertVisible: data-testid=int-never-rendered',
      ].join('\n'),
    );
    const notices = collectNotices();
    try {
      const file = loadAndParse(topPath);
      const run = resolveRunTimeouts({}, file);
      const ctx = createContext(os.tmpdir(), new Map([['__default__', page]]), '__default__', createVarMap({}), undefined, run, notices.onProgress);
      await page.goto(fixtureUrl('delayed.html', 'delay=999999'));
      await runFlow(file, page, ctx);
      expect(notices.messages).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('AC62: a grandchild notice names the top-level flow, not the immediate caller', async () => {
    const dir = makeTmpDir();
    writeTmpFile(dir, 'leaf.yaml', [`appId: ${baseUrl}/fixtures/delayed.html?delay=999999`, 'defaultTimeout: 4000', 'commands:', '  - assertVisible: data-testid=int-never-rendered'].join('\n'));
    writeTmpFile(dir, 'mid.yaml', [`appId: ${baseUrl}/fixtures/delayed.html?delay=999999`, 'commands:', '  - runFlow: ./leaf.yaml'].join('\n'));
    const topPath = writeTmpFile(dir, 'top.yaml', [`appId: ${baseUrl}/fixtures/delayed.html?delay=999999`, 'commands:', '  - runFlow: ./mid.yaml'].join('\n'));
    const notices = collectNotices();
    try {
      const file = loadAndParse(topPath);
      const run = resolveRunTimeouts({}, file);
      const ctx = createContext(os.tmpdir(), new Map([['__default__', page]]), '__default__', createVarMap({}), undefined, run, notices.onProgress);
      await page.goto(fixtureUrl('delayed.html', 'delay=999999'));
      await runFlow(file, page, ctx);
      expect(notices.messages).toContain('leaf.yaml: defaultTimeout ignored (inherited from top.yaml)');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 10_000);

  it('AC63: the same file applies its own keys when run top-level, with no notice', async () => {
    const dir = makeTmpDir();
    const childPath = writeTmpFile(
      dir,
      'child.yaml',
      [`appId: ${baseUrl}/fixtures/delayed.html?delay=999999`, 'defaultTimeout: 4000', 'commands:', '  - assertVisible: data-testid=int-never-rendered'].join('\n'),
    );
    const notices = collectNotices();
    try {
      const file = loadAndParse(childPath);
      const run = resolveRunTimeouts({}, file);
      expect(run.defaultTimeout).toBe(4000);
      const ctx = createContext(os.tmpdir(), new Map([['__default__', page]]), '__default__', createVarMap({}), undefined, run, notices.onProgress);
      await page.goto(fixtureUrl('delayed.html', 'delay=999999'));
      const result = await runFlow(file, page, ctx);
      expect(result.commandResults[0].message!.split('\n')[0]).toBe(
        'Element not found after 4000ms: data-testid=int-never-rendered',
      );
      expect(notices.messages).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('AC64: runFlow vars cannot set timeouts; ${defaultTimeout} is just a var inside the child', async () => {
    const dir = makeTmpDir();
    const topPath = writeTmpFile(
      dir,
      'top.yaml',
      [
        `appId: ${baseUrl}/fixtures/delayed.html?delay=999999`,
        'commands:',
        '  - runFlow:',
        '      file: ./child.yaml',
        '      vars:',
        '        defaultTimeout: "1000"',
      ].join('\n'),
    );
    writeTmpFile(
      dir,
      'child.yaml',
      [
        `appId: ${baseUrl}/fixtures/delayed.html?delay=999999`,
        'commands:',
        '  - setVar: probed=${defaultTimeout}',
        '  - assertVisible: data-testid=int-never-rendered',
      ].join('\n'),
    );
    try {
      const file = loadAndParse(topPath);
      const run = resolveRunTimeouts({}, file);
      const ctx = createContext(os.tmpdir(), new Map([['__default__', page]]), '__default__', createVarMap({}), undefined, run);
      await page.goto(fixtureUrl('delayed.html', 'delay=999999'));
      const result = await runFlow(file, page, ctx);
      const childResults = result.commandResults[0].nestedResult!.commandResults;
      expect(childResults[0].passed).toBe(true); // the ordinary var resolved fine
      expect(childResults[1].message!.split('\n')[0]).toBe(
        'Element not found after 5000ms: data-testid=int-never-rendered',
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 10_000);

  it('AC80(a): no notice when the child header value equals the effective value', async () => {
    const dir = makeTmpDir();
    const { topPath } = buildTopChild(dir, { topDefault: 1000, childDefault: 1000 });
    const notices = collectNotices();
    try {
      const file = loadAndParse(topPath);
      const run = resolveRunTimeouts({}, file);
      const ctx = createContext(os.tmpdir(), new Map([['__default__', page]]), '__default__', createVarMap({}), undefined, run, notices.onProgress);
      await page.goto(fixtureUrl('delayed.html', 'delay=999999'));
      await runFlow(file, page, ctx);
      expect(notices.messages).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('AC80(b): a partial notice lists only the key that differs', async () => {
    const dir = makeTmpDir();
    const { topPath } = buildTopChild(dir, { topDefault: 1000, topNav: 1500, childDefault: 1000, childNav: 9000 });
    const notices = collectNotices();
    try {
      const file = loadAndParse(topPath);
      const run = resolveRunTimeouts({}, file);
      const ctx = createContext(os.tmpdir(), new Map([['__default__', page]]), '__default__', createVarMap({}), undefined, run, notices.onProgress);
      await page.goto(fixtureUrl('delayed.html', 'delay=999999'));
      await runFlow(file, page, ctx);
      expect(notices.messages).toEqual([
        'child.yaml: navigationTimeout ignored (inherited from top.yaml)',
      ]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ─── AC66, AC69, AC73: reserved keys, child validation, built-in defaults ──

describe('AC66, AC69, AC73: reserved keys, child validation, and built-in defaults', () => {
  it('AC66: a stripped reserved config key is not a var at dispatch', async () => {
    const dir = makeTmpDir();
    writeTmpFile(dir, 'config.yml', 'defaultTimeout: 15000\nnavigationTimeout: 30000\nbase: http://x\n');
    const flowPath = writeTmpFile(
      dir,
      'flow.yaml',
      [`appId: ${baseUrl}/fixtures/delayed.html`, 'config: config.yml', 'commands:', '  - tapOn: "${defaultTimeout}"'].join('\n'),
    );
    try {
      const file = loadAndParse(flowPath);
      expect(file.vars?.defaultTimeout).toBeUndefined();
      expect(file.vars?.base).toBe('http://x');
      const run = resolveRunTimeouts({}, file);
      const ctx = createContext(os.tmpdir(), new Map([['__default__', page]]), '__default__', createVarMap(file.vars ?? {}), undefined, run);
      await page.goto(fixtureUrl('delayed.html'));
      const result = await runFlow(file, page, ctx);
      expect(result.commandResults[0].passed).toBe(false);
      expect(result.commandResults[0].message).toBe('Variable "defaultTimeout" is not defined in flow "flow"');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('AC69: child flow header keys are still validated', async () => {
    const dir = makeTmpDir();
    const topPath = writeTmpFile(
      dir,
      'top.yaml',
      [`appId: ${baseUrl}/fixtures/delayed.html`, 'commands:', '  - runFlow: ./child.yaml'].join('\n'),
    );
    writeTmpFile(dir, 'child.yaml', [`appId: ${baseUrl}/fixtures/delayed.html`, 'defaultTimeout: 0', 'commands:', '  - assertVisible: x'].join('\n'));
    try {
      const file = loadAndParse(topPath);
      const ctx = createContext(os.tmpdir(), new Map([['__default__', page]]), '__default__');
      await page.goto(fixtureUrl('delayed.html'));
      const result = await runFlow(file, page, ctx);
      expect(result.commandResults[0].passed).toBe(false);
      expect(result.commandResults[0].message).toContain('Invalid defaultTimeout: must be a positive integer, got 0');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('AC73(a): the built-in defaultTimeout (5000) applies with nothing configured', async () => {
    await page.goto(fixtureUrl('delayed.html', 'delay=999999'));
    const ctx = freshCtx();
    const result = await dispatch(page, { command: { type: 'assertVisible', selector: 'data-testid=int-never-rendered' } }, ctx);
    expect(result.passed).toBe(false);
    expectElapsed(result.durationMs, 5000);
    expect(result.message!.split('\n')[0]).toBe('Element not found after 5000ms: data-testid=int-never-rendered');
  }, 10_000);

  it('AC73(b): waitForPageLoad timeout: 0 still parses and runs', async () => {
    await page.goto(`${baseUrl}/quick`);
    const ctx = freshCtx();
    const result = await dispatch(page, { command: { type: 'waitForPageLoad', timeout: 0 } }, ctx);
    expect(result.passed).toBe(true);
  });
});

// ─── AC75: reporter labels unchanged (light round-trip; primary coverage is the reporter unit test) ──

describe('AC75: sibling timeout does not change a command result shape', () => {
  it('AC75: command.type/selector on the result are identical with or without a sibling timeout', async () => {
    await page.goto(fixtureUrl('delayed.html', 'delay=700'));
    const ctxA = freshCtx();
    const withoutTimeout = await dispatch(page, { command: { type: 'tapOn', selector: 'data-testid=int-delayed' } }, ctxA);

    await page.goto(fixtureUrl('delayed.html', 'delay=700'));
    const ctxB = freshCtx();
    const withTimeout = await dispatch(
      page,
      { command: { type: 'tapOn', selector: 'data-testid=int-delayed' }, timeout: 3000 },
      ctxB,
    );

    expect(withoutTimeout.command).toEqual(withTimeout.command);
  });
});

// ─── B edge cases: shared notice Set, and per-step deadline isolation ───────

describe('B edge cases', () => {
  it('two sessions calling runFlow on the same child file notice only once', async () => {
    const dir = makeTmpDir();
    writeTmpFile(dir, 'child.yaml', [`appId: ${baseUrl}/fixtures/delayed.html?delay=999999`, 'defaultTimeout: 4000', 'commands:', '  - assertVisible: data-testid=int-never-rendered'].join('\n'));
    const topPath = writeTmpFile(
      dir,
      'top.yaml',
      [
        `appId: ${baseUrl}/fixtures/delayed.html?delay=999999`,
        'sessions:',
        '  - id: a',
        '  - id: b',
        'commands:',
        '  - session: a',
        '    runFlow: ./child.yaml',
        '  - session: b',
        '    runFlow: ./child.yaml',
      ].join('\n'),
    );
    const notices = collectNotices();
    try {
      const file = loadAndParse(topPath);
      const run = resolveRunTimeouts({}, file);
      const sessions = new Map<string, Page>([
        ['a', await browser.newPage()],
        ['b', await browser.newPage()],
      ]);
      try {
        for (const p of sessions.values()) await p.goto(fixtureUrl('delayed.html', 'delay=999999'));
        const ctx = createContext(os.tmpdir(), sessions, 'a', createVarMap({}), undefined, run, notices.onProgress);
        await runFlow(file, sessions.get('a')!, ctx);
        expect(notices.messages).toEqual([
          'child.yaml: defaultTimeout ignored (inherited from top.yaml)',
        ]);
      } finally {
        for (const p of sessions.values()) await p.close();
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 15_000);

  it('a passing probe followed by a failing probe: the second deadline is fresh, not decremented', async () => {
    await page.goto(fixtureUrl('delayed.html', 'cardDelay=0&delay=999999'));
    const ctx = freshCtx();
    // First step passes quickly (card exists immediately).
    const first = await dispatch(page, { command: { type: 'assertVisible', selector: { testId: 'card' } } }, ctx);
    expect(first.passed).toBe(true);
    // Second step gets its own fresh 1000ms budget, timed from ITS OWN start.
    const second = await dispatch(
      page,
      { command: { type: 'assertVisible', selector: 'data-testid=int-never-rendered' }, timeout: 1000 },
      ctx,
    );
    expect(second.passed).toBe(false);
    expectElapsed(second.durationMs, 1000);
  });
});

// ─── Smoke: no sibling timeouts anywhere passes identically before/after ───

describe('Smoke: run-flow-override.yaml passes with no sibling timeouts anywhere', () => {
  it('run-flow-override.yaml and its child parse and are structurally unaffected by T11', async () => {
    const overridePath = path.resolve(__dirname, '../../../test-app/flows/integration/run-flow-override.yaml');
    const childPath = path.resolve(__dirname, '../../../test-app/flows/integration/run-flow-override-child.yaml');
    const file = loadAndParse(overridePath);
    const child = loadAndParse(childPath);
    // No defaultTimeout/navigationTimeout anywhere in either file -> both timeout layers are empty,
    // so resolveRunTimeouts falls through to the built-in defaults exactly as before T11.
    expect(file.timeouts?.header ?? {}).toEqual({});
    expect(file.timeouts?.config ?? {}).toEqual({});
    expect(child.timeouts?.header ?? {}).toEqual({});
    const run = resolveRunTimeouts({}, file);
    expect(run).toEqual({ defaultTimeout: 5000, navigationTimeout: 30000 });
  });
});
