// @integration
/**
 * tests/integration/sessions.test.ts
 *
 * Integration tests for the multi-session browser feature.
 * Covers AC-2 (page count), AC-3 (session isolation), AC-4 (default routing),
 * AC-5 (runFlow session inheritance), and AC-13 (browser cleanup on failure).
 *
 * Setup:
 *   - A local HTTP server serves tests/fixtures/test-page.html on a random port.
 *   - A headless Chromium browser is launched once for the suite.
 *   - Each test manages its own pages via createSessionPages / browser.newPage.
 *
 * Run with: npx vitest run tests/integration/sessions.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createSessionPages } from '../../src/driver/browser';
import { createContext } from '../../src/engine/context';
import { loadAndParse } from '../../src/parser/index';
import { runFlow } from '../../src/engine/index';
import { runAll } from '../../src/cli/runner';

// ─── Global setup ─────────────────────────────────────────────────────────────

let server: http.Server;
let baseUrl: string;
let browser: Browser;

const fixturePath = path.resolve(__dirname, '../fixtures/test-page.html');

beforeAll(async () => {
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

/** Write a temporary YAML flow file and return its path */
function writeTmpFlow(content: string): string {
  const file = path.join(
    os.tmpdir(),
    `webt-int-test-${Date.now()}-${Math.random().toString(36).slice(2)}.yaml`,
  );
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

// ─── AC-2: createSessionPages opens exactly N pages ──────────────────────────

describe('AC-2: createSessionPages', () => {
  it('returns a Map with one real page per session id', async () => {
    const map = await createSessionPages(browser, ['alice', 'bob']);
    try {
      expect(map.size).toBe(2);
      expect(map.has('alice')).toBe(true);
      expect(map.has('bob')).toBe(true);
      // Both should be usable Playwright pages
      expect(typeof map.get('alice')!.goto).toBe('function');
      expect(typeof map.get('bob')!.goto).toBe('function');
    } finally {
      for (const p of map.values()) await p.close();
    }
  });
});

// ─── AC-3: Session isolation — each session navigates independently ───────────

describe('AC-3: multi-session isolation', () => {
  it('alice and bob navigate to different URLs; assertUrl checks the right page', async () => {
    const flowPath = writeTmpFlow(
      `appId: ${baseUrl}
sessions:
  - id: alice
  - id: bob
commands:
  - session: alice
    goto: ${baseUrl}/alice-route
  - session: bob
    goto: ${baseUrl}/bob-route
  - session: alice
    assertUrl: /alice-route
  - session: bob
    assertUrl: /bob-route
`,
    );

    try {
      const file = loadAndParse(flowPath);
      const sessions = await createSessionPages(browser, ['alice', 'bob']);
      const ctx = createContext(os.tmpdir(), sessions, 'alice');

      try {
        const result = await runFlow(file, sessions.get('alice')!, ctx);
        expect(result.passed).toBe(true);
        expect(result.commandResults).toHaveLength(4);
        expect(result.commandResults.every((r) => r.passed)).toBe(true);
      } finally {
        for (const p of sessions.values()) await p.close();
      }
    } finally {
      fs.unlinkSync(flowPath);
    }
  }, 30_000);
});

// ─── AC-4: Default session routing ────────────────────────────────────────────

describe('AC-4: default session routing', () => {
  it('untagged command routes to the default session (alice)', async () => {
    const flowPath = writeTmpFlow(
      `appId: ${baseUrl}
sessions:
  - id: alice
  - id: bob
commands:
  - session: bob
    goto: ${baseUrl}/bob-only
  - goto: ${baseUrl}/default-dest
  - assertUrl: /default-dest
`,
    );

    try {
      const file = loadAndParse(flowPath);
      const sessions = await createSessionPages(browser, ['alice', 'bob']);
      const ctx = createContext(os.tmpdir(), sessions, 'alice');

      try {
        const result = await runFlow(file, sessions.get('alice')!, ctx);
        expect(result.passed).toBe(true);
        // alice ends up on /default-dest; bob ends up on /bob-only
        expect(sessions.get('alice')!.url()).toContain('/default-dest');
        expect(sessions.get('bob')!.url()).toContain('/bob-only');
      } finally {
        for (const p of sessions.values()) await p.close();
      }
    } finally {
      fs.unlinkSync(flowPath);
    }
  }, 30_000);
});

// ─── AC-5: runFlow with session: inherits that session as default ─────────────

describe('AC-5: runFlow session inheritance', () => {
  it('sub-flow run with session:bob lands bob\'s page on the sub-flow URL', async () => {
    const subFlowPath = writeTmpFlow(
      `appId: ${baseUrl}
commands:
  - goto: ${baseUrl}/bob-subflow-page
  - assertUrl: /bob-subflow-page
`,
    );

    const parentFlowPath = writeTmpFlow(
      `appId: ${baseUrl}
sessions:
  - id: alice
  - id: bob
commands:
  - session: alice
    goto: ${baseUrl}/alice-page
  - session: bob
    runFlow: ${subFlowPath}
`,
    );

    try {
      const file = loadAndParse(parentFlowPath);
      const sessions = await createSessionPages(browser, ['alice', 'bob']);
      const ctx = createContext(os.tmpdir(), sessions, 'alice');

      try {
        const result = await runFlow(file, sessions.get('alice')!, ctx);
        expect(result.passed).toBe(true);
        // Alice stayed on her own page
        expect(sessions.get('alice')!.url()).toContain('/alice-page');
        // Bob's page was navigated by the sub-flow
        expect(sessions.get('bob')!.url()).toContain('/bob-subflow-page');
        // defaultSessionId restored to alice after sub-flow
        expect(ctx.defaultSessionId).toBe('alice');
      } finally {
        for (const p of sessions.values()) await p.close();
      }
    } finally {
      fs.unlinkSync(subFlowPath);
      fs.unlinkSync(parentFlowPath);
    }
  }, 30_000);
});

// ─── AC-13: browser cleanup on failure ────────────────────────────────────────

describe('AC-13: browser cleanup', () => {
  it('runAll completes without throwing when a flow fails (browser closed in finally)', async () => {
    const failingFlowPath = writeTmpFlow(
      `url: ${baseUrl}\ncommands:\n  - assertVisible: "DEFINITELY_NOT_ON_PAGE_XYZ"\n`,
    );

    try {
      const result = await runAll([failingFlowPath], {
        headed: false,
        slowMo: 0,
        reporter: null,
        runDir: os.tmpdir(),
        tags: [],
      });
      // runAll must return (not throw) and report the failure
      expect(result.failedFlows).toBe(1);
      expect(result.passedFlows).toBe(0);
    } finally {
      fs.unlinkSync(failingFlowPath);
    }
  }, 30_000);
});
