import { describe, it, expect } from 'vitest';
import { COMMAND_TRAITS } from './commandTraits.js';
import type { Command } from './types.js';

const ELEMENT_TYPES: Command['type'][] = [
  'tapOn', 'doubleClick', 'hover', 'inputText', 'inputTextTargeted', 'clearText',
  'selectOption', 'check', 'uncheck', 'assertVisible', 'assertNotVisible', 'assertText',
  'assertValue', 'assertEnabled', 'assertDisabled', 'assertChecked', 'assertUnchecked',
  'assertUrl', 'assertCount', 'within',
];

const NAVIGATION_TYPES: Command['type'][] = ['goto', 'reload', 'goBack', 'goForward', 'waitForPageLoad'];

const NONE_TYPES: Command['type'][] = [
  'wait', 'waitFor', 'scroll', 'setViewport', 'screenshot', 'setVar', 'testVarSet',
  'unsetVar', 'runFlow', 'pressKey', 'crossOriginIframeWarning',
];

describe('COMMAND_TRAITS', () => {
  it('has exactly one entry per Command["type"], independently enumerated', () => {
    const allTypes = [...ELEMENT_TYPES, ...NAVIGATION_TYPES, ...NONE_TYPES];
    const keys = Object.keys(COMMAND_TRAITS);
    expect(keys.sort()).toEqual([...allTypes].sort());
  });

  it('assigns the element trait to exactly the 20 Constraints-table element commands', () => {
    for (const t of ELEMENT_TYPES) {
      expect(COMMAND_TRAITS[t].timeout).toBe('element');
    }
  });

  it('assigns the navigation trait to exactly goto, reload, goBack, goForward, waitForPageLoad', () => {
    for (const t of NAVIGATION_TYPES) {
      expect(COMMAND_TRAITS[t].timeout).toBe('navigation');
    }
  });

  it('assigns the none trait to wait, waitFor, scroll, setViewport, screenshot, setVar, testVarSet, unsetVar, runFlow, pressKey, crossOriginIframeWarning', () => {
    for (const t of NONE_TYPES) {
      expect(COMMAND_TRAITS[t].timeout).toBe('none');
    }
    expect(COMMAND_TRAITS.pressKey.timeout).toBe('none');
    expect(COMMAND_TRAITS.within.timeout).not.toBe('none');
  });

  it('no entry carries preCheck, action or checkpoint', () => {
    for (const entry of Object.values(COMMAND_TRAITS)) {
      expect(entry).not.toHaveProperty('preCheck');
      expect(entry).not.toHaveProperty('action');
      expect(entry).not.toHaveProperty('checkpoint');
    }
  });

  it("setVar's two overloaded shapes both map to one COMMAND_TRAITS['setVar'] key, not duplicated", () => {
    const keys = Object.keys(COMMAND_TRAITS).filter((k) => k === 'setVar');
    expect(keys).toEqual(['setVar']);
    expect(COMMAND_TRAITS.setVar.timeout).toBe('none');
  });
});
