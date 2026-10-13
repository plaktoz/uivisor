import { describe, it, expect } from 'vitest';
import { resolveRef, interpolateValue, interpolateObject, UnresolvedVariableError } from './interpolate.js';

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
});
