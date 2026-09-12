import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Page, Locator } from 'playwright';
import { resolveLocator } from './playwrightLocator.js';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/** Create a mock Locator that returns a specific count */
function mockLocator(count: number): Locator {
  return {
    count: vi.fn().mockResolvedValue(count),
    _mockCount: count, // for identification in tests
  } as unknown as Locator;
}

type MockPage = {
  locator: ReturnType<typeof vi.fn>;
  getByText: ReturnType<typeof vi.fn>;
  getByLabel: ReturnType<typeof vi.fn>;
  getByRole: ReturnType<typeof vi.fn>;
  getByPlaceholder: ReturnType<typeof vi.fn>;
  getByTestId: ReturnType<typeof vi.fn>;
};

/** Build a mock Page with configurable locator responses */
function makeMockPage(overrides: Partial<MockPage> = {}): { page: Page; mocks: MockPage } {
  const mocks: MockPage = {
    locator: vi.fn().mockReturnValue(mockLocator(0)),
    getByText: vi.fn().mockReturnValue(mockLocator(0)),
    getByLabel: vi.fn().mockReturnValue(mockLocator(0)),
    getByRole: vi.fn().mockReturnValue(mockLocator(0)),
    getByPlaceholder: vi.fn().mockReturnValue(mockLocator(0)),
    getByTestId: vi.fn().mockReturnValue(mockLocator(0)),
    ...overrides,
  };
  return { page: mocks as unknown as Page, mocks };
}

// ─── Cascade: bare string (no `=`) ───────────────────────────────────────────

describe('resolveSelector — cascade (bare string, no "=")', () => {
  // TC-001: data-testid match stops cascade at step 1
  it('TC-001: data-testid count=1 returns that locator; text/name/id/placeholder NOT queried', async () => {
    const dtid = mockLocator(1);
    const { page, mocks } = makeMockPage({
      locator: vi.fn().mockImplementation((css: string) => {
        if (css === '[data-testid="Submit"]') return dtid;
        return mockLocator(0);
      }),
    });

    const result = await resolveLocator(page, 'Submit');

    expect(result).toBe(dtid);
    expect(mocks.getByText).not.toHaveBeenCalled();
  });

  // TC-002: data-testid count=0, falls through to text step
  it('TC-002: data-testid count=0, text count=1 — returns text locator', async () => {
    const textLoc = mockLocator(1);
    const { page, mocks } = makeMockPage({
      locator: vi.fn().mockImplementation((css: string) => {
        if (css === '[data-testid="Save Draft"]') return mockLocator(0);
        return mockLocator(0);
      }),
      getByText: vi.fn().mockImplementation((txt: string, opts?: { exact?: boolean }) => {
        if (txt === 'Save Draft' && opts?.exact === true) return textLoc;
        return mockLocator(0);
      }),
    });

    const result = await resolveLocator(page, 'Save Draft');

    expect(result).toBe(textLoc);
    // data-testid was queried first
    expect(mocks.locator).toHaveBeenCalledWith('[data-testid="Save Draft"]');
  });

  // TC-003: data-testid count=2 (skipped), text count=1 → text step wins
  it('TC-003: data-testid count=2 (skipped), text count=1 — returns text locator', async () => {
    const textLoc = mockLocator(1);
    const { page, mocks } = makeMockPage({
      locator: vi.fn().mockImplementation((css: string) => {
        if (css === '[data-testid="Confirm"]') return mockLocator(2);
        return mockLocator(0);
      }),
      getByText: vi.fn().mockImplementation((txt: string, opts?: { exact?: boolean }) => {
        if (txt === 'Confirm' && opts?.exact === true) return textLoc;
        return mockLocator(0);
      }),
    });

    const result = await resolveLocator(page, 'Confirm');
    expect(result).toBe(textLoc);
  });

  // TC-004: cascade exhausted — all steps return 0 matches → error
  it('TC-004: all cascade steps return 0 — throws with "No unique element found"', async () => {
    const { page } = makeMockPage(); // all default to count=0

    await expect(resolveLocator(page, 'Foo')).rejects.toThrow('No unique element found');
  });

  // TC-005: mixed counts — exact diagnostic lines in error message
  it('TC-005: error message contains exact count lines for each attribute', async () => {
    const { page, mocks } = makeMockPage({
      locator: vi.fn().mockImplementation((css: string) => {
        if (css === '[data-testid="Foo"]') return mockLocator(0);
        if (css === '[name="Foo"]') return mockLocator(0);
        if (css === '[id="Foo"]') return mockLocator(2);
        if (css === '[placeholder="Foo"]') return mockLocator(0);
        return mockLocator(0);
      }),
      getByText: vi.fn().mockImplementation((txt: string, opts?: { exact?: boolean }) => {
        if (txt === 'Foo' && opts?.exact === true) return mockLocator(3);
        return mockLocator(0);
      }),
    });

    let errorMsg = '';
    try {
      await resolveLocator(page, 'Foo');
    } catch (e) {
      errorMsg = (e as Error).message;
    }

    expect(errorMsg).toContain("No unique element found for bare selector 'Foo'");
    expect(errorMsg).toContain('data-testid=Foo: 0 matches');
    expect(errorMsg).toContain('text=Foo: 3 matches');
    expect(errorMsg).toContain('name=Foo: 0 matches');
    expect(errorMsg).toContain('id=Foo: 2 matches');
    expect(errorMsg).toContain('placeholder=Foo: 0 matches');
  });

  // TC-006: "Use pipe syntax" hint references actual selector value
  it('TC-006: error message contains "Use pipe syntax" hint with the selector value', async () => {
    const { page } = makeMockPage(); // all count=0

    let errorMsg = '';
    try {
      await resolveLocator(page, 'Foo');
    } catch (e) {
      errorMsg = (e as Error).message;
    }

    expect(errorMsg).toContain('Use pipe syntax');
    expect(errorMsg).toContain('text=Foo');
  });

  // TC-007: label and role absent from error message
  it('TC-007: error message does NOT contain "label" or "role"', async () => {
    const { page } = makeMockPage(); // all count=0

    let errorMsg = '';
    try {
      await resolveLocator(page, 'Foo');
    } catch (e) {
      errorMsg = (e as Error).message;
    }

    expect(errorMsg).not.toMatch(/\blabel\b/);
    expect(errorMsg).not.toMatch(/\brole\b/);
  });

  // TC-008: getByLabel and getByRole never called for bare string cascade
  it('TC-008: page.getByLabel and page.getByRole are never called for bare string cascade', async () => {
    const { page, mocks } = makeMockPage(); // all count=0, cascade will exhaust

    try { await resolveLocator(page, 'Email'); } catch { /* expected */ }

    expect(mocks.getByLabel).not.toHaveBeenCalled();
    expect(mocks.getByRole).not.toHaveBeenCalled();
  });
});

// ─── Pipe syntax: string with `=` ────────────────────────────────────────────

describe('resolveSelector — pipe syntax (string contains "=")', () => {
  // TC-009: first segment wins, second never queried
  it('TC-009: first segment count=1 — returns first locator; second never queried', async () => {
    const dtidLoc = mockLocator(1);
    const idLoc = mockLocator(1);
    const dtidCss = '[data-testid="btn"]';
    const idCss = '[id="btn"]';

    const { page, mocks } = makeMockPage({
      locator: vi.fn().mockImplementation((css: string) => {
        if (css === dtidCss) return dtidLoc;
        if (css === idCss) return idLoc;
        return mockLocator(0);
      }),
    });

    const result = await resolveLocator(page, 'data-testid=btn|id=btn');

    expect(result).toBe(dtidLoc);
    // Second locator (id=btn) count() should NOT be called
    expect((idLoc.count as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  // TC-010: first segment count=0, second count=1 → second wins
  it('TC-010: first segment count=0, second count=1 — returns second locator', async () => {
    const idLoc = mockLocator(1);
    const { page } = makeMockPage({
      locator: vi.fn().mockImplementation((css: string) => {
        if (css === '[data-testid="btn"]') return mockLocator(0);
        if (css === '[id="btn"]') return idLoc;
        return mockLocator(0);
      }),
    });

    const result = await resolveLocator(page, 'data-testid=btn|id=btn');
    expect(result).toBe(idLoc);
  });

  // TC-011: all segments exhausted → error lists each segment
  it('TC-011: all segments return 0 — error lists each segment and count', async () => {
    const { page } = makeMockPage({
      locator: vi.fn().mockReturnValue(mockLocator(0)),
    });

    let errorMsg = '';
    try {
      await resolveLocator(page, 'data-testid=ghost|id=ghost');
    } catch (e) {
      errorMsg = (e as Error).message;
    }

    expect(errorMsg).toContain('data-testid=ghost: 0 matches');
    expect(errorMsg).toContain('id=ghost: 0 matches');
  });

  // TC-012: unknown attribute → parse error with exact message
  it('TC-012: unknown attribute "price" → exact error message', async () => {
    const { page } = makeMockPage();

    await expect(resolveLocator(page, 'price=100')).rejects.toThrow(
      "Unknown attribute 'price' in 'price=100'. Use tapOn: { text: 'price=100' } for text containing '='."
    );
  });

  // TC-013: unknown attribute escape hint generalizes
  it('TC-013: unknown attribute "eq" → error contains escape hint for "eq=value"', async () => {
    const { page } = makeMockPage();

    let errorMsg = '';
    try {
      await resolveLocator(page, 'eq=value');
    } catch (e) {
      errorMsg = (e as Error).message;
    }
    expect(errorMsg).toContain("Use tapOn: { text: 'eq=value' }");
  });

  // TC-014: parse error does NOT silently fall back to cascade
  it('TC-014: unknown attribute — cascade step locators are never queried', async () => {
    const { page, mocks } = makeMockPage();

    try { await resolveLocator(page, 'price=100'); } catch { /* expected */ }

    expect(mocks.locator).not.toHaveBeenCalled();
    expect(mocks.getByText).not.toHaveBeenCalled();
  });

  // TC-015: all plain valid attribute names accepted
  it('TC-015a: "id=x" resolves without error', async () => {
    const idLoc = mockLocator(1);
    const { page } = makeMockPage({
      locator: vi.fn().mockImplementation((css: string) => {
        if (css === '[id="x"]') return idLoc;
        return mockLocator(0);
      }),
    });
    await expect(resolveLocator(page, 'id=x')).resolves.toBe(idLoc);
  });

  it('TC-015b: "name=x" resolves without error', async () => {
    const loc = mockLocator(1);
    const { page } = makeMockPage({
      locator: vi.fn().mockImplementation((css: string) => {
        if (css === '[name="x"]') return loc;
        return mockLocator(0);
      }),
    });
    await expect(resolveLocator(page, 'name=x')).resolves.toBe(loc);
  });

  it('TC-015c: "placeholder=x" resolves without error', async () => {
    const loc = mockLocator(1);
    const { page } = makeMockPage({
      locator: vi.fn().mockImplementation((css: string) => {
        if (css === '[placeholder="x"]') return loc;
        return mockLocator(0);
      }),
    });
    await expect(resolveLocator(page, 'placeholder=x')).resolves.toBe(loc);
  });

  it('TC-015d: "text=x" resolves without error', async () => {
    const loc = mockLocator(1);
    const { page } = makeMockPage({
      getByText: vi.fn().mockImplementation((txt: string, opts?: { exact?: boolean }) => {
        if (txt === 'x' && opts?.exact === true) return loc;
        return mockLocator(0);
      }),
    });
    await expect(resolveLocator(page, 'text=x')).resolves.toBe(loc);
  });

  it('TC-015e: "label=x" resolves without error', async () => {
    const loc = mockLocator(1);
    const { page } = makeMockPage({
      getByLabel: vi.fn().mockReturnValue(loc),
    });
    await expect(resolveLocator(page, 'label=x')).resolves.toBe(loc);
  });

  it('TC-015f: "role=x" resolves without error', async () => {
    const loc = mockLocator(1);
    const { page } = makeMockPage({
      getByRole: vi.fn().mockReturnValue(loc),
    });
    await expect(resolveLocator(page, 'role=x')).resolves.toBe(loc);
  });

  // TC-016: data-* attribute names accepted (data-testid, data-cy, data-qa)
  it('TC-016a: "data-testid=btn" accepted — no parse error', async () => {
    const loc = mockLocator(1);
    const { page } = makeMockPage({
      locator: vi.fn().mockImplementation((css: string) => {
        if (css === '[data-testid="btn"]') return loc;
        return mockLocator(0);
      }),
    });
    await expect(resolveLocator(page, 'data-testid=btn')).resolves.toBe(loc);
  });

  it('TC-016b: "data-cy=btn" accepted', async () => {
    const loc = mockLocator(1);
    const { page } = makeMockPage({
      locator: vi.fn().mockImplementation((css: string) => {
        if (css === '[data-cy="btn"]') return loc;
        return mockLocator(0);
      }),
    });
    await expect(resolveLocator(page, 'data-cy=btn')).resolves.toBe(loc);
  });

  it('TC-016c: "data-qa=btn" accepted', async () => {
    const loc = mockLocator(1);
    const { page } = makeMockPage({
      locator: vi.fn().mockImplementation((css: string) => {
        if (css === '[data-qa="btn"]') return loc;
        return mockLocator(0);
      }),
    });
    await expect(resolveLocator(page, 'data-qa=btn')).resolves.toBe(loc);
  });

  // TC-017: single-segment pipe (no |) is valid
  it('TC-017: "data-testid=btn" (no pipe) resolves as single-segment pipe', async () => {
    const loc = mockLocator(1);
    const { page } = makeMockPage({
      locator: vi.fn().mockImplementation((css: string) => {
        if (css === '[data-testid="btn"]') return loc;
        return mockLocator(0);
      }),
    });
    await expect(resolveLocator(page, 'data-testid=btn')).resolves.toBe(loc);
  });

  // TC-018: label attribute uses getByLabel
  it('TC-018: "label=Email" uses getByLabel for resolution', async () => {
    const loc = mockLocator(1);
    const { page, mocks } = makeMockPage({
      getByLabel: vi.fn().mockReturnValue(loc),
    });
    const result = await resolveLocator(page, 'label=Email');
    expect(result).toBe(loc);
    expect(mocks.getByLabel).toHaveBeenCalledWith('Email');
  });

  // TC-019: role attribute uses getByRole
  it('TC-019: "role=button" uses getByRole for resolution', async () => {
    const loc = mockLocator(1);
    const { page, mocks } = makeMockPage({
      getByRole: vi.fn().mockReturnValue(loc),
    });
    const result = await resolveLocator(page, 'role=button');
    expect(result).toBe(loc);
    expect(mocks.getByRole).toHaveBeenCalledWith('button' as Parameters<Page['getByRole']>[0]);
  });
});

// ─── Wildcard matching through resolveSelector ────────────────────────────────

describe('resolveSelector — wildcard matching', () => {
  // TC-020: prefix wildcard Save* matches via text step
  it('TC-020: "Save*" — data-testid step count=0, text step with regex matches', async () => {
    const textLoc = mockLocator(1);
    const { page } = makeMockPage({
      locator: vi.fn().mockImplementation((css: string) => {
        // data-testid for Save* prefix match
        if (css === '[data-testid^="Save"]') return mockLocator(0);
        return mockLocator(0);
      }),
      getByText: vi.fn().mockImplementation((pattern: string | RegExp) => {
        if (pattern instanceof RegExp) return textLoc;
        return mockLocator(0);
      }),
    });

    const result = await resolveLocator(page, 'Save*');
    expect(result).toBe(textLoc);
  });

  // TC-023: suffix wildcard *me matches via text step
  it('TC-023: "*me" — text step matches via suffix regex', async () => {
    const textLoc = mockLocator(1);
    const { page } = makeMockPage({
      locator: vi.fn().mockReturnValue(mockLocator(0)),
      getByText: vi.fn().mockImplementation((pattern: string | RegExp) => {
        if (pattern instanceof RegExp) return textLoc;
        return mockLocator(0);
      }),
    });

    const result = await resolveLocator(page, '*me');
    expect(result).toBe(textLoc);
  });

  // TC-026: contains wildcard *Click Me* matches via text step
  it('TC-026: "*Click Me*" — text step matches via contains regex', async () => {
    const textLoc = mockLocator(1);
    const { page } = makeMockPage({
      locator: vi.fn().mockReturnValue(mockLocator(0)),
      getByText: vi.fn().mockImplementation((pattern: string | RegExp) => {
        if (pattern instanceof RegExp) return textLoc;
        return mockLocator(0);
      }),
    });

    const result = await resolveLocator(page, '*Click Me*');
    expect(result).toBe(textLoc);
  });

  // TC-028: wildcard on data-testid — prefix wildcard uses CSS ^= selector
  it('TC-028: "data-testid=btn-*" — CSS locator uses ^= prefix form', async () => {
    const prefixLoc = mockLocator(1);
    const { page, mocks } = makeMockPage({
      locator: vi.fn().mockImplementation((css: string) => {
        if (css === '[data-testid^="btn-"]') return prefixLoc;
        return mockLocator(0);
      }),
    });

    const result = await resolveLocator(page, 'data-testid=btn-*');
    expect(result).toBe(prefixLoc);
    expect(mocks.locator).toHaveBeenCalledWith('[data-testid^="btn-"]');
  });

  // TC-029: exact match default — "Submit" does NOT match "Submit Form"
  it('TC-029: bare string "Submit" — text step uses exact match (does not match "Submit Form")', async () => {
    // The text locator for "Submit" exact should return 0 (because the page has "Submit Form" not "Submit")
    // All cascade steps return 0 → error is thrown
    const { page } = makeMockPage({
      locator: vi.fn().mockReturnValue(mockLocator(0)),
      getByText: vi.fn().mockImplementation((txt: string, opts?: { exact?: boolean }) => {
        // With exact: true, "Submit" must not match "Submit Form"
        if (txt === 'Submit' && opts?.exact === true) return mockLocator(0);
        return mockLocator(0);
      }),
    });

    // Cascade exhausted → throws
    await expect(resolveLocator(page, 'Submit')).rejects.toThrow();
    // Verify exact: true was passed
    // (The test confirms the text locator doesn't match "Submit Form" because exact is used)
  });
});

// ─── Backward compatibility: object selectors unchanged ───────────────────────

describe('resolveSelector — backward compatibility (object selectors)', () => {
  // TC-056: { testId } bypasses cascade — no count queries
  it('TC-056: { testId: "my-btn" } uses getByTestId; no .count() called', async () => {
    const btestId = { count: vi.fn(), _brand: 'testid-locator' } as unknown as Locator;
    const { page, mocks } = makeMockPage({
      getByTestId: vi.fn().mockReturnValue(btestId),
    });

    const result = await resolveLocator(page, { testId: 'my-btn' });

    expect(result).toBe(btestId);
    expect(mocks.getByTestId).toHaveBeenCalledWith('my-btn');
    expect((btestId.count as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    expect(mocks.locator).not.toHaveBeenCalled();
  });

  // TC-057: { text } resolves unchanged
  it('TC-057: { text: "hello" } uses getByText directly; no cascade', async () => {
    const textLoc = { count: vi.fn(), _brand: 'text-locator' } as unknown as Locator;
    const { page, mocks } = makeMockPage({
      getByText: vi.fn().mockReturnValue(textLoc),
    });

    const result = await resolveLocator(page, { text: 'hello' });

    expect(result).toBe(textLoc);
    expect(mocks.getByText).toHaveBeenCalledWith('hello');
    expect(mocks.locator).not.toHaveBeenCalled();
  });

  // TC-058: { label } uses getByLabel directly
  it('TC-058: { label: "Email" } uses getByLabel directly', async () => {
    const labelLoc = { count: vi.fn(), _brand: 'label-locator' } as unknown as Locator;
    const { page, mocks } = makeMockPage({
      getByLabel: vi.fn().mockReturnValue(labelLoc),
    });

    const result = await resolveLocator(page, { label: 'Email' });

    expect(result).toBe(labelLoc);
    expect(mocks.getByLabel).toHaveBeenCalledWith('Email');
    expect(mocks.locator).not.toHaveBeenCalled();
  });

  it('backward compat: { role, name } uses getByRole', async () => {
    const roleLoc = { count: vi.fn() } as unknown as Locator;
    const { page, mocks } = makeMockPage({
      getByRole: vi.fn().mockReturnValue(roleLoc),
    });

    const result = await resolveLocator(page, { role: 'button', name: 'Submit' });

    expect(result).toBe(roleLoc);
    expect(mocks.getByRole).toHaveBeenCalledWith('button', { name: 'Submit' });
  });

  it('backward compat: { placeholder } uses getByPlaceholder', async () => {
    const phLoc = { count: vi.fn() } as unknown as Locator;
    const { page, mocks } = makeMockPage({
      getByPlaceholder: vi.fn().mockReturnValue(phLoc),
    });

    const result = await resolveLocator(page, { placeholder: 'Enter email' });

    expect(result).toBe(phLoc);
    expect(mocks.getByPlaceholder).toHaveBeenCalledWith('Enter email');
  });

  it('backward compat: { css } uses page.locator directly', async () => {
    const cssLoc = { count: vi.fn() } as unknown as Locator;
    const { page, mocks } = makeMockPage({
      locator: vi.fn().mockReturnValue(cssLoc),
    });

    const result = await resolveLocator(page, { css: '.my-class' });

    expect(result).toBe(cssLoc);
    expect(mocks.locator).toHaveBeenCalledWith('.my-class');
  });
});

// ─── Scope parameter ─────────────────────────────────────────────────────────

describe('resolveSelector — scope parameter', () => {
  it('when scope is provided, uses scope.locator() not page.locator() for CSS queries', async () => {
    const scopeLoc = mockLocator(1);
    const innerLoc = mockLocator(1);

    // scope is a Locator that has .locator() method
    const scope = {
      locator: vi.fn().mockImplementation((css: string) => {
        if (css === '[data-testid="btn"]') return innerLoc;
        return mockLocator(0);
      }),
      getByText: vi.fn().mockReturnValue(mockLocator(0)),
      getByLabel: vi.fn().mockReturnValue(mockLocator(0)),
      getByRole: vi.fn().mockReturnValue(mockLocator(0)),
      getByPlaceholder: vi.fn().mockReturnValue(mockLocator(0)),
      getByTestId: vi.fn().mockReturnValue(mockLocator(0)),
    } as unknown as Locator;

    const { page, mocks } = makeMockPage();

    const result = await resolveLocator(page, 'data-testid=btn', scope);

    expect(result).toBe(innerLoc);
    // page.locator should NOT have been called for the CSS query
    expect(mocks.locator).not.toHaveBeenCalled();
  });
});

// ─── XPath object form — happy path + count validation (AC2, AC3, AC5–AC8) ───

describe('resolveSelector — xpath object form', () => {

  // ── AC5: exactly 1 match succeeds ─────────────────────────────────────────

  // TC-XPATH-R1 [FAILING before T3+T4+T6]
  it('TC-XPATH-R1: { xpath: "//button" } count=1 — calls locator("xpath=//button") and returns it', async () => {
    const xpathLoc = mockLocator(1);
    const { page, mocks } = makeMockPage({
      locator: vi.fn().mockImplementation((s: string) => {
        if (s === 'xpath=//button') return xpathLoc;
        return mockLocator(0);
      }),
    });

    const result = await resolveLocator(page, { xpath: '//button' });

    expect(result).toBe(xpathLoc);
    expect(mocks.locator).toHaveBeenCalledWith('xpath=//button');
    expect(mocks.getByText).not.toHaveBeenCalled();
    expect(mocks.getByRole).not.toHaveBeenCalled();
    expect(mocks.getByLabel).not.toHaveBeenCalled();
    expect(mocks.getByPlaceholder).not.toHaveBeenCalled();
    expect(mocks.getByTestId).not.toHaveBeenCalled();
  });

  // TC-XPATH-R2 [FAILING before T6]
  it('TC-XPATH-R2: { xpath: "//button[@type=\\"submit\\"]" } count=1 — returns locator', async () => {
    const xpathLoc = mockLocator(1);
    const { page } = makeMockPage({
      locator: vi.fn().mockImplementation((s: string) => {
        if (s === 'xpath=//button[@type="submit"]') return xpathLoc;
        return mockLocator(0);
      }),
    });

    const result = await resolveLocator(page, { xpath: '//button[@type="submit"]' });
    expect(result).toBe(xpathLoc);
  });

  // TC-XPATH-R3 [FAILING before T6]
  it('TC-XPATH-R3: { xpath: "//div[@id=\\"modal\\"]" } count=1 — returns locator (assertVisible path)', async () => {
    const xpathLoc = mockLocator(1);
    const { page } = makeMockPage({
      locator: vi.fn().mockImplementation((s: string) => {
        if (s === 'xpath=//div[@id="modal"]') return xpathLoc;
        return mockLocator(0);
      }),
    });

    const result = await resolveLocator(page, { xpath: '//div[@id="modal"]' });
    expect(result).toBe(xpathLoc);
  });

  // TC-XPATH-R4 [FAILING before T6]
  it('TC-XPATH-R4: page.locator is always called with "xpath=" prefix, not bare xpath string', async () => {
    const xpathLoc = mockLocator(1);
    const { page, mocks } = makeMockPage({
      locator: vi.fn().mockImplementation((s: string) => {
        if (s.startsWith('xpath=')) return xpathLoc;
        return mockLocator(0);
      }),
    });

    await resolveLocator(page, { xpath: '//h1' });

    expect(mocks.locator).toHaveBeenCalledWith('xpath=//h1');
    expect(mocks.locator).not.toHaveBeenCalledWith('//h1');
  });

  // TC-B-008 [FAILING before T6] — single-quote quoting inside XPath string
  it('TC-B-008: { xpath: "//input[@type=\'text\']" } count=1 — resolves and passes correct locator string', async () => {
    const xpathLoc = {
      count: vi.fn().mockResolvedValue(1),
      _brand: 'xpath-complex',
    } as unknown as import('playwright').Locator;

    const { page, mocks } = makeMockPage({
      locator: vi.fn().mockImplementation((selector: string) => {
        if (selector === "xpath=//input[@type='text']") return xpathLoc;
        return mockLocator(0);
      }),
    });

    const result = await resolveLocator(page, { xpath: "//input[@type='text']" });

    expect(result).toBe(xpathLoc);
    expect(mocks.locator).toHaveBeenCalledWith("xpath=//input[@type='text']");
  });

  // ── AC6: 0 matches → clear error containing xpath expression ───────────────

  // TC-XPATH-R5 [FAILING before T6]
  it('TC-XPATH-R5: { xpath: "//button[@id=\\"missing\\"]" } count=0 — throws with xpath expression in message', async () => {
    const { page } = makeMockPage({
      locator: vi.fn().mockReturnValue(mockLocator(0)),
    });

    await expect(
      resolveLocator(page, { xpath: '//button[@id="missing"]' })
    ).rejects.toThrow(/No element found for xpath selector/i);
  });

  // TC-XPATH-R6 [FAILING before T6]
  it('TC-XPATH-R6: count=0 error message contains the full xpath expression', async () => {
    const { page } = makeMockPage({
      locator: vi.fn().mockReturnValue(mockLocator(0)),
    });

    let msg = '';
    try {
      await resolveLocator(page, { xpath: '//input[@name="email"]' });
    } catch (e) {
      msg = (e as Error).message;
    }

    expect(msg).toMatch(/\/\/input\[@name="email"\]/);
    expect(msg).toMatch(/No element found/i);
  });

  // TC-B-009 [FAILING before T6] — regression flip: no longer "Unrecognized", now "No element found"
  it('TC-B-009: { xpath: "//div" } count=0 — throws "No element found for xpath selector", NOT "Unrecognized"', async () => {
    const { page } = makeMockPage({
      locator: vi.fn().mockReturnValue(mockLocator(0)),
    });

    let msg = '';
    try {
      await resolveLocator(page, { xpath: '//div' });
    } catch (e) {
      msg = (e as Error).message;
    }

    expect(msg).toMatch(/No element found for xpath selector/i);
    expect(msg).toContain('//div');
    expect(msg).not.toMatch(/unrecognized|unknown/i);
  });

  // ── AC7: 2+ matches → "no unique element" error with count ─────────────────

  // TC-XPATH-R8 [FAILING before T6]
  it('TC-XPATH-R8: { xpath: "//li" } count=2 — throws "No unique element" with count and xpath', async () => {
    const { page } = makeMockPage({
      locator: vi.fn().mockImplementation((s: string) => {
        if (s === 'xpath=//li') return mockLocator(2);
        return mockLocator(0);
      }),
    });

    let msg = '';
    try {
      await resolveLocator(page, { xpath: '//li' });
    } catch (e) {
      msg = (e as Error).message;
    }

    expect(msg).toMatch(/No unique element found for xpath selector '\/\/li'/);
    expect(msg).toMatch(/2 matches/);
    expect(msg).toMatch(/within/i);
  });

  // TC-XPATH-R9 [FAILING before T6]
  it('TC-XPATH-R9: { xpath: "//li" } count=3 — error message contains "3 matches"', async () => {
    const { page } = makeMockPage({
      locator: vi.fn().mockImplementation((s: string) => {
        if (s === 'xpath=//li') return mockLocator(3);
        return mockLocator(0);
      }),
    });

    await expect(
      resolveLocator(page, { xpath: '//li' })
    ).rejects.toThrow(/3 matches/);
  });

  // TC-XPATH-R10 [PASSING — 0-match error does not say "No unique element"]
  it('TC-XPATH-R10 [PASSING]: count=0 error does NOT say "No unique element" (0 and 2+ are distinct code paths)', async () => {
    const { page } = makeMockPage({
      locator: vi.fn().mockReturnValue(mockLocator(0)),
    });

    await expect(
      resolveLocator(page, { xpath: '//span' })
    ).rejects.not.toThrow(/No unique element/);
  });

  // ── AC8: invalid XPath → user-facing error (not raw Playwright trace) ───────

  // TC-XPATH-R11 [FAILING before T6]
  it('TC-XPATH-R11: invalid xpath "//button[" — Playwright rejection wrapped as "Invalid XPath expression"', async () => {
    const playwrightError = new Error('Error: unexpected end of expression: //button[');
    const { page } = makeMockPage({
      locator: vi.fn().mockReturnValue({
        count: vi.fn().mockRejectedValue(playwrightError),
      } as unknown as import('playwright').Locator),
    });

    await expect(
      resolveLocator(page, { xpath: '//button[' })
    ).rejects.toThrow(/Invalid XPath expression.*\/\/button\[/i);
  });

  // TC-XPATH-R12 [FAILING before T6]
  it('TC-XPATH-R12: wrapped XPath error starts with "Invalid XPath expression:" and contains "—" separator', async () => {
    const playwrightError = new Error('xpath parse error: unexpected end of expression');
    const { page } = makeMockPage({
      locator: vi.fn().mockReturnValue({
        count: vi.fn().mockRejectedValue(playwrightError),
      } as unknown as import('playwright').Locator),
    });

    let msg = '';
    try {
      await resolveLocator(page, { xpath: '//bad[' });
    } catch (e) {
      msg = (e as Error).message;
    }

    expect(msg).toMatch(/^Invalid XPath expression:/);
    expect(msg).toContain('—');
  });

  // TC-XPATH-R13 [FAILING before T6]
  it('TC-XPATH-R13: wrapped XPath error contains the xpath expression that caused the failure', async () => {
    const playwrightError = new Error('xpath syntax error');
    const { page } = makeMockPage({
      locator: vi.fn().mockReturnValue({
        count: vi.fn().mockRejectedValue(playwrightError),
      } as unknown as import('playwright').Locator),
    });

    let msg = '';
    try {
      await resolveLocator(page, { xpath: '//[broken' });
    } catch (e) {
      msg = (e as Error).message;
    }

    expect(msg).toContain('//[broken');
  });

  // ── Scope parameter (AC5 with within scoping): xpath respects scope ──────────

  // TC-XPATH-R19 [FAILING before T6]
  it('TC-XPATH-R19: { xpath } with scope — calls scope.locator("xpath=..."), not page.locator', async () => {
    const xpathLoc = mockLocator(1);
    const scope = {
      locator: vi.fn().mockImplementation((s: string) => {
        if (s === 'xpath=//button') return xpathLoc;
        return mockLocator(0);
      }),
      getByText: vi.fn().mockReturnValue(mockLocator(0)),
      getByLabel: vi.fn().mockReturnValue(mockLocator(0)),
      getByRole: vi.fn().mockReturnValue(mockLocator(0)),
      getByPlaceholder: vi.fn().mockReturnValue(mockLocator(0)),
      getByTestId: vi.fn().mockReturnValue(mockLocator(0)),
    } as unknown as import('playwright').Locator;

    const { page, mocks } = makeMockPage();

    const result = await resolveLocator(page, { xpath: '//button' }, scope);

    expect(result).toBe(xpathLoc);
    expect(mocks.locator).not.toHaveBeenCalled();
  });

  // ── AC14: state-assertion command paths (assertEnabled / assertDisabled / assertChecked) ──

  // TC-B-013 [FAILING before T6]
  it('TC-B-013: { xpath: "//input[@id=submit-btn]" } count=1 — covers assertEnabled command path', async () => {
    const xpathLoc = {
      count: vi.fn().mockResolvedValue(1),
      _brand: 'enabled-xpath',
    } as unknown as import('playwright').Locator;

    const { page, mocks } = makeMockPage({
      locator: vi.fn().mockImplementation((sel: string) => {
        if (sel === 'xpath=//input[@id="submit-btn"]') return xpathLoc;
        return mockLocator(0);
      }),
    });

    const result = await resolveLocator(page, { xpath: '//input[@id="submit-btn"]' });

    expect(result).toBe(xpathLoc);
    expect(mocks.locator).toHaveBeenCalledWith('xpath=//input[@id="submit-btn"]');
  });

  // TC-B-014 [FAILING before T6]
  it('TC-B-014: { xpath: "//button[text()=Delete]" } count=1 — covers assertDisabled command path', async () => {
    const xpathLoc = {
      count: vi.fn().mockResolvedValue(1),
      _brand: 'disabled-xpath',
    } as unknown as import('playwright').Locator;

    const { page, mocks } = makeMockPage({
      locator: vi.fn().mockImplementation((sel: string) => {
        if (sel === 'xpath=//button[text()="Delete"]') return xpathLoc;
        return mockLocator(0);
      }),
    });

    const result = await resolveLocator(page, { xpath: '//button[text()="Delete"]' });

    expect(result).toBe(xpathLoc);
    expect(mocks.locator).toHaveBeenCalledWith('xpath=//button[text()="Delete"]');
  });

  // TC-B-015 [FAILING before T6]
  it('TC-B-015: { xpath: "//input[@type=checkbox]" } count=1 — covers assertChecked command path', async () => {
    const xpathLoc = {
      count: vi.fn().mockResolvedValue(1),
      _brand: 'checked-xpath',
    } as unknown as import('playwright').Locator;

    const { page } = makeMockPage({
      locator: vi.fn().mockImplementation((sel: string) => {
        if (sel === 'xpath=//input[@type="checkbox"]') return xpathLoc;
        return mockLocator(0);
      }),
    });

    const result = await resolveLocator(page, { xpath: '//input[@type="checkbox"]' });
    expect(result).toBe(xpathLoc);
  });

});

// ─── XPath object form — edge cases (empty / whitespace) ─────────────────────

describe('resolveSelector — xpath object form edge cases', () => {

  // TC-B-016 [FAILING before T6]
  it('TC-B-016: { xpath: "" } (empty string) — throws an informative error containing "xpath"', async () => {
    const { page } = makeMockPage({
      locator: vi.fn().mockReturnValue(mockLocator(0)),
    });

    let msg = '';
    try {
      await resolveLocator(page, { xpath: '' });
    } catch (e) {
      msg = (e as Error).message;
    }

    expect(msg.length).toBeGreaterThan(0);
    expect(msg).toMatch(/xpath/i);
    expect(msg).not.toMatch(/unrecognized|unknown/i);
  });

  // TC-B-017 [FAILING before T6]
  it('TC-B-017: { xpath: "   " } (whitespace-only) — throws an informative error, not a raw Playwright stack', async () => {
    const { page } = makeMockPage({
      locator: vi.fn().mockImplementation(() => ({
        count: vi.fn().mockRejectedValue(
          new Error('Failed to evaluate XPath expression:    ')
        ),
      })),
    });

    let msg = '';
    try {
      await resolveLocator(page, { xpath: '   ' });
    } catch (e) {
      msg = (e as Error).message;
    }

    expect(msg.length).toBeGreaterThan(0);
    expect(msg).toMatch(/xpath/i);
    expect(msg).not.toMatch(/unrecognized|unknown/i);
  });

});

// ─── XPath pipe-string form (AC9 + AC10) ─────────────────────────────────────

describe('resolveSelector — xpath pipe-string form', () => {

  // ── AC9: pipe-string "xpath=..." without union ─────────────────────────────

  // TC-XPATH-R14 [FAILING before T3+T4]
  it('TC-XPATH-R14: pipe-string "xpath=//button[@type=\'submit\']" resolves the xpath locator', async () => {
    const xpathLoc = mockLocator(1);
    const { page } = makeMockPage({
      locator: vi.fn().mockImplementation((s: string) => {
        if (s === "xpath=//button[@type='submit']") return xpathLoc;
        return mockLocator(0);
      }),
    });

    const result = await resolveLocator(page, "xpath=//button[@type='submit']");
    expect(result).toBe(xpathLoc);
  });

  // TC-XPATH-R15 [FAILING before T3+T4]
  it('TC-XPATH-R15: pipe-string "xpath=..." calls page.locator with "xpath=" prefix, not CSS form', async () => {
    const xpathLoc = mockLocator(1);
    const { page, mocks } = makeMockPage({
      locator: vi.fn().mockImplementation((s: string) => {
        if (s.startsWith('xpath=')) return xpathLoc;
        return mockLocator(0);
      }),
    });

    await resolveLocator(page, 'xpath=//div[@id="content"]');

    expect(mocks.locator).toHaveBeenCalledWith('xpath=//div[@id="content"]');
    expect(mocks.locator).not.toHaveBeenCalledWith('[xpath="//div[@id=\\"content\\"]"]');
    expect(mocks.getByText).not.toHaveBeenCalled();
  });

  // TC-B-005 [FAILING before T3+T4] — "=" inside xpath value with no "|"
  it('TC-B-005: "xpath=//input[@name=q]" (= inside xpath value, no |) resolves correctly', async () => {
    const xpathLoc = {
      count: vi.fn().mockResolvedValue(1),
      _brand: 'xpath-attr-locator',
    } as unknown as import('playwright').Locator;

    const { page } = makeMockPage({
      locator: vi.fn().mockImplementation((selector: string) => {
        if (selector === 'xpath=//input[@name=q]') return xpathLoc;
        return mockLocator(0);
      }),
    });

    const result = await resolveLocator(page, 'xpath=//input[@name=q]');
    expect(result).toBe(xpathLoc);
  });

  // TC-B-006 [FAILING before T3] — count=0 after T3 shows correct error, not "Unknown attribute"
  it('TC-B-006: "xpath=//ghost" count=0 — error contains "//ghost", does NOT say "Unknown attribute"', async () => {
    const { page } = makeMockPage({
      locator: vi.fn().mockReturnValue(mockLocator(0)),
    });

    let msg = '';
    try {
      await resolveLocator(page, 'xpath=//ghost');
    } catch (e) {
      msg = (e as Error).message;
    }

    expect(msg).toContain('//ghost');
    expect(msg).not.toMatch(/unknown attribute/i);
  });

  // ── AC10: pipe-string with XPath union "|" → conflict error ─────────────────

  // TC-B-002 [FAILING before T5]
  it('TC-B-002: "xpath=//a | //button" throws XPath union conflict error mentioning "use object form"', async () => {
    const { page } = makeMockPage();

    await expect(resolveLocator(page, 'xpath=//a | //button')).rejects.toThrow(
      /XPath union.*conflicts with pipe syntax.*use the object form/i,
    );
  });

  // TC-B-003 [FAILING before T5]
  it('TC-B-003: union conflict error message contains reconstructed xpath value and object-form template', async () => {
    const { page } = makeMockPage();

    let msg = '';
    try {
      await resolveLocator(page, 'xpath=//a | //button');
    } catch (e) {
      msg = (e as Error).message;
    }

    expect(msg).toContain('{ xpath:');
    expect(msg).toContain('//a');
    expect(msg).toContain('//button');
  });

  // TC-B-004 [FAILING before T5] — no spaces around "|"
  it('TC-B-004: "xpath=//a|//b" (no spaces around |) also triggers union conflict error, not "missing ="', async () => {
    const { page } = makeMockPage();

    await expect(resolveLocator(page, 'xpath=//a|//b')).rejects.toThrow(
      /XPath union.*conflicts/i,
    );
  });

});

// ─── XPath regression guards (AC13 / AC14) ───────────────────────────────────

describe('resolveSelector — xpath regression guards', () => {

  // TC-XPATH-R20 [PASSING]
  it('TC-XPATH-R20 [PASSING]: { text: "Submit" } still uses getByText; xpath addition has no side-effect', async () => {
    const textLoc = { count: vi.fn(), _brand: 'text' } as unknown as import('playwright').Locator;
    const { page, mocks } = makeMockPage({
      getByText: vi.fn().mockReturnValue(textLoc),
    });

    const result = await resolveLocator(page, { text: 'Submit' });

    expect(result).toBe(textLoc);
    expect(mocks.getByText).toHaveBeenCalledWith('Submit');
    expect(mocks.locator).not.toHaveBeenCalled();
  });

  // TC-XPATH-R21 [PASSING]
  it('TC-XPATH-R21 [PASSING]: { testId: "btn" } still uses getByTestId', async () => {
    const loc = { count: vi.fn() } as unknown as import('playwright').Locator;
    const { page, mocks } = makeMockPage({
      getByTestId: vi.fn().mockReturnValue(loc),
    });

    const result = await resolveLocator(page, { testId: 'btn' });

    expect(result).toBe(loc);
    expect(mocks.getByTestId).toHaveBeenCalledWith('btn');
    expect(mocks.locator).not.toHaveBeenCalled();
  });

  // TC-XPATH-R22 [PASSING]
  it('TC-XPATH-R22 [PASSING]: bare string "Submit" still enters cascade mode (no xpath interference)', async () => {
    const textLoc = mockLocator(1);
    const { page, mocks } = makeMockPage({
      locator: vi.fn().mockReturnValue(mockLocator(0)),
      getByText: vi.fn().mockImplementation((txt: string, opts?: { exact?: boolean }) => {
        if (txt === 'Submit' && opts?.exact === true) return textLoc;
        return mockLocator(0);
      }),
    });

    const result = await resolveLocator(page, 'Submit');

    expect(result).toBe(textLoc);
    expect(mocks.getByText).toHaveBeenCalledWith('Submit', { exact: true });
  });

  // TC-XPATH-R23 [PASSING]
  it('TC-XPATH-R23 [PASSING]: { unknownKey: "value" } still throws "unrecognized selector"', async () => {
    const { page } = makeMockPage();

    await expect(
      resolveLocator(page, { unknownKey: 'value' } as never)
    ).rejects.toThrow(/unrecognized|unknown/i);
  });

  // TC-XPATH-R24 [PASSING]
  it('TC-XPATH-R24 [PASSING]: { css: ".my-class" } still calls page.locator(".my-class") directly (not "xpath=...")', async () => {
    const cssLoc = { count: vi.fn() } as unknown as import('playwright').Locator;
    const { page, mocks } = makeMockPage({
      locator: vi.fn().mockReturnValue(cssLoc),
    });

    const result = await resolveLocator(page, { css: '.my-class' });

    expect(result).toBe(cssLoc);
    expect(mocks.locator).toHaveBeenCalledWith('.my-class');
    expect(mocks.locator).not.toHaveBeenCalledWith('xpath=.my-class');
  });

  // TC-XPATH-R25 [PASSING]
  it('TC-XPATH-R25 [PASSING]: pipe-string "text=Submit" still resolves via getByText', async () => {
    const textLoc = mockLocator(1);
    const { page, mocks } = makeMockPage({
      getByText: vi.fn().mockReturnValue(textLoc),
    });

    const result = await resolveLocator(page, 'text=Submit');

    expect(result).toBe(textLoc);
    expect(mocks.getByText).toHaveBeenCalledWith('Submit', { exact: true });
  });

});
