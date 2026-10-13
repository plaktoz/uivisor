import { describe, it, expect } from 'vitest';
import {
  resolveRef,
  interpolateValue,
  interpolateObject,
  UnresolvedVariableError,
  validateVars,
  flattenVars,
  parseRunFlow,
} from './interpolate.js';

describe('variable interpolation', () => {
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

  describe('strict mode', () => {
    it('throws UnresolvedVariableError naming an absent variable with no default', () => {
      expect(() => interpolateObject({ a: ['${missing}'] }, {}, true)).toThrow(
        new UnresolvedVariableError('missing'),
      );
      expect(() => interpolateObject('${missing}', {}, true)).toThrow('Variable "missing" is not defined');
    });

    it('still uses the default, and an empty value, without throwing', () => {
      expect(interpolateObject('${missing:dflt}|${empty}', { empty: '' }, true)).toBe('dflt|');
    });
  });

  describe('validateVars', () => {
    it('accepts a plain object, including an empty one', () => {
      expect(() => validateVars({ a: '1', db: { host: 'x' } })).not.toThrow();
      expect(() => validateVars({})).not.toThrow();
    });

    it.each([
      ['null', null],
      ['an array', ['a']],
      ['a string', 'x'],
      ['a number', 1],
    ])('rejects %s', (_label, raw) => {
      expect(() => validateVars(raw)).toThrow(/^Invalid vars: must be a plain object$/);
    });

    it('names the file when one is given', () => {
      expect(() => validateVars(null, '/flows/a.yaml')).toThrow(
        /^Invalid vars: must be a plain object in \/flows\/a\.yaml$/,
      );
    });
  });

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

  // ── parseRunFlow ────────────────────────────────────────────────────────────

  describe('parseRunFlow', () => {
    it('parses a string path', () => {
      expect(parseRunFlow('./sub.yaml')).toEqual({
        type: 'runFlow',
        path: './sub.yaml',
      });
    });

    it('parses { file } without vars', () => {
      expect(parseRunFlow({ file: './sub.yaml' })).toEqual({
        type: 'runFlow',
        path: './sub.yaml',
      });
    });

    it('parses { file, vars } with flat vars', () => {
      expect(parseRunFlow({ file: './sub.yaml', vars: { u: '1', name: 'Alice' } })).toEqual({
        type: 'runFlow',
        path: './sub.yaml',
        vars: { u: '1', name: 'Alice' },
      });
    });

    it('flattens nested vars', () => {
      expect(
        parseRunFlow({
          file: './sub.yaml',
          vars: { num: 42, flag: true, user: { id: 'u1', role: 'admin' } },
        }),
      ).toEqual({
        type: 'runFlow',
        path: './sub.yaml',
        vars: { num: '42', flag: 'true', 'user.id': 'u1', 'user.role': 'admin' },
      });
    });

    it('normalises empty vars object to omit vars property', () => {
      expect(parseRunFlow({ file: './sub.yaml', vars: {} })).toEqual({
        type: 'runFlow',
        path: './sub.yaml',
      });
    });

    it.each([
      ['null', null],
      ['a number', 123],
      ['an array', ['x']],
      ['an empty string', ''],
      ['whitespace only', '   '],
    ])('rejects non-object or empty path: %s', (_label, val) => {
      expect(() => parseRunFlow(val)).toThrow(/^Invalid runFlow:/);
    });

    it('rejects unknown keys', () => {
      expect(() => parseRunFlow({ file: './x.yaml', var: { u: 1 } })).toThrow(
        'Invalid runFlow: unknown key "var" (allowed: file, vars)',
      );
    });

    it('rejects missing or empty file property', () => {
      expect(() => parseRunFlow({ vars: { a: '1' } })).toThrow(
        'Invalid runFlow: "file" must be a non-empty string',
      );
      expect(() => parseRunFlow({ file: '' })).toThrow(
        'Invalid runFlow: "file" must be a non-empty string',
      );
    });

    it('rejects non-object vars', () => {
      expect(() => parseRunFlow({ file: './x.yaml', vars: 'not-an-object' })).toThrow(
        'Invalid runFlow: "vars" must be a map of name: value, got string',
      );
      expect(() => parseRunFlow({ file: './x.yaml', vars: [1, 2] })).toThrow(
        'Invalid runFlow: "vars" must be a map of name: value, got an array',
      );
    });

    it('rejects reserved variable name in vars', () => {
      expect(() => parseRunFlow({ file: './x.yaml', vars: { env: '1' } })).toThrow(
        'Invalid runFlow: Reserved variable name: "env"',
      );
      expect(() => parseRunFlow({ file: './x.yaml', vars: { 'env.X': '1' } })).toThrow(
        'Invalid runFlow: Reserved variable name: "env.X"',
      );
    });
  });
});
