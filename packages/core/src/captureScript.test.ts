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

  // CS-04: click on button with text emits tapOn with pipe text= selector
  it('CS-04: click on button with text emits tapOn with text= pipe selector', () => {
    const btn = document.createElement('button');
    btn.textContent = 'Submit';
    document.body.appendChild(btn);
    btn.click();
    expect(capture).toHaveBeenCalledOnce();
    expect(capture.mock.calls[0][0]).toEqual({ type: 'tapOn', selector: 'text=Submit' });
  });

  // CS-05: click on button with data-testid emits tapOn with pipe data-testid= selector
  it('CS-05: click on button with data-testid emits tapOn with data-testid= pipe selector', () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'btn');
    document.body.appendChild(btn);
    btn.click();
    expect(capture).toHaveBeenCalledOnce();
    expect(capture.mock.calls[0][0]).toEqual({ type: 'tapOn', selector: 'data-testid=btn' });
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

  // -------------------------------------------------------------------------
  // Pipe selector (buildPipeSelector) — ACs 1–7, 22–23
  // -------------------------------------------------------------------------

  // AC-1: all 5 attributes present → correct pipe string
  it('AC-1: all 5 attributes → correct priority-ordered pipe string', () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'my-btn');
    btn.setAttribute('id', 'btn-id');
    btn.setAttribute('name', 'btn-name');
    btn.setAttribute('placeholder', 'btn-ph');
    btn.textContent = 'Submit';
    document.body.appendChild(btn);
    btn.click();
    expect(capture).toHaveBeenCalledOnce();
    const sel = capture.mock.calls[0][0].selector as string;
    expect(sel).toContain('data-testid=my-btn');
    expect(sel).toContain('id=btn-id');
    expect(sel).toContain('name=btn-name');
    expect(sel).toContain('placeholder=btn-ph');
    expect(sel).toContain('text=Submit');
    // data-* comes before id which comes before name which comes before placeholder which comes before text
    expect(sel.indexOf('data-testid=')).toBeLessThan(sel.indexOf('id='));
    expect(sel.indexOf('id=')).toBeLessThan(sel.indexOf('name='));
    expect(sel.indexOf('name=')).toBeLessThan(sel.indexOf('placeholder='));
    expect(sel.indexOf('placeholder=')).toBeLessThan(sel.indexOf('text='));
  });

  // AC-2: only data-testid → single segment, no pipe char
  it('AC-2: only data-testid → single segment, no pipe char', () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'lone-btn');
    document.body.appendChild(btn);
    btn.click();
    expect(capture).toHaveBeenCalledOnce();
    const sel = capture.mock.calls[0][0].selector as string;
    expect(sel).toBe('data-testid=lone-btn');
    expect(sel).not.toContain('|');
  });

  // AC-3: text fallback → text=Submit
  it('AC-3: text fallback → text=Submit', () => {
    const btn = document.createElement('button');
    btn.textContent = 'Submit';
    document.body.appendChild(btn);
    btn.click();
    expect(capture).toHaveBeenCalledOnce();
    expect(capture.mock.calls[0][0].selector).toBe('text=Submit');
  });

  // AC-4: id + placeholder (no data-*) → id=btn|placeholder=Enter name
  it('AC-4: id + placeholder (no data-*) → id=btn|placeholder=Enter name', () => {
    const input = document.createElement('input');
    input.setAttribute('id', 'btn');
    input.setAttribute('placeholder', 'Enter name');
    document.body.appendChild(input);
    input.click();
    expect(capture).toHaveBeenCalledOnce();
    expect(capture.mock.calls[0][0].selector).toBe('id=btn|placeholder=Enter name');
  });

  // AC-5: two data-* attributes → alphabetically sorted
  it('AC-5: two data-* attributes → alphabetically sorted in pipe string', () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-zone', 'z-val');
    btn.setAttribute('data-action', 'a-val');
    document.body.appendChild(btn);
    btn.click();
    expect(capture).toHaveBeenCalledOnce();
    const sel = capture.mock.calls[0][0].selector as string;
    expect(sel.startsWith('data-action=a-val')).toBe(true);
    expect(sel).toContain('data-zone=z-val');
    expect(sel.indexOf('data-action=')).toBeLessThan(sel.indexOf('data-zone='));
  });

  // AC-6: css= fallback when nothing qualifies
  it('AC-6: css= fallback when no attributes qualify', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    div.click();
    expect(capture).toHaveBeenCalledOnce();
    const sel = capture.mock.calls[0][0].selector as string;
    expect(sel.startsWith('css=')).toBe(true);
    expect(sel).toContain('nth-child');
  });

  // AC-7: name + placeholder priority
  it('AC-7: name + placeholder → name before placeholder in pipe string', () => {
    const input = document.createElement('input');
    input.setAttribute('name', 'email');
    input.setAttribute('placeholder', 'Enter email');
    document.body.appendChild(input);
    input.click();
    expect(capture).toHaveBeenCalledOnce();
    const sel = capture.mock.calls[0][0].selector as string;
    expect(sel).toBe('name=email|placeholder=Enter email');
  });

  // AC-22: 60-char text cap (61-char input truncated)
  it('AC-22: 61-char text is capped at 60 chars in pipe selector', () => {
    const btn = document.createElement('button');
    btn.textContent = 'a'.repeat(61);
    document.body.appendChild(btn);
    btn.click();
    expect(capture).toHaveBeenCalledOnce();
    const sel = capture.mock.calls[0][0].selector as string;
    expect(sel).toBe('text=' + 'a'.repeat(60));
  });

  // AC-23: empty data-testid skipped (empty value not included)
  it('AC-23: empty data-testid is skipped', () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', '');
    btn.textContent = 'Click me';
    document.body.appendChild(btn);
    btn.click();
    expect(capture).toHaveBeenCalledOnce();
    const sel = capture.mock.calls[0][0].selector as string;
    expect(sel).not.toContain('data-testid=');
    expect(sel).toBe('text=Click me');
  });

  // -------------------------------------------------------------------------
  // Within detection — ACs 8–18
  // -------------------------------------------------------------------------

  // AC-8a: semantic container tr triggers within
  it('AC-8a: click inside <tr> wraps in within', () => {
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'tr-btn');
    td.appendChild(btn);
    tr.appendChild(td);
    tbody.appendChild(tr);
    table.appendChild(tbody);
    document.body.appendChild(table);
    btn.click();
    expect(capture).toHaveBeenCalledOnce();
    expect(capture.mock.calls[0][0].type).toBe('within');
  });

  // AC-8b: semantic container li triggers within
  it('AC-8b: click inside <li> wraps in within', () => {
    const ul = document.createElement('ul');
    const li = document.createElement('li');
    li.setAttribute('data-testid', 'list-row');
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'li-btn');
    li.appendChild(btn);
    ul.appendChild(li);
    document.body.appendChild(ul);
    btn.click();
    expect(capture).toHaveBeenCalledOnce();
    const cmd = capture.mock.calls[0][0];
    expect(cmd.type).toBe('within');
    expect(cmd.selector).toBe('data-testid=list-row');
  });

  // AC-8c: semantic container role=row triggers within
  it('AC-8c: click inside role="row" element wraps in within', () => {
    const container = document.createElement('div');
    container.setAttribute('role', 'row');
    container.setAttribute('data-testid', 'role-row');
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'row-btn');
    container.appendChild(btn);
    document.body.appendChild(container);
    btn.click();
    expect(capture).toHaveBeenCalledOnce();
    const cmd = capture.mock.calls[0][0];
    expect(cmd.type).toBe('within');
    expect(cmd.selector).toBe('data-testid=role-row');
  });

  // AC-8d: semantic container role=listitem triggers within
  it('AC-8d: click inside role="listitem" element wraps in within', () => {
    const container = document.createElement('div');
    container.setAttribute('role', 'listitem');
    container.setAttribute('data-testid', 'role-listitem');
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'li-inner-btn');
    container.appendChild(btn);
    document.body.appendChild(container);
    btn.click();
    expect(capture).toHaveBeenCalledOnce();
    expect(capture.mock.calls[0][0].type).toBe('within');
  });

  // AC-9: count-based ≥2 siblings triggers within, 1 sibling does not
  it('AC-9a: ≥2 siblings with same tag triggers within', () => {
    const parent = document.createElement('div');
    const row1 = document.createElement('div');
    const row2 = document.createElement('div');
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'count-btn');
    row1.appendChild(btn);
    parent.appendChild(row1);
    parent.appendChild(row2);
    document.body.appendChild(parent);
    btn.click();
    expect(capture).toHaveBeenCalledOnce();
    expect(capture.mock.calls[0][0].type).toBe('within');
  });

  it('AC-9b: 1 sibling does NOT trigger within', () => {
    const parent = document.createElement('div');
    const row1 = document.createElement('div');
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'singleton-btn');
    row1.appendChild(btn);
    parent.appendChild(row1);
    document.body.appendChild(parent);
    btn.click();
    expect(capture).toHaveBeenCalledOnce();
    expect(capture.mock.calls[0][0].type).toBe('tapOn');
  });

  // AC-10: 3rd container → nth: 2 (0-based)
  it('AC-10: clicking button in 3rd <li> produces nth: 2', () => {
    const ul = document.createElement('ul');
    for (let i = 0; i < 3; i++) {
      const li = document.createElement('li');
      li.setAttribute('data-testid', `row-${i}`);
      const btn = document.createElement('button');
      btn.setAttribute('data-testid', 'action');
      li.appendChild(btn);
      ul.appendChild(li);
    }
    document.body.appendChild(ul);
    const thirdBtn = ul.children[2].querySelector('button') as HTMLElement;
    thirdBtn.click();
    expect(capture).toHaveBeenCalledOnce();
    const cmd = capture.mock.calls[0][0];
    expect(cmd.type).toBe('within');
    expect(cmd.nth).toBe(2);
  });

  // AC-11: container with data-testid uses single attr in within.selector (not pipe)
  it('AC-11: container selector uses single data-testid attr (not pipe)', () => {
    const ul = document.createElement('ul');
    const li = document.createElement('li');
    li.setAttribute('data-testid', 'the-row');
    li.setAttribute('id', 'also-has-id');
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'inner-action');
    li.appendChild(btn);
    ul.appendChild(li);
    document.body.appendChild(ul);
    btn.click();
    expect(capture).toHaveBeenCalledOnce();
    const cmd = capture.mock.calls[0][0];
    expect(cmd.type).toBe('within');
    // data-testid wins over id (first alphabetically among data-*)
    expect(cmd.selector).toBe('data-testid=the-row');
    expect(cmd.selector).not.toContain('|');
  });

  // AC-12: unique element → no within, bare tapOn
  it('AC-12: unique element selector → bare tapOn without within', () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'truly-unique-btn');
    document.body.appendChild(btn);
    btn.click();
    expect(capture).toHaveBeenCalledOnce();
    const cmd = capture.mock.calls[0][0];
    expect(cmd.type).toBe('tapOn');
    expect(cmd.selector).toBe('data-testid=truly-unique-btn');
  });

  // AC-13: non-unique, ancestor walk finds unique wrapper → within
  it('AC-13: non-unique selector resolved by ancestor walk → within (reactive path)', () => {
    const section = document.createElement('section');
    section.setAttribute('id', 'section-a');
    const btn1 = document.createElement('button');
    btn1.setAttribute('data-testid', 'shared-action');
    section.appendChild(btn1);

    const footer = document.createElement('footer');
    const btn2 = document.createElement('button');
    btn2.setAttribute('data-testid', 'shared-action');
    footer.appendChild(btn2);

    document.body.appendChild(section);
    document.body.appendChild(footer);

    btn1.click();
    expect(capture).toHaveBeenCalledOnce();
    const cmd = capture.mock.calls[0][0];
    expect(cmd.type).toBe('within');
    expect(cmd.selector).toBe('id=section-a');
  });

  // AC-14: no ancestor resolves ambiguous selector → css= nth-child tapOn, no within
  it('AC-14: no ancestor resolves → css= nth-child tapOn, no within', () => {
    const btn1 = document.createElement('button');
    btn1.setAttribute('data-testid', 'bare-dup');
    document.body.appendChild(btn1);

    const btn2 = document.createElement('button');
    btn2.setAttribute('data-testid', 'bare-dup');
    document.body.appendChild(btn2);

    btn1.click();
    expect(capture).toHaveBeenCalledOnce();
    const cmd = capture.mock.calls[0][0];
    expect(cmd.type).toBe('tapOn');
    expect((cmd.selector as string).startsWith('css=')).toBe(true);
    expect((cmd.selector as string)).toContain('nth-child');
  });

  // AC-15: reactive within omits nth (ancestor is document-unique)
  it('AC-15: reactive path within omits nth', () => {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-unique', 'yes');
    const btn1 = document.createElement('button');
    btn1.setAttribute('data-testid', 'reactive-btn');
    wrapper.appendChild(btn1);

    const footer = document.createElement('footer');
    const btn2 = document.createElement('button');
    btn2.setAttribute('data-testid', 'reactive-btn');
    footer.appendChild(btn2);

    document.body.appendChild(wrapper);
    document.body.appendChild(footer);

    btn1.click();
    expect(capture).toHaveBeenCalledOnce();
    const cmd = capture.mock.calls[0][0];
    expect(cmd.type).toBe('within');
    expect('nth' in cmd).toBe(false);
  });

  // AC-16: role= token matching (role="row grid" triggers)
  it('AC-16: role="row grid" token matches row → within fires', () => {
    const container = document.createElement('div');
    container.setAttribute('role', 'row grid');
    container.setAttribute('data-testid', 'multi-role');
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'multi-role-btn');
    container.appendChild(btn);
    document.body.appendChild(container);
    btn.click();
    expect(capture).toHaveBeenCalledOnce();
    expect(capture.mock.calls[0][0].type).toBe('within');
  });

  // AC-17: clicking directly on a <li> — within still fires
  it('AC-17: click directly on <li> element — within still fires', () => {
    const ul = document.createElement('ul');
    const li = document.createElement('li');
    li.setAttribute('data-testid', 'direct-li');
    ul.appendChild(li);
    document.body.appendChild(ul);
    li.click();
    expect(capture).toHaveBeenCalledOnce();
    const cmd = capture.mock.calls[0][0];
    expect(cmd.type).toBe('within');
  });

  // AC-18: one click → one __uivisorCapture call
  it('AC-18: one click → exactly one __uivisorCapture call', () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'single-click');
    document.body.appendChild(btn);
    btn.click();
    expect(capture).toHaveBeenCalledOnce();
  });
});
