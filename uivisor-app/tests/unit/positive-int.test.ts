import { describe, it, expect } from 'vitest';
import { parsePositiveInt } from '../../src/utils/positiveInt';

describe('parsePositiveInt', () => {
  it('accepts a positive integer number', () => {
    expect(parsePositiveInt(3000)).toBe(3000);
  });

  it('accepts a digit-only string ("3000")', () => {
    expect(parsePositiveInt('3000')).toBe(3000);
  });

  it.each([
    ['0', 0],
    ['a negative integer', -5],
    ['a float', 1.5],
    ['a non-numeric string', 'abc'],
    ['a boolean', true],
    ['null', null],
    ['undefined', undefined],
  ])('rejects %s', (_label, raw) => {
    expect(parsePositiveInt(raw)).toBeUndefined();
  });

  it('accepts a leading-zero digit string ("007") as 7', () => {
    expect(parsePositiveInt('007')).toBe(7);
  });

  it('rejects a string with surrounding whitespace (" 3000 ")', () => {
    expect(parsePositiveInt(' 3000 ')).toBeUndefined();
  });

  it('rejects an explicitly-signed string ("+3000")', () => {
    expect(parsePositiveInt('+3000')).toBeUndefined();
  });

  it('rejects a float-as-string ("3000.0")', () => {
    expect(parsePositiveInt('3000.0')).toBeUndefined();
  });

  it('documents the behaviour for a digit string past Number.MAX_SAFE_INTEGER', () => {
    // No upper bound (Arbiter gap ruling 2): accepted, with Number() precision loss.
    expect(parsePositiveInt('9007199254740993')).toBe(Number('9007199254740993'));
  });

  it('rejects the literal strings "NaN" and "Infinity"', () => {
    expect(parsePositiveInt('NaN')).toBeUndefined();
    expect(parsePositiveInt('Infinity')).toBeUndefined();
  });
});
