import type { RunContext, VarMap, MethodRunner, ProgressListener, TimeoutSettings } from '@uivisor/core';
import { DEFAULT_TIMEOUTS } from '@uivisor/core';
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
  timeouts: TimeoutSettings = DEFAULT_TIMEOUTS,
  onProgress?: ProgressListener,
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
    timeouts,
    timeoutNotices: new Set(),
    onProgress,
  };
}
