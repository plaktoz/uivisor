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

import { validateHeader, validateCommandList } from '../../src/parser/validator';
import { loadConfigFile } from '../../src/parser/interpolate';
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

  // REPLACES: 'throws on a selector object with multiple unrecognized keys'
  // (that test was stale — css checked before xpath, so it returned { css } not threw)
  it('when both xpath and css keys are present, first-wins returns { xpath } (xpath checked before css after T2)', () => {
    expect(parseSelector({ xpath: '//div', css: '.foo' } as never)).toEqual({ xpath: '//div' });
  });

  // ── XPath selector: AC1 ──────────────────────────────────────────────────────

  // TC-XPATH-P1 [FAILING before T2]
  it('TC-XPATH-P1: parseSelector({ xpath: "//button" }) returns { xpath: "//button" }', () => {
    expect(parseSelector({ xpath: '//button' })).toEqual({ xpath: '//button' });
  });

  // TC-XPATH-P2 [FAILING before T2]
  it('TC-XPATH-P2: parseSelector with attribute predicate returns the full xpath string intact', () => {
    expect(parseSelector({ xpath: '//input[@type="text"]' })).toEqual({ xpath: '//input[@type="text"]' });
  });

  // TC-XPATH-P3 [FAILING before T2]
  it('TC-XPATH-P3: parseSelector({ xpath: "//h1" }) returns { xpath: "//h1" }', () => {
    expect(parseSelector({ xpath: '//h1' })).toEqual({ xpath: '//h1' });
  });

  // TC-XPATH-P4 [FAILING before T2]
  it('TC-XPATH-P4: parseSelector({ xpath: "//button[@type=\\"submit\\"]" }) does not throw', () => {
    expect(() => parseSelector({ xpath: '//button[@type="submit"]' })).not.toThrow();
  });

  // TC-XPATH-P5 [FAILING before T2]
  it('TC-XPATH-P5: parseSelector handles xpath with contains() function', () => {
    expect(parseSelector({ xpath: '//div[contains(@class,"modal")]' })).toEqual({
      xpath: '//div[contains(@class,"modal")]',
    });
  });

  // TC-XPATH-P7 [PASSING] — regression: string selector still passes through unchanged
  it('TC-XPATH-P7 [PASSING]: parseSelector string passthrough unaffected by xpath addition', () => {
    expect(parseSelector('Submit')).toBe('Submit');
  });

  // TC-XPATH-P8 [PASSING] — regression: { text } unaffected
  it('TC-XPATH-P8 [PASSING]: parseSelector({ text }) unchanged', () => {
    expect(parseSelector({ text: 'Sign In' })).toEqual({ text: 'Sign In' });
  });

  // TC-XPATH-P9 [PASSING] — regression: { role, name } unaffected
  it('TC-XPATH-P9 [PASSING]: parseSelector({ role, name }) unchanged', () => {
    expect(parseSelector({ role: 'button', name: 'Submit' })).toEqual({ role: 'button', name: 'Submit' });
  });

  // TC-XPATH-P10 [PASSING] — regression: { css } unaffected
  it('TC-XPATH-P10 [PASSING]: parseSelector({ css }) unchanged', () => {
    expect(parseSelector({ css: '.my-class' })).toEqual({ css: '.my-class' });
  });

  // TC-XPATH-P11 [PASSING] — regression: unknownKey still throws
  it('TC-XPATH-P11 [PASSING]: parseSelector({ unknownKey: "value" }) still throws', () => {
    expect(() => parseSelector({ unknownKey: 'value' } as never)).toThrow(/unrecognized|unknown/i);
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

  it('parses { runFlow: { file, vars } } → runFlow Command with vars', () => {
    expect(parseCommand({
      runFlow: { file: './sub-flow.yaml', vars: { userNric: 'S1234567A' } },
    })).toEqual({
      type: 'runFlow',
      path: './sub-flow.yaml',
      vars: { userNric: 'S1234567A' },
    });
  });

  it('parses { runFlow: { file } } with no vars key', () => {
    expect(parseCommand({ runFlow: { file: './sub-flow.yaml' } })).toEqual({
      type: 'runFlow',
      path: './sub-flow.yaml',
    });
  });

  it('normalises an empty runFlow vars map to absent', () => {
    expect(parseCommand({ runFlow: { file: './sub-flow.yaml', vars: {} } })).toEqual({
      type: 'runFlow',
      path: './sub-flow.yaml',
    });
  });

  it('flattens nested runFlow vars to dotted keys and stringifies leaves like header vars', () => {
    expect(parseCommand({
      runFlow: {
        file: './sub-flow.yaml',
        vars: { n: 3, b: true, z: null, user: { id: 'u1', age: 42 } },
      },
    })).toEqual({
      type: 'runFlow',
      path: './sub-flow.yaml',
      vars: { n: '3', b: 'true', z: 'null', 'user.id': 'u1', 'user.age': '42' },
    });
  });

  it('keeps ${...} in runFlow vars for dispatch-time interpolation', () => {
    expect(parseCommand({
      runFlow: { file: './sub-flow.yaml', vars: { userNric: '${adminNric}' } },
    })).toEqual({
      type: 'runFlow',
      path: './sub-flow.yaml',
      vars: { userNric: '${adminNric}' },
    });
  });

  it.each([
    ['a number', 5],
    ['null', null],
    ['an array', ['./a.yaml']],
    ['an empty string', ''],
    ['a whitespace-only string', '   '],
  ])('throws a runFlow parse error when the value is %s', (_label, value) => {
    expect(() => parseCommand({ runFlow: value })).toThrow(/^Invalid runFlow/);
  });

  it.each([
    ['file is missing', { vars: { a: '1' } }, /"file" must be a non-empty string/],
    ['file is not a string', { file: 123 }, /"file" must be a non-empty string/],
    ['file is empty', { file: '' }, /"file" must be a non-empty string/],
    ['an unknown key is present', { file: './a.yaml', path: './b.yaml' }, /unknown key "path"/],
    ['vars is a string', { file: './a.yaml', vars: 'x' }, /"vars" must be a map/],
    ['vars is an array', { file: './a.yaml', vars: [1] }, /"vars" must be a map/],
    ['vars is null', { file: './a.yaml', vars: null }, /"vars" must be a map/],
    ['a vars leaf is an array', { file: './a.yaml', vars: { a: [1] } }, /arrays are not allowed/],
    ['a vars name is env.*', { file: './a.yaml', vars: { 'env.X': '1' } }, /Reserved variable name: "env.X"/],
    ['a vars name nests under env', { file: './a.yaml', vars: { env: { X: '1' } } }, /Reserved variable name: "env/],
    ['a vars name is invalid', { file: './a.yaml', vars: { '1bad': 'x' } }, /Invalid variable name: "1bad"/],
  ])('throws a runFlow parse error when %s', (_label, value, detail) => {
    expect(() => parseCommand({ runFlow: value })).toThrow(/^Invalid runFlow/);
    expect(() => parseCommand({ runFlow: value })).toThrow(detail);
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

  // ── XPath selector in commands: AC1 (parse round-trip) ──────────────────────

  // TC-XPATH-CMD1 [FAILING before T1+T2]
  it('TC-XPATH-CMD1: parseCommand({ tapOn: { xpath: "//button" } }) → tapOn with xpath selector', () => {
    expect(parseCommand({ tapOn: { xpath: '//button' } })).toEqual({
      type: 'tapOn',
      selector: { xpath: '//button' },
    });
  });

  // TC-XPATH-CMD2 [FAILING before T1+T2]
  it('TC-XPATH-CMD2: parseCommand({ assertVisible: { xpath: "//div[@id=\\"modal\\"]" } }) → assertVisible with xpath', () => {
    expect(parseCommand({ assertVisible: { xpath: '//div[@id="modal"]' } })).toEqual({
      type: 'assertVisible',
      selector: { xpath: '//div[@id="modal"]' },
    });
  });

  // TC-XPATH-CMD3 [FAILING before T1+T2] — AC4: assertText with xpath + expected
  it('TC-XPATH-CMD3: parseCommand({ assertText: { xpath: "//h1", expected: "Welcome" } }) → extracts expected correctly', () => {
    expect(parseCommand({ assertText: { xpath: '//h1', expected: 'Welcome' } })).toEqual({
      type: 'assertText',
      selector: { xpath: '//h1' },
      expected: 'Welcome',
    });
  });

  // TC-XPATH-CMD4 [FAILING before T1+T2]
  it('TC-XPATH-CMD4: parseCommand({ assertNotVisible: { xpath: "//div[@id=\\"spinner\\"]" } }) → assertNotVisible', () => {
    expect(parseCommand({ assertNotVisible: { xpath: '//div[@id="spinner"]' } })).toEqual({
      type: 'assertNotVisible',
      selector: { xpath: '//div[@id="spinner"]' },
    });
  });

  // TC-XPATH-CMD5 [PASSING] — regression: tapOn with string selector unchanged
  it('TC-XPATH-CMD5 [PASSING]: parseCommand({ tapOn: "Sign In" }) still parses correctly', () => {
    expect(parseCommand({ tapOn: 'Sign In' })).toEqual({ type: 'tapOn', selector: 'Sign In' });
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

  it('rejects a malformed runFlow object at load time', () => {
    mockReadYamlFile.mockReturnValue({
      appId: 'http://localhost',
      commands: [{ runFlow: { file: 7 } }],
    });

    expect(() => loadAndParse('/flows/main.yaml')).toThrow(/Invalid runFlow: "file" must be a non-empty string/);
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

// ─── wait / waitFor — string-coercion bug (fix-wait-waitfor-string-coercion) ──
//
// Consolidated test suite (tester_consolidator).
// Covers the 10 ACs (shared by Generator A and Generator B) plus 8 edge-case
// regression guards added by Generator B.
//
// CURRENTLY FAILING before the fix (marked [FAILING]):
//   AC1, AC2, Edge-LargeValue — parsers throw instead of accepting numeric strings
//
// CURRENTLY PASSING before the fix (marked [PASSING]):
//   AC3–AC10, Edge-* — error paths already throw the right messages;
//   inline-number regressions pass; bad-input edge cases throw

describe('parseCommand — wait/waitFor string coercion (fix-wait-waitfor-string-coercion)', () => {

  // ── Core ACs (shared by Generator A and Generator B) ────────────────────────

  // AC1 [FAILING]: numeric string "5000" must be coerced and accepted by wait
  it('AC1 [FAILING]: parseCommand({ wait: "5000" }) returns { type: "wait", ms: 5000 }', () => {
    expect(parseCommand({ wait: '5000' })).toEqual({ type: 'wait', ms: 5000 });
  });

  // AC2 [FAILING]: numeric string "1000" must be coerced and accepted by waitFor
  it('AC2 [FAILING]: parseCommand({ waitFor: "1000" }) returns { type: "waitFor", ms: 1000 }', () => {
    expect(parseCommand({ waitFor: '1000' })).toEqual({ type: 'waitFor', ms: 1000 });
  });

  // AC3 [PASSING]: non-numeric string for wait still throws
  it('AC3 [PASSING]: parseCommand({ wait: "hello" }) throws matching /type error|must be.*integer/i', () => {
    expect(() => parseCommand({ wait: 'hello' })).toThrow(/type error|must be.*integer/i);
  });

  // AC4 [PASSING]: non-numeric string for waitFor still throws
  it('AC4 [PASSING]: parseCommand({ waitFor: "hello" }) throws matching /positive integer/i', () => {
    expect(() => parseCommand({ waitFor: 'hello' })).toThrow(/positive integer/i);
  });

  // AC5 [PASSING]: regression — inline integer literal for wait must not break
  it('AC5 [PASSING]: parseCommand({ wait: 500 }) returns { type: "wait", ms: 500 }', () => {
    expect(parseCommand({ wait: 500 })).toEqual({ type: 'wait', ms: 500 });
  });

  // AC6 [PASSING]: regression — inline integer literal for waitFor must not break
  it('AC6 [PASSING]: parseCommand({ waitFor: 3000 }) returns { type: "waitFor", ms: 3000 }', () => {
    expect(parseCommand({ waitFor: 3000 })).toEqual({ type: 'waitFor', ms: 3000 });
  });

  // AC7 [PASSING]: string "0" for waitFor must still throw (zero is not positive)
  it('AC7 [PASSING]: parseCommand({ waitFor: "0" }) throws matching /positive integer/i', () => {
    expect(() => parseCommand({ waitFor: '0' })).toThrow(/positive integer/i);
  });

  // AC8 [PASSING]: negative numeric string for waitFor must still throw
  it('AC8 [PASSING]: parseCommand({ waitFor: "-500" }) throws matching /positive integer/i', () => {
    expect(() => parseCommand({ waitFor: '-500' })).toThrow(/positive integer/i);
  });

  // AC9 [PASSING]: float string for wait must still throw (must be integer)
  it('AC9 [PASSING]: parseCommand({ wait: "1.5" }) throws matching /type error|must be.*integer/i', () => {
    expect(() => parseCommand({ wait: '1.5' })).toThrow(/type error|must be.*integer/i);
  });

  // AC10 [PASSING]: float string for waitFor must still throw
  it('AC10 [PASSING]: parseCommand({ waitFor: "1.5" }) throws matching /positive integer/i', () => {
    expect(() => parseCommand({ waitFor: '1.5' })).toThrow(/positive integer/i);
  });

  // ── Edge-case regression guards (Generator B additions) ─────────────────────

  // Edge-LargeValue [FAILING]: large numeric string must coerce correctly for wait
  it('Edge-LargeValue [FAILING]: parseCommand({ wait: "999999" }) returns { type: "wait", ms: 999999 }', () => {
    expect(parseCommand({ wait: '999999' })).toEqual({ type: 'wait', ms: 999999 });
  });

  // Edge-Whitespace [PASSING]: whitespace-padded string must throw — " 500 " cannot come
  // from flattenVars coercing a number (which produces "500"), so it implies a typo in vars.
  // The fix must use a strict digit-only check so this is rejected, not silently trimmed.
  it('Edge-Whitespace [PASSING]: parseCommand({ wait: " 500 " }) throws — strict coercion rejects whitespace', () => {
    expect(() => parseCommand({ wait: ' 500 ' })).toThrow(/type error|must be.*integer/i);
  });

  // Edge-NaN-wait [PASSING]: "NaN" is not a finite integer
  it('Edge-NaN-wait [PASSING]: parseCommand({ wait: "NaN" }) throws matching /type error|must be.*integer/i', () => {
    expect(() => parseCommand({ wait: 'NaN' })).toThrow(/type error|must be.*integer/i);
  });

  // Edge-Infinity-wait [PASSING]: "Infinity" is not a finite integer
  it('Edge-Infinity-wait [PASSING]: parseCommand({ wait: "Infinity" }) throws matching /type error|must be.*integer/i', () => {
    expect(() => parseCommand({ wait: 'Infinity' })).toThrow(/type error|must be.*integer/i);
  });

  // Edge-NaN-waitFor [PASSING]: "NaN" is not a positive integer
  it('Edge-NaN-waitFor [PASSING]: parseCommand({ waitFor: "NaN" }) throws matching /positive integer/i', () => {
    expect(() => parseCommand({ waitFor: 'NaN' })).toThrow(/positive integer/i);
  });

  // Edge-Infinity-waitFor [PASSING]: "Infinity" is not a positive integer
  it('Edge-Infinity-waitFor [PASSING]: parseCommand({ waitFor: "Infinity" }) throws matching /positive integer/i', () => {
    expect(() => parseCommand({ waitFor: 'Infinity' })).toThrow(/positive integer/i);
  });

  // Edge-EmptyString [PASSING]: empty string must throw
  it('Edge-EmptyString [PASSING]: parseCommand({ wait: "" }) throws matching /type error|must be.*integer/i', () => {
    expect(() => parseCommand({ wait: '' })).toThrow(/type error|must be.*integer/i);
  });

  // Edge-MixedContent [PASSING]: "500abc" is not a pure-digit string
  it('Edge-MixedContent [PASSING]: parseCommand({ wait: "500abc" }) throws matching /type error|must be.*integer/i', () => {
    expect(() => parseCommand({ wait: '500abc' })).toThrow(/type error|must be.*integer/i);
  });
});

// ─── variable interpolation ───────────────────────────────────────────────────

describe('variable interpolation', () => {

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
      expect(result.vars).toEqual({ host: 'localhost', port: '3000' });
    });

    // TC-053: loads and flattens a nested YAML config
    it('TC-053: flattens a nested config YAML to dotted keys', () => {
      mockReadYamlFile.mockReturnValue({ server: { host: 'localhost', port: '3000' } });
      const result = loadConfigFile('app.config.yaml', '/flows/login.yaml');
      expect(result.vars).toEqual({ 'server.host': 'localhost', 'server.port': '3000' });
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
        expect(result.vars).toEqual({ port: '9090' });
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

    // TC-061: vars block — commands stored raw (lazy interpolation)
    it('TC-061: commands retain raw ${...} literals (lazy interpolation — not resolved at parse time)', () => {
      mockReadYamlFile.mockReturnValue({
        appId: 'http://localhost',
        vars: { host: 'example.com' },
        commands: [{ goto: 'http://${host}/login' }],
      });
      const result = loadAndParse('/flows/login.yaml');
      // After T4: command url is stored raw
      expect(result.commands[0]!.command).toEqual({
        type: 'goto',
        url: 'http://${host}/login',
      });
      // But vars are available in file.vars
      expect(result.vars).toMatchObject({ host: 'example.com' });
    });

    // TC-062: nested vars stored in file.vars; commands stay raw
    it('TC-062: nested vars are flattened in file.vars; commands stay raw', () => {
      mockReadYamlFile.mockReturnValue({
        appId: 'http://localhost',
        vars: { server: { host: 'localhost', port: '5173' } },
        commands: [{ goto: 'http://${server.host}:${server.port}' }],
      });
      const result = loadAndParse('/flows/login.yaml');
      expect(result.commands[0]!.command).toEqual({
        type: 'goto',
        url: 'http://${server.host}:${server.port}',
      });
      expect(result.vars).toMatchObject({ 'server.host': 'localhost', 'server.port': '5173' });
    });

    // TC-063: config header → loads config file; commands stay raw
    it('TC-063: loads a config file; its vars are in file.vars but commands stay raw', () => {
      mockReadYamlFile
        .mockReturnValueOnce({
          appId: 'http://localhost',
          config: 'app.config.yaml',
          commands: [{ goto: 'http://${host}/home' }],
        })
        .mockReturnValueOnce({ host: 'cfg-host' });
      const result = loadAndParse('/flows/login.yaml');
      expect(result.commands[0]!.command).toEqual({
        type: 'goto',
        url: 'http://${host}/home',
      });
      expect(result.vars).toMatchObject({ host: 'cfg-host' });
    });

    // TC-064: config overrides vars for the same key (reflected in file.vars)
    it('TC-064: config file value overrides inline vars value (visible in file.vars)', () => {
      mockReadYamlFile
        .mockReturnValueOnce({
          appId: 'http://localhost',
          config: 'app.config.yaml',
          vars: { host: 'inline-host' },
          commands: [{ goto: 'http://${host}/home' }],
        })
        .mockReturnValueOnce({ host: 'config-host' });
      const result = loadAndParse('/flows/login.yaml');
      // config wins over inline in file.vars
      expect(result.vars).toMatchObject({ host: 'config-host' });
      // command still raw
      expect(result.commands[0]!.command).toEqual({ type: 'goto', url: 'http://${host}/home' });
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

    // TC-066: commands with ${env.*} are stored raw (resolved at dispatch time)
    it('TC-066: commands with ${env.*} are stored raw (not resolved at parse time)', () => {
      process.env['__UIVISOR_INTEG_HOST__'] = 'env-server';
      try {
        mockReadYamlFile.mockReturnValue({
          appId: 'http://localhost',
          commands: [{ goto: 'http://${env.__UIVISOR_INTEG_HOST__}/path' }],
        });
        const result = loadAndParse('/flows/login.yaml');
        // Command is raw — env var not resolved at parse time
        expect(result.commands[0]!.command).toEqual({
          type: 'goto',
          url: 'http://${env.__UIVISOR_INTEG_HOST__}/path',
        });
      } finally {
        delete process.env['__UIVISOR_INTEG_HOST__'];
      }
    });

    // TC-067: commands with ${env.*:default} are stored raw
    it('TC-067: commands with ${env.*:default} are stored raw (not resolved at parse time)', () => {
      const envKey = '__UIVISOR_INTEG_UNSET__';
      delete process.env[envKey];
      mockReadYamlFile.mockReturnValue({
        appId: 'http://localhost',
        commands: [{ goto: `http://\${env.${envKey}:fallback-host}/path` }],
      });
      const result = loadAndParse('/flows/login.yaml');
      // Command is raw — not resolved at parse time
      expect(result.commands[0]!.command).toEqual({
        type: 'goto',
        url: `http://\${env.${envKey}:fallback-host}/path`,
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

    // TC-069: commands with multiple expressions stored raw
    it('TC-069: commands with multiple ${...} expressions stored raw (lazy interpolation)', () => {
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
      // Command stored raw; vars available in file.vars
      expect(result.commands[0]!.command).toEqual({
        type: 'inputTextTargeted',
        element: { testId: 'login-form' },
        text: '${user}:${pass}',
      });
      expect(result.vars).toMatchObject({ user: 'alice', pass: 'secret' });
    });

    // TC-070: priority chain — reflected in file.vars (commands stay raw)
    it('TC-070: priority chain — config > inline in file.vars; commands stay raw', () => {
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
        // config beats inline for ${x} in file.vars
        expect(result.vars).toMatchObject({ x: 'config-value' });
        // commands are raw
        expect(result.commands[0]!.command).toEqual({ type: 'goto', url: 'http://${x}/a' });
        expect(result.commands[1]!.command).toEqual({ type: 'goto', url: 'http://${env.__UIVISOR_PRIO_HOST__}/b' });
      } finally {
        delete process.env['__UIVISOR_PRIO_HOST__'];
      }
    });

    // TC-071: overlapping + non-overlapping keys merged correctly in file.vars
    it('TC-071: merges overlapping (config wins) and non-overlapping keys in file.vars; commands raw', () => {
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
      // config wins for shared
      expect(result.vars).toMatchObject({ shared: 'from-config', onlyInline: 'from-inline', onlyConfig: 'cfg-only' });
      // commands stay raw
      expect(result.commands[0]!.command).toEqual({ type: 'goto', url: '${shared}' });
      expect(result.commands[1]!.command).toEqual({ type: 'goto', url: '${onlyInline}' });
      expect(result.commands[2]!.command).toEqual({ type: 'goto', url: '${onlyConfig}' });
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
        // command stays raw
        expect(result.commands[0]!.command).toEqual({ type: 'goto', url: 'http://${host}/path' });
        // vars from the config file are available
        expect(result.vars).toMatchObject({ host: 'cfg-host' });
      } finally {
        delete process.env['__UIVISOR_CFG_FILE__'];
      }
    });

    // TC-13: loadAndParse with appId sets flowFile.baseUrl
    it('TC-13: loadAndParse on YAML with appId sets flowFile.baseUrl', () => {
      mockReadYamlFile.mockReturnValue({
        appId: 'http://example.com',
        commands: [{ goto: 'http://example.com' }],
      });

      const result = loadAndParse('/flows/flow.yaml');
      expect(result.baseUrl).toBe('http://example.com');
    });

    // TC-20: loadAndParse with appId + commands: [] throws
    it('TC-20: loadAndParse on YAML with appId + commands: [] throws', () => {
      mockReadYamlFile.mockReturnValue({
        appId: 'http://example.com',
        commands: [],
      });

      expect(() => loadAndParse('/flows/flow.yaml')).toThrow('No commands found in flow.');
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

describe('waitForPageLoad', () => {
  // C-03
  it('null value → bare', () => expect(parseCommand({ waitForPageLoad: null })).toEqual({ type: 'waitForPageLoad' }));
  it('empty object → bare', () => expect(parseCommand({ waitForPageLoad: {} })).toEqual({ type: 'waitForPageLoad' }));

  // C-04
  it('scalar string → path', () => expect(parseCommand({ waitForPageLoad: '/dashboard' })).toEqual({ type: 'waitForPageLoad', path: '/dashboard' }));

  // C-05
  it('object path+timeout → both', () => expect(parseCommand({ waitForPageLoad: { path: '/x', timeout: 5000 } })).toEqual({ type: 'waitForPageLoad', path: '/x', timeout: 5000 }));

  // C-06
  it('timeout:0 accepted', () => expect(parseCommand({ waitForPageLoad: { timeout: 0 } })).toEqual({ type: 'waitForPageLoad', timeout: 0 }));

  // C-07
  it('path only, no timeout key in output', () => expect(parseCommand({ waitForPageLoad: { path: '/x' } })).toEqual({ type: 'waitForPageLoad', path: '/x' }));

  // C-08
  it('query string path preserved', () => expect(parseCommand({ waitForPageLoad: '/search?q=foo' })).toEqual({ type: 'waitForPageLoad', path: '/search?q=foo' }));
  it('timeout:null treated as absent', () => expect(parseCommand({ waitForPageLoad: { timeout: null } })).toEqual({ type: 'waitForPageLoad' }));

  // C-09
  it('float timeout throws exact message', () => expect(() => parseCommand({ waitForPageLoad: { timeout: 0.5 } })).toThrow('waitForPageLoad: timeout must be 0 (no timeout) or a positive integer, got 0.5'));

  // C-10
  it('negative timeout throws with value', () => expect(() => parseCommand({ waitForPageLoad: { timeout: -1 } })).toThrow('waitForPageLoad: timeout must be 0 (no timeout) or a positive integer, got -1'));

  // C-11
  it('non-numeric string timeout throws exact message', () => expect(() => parseCommand({ waitForPageLoad: { timeout: 'abc' } })).toThrow('waitForPageLoad: timeout must be 0 (no timeout) or a positive integer, got abc'));

  // C-12
  it('string-numeral "5000" throws (no coercion)', () => expect(() => parseCommand({ waitForPageLoad: { timeout: '5000' } })).toThrow());
  it('timeout:1 accepted', () => expect(parseCommand({ waitForPageLoad: { timeout: 1 } })).toEqual({ type: 'waitForPageLoad', timeout: 1 }));
});

// ─── T14: setVar / testVarSet / unsetVar parser tests ────────────────────────

describe('setVar — static form (T14)', () => {
  it('parses "name=value" into static setVar command', () => {
    expect(parseCommand({ setVar: 'myVar=hello' })).toEqual({
      type: 'setVar',
      name: 'myVar',
      value: 'hello',
    });
  });

  it('parses "name=value with spaces" — value contains spaces', () => {
    expect(parseCommand({ setVar: 'label=hello world' })).toEqual({
      type: 'setVar',
      name: 'label',
      value: 'hello world',
    });
  });

  it('parses "name=${varRef}" — value with ${...} kept raw', () => {
    expect(parseCommand({ setVar: 'msg=${greeting}' })).toEqual({
      type: 'setVar',
      name: 'msg',
      value: '${greeting}',
    });
  });

  it('static form: value with = sign inside (splits on first = only)', () => {
    expect(parseCommand({ setVar: 'pair=a=b' })).toEqual({
      type: 'setVar',
      name: 'pair',
      value: 'a=b',
    });
  });
});

describe('setVar — method form (T14)', () => {
  it('parses "name=method()" — no args', () => {
    expect(parseCommand({ setVar: 'id=uuid()' })).toEqual({
      type: 'setVar',
      name: 'id',
      method: 'uuid',
      args: [],
    });
  });

  it('parses "name=method(\'arg\')" — single-quoted string arg', () => {
    expect(parseCommand({ setVar: "today=today('YYYYMMDD')" })).toEqual({
      type: 'setVar',
      name: 'today',
      method: 'today',
      args: ["'YYYYMMDD'"],
    });
  });

  it('parses "name=method(num)" — numeric arg stored as string token', () => {
    expect(parseCommand({ setVar: 'code=random(6)' })).toEqual({
      type: 'setVar',
      name: 'code',
      method: 'random',
      args: ['6'],
    });
  });

  it('parses method with variable interpolation arg', () => {
    expect(parseCommand({ setVar: 'result=myFn(${userId})' })).toEqual({
      type: 'setVar',
      name: 'result',
      method: 'myFn',
      args: ['${userId}'],
    });
  });

  it('parses method with multiple args', () => {
    expect(parseCommand({ setVar: "result=myCustomFn(${userId}, 'active')" })).toEqual({
      type: 'setVar',
      name: 'result',
      method: 'myCustomFn',
      args: ['${userId}', "'active'"],
    });
  });
});

describe('testVarSet (T14)', () => {
  it('string value → existence form', () => {
    expect(parseCommand({ testVarSet: 'userId' })).toEqual({
      type: 'testVarSet',
      name: 'userId',
    });
  });

  it('object {name, expected} → equality form', () => {
    expect(parseCommand({ testVarSet: { name: 'userId', expected: 'abc-123' } })).toEqual({
      type: 'testVarSet',
      name: 'userId',
      expected: 'abc-123',
    });
  });

  it('object with numeric expected → string coercion', () => {
    const result = parseCommand({ testVarSet: { name: 'num', expected: '5' } });
    expect(result).toEqual({ type: 'testVarSet', name: 'num', expected: '5' });
  });
});

describe('unsetVar (T14)', () => {
  it('parses string value → unsetVar command with name', () => {
    expect(parseCommand({ unsetVar: 'userId' })).toEqual({
      type: 'unsetVar',
      name: 'userId',
    });
  });

  it('parses another name', () => {
    expect(parseCommand({ unsetVar: 'deadline' })).toEqual({
      type: 'unsetVar',
      name: 'deadline',
    });
  });
});
