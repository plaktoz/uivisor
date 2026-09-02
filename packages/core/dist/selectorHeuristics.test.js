import { describe, it, expect } from 'vitest';
import { resolveSelector } from './selectorHeuristics.js';
describe('resolveSelector', () => {
    // TC001 — data-testid attribute → { testId: "submit-btn" }
    it('TC001: returns testId shape when data-testid is present', () => {
        const el = document.createElement('button');
        el.setAttribute('data-testid', 'submit-btn');
        el.textContent = 'Submit';
        expect(resolveSelector(el)).toEqual({ testId: 'submit-btn' });
    });
    // TC002 — Visible text "Click me" → { text: "Click me" }
    it('TC002: returns text shape for visible text', () => {
        const el = document.createElement('span');
        el.textContent = 'Click me';
        expect(resolveSelector(el)).toEqual({ text: 'Click me' });
    });
    // TC003 — Text with leading/trailing whitespace → trimmed
    it('TC003: trims leading and trailing whitespace from text', () => {
        const el = document.createElement('button');
        el.textContent = '  Submit  ';
        expect(resolveSelector(el)).toEqual({ text: 'Submit' });
    });
    // TC004 — Input linked to <label for> → { label: "Email address" }
    it('TC004: returns label shape for input linked to label via for/id', () => {
        document.body.innerHTML = '<label for="e1">Email address</label><input id="e1">';
        const input = document.getElementById('e1');
        expect(resolveSelector(input)).toEqual({ label: 'Email address' });
    });
    // TC005 — Text exactly 60 chars → not truncated
    it('TC005: does not truncate text of exactly 60 chars', () => {
        const el = document.createElement('p');
        el.textContent = 'B'.repeat(60);
        expect(resolveSelector(el)).toEqual({ text: 'B'.repeat(60) });
    });
    // TC006 — Text exactly 61 chars → truncated to 60 chars
    it('TC006: truncates text of 61 chars to exactly 60 chars', () => {
        const el = document.createElement('p');
        el.textContent = 'C'.repeat(61);
        expect(resolveSelector(el)).toEqual({ text: 'C'.repeat(60) });
    });
    // TC007 — role="checkbox" + aria-label → { role, name }
    it('TC007: returns role+name shape when explicit role and aria-label are present', () => {
        const el = document.createElement('div');
        el.setAttribute('role', 'checkbox');
        el.setAttribute('aria-label', 'Accept terms');
        expect(resolveSelector(el)).toEqual({ role: 'checkbox', name: 'Accept terms' });
    });
    // TC008 — placeholder="Search..." → { placeholder: "Search..." }
    it('TC008: returns placeholder shape when placeholder attribute is present', () => {
        const el = document.createElement('input');
        el.setAttribute('placeholder', 'Search...');
        expect(resolveSelector(el)).toEqual({ placeholder: 'Search...' });
    });
    // TC009 — Empty data-testid skipped → falls to text
    it('TC009: skips empty data-testid and falls through to text', () => {
        const el = document.createElement('button');
        el.setAttribute('data-testid', '');
        el.textContent = 'OK';
        expect(resolveSelector(el)).toEqual({ text: 'OK' });
    });
    // TC010 — Whitespace-only text skipped → falls to role+name
    it('TC010: skips whitespace-only text and falls through to role+name', () => {
        const el = document.createElement('button');
        el.textContent = '   ';
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', 'Save');
        expect(resolveSelector(el)).toEqual({ role: 'button', name: 'Save' });
    });
    // TC011 — Nested child text is collected
    it('TC011: collects text from nested child elements', () => {
        const el = document.createElement('div');
        el.innerHTML = '<strong>Hello</strong> <em>world</em>';
        const result = resolveSelector(el);
        expect(result).toHaveProperty('text');
        expect(result.text.trim()).toBe('Hello world');
    });
    // TC012 — Element with id → { css: "div#main-content" }
    it('TC012: returns css shape with id fragment', () => {
        const el = document.createElement('div');
        el.setAttribute('id', 'main-content');
        expect(resolveSelector(el)).toEqual({ css: 'div#main-content' });
    });
    // TC013 — Element with multiple classes → { css: "button.primary.large" }
    it('TC013: returns css shape with multiple classes', () => {
        const el = document.createElement('button');
        el.setAttribute('class', 'primary large');
        expect(resolveSelector(el)).toEqual({ css: 'button.primary.large' });
    });
    // TC014 — Bare <span> (no attrs, no text) → { css: "span" }
    it('TC014: returns bare tag css for element with no attrs and no text', () => {
        const el = document.createElement('span');
        expect(resolveSelector(el)).toEqual({ css: 'span' });
    });
    // TC015 — testId trumps visible text
    it('TC015: testId takes priority over visible text', () => {
        const el = document.createElement('button');
        el.setAttribute('data-testid', 'btn');
        el.textContent = 'Click';
        expect(resolveSelector(el)).toEqual({ testId: 'btn' });
    });
    // TC016 — testId trumps placeholder
    it('TC016: testId takes priority over placeholder', () => {
        const el = document.createElement('input');
        el.setAttribute('data-testid', 'search');
        el.setAttribute('placeholder', 'Search');
        expect(resolveSelector(el)).toEqual({ testId: 'search' });
    });
    // TC017 — Element with id AND class → { css: "input#email.form-control" }
    it('TC017: returns css shape with both id and class', () => {
        const el = document.createElement('input');
        el.setAttribute('id', 'email');
        el.setAttribute('class', 'form-control');
        expect(resolveSelector(el)).toEqual({ css: 'input#email.form-control' });
    });
    // TC018 — Label via wrapping ancestor → { label: "Username" }
    it('TC018: returns label shape when input is wrapped by a label ancestor', () => {
        document.body.innerHTML = '<label>Username <input type="text"></label>';
        const input = document.querySelector('input');
        const result = resolveSelector(input);
        expect(result).toHaveProperty('label');
        expect(result.label).toBe('Username');
    });
    // TC019 — role with no accessible name → falls through to label
    it('TC019: role with no accessible name falls through to label', () => {
        document.body.innerHTML = '<label for="cb">Remember me</label><input id="cb" role="checkbox">';
        const input = document.getElementById('cb');
        expect(resolveSelector(input)).toEqual({ label: 'Remember me' });
    });
    // TC020 — text trumps role+name
    it('TC020: visible text takes priority over role+name', () => {
        const el = document.createElement('button');
        el.textContent = 'Save';
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', 'Save document');
        expect(resolveSelector(el)).toEqual({ text: 'Save' });
    });
    // TC021 — resolveSelector is exported as a function
    it('TC021: resolveSelector is exported as a function', () => {
        expect(typeof resolveSelector).toBe('function');
    });
});
//# sourceMappingURL=selectorHeuristics.test.js.map