import * as path from 'path';
import type { Page } from 'playwright';
import type { RunOptions, RunResult, FlowResult } from '../types.js';
import { loadAndParse } from '../parser/index.js';
import { launchBrowser, closeBrowser, createSessionPages } from '../driver/browser.js';
import { runFlow } from '../engine/index.js';
import { createContext } from '../engine/context.js';
import { ConsoleReporter } from '../reporter/console.js';

export async function runAll(
  targets: string[],
  options: RunOptions,
): Promise<RunResult> {
  const start = Date.now();
  // Close the initial page immediately; per-flow pages are provisioned below.
  const { browser, page: _initialPage } = await launchBrowser(options);
  await _initialPage.close();
  const reporter = new ConsoleReporter();
  const flowResults: FlowResult[] = [];

  try {
    for (const target of targets) {
      const absTarget = path.resolve(target);
      const file = loadAndParse(absTarget);

      let sessions: Map<string, Page> | undefined;
      try {
        let defaultSessionId: string;

        if (file.sessions.length > 0) {
          sessions = await createSessionPages(browser, file.sessions.map((s) => s.id));
          defaultSessionId = file.sessions[0].id;
        } else {
          sessions = new Map([['__default__', await browser.newPage()]]);
          defaultSessionId = '__default__';
        }

        const ctx = createContext(options.runDir, sessions, defaultSessionId);
        reporter.startFlow(file.filePath, ctx.indentLevel);
        const firstPage = sessions.get(defaultSessionId)!;
        const result = await runFlow(file, firstPage, ctx);
        flowResults.push(result);

        for (const cmdResult of result.commandResults) {
          reporter.reportCommand(cmdResult, 0);
        }
        reporter.endFlow(result);
      } finally {
        // Close session pages after each flow regardless of success or failure.
        if (sessions) {
          for (const p of sessions.values()) await p.close();
        }
      }
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
