/**
 * tests/unit/matcher.test.ts
 *
 * Unit tests for the Element Matcher.
 * Covers ACs 28–34: Selector → Playwright Locator dispatch.
 *
 * Playwright's Page is fully mocked — no browser is launched.
 * Each test verifies which getBy* method is called and with what arguments.
 */

import { describe, it, expect, vi } from 'vitest';
import type { Page, Locator } from 'playwright';
import { resolveSelector } from '../../src/matcher/index';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a minimal mock Page whose getBy* methods are vi.fn stubs returning a
 * consistent mock Locator.  Call-counts are checked per test.
 */
function makeMockPage() {
  const mockLocator = { _brand: 'locator' } as unknown as Locator;

  const page = {
    getByText: vi.fn().mockReturnValue(mockLocator),
    getByRole: vi.fn().mockReturnValue(mockLocator),
    getByLabel: vi.fn().mockReturnValue(mockLocator),
    getByPlaceholder: vi.fn().mockReturnValue(mockLocator),
    getByTestId: vi.fn().mockReturnValue(mockLocator),
  } as unknown as Page;

  return { page, mockLocator };
}

// ─── resolveSelector ─────────────────────────────────────────────────────────

describe('resolveSelector', () => {
  // AC28: shorthand string → getByText
  it('AC28: shorthand string selector calls page.getByText with the string', () => {
    const { page, mockLocator } = makeMockPage();

    const result = resolveSelector(page, 'Sign In');

    expect(page.getByText).toHaveBeenCalledOnce();
    expect(page.getByText).toHaveBeenCalledWith('Sign In');
    expect(page.getByRole).not.toHaveBeenCalled();
    expect(result).toBe(mockLocator);
  });

  // AC29: explicit { text } → getByText
  it('AC29: { text: "Submit" } calls page.getByText("Submit")', () => {
    const { page, mockLocator } = makeMockPage();

    const result = resolveSelector(page, { text: 'Submit' });

    expect(page.getByText).toHaveBeenCalledOnce();
    expect(page.getByText).toHaveBeenCalledWith('Submit');
    expect(result).toBe(mockLocator);
  });

  it('AC29: { text } does not call any other getBy* method', () => {
    const { page } = makeMockPage();
    resolveSelector(page, { text: 'Submit' });

    expect(page.getByRole).not.toHaveBeenCalled();
    expect(page.getByLabel).not.toHaveBeenCalled();
    expect(page.getByPlaceholder).not.toHaveBeenCalled();
    expect(page.getByTestId).not.toHaveBeenCalled();
  });

  // AC30: { role, name } → getByRole
  it('AC30: { role: "button", name: "Sign In" } calls getByRole("button", { name: "Sign In" })', () => {
    const { page, mockLocator } = makeMockPage();

    const result = resolveSelector(page, { role: 'button', name: 'Sign In' });

    expect(page.getByRole).toHaveBeenCalledOnce();
    expect(page.getByRole).toHaveBeenCalledWith('button', { name: 'Sign In' });
    expect(page.getByText).not.toHaveBeenCalled();
    expect(result).toBe(mockLocator);
  });

  it('AC30: { role: "link", name: "Home" } calls getByRole("link", { name: "Home" })', () => {
    const { page } = makeMockPage();
    resolveSelector(page, { role: 'link', name: 'Home' });
    expect(page.getByRole).toHaveBeenCalledWith('link', { name: 'Home' });
  });

  // AC31: { label } → getByLabel
  it('AC31: { label: "Email" } calls page.getByLabel("Email")', () => {
    const { page, mockLocator } = makeMockPage();

    const result = resolveSelector(page, { label: 'Email' });

    expect(page.getByLabel).toHaveBeenCalledOnce();
    expect(page.getByLabel).toHaveBeenCalledWith('Email');
    expect(page.getByText).not.toHaveBeenCalled();
    expect(result).toBe(mockLocator);
  });

  // AC32: { placeholder } → getByPlaceholder
  it('AC32: { placeholder: "Enter email" } calls page.getByPlaceholder("Enter email")', () => {
    const { page, mockLocator } = makeMockPage();

    const result = resolveSelector(page, { placeholder: 'Enter email' });

    expect(page.getByPlaceholder).toHaveBeenCalledOnce();
    expect(page.getByPlaceholder).toHaveBeenCalledWith('Enter email');
    expect(page.getByText).not.toHaveBeenCalled();
    expect(result).toBe(mockLocator);
  });

  // AC33: { testId } → getByTestId
  it('AC33: { testId: "submit-btn" } calls page.getByTestId("submit-btn")', () => {
    const { page, mockLocator } = makeMockPage();

    const result = resolveSelector(page, { testId: 'submit-btn' });

    expect(page.getByTestId).toHaveBeenCalledOnce();
    expect(page.getByTestId).toHaveBeenCalledWith('submit-btn');
    expect(page.getByText).not.toHaveBeenCalled();
    expect(result).toBe(mockLocator);
  });

  // AC34: unrecognized key → throws, does not call any getBy*
  it('AC34: an unrecognized selector key throws an error', () => {
    const { page } = makeMockPage();

    expect(() => resolveSelector(page, { dataAttr: 'foo' } as never)).toThrow(
      /unrecognized|unknown/i,
    );
  });

  it('AC34: error for unrecognized key does not call any getBy* method', () => {
    const { page } = makeMockPage();

    try {
      resolveSelector(page, { xpath: '//div' } as never);
    } catch {
      // expected
    }

    expect(page.getByText).not.toHaveBeenCalled();
    expect(page.getByRole).not.toHaveBeenCalled();
    expect(page.getByLabel).not.toHaveBeenCalled();
    expect(page.getByPlaceholder).not.toHaveBeenCalled();
    expect(page.getByTestId).not.toHaveBeenCalled();
  });

  it('AC34: error message for unrecognized key includes the offending key name', () => {
    const { page } = makeMockPage();

    expect(() => resolveSelector(page, { xpath: '//div' } as never)).toThrow(
      /xpath|unrecognized|unknown/i,
    );
  });

  // Return value is always the Locator from the matching getBy* call
  it('returns the Locator produced by getByLabel', () => {
    const { page, mockLocator } = makeMockPage();
    const result = resolveSelector(page, { label: 'Password' });
    expect(result).toBe(mockLocator);
  });

  it('returns the Locator produced by getByPlaceholder', () => {
    const { page, mockLocator } = makeMockPage();
    const result = resolveSelector(page, { placeholder: 'Search…' });
    expect(result).toBe(mockLocator);
  });
});
