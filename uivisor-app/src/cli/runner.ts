import * as path from 'path';
import type { RunOptions, RunResult, FlowResult } from '../types.js';
import { loadAndParse } from '../parser/index.js';
import { launchBrowser, closeBrowser } from '../driver/browser.js';
import { runFlow } from '../engine/index.js';
import { createContext } from '../engine/context.js';
import { ConsoleReporter } from '../reporter/console.js';

export async function runAll(
  targets: string[],
  options: RunOptions,
): Promise<RunResult> {
  const start = Date.now();
  const { browser, page } = await launchBrowser(options);
  const reporter = new ConsoleReporter();
  const flowResults: FlowResult[] = [];

  try {
    for (const target of targets) {
      const absTarget = path.resolve(target);
      const file = loadAndParse(absTarget);
      const ctx = createContext(options.runDir);
      reporter.startFlow(file.filePath, ctx.indentLevel);
      const result = await runFlow(file, page, ctx);
      flowResults.push(result);

      for (const cmdResult of result.commandResults) {
        reporter.reportCommand(cmdResult, 0);
      }
      reporter.endFlow(result);
    }
  } finally {
    await closeBrowser(browser);
  }

  const passedFlows = flowResults.filter((f) => f.passed).length;
  const runResult: RunResult = {
    flows: flowResults,
    totalFlows: flowResults.length,
    passedFlows,
    failedFlows: flowResults.length - passedFlows,
    durationMs: Date.now() - start,
  };

  reporter.runEnd(runResult);
  return runResult;
}
