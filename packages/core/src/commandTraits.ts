import type { Command } from './types.js';

export type TimeoutTrait = 'element' | 'navigation' | 'none';

/**
 * Phase-1 timeout trait per command type (Gate 1 Constraints table, §6/§6.2).
 * A type annotation (not `satisfies`) is used deliberately so a missing key or
 * an excess literal key fails `tsc` (AC71).
 */
export const COMMAND_TRAITS: Record<Command['type'], { timeout: TimeoutTrait }> = {
  // element
  tapOn: { timeout: 'element' },
  doubleClick: { timeout: 'element' },
  hover: { timeout: 'element' },
  inputText: { timeout: 'element' },
  inputTextTargeted: { timeout: 'element' },
  clearText: { timeout: 'element' },
  selectOption: { timeout: 'element' },
  check: { timeout: 'element' },
  uncheck: { timeout: 'element' },
  assertVisible: { timeout: 'element' },
  assertNotVisible: { timeout: 'element' },
  assertText: { timeout: 'element' },
  assertValue: { timeout: 'element' },
  assertEnabled: { timeout: 'element' },
  assertDisabled: { timeout: 'element' },
  assertChecked: { timeout: 'element' },
  assertUnchecked: { timeout: 'element' },
  assertUrl: { timeout: 'element' },
  assertCount: { timeout: 'element' },
  within: { timeout: 'element' },

  // navigation
  goto: { timeout: 'navigation' },
  reload: { timeout: 'navigation' },
  goBack: { timeout: 'navigation' },
  goForward: { timeout: 'navigation' },
  waitForPageLoad: { timeout: 'navigation' },

  // none
  wait: { timeout: 'none' },
  waitFor: { timeout: 'none' },
  scroll: { timeout: 'none' },
  setViewport: { timeout: 'none' },
  screenshot: { timeout: 'none' },
  setVar: { timeout: 'none' },
  testVarSet: { timeout: 'none' },
  unsetVar: { timeout: 'none' },
  runFlow: { timeout: 'none' },
  pressKey: { timeout: 'none' },
  crossOriginIframeWarning: { timeout: 'none' },
};
