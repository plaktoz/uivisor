import * as path from 'path';
import type { Page } from 'playwright';
import type { CommandResult, FlowFile, FlowResult, RunContext } from '../types.js';
import { dispatch, registerRunFlow } from './dispatcher.js';

async function runFlow(file: FlowFile, page: Page, ctx: RunContext): Promise<FlowResult> {
  const start = Date.now();
  const commandResults: CommandResult[] = [];
  const flowStem = path.basename(file.filePath, '.yaml');
  const flowDir = path.dirname(file.filePath);

  // NOTE: lastTappedLocator is shared across all sessions (known limitation).
  for (const sc of file.commands) {
    const effectiveId = sc.session ?? ctx.defaultSessionId;
    const sessionPage = ctx.sessions.get(effectiveId);
    if (!sessionPage) {
      throw new Error(`Unknown session: "${effectiveId}"`);
    }

    let result: CommandResult;

    // For runFlow commands with an explicit session, temporarily set defaultSessionId so
    // nested flows inherit that session as their default.
    if (sc.command.type === 'runFlow' && sc.session !== undefined) {
      const savedDefaultSessionId = ctx.defaultSessionId;
      ctx.defaultSessionId = sc.session;
      try {
        result = await dispatch(sessionPage, sc.command, ctx, flowStem, flowDir);
      } finally {
        ctx.defaultSessionId = savedDefaultSessionId;
      }
    } else {
      result = await dispatch(sessionPage, sc.command, ctx, flowStem, flowDir);
    }

    commandResults.push(result);
    if (!result.passed) break; // halt on first failure
  }

  const passedCommands = commandResults.filter((r) => r.passed).length;

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
