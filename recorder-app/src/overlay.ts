// ─── OVERLAY_SCRIPT — IIFE string for page.addInitScript() injection ─────────
// Plain-JS browser IIFE injected by cli.ts via page.addInitScript(OVERLAY_SCRIPT).
// No imports. All browser code is self-contained inside the string.

export const OVERLAY_SCRIPT: string = `(function() {
  var screenshotCounter = 0;
  var currentPicker = null;

  function emit(cmd) {
    if (typeof window.__uivisorOverlay === 'function') {
      window.__uivisorOverlay(cmd);
    }
  }

  function getSelector() {
    var active = document.activeElement;
    if (active && active !== document.body) {
      var testid = active.getAttribute('data-testid');
      if (testid) {
        return '[data-testid="' + testid + '"]';
      }
    }
    return '';
  }

  function closePicker() {
    if (currentPicker) {
      currentPicker.remove();
      currentPicker = null;
    }
  }

  function openPicker() {
    if (currentPicker) return;
    var picker = document.createElement('div');
    picker.setAttribute('data-testid', 'uivisor-picker');
    picker.style.cssText =
      'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'background:#fff;border:1px solid #999;padding:12px;border-radius:4px;' +
      'z-index:2147483646;font:13px monospace;';
    var assertionTypes = [
      'assertVisible','assertText','assertValue','assertUrl',
      'assertEnabled','assertDisabled','assertChecked','assertUnchecked'
    ];
    for (var i = 0; i < assertionTypes.length; i++) {
      (function(type) {
        var btn = document.createElement('button');
        btn.setAttribute('data-testid', 'uivisor-option-' + type);
        btn.textContent = type;
        btn.style.cssText = 'display:block;margin:4px 0;padding:4px 8px;cursor:pointer;width:100%;';
        btn.addEventListener('click', function() {
          var selector = getSelector();
          if (type === 'assertText') {
            var text = window.prompt('Expected text:');
            if (text === null) return;
            emit({ assertText: { element: selector, text: text } });
            closePicker();
          } else if (type === 'assertValue') {
            var value = window.prompt('Expected value:');
            if (value === null) return;
            emit({ assertValue: { element: selector, value: value } });
            closePicker();
          } else if (type === 'assertUrl') {
            emit({ assertUrl: window.location.href });
            closePicker();
          } else {
            var cmd = {};
            cmd[type] = selector;
            emit(cmd);
            closePicker();
          }
        });
        picker.appendChild(btn);
      })(assertionTypes[i]);
    }
    document.body.appendChild(picker);
    currentPicker = picker;
  }

  var hud = document.createElement('div');
  hud.id = 'uivisor-hud';
  hud.style.cssText =
    'position:fixed;bottom:8px;right:8px;background:rgba(0,0,0,0.75);color:#fff;' +
    'font:12px monospace;padding:6px 10px;border-radius:4px;z-index:2147483647;pointer-events:none;';
  hud.textContent = 'Shift+A: assert  Shift+W: wait  Shift+S: screenshot';
  document.body.appendChild(hud);

  document.addEventListener('keydown', function(event) {
    if (event.key === 'A' && event.shiftKey) {
      openPicker();
    } else if (event.key === 'W' && event.shiftKey) {
      var ms = window.prompt('Wait milliseconds:');
      if (ms !== null && ms !== '') {
        emit({ wait: Number(ms) });
      }
    } else if ((event.key === 'S' && event.shiftKey) || event.key === 'PrintScreen') {
      screenshotCounter++;
      emit({ screenshot: 'screenshots/step-' + screenshotCounter + '.png' });
    } else if (event.key === 'Escape') {
      closePicker();
    }
  });
})();`;
