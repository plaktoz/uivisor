import * as path from 'path';
import type { Page } from 'playwright';
import type { FlowFile, FlowResult, RunContext } from '../types.js';
import { dispatch, registerRunFlow } from './dispatcher.js';

async function runFlow(file: FlowFile, page: Page, ctx: RunContext): Promise<FlowResult> {
  const start = Date.now();
  const commandResults = [];
  const flowStem = path.basename(file.filePath, '.yaml');

  for (const cmd of file.commands) {
    const result = await dispatch(page, cmd, ctx, flowStem);
    commandResults.push(result);
    if (!result.passed) break; // halt on first failure
  }

  const passedCommands = commandResults.filter((r) => r.passed).length;
  const totalCommands = commandResults.length;

  return {
    filePath: file.filePath,
    passed: passedCommands === file.commands.length,
    commandResults,
    totalCommands: file.commands.length,
    passedCommands,
    durationMs: Date.now() - start,
  };
}

// Register runFlow with dispatcher to handle nested runFlow commands
registerRunFlow(runFlow);

export { runFlow };
