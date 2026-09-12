/**
 * tests/unit/runner-no-auto-nav.test.ts
 *
 * Verifies that runAll() no longer auto-navigates from file.baseUrl after
 * the feat-appid-goto-refactor change (T1: removal of the
 * `if (file.baseUrl) await firstPage.goto(file.baseUrl)` line).
 *
 * All heavy dependencies are mocked so tests run without a real browser.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Page, Browser } from 'playwright';
import type { FlowFile, FlowResult, RunOptions } from '@uivisor/core';

// Hoist mocks before any module imports
vi.mock('../../src/parser/index.js');
vi.mock('../../src/driver/browser.js');
vi.mock('../../src/engine/index.js');
vi.mock('../../src/engine/context.js');
vi.mock('../../src/reporter/console.js');

import { runAll } from '../../src/cli/runner.js';
import * as parserModule from '../../src/parser/index.js';
import * as browserModule from '../../src/driver/browser.js';
import * as engineModule from '../../src/engine/index.js';
import * as contextModule from '../../src/engine/context.js';
import { ConsoleReporter } from '../../src/reporter/console.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeMockPage(): Page {
  return {
    goto: vi.fn().mockResolvedValue(null),
    close: vi.fn().mockResolvedValue(undefined),
    url: vi.fn().mockReturnValue('http://test/'),
  } as unknown as Page;
}

function makeMockBrowser(defaultPage: Page): Browser {
  return {
    newPage: vi.fn().mockResolvedValue(defaultPage),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as Browser;
}

const BASE_OPTIONS: RunOptions = {
  headed: false,
  slowMo: 0,
  reporter: null,
};

const EMPTY_FLOW_RESULT: FlowResult = {
  filePath: '/flow.yaml',
  passed: true,
  commandResults: [],
  totalCommands: 0,
  passedCommands: 0,
  durationMs: 0,
};

/** Build a minimal FlowFile */
function makeFlowFile(overrides: Partial<FlowFile> = {}): FlowFile {
  return {
    baseUrl: 'http://example.com',
    filePath: '/flow.yaml',
    commands: [],
    sessions: [],
    tags: [],
    shared: false,
    ...overrides,
  };
}

// ─── setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // ConsoleReporter mock — stub all methods
  const MockReporter = vi.mocked(ConsoleReporter);
  MockReporter.mockImplementation(() => ({
    startFlow: vi.fn(),
    reportCommand: vi.fn(),
    endFlow: vi.fn(),
    runEnd: vi.fn(),
  }) as unknown as ConsoleReporter);
});

// ─── TC-1: baseUrl set but no goto command ────────────────────────────────────

describe('TC-1: FlowFile with baseUrl set but no goto command', () => {
  it('page.goto is never called', async () => {
    const mockPage = makeMockPage();
    const mockBrowser = makeMockBrowser(mockPage);
    const initialPage = makeMockPage(); // the page that gets closed immediately

    vi.mocked(browserModule.launchBrowser).mockResolvedValue({
      browser: mockBrowser,
      page: initialPage,
    });
    vi.mocked(browserModule.closeBrowser).mockResolvedValue(undefined);
    vi.mocked(parserModule.loadAndParse).mockReturnValue(
      makeFlowFile({
        baseUrl: 'http://example.com',
        commands: [], // no goto command
      }),
    );
    vi.mocked(contextModule.createContext).mockReturnValue({
      lastTappedLocator: null,
      callStack: new Set(),
      indentLevel: 0,
      runDir: '/tmp',
      sessions: new Map([['__default__', mockPage]]),
      defaultSessionId: '__default__',
    });
    vi.mocked(engineModule.runFlow).mockResolvedValue(EMPTY_FLOW_RESULT);

    await runAll(['/flow.yaml'], BASE_OPTIONS);

    expect(mockPage.goto).not.toHaveBeenCalled();
  });
});

// ─── TC-2: FlowFile with goto command ────────────────────────────────────────

describe('TC-2: FlowFile with goto command', () => {
  it('page.goto is called exactly once with the goto URL', async () => {
    const gotoUrl = 'http://example.com/start';
    const mockPage = makeMockPage();
    const mockBrowser = makeMockBrowser(mockPage);
    const initialPage = makeMockPage();

    vi.mocked(browserModule.launchBrowser).mockResolvedValue({
      browser: mockBrowser,
      page: initialPage,
    });
    vi.mocked(browserModule.closeBrowser).mockResolvedValue(undefined);
    vi.mocked(parserModule.loadAndParse).mockReturnValue(
      makeFlowFile({
        baseUrl: gotoUrl,
        commands: [{ command: { type: 'goto', url: gotoUrl } }],
      }),
    );
    vi.mocked(contextModule.createContext).mockReturnValue({
      lastTappedLocator: null,
      callStack: new Set(),
      indentLevel: 0,
      runDir: '/tmp',
      sessions: new Map([['__default__', mockPage]]),
      defaultSessionId: '__default__',
    });

    // Simulate the engine processing the goto command — calls page.goto once
    vi.mocked(engineModule.runFlow).mockImplementation(async (_flowFile, page) => {
      await (page as Page).goto(gotoUrl, { waitUntil: 'load' });
      return { ...EMPTY_FLOW_RESULT, totalCommands: 1, passedCommands: 1 };
    });

    await runAll(['/flow.yaml'], BASE_OPTIONS);

    expect(mockPage.goto).toHaveBeenCalledOnce();
    expect(mockPage.goto).toHaveBeenCalledWith(gotoUrl, { waitUntil: 'load' });
  });
});

// ─── TC-3: FlowFile with baseUrl='' ──────────────────────────────────────────

describe("TC-3: FlowFile with baseUrl=''", () => {
  it('does not crash and page.goto is not called', async () => {
    const mockPage = makeMockPage();
    const mockBrowser = makeMockBrowser(mockPage);
    const initialPage = makeMockPage();

    vi.mocked(browserModule.launchBrowser).mockResolvedValue({
      browser: mockBrowser,
      page: initialPage,
    });
    vi.mocked(browserModule.closeBrowser).mockResolvedValue(undefined);
    vi.mocked(parserModule.loadAndParse).mockReturnValue(
      makeFlowFile({
        baseUrl: '',
        commands: [],
      }),
    );
    vi.mocked(contextModule.createContext).mockReturnValue({
      lastTappedLocator: null,
      callStack: new Set(),
      indentLevel: 0,
      runDir: '/tmp',
      sessions: new Map([['__default__', mockPage]]),
      defaultSessionId: '__default__',
    });
    vi.mocked(engineModule.runFlow).mockResolvedValue(EMPTY_FLOW_RESULT);

    await expect(runAll(['/flow.yaml'], BASE_OPTIONS)).resolves.not.toThrow();
    expect(mockPage.goto).not.toHaveBeenCalled();
  });
});
