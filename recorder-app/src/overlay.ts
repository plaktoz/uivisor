// overlay.ts — injected into the recording page via page.addInitScript().
// IMPORTANT: No imports allowed. This file is a pure browser script.
// All code must be self-contained.

// ─── Module-level state ────────────────────────────────────────────────────────

let screenshotCounter = 0;
let currentPicker: HTMLElement | null = null;

// ─── Helper: emit command via the pre-registered host function ────────────────
// Guard: only calls __uivisorOverlay when it is a function. Evaluated per-call
// so late binding (host defines the function after script load) works correctly.

function emit(cmd: unknown): void {
  if (typeof (window as any).__uivisorOverlay === 'function') {
    (window as any).__uivisorOverlay(cmd);
  }
}

// ─── Helper: derive a selector for the currently focused element ──────────────
// Returns [data-testid="<value>"] if the active element has that attribute,
// otherwise returns an empty string.
// NOTE: Full selector heuristics are wired in F6 (CLI). This is a known
// limitation of the in-browser overlay operating without DOM-capture tooling.

function getSelector(): string {
  const active = document.activeElement;
  if (active && active !== document.body) {
    const testid = active.getAttribute('data-testid');
    if (testid) {
      return `[data-testid="${testid}"]`;
    }
  }
  return '';
}

// ─── Picker lifecycle ─────────────────────────────────────────────────────────

function closePicker(): void {
  if (currentPicker) {
    currentPicker.remove();
    currentPicker = null;
  }
}

function openPicker(): void {
  // Guard: do not insert a second picker if one is already open.
  if (currentPicker) return;

  const picker = document.createElement('div');
  picker.setAttribute('data-testid', 'uivisor-picker');
  picker.style.cssText =
    'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
    'background:#fff;border:1px solid #999;padding:12px;border-radius:4px;' +
    'z-index:2147483646;font:13px monospace;';

  const assertionTypes = [
    'assertVisible',
    'assertText',
    'assertValue',
    'assertUrl',
    'assertEnabled',
    'assertDisabled',
    'assertChecked',
    'assertUnchecked',
  ] as const;

  for (const type of assertionTypes) {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', `uivisor-option-${type}`);
    btn.textContent = type;
    btn.style.cssText = 'display:block;margin:4px 0;padding:4px 8px;cursor:pointer;width:100%;';

    btn.addEventListener('click', () => {
      const selector = getSelector();

      if (type === 'assertText') {
        // Prompt for expected text. If cancelled (null), keep picker open for retry.
        // SPEC DECISION (T-B-44): picker stays open on cancel; closes only on successful emit.
        const text = window.prompt('Expected text:');
        if (text === null) return;
        emit({ assertText: { element: selector, text } });
        closePicker();
      } else if (type === 'assertValue') {
        // Prompt for expected value. Same cancel behaviour as assertText.
        const value = window.prompt('Expected value:');
        if (value === null) return;
        emit({ assertValue: { element: selector, value } });
        closePicker();
      } else if (type === 'assertUrl') {
        // No prompt — emit the current page URL.
        emit({ assertUrl: window.location.href });
        closePicker();
      } else {
        // No-prompt types: assertVisible, assertEnabled, assertDisabled,
        // assertChecked, assertUnchecked.
        const cmd: Record<string, string> = {};
        cmd[type] = selector;
        emit(cmd);
        closePicker();
      }
    });

    picker.appendChild(btn);
  }

  document.body.appendChild(picker);
  currentPicker = picker;
}

// ─── HUD injection — runs immediately on script load ─────────────────────────

const hud = document.createElement('div');
hud.id = 'uivisor-hud';
hud.style.cssText =
  'position:fixed;bottom:8px;right:8px;background:rgba(0,0,0,0.75);color:#fff;' +
  'font:12px monospace;padding:6px 10px;border-radius:4px;z-index:2147483647;pointer-events:none;';
hud.textContent = 'Shift+A: assert  Shift+W: wait  Shift+S: screenshot';
document.body.appendChild(hud);

// ─── Keyboard listener ────────────────────────────────────────────────────────

document.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === 'A' && event.shiftKey) {
    // SPEC DECISION (T-B-38): Shift+A opens the picker regardless of the focused
    // element type (including INPUT fields). No suppression on input focus.
    openPicker();
  } else if (event.key === 'W' && event.shiftKey) {
    const ms = window.prompt('Wait milliseconds:');
    if (ms !== null && ms !== '') {
      emit({ wait: Number(ms) });
    }
  } else if ((event.key === 'S' && event.shiftKey) || event.key === 'PrintScreen') {
    screenshotCounter++;
    emit({ screenshot: `screenshots/step-${screenshotCounter}.png` });
  } else if (event.key === 'Escape') {
    closePicker();
  }
});
