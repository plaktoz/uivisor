import type { FlowFile, FlowResult, ProgressListener, RunResult } from '@uivisor/core';
import { ConsoleReporter } from './console.js';

/**
 * Console output for one `uivisor test` run. Per flow the runner calls startFlow before the
 * first command and endFlow after the last; onProgress is wired into the flow's RunContext.
 * runEnd follows once. close() releases the terminal and is safe to call at any point, more
 * than once, including after a throw.
 */
export interface RunReporter {
  startFlow(file: FlowFile): void;
  readonly onProgress: ProgressListener;
  endFlow(result: FlowResult): void;
  runEnd(result: RunResult): void;
  close(): void;
}

/** `--reporter plain|live`; auto when neither is given. */
export type ConsoleFlag = 'auto' | 'plain' | 'live';

/** A forced flag wins, so `--reporter live` into a pipe still draws the checklist. */
export function resolveConsoleMode(
  flag: ConsoleFlag,
  out: { readonly isTTY?: boolean },
  env: Readonly<Record<string, string | undefined>>,
): 'plain' | 'live' {
  if (flag !== 'auto') return flag;
  return out.isTTY === true && env.TERM !== 'dumb' ? 'live' : 'plain';
}

/**
 * Today's append-only output. It ignores progress and prints each flow after it finishes,
 * because a passing runFlow line is printed before its children, which a streaming printer
 * cannot know in time.
 */
export function createPlainReporter(con: ConsoleReporter = new ConsoleReporter()): RunReporter {
  return {
    startFlow: (file) => con.startFlow(file.filePath, 0),
    onProgress: () => {},
    endFlow: (result) => {
      for (const r of result.commandResults) con.reportCommand(r, 0);
      con.endFlow(result);
    },
    runEnd: (result) => con.runEnd(result),
    close: () => {},
  };
}
