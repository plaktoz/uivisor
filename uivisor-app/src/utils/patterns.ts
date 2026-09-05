/**
 * Wildcard pattern matcher utility.
 *
 * `*` is the sole glob wildcard — matches zero or more characters at any position.
 * When the pattern contains no `*`, comparison is exact (case-sensitive).
 *
 * Examples:
 *   matchesPattern('Submit', 'Submit')        → true
 *   matchesPattern('Submit', 'Submit Form')   → false
 *   matchesPattern('Save*', 'Save Draft')     → true
 *   matchesPattern('*me', 'Welcome')          → true
 *   matchesPattern('*Click Me*', 'Click Me!') → true
 *   matchesPattern('*', '')                   → true
 */
export function matchesPattern(pattern: string, actual: string): boolean {
  if (!pattern.includes('*')) return pattern === actual;
  // Convert glob pattern to anchored regex:
  // escape all regex special chars except *, then replace * with .*
  const regexStr = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(actual);
}
