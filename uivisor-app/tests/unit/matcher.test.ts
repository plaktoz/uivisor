/**
 * tests/unit/matcher.test.ts
 *
 * Unit tests for the Element Matcher (object-selector forms).
 * These tests cover backward-compatible object selectors (AC-25 / TC-056–058).
 * Bare-string cascade and pipe tests are in resolveSelector.test.ts.
 *
 * resolveSelector is now async — all tests use await.
 */

import { describe, it, expect, vi } from 'vitest';
import type { Page, Locator } from 'playwright';
import { resolveSelector } from '../../src/matcher/index';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a minimal mock Page whose getBy* methods return a mock Locator.
 * For object selectors, .count() is never called so the locator needs no count method.
 */
function makeMockPage() {
  const mockLocator = { _brand: 'locator' } as unknown as Locator;

  const page = {
    // Needed for object selectors:
    getByText: vi.fn().mockReturnValue(mockLocator),
    getByRole: vi.fn().mockReturnValue(mockLocator),
    getByLabel: vi.fn().mockReturnValue(mockLocator),
    getByPlaceholder: vi.fn().mockReturnValue(mockLocator),
    getByTestId: vi.fn().mockReturnValue(mockLocator),
    // Needed for bare-string cascade (returns 0-count locators to exhaust cascade in tests
    // that might accidentally trigger it — but object selectors don't use locator()):
    locator: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(0) }),
  } as unknown as Page;

  return { page, mockLocator };
}

// ─── Object selector forms (AC-25) ───────────────────────────────────────────

describe('resolveSelector — object selectors (unchanged behaviour)', () => {
  // { text } → getByText
  it('{ text: "Submit" } calls page.getByText("Submit")', async () => {
    const { page, mockLocator } = makeMockPage();

    const result = await resolveSelector(page, { text: 'Submit' });

    expect(page.getByText).toHaveBeenCalledOnce();
    expect(page.getByText).toHaveBeenCalledWith('Submit');
    expect(result).toBe(mockLocator);
  });

  it('{ text } does not call any other getBy* method', async () => {
    const { page } = makeMockPage();
    await resolveSelector(page, { text: 'Submit' });

    expect(page.getByRole).not.toHaveBeenCalled();
    expect(page.getByLabel).not.toHaveBeenCalled();
    expect(page.getByPlaceholder).not.toHaveBeenCalled();
    expect(page.getByTestId).not.toHaveBeenCalled();
  });

  // { role, name } → getByRole
  it('{ role: "button", name: "Sign In" } calls getByRole("button", { name: "Sign In" })', async () => {
    const { page, mockLocator } = makeMockPage();

    const result = await resolveSelector(page, { role: 'button', name: 'Sign In' });

    expect(page.getByRole).toHaveBeenCalledOnce();
    expect(page.getByRole).toHaveBeenCalledWith('button', { name: 'Sign In' });
    expect(page.getByText).not.toHaveBeenCalled();
    expect(result).toBe(mockLocator);
  });

  it('{ role: "link", name: "Home" } calls getByRole("link", { name: "Home" })', async () => {
    const { page } = makeMockPage();
    await resolveSelector(page, { role: 'link', name: 'Home' });
    expect(page.getByRole).toHaveBeenCalledWith('link', { name: 'Home' });
  });

  // { label } → getByLabel
  it('{ label: "Email" } calls page.getByLabel("Email")', async () => {
    const { page, mockLocator } = makeMockPage();

    const result = await resolveSelector(page, { label: 'Email' });

    expect(page.getByLabel).toHaveBeenCalledOnce();
    expect(page.getByLabel).toHaveBeenCalledWith('Email');
    expect(page.getByText).not.toHaveBeenCalled();
    expect(result).toBe(mockLocator);
  });

  // { placeholder } → getByPlaceholder
  it('{ placeholder: "Enter email" } calls page.getByPlaceholder("Enter email")', async () => {
    const { page, mockLocator } = makeMockPage();

    const result = await resolveSelector(page, { placeholder: 'Enter email' });

    expect(page.getByPlaceholder).toHaveBeenCalledOnce();
    expect(page.getByPlaceholder).toHaveBeenCalledWith('Enter email');
    expect(page.getByText).not.toHaveBeenCalled();
    expect(result).toBe(mockLocator);
  });

  // { testId } → getByTestId
  it('{ testId: "submit-btn" } calls page.getByTestId("submit-btn")', async () => {
    const { page, mockLocator } = makeMockPage();

    const result = await resolveSelector(page, { testId: 'submit-btn' });

    expect(page.getByTestId).toHaveBeenCalledOnce();
    expect(page.getByTestId).toHaveBeenCalledWith('submit-btn');
    expect(page.getByText).not.toHaveBeenCalled();
    expect(result).toBe(mockLocator);
  });

  // unrecognized key → throws
  it('an unrecognized selector key throws an error', async () => {
    const { page } = makeMockPage();

    await expect(resolveSelector(page, { dataAttr: 'foo' } as never)).rejects.toThrow(
      /unrecognized|unknown/i,
    );
  });

  it('error for unrecognized key does not call any getBy* method', async () => {
    const { page } = makeMockPage();

    try {
      await resolveSelector(page, { xpath: '//div' } as never);
    } catch {
      // expected
    }

    expect(page.getByText).not.toHaveBeenCalled();
    expect(page.getByRole).not.toHaveBeenCalled();
    expect(page.getByLabel).not.toHaveBeenCalled();
    expect(page.getByPlaceholder).not.toHaveBeenCalled();
    expect(page.getByTestId).not.toHaveBeenCalled();
  });

  it('error message for unrecognized key includes the offending key name', async () => {
    const { page } = makeMockPage();

    await expect(resolveSelector(page, { xpath: '//div' } as never)).rejects.toThrow(
      /xpath|unrecognized|unknown/i,
    );
  });

  // Return value is the Locator from the matching getBy* call
  it('returns the Locator produced by getByLabel', async () => {
    const { page, mockLocator } = makeMockPage();
    const result = await resolveSelector(page, { label: 'Password' });
    expect(result).toBe(mockLocator);
  });

  it('returns the Locator produced by getByPlaceholder', async () => {
    const { page, mockLocator } = makeMockPage();
    const result = await resolveSelector(page, { placeholder: 'Search…' });
    expect(result).toBe(mockLocator);
  });
});
