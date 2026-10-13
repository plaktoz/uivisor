import type { FlowFile, FlowResult, ProgressEvent } from '@uivisor/core';
import {
  abortChecklist,
  applyEvent,
  finishChecklist,
  planChecklist,
  renderFinal,
  renderLive,
  FRAME_MS,
  type Checklist,
  type LiveFrame,
  type Viewport,
} from './checklist.js';
import { createPlainReporter, type RunReporter } from './run-reporter.js';

export interface Terminal {
  write(chunk: string): unknown;
  readonly columns?: number;
  readonly rows?: number;
}

export interface ProcessHooks {
  on(event: 'exit' | 'SIGINT', listener: () => void): unknown;
  off(event: 'exit' | 'SIGINT', listener: () => void): unknown;
  listenerCount(event: 'SIGINT'): number;
  exit(code: number): void;
}

export interface LiveDeps {
  readonly out: Terminal;
  readonly now: () => number;
  /** Must not keep the process alive on its own. */
  readonly every: (ms: number, fn: () => void) => { stop(): void };
  readonly proc: ProcessHooks;
  readonly plain: RunReporter;
}

const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const rewind = (lines: number): string => (lines > 0 ? `\x1b[${lines}F\x1b[J` : '');

type Screen =
  | { readonly kind: 'idle' }
  | { readonly kind: 'flow'; readonly file: FlowFile; readonly list: Checklist; readonly height: number; readonly painted: string }
  /** An internal error happened: plain output for the rest of the run. */
  | { readonly kind: 'degraded' }
  | { readonly kind: 'closed' };

function defaultDeps(): LiveDeps {
  return {
    out: process.stdout,
    now: Date.now,
    every: (ms, fn) => {
      const timer = setInterval(fn, ms);
      timer.unref();
      return { stop: () => clearInterval(timer) };
    },
    proc: process,
    plain: createPlainReporter(),
  };
}

/**
 * The in-place checklist. All content decisions live in checklist.ts; this owns the terminal:
 * cursor visibility, repainting the region, and putting the terminal back on close, exit or
 * Ctrl-C. A reporter failure never fails the run: it falls back to plain output instead.
 */
export function createLiveReporter(overrides: Partial<LiveDeps> = {}): RunReporter {
  const { out, now, every, proc, plain } = { ...defaultDeps(), ...overrides };
  let screen: Screen = { kind: 'idle' };
  let ticker: { stop(): void } | null = null;
  let hooked = false;

  const view = (): Viewport => ({ columns: out.columns ?? 80, rows: out.rows ?? 24 });

  const paint = (): void => {
    if (screen.kind !== 'flow') return;
    const frame: LiveFrame = renderLive(screen.list, now(), view());
    const body = `${frame.join('\n')}\n`;
    if (body === screen.painted) return;
    out.write(rewind(screen.height) + body);
    screen = { ...screen, height: frame.length, painted: body };
  };

  /** Replaces the live region with lines that stay in scrollback. */
  const commit = (lines: readonly string[]): void => {
    if (screen.kind !== 'flow') return;
    out.write(`${rewind(screen.height)}${lines.join('\n')}\n`);
    screen = { kind: 'idle' };
  };

  const onExit = (): void => {
    if (hooked) out.write(SHOW_CURSOR);
  };
  const onSigint = (): void => {
    const ours = proc.listenerCount('SIGINT') === 1;
    reporter.close();
    // Playwright registers its own SIGINT handler to close the browser; when it is there it
    // also exits, and exiting here first would leave the browser running.
    if (ours) proc.exit(130);
  };

  const hook = (): void => {
    if (hooked) return;
    hooked = true;
    out.write(HIDE_CURSOR);
    proc.on('exit', onExit);
    proc.on('SIGINT', onSigint);
    ticker = every(FRAME_MS, () => guard(paint));
  };

  const unhook = (): void => {
    ticker?.stop();
    ticker = null;
    if (!hooked) return;
    hooked = false;
    proc.off('exit', onExit);
    proc.off('SIGINT', onSigint);
    out.write(SHOW_CURSOR);
  };

  const guard = (fn: () => void): void => {
    try {
      fn();
    } catch {
      const file = screen.kind === 'flow' ? screen.file : null;
      screen = { kind: 'degraded' };
      try {
        unhook();
      } catch {
        // the terminal is already unusable; plain output below is all that is left
      }
      if (file) plain.startFlow(file);
    }
  };

  const reporter: RunReporter = {
    startFlow(file) {
      if (screen.kind === 'degraded') return plain.startFlow(file);
      if (screen.kind === 'closed') return;
      guard(() => {
        hook();
        screen = { kind: 'flow', file, list: planChecklist(file, now()), height: 0, painted: '' };
        paint();
      });
    },

    onProgress(event: ProgressEvent) {
      guard(() => {
        if (screen.kind === 'flow') screen = { ...screen, list: applyEvent(screen.list, event, now()) };
      });
    },

    endFlow(result: FlowResult) {
      if (screen.kind === 'flow') {
        const list = screen.list;
        guard(() => commit(renderFinal(finishChecklist(list, result), view().columns)));
      }
      if (screen.kind === 'degraded') plain.endFlow(result);
    },

    runEnd(result) {
      plain.runEnd(result);
    },

    close() {
      if (screen.kind === 'flow') {
        const list = screen.list;
        guard(() => commit(renderFinal(abortChecklist(list, now()), view().columns)));
      }
      guard(unhook);
      screen = { kind: 'closed' };
    },
  };
  return reporter;
}
