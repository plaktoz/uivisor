/**
 * tests/unit/parser.test.ts
 *
 * Unit tests for the YAML DSL Layer.
 * Covers ACs 1–6: parsing, header validation, command parsing, selector parsing.
 *
 * External dependencies (fs, js-yaml) are isolated by mocking src/parser/reader so
 * every test below exercises pure TypeScript logic with no I/O.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoist mock before any module imports so Vitest replaces the real module.
vi.mock('../../src/parser/reader');

import { validateHeader, validateCommandList, validateVars } from '../../src/parser/validator';
import { flattenVars, resolveRef, interpolateValue, interpolateObject, loadConfigFile } from '../../src/parser/interpolate';
import { parseSelector } from '@uivisor/core';
import { parseCommand } from '../../src/parser/commandParser';
import { loadAndParse } from '../../src/parser/index';
import * as reader from '../../src/parser/reader';

// ─── validateHeader ──────────────────────────────────────────────────────────

describe('validateHeader', () => {
  // AC1: appId header is accepted
  it('accepts a header with appId key', () => {
    expect(() => validateHeader({ appId: 'http://localhost:3000' })).not.toThrow();
  });

  // AC2: url is a valid alias for appId
  it('accepts a header with url key (alias for appId)', () => {
    expect(() => validateHeader({ url: 'http://localhost:3000' })).not.toThrow();
  });

  // AC3: any other top-level key is rejected with an informative error
  it('throws on an unrecognized header key, naming the bad key', () => {
    expect(() => validateHeader({ baseUrl: 'http://localhost:3000' })).toThrow(
      /baseUrl|unrecognized|unknown/i,
    );
  });

  it('throws on a header with no recognized key', () => {
    expect(() => validateHeader({ endpoint: 'http://localhost:3000' })).toThrow(
      /endpoint|unrecognized|unknown/i,
    );
  });

  it('returns the base URL string for an appId header', () => {
    const result = validateHeader({ appId: 'http://example.com' });
    expect(result).toBe('http://example.com');
  });

  it('returns the base URL string for a url header', () => {
    const result = validateHeader({ url: 'http://example.com' });
    expect(result).toBe('http://example.com');
  });
});

// ─── validateCommandList ─────────────────────────────────────────────────────

describe('validateCommandList', () => {
  // AC5: empty list → explicit error message
  it('throws "No commands found in flow." for an empty array', () => {
    expect(() => validateCommandList([])).toThrow('No commands found in flow.');
  });

  it('does not throw for a non-empty list', () => {
    expect(() =>
      validateCommandList([{ goto: 'http://localhost' }]),
    ).not.toThrow();
  });

  it('does not throw for a list with multiple commands', () => {
    expect(() =>
      validateCommandList([
        { goto: 'http://localhost' },
        { tapOn: 'Sign In' },
        { assertVisible: 'Welcome' },
      ]),
    ).not.toThrow();
  });
});

// ─── parseSelector ───────────────────────────────────────────────────────────

describe('parseSelector', () => {
  // shorthand string passthrough
  it('returns the string as-is for a shorthand text selector', () => {
    expect(parseSelector('Sign In')).toBe('Sign In');
  });

  // explicit text object
  it('returns { text } for an explicit text selector', () => {
    expect(parseSelector({ text: 'Sign In' })).toEqual({ text: 'Sign In' });
  });

  // role + name
  it('returns { role, name } for a role+name selector', () => {
    expect(parseSelector({ role: 'button', name: 'Submit' })).toEqual({
      role: 'button',
      name: 'Submit',
    });
  });

  // label
  it('returns { label } for a label selector', () => {
    expect(parseSelector({ label: 'Email' })).toEqual({ label: 'Email' });
  });

  // placeholder
  it('returns { placeholder } for a placeholder selector', () => {
    expect(parseSelector({ placeholder: 'Enter email' })).toEqual({
      placeholder: 'Enter email',
    });
  });

  // testId
  it('returns { testId } for a testId selector', () => {
    expect(parseSelector({ testId: 'submit-btn' })).toEqual({ testId: 'submit-btn' });
  });

  // AC34: unrecognized key
  it('throws on an unrecognized selector key', () => {
    expect(() => parseSelector({ dataAttr: 'foo' } as never)).toThrow(
      /unrecognized|unknown/i,
    );
  });

  it('throws on a selector object with multiple unrecognized keys', () => {
    expect(() => parseSelector({ xpath: '//div', css: '.foo' } as never)).toThrow(
      /unrecognized|unknown/i,
    );
  });
});

// ─── parseCommand ────────────────────────────────────────────────────────────

describe('parseCommand', () => {
  // goto
  it('parses { goto: url } → goto Command', () => {
    expect(parseCommand({ goto: 'https://example.com' })).toEqual({
      type: 'goto',
      url: 'https://example.com',
    });
  });

  // tapOn with string selector
  it('parses { tapOn: string } → tapOn Command with string selector', () => {
    expect(parseCommand({ tapOn: 'Sign In' })).toEqual({
      type: 'tapOn',
      selector: 'Sign In',
    });
  });

  // tapOn with role+name object
  it('parses { tapOn: { role, name } } → tapOn Command with role selector', () => {
    expect(parseCommand({ tapOn: { role: 'button', name: 'Submit' } })).toEqual({
      type: 'tapOn',
      selector: { role: 'button', name: 'Submit' },
    });
  });

  // tapOn with label selector
  it('parses { tapOn: { label } } → tapOn Command with label selector', () => {
    expect(parseCommand({ tapOn: { label: 'Email' } })).toEqual({
      type: 'tapOn',
      selector: { label: 'Email' },
    });
  });

  // inputText shorthand
  it('parses { inputText: string } → shorthand inputText Command', () => {
    expect(parseCommand({ inputText: 'user@example.com' })).toEqual({
      type: 'inputText',
      text: 'user@example.com',
    });
  });

  // inputText targeted form
  it('parses { inputText: { element, text } } → inputTextTargeted Command', () => {
    expect(
      parseCommand({ inputText: { element: 'Email', text: 'user@example.com' } }),
    ).toEqual({
      type: 'inputTextTargeted',
      element: 'Email',
      text: 'user@example.com',
    });
  });

  // inputText targeted with object selector
  it('parses { inputText: { element: { label }, text } } → inputTextTargeted with label selector', () => {
    expect(
      parseCommand({ inputText: { element: { label: 'Email' }, text: 'hi' } }),
    ).toEqual({
      type: 'inputTextTargeted',
      element: { label: 'Email' },
      text: 'hi',
    });
  });

  // assertVisible
  it('parses { assertVisible: selector } → assertVisible Command', () => {
    expect(parseCommand({ assertVisible: 'Welcome, user' })).toEqual({
      type: 'assertVisible',
      selector: 'Welcome, user',
    });
  });

  // assertNotVisible
  it('parses { assertNotVisible: selector } → assertNotVisible Command', () => {
    expect(parseCommand({ assertNotVisible: 'Error message' })).toEqual({
      type: 'assertNotVisible',
      selector: 'Error message',
    });
  });

  // wait with valid integer
  it('parses { wait: 500 } → wait Command with ms: 500', () => {
    expect(parseCommand({ wait: 500 })).toEqual({ type: 'wait', ms: 500 });
  });

  // AC21: wait with non-integer string → type error
  it('AC21: throws a type error for { wait: "500ms" }', () => {
    expect(() => parseCommand({ wait: '500ms' })).toThrow(
      /type error|not.*integer|must be.*number|invalid.*wait/i,
    );
  });

  // AC21: wait with float → type error
  it('AC21: throws a type error for a float wait value', () => {
    expect(() => parseCommand({ wait: 1.5 })).toThrow(
      /type error|not.*integer|must be.*integer|invalid.*wait/i,
    );
  });

  // scroll: valid directions
  it('parses { scroll: "down" } → scroll Command with direction: "down"', () => {
    expect(parseCommand({ scroll: 'down' })).toEqual({ type: 'scroll', direction: 'down' });
  });

  it('parses { scroll: "up" } → scroll Command with direction: "up"', () => {
    expect(parseCommand({ scroll: 'up' })).toEqual({ type: 'scroll', direction: 'up' });
  });

  it('parses { scroll: "left" } → scroll Command', () => {
    expect(parseCommand({ scroll: 'left' })).toEqual({ type: 'scroll', direction: 'left' });
  });

  it('parses { scroll: "right" } → scroll Command', () => {
    expect(parseCommand({ scroll: 'right' })).toEqual({ type: 'scroll', direction: 'right' });
  });

  // AC24: invalid scroll direction
  it('AC24: throws "Invalid scroll direction: diagonal" for invalid direction', () => {
    expect(() => parseCommand({ scroll: 'diagonal' })).toThrow(
      'Invalid scroll direction: diagonal',
    );
  });

  // runFlow
  it('parses { runFlow: path } → runFlow Command', () => {
    expect(parseCommand({ runFlow: './sub-flow.yaml' })).toEqual({
      type: 'runFlow',
      path: './sub-flow.yaml',
    });
  });

  // AC6: unknown command name
  it('AC6: throws an error that identifies the unknown command name', () => {
    expect(() => parseCommand({ unknownCmd: 'value' })).toThrow(
      /unknown.*command|unrecognized.*command|unknownCmd/i,
    );
  });

  it('AC6: error message for unknown command includes the bad command name', () => {
    expect(() => parseCommand({ clickElement: '#id' })).toThrow(
      /clickElement|unknown|unrecognized/i,
    );
  });
});

// ─── loadAndParse (integration of reader + validator + parsers) ───────────────

describe('loadAndParse', () => {
  const mockReadYamlFile = vi.mocked(reader.readYamlFile);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC1: valid YAML with appId → complete FlowFile
  it('AC1: returns a FlowFile for a valid flow with appId header', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://localhost:3000',
      commands: [{ goto: 'http://localhost:3000' }, { assertVisible: 'Hello' }],
    });

    const result = loadAndParse('/flows/login.yaml');

    expect(result).toMatchObject({
      baseUrl: 'http://localhost:3000',
      filePath: '/flows/login.yaml',
      commands: [
        { command: { type: 'goto', url: 'http://localhost:3000' } },
        { command: { type: 'assertVisible', selector: 'Hello' } },
      ],
    });
  });

  // AC2: url header is treated identically to appId
  it('AC2: accepts url header as alias for appId', () => {
    mockReadYamlFile.mockReturnValue({
      url: 'http://localhost:3000',
      commands: [{ goto: 'http://localhost:3000' }],
    });

    const result = loadAndParse('/flows/flow.yaml');
    expect(result.baseUrl).toBe('http://localhost:3000');
  });

  // AC3: unknown header key → non-zero exit (throws)
  it('AC3: throws an error naming the unrecognized header key', () => {
    mockReadYamlFile.mockReturnValue({
      baseUrl: 'http://localhost:3000',
      commands: [{ goto: 'http://localhost:3000' }],
    });

    expect(() => loadAndParse('/flows/flow.yaml')).toThrow(
      /baseUrl|unrecognized|unknown/i,
    );
  });

  // AC4: invalid YAML syntax → error with file path + line number
  it('AC4: propagates a YAML parse error that includes the file path', () => {
    const yamlErr = Object.assign(new Error('bad YAML at line 5'), {
      name: 'YAMLException',
      mark: { line: 5, column: 2 },
    });
    mockReadYamlFile.mockImplementation(() => { throw yamlErr; });

    expect(() => loadAndParse('/flows/broken.yaml')).toThrow(
      /line 5|broken\.yaml/i,
    );
  });

  // AC5: empty command list
  it('AC5: throws "No commands found in flow." when command list is empty', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://localhost:3000',
      commands: [],
    });

    expect(() => loadAndParse('/flows/empty.yaml')).toThrow(
      'No commands found in flow.',
    );
  });

  // AC6: unknown command in list
  it('AC6: throws an error identifying the unknown command name', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://localhost:3000',
      commands: [{ goto: 'http://localhost' }, { clickElement: '#btn' }],
    });

    expect(() => loadAndParse('/flows/flow.yaml')).toThrow(
      /clickElement|unknown|unrecognized/i,
    );
  });

  // ── tags field ─────────────────────────────────────────────────────────────

  // AC1 (tag): tags list is returned on FlowFile
  it('AC-tag-1: returns tags array when tags are specified', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://localhost:3000',
      tags: ['smoke', 'auth'],
      commands: [{ goto: 'http://localhost:3000' }],
    });

    const result = loadAndParse('/flows/login.yaml');
    expect(result.tags).toEqual(['smoke', 'auth']);
  });

  // AC2 (tag): missing tags → empty array (not undefined)
  it('AC-tag-2: defaults tags to [] when not specified', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://localhost:3000',
      commands: [{ goto: 'http://localhost:3000' }],
    });

    const result = loadAndParse('/flows/login.yaml');
    expect(result.tags).toEqual([]);
  });

  // AC6 (tag): tags is not a list → parse error
  it('AC-tag-6a: throws when tags is a string instead of an array', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://localhost:3000',
      tags: 'smoke',
      commands: [{ goto: 'http://localhost:3000' }],
    });

    expect(() => loadAndParse('/flows/login.yaml')).toThrow(
      /tags.*array|invalid.*tags/i,
    );
  });

  it('AC-tag-6b: throws when tags contains a whitespace-only entry', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://localhost:3000',
      tags: ['smoke', '   '],
      commands: [{ goto: 'http://localhost:3000' }],
    });

    expect(() => loadAndParse('/flows/login.yaml')).toThrow(
      /tags.*empty|whitespace.*tag|invalid.*tag/i,
    );
  });

  it('AC-tag-6c: throws when a tag entry is not a string', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://localhost:3000',
      tags: [42],
      commands: [{ goto: 'http://localhost:3000' }],
    });

    expect(() => loadAndParse('/flows/login.yaml')).toThrow(
      /tags.*string|invalid.*tag/i,
    );
  });

  // ── shared field ────────────────────────────────────────────────────────────

  // AC8: shared: true → FlowFile.shared is true
  it('AC-shared-8: returns shared: true when specified', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://localhost:3000',
      shared: true,
      commands: [{ goto: 'http://localhost:3000' }],
    });

    const result = loadAndParse('/flows/shared-login.yaml');
    expect(result.shared).toBe(true);
  });

  // AC9: shared: false → FlowFile.shared is false
  it('AC-shared-9a: returns shared: false when explicitly set to false', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://localhost:3000',
      shared: false,
      commands: [{ goto: 'http://localhost:3000' }],
    });

    const result = loadAndParse('/flows/flow.yaml');
    expect(result.shared).toBe(false);
  });

  it('AC-shared-9b: defaults shared to false when not specified', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://localhost:3000',
      commands: [{ goto: 'http://localhost:3000' }],
    });

    const result = loadAndParse('/flows/flow.yaml');
    expect(result.shared).toBe(false);
  });

  // AC13: shared is not a boolean → parse error
  it('AC-shared-13: throws when shared is a string instead of boolean', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://localhost:3000',
      shared: 'yes',
      commands: [{ goto: 'http://localhost:3000' }],
    });

    expect(() => loadAndParse('/flows/flow.yaml')).toThrow(
      /shared.*boolean|invalid.*shared/i,
    );
  });

  // All 9 command types round-trip correctly
  it('correctly parses all 9 command types', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://localhost',
      commands: [
        { goto: 'http://localhost' },
        { tapOn: 'Sign In' },
        { inputText: 'hello' },
        { inputText: { element: 'Email', text: 'a@b.com' } },
        { assertVisible: 'Welcome' },
        { assertNotVisible: 'Error' },
        { wait: 100 },
        { runFlow: './sub.yaml' },
        { scroll: 'down' },
      ],
    });

    const { commands } = loadAndParse('/flows/all.yaml');
    expect(commands.map((c) => c.command.type)).toEqual([
      'goto',
      'tapOn',
      'inputText',
      'inputTextTargeted',
      'assertVisible',
      'assertNotVisible',
      'wait',
      'runFlow',
      'scroll',
    ]);
  });
});

// ─── parseCommand — interaction commands (ACs 19–28) ─────────────────────────

describe('parseCommand — interaction commands', () => {
  // AC19: pressKey with "Enter"
  it('AC19: parses { pressKey: "Enter" } → { type: "pressKey", key: "Enter" }', () => {
    expect(parseCommand({ pressKey: 'Enter' })).toEqual({ type: 'pressKey', key: 'Enter' });
  });

  // AC20: pressKey with "ArrowDown"
  it('AC20: parses { pressKey: "ArrowDown" } → { type: "pressKey", key: "ArrowDown" }', () => {
    expect(parseCommand({ pressKey: 'ArrowDown' })).toEqual({
      type: 'pressKey',
      key: 'ArrowDown',
    });
  });

  // AC21: selectOption with testId + value
  it('AC21: parses selectOption with testId + value — extracts value before parseSelector', () => {
    expect(
      parseCommand({ selectOption: { testId: 'country-select', value: 'sg' } }),
    ).toEqual({
      type: 'selectOption',
      selector: { testId: 'country-select' },
      value: 'sg',
    });
  });

  // AC22: selectOption with placeholder + value
  it('AC22: parses selectOption with placeholder + value', () => {
    expect(
      parseCommand({ selectOption: { placeholder: 'Choose…', value: 'my' } }),
    ).toEqual({
      type: 'selectOption',
      selector: { placeholder: 'Choose…' },
      value: 'my',
    });
  });

  // AC23: check with testId object
  it('AC23: parses { check: { testId } } → { type: "check", selector: { testId } }', () => {
    expect(parseCommand({ check: { testId: 'terms' } })).toEqual({
      type: 'check',
      selector: { testId: 'terms' },
    });
  });

  // AC24: check with string shorthand
  it('AC24: parses { check: "Accept terms" } → { type: "check", selector: "Accept terms" }', () => {
    expect(parseCommand({ check: 'Accept terms' })).toEqual({
      type: 'check',
      selector: 'Accept terms',
    });
  });

  // AC25: uncheck with testId object
  it('AC25: parses { uncheck: { testId } } → { type: "uncheck", selector: { testId } }', () => {
    expect(parseCommand({ uncheck: { testId: 'newsletter' } })).toEqual({
      type: 'uncheck',
      selector: { testId: 'newsletter' },
    });
  });

  // AC26: hover with role+name
  it('AC26: parses { hover: { role, name } } → { type: "hover", selector: { role, name } }', () => {
    expect(parseCommand({ hover: { role: 'button', name: 'Submit' } })).toEqual({
      type: 'hover',
      selector: { role: 'button', name: 'Submit' },
    });
  });

  // AC27: doubleClick with string shorthand
  it('AC27: parses { doubleClick: "Sign In" } → { type: "doubleClick", selector: "Sign In" }', () => {
    expect(parseCommand({ doubleClick: 'Sign In' })).toEqual({
      type: 'doubleClick',
      selector: 'Sign In',
    });
  });

  // AC28: clearText with placeholder selector
  it('AC28: parses { clearText: { placeholder } } → { type: "clearText", selector: { placeholder } }', () => {
    expect(parseCommand({ clearText: { placeholder: 'Enter email' } })).toEqual({
      type: 'clearText',
      selector: { placeholder: 'Enter email' },
    });
  });
});

// ─── parseCommand — page control & utilities (ACs 13–25) ─────────────────────

describe('parseCommand — page control & utilities', () => {
  // AC13: reload with null value
  it('AC13: parses { reload: null } → { type: "reload" }', () => {
    expect(parseCommand({ reload: null })).toEqual({ type: 'reload' });
  });

  // AC14: goBack with null value
  it('AC14: parses { goBack: null } → { type: "goBack" }', () => {
    expect(parseCommand({ goBack: null })).toEqual({ type: 'goBack' });
  });

  // AC15: goForward with null value
  it('AC15: parses { goForward: null } → { type: "goForward" }', () => {
    expect(parseCommand({ goForward: null })).toEqual({ type: 'goForward' });
  });

  // AC16: setViewport mobile preset
  it('AC16: parses setViewport "mobile" → { type: "setViewport", width: 390, height: 844 }', () => {
    expect(parseCommand({ setViewport: 'mobile' })).toEqual({
      type: 'setViewport',
      width: 390,
      height: 844,
    });
  });

  // AC17: setViewport tablet preset
  it('AC17: parses setViewport "tablet" → { type: "setViewport", width: 768, height: 1024 }', () => {
    expect(parseCommand({ setViewport: 'tablet' })).toEqual({
      type: 'setViewport',
      width: 768,
      height: 1024,
    });
  });

  // AC18: setViewport desktop preset
  it('AC18: parses setViewport "desktop" → { type: "setViewport", width: 1280, height: 800 }', () => {
    expect(parseCommand({ setViewport: 'desktop' })).toEqual({
      type: 'setViewport',
      width: 1280,
      height: 800,
    });
  });

  // AC19: setViewport explicit dimensions
  it('AC19: parses setViewport { width, height } → resolved setViewport command', () => {
    expect(parseCommand({ setViewport: { width: 1920, height: 1080 } })).toEqual({
      type: 'setViewport',
      width: 1920,
      height: 1080,
    });
  });

  // AC20: setViewport unknown preset throws
  it('AC20: throws on unknown setViewport preset string', () => {
    expect(() => parseCommand({ setViewport: 'ultrawide' })).toThrow(/Unknown viewport preset/i);
  });

  // AC21: setViewport with non-positive width throws
  it('AC21: throws when setViewport width is 0', () => {
    expect(() => parseCommand({ setViewport: { width: 0, height: 720 } })).toThrow(
      /positive integers/i,
    );
  });

  // AC22: screenshot plain string
  it('AC22: parses { screenshot: "step1.png" } → { type: "screenshot", path: "step1.png" }', () => {
    expect(parseCommand({ screenshot: 'step1.png' })).toEqual({
      type: 'screenshot',
      path: 'step1.png',
    });
  });

  // AC23: waitFor integer ms
  it('AC23: parses { waitFor: 3000 } → { type: "waitFor", ms: 3000 }', () => {
    expect(parseCommand({ waitFor: 3000 })).toEqual({ type: 'waitFor', ms: 3000 });
  });

  // AC24: waitFor another integer
  it('AC24: parses { waitFor: 500 } → { type: "waitFor", ms: 500 }', () => {
    expect(parseCommand({ waitFor: 500 })).toEqual({ type: 'waitFor', ms: 500 });
  });

  // AC25: waitFor zero throws
  it('AC25: throws when waitFor value is 0', () => {
    expect(() => parseCommand({ waitFor: 0 })).toThrow(/positive integer/i);
  });

  // AC25 extra: waitFor float throws
  it('AC25b: throws when waitFor value is a float', () => {
    expect(() => parseCommand({ waitFor: 1.5 })).toThrow(/positive integer/i);
  });
});

// ─── variable interpolation ───────────────────────────────────────────────────

describe('variable interpolation', () => {

  // ── flattenVars (TC-001 to TC-020) ──────────────────────────────────────────

  describe('flattenVars', () => {
    // TC-001: single flat key
    it('TC-001: returns a flat map for a single string value', () => {
      expect(flattenVars({ greeting: 'hello' })).toEqual({ greeting: 'hello' });
    });

    // TC-002: empty object
    it('TC-002: returns {} for an empty object', () => {
      expect(flattenVars({})).toEqual({});
    });

    // TC-003: multiple flat keys
    it('TC-003: returns all keys for multiple flat string values', () => {
      expect(flattenVars({ a: '1', b: '2' })).toEqual({ a: '1', b: '2' });
    });

    // TC-004: integer leaf → coerced to string
    it('TC-004: coerces integer leaf to string', () => {
      expect(flattenVars({ port: 5173 })).toEqual({ port: '5173' });
    });

    // TC-005: boolean true leaf → "true"
    it('TC-005: coerces boolean true to "true"', () => {
      expect(flattenVars({ flag: true })).toEqual({ flag: 'true' });
    });

    // TC-006: null leaf → "null"
    it('TC-006: coerces null to "null"', () => {
      expect(flattenVars({ key: null })).toEqual({ key: 'null' });
    });

    // TC-007: boolean false → "false"
    it('TC-007: coerces boolean false to "false"', () => {
      expect(flattenVars({ enabled: false })).toEqual({ enabled: 'false' });
    });

    // TC-008: float leaf → coerced to string
    it('TC-008: coerces float to string', () => {
      expect(flattenVars({ ratio: 1.5 })).toEqual({ ratio: '1.5' });
    });

    // TC-009: single nested object
    it('TC-009: flattens a single nested object to a dotted key', () => {
      expect(flattenVars({ db: { host: 'localhost' } })).toEqual({ 'db.host': 'localhost' });
    });

    // TC-010: triple nesting
    it('TC-010: flattens triple-nested object to triple-dotted key', () => {
      expect(flattenVars({ a: { b: { c: 'deep' } } })).toEqual({ 'a.b.c': 'deep' });
    });

    // TC-011: mix of flat and nested
    it('TC-011: handles a mix of flat and nested keys', () => {
      expect(flattenVars({ x: 'flat', y: { z: 'nested' } })).toEqual({
        x: 'flat',
        'y.z': 'nested',
      });
    });

    // TC-012: multiple top-level nested groups
    it('TC-012: flattens multiple top-level nested groups', () => {
      expect(
        flattenVars({ server: { host: 'localhost', port: '3000' }, db: { name: 'mydb' } }),
      ).toEqual({ 'server.host': 'localhost', 'server.port': '3000', 'db.name': 'mydb' });
    });

    // TC-013: flat key containing a literal dot → kept as-is
    it('TC-013: accepts a literal dotted key (not treated as nested)', () => {
      expect(flattenVars({ 'a.b': 'value' })).toEqual({ 'a.b': 'value' });
    });

    // TC-014: empty string key → parse error
    it('TC-014: throws on an empty-string key', () => {
      expect(() => flattenVars({ '': 'x' })).toThrow(/invalid.*variable.*name|empty/i);
    });

    // TC-015: lone dot key → parse error
    it('TC-015: throws on a lone-dot key', () => {
      expect(() => flattenVars({ '.': 'x' })).toThrow(/invalid.*variable.*name/i);
    });

    // TC-016: key starting with a digit → parse error
    it('TC-016: throws when key starts with a digit', () => {
      expect(() => flattenVars({ '3invalid': 'x' })).toThrow(/invalid.*variable.*name/i);
    });

    // TC-017: reserved name "env"
    it('TC-017: throws on reserved name "env"', () => {
      expect(() => flattenVars({ env: 'x' })).toThrow(/reserved.*variable.*name|reserved/i);
    });

    // TC-018: nested under "env" → produces env.* key → parse error
    it('TC-018: throws on a nested object under "env" (produces env.* key)', () => {
      expect(() => flattenVars({ env: { MY_VAR: 'x' } })).toThrow(/reserved/i);
    });

    // TC-019: literal "a.b" key + nested a: { b: ... } → duplicate key error
    it('TC-019: throws on duplicate dotted key from literal key and nested path', () => {
      expect(() => flattenVars({ 'a.b': 'x', a: { b: 'y' } })).toThrow(
        /duplicate.*variable.*key|duplicate/i,
      );
    });

    // TC-020: array leaf → parse error
    it('TC-020: throws when a leaf value is an array', () => {
      expect(() => flattenVars({ list: ['a', 'b'] })).toThrow(
        /array.*not.*allowed|invalid.*variable.*value/i,
      );
    });
  });

  // ── resolveRef (TC-021 to TC-035) ───────────────────────────────────────────

  describe('resolveRef', () => {
    // TC-021: known var → its value
    it('TC-021: returns the var value when the key exists', () => {
      expect(resolveRef('greeting', { greeting: 'hello' })).toBe('hello');
    });

    // TC-022: unknown var, no default → ""
    it('TC-022: returns "" for an unknown var with no default', () => {
      expect(resolveRef('missing', {})).toBe('');
    });

    // TC-023: unknown var with default → default
    it('TC-023: returns the default when the var is missing', () => {
      expect(resolveRef('key:default', {})).toBe('default');
    });

    // TC-024: known var with default → var value (not default)
    it('TC-024: returns the var value when present, ignoring the default', () => {
      expect(resolveRef('key:fallback', { key: 'value' })).toBe('value');
    });

    // TC-025: env var not in process.env → ""
    it('TC-025: returns "" for an env var not set in process.env', () => {
      const envKey = '__UIVISOR_TEST_UNSET_VAR__';
      delete process.env[envKey];
      expect(resolveRef(`env.${envKey}`, {})).toBe('');
    });

    // TC-026: env var in process.env → its value
    it('TC-026: reads an env var from process.env', () => {
      process.env['__UIVISOR_TEST_PORT__'] = '8080';
      try {
        expect(resolveRef('env.__UIVISOR_TEST_PORT__', {})).toBe('8080');
      } finally {
        delete process.env['__UIVISOR_TEST_PORT__'];
      }
    });

    // TC-027: env var not in process.env, with default → default
    it('TC-027: returns the default when env var is not set', () => {
      const envKey = '__UIVISOR_TEST_UNSET2__';
      delete process.env[envKey];
      expect(resolveRef(`env.${envKey}:3000`, {})).toBe('3000');
    });

    // TC-028: default contains a colon → only first colon splits; rest is literal default
    it('TC-028: treats additional colons in the default as literal', () => {
      expect(resolveRef('key:a:b', {})).toBe('a:b');
    });

    // TC-029: empty default ("foo:") → returns ""
    it('TC-029: returns "" for an empty default after the colon', () => {
      expect(resolveRef('foo:', {})).toBe('');
    });

    // TC-030: var present but empty → falls through to "" (no default)
    it('TC-030: returns "" when var value is empty string and no default', () => {
      expect(resolveRef('foo', { foo: '' })).toBe('');
    });

    // TC-031: var present but empty, with default → returns default
    it('TC-031: returns the default when var value is empty string', () => {
      expect(resolveRef('key:fallback', { key: '' })).toBe('fallback');
    });

    // TC-032: env var not set, no default → ""
    it('TC-032: returns "" for unset env var without default', () => {
      const envKey = '__UIVISOR_TEST_UNSET3__';
      delete process.env[envKey];
      expect(resolveRef(`env.${envKey}`, {})).toBe('');
    });

    // TC-033: env var set to empty string, no default → "" (empty triggers no fallback without default)
    it('TC-033: returns "" when env var is set to empty string and no default provided', () => {
      process.env['__UIVISOR_TEST_EMPTY__'] = '';
      try {
        expect(resolveRef('env.__UIVISOR_TEST_EMPTY__', {})).toBe('');
      } finally {
        delete process.env['__UIVISOR_TEST_EMPTY__'];
      }
    });

    // TC-034: default value containing ${other} is NOT re-expanded (no second pass)
    it('TC-034: default value is returned literally (not re-interpolated)', () => {
      expect(resolveRef('key:${other}', { other: 'x' })).toBe('${other}');
    });

    // TC-035: env. prefix always reads from process.env, not from vars
    it('TC-035: env.* prefix reads process.env even when vars has the key without env.', () => {
      process.env['__UIVISOR_TEST_HOST__'] = 'env-host';
      try {
        // vars has 'host' but env.host should read process.env.__UIVISOR_TEST_HOST__
        expect(resolveRef('env.__UIVISOR_TEST_HOST__', { '__UIVISOR_TEST_HOST__': 'var-host' })).toBe('env-host');
      } finally {
        delete process.env['__UIVISOR_TEST_HOST__'];
      }
    });
  });

  // ── interpolateValue (TC-036 to TC-042) ─────────────────────────────────────

  describe('interpolateValue', () => {
    // TC-036: plain string with no expressions → unchanged
    it('TC-036: returns a plain string unchanged', () => {
      expect(interpolateValue('hello', {})).toBe('hello');
    });

    // TC-037: single expression → resolved
    it('TC-037: replaces a single ${...} expression', () => {
      expect(interpolateValue('${greeting}', { greeting: 'hello' })).toBe('hello');
    });

    // TC-038: multiple expressions in one string → all replaced
    it('TC-038: replaces multiple ${...} expressions in order', () => {
      expect(interpolateValue('${a} and ${b}', { a: 'foo', b: 'bar' })).toBe('foo and bar');
    });

    // TC-039: expression embedded in surrounding text
    it('TC-039: preserves prefix and suffix around an expression', () => {
      expect(interpolateValue('prefix-${a}-suffix', { a: 'mid' })).toBe('prefix-mid-suffix');
    });

    // TC-040: missing var → resolves to ""
    it('TC-040: resolves a missing var to an empty string', () => {
      expect(interpolateValue('${missing}', {})).toBe('');
    });

    // TC-041: unclosed ${ → parse error
    it('TC-041: throws on an unclosed ${ expression', () => {
      expect(() => interpolateValue('text ${ unclosed', {})).toThrow(
        /unclosed.*\$\{|\$\{.*unclosed/i,
      );
    });

    // TC-042: no second pass — resolved value containing ${...} is not re-expanded
    it('TC-042: does not re-expand a resolved value that contains ${...}', () => {
      expect(interpolateValue('${a}', { a: '${b}', b: 'secret' })).toBe('${b}');
    });
  });

  // ── interpolateObject (TC-043 to TC-051) ────────────────────────────────────

  describe('interpolateObject', () => {
    // TC-043: string leaf → interpolated
    it('TC-043: interpolates a string value', () => {
      expect(interpolateObject('${x}', { x: 'hello' })).toBe('hello');
    });

    // TC-044: number leaf → passed through unchanged
    it('TC-044: passes a number through unchanged', () => {
      expect(interpolateObject(42, {})).toBe(42);
    });

    // TC-045: boolean leaf → passed through
    it('TC-045: passes a boolean through unchanged', () => {
      expect(interpolateObject(true, {})).toBe(true);
    });

    // TC-046: null → null
    it('TC-046: passes null through unchanged', () => {
      expect(interpolateObject(null, {})).toBeNull();
    });

    // TC-047: flat object → all string values interpolated
    it('TC-047: interpolates all string values in a flat object', () => {
      expect(interpolateObject({ a: '${x}', b: '${y}' }, { x: '1', y: '2' })).toEqual({
        a: '1',
        b: '2',
      });
    });

    // TC-048: nested object → deep interpolation
    it('TC-048: interpolates string values in a nested object', () => {
      expect(
        interpolateObject({ outer: { inner: '${val}' } }, { val: 'deep' }),
      ).toEqual({ outer: { inner: 'deep' } });
    });

    // TC-049: array of strings → all interpolated
    it('TC-049: interpolates all string elements in an array', () => {
      expect(interpolateObject(['${a}', '${b}', 'plain'], { a: 'x', b: 'y' })).toEqual([
        'x',
        'y',
        'plain',
      ]);
    });

    // TC-050: never mutates the input object
    it('TC-050: does not mutate the input object', () => {
      const input = { url: '${host}/path' };
      interpolateObject(input, { host: 'http://example.com' });
      expect(input.url).toBe('${host}/path');
    });

    // TC-051: mixed types in an array — only strings interpolated
    it('TC-051: interpolates strings but leaves other types unchanged in mixed array', () => {
      expect(interpolateObject(['${x}', 99, false, null], { x: 'hello' })).toEqual([
        'hello',
        99,
        false,
        null,
      ]);
    });
  });

  // ── loadConfigFile (TC-052 to TC-060, minus TC-057 and TC-058) ─────────────

  describe('loadConfigFile', () => {
    const mockReadYamlFile = vi.mocked(reader.readYamlFile);

    beforeEach(() => {
      vi.clearAllMocks();
    });

    // TC-052: loads and flattens a flat YAML config
    it('TC-052: loads and returns flattened vars from a flat config YAML', () => {
      mockReadYamlFile.mockReturnValue({ host: 'localhost', port: '3000' });
      const result = loadConfigFile('app.config.yaml', '/flows/login.yaml');
      expect(result).toEqual({ host: 'localhost', port: '3000' });
    });

    // TC-053: loads and flattens a nested YAML config
    it('TC-053: flattens a nested config YAML to dotted keys', () => {
      mockReadYamlFile.mockReturnValue({ server: { host: 'localhost', port: '3000' } });
      const result = loadConfigFile('app.config.yaml', '/flows/login.yaml');
      expect(result).toEqual({ 'server.host': 'localhost', 'server.port': '3000' });
    });

    // TC-054: file not found → "Config file not found" error
    it('TC-054: throws "Config file not found" when readYamlFile throws ENOENT', () => {
      const enoentErr = Object.assign(new Error('ENOENT: no such file or directory'), {
        code: 'ENOENT',
      });
      mockReadYamlFile.mockImplementation(() => { throw enoentErr; });
      expect(() => loadConfigFile('missing.yaml', '/flows/login.yaml')).toThrow(
        /Config file not found.*missing\.yaml/,
      );
    });

    // TC-055: root is array → error
    it('TC-055: throws when the config file root is an array', () => {
      mockReadYamlFile.mockReturnValue([{ key: 'value' }]);
      expect(() => loadConfigFile('arr.yaml', '/flows/login.yaml')).toThrow(
        /must be a YAML map|non-object root/i,
      );
    });

    // TC-056: ${env.*} in config values → resolved at load time
    it('TC-056: resolves ${env.*} expressions in config file values', () => {
      process.env['__UIVISOR_CFG_PORT__'] = '9090';
      try {
        mockReadYamlFile.mockReturnValue({ port: '${env.__UIVISOR_CFG_PORT__}' });
        const result = loadConfigFile('app.config.yaml', '/flows/login.yaml');
        expect(result).toEqual({ port: '9090' });
      } finally {
        delete process.env['__UIVISOR_CFG_PORT__'];
      }
    });

    // TC-059: config path resolved relative to flow file's directory
    it('TC-059: resolves the config path relative to the flow file directory', () => {
      mockReadYamlFile.mockReturnValue({ key: 'value' });
      loadConfigFile('config.yaml', '/some/path/flow.yaml');
      expect(mockReadYamlFile).toHaveBeenCalledWith('/some/path/config.yaml');
    });

    // TC-060: duplicate keys in config file → error from flattenVars
    it('TC-060: throws on duplicate keys in the config file (via flattenVars)', () => {
      // A flat key "a.b" and nested a: { b: "..." } produce duplicate "a.b"
      mockReadYamlFile.mockReturnValue({ 'a.b': 'x', a: { b: 'y' } });
      expect(() => loadConfigFile('dup.yaml', '/flows/login.yaml')).toThrow(/duplicate/i);
    });
  });

  // ── loadAndParse integration (TC-061 to TC-072) ──────────────────────────────

  describe('loadAndParse — variable interpolation integration', () => {
    const mockReadYamlFile = vi.mocked(reader.readYamlFile);

    beforeEach(() => {
      vi.clearAllMocks();
    });

    // TC-061: vars block with simple interpolation in commands
    it('TC-061: interpolates a simple var in a goto command', () => {
      mockReadYamlFile.mockReturnValue({
        appId: 'http://localhost',
        vars: { host: 'example.com' },
        commands: [{ goto: 'http://${host}/login' }],
      });
      const result = loadAndParse('/flows/login.yaml');
      expect(result.commands[0].command).toEqual({
        type: 'goto',
        url: 'http://example.com/login',
      });
    });

    // TC-062: nested vars (a.b notation) in commands
    it('TC-062: interpolates a nested var (dotted key) in a command', () => {
      mockReadYamlFile.mockReturnValue({
        appId: 'http://localhost',
        vars: { server: { host: 'localhost', port: '5173' } },
        commands: [{ goto: 'http://${server.host}:${server.port}' }],
      });
      const result = loadAndParse('/flows/login.yaml');
      expect(result.commands[0].command).toEqual({
        type: 'goto',
        url: 'http://localhost:5173',
      });
    });

    // TC-063: config header → loads config file and uses its values
    it('TC-063: loads a config file and uses its values in command interpolation', () => {
      mockReadYamlFile
        .mockReturnValueOnce({
          appId: 'http://localhost',
          config: 'app.config.yaml',
          commands: [{ goto: 'http://${host}/home' }],
        })
        .mockReturnValueOnce({ host: 'cfg-host' });
      const result = loadAndParse('/flows/login.yaml');
      expect(result.commands[0].command).toEqual({
        type: 'goto',
        url: 'http://cfg-host/home',
      });
    });

    // TC-064: config overrides vars for the same key
    it('TC-064: config file value overrides inline vars value for the same key', () => {
      mockReadYamlFile
        .mockReturnValueOnce({
          appId: 'http://localhost',
          config: 'app.config.yaml',
          vars: { host: 'inline-host' },
          commands: [{ goto: 'http://${host}/home' }],
        })
        .mockReturnValueOnce({ host: 'config-host' });
      const result = loadAndParse('/flows/login.yaml');
      expect(result.commands[0].command).toEqual({
        type: 'goto',
        url: 'http://config-host/home',
      });
    });

    // TC-065: missing config file → propagates "Config file not found" error
    it('TC-065: throws "Config file not found" when the config file is missing', () => {
      const enoentErr = Object.assign(new Error('ENOENT: no such file or directory'), {
        code: 'ENOENT',
      });
      mockReadYamlFile
        .mockReturnValueOnce({
          appId: 'http://localhost',
          config: 'missing.yaml',
          commands: [{ goto: 'http://localhost' }],
        })
        .mockImplementationOnce(() => { throw enoentErr; });
      expect(() => loadAndParse('/flows/login.yaml')).toThrow(
        /Config file not found.*missing\.yaml/,
      );
    });

    // TC-066: ${env.*} expression in a command string
    it('TC-066: interpolates an ${env.*} expression in a command', () => {
      process.env['__UIVISOR_INTEG_HOST__'] = 'env-server';
      try {
        mockReadYamlFile.mockReturnValue({
          appId: 'http://localhost',
          commands: [{ goto: 'http://${env.__UIVISOR_INTEG_HOST__}/path' }],
        });
        const result = loadAndParse('/flows/login.yaml');
        expect(result.commands[0].command).toEqual({
          type: 'goto',
          url: 'http://env-server/path',
        });
      } finally {
        delete process.env['__UIVISOR_INTEG_HOST__'];
      }
    });

    // TC-067: ${env.VAR:default} when env var is not set
    it('TC-067: falls back to the default when the env var is not set', () => {
      const envKey = '__UIVISOR_INTEG_UNSET__';
      delete process.env[envKey];
      mockReadYamlFile.mockReturnValue({
        appId: 'http://localhost',
        commands: [{ goto: `http://\${env.${envKey}:fallback-host}/path` }],
      });
      const result = loadAndParse('/flows/login.yaml');
      expect(result.commands[0].command).toEqual({
        type: 'goto',
        url: 'http://fallback-host/path',
      });
    });

    // TC-068: interpolation in the appId header
    it('TC-068: interpolates variables in the appId header', () => {
      mockReadYamlFile.mockReturnValue({
        appId: 'http://${host}:${port}',
        vars: { host: 'localhost', port: '3000' },
        commands: [{ goto: 'http://localhost:3000' }],
      });
      const result = loadAndParse('/flows/login.yaml');
      expect(result.baseUrl).toBe('http://localhost:3000');
    });

    // TC-069: multiple expressions in one string
    it('TC-069: replaces multiple expressions in a single string value', () => {
      mockReadYamlFile.mockReturnValue({
        appId: 'http://localhost',
        vars: { user: 'alice', pass: 'secret' },
        commands: [
          {
            inputText: {
              element: { testId: 'login-form' },
              text: '${user}:${pass}',
            },
          },
        ],
      });
      const result = loadAndParse('/flows/login.yaml');
      expect(result.commands[0].command).toEqual({
        type: 'inputTextTargeted',
        element: { testId: 'login-form' },
        text: 'alice:secret',
      });
    });

    // TC-070: priority chain: process.env > config > inline vars
    it('TC-070: priority chain — ${env.*} reads env; ${key} respects config > inline', () => {
      process.env['__UIVISOR_PRIO_HOST__'] = 'env-value';
      try {
        mockReadYamlFile
          .mockReturnValueOnce({
            appId: 'http://localhost',
            config: 'app.config.yaml',
            vars: { x: 'inline-value' },
            commands: [
              { goto: 'http://${x}/a' },
              { goto: 'http://${env.__UIVISOR_PRIO_HOST__}/b' },
            ],
          })
          .mockReturnValueOnce({ x: 'config-value' });

        const result = loadAndParse('/flows/login.yaml');
        // config beats inline for ${x}
        expect(result.commands[0].command).toEqual({ type: 'goto', url: 'http://config-value/a' });
        // env always wins for ${env.*}
        expect(result.commands[1].command).toEqual({ type: 'goto', url: 'http://env-value/b' });
      } finally {
        delete process.env['__UIVISOR_PRIO_HOST__'];
      }
    });

    // TC-071: overlapping + non-overlapping keys merged correctly
    it('TC-071: merges overlapping (config wins) and non-overlapping keys from config and inline vars', () => {
      mockReadYamlFile
        .mockReturnValueOnce({
          appId: 'http://localhost',
          config: 'app.config.yaml',
          vars: { shared: 'inline', onlyInline: 'from-inline' },
          commands: [
            { goto: '${shared}' },
            { goto: '${onlyInline}' },
            { goto: '${onlyConfig}' },
          ],
        })
        .mockReturnValueOnce({ shared: 'from-config', onlyConfig: 'cfg-only' });

      const result = loadAndParse('/flows/login.yaml');
      expect(result.commands[0].command).toEqual({ type: 'goto', url: 'from-config' });
      expect(result.commands[1].command).toEqual({ type: 'goto', url: 'from-inline' });
      expect(result.commands[2].command).toEqual({ type: 'goto', url: 'cfg-only' });
    });

    // TC-072: config path with ${env.*} → env-only interpolation before loading config
    it('TC-072: resolves ${env.*} in the config: header before loading the config file', () => {
      process.env['__UIVISOR_CFG_FILE__'] = 'resolved.config.yaml';
      try {
        mockReadYamlFile
          .mockReturnValueOnce({
            appId: 'http://localhost',
            config: '${env.__UIVISOR_CFG_FILE__}',
            commands: [{ goto: 'http://${host}/path' }],
          })
          .mockReturnValueOnce({ host: 'cfg-host' });

        const result = loadAndParse('/flows/login.yaml');
        // config file was loaded (second readYamlFile call)
        expect(mockReadYamlFile).toHaveBeenCalledTimes(2);
        // The second call should be for the resolved path
        expect(mockReadYamlFile).toHaveBeenNthCalledWith(
          2,
          '/flows/resolved.config.yaml',
        );
        expect(result.commands[0].command).toEqual({ type: 'goto', url: 'http://cfg-host/path' });
      } finally {
        delete process.env['__UIVISOR_CFG_FILE__'];
      }
    });

    // validateVars in loadAndParse — vars must be a plain object
    it('throws when vars: is a scalar (not a plain object)', () => {
      mockReadYamlFile.mockReturnValue({
        appId: 'http://localhost',
        vars: 'not-an-object',
        commands: [{ goto: 'http://localhost' }],
      });
      expect(() => loadAndParse('/flows/login.yaml')).toThrow(/invalid.*vars|must be a plain object/i);
    });

    it('throws when vars: is an array (not a plain object)', () => {
      mockReadYamlFile.mockReturnValue({
        appId: 'http://localhost',
        vars: ['a', 'b'],
        commands: [{ goto: 'http://localhost' }],
      });
      expect(() => loadAndParse('/flows/login.yaml')).toThrow(/invalid.*vars|must be a plain object/i);
    });

    // vars field is returned on FlowFile
    it('returns the merged vars on the FlowFile result', () => {
      mockReadYamlFile
        .mockReturnValueOnce({
          appId: 'http://localhost',
          config: 'app.config.yaml',
          vars: { a: 'inline', b: 'only-inline' },
          commands: [{ goto: 'http://localhost' }],
        })
        .mockReturnValueOnce({ a: 'from-config', c: 'only-config' });

      const result = loadAndParse('/flows/login.yaml');
      // config wins for 'a', 'b' from inline, 'c' from config
      expect(result.vars).toMatchObject({ a: 'from-config', b: 'only-inline', c: 'only-config' });
    });
  });
});
