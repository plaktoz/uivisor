/**
 * CAPTURE_SCRIPT — browser IIFE string for injection via page.addInitScript().
 *
 * Listens for DOM events (click, input/blur, change, keydown, popstate,
 * hashchange) and emits typed Command objects via window.__uivisorCapture().
 *
 * resolveSelector logic is inlined as plain JS — no imports, no TypeScript
 * annotations, safe for direct script injection.
 */
export const CAPTURE_SCRIPT: string = `(function() {
  // --- resolveSelector (inlined from selectorHeuristics.ts, plain JS) ---
  function resolveSelector(el) {
    // P1: data-testid
    var testId = el.getAttribute('data-testid');
    if (testId) return { testId: testId };

    // P2: visible text <= 60 chars, skip whitespace-only
    var text = (el.textContent || '').trim();
    if (text.length > 0) return { text: text.slice(0, 60) };

    // P3: explicit role + accessible name
    var role = el.getAttribute('role');
    if (role) {
      var ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) return { role: role, name: ariaLabel };
      var labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        var labelEl = el.ownerDocument && el.ownerDocument.getElementById(labelledBy);
        if (labelEl && (labelEl.textContent || '').trim()) {
          return { role: role, name: labelEl.textContent.trim() };
        }
      }
    }

    // P4: associated <label> via for/id or wrapping ancestor
    var id = el.getAttribute('id');
    if (id) {
      var forLabelEl = el.ownerDocument && el.ownerDocument.querySelector('label[for="' + id + '"]');
      if (forLabelEl && (forLabelEl.textContent || '').trim()) {
        return { label: forLabelEl.textContent.trim() };
      }
    }
    var ancestor = el.parentElement;
    while (ancestor) {
      if (ancestor.tagName.toLowerCase() === 'label' && (ancestor.textContent || '').trim()) {
        return { label: ancestor.textContent.trim() };
      }
      ancestor = ancestor.parentElement;
    }

    // P5: placeholder
    var placeholder = el.getAttribute('placeholder');
    if (placeholder) return { placeholder: placeholder };

    // P6: CSS fallback
    var css = el.tagName.toLowerCase();
    var elId = el.getAttribute('id');
    if (elId) css += '#' + elId;
    el.classList.forEach(function(c) { css += '.' + c; });
    return { css: css };
  }

  // --- emit helper ---
  function emit(cmd) {
    if (typeof window.__uivisorCapture === 'function') {
      window.__uivisorCapture(cmd);
    }
  }

  // --- debounce state ---
  var pending = new WeakMap();

  // --- click handler (capture phase) ---
  document.addEventListener('click', function(e) {
    var el = e.target;
    if (!el) return;
    if (el.id === 'uivisor-hud' || (el.closest && el.closest('#uivisor-hud'))) return;
    emit({ type: 'tapOn', selector: resolveSelector(el) });
  }, true);

  // --- input handler (debounce: emit on blur or 500ms idle) ---
  document.addEventListener('input', function(e) {
    var el = e.target;
    if (!el) return;
    var tag = el.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') return;
    if (el.type === 'checkbox' || el.type === 'radio') return;
    clearTimeout(pending.get(el));
    pending.set(el, setTimeout(function() {
      pending.delete(el);
      emit({ type: 'inputTextTargeted', element: resolveSelector(el), text: el.value });
    }, 500));
  }, true);

  document.addEventListener('blur', function(e) {
    var el = e.target;
    if (!el) return;
    var tag = el.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') return;
    if (el.type === 'checkbox' || el.type === 'radio') return;
    if (!pending.has(el)) return;
    clearTimeout(pending.get(el));
    pending.delete(el);
    emit({ type: 'inputTextTargeted', element: resolveSelector(el), text: el.value });
  }, true);

  // --- change handler (select and checkbox) ---
  document.addEventListener('change', function(e) {
    var el = e.target;
    if (!el) return;
    if (el.tagName === 'SELECT') {
      emit({ type: 'selectOption', selector: resolveSelector(el), value: el.value });
    } else if (el.type === 'checkbox') {
      if (el.checked) {
        emit({ type: 'check', selector: resolveSelector(el) });
      } else {
        emit({ type: 'uncheck', selector: resolveSelector(el) });
      }
    }
  }, true);

  // --- keydown handler (Enter / Tab / Escape only) ---
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'Escape') {
      emit({ type: 'pressKey', key: e.key });
    }
  }, true);

  // --- navigation handlers ---
  window.addEventListener('popstate', function() {
    emit({ type: 'goto', url: window.location.href });
  });

  window.addEventListener('hashchange', function() {
    emit({ type: 'goto', url: window.location.href });
  });
})();`;
