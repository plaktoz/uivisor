import type { RunContext } from '../types.js';

export function createContext(
  runDir: string,
  sessions: Map<string, import('playwright').Page>,
  defaultSessionId: string,
): RunContext {
  return { lastTappedLocator: null, callStack: new Set(), indentLevel: 0, runDir, sessions, defaultSessionId };
}
