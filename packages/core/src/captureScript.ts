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
  // Used by input/blur/change handlers only.
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

  // --- buildPipeSelector — pipe-syntax selector for click events ---
  function buildPipeSelector(el) {
    var parts = [];

    // 1. data-* attributes (alphabetical order)
    var dataAttrs = [];
    var attrs = el.attributes;
    for (var i = 0; i < attrs.length; i++) {
      var a = attrs[i];
      if (a.name.indexOf('data-') === 0 && a.value !== '') {
        dataAttrs.push(a.name);
      }
    }
    dataAttrs.sort();
    for (var j = 0; j < dataAttrs.length; j++) {
      parts.push(dataAttrs[j] + '=' + el.getAttribute(dataAttrs[j]));
    }

    // 2. id
    var idVal = el.getAttribute('id');
    if (idVal && idVal !== '') parts.push('id=' + idVal);

    // 3. name
    var nameVal = el.getAttribute('name');
    if (nameVal && nameVal !== '') parts.push('name=' + nameVal);

    // 4. placeholder
    var phVal = el.getAttribute('placeholder');
    if (phVal && phVal !== '') parts.push('placeholder=' + phVal);

    // 5. text (innerText or textContent, capped at 60 chars)
    var textVal = ((el.innerText !== undefined ? el.innerText : '') || el.textContent || '').trim();
    if (textVal.length > 60) textVal = textVal.slice(0, 60);
    if (textVal !== '') parts.push('text=' + textVal);

    // 6. css= fallback
    if (parts.length === 0) {
      if (!el.parentElement) {
        return 'css=' + el.tagName.toLowerCase();
      }
      var idx = Array.prototype.indexOf.call(el.parentElement.children, el) + 1;
      return 'css=' + el.tagName.toLowerCase() + ':nth-child(' + idx + ')';
    }

    return parts.join('|');
  }

  // --- buildCssFallback — nth-child css= fallback ---
  function buildCssFallback(el) {
    if (!el.parentElement) {
      return 'css=' + el.tagName.toLowerCase();
    }
    var idx = Array.prototype.indexOf.call(el.parentElement.children, el) + 1;
    return 'css=' + el.tagName.toLowerCase() + ':nth-child(' + idx + ')';
  }

  // --- emit helper ---
  function emit(cmd) {
    if (typeof window.__uivisorCapture === 'function') {
      window.__uivisorCapture(cmd);
    }
  }

  // --- debounce state ---
  var pending = new WeakMap();

  // --- within-detection helpers ---
  function isSemanticRepeater(el) {
    var tag = el.tagName.toLowerCase();
    if (tag === 'tr' || tag === 'li') return true;
    var elRole = ' ' + (el.getAttribute('role') || '') + ' ';
    return elRole.indexOf(' row ') !== -1 || elRole.indexOf(' listitem ') !== -1;
  }

  function countBasedSiblings(el) {
    if (!el.parentElement) return 0;
    return Array.prototype.filter.call(
      el.parentElement.children,
      function(c) { return c.tagName === el.tagName; }
    ).length;
  }

  function findSemanticContainer(el) {
    // Check el itself first
    if (isSemanticRepeater(el)) return el;
    // Walk ancestors
    var cur = el.parentElement;
    while (cur) {
      var bodyTag = cur.tagName && cur.tagName.toLowerCase();
      if (bodyTag === 'body' || bodyTag === 'html') break;
      if (isSemanticRepeater(cur)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  function findCountBasedContainer(el) {
    var cur = el.parentElement;
    while (cur) {
      var bodyTag = cur.tagName && cur.tagName.toLowerCase();
      if (bodyTag === 'body' || bodyTag === 'html') break;
      if (countBasedSiblings(cur) >= 2) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  function findRepeatingContainer(el) {
    return findSemanticContainer(el) || findCountBasedContainer(el);
  }

  function buildContainerSelector(containerEl) {
    // Single best attribute (not pipe)
    var attrs = containerEl.attributes;
    var dataAttrs = [];
    for (var i = 0; i < attrs.length; i++) {
      var a = attrs[i];
      if (a.name.indexOf('data-') === 0 && a.value !== '') {
        dataAttrs.push(a.name);
      }
    }
    if (dataAttrs.length > 0) {
      dataAttrs.sort();
      return dataAttrs[0] + '=' + containerEl.getAttribute(dataAttrs[0]);
    }
    var idVal = containerEl.getAttribute('id');
    if (idVal && idVal !== '') return 'id=' + idVal;
    var textVal = ((containerEl.innerText !== undefined ? containerEl.innerText : '') || containerEl.textContent || '').trim();
    if (textVal !== '') return 'text=' + textVal.slice(0, 60);
    return 'nth-only';
  }

  function findAncestorThatUniquesEl(el, pipeSelector) {
    var firstSeg = pipeSelector.split('|')[0];
    var eqIdx = firstSeg.indexOf('=');
    if (eqIdx === -1) return null;
    var attrName = firstSeg.slice(0, eqIdx);
    var attrVal = firstSeg.slice(eqIdx + 1);
    var cssAttr = '[' + attrName + '="' + attrVal + '"]';
    var cur = el.parentElement;
    while (cur) {
      var bodyTag = cur.tagName && cur.tagName.toLowerCase();
      if (bodyTag === 'body' || bodyTag === 'html') break;
      try {
        if (cur.querySelectorAll(cssAttr).length === 1) return cur;
      } catch(e) {}
      cur = cur.parentElement;
    }
    return null;
  }

  // --- click handler (capture phase) ---
  document.addEventListener('click', function(e) {
    var el = e.target;
    if (!el) return;
    if (el.id === 'uivisor-hud' || (el.closest && el.closest('#uivisor-hud'))) return;

    var tapOnSelector = buildPipeSelector(el);
    var tapOnCmd = { type: 'tapOn', selector: tapOnSelector };

    var container = findRepeatingContainer(el);
    var reactiveContainer = false;

    if (!container) {
      // reactive path: check if tapOn selector is document-unique
      var firstSeg = tapOnSelector.split('|')[0];
      var eqIdx = firstSeg.indexOf('=');
      if (eqIdx !== -1) {
        var attrName = firstSeg.slice(0, eqIdx);
        var attrVal = firstSeg.slice(eqIdx + 1);
        var cssAttr = '[' + attrName + '="' + attrVal + '"]';
        try {
          if (document.querySelectorAll(cssAttr).length > 1) {
            container = findAncestorThatUniquesEl(el, tapOnSelector);
            if (container) reactiveContainer = true;
          }
        } catch(e) {}
      }
    }

    if (container) {
      var containerSel = buildContainerSelector(container);
      var withinCmd;
      if (reactiveContainer) {
        withinCmd = {
          type: 'within',
          selector: containerSel === 'nth-only' ? '' : containerSel,
          do: [{ command: tapOnCmd }]
        };
      } else {
        var siblings = Array.prototype.filter.call(
          container.parentElement ? container.parentElement.children : [],
          function(c) { return c.tagName === container.tagName; }
        );
        var nth = siblings.indexOf(container);
        withinCmd = {
          type: 'within',
          selector: containerSel === 'nth-only' ? '' : containerSel,
          nth: nth,
          do: [{ command: tapOnCmd }]
        };
      }
      emit(withinCmd);
    } else {
      // If tapOnSelector is non-unique but no ancestor resolves, use css= fallback
      var firstSeg2 = tapOnSelector.split('|')[0];
      var eqIdx2 = firstSeg2.indexOf('=');
      if (eqIdx2 !== -1) {
        var attrName2 = firstSeg2.slice(0, eqIdx2);
        var attrVal2 = firstSeg2.slice(eqIdx2 + 1);
        var cssAttr2 = '[' + attrName2 + '="' + attrVal2 + '"]';
        try {
          if (document.querySelectorAll(cssAttr2).length > 1) {
            tapOnCmd = { type: 'tapOn', selector: buildCssFallback(el) };
          }
        } catch(e) {}
      }
      emit(tapOnCmd);
    }
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
