import type { FlowFile, FlowResult, ProgressListener, RunResult } from '@uivisor/core';
import { ConsoleReporter } from './console.js';

export interface RunReporter {
  startFlow(file: FlowFile): void;
  readonly onProgress: ProgressListener;
  endFlow(result: FlowResult): void;
  runEnd(result: RunResult): void;
  close(): void;
}

export type ConsoleFlag = 'auto' | 'plain' | 'live';

export function resolveConsoleMode(
  flag: ConsoleFlag,
  out: { readonly isTTY?: boolean },
  env: Readonly<Record<string, string | undefined>>,
): 'plain' | 'live' {
  if (flag !== 'auto') return flag;
  return out.isTTY === true && env.TERM !== 'dumb' ? 'live' : 'plain';
}

export function createPlainReporter(con: ConsoleReporter = new ConsoleReporter()): RunReporter {
  return {
    startFlow: (file) => con.startFlow(file.filePath, 0),
    onProgress: (event) => {
      if (event.kind === 'notice') con.notice(event.message);
    },
    endFlow: (result) => {
      for (const r of result.commandResults) con.reportCommand(r, 0);
      con.endFlow(result);
    },
    runEnd: (result) => con.runEnd(result),
    close: () => {},
  };
}
