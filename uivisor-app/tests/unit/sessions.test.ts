/**
 * tests/unit/sessions.test.ts
 *
 * Parser unit tests for the multi-session feature.
 * Covers AC-1 through AC-12 (parser and context layer).
 *
 * Reader is mocked so every test exercises pure TypeScript logic with no I/O,
 * except AC-12 which writes a real temp file to verify circular-reference detection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Page, Browser } from 'playwright';
import type { RunContext } from '../../src/types';

// Hoist mock before any module imports so Vitest replaces the real module.
vi.mock('../../src/parser/reader');

import { loadAndParse } from '../../src/parser/index';
import { createContext } from '../../src/engine/context';
import { createSessionPages } from '../../src/driver/browser';
import { dispatch } from '../../src/engine/dispatcher';
import * as reader from '../../src/parser/reader';

const mockReadYamlFile = vi.mocked(reader.readYamlFile);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── AC-1: Legacy pass-through ─────────────────────────────────────────────────

describe('AC-1: legacy flow (no sessions: key)', () => {
  it('result.sessions deep-equals [] when sessions key is absent', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://test',
      commands: [{ goto: 'http://test' }],
    });
    const result = loadAndParse('/flow.yaml');
    expect(result.sessions).toEqual([]);
  });

  it('createContext with __default__ → sessions.size === 1 and correct defaultSessionId', () => {
    const mockPage = {} as unknown as Page;
    const ctx = createContext('/tmp/run', new Map([['__default__', mockPage]]), '__default__');
    expect(ctx.sessions.size).toBe(1);
    expect(ctx.defaultSessionId).toBe('__default__');
    expect(ctx.sessions.get('__default__')).toBe(mockPage);
  });
});

// ─── AC-2: createSessionPages unit portion ─────────────────────────────────────

describe('AC-2: createSessionPages (unit) — mock browser.newPage', () => {
  it('returned Map has size 2 and both keys present', async () => {
    const mockPageA = { id: 'page-alice' } as unknown as Page;
    const mockPageB = { id: 'page-bob' } as unknown as Page;
    const mockBrowser = {
      newPage: vi.fn()
        .mockResolvedValueOnce(mockPageA)
        .mockResolvedValueOnce(mockPageB),
    } as unknown as Browser;

    const result = await createSessionPages(mockBrowser, ['alice', 'bob']);
    expect(result.size).toBe(2);
    expect(result.has('alice')).toBe(true);
    expect(result.has('bob')).toBe(true);
    expect(result.get('alice')).toBe(mockPageA);
    expect(result.get('bob')).toBe(mockPageB);
  });
});

// ─── AC-6: Unknown session reference ────────────────────────────────────────────

describe('AC-6: unknown session reference in command', () => {
  it('throws mentioning the unknown id', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://test',
      sessions: [{ id: 'alice' }],
      commands: [{ session: 'charlie', goto: 'http://test' }],
    });
    expect(() => loadAndParse('/flow.yaml')).toThrow(/charlie/);
  });

  it('throws mentioning the file path', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://test',
      sessions: [{ id: 'alice' }],
      commands: [{ session: 'charlie', goto: 'http://test' }],
    });
    let thrownMessage = '';
    try {
      loadAndParse('/my-flow.yaml');
    } catch (e) {
      thrownMessage = (e as Error).message;
    }
    expect(thrownMessage).toMatch(/charlie/);
    expect(thrownMessage).toMatch(/my-flow\.yaml/);
  });
});

// ─── AC-7: session: without sessions block ──────────────────────────────────────

describe('AC-7: session: field without sessions block', () => {
  it('throws when a command has session: but no sessions block is declared', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://test',
      commands: [{ session: 'alice', goto: 'http://test' }],
    });
    expect(() => loadAndParse('/flow.yaml')).toThrow(/no sessions/i);
  });
});

// ─── AC-8: Duplicate session ids ────────────────────────────────────────────────

describe('AC-8: duplicate session ids', () => {
  it('throws for adjacent duplicate [alice, alice], mentioning "alice"', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://test',
      sessions: [{ id: 'alice' }, { id: 'alice' }],
      commands: [{ goto: 'http://test' }],
    });
    expect(() => loadAndParse('/flow.yaml')).toThrow(/alice/);
  });

  it('throws for non-adjacent duplicate [alice, bob, alice], mentioning "alice"', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://test',
      sessions: [{ id: 'alice' }, { id: 'bob' }, { id: 'alice' }],
      commands: [{ goto: 'http://test' }],
    });
    expect(() => loadAndParse('/flow.yaml')).toThrow(/alice/);
  });
});

// ─── AC-9: Empty / null sessions ────────────────────────────────────────────────

describe('AC-9: sessions array edge cases', () => {
  it('sessions: [] (empty array) throws', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://test',
      sessions: [],
      commands: [{ goto: 'http://test' }],
    });
    expect(() => loadAndParse('/flow.yaml')).toThrow(/empty/i);
  });

  it('sessions: null does NOT throw and result.sessions is []', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://test',
      sessions: null,
      commands: [{ goto: 'http://test' }],
    });
    expect(() => loadAndParse('/flow.yaml')).not.toThrow();
    const result = loadAndParse('/flow.yaml');
    expect(result.sessions).toEqual([]);
  });
});

// ─── AC-10: Session id character validation ─────────────────────────────────────

describe('AC-10: session id validation', () => {
  /** Helper: mock reader and return a thunk that calls loadAndParse */
  function parse(sessions: unknown[]) {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://test',
      sessions,
      commands: [{ goto: 'http://test' }],
    });
    return () => loadAndParse('/flow.yaml');
  }

  it('space in id (ali ce) throws', () => {
    expect(parse([{ id: 'ali ce' }])).toThrow();
  });

  it('dot in id (ali.ce) throws', () => {
    expect(parse([{ id: 'ali.ce' }])).toThrow();
  });

  it('slash in id (ali/ce) throws', () => {
    expect(parse([{ id: 'ali/ce' }])).toThrow();
  });

  it('@ in id throws', () => {
    expect(parse([{ id: 'ali@ce' }])).toThrow();
  });

  it('unicode character in id (alïce) throws', () => {
    expect(parse([{ id: 'alïce' }])).toThrow();
  });

  it('empty string id throws', () => {
    expect(parse([{ id: '' }])).toThrow();
  });

  it('numeric id "42" is valid', () => {
    expect(parse([{ id: '42' }])).not.toThrow();
  });

  it('alphanumeric+hyphen+underscore "my-session_1" is valid', () => {
    expect(parse([{ id: 'my-session_1' }])).not.toThrow();
  });

  it('reserved id "__default__" throws', () => {
    expect(parse([{ id: '__default__' }])).toThrow(/__default__/);
  });

  it('65-character id throws', () => {
    expect(parse([{ id: 'a'.repeat(65) }])).toThrow(/exceed/i);
  });

  it('64-character id is valid', () => {
    expect(parse([{ id: 'a'.repeat(64) }])).not.toThrow();
  });
});

// ─── AC-11: label is optional ───────────────────────────────────────────────────

describe('AC-11: label is optional on session definitions', () => {
  it('{id: alice} is valid and sessions[0].label is undefined', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://test',
      sessions: [{ id: 'alice' }],
      commands: [{ goto: 'http://test' }],
    });
    const result = loadAndParse('/flow.yaml');
    expect(result.sessions[0].id).toBe('alice');
    expect(result.sessions[0].label).toBeUndefined();
  });

  it('{id: alice, label: "Alice\'s Browser"} is valid and label is preserved', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://test',
      sessions: [{ id: 'alice', label: "Alice's Browser" }],
      commands: [{ goto: 'http://test' }],
    });
    const result = loadAndParse('/flow.yaml');
    expect(result.sessions[0].label).toBe("Alice's Browser");
  });

  it('{label: primary} with no id field throws', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://test',
      sessions: [{ label: 'primary' }],
      commands: [{ goto: 'http://test' }],
    });
    expect(() => loadAndParse('/flow.yaml')).toThrow(/session id/i);
  });
});

// ─── AC-12: Circular reference detection ────────────────────────────────────────

describe('AC-12: circular flow reference via dispatch', () => {
  it('returns passed:false with circular message; defaultSessionId unchanged', async () => {
    // Write a real temp YAML file so existsSync passes
    const tmpFile = path.join(os.tmpdir(), `webt-circular-${Date.now()}.yaml`);
    fs.writeFileSync(
      tmpFile,
      `appId: http://test\ncommands:\n  - goto: http://test\n`,
      'utf8',
    );

    const absPath = path.resolve(tmpFile);
    const mockPage = {} as unknown as Page;
    const ctx: RunContext = {
      lastTappedLocator: null,
      // Pre-populate callStack with the file we're about to run
      callStack: new Set([absPath]),
      indentLevel: 0,
      runDir: os.tmpdir(),
      sessions: new Map([['__default__', mockPage]]),
      defaultSessionId: '__default__',
    };

    try {
      const result = await dispatch(
        mockPage,
        { type: 'runFlow', path: tmpFile },
        ctx,
        'parent',
        path.dirname(tmpFile),
      );
      expect(result.passed).toBe(false);
      expect(result.message).toMatch(/circular.*flow|circular.*reference/i);
      // defaultSessionId must not have been mutated
      expect(ctx.defaultSessionId).toBe('__default__');
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});
