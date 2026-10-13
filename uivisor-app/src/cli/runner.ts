import * as path from 'path';
import type { Page } from 'playwright';
import type { RunOptions, RunResult, FlowResult } from '@uivisor/core';
import { loadAndParse } from '../parser/index.js';
import { launchBrowser, closeBrowser, createSessionPages } from '../driver/browser.js';
import { runFlow } from '../engine/index.js';
import { createContext } from '../engine/context.js';
import { createVarMap } from '../engine/varMap.js';
import { createMethodRunner } from '../engine/methodRunner.js';
import { createPlainReporter, type RunReporter } from '../reporter/run-reporter.js';

export async function runAll(
  targets: string[],
  options: RunOptions,
  reporter: RunReporter = createPlainReporter(),
): Promise<RunResult> {
  const start = Date.now();
  // Close the initial page immediately; per-flow pages are provisioned below.
  const { browser, page: _initialPage } = await launchBrowser(options);
  await _initialPage.close();
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

        const varMap = createVarMap(file.vars ?? {});
        const methodRunner = await createMethodRunner(
          file.flowConfig?.functions ?? [],
          file.flowConfig?.workingSchedule,
          file.flowConfig?.holidays,
        );
        const ctx = createContext(options.runDir, sessions, defaultSessionId, varMap, methodRunner, reporter.onProgress);
        reporter.startFlow(file);
        const firstPage = sessions.get(defaultSessionId)!;
        const result = await runFlow(file, firstPage, ctx);
        flowResults.push(result);
        reporter.endFlow(result);
      } finally {
        // Close session pages after each flow regardless of success or failure.
        if (sessions) {
          for (const p of sessions.values()) await p.close();
        }
      }
    }
  } finally {
    try {
      reporter.close();
    } finally {
      await closeBrowser(browser);
    }
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
