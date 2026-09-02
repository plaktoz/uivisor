/**
 * overlay.test.ts — Unit tests for the in-browser recording overlay.
 *
 * Environment: Vitest + jsdom
 *
 * Architecture notes:
 * - overlay.ts has no exports; all behaviour is driven by side effects.
 * - The module is imported once at the top of this file. HUD injection and
 *   event listener registration happen at that point.
 * - screenshotCounter and currentPicker are module-level state in overlay.ts
 *   that cannot be reset from outside. Tests that depend on counter state are
 *   ordered deliberately so no screenshot is fired before the screenshot suite.
 * - beforeEach dispatches Escape to close any open picker via the proper code
 *   path (which also sets currentPicker = null inside overlay.ts).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Import overlay.ts for its side effects: HUD injection + keydown listener.
// Must be imported before tests run so that document.body already has the HUD.
import './overlay';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function press(key: string, shiftKey = false): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }));
}

function clickOption(type: string): void {
  const el = document.querySelector(`[data-testid="uivisor-option-${type}"]`);
  if (!el) throw new Error(`Option button not found: uivisor-option-${type}`);
  (el as HTMLElement).click();
}

// ─── Per-test cleanup ─────────────────────────────────────────────────────────

beforeEach(() => {
  // Close any open picker via the proper code path so that currentPicker is
  // nullified inside overlay.ts (direct DOM removal would leave a stale ref).
  press('Escape');

  // Install fresh spy; tests that need a specific overlay mock re-assign it.
  (window as any).__uivisorOverlay = vi.fn();

  // Install prompt stub that returns null by default (safe for unexpected calls).
  (window as any).prompt = vi.fn().mockReturnValue(null);
});

// ─── Suite 1: HUD ─────────────────────────────────────────────────────────────

describe('HUD', () => {
  // Test 1
  it('injects <div id="uivisor-hud"> on init', () => {
    expect(document.getElementById('uivisor-hud')).not.toBeNull();
  });

  // Test 2
  it('HUD position is fixed, bottom/right anchored', () => {
    const hud = document.getElementById('uivisor-hud')!;
    expect(hud.style.position).toBe('fixed');
    expect(hud.style.bottom).toBeTruthy();
    expect(hud.style.right).toBeTruthy();
  });

  // Test 3
  it('HUD text contains all three shortcut labels', () => {
    const text = document.getElementById('uivisor-hud')!.textContent ?? '';
    expect(text).toContain('Shift+A');
    expect(text).toContain('Shift+W');
    expect(text).toContain('Shift+S');
  });

  // Test 4
  it('HUD injection is idempotent (exactly one HUD element exists)', () => {
    // The overlay script runs once on import. The idempotency guard ensures
    // that even if addInitScript fires on every navigation, only one HUD is
    // present. We verify the invariant holds after the initial load.
    expect(document.querySelectorAll('#uivisor-hud').length).toBe(1);
  });
});

// ─── Suite 2: Shift+A — Picker modal ─────────────────────────────────────────

describe('Shift+A — Picker modal', () => {
  // Test 5
  it('Shift+A opens picker with data-testid="uivisor-picker"', () => {
    press('A', true);
    expect(document.querySelector('[data-testid="uivisor-picker"]')).not.toBeNull();
  });

  // Test 6
  it('Picker lists all 8 options with correct data-testid="uivisor-option-*" attributes', () => {
    press('A', true);
    const options = document.querySelectorAll('[data-testid^="uivisor-option-"]');
    expect(options.length).toBe(8);

    const expected = [
      'uivisor-option-assertVisible',
      'uivisor-option-assertText',
      'uivisor-option-assertValue',
      'uivisor-option-assertUrl',
      'uivisor-option-assertEnabled',
      'uivisor-option-assertDisabled',
      'uivisor-option-assertChecked',
      'uivisor-option-assertUnchecked',
    ];
    for (const testid of expected) {
      expect(document.querySelector(`[data-testid="${testid}"]`)).not.toBeNull();
    }
  });

  // Test 7
  it('Plain A (no Shift) does not open picker', () => {
    press('A', false);
    expect(document.querySelector('[data-testid="uivisor-picker"]')).toBeNull();
  });

  // Test 8
  it('Second Shift+A while picker is open does not create a duplicate picker', () => {
    press('A', true);
    press('A', true);
    expect(document.querySelectorAll('[data-testid="uivisor-picker"]').length).toBe(1);
  });

  // Test 9
  it('Escape removes picker from DOM (not merely hides it)', () => {
    press('A', true);
    expect(document.querySelector('[data-testid="uivisor-picker"]')).not.toBeNull();
    press('Escape');
    // Must be fully removed, not display:none
    expect(document.querySelector('[data-testid="uivisor-picker"]')).toBeNull();
  });

  // Test 10
  it('Escape when picker is not open is a no-op; no error; HUD intact', () => {
    // No picker open at this point (beforeEach closed any)
    expect(() => press('Escape')).not.toThrow();
    expect(document.getElementById('uivisor-hud')).not.toBeNull();
    expect(document.querySelector('[data-testid="uivisor-picker"]')).toBeNull();
  });

  // Test 11
  it('Picker re-opens cleanly after Escape dismissal', () => {
    press('A', true);
    press('Escape');
    expect(document.querySelector('[data-testid="uivisor-picker"]')).toBeNull();

    press('A', true);
    const picker = document.querySelector('[data-testid="uivisor-picker"]');
    expect(picker).not.toBeNull();
    expect(document.querySelectorAll('[data-testid^="uivisor-option-"]').length).toBe(8);
  });

  // Test 12
  it('Escape does not call window.__uivisorOverlay', () => {
    const spy = (window as any).__uivisorOverlay as ReturnType<typeof vi.fn>;
    press('A', true);
    press('Escape');
    expect(spy).not.toHaveBeenCalled();
  });
});

// ─── Suite 3: Picker — assertion type commands ────────────────────────────────

describe('Picker — assertion type commands', () => {
  // Test 13
  it('assertVisible — emits { assertVisible: selector }, no prompt, picker closes', () => {
    const spy = vi.fn();
    (window as any).__uivisorOverlay = spy;

    press('A', true);
    clickOption('assertVisible');

    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][0];
    expect(arg).toHaveProperty('assertVisible');
    expect(typeof arg.assertVisible).toBe('string');
    // Prompt must NOT have been called for a no-prompt type
    expect((window as any).prompt).not.toHaveBeenCalled();
    // Picker must be closed after emission
    expect(document.querySelector('[data-testid="uivisor-picker"]')).toBeNull();
  });

  // Test 14
  it('assertText — prompts for text, emits { assertText: { element, text } }, picker closes', () => {
    (window as any).prompt = vi.fn().mockReturnValue('Hello World');
    const spy = vi.fn();
    (window as any).__uivisorOverlay = spy;

    press('A', true);
    clickOption('assertText');

    expect((window as any).prompt).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][0];
    expect(arg).toMatchObject({ assertText: { element: expect.any(String), text: 'Hello World' } });
    expect(document.querySelector('[data-testid="uivisor-picker"]')).toBeNull();
  });

  // Test 15
  it('assertText — prompt cancel → no emission; picker stays open for retry', () => {
    // SPEC DECISION (T-B-44): cancel leaves picker open.
    (window as any).prompt = vi.fn().mockReturnValue(null);
    const spy = vi.fn();
    (window as any).__uivisorOverlay = spy;

    press('A', true);
    clickOption('assertText');

    expect(spy).not.toHaveBeenCalled();
    // Implementation decision: picker stays open when prompt is cancelled.
    expect(document.querySelector('[data-testid="uivisor-picker"]')).not.toBeNull();
  });

  // Test 16
  it('assertValue — prompts for value, emits { assertValue: { element, value } }', () => {
    (window as any).prompt = vi.fn().mockReturnValue('john@example.com');
    const spy = vi.fn();
    (window as any).__uivisorOverlay = spy;

    press('A', true);
    clickOption('assertValue');

    expect((window as any).prompt).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][0];
    expect(arg).toMatchObject({ assertValue: { element: expect.any(String), value: 'john@example.com' } });
  });

  // Test 17
  it('assertValue — prompt cancel → no emission', () => {
    (window as any).prompt = vi.fn().mockReturnValue(null);
    const spy = vi.fn();
    (window as any).__uivisorOverlay = spy;

    press('A', true);
    clickOption('assertValue');

    expect(spy).not.toHaveBeenCalled();
  });

  // Test 18
  it('assertUrl — no prompt, emits { assertUrl: window.location.href }', () => {
    const spy = vi.fn();
    (window as any).__uivisorOverlay = spy;

    press('A', true);
    clickOption('assertUrl');

    expect((window as any).prompt).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ assertUrl: window.location.href });
  });

  // Test 19
  it('assertEnabled — no prompt, emits { assertEnabled: selector }', () => {
    const spy = vi.fn();
    (window as any).__uivisorOverlay = spy;

    press('A', true);
    clickOption('assertEnabled');

    expect((window as any).prompt).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][0];
    expect(arg).toHaveProperty('assertEnabled');
    expect(typeof arg.assertEnabled).toBe('string');
  });

  // Test 20
  it('assertDisabled — no prompt, emits { assertDisabled: selector }', () => {
    const spy = vi.fn();
    (window as any).__uivisorOverlay = spy;

    press('A', true);
    clickOption('assertDisabled');

    expect((window as any).prompt).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toHaveProperty('assertDisabled');
  });

  // Test 21
  it('assertChecked — no prompt, emits { assertChecked: selector }', () => {
    const spy = vi.fn();
    (window as any).__uivisorOverlay = spy;

    press('A', true);
    clickOption('assertChecked');

    expect((window as any).prompt).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toHaveProperty('assertChecked');
  });

  // Test 22
  it('assertUnchecked — no prompt, emits { assertUnchecked: selector }', () => {
    const spy = vi.fn();
    (window as any).__uivisorOverlay = spy;

    press('A', true);
    clickOption('assertUnchecked');

    expect((window as any).prompt).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toHaveProperty('assertUnchecked');
  });
});

// ─── Suite 4: Shift+W — wait command ─────────────────────────────────────────

describe('Shift+W — wait command', () => {
  // Test 23
  it('Shift+W prompts, emits { wait: ms } as Number', () => {
    (window as any).prompt = vi.fn().mockReturnValue('1500');
    const spy = vi.fn();
    (window as any).__uivisorOverlay = spy;

    press('W', true);

    expect((window as any).prompt).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ wait: 1500 });
    // Must be a number, not a string
    expect(typeof spy.mock.calls[0][0].wait).toBe('number');
  });

  // Test 24
  it('Shift+W — prompt cancel → no emission', () => {
    (window as any).prompt = vi.fn().mockReturnValue(null);
    const spy = vi.fn();
    (window as any).__uivisorOverlay = spy;

    press('W', true);

    expect(spy).not.toHaveBeenCalled();
  });

  // Test 25
  it('Shift+W — empty string from prompt → no emission', () => {
    (window as any).prompt = vi.fn().mockReturnValue('');
    const spy = vi.fn();
    (window as any).__uivisorOverlay = spy;

    press('W', true);

    expect(spy).not.toHaveBeenCalled();
  });
});

// ─── Suite 5: PrintScreen / Shift+S — screenshot command ─────────────────────
// Counter state is shared across this entire test run. No prior test fires a
// screenshot, so the counter is at 0 when test 26 runs.

describe('PrintScreen / Shift+S — screenshot command', () => {
  // Test 26 — counter starts at 1 on first call
  it('first screenshot emits screenshots/step-1.png (counter starts at 1)', () => {
    const spy = vi.fn();
    (window as any).__uivisorOverlay = spy;

    press('S', true); // Shift+S

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ screenshot: 'screenshots/step-1.png' });
  });

  // Test 27 — counter increments; both triggers share one counter.
  // Counter is at 1 after test 26.
  it('counter increments across calls; Shift+S and PrintScreen share one counter', () => {
    const spy = vi.fn();
    (window as any).__uivisorOverlay = spy;

    // counter was 1 after test 26; next calls produce 2 and 3
    press('PrintScreen'); // → step-2.png
    press('S', true);     // → step-3.png

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, { screenshot: 'screenshots/step-2.png' });
    expect(spy).toHaveBeenNthCalledWith(2, { screenshot: 'screenshots/step-3.png' });
  });
});

// ─── Suite 6: __uivisorOverlay guard (AC11) ───────────────────────────────────

describe('__uivisorOverlay guard (AC11)', () => {
  // Test 28 — covers undefined, null, non-function, function, and late binding
  it('does not throw when __uivisorOverlay is undefined/null/non-function; calls when function; late-binding works', () => {
    // undefined
    delete (window as any).__uivisorOverlay;
    expect(() => press('PrintScreen')).not.toThrow();

    // null
    (window as any).__uivisorOverlay = null;
    expect(() => press('PrintScreen')).not.toThrow();

    // non-function (object)
    (window as any).__uivisorOverlay = { emit: () => {} };
    expect(() => press('PrintScreen')).not.toThrow();

    // non-function (number)
    (window as any).__uivisorOverlay = 42;
    expect(() => press('PrintScreen')).not.toThrow();

    // proper function — must be called
    const spy = vi.fn();
    (window as any).__uivisorOverlay = spy;
    press('PrintScreen');
    expect(spy).toHaveBeenCalledTimes(1);

    // late binding — remove after load, then add; guard is per-call not per-init
    delete (window as any).__uivisorOverlay;
    press('PrintScreen'); // silent
    const spy2 = vi.fn();
    (window as any).__uivisorOverlay = spy2;
    press('PrintScreen'); // called now
    expect(spy2).toHaveBeenCalledTimes(1);
  });
});

// ─── Suite 7: Pure browser script — static analysis (AC10) ──────────────────
// These tests read overlay.ts as a text file and assert no forbidden patterns.
// They do not exercise the DOM; they run inside the jsdom test environment but
// use Node.js file-read APIs available in the Vitest process.

describe('Pure browser script — static analysis (AC10)', () => {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const overlaySource = readFileSync(join(__dirname, 'overlay.ts'), 'utf-8');

  it('overlay.ts contains no import statements', () => {
    // Must not have any top-level import declaration
    expect(overlaySource).not.toMatch(/^import\s/m);
  });

  it('overlay.ts contains no require() calls', () => {
    expect(overlaySource).not.toMatch(/\brequire\s*\(/);
  });

  it('overlay.ts contains no Node.js built-in or @uivisor package imports', () => {
    // Belt-and-suspenders: check for node: protocol and known package names
    expect(overlaySource).not.toMatch(/from ['"]node:/);
    expect(overlaySource).not.toMatch(/from ['"]@uivisor/);
    expect(overlaySource).not.toMatch(/from ['"]fs['"]/);
    expect(overlaySource).not.toMatch(/from ['"]path['"]/);
  });
});

// ─── Spec-deciding tests (informational) ─────────────────────────────────────

describe('Spec-deciding (T-B-38): Shift+A behaviour in focused INPUT', () => {
  it.todo(
    'Shift+A while an INPUT element is focused opens the picker (no suppression) — ' +
    'DECISION: overlay does not check element type; INPUT users can still trigger assertions'
  );
});
