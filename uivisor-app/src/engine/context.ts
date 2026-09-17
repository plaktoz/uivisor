import type { RunContext, VarMap, MethodRunner } from '@uivisor/core';
import { createVarMap } from './varMap.js';

/** No-op MethodRunner used as a placeholder when no methodRunner is provided. */
const noopMethodRunner: MethodRunner = {
  call: async (name: string) => {
    throw new Error(`MethodRunner not configured — cannot call "${name}"`);
  },
};

export function createContext(
  runDir: string,
  sessions: Map<string, import('playwright').Page>,
  defaultSessionId: string,
  varMap: VarMap = createVarMap({}),
  methodRunner: MethodRunner = noopMethodRunner,
): RunContext {
  return {
    lastTappedLocator: null,
    callStack: new Set(),
    indentLevel: 0,
    runDir,
    sessions,
    defaultSessionId,
    varMap,
    methodRunner,
  };
}
