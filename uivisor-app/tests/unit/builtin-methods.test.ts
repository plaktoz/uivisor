/**
 * tests/unit/builtin-methods.test.ts
 *
 * Unit tests for built-in methods (T12 — 14 tests).
 * Written before implementing builtins/index.ts (TDD).
 */

import { describe, it, expect } from 'vitest';
import { today, now, uuid, random, nearestWorkingDay, BUILTIN_NAMES } from '../../src/builtins/index';
import type { WorkingScheduleEntry } from '@uivisor/core';

const MON_FRI_SCHEDULE: WorkingScheduleEntry[] = [
  { days: ['mon', 'tue', 'wed', 'thu', 'fri'], hours: '08:00-18:00' },
];

describe('today()', () => {
  it('returns a string matching YYYYMMDD for format YYYYMMDD', () => {
    const result = today('YYYYMMDD');
    expect(result).toMatch(/^\d{8}$/);
  });

  it('returns a string matching YYYY-MM-DD for format YYYY-MM-DD', () => {
    const result = today('YYYY-MM-DD');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('now()', () => {
  it('returns a string matching HHmmss for format HHmmss', () => {
    const result = now('HHmmss');
    expect(result).toMatch(/^\d{6}$/);
  });

  it('returns a string with colons for format HH:mm:ss', () => {
    const result = now('HH:mm:ss');
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});

describe('uuid()', () => {
  it('returns a valid UUID v4 string', () => {
    const result = uuid();
    expect(result).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('returns a different value on each call', () => {
    const a = uuid();
    const b = uuid();
    expect(a).not.toBe(b);
  });
});

describe('random()', () => {
  it('returns a string with exactly the requested number of digits', () => {
    const result = random(6);
    expect(result).toHaveLength(6);
    expect(result).toMatch(/^\d{6}$/);
  });

  it('first digit is never 0', () => {
    // Run many times to exercise randomness
    for (let i = 0; i < 20; i++) {
      const result = random(6);
      expect(result[0]).not.toBe('0');
    }
  });

  it('returns a single-digit string (length 1, digit 1-9)', () => {
    const result = random(1);
    expect(result).toHaveLength(1);
    expect(result).toMatch(/^[1-9]$/);
  });
});

describe('nearestWorkingDay()', () => {
  it('throws if schedule is undefined', () => {
    expect(() => nearestWorkingDay('YYYYMMDD', undefined)).toThrow(
      /workingSchedule.*not.*defined|not.*defined.*config/i,
    );
  });

  it('throws if schedule is empty array', () => {
    expect(() => nearestWorkingDay('YYYYMMDD', [])).toThrow(
      /workingSchedule.*not.*defined|not.*defined.*config/i,
    );
  });

  it('returns a string matching YYYYMMDD format', () => {
    const result = nearestWorkingDay('YYYYMMDD', MON_FRI_SCHEDULE);
    expect(result).toMatch(/^\d{8}$/);
  });

  it('returns a date that is a working day (mon-fri)', () => {
    const result = nearestWorkingDay('YYYYMMDD', MON_FRI_SCHEDULE);
    // Parse the result back to a Date and check that it's Mon-Fri
    const year = parseInt(result.slice(0, 4), 10);
    const month = parseInt(result.slice(4, 6), 10) - 1;
    const day = parseInt(result.slice(6, 8), 10);
    const d = new Date(year, month, day);
    const dow = d.getDay(); // 0=sun, 1=mon,..., 5=fri, 6=sat
    expect(dow).toBeGreaterThanOrEqual(1);
    expect(dow).toBeLessThanOrEqual(5);
  });

  it('skips holidays', () => {
    // Use a schedule that covers only a day 1 week from now
    const now = new Date();
    // Make a very permissive schedule (all days), but holiday today
    const allDays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const schedule: WorkingScheduleEntry[] = [{ days: allDays, hours: '00:00-23:59' }];

    // Format today as YYYYMMDD
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}${mm}${dd}`;

    const result = nearestWorkingDay('YYYYMMDD', schedule, [todayStr]);
    // Result should NOT be today
    expect(result).not.toBe(todayStr);
  });
});

describe('BUILTIN_NAMES', () => {
  it('contains all five built-in names', () => {
    expect(BUILTIN_NAMES.has('today')).toBe(true);
    expect(BUILTIN_NAMES.has('now')).toBe(true);
    expect(BUILTIN_NAMES.has('uuid')).toBe(true);
    expect(BUILTIN_NAMES.has('random')).toBe(true);
    expect(BUILTIN_NAMES.has('nearestWorkingDay')).toBe(true);
  });

  it('does not contain user-defined function names', () => {
    expect(BUILTIN_NAMES.has('myCustomFn')).toBe(false);
    expect(BUILTIN_NAMES.has('formatRef')).toBe(false);
  });
});
