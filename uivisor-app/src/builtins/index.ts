import { randomUUID } from 'crypto';
import type { WorkingScheduleEntry } from '@uivisor/core';

/** All built-in method names. User-defined functions must not share these names. */
export const BUILTIN_NAMES = new Set([
  'today',
  'now',
  'uuid',
  'random',
  'nearestWorkingDay',
]);

// ─── Format helpers ───────────────────────────────────────────────────────────

/**
 * Format a Date using dayjs-compatible tokens.
 * Supported tokens: YYYY, MM, DD, HH, mm, ss.
 */
function formatDate(date: Date, format: string): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/** day-of-week index → lowercase 3-letter name */
const DOW_NAMES: Record<number, string> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};

/** Parse "HH:MM" → total minutes since midnight. */
function parseHHMM(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

// ─── Built-in functions ───────────────────────────────────────────────────────

/** Returns the current date formatted as <format>. */
export function today(format: string): string {
  return formatDate(new Date(), format);
}

/** Returns the current date/time formatted as <format>. */
export function now(format: string): string {
  return formatDate(new Date(), format);
}

/** Generates a random UUID v4. */
export function uuid(): string {
  return randomUUID();
}

/**
 * Returns a random positive integer string with exactly <length> digits.
 * The first digit is never 0.
 */
export function random(length: number): string {
  if (length < 1) throw new Error(`random: length must be >= 1, got ${length}`);
  const firstDigit = Math.floor(Math.random() * 9) + 1; // 1–9
  let result = String(firstDigit);
  for (let i = 1; i < length; i++) {
    result += String(Math.floor(Math.random() * 10)); // 0–9
  }
  return result;
}

/**
 * Returns the current date if it falls within a working window,
 * otherwise the date of the next upcoming working window.
 * Throws if schedule is undefined or empty.
 */
export function nearestWorkingDay(
  format: string,
  schedule?: WorkingScheduleEntry[],
  holidays?: string[],
): string {
  if (!schedule || schedule.length === 0) {
    throw new Error('workingSchedule not defined in config');
  }

  const now = new Date();

  for (let daysAhead = 0; daysAhead < 14; daysAhead++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() + daysAhead);

    // Format as YYYYMMDD for holiday comparison
    const dateStr = formatDate(checkDate, 'YYYYMMDD');
    if (holidays?.includes(dateStr)) continue;

    const dayName = DOW_NAMES[checkDate.getDay()];
    const entries = schedule.filter((e) => e.days.includes(dayName ?? ''));
    if (entries.length === 0) continue;

    if (daysAhead === 0) {
      // For today: check if any working window hasn't ended yet
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const hasOpenWindow = entries.some((entry) => {
        const endStr = entry.hours.split('-')[1] ?? '00:00';
        const endMinutes = parseHHMM(endStr);
        return nowMinutes < endMinutes;
      });
      if (hasOpenWindow) {
        return formatDate(checkDate, format);
      }
      // All windows for today have passed — try tomorrow
      continue;
    }

    // Future day with a schedule entry — return it
    return formatDate(checkDate, format);
  }

  throw new Error('No working day found within 14 days');
}
