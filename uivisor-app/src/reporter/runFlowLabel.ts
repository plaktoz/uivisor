import type { RunFlowCommand } from '@uivisor/core';

export function runFlowLabel(cmd: RunFlowCommand): string {
  const vars = Object.entries(cmd.vars ?? {}).map(([name, value]) => `${name}=${value}`);
  return vars.length > 0 ? `runFlow: ${cmd.path} (${vars.join(', ')})` : `runFlow: ${cmd.path}`;
}
