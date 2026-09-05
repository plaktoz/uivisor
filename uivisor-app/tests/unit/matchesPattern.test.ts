/**
 * tests/unit/matchesPattern.test.ts
 *
 * Unit tests for the matchesPattern pure utility.
 * Covers TC-021 through TC-022, TC-024 through TC-025, TC-027, TC-030 through TC-031,
 * TC-059 through TC-062 from the consolidated test suite.
 */

import { describe, it, expect } from 'vitest';
import { matchesPattern } from '../../src/utils/patterns';

describe('matchesPattern — exact match (no wildcard)', () => {
  // TC-062: no wildcard means case-sensitive exact match
  it('TC-062a: exact same string returns true', () => {
    expect(matchesPattern('Submit', 'Submit')).toBe(true);
  });

  it('TC-062b: Submit does NOT match Submit Form', () => {
    expect(matchesPattern('Submit', 'Submit Form')).toBe(false);
  });

  // TC-030: breaking-change regression
  it('TC-030: matchesPattern("Submit", "Submit Form") returns false', () => {
    expect(matchesPattern('Submit', 'Submit Form')).toBe(false);
  });

  // TC-031: partial suffix match is rejected
  it('TC-031: matchesPattern("Submit", "Submitting") returns false', () => {
    expect(matchesPattern('Submit', 'Submitting')).toBe(false);
  });

  it('TC-062c: case-sensitive — Submit does NOT match submit', () => {
    expect(matchesPattern('Submit', 'submit')).toBe(false);
  });

  // TC-059: empty string pattern does not match non-empty actual
  it('TC-059: empty pattern does not match "anything"', () => {
    expect(matchesPattern('', 'anything')).toBe(false);
  });

  it('empty pattern matches empty string exactly', () => {
    expect(matchesPattern('', '')).toBe(true);
  });
});

describe('matchesPattern — wildcard: prefix (`abc*`)', () => {
  // TC-021: Save* matches "Save Draft"
  it('TC-021: matchesPattern("Save*", "Save Draft") returns true', () => {
    expect(matchesPattern('Save*', 'Save Draft')).toBe(true);
  });

  // TC-022: Save* does NOT match "Saving" (doesn't start with "Save")
  it('TC-022: matchesPattern("Save*", "Saving") returns false', () => {
    expect(matchesPattern('Save*', 'Saving')).toBe(false);
  });

  it('prefix: Save* matches "Save" (empty suffix)', () => {
    expect(matchesPattern('Save*', 'Save')).toBe(true);
  });

  it('prefix: Click* matches "Click Me"', () => {
    expect(matchesPattern('Click*', 'Click Me')).toBe(true);
  });
});

describe('matchesPattern — wildcard: suffix (`*abc`)', () => {
  // TC-024: *me matches "Click me"
  it('TC-024: matchesPattern("*me", "Click me") returns true', () => {
    expect(matchesPattern('*me', 'Click me')).toBe(true);
  });

  // TC-025: *me does NOT match "element" (contains but does not end with "me")
  it('TC-025: matchesPattern("*me", "element") returns false', () => {
    expect(matchesPattern('*me', 'element')).toBe(false);
  });

  it('suffix: *me matches "Welcome"', () => {
    expect(matchesPattern('*me', 'Welcome')).toBe(true);
  });

  it('suffix: *me matches "me" (empty prefix)', () => {
    expect(matchesPattern('*me', 'me')).toBe(true);
  });
});

describe('matchesPattern — wildcard: contains (`*abc*`)', () => {
  // TC-027: *Click Me* matches "Please Click Me Here"
  it('TC-027: matchesPattern("*Click Me*", "Please Click Me Here") returns true', () => {
    expect(matchesPattern('*Click Me*', 'Please Click Me Here')).toBe(true);
  });

  it('contains: *foo* matches "foobar"', () => {
    expect(matchesPattern('*foo*', 'foobar')).toBe(true);
  });

  it('contains: *foo* does NOT match "bar"', () => {
    expect(matchesPattern('*foo*', 'bar')).toBe(false);
  });
});

describe('matchesPattern — wildcard only (`*`)', () => {
  // TC-060: * alone matches any string including empty
  it('TC-060a: "*" matches empty string', () => {
    expect(matchesPattern('*', '')).toBe(true);
  });

  it('TC-060b: "*" matches "anything"', () => {
    expect(matchesPattern('*', 'anything')).toBe(true);
  });

  it('TC-060c: "*" matches "multi word string"', () => {
    expect(matchesPattern('*', 'multi word string')).toBe(true);
  });
});

describe('matchesPattern — multiple wildcards', () => {
  // TC-061: multiple wildcards in one pattern
  it('TC-061a: matchesPattern("btn-*-*", "btn-submit-ok") returns true', () => {
    expect(matchesPattern('btn-*-*', 'btn-submit-ok')).toBe(true);
  });

  it('TC-061b: matchesPattern("btn-*-*", "btn-a-b") returns true', () => {
    expect(matchesPattern('btn-*-*', 'btn-a-b')).toBe(true);
  });

  it('TC-061c: matchesPattern("btn-*-*", "btn-only") returns false', () => {
    expect(matchesPattern('btn-*-*', 'btn-only')).toBe(false);
  });
});
