import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Page, Locator } from 'playwright';
import {
  resolveLocator,
  resolveContainerLocator,
  resolveNotVisible,
  selectorLabel,
  buildSteps,
  pollSteps,
} from './playwrightLocator.js';
import { createDeadline, type Clock, type Deadline } from './deadline.js';
import type { Selector } from './types.js';

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

/** Deterministic clock: `sleep` advances time instantly. */
function makeFakeClock(): Clock & { sleeps: number[] } {
  let t = 0;
  const sleeps: number[] = [];
  return {
    now: () => t,
    sleep: async (ms: number) => { sleeps.push(ms); t += ms; },
    sleeps,
  };
}

/** A 1000 ms deadline on a fake clock: resolver tests that never match end instantly. */
function shortDeadline(): Deadline {
  return createDeadline(1000, makeFakeClock());
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
  it('TC-004: all cascade steps return 0 — throws with "Element not found after <T>ms"', async () => {
    const { page } = makeMockPage(); // all default to count=0

    await expect(resolveLocator(page, 'Foo', undefined, shortDeadline())).rejects.toThrow('Element not found after 1000ms: Foo');
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
      await resolveLocator(page, 'Foo', undefined, shortDeadline());
    } catch (e) {
      errorMsg = (e as Error).message;
    }

    expect(errorMsg).toContain('Element not found after 1000ms: Foo');
    expect(errorMsg).toContain('data-testid=Foo: 0 matches');
    expect(errorMsg).toContain('text=Foo: 3 matches');
    expect(errorMsg).toContain('name=Foo: 0 matches');
    expect(errorMsg).toContain('id=Foo: 2 matches');
    expect(errorMsg).toContain('placeholder=Foo: 0 matches');
  });

  // TC-006: "Use pipe syntax" hint references actual selector value
  it('TC-006: error message header names the selector and lists the text step (replaces the "Use pipe syntax" hint, AC14)', async () => {
    const { page } = makeMockPage(); // all count=0

    let errorMsg = '';
    try {
      await resolveLocator(page, 'Foo', undefined, shortDeadline());
    } catch (e) {
      errorMsg = (e as Error).message;
    }

    expect(errorMsg.split('\n')[0]).toBe('Element not found after 1000ms: Foo');
    expect(errorMsg).toContain('  text=Foo: 0 matches');
  });

  // TC-007: label and role absent from error message
  it('TC-007: error message does NOT contain "label" or "role"', async () => {
    const { page } = makeMockPage(); // all count=0

    let errorMsg = '';
    try {
      await resolveLocator(page, 'Foo', undefined, shortDeadline());
    } catch (e) {
      errorMsg = (e as Error).message;
    }

    expect(errorMsg).not.toMatch(/\blabel\b/);
    expect(errorMsg).not.toMatch(/\brole\b/);
  });

  // TC-008: getByLabel and getByRole never called for bare string cascade
  it('TC-008: page.getByLabel and page.getByRole are never called for bare string cascade', async () => {
    const { page, mocks } = makeMockPage(); // all count=0, cascade will exhaust

    try { await resolveLocator(page, 'Email', undefined, shortDeadline()); } catch { /* expected */ }

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
      await resolveLocator(page, 'data-testid=ghost|id=ghost', undefined, shortDeadline());
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
    await expect(resolveLocator(page, 'Submit', undefined, shortDeadline())).rejects.toThrow();
    // Verify exact: true was passed
    // (The test confirms the text locator doesn't match "Submit Form" because exact is used)
  });
});

// ─── Backward compatibility: object selectors unchanged ───────────────────────

describe('resolveSelector — backward compatibility (object selectors)', () => {
  // TC-056: { testId } bypasses cascade — no count queries
  it('TC-056: { testId: "my-btn" } uses getByTestId; .count() called once (single step, AC6)', async () => {
    const btestId = { count: vi.fn().mockResolvedValue(1), _brand: 'testid-locator' } as unknown as Locator;
    const { page, mocks } = makeMockPage({
      getByTestId: vi.fn().mockReturnValue(btestId),
    });

    const result = await resolveLocator(page, { testId: 'my-btn' });

    expect(result).toBe(btestId);
    expect(mocks.getByTestId).toHaveBeenCalledWith('my-btn');
    expect((btestId.count as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    expect(mocks.locator).not.toHaveBeenCalled();
  });

  // TC-057: { text } resolves unchanged
  it('TC-057: { text: "hello" } uses getByText directly; no cascade', async () => {
    const textLoc = { count: vi.fn().mockResolvedValue(1), _brand: 'text-locator' } as unknown as Locator;
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
    const labelLoc = { count: vi.fn().mockResolvedValue(1), _brand: 'label-locator' } as unknown as Locator;
    const { page, mocks } = makeMockPage({
      getByLabel: vi.fn().mockReturnValue(labelLoc),
    });

    const result = await resolveLocator(page, { label: 'Email' });

    expect(result).toBe(labelLoc);
    expect(mocks.getByLabel).toHaveBeenCalledWith('Email');
    expect(mocks.locator).not.toHaveBeenCalled();
  });

  it('backward compat: { role, name } uses getByRole', async () => {
    const roleLoc = { count: vi.fn().mockResolvedValue(1) } as unknown as Locator;
    const { page, mocks } = makeMockPage({
      getByRole: vi.fn().mockReturnValue(roleLoc),
    });

    const result = await resolveLocator(page, { role: 'button', name: 'Submit' });

    expect(result).toBe(roleLoc);
    expect(mocks.getByRole).toHaveBeenCalledWith('button', { name: 'Submit' });
  });

  it('backward compat: { placeholder } uses getByPlaceholder', async () => {
    const phLoc = { count: vi.fn().mockResolvedValue(1) } as unknown as Locator;
    const { page, mocks } = makeMockPage({
      getByPlaceholder: vi.fn().mockReturnValue(phLoc),
    });

    const result = await resolveLocator(page, { placeholder: 'Enter email' });

    expect(result).toBe(phLoc);
    expect(mocks.getByPlaceholder).toHaveBeenCalledWith('Enter email');
  });

  it('backward compat: { css } uses page.locator directly', async () => {
    const cssLoc = { count: vi.fn().mockResolvedValue(1) } as unknown as Locator;
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
      resolveLocator(page, { xpath: '//button[@id="missing"]' }, undefined, shortDeadline())
    ).rejects.toThrow('Element not found after 1000ms: {"xpath":"//button[@id=\\"missing\\"]"}');
  });

  // TC-XPATH-R6 [FAILING before T6]
  it('TC-XPATH-R6: count=0 error message contains the full xpath expression', async () => {
    const { page } = makeMockPage({
      locator: vi.fn().mockReturnValue(mockLocator(0)),
    });

    let msg = '';
    try {
      await resolveLocator(page, { xpath: '//input[@name="email"]' }, undefined, shortDeadline());
    } catch (e) {
      msg = (e as Error).message;
    }

    expect(msg).toContain('//input[@name=\\"email\\"]');
    expect(msg).toMatch(/^Element not found after 1000ms:/);
  });

  // TC-B-009 [FAILING before T6] — regression flip: no longer "Unrecognized", now "No element found"
  it('TC-B-009: { xpath: "//div" } count=0 — throws "Element not found after <T>ms", NOT "Unrecognized"', async () => {
    const { page } = makeMockPage({
      locator: vi.fn().mockReturnValue(mockLocator(0)),
    });

    let msg = '';
    try {
      await resolveLocator(page, { xpath: '//div' }, undefined, shortDeadline());
    } catch (e) {
      msg = (e as Error).message;
    }

    expect(msg).toBe('Element not found after 1000ms: {"xpath":"//div"}\n  {"xpath":"//div"}: 0 matches');
    expect(msg).toContain('//div');
    expect(msg).not.toMatch(/unrecognized|unknown/i);
  });

  // ── AC7: 2+ matches → "no unique element" error with count ─────────────────

  // TC-XPATH-R8 [FAILING before T6]
  it('TC-XPATH-R8: { xpath: "//li" } count=2 — not-found error reports the 2 matches', async () => {
    const { page } = makeMockPage({
      locator: vi.fn().mockImplementation((s: string) => {
        if (s === 'xpath=//li') return mockLocator(2);
        return mockLocator(0);
      }),
    });

    let msg = '';
    try {
      await resolveLocator(page, { xpath: '//li' }, undefined, shortDeadline());
    } catch (e) {
      msg = (e as Error).message;
    }

    expect(msg).toBe('Element not found after 1000ms: {"xpath":"//li"}\n  {"xpath":"//li"}: 2 matches');
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
      resolveLocator(page, { xpath: '//li' }, undefined, shortDeadline())
    ).rejects.toThrow(/3 matches/);
  });

  // TC-XPATH-R10 [PASSING — 0-match error does not say "No unique element"]
  it('TC-XPATH-R10 [PASSING]: count=0 error does NOT say "No unique element" (0 and 2+ are distinct code paths)', async () => {
    const { page } = makeMockPage({
      locator: vi.fn().mockReturnValue(mockLocator(0)),
    });

    await expect(
      resolveLocator(page, { xpath: '//span' }, undefined, shortDeadline())
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
      await resolveLocator(page, 'xpath=//ghost', undefined, shortDeadline());
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
    const textLoc = { count: vi.fn().mockResolvedValue(1), _brand: 'text' } as unknown as import('playwright').Locator;
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
    const loc = { count: vi.fn().mockResolvedValue(1) } as unknown as import('playwright').Locator;
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
    const cssLoc = { count: vi.fn().mockResolvedValue(1) } as unknown as import('playwright').Locator;
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

// ═══ T4: waiting resolution (S4) ═══════════════════════════════════════════════

/** A locator whose count() follows `script(attempt)`; attempt is 0-based per call. */
function scriptedLocator(script: (attempt: number) => number, visible?: (index: number, attempt: number) => boolean): Locator {
  let calls = 0;
  let lastAttempt = 0;
  const loc = {
    count: vi.fn().mockImplementation(async () => {
      lastAttempt = calls++;
      return script(lastAttempt);
    }),
    nth: vi.fn().mockImplementation((i: number) => ({
      isVisible: vi.fn().mockImplementation(async () => (visible ? visible(i, lastAttempt) : true)),
    })),
  };
  return loc as unknown as Locator;
}

/** count() returns `seq[k]` on call k, then the last value forever. */
function seq(...values: number[]): (attempt: number) => number {
  return (k) => values[Math.min(k, values.length - 1)];
}

function countCalls(loc: Locator): number {
  return (loc.count as ReturnType<typeof vi.fn>).mock.calls.length;
}

/** A cascade page for value `v`: maps each cascade step to the given locator (others count 0). */
function cascadePage(v: string, steps: { dtid?: Locator; text?: Locator; name?: Locator; id?: Locator; placeholder?: Locator }): Page {
  return makeMockPage({
    locator: vi.fn().mockImplementation((css: string) => {
      if (css === `[data-testid="${v}"]` && steps.dtid) return steps.dtid;
      if (css === `[name="${v}"]` && steps.name) return steps.name;
      if (css === `[id="${v}"]` && steps.id) return steps.id;
      if (css === `[placeholder="${v}"]` && steps.placeholder) return steps.placeholder;
      return mockLocator(0);
    }),
    getByText: vi.fn().mockImplementation((txt: string) => (txt === v && steps.text ? steps.text : mockLocator(0))),
  }).page;
}

async function errorOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error('expected a rejection');
}

describe('T4 — selector forms wait within budget (AC1–AC5)', () => {
  it('AC1: bare string resolves once a step-1 (data-testid) match appears mid-poll', async () => {
    const clock = makeFakeClock();
    const dtid = scriptedLocator(seq(0, 0, 1));
    const page = cascadePage('int-delayed', { dtid });
    const result = await resolveLocator(page, 'int-delayed', undefined, createDeadline(5000, clock));
    expect(result).toBe(dtid);
    expect(clock.now()).toBeLessThan(2500);
  });

  it('AC2: bare string resolves via a lower cascade step (text) once stable', async () => {
    const clock = makeFakeClock();
    const text = scriptedLocator(seq(0, 1));
    const page = cascadePage('int-delayed', { text });
    const result = await resolveLocator(page, 'int-delayed', undefined, createDeadline(5000, clock));
    expect(result).toBe(text);
    expect(clock.now()).toBeLessThan(2600);
  });

  it('AC3: pipe string resolves once its matching segment appears', async () => {
    const clock = makeFakeClock();
    const dtid = scriptedLocator(seq(0, 1));
    const { page } = makeMockPage({
      locator: vi.fn().mockImplementation((css: string) =>
        css === '[data-testid="int-delayed"]' ? dtid : mockLocator(0)),
    });
    const result = await resolveLocator(page, 'id=int-nope|data-testid=int-delayed', undefined, createDeadline(5000, clock));
    expect(result).toBe(dtid);
    expect(clock.now()).toBeLessThan(2500);
  });

  it('AC4: each object-selector form (testId / css / text) resolves once its single match appears', async () => {
    const forms: Array<[Selector, keyof MockPage]> = [
      [{ testId: 'int-delayed' }, 'getByTestId'],
      [{ css: '[data-testid="int-delayed"]' }, 'locator'],
      [{ text: 'Delayed' }, 'getByText'],
    ];
    for (const [selector, method] of forms) {
      const loc = scriptedLocator(seq(0, 1));
      const { page } = makeMockPage({ [method]: vi.fn().mockReturnValue(loc) });
      expect(buildSteps(page, selector)).toHaveLength(1);
      await expect(resolveLocator(page, selector, undefined, createDeadline(5000, makeFakeClock()))).resolves.toBe(loc);
    }
  });

  it('AC5: the { xpath } form resolves once its match appears', async () => {
    const loc = scriptedLocator(seq(0, 1));
    const { page } = makeMockPage({ locator: vi.fn().mockReturnValue(loc) });
    await expect(
      resolveLocator(page, { xpath: "//*[@data-testid='int-delayed']" }, undefined, createDeadline(5000, makeFakeClock())),
    ).resolves.toBe(loc);
  });
});

describe('T4 — single-step / step-1 resolve without stability delay (AC6)', () => {
  it('AC6: a bare-string step-1 (data-testid) match with count 1 from the start resolves on the first poll', async () => {
    const clock = makeFakeClock();
    const dtid = scriptedLocator(() => 1);
    const page = cascadePage('Submit', { dtid });
    await expect(resolveLocator(page, 'Submit', undefined, createDeadline(5000, clock))).resolves.toBe(dtid);
    expect(countCalls(dtid)).toBe(1);
    expect(clock.sleeps).toHaveLength(0);
  });

  it('AC6: a single-segment pipe selector with count 1 from the start resolves on the first poll', async () => {
    const clock = makeFakeClock();
    const loc = scriptedLocator(() => 1);
    const { page } = makeMockPage({ locator: vi.fn().mockReturnValue(loc) });
    await expect(resolveLocator(page, 'data-testid=btn', undefined, createDeadline(5000, clock))).resolves.toBe(loc);
    expect(countCalls(loc)).toBe(1);
    expect(clock.sleeps).toHaveLength(0);
  });

  it('AC6: a { testId } object selector with count 1 from the start resolves on the first poll', async () => {
    const clock = makeFakeClock();
    const loc = scriptedLocator(() => 1);
    const { page } = makeMockPage({ getByTestId: vi.fn().mockReturnValue(loc) });
    await expect(resolveLocator(page, { testId: 'btn' }, undefined, createDeadline(5000, clock))).resolves.toBe(loc);
    expect(countCalls(loc)).toBe(1);
    expect(clock.sleeps).toHaveLength(0);
  });
});

describe('T4 — stability check and duplicates (AC7–AC13)', () => {
  it('AC7: tapOn\'s cascade prefers the stable data-testid winner over an earlier heading match', async () => {
    const button = scriptedLocator(seq(0, 1)); // data-testid match appears on the second pass (~t+50ms)
    const heading = scriptedLocator(() => 1);  // text match present from t0
    const page = cascadePage('Submit', { dtid: button, text: heading });
    const result = await resolveLocator(page, 'Submit', undefined, createDeadline(5000, makeFakeClock()));
    expect(result).toBe(button);
    expect(result).not.toBe(heading);
  });

  it('AC8: pipe-string stability — the data-testid segment wins over the text segment once stable', async () => {
    const button = scriptedLocator(seq(0, 1));
    const heading = scriptedLocator(() => 1);
    const { page } = makeMockPage({
      locator: vi.fn().mockImplementation((css: string) => (css === '[data-testid="Submit"]' ? button : mockLocator(0))),
      getByText: vi.fn().mockReturnValue(heading),
    });
    const result = await resolveLocator(page, 'data-testid=Submit|text=Submit', undefined, createDeadline(5000, makeFakeClock()));
    expect(result).toBe(button);
  });

  it('AC9: a stable lower-step winner (step 2) is accepted after exactly two resolution passes ~100ms apart', async () => {
    const clock = makeFakeClock();
    const step2 = scriptedLocator(() => 1);
    const page = cascadePage('Save', { text: step2 });
    await expect(resolveLocator(page, 'Save', undefined, createDeadline(5000, clock))).resolves.toBe(step2);
    expect(countCalls(step2)).toBe(2);
    expect(clock.sleeps).toEqual([100]);
    expect(clock.now()).toBeGreaterThanOrEqual(100);
    expect(clock.now()).toBeLessThan(300);
  });

  it('AC10: a changed winner restarts the stability window, and a later step-1 win is accepted at once', async () => {
    const clock = makeFakeClock();
    const step1 = scriptedLocator(seq(0, 1));
    const step2 = scriptedLocator(() => 1);
    const page = cascadePage('Save', { dtid: step1, text: step2 });
    await expect(resolveLocator(page, 'Save', undefined, createDeadline(5000, clock))).resolves.toBe(step1);
    expect(clock.sleeps).toEqual([100]);
    expect(countCalls(step2)).toBe(1);
  });

  it('AC11 (revised, Errata E1): an unconfirmed lower winner at a 1000ms deadline fails with the not-found error', async () => {
    const clock = makeFakeClock();
    const step2 = scriptedLocator((k) => (k % 2 === 0 ? 1 : 0));
    const page = cascadePage('flip', { text: step2 });
    const msg = await errorOf(resolveLocator(page, 'flip', undefined, createDeadline(1000, clock)));
    expect(msg.split('\n')[0]).toBe('Element not found after 1000ms: flip');
    expect(clock.now()).toBe(1000);

    // Same rule at the pollSteps seam: never found.
    const clock2 = makeFakeClock();
    const steps = buildSteps(cascadePage('flip', { text: scriptedLocator((k) => (k % 2 === 0 ? 1 : 0)) }), 'flip');
    const r = await pollSteps(steps, (n) => n === 1, createDeadline(1000, clock2));
    expect(r.found).toBe(false);
    expect(clock2.now()).toBe(1000);
  });

  it('AC12: duplicate matches (2) collapse to 1 and the step then passes', async () => {
    const clock = makeFakeClock();
    const row = scriptedLocator(() => (clock.now() >= 800 ? 1 : 2));
    const { page } = makeMockPage({ locator: vi.fn().mockReturnValue(row) });
    await expect(resolveLocator(page, 'data-testid=row', undefined, createDeadline(5000, clock))).resolves.toBe(row);
    expect(clock.now()).toBeLessThan(1800);
  });

  it('AC13 (loop cadence): count() is called at least 5 and at most 11 times before failing at a 1000ms deadline', async () => {
    const loc = scriptedLocator(() => 0);
    const { page } = makeMockPage({ locator: vi.fn().mockReturnValue(loc) });
    await expect(resolveLocator(page, 'data-testid=never', undefined, createDeadline(1000, makeFakeClock()))).rejects.toThrow();
    expect(countCalls(loc)).toBeGreaterThanOrEqual(5);
    expect(countCalls(loc)).toBeLessThanOrEqual(11);
  });
});

describe('T4 — not-found / malformed errors (AC14–AC18)', () => {
  it('AC14: bare-string cascade not-found error — exact line 1 and the 5 step lines in order', async () => {
    const { page } = makeMockPage();
    const msg = await errorOf(resolveLocator(page, 'int-never-rendered', undefined, shortDeadline()));
    expect(msg.split('\n')).toEqual([
      'Element not found after 1000ms: int-never-rendered',
      '  data-testid=int-never-rendered: 0 matches',
      '  text=int-never-rendered: 0 matches',
      '  name=int-never-rendered: 0 matches',
      '  id=int-never-rendered: 0 matches',
      '  placeholder=int-never-rendered: 0 matches',
    ]);
  });

  it('AC15: pipe-string not-found error — exact line 1 and the two segment lines', async () => {
    const { page } = makeMockPage();
    const msg = await errorOf(resolveLocator(page, 'id=a-nope|data-testid=b-nope', undefined, shortDeadline()));
    expect(msg.split('\n')).toEqual([
      'Element not found after 1000ms: id=a-nope|data-testid=b-nope',
      '  id=a-nope: 0 matches',
      '  data-testid=b-nope: 0 matches',
    ]);
  });

  it('AC16: object-selector not-found error uses JSON.stringify of the selector', async () => {
    const { page } = makeMockPage();
    const msg = await errorOf(resolveLocator(page, { testId: 'int-never-rendered' }, undefined, shortDeadline()));
    expect(msg.split('\n')).toEqual([
      'Element not found after 1000ms: {"testId":"int-never-rendered"}',
      '  {"testId":"int-never-rendered"}: 0 matches',
    ]);
  });

  it('AC16: xpath-form not-found error uses JSON.stringify of the selector', async () => {
    const { page } = makeMockPage();
    const msg = await errorOf(resolveLocator(page, { xpath: "//*[@id='nope']" }, undefined, shortDeadline()));
    expect(msg.split('\n')[0]).toBe('Element not found after 1000ms: {"xpath":"//*[@id=\'nope\']"}');
  });

  it('AC17: duplicates at the deadline report their match count, not zero', async () => {
    const { page } = makeMockPage({ locator: vi.fn().mockReturnValue(scriptedLocator(() => 2)) });
    const msg = await errorOf(resolveLocator(page, 'data-testid=row', undefined, shortDeadline()));
    expect(msg.split('\n')).toEqual([
      'Element not found after 1000ms: data-testid=row',
      '  data-testid=row: 2 matches',
    ]);
  });

  it('AC18: unknown attribute (foo=bar) throws fast, before any count() call', async () => {
    const clock = makeFakeClock();
    const loc = scriptedLocator(() => 0);
    const { page } = makeMockPage({ locator: vi.fn().mockReturnValue(loc) });
    expect(() => buildSteps(page, 'foo=bar')).toThrow("Unknown attribute 'foo'");
    await expect(resolveLocator(page, 'foo=bar', undefined, createDeadline(5000, clock))).rejects.toThrow("Unknown attribute 'foo'");
    expect(countCalls(loc)).toBe(0);
    expect(clock.now()).toBe(0);
  });

  it('AC18: xpath union in pipe syntax (xpath=//a|//b) throws fast', async () => {
    const clock = makeFakeClock();
    const loc = scriptedLocator(() => 0);
    const { page } = makeMockPage({ locator: vi.fn().mockReturnValue(loc) });
    expect(() => buildSteps(page, 'xpath=//a|//b')).toThrow("XPath union '|' conflicts with pipe syntax");
    await expect(resolveLocator(page, 'xpath=//a|//b', undefined, createDeadline(5000, clock))).rejects.toThrow(/XPath union/);
    expect(countCalls(loc)).toBe(0);
    expect(clock.now()).toBe(0);
  });

  it('AC18: invalid XPath ({ xpath: "//*[" }) throws on first count() without retrying', async () => {
    const clock = makeFakeClock();
    const count = vi.fn().mockRejectedValue(new Error('unexpected end of expression'));
    const { page } = makeMockPage({ locator: vi.fn().mockReturnValue({ count } as unknown as Locator) });
    await expect(resolveLocator(page, { xpath: '//*[' }, undefined, createDeadline(5000, clock))).rejects.toThrow(
      'Invalid XPath expression: //*[ — unexpected end of expression',
    );
    expect(count).toHaveBeenCalledTimes(1);
    expect(clock.sleeps).toHaveLength(0);
  });

  it('AC18 (Arbiter ruling 1): an unrecognised selector type throws fast with today\'s message', async () => {
    const { page } = makeMockPage();
    expect(() => buildSteps(page, { foo: 'bar' } as never)).toThrow('Unrecognized selector type: foo');
    await expect(resolveLocator(page, { foo: 'bar' } as never, undefined, shortDeadline())).rejects.toThrow(
      'Unrecognized selector type: foo',
    );
  });

  it('AC18: missing "=" in a pipe segment and an empty xpath throw in buildSteps', () => {
    const { page } = makeMockPage();
    expect(() => buildSteps(page, 'id=a|b')).toThrow("Invalid pipe segment 'b': missing '='");
    expect(() => buildSteps(page, { xpath: '' })).toThrow('Invalid xpath selector: expression must not be empty');
  });
});

describe('T4 — not-visible mode (AC19–AC23 revised)', () => {
  it('AC19: assertNotVisible resolves "absent" when every cascade step has 0 matches (bare string)', async () => {
    const clock = makeFakeClock();
    const { page } = makeMockPage();
    await expect(resolveNotVisible(page, 'int-absent', createDeadline(5000, clock))).resolves.toBe(true);
    expect(clock.sleeps).toHaveLength(0);
  });

  it('AC19: assertNotVisible resolves "absent" for a pipe string with 0 matches on both segments', async () => {
    const clock = makeFakeClock();
    const { page } = makeMockPage();
    await expect(resolveNotVisible(page, 'id=a-nope|data-testid=b-nope', createDeadline(5000, clock))).resolves.toBe(true);
    expect(clock.sleeps).toHaveLength(0);
  });

  it('AC20: assertNotVisible resolves true when the element is present but isVisible() is false (bare string)', async () => {
    const clock = makeFakeClock();
    const dtid = scriptedLocator(() => 1, () => false);
    await expect(resolveNotVisible(cascadePage('int-hidden', { dtid }), 'int-hidden', createDeadline(5000, clock))).resolves.toBe(true);
    expect(clock.sleeps).toHaveLength(0);
  });

  it('AC20: assertNotVisible resolves true for an object-form selector when hidden', async () => {
    const loc = scriptedLocator(() => 1, () => false);
    const { page } = makeMockPage({ getByTestId: vi.fn().mockReturnValue(loc) });
    await expect(resolveNotVisible(page, { testId: 'int-hidden' }, createDeadline(5000, makeFakeClock()))).resolves.toBe(true);
  });

  it('AC21: assertNotVisible waits for a visible element to become absent/hidden', async () => {
    const clock = makeFakeClock();
    const dtid = scriptedLocator(seq(1, 1, 1, 0), () => true);
    await expect(resolveNotVisible(cascadePage('int-vanish', { dtid }), 'int-vanish', createDeadline(5000, clock))).resolves.toBe(true);
    expect(clock.now()).toBe(300);
    expect(clock.now()).toBeLessThan(2500);
  });

  it('AC22: assertNotVisible returns false at the deadline when the element stays visible', async () => {
    const clock = makeFakeClock();
    const dtid = scriptedLocator(() => 1, () => true);
    await expect(resolveNotVisible(cascadePage('int-stays', { dtid }), 'int-stays', createDeadline(1000, clock))).resolves.toBe(false);
    expect(clock.now()).toBe(1000);
  });

  it('AC23 (a, revised): both duplicate matches hidden from the start resolves true promptly', async () => {
    const clock = makeFakeClock();
    const dup = scriptedLocator(() => 2, () => false);
    const { page } = makeMockPage({ locator: vi.fn().mockReturnValue(dup) });
    await expect(resolveNotVisible(page, 'data-testid=dup', createDeadline(1000, clock))).resolves.toBe(true);
    expect(clock.sleeps).toHaveLength(0);
  });

  it('AC23 (b, revised): one of two duplicates stays visible — resolves false at the deadline', async () => {
    const clock = makeFakeClock();
    const dup = scriptedLocator(() => 2, (i) => i === 0);
    const { page } = makeMockPage({ locator: vi.fn().mockReturnValue(dup) });
    await expect(resolveNotVisible(page, 'data-testid=dup', createDeadline(1000, clock))).resolves.toBe(false);
    expect(clock.now()).toBe(1000);
  });

  it('AC23 (c, revised): a duplicate that starts visible and becomes hidden at a later poll — resolves true once all matches of the deciding step are hidden', async () => {
    const clock = makeFakeClock();
    const dup = scriptedLocator(() => 2, (i, attempt) => i === 0 && attempt < 3);
    const { page } = makeMockPage({ locator: vi.fn().mockReturnValue(dup) });
    await expect(resolveNotVisible(page, 'data-testid=dup', createDeadline(5000, clock))).resolves.toBe(true);
    expect(clock.now()).toBe(300);
  });

  it('AC23 (revised, rule statement): the deciding step is the first in cascade/pipe order with ≥1 match; prior zero-match steps don\'t decide', async () => {
    // step 1 (data-testid) 0 throughout; step 2 (text) holds the duplicates; a later step is visible but never decides.
    const hiddenDups = scriptedLocator(() => 2, () => false);
    const visibleLater = scriptedLocator(() => 1, () => true);
    const passPage = cascadePage('dup', { text: hiddenDups, id: visibleLater });
    await expect(resolveNotVisible(passPage, 'dup', createDeadline(1000, makeFakeClock()))).resolves.toBe(true);
    expect(countCalls(visibleLater)).toBe(0);

    const clock = makeFakeClock();
    const visibleDups = scriptedLocator(() => 2, (i) => i === 1);
    const failPage = cascadePage('dup', { text: visibleDups });
    await expect(resolveNotVisible(failPage, 'dup', createDeadline(1000, clock))).resolves.toBe(false);
    expect(clock.now()).toBe(1000);
  });

  it('not-visible mode fails fast on a malformed selector', async () => {
    const { page } = makeMockPage();
    await expect(resolveNotVisible(page, 'foo=bar', shortDeadline())).rejects.toThrow("Unknown attribute 'foo'");
  });
});

describe('T4 — within container lookup (AC24–AC27)', () => {
  it('AC24: resolveContainerLocator resolves once the container\'s count reaches 1', async () => {
    const loc = scriptedLocator(seq(0, 0, 1));
    const { page } = makeMockPage({ locator: vi.fn().mockReturnValue(loc) });
    await expect(
      resolveContainerLocator(page, 'data-testid=int-delayed', { deadline: createDeadline(5000, makeFakeClock()) }),
    ).resolves.toBe(loc);
  });

  it('AC25: within container not-found error — exact line 1 and line 2', async () => {
    const { page } = makeMockPage();
    const msg = await errorOf(resolveContainerLocator(page, 'data-testid=int-never-rendered', { deadline: shortDeadline() }));
    expect(msg.split('\n')).toEqual([
      "within: No container found after 1000ms for selector 'data-testid=int-never-rendered'",
      '  data-testid=int-never-rendered: 0 matches',
    ]);
  });

  it('AC26: resolveContainerLocator with nth accepts once count reaches nth+1', async () => {
    const clock = makeFakeClock();
    const loc = scriptedLocator(seq(1, 1, 3));
    const { page } = makeMockPage({ locator: vi.fn().mockReturnValue(loc) });
    await expect(
      resolveContainerLocator(page, 'data-testid=item', { nth: 2, deadline: createDeadline(5000, clock) }),
    ).resolves.toBe(loc);
    expect(clock.now()).toBe(200);
  });

  it('AC26: resolveContainerLocator with nth out of range at the deadline throws today\'s nth message', async () => {
    const clock = makeFakeClock();
    const { page } = makeMockPage({ locator: vi.fn().mockReturnValue(scriptedLocator(() => 1)) });
    const msg = await errorOf(resolveContainerLocator(page, 'data-testid=item', { nth: 2, deadline: createDeadline(1000, clock) }));
    expect(msg).toBe("within: nth=2 requested but only 1 containers matched selector 'data-testid=item'");
    expect(clock.now()).toBe(1000);
  });

  it('AC27: resolveContainerLocator honours its own deadline independent of any caller/inner budget', async () => {
    const clock = makeFakeClock();
    const { page } = makeMockPage();
    const msg = await errorOf(resolveContainerLocator(page, 'data-testid=c', { deadline: createDeadline(1000, clock) }));
    expect(msg.split('\n')[0]).toBe("within: No container found after 1000ms for selector 'data-testid=c'");
    expect(clock.now()).toBe(1000);
    // Only `nth` and `deadline` are accepted — no other budget can influence timing.
    // @ts-expect-error unknown option
    void resolveContainerLocator(page, 'data-testid=c', { deadline: shortDeadline(), timeout: 1 }).catch(() => undefined);
  });

  it('container lookup fails fast on a malformed selector', async () => {
    const { page } = makeMockPage();
    await expect(resolveContainerLocator(page, 'foo=bar', { deadline: shortDeadline() })).rejects.toThrow("Unknown attribute 'foo'");
  });
});

describe('T4 — selectorLabel', () => {
  it('returns string selectors as written', () => {
    expect(selectorLabel('id=a|data-testid=b')).toBe('id=a|data-testid=b');
    expect(selectorLabel('Submit')).toBe('Submit');
  });

  it('returns JSON.stringify for object selectors', () => {
    expect(selectorLabel({ testId: 'x' })).toBe('{"testId":"x"}');
    expect(selectorLabel({ role: 'button', name: 'Go' })).toBe('{"role":"button","name":"Go"}');
  });
});
