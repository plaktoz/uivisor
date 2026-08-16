/**
 * tests/unit/parser.test.ts
 *
 * Unit tests for the YAML DSL Layer.
 * Covers ACs 1–6: parsing, header validation, command parsing, selector parsing.
 *
 * External dependencies (fs, js-yaml) are isolated by mocking src/parser/reader so
 * every test below exercises pure TypeScript logic with no I/O.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mock before any module imports so Vitest replaces the real module.
vi.mock('../../src/parser/reader');

import { validateHeader, validateCommandList } from '../../src/parser/validator';
import { parseSelector } from '../../src/parser/selectorParser';
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
        { type: 'goto', url: 'http://localhost:3000' },
        { type: 'assertVisible', selector: 'Hello' },
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
    expect(commands.map((c) => c.type)).toEqual([
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
