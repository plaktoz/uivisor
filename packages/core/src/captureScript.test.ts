import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { CAPTURE_SCRIPT } from './captureScript.js';

const capture = vi.fn();

beforeAll(() => {
  (window as any).__uivisorCapture = capture;
  (new Function(CAPTURE_SCRIPT))();
});

beforeEach(() => {
  capture.mockClear();
  document.body.innerHTML = '';
});

describe('CAPTURE_SCRIPT', () => {
  // CS-01: export is a non-empty string
  it('CS-01: CAPTURE_SCRIPT export is a non-empty string', () => {
    expect(typeof CAPTURE_SCRIPT).toBe('string');
    expect(CAPTURE_SCRIPT.length).toBeGreaterThan(0);
  });

  // CS-02: script string contains no import keyword and no require(
  it('CS-02: script string contains no import keyword and no require(', () => {
    expect(CAPTURE_SCRIPT).not.toMatch(/\bimport\b/);
    expect(CAPTURE_SCRIPT).not.toMatch(/require\s*\(/);
  });

  // CS-03: CAPTURE_SCRIPT re-exported from index.ts resolves as a string
  it('CS-03: CAPTURE_SCRIPT re-exported from index.ts resolves as a string', async () => {
    const mod = await import('./index.js');
    expect(typeof (mod as any).CAPTURE_SCRIPT).toBe('string');
  });

  // CS-04: click on button with text emits tapOn with text selector
  it('CS-04: click on button with text emits tapOn with text selector', () => {
    const btn = document.createElement('button');
    btn.textContent = 'Submit';
    document.body.appendChild(btn);
    btn.click();
    expect(capture).toHaveBeenCalledOnce();
    expect(capture.mock.calls[0][0]).toEqual({ type: 'tapOn', selector: { text: 'Submit' } });
  });

  // CS-05: click on button with data-testid emits tapOn with testId selector
  it('CS-05: click on button with data-testid emits tapOn with testId selector', () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'btn');
    document.body.appendChild(btn);
    btn.click();
    expect(capture).toHaveBeenCalledOnce();
    expect(capture.mock.calls[0][0]).toEqual({ type: 'tapOn', selector: { testId: 'btn' } });
  });

  // CS-06: click on id="uivisor-hud" element does NOT emit
  it('CS-06: click on id="uivisor-hud" element does NOT emit', () => {
    const hud = document.createElement('div');
    hud.id = 'uivisor-hud';
    document.body.appendChild(hud);
    hud.click();
    expect(capture).not.toHaveBeenCalled();
  });

  // CS-07: click on button descendant of #uivisor-hud does NOT emit
  it('CS-07: click on button descendant of #uivisor-hud does NOT emit', () => {
    const hud = document.createElement('div');
    hud.id = 'uivisor-hud';
    const hudChild = document.createElement('button');
    hudChild.textContent = 'Close';
    hud.appendChild(hudChild);
    document.body.appendChild(hud);
    hudChild.click();
    expect(capture).not.toHaveBeenCalled();
  });

  // CS-08: input events + blur emit inputTextTargeted exactly once with final value
  it('CS-08: input events + blur emit inputTextTargeted exactly once with final value', () => {
    const input = document.createElement('input');
    input.setAttribute('data-testid', 'f');
    document.body.appendChild(input);
    input.value = 'draft';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.value = 'final';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    expect(capture).toHaveBeenCalledOnce();
    expect(capture.mock.calls[0][0]).toEqual({
      type: 'inputTextTargeted',
      element: { testId: 'f' },
      text: 'final',
    });
  });

  // CS-09: five input events then blur emit only ONE command
  it('CS-09: five input events then blur emit only ONE command', () => {
    const input = document.createElement('input');
    input.setAttribute('data-testid', 'multi');
    document.body.appendChild(input);
    for (let i = 0; i < 5; i++) {
      input.value = `val${i}`;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    expect(capture.mock.calls.length).toBe(1);
  });

  // CS-10: input event + advance 500ms emits command without blur (fake timers)
  it('CS-10: input event + advance 500ms emits command without blur (fake timers)', () => {
    vi.useFakeTimers();
    const input = document.createElement('input');
    input.setAttribute('data-testid', 'timer-input');
    document.body.appendChild(input);
    input.value = 'typed';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(500);
    expect(capture).toHaveBeenCalledOnce();
    expect(capture.mock.calls[0][0]).toEqual({
      type: 'inputTextTargeted',
      element: { testId: 'timer-input' },
      text: 'typed',
    });
    vi.useRealTimers();
  });

  // CS-11: input event + advance 499ms does NOT emit prematurely (fake timers)
  it('CS-11: input event + advance 499ms does NOT emit prematurely (fake timers)', () => {
    vi.useFakeTimers();
    const input = document.createElement('input');
    input.setAttribute('data-testid', 'timer-input-2');
    document.body.appendChild(input);
    input.value = 'partial';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(499);
    expect(capture).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  // CS-12: textarea input + blur emits inputTextTargeted
  it('CS-12: textarea input + blur emits inputTextTargeted', () => {
    const textarea = document.createElement('textarea');
    textarea.setAttribute('data-testid', 'ta');
    document.body.appendChild(textarea);
    textarea.value = 'hello textarea';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('blur', { bubbles: true }));
    expect(capture).toHaveBeenCalledOnce();
    expect(capture.mock.calls[0][0]).toEqual({
      type: 'inputTextTargeted',
      element: { testId: 'ta' },
      text: 'hello textarea',
    });
  });

  // CS-13: select change emits selectOption with selector and value fields
  it('CS-13: select change emits selectOption with selector and value fields', () => {
    const select = document.createElement('select');
    select.setAttribute('data-testid', 's');
    const opt1 = document.createElement('option');
    opt1.value = 'CA';
    opt1.textContent = 'Canada';
    const opt2 = document.createElement('option');
    opt2.value = 'US';
    opt2.textContent = 'United States';
    select.appendChild(opt1);
    select.appendChild(opt2);
    document.body.appendChild(select);
    select.value = 'US';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(capture).toHaveBeenCalledOnce();
    expect(capture.mock.calls[0][0]).toEqual({
      type: 'selectOption',
      selector: { testId: 's' },
      value: 'US',
    });
  });

  // CS-14: checking checkbox emits check command with selector field
  it('CS-14: checking checkbox emits check command with selector field', () => {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.setAttribute('data-testid', 'cb');
    document.body.appendChild(cb);
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    expect(capture).toHaveBeenCalledOnce();
    expect(capture.mock.calls[0][0]).toEqual({ type: 'check', selector: { testId: 'cb' } });
  });

  // CS-15: unchecking checkbox emits uncheck command with selector field
  it('CS-15: unchecking checkbox emits uncheck command with selector field', () => {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.setAttribute('data-testid', 'cb');
    cb.checked = true;
    document.body.appendChild(cb);
    cb.checked = false;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    expect(capture).toHaveBeenCalledOnce();
    expect(capture.mock.calls[0][0]).toEqual({ type: 'uncheck', selector: { testId: 'cb' } });
  });

  // CS-16: popstate event emits goto command
  it('CS-16: popstate event emits goto command', () => {
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(capture).toHaveBeenCalledOnce();
    expect(capture.mock.calls[0][0]).toEqual({ type: 'goto', url: window.location.href });
  });

  // CS-17: hashchange event emits goto command
  it('CS-17: hashchange event emits goto command', () => {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(capture).toHaveBeenCalledOnce();
    expect(capture.mock.calls[0][0]).toEqual({ type: 'goto', url: window.location.href });
  });

  // CS-18: Enter keydown emits pressKey
  it('CS-18: Enter keydown emits pressKey', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(capture).toHaveBeenCalledOnce();
    expect(capture.mock.calls[0][0]).toEqual({ type: 'pressKey', key: 'Enter' });
  });

  // CS-19: Tab keydown emits pressKey
  it('CS-19: Tab keydown emits pressKey', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(capture).toHaveBeenCalledOnce();
    expect(capture.mock.calls[0][0]).toEqual({ type: 'pressKey', key: 'Tab' });
  });

  // CS-20: Escape keydown emits pressKey
  it('CS-20: Escape keydown emits pressKey', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(capture).toHaveBeenCalledOnce();
    expect(capture.mock.calls[0][0]).toEqual({ type: 'pressKey', key: 'Escape' });
  });

  // CS-21: regular 'a' keydown does NOT emit any command
  it("CS-21: regular 'a' keydown does NOT emit any command", () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(capture).not.toHaveBeenCalled();
  });

  // CS-22: window.__uivisorCapture undefined -> click does not throw; no command emitted
  it('CS-22: window.__uivisorCapture undefined -> click does not throw; no command emitted', () => {
    const saved = (window as any).__uivisorCapture;
    delete (window as any).__uivisorCapture;
    const btn = document.createElement('button');
    btn.textContent = 'Test';
    document.body.appendChild(btn);
    expect(() => btn.click()).not.toThrow();
    expect(capture).not.toHaveBeenCalled();
    (window as any).__uivisorCapture = saved;
  });
});
