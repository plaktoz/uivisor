import type { RunContext } from '../types.js';

export function createContext(runDir: string): RunContext {
  return { lastTappedLocator: null, callStack: new Set(), indentLevel: 0, runDir };
}
