import type { Locator } from 'playwright';

export interface PlaywrightContext {
  lastTappedLocator: Locator | null;
  lastTappedLabel?: string; // label = selector as written (AC32)
}

export type Selector =
  | string
  | { text: string }
  | { role: string; name: string }
  | { label: string }
  | { placeholder: string }
  | { testId: string }
  | { css: string }
  | { xpath: string };

/** Values that enter the variable namespace for the duration of one included-flow call. */
export interface VarScope {
  /** Call-site `runFlow.vars`, already interpolated. Shadow every other layer; set/unset of these names die with the scope. */
  readonly overrides: Readonly<Record<string, string>>;
  /** The child's own `vars:`/`config:`. Fill-in only: admitted iff not visible when the scope opens; removed when it closes. */
  readonly defaults: Readonly<Record<string, string>>;
}

/** Global key-value variable map for runtime variable management. */
export interface VarMap {
  get(name: string): string | undefined;   // undefined if absent — does NOT throw
  set(name: string, value: string): void;
  unset(name: string): void;               // always no-op if absent
  toRecord(): Record<string, string>;      // toRecord()[k] === get(k) for every k
  /** Run `run` with `scope` open; the scope closes on every exit path. Scopes nest strictly. */
  withScope<T>(scope: VarScope, run: () => Promise<T>): Promise<T>;
}

/** Runner for built-in and user-defined method calls in setVar. */
export interface MethodRunner {
  call(name: string, resolvedArgs: unknown[]): Promise<string>;
}

/** One entry in a workingSchedule config block. */
export interface WorkingScheduleEntry {
  days: string[];  // e.g. ['mon', 'tue', 'wed', 'thu', 'fri']
  hours: string;   // e.g. '08:00-18:00'
}

/** Flow-level config extracted from config.yml (non-var keys). */
export interface FlowConfig {
  workingSchedule?: WorkingScheduleEntry[];
  holidays?: string[];    // YYYYMMDD strings
  functions?: string[];   // file paths for user-defined functions
}

export type Command =
  | { type: 'goto';               url: string }
  | { type: 'tapOn';              selector: Selector }
  | { type: 'inputText';          text: string }
  | { type: 'inputTextTargeted';  element: Selector; text: string }
  | { type: 'assertVisible';      selector: Selector }
  | { type: 'assertNotVisible';   selector: Selector }
  | { type: 'wait';               ms: number }
  | { type: 'assertUrl';          path: string }
  | { type: 'runFlow';            path: string; vars?: Readonly<Record<string, string>> }
  | { type: 'scroll';             direction: 'up' | 'down' | 'left' | 'right' }
  | { type: 'assertText';      selector: Selector; expected: string }
  | { type: 'assertValue';     selector: Selector; expected: string }
  | { type: 'assertCount';     css: string; expected: number }
  | { type: 'assertEnabled';   selector: Selector }
  | { type: 'assertDisabled';  selector: Selector }
  | { type: 'assertChecked';   selector: Selector }
  | { type: 'assertUnchecked'; selector: Selector }
  | { type: 'pressKey';     key: string }
  | { type: 'selectOption'; selector: Selector; value: string }
  | { type: 'check';        selector: Selector }
  | { type: 'uncheck';      selector: Selector }
  | { type: 'hover';        selector: Selector }
  | { type: 'doubleClick';  selector: Selector }
  | { type: 'clearText';    selector: Selector }
  | { type: 'reload' }
  | { type: 'goBack' }
  | { type: 'goForward' }
  | { type: 'setViewport'; width: number; height: number }
  | { type: 'screenshot';  path: string }
  | { type: 'waitFor';     ms: number }
  | { type: 'waitForPageLoad'; path?: string; timeout?: number }
  | { type: 'crossOriginIframeWarning'; src: string }
  | { type: 'within';     selector: string; nth?: number; do: SessionedCommand[] }
  | { type: 'setVar'; name: string; value: string }
  | { type: 'setVar'; name: string; method: string; args: string[] }
  | { type: 'testVarSet'; name: string; expected?: string }
  | { type: 'unsetVar'; name: string };

export type RunFlowCommand = Extract<Command, { type: 'runFlow' }>;

export type SessionDef = { id: string; label?: string };

// Per-step options, sibling keys next to `session`. After parsing, `timeout` is a
// positive integer, or a string containing `${` (resolved at dispatch). Absent key =
// property absent.
export type SessionedCommand = { session?: string; timeout?: number | string; command: Command };

export interface TimeoutSettings {
  defaultTimeout: number;
  navigationTimeout: number;
}

// Notice order: defaultTimeout, navigationTimeout.
export type TimeoutKey = keyof TimeoutSettings;

// Validated values one flow file sets itself. Each layer holds only the keys that file sets.
export interface FlowTimeoutLayers {
  header: Partial<TimeoutSettings>;
  config: Partial<TimeoutSettings>;
}

export interface FlowFile {
  baseUrl: string;
  filePath: string;
  commands: SessionedCommand[];
  sessions: SessionDef[];
  tags: string[];
  vars?: Record<string, string>;
  flowConfig?: FlowConfig;
  timeouts?: FlowTimeoutLayers; // optional: test literals omit it
}

export interface RunOptions {
  headed: boolean;
  slowMo: number;
  reporter: 'html' | 'md' | null;
  runDir: string;
  tags: string[];
  timeouts?: Partial<TimeoutSettings>; // the CLI layer
}

export interface CommandResult {
  command: Command;
  passed: boolean;
  message?: string;
  expected?: string;
  got?: string;
  screenshotPath?: string;
  nestedResult?: FlowResult;
  durationMs: number;
}

export interface FlowResult {
  filePath: string;
  passed: boolean;
  commandResults: CommandResult[];
  totalCommands: number;
  passedCommands: number;
  durationMs: number;
}

export interface RunResult {
  flows: FlowResult[];
  totalFlows: number;
  passedFlows: number;
  failedFlows: number;
  durationMs: number;
}

export interface RunContext extends PlaywrightContext {
  callStack: Set<string>;
  indentLevel: number;
  runDir: string;
  sessions: Map<string, import('playwright').Page>;
  defaultSessionId: string;
  varMap: VarMap;
  methodRunner: MethodRunner;
  // The run's policy: fixed once per top-level flow in runAll; never written by runFlow.
  // Absent → DEFAULT_TIMEOUTS.
  timeouts?: TimeoutSettings;
  // Absolute paths of child files already noticed in this top-level run.
  timeoutNotices?: Set<string>;
  onProgress?: ProgressListener;
}

/**
 * What the engine reports while a flow runs, from the single place every command passes
 * through (dispatch). Events are well-bracketed and sequential: every stepStart is followed by
 * exactly one stepEnd, and the events between them belong to that step's children (within `do:`
 * items, or the included flow's commands). Within one container, steps start in plan order and
 * stop after the first failure. `include` arrives only while a runFlow step is open, before its
 * first child. Steps carry no ids, so a listener locates them by this bracket structure.
 */
export type ProgressEvent =
  /** `command` is interpolated, or raw when interpolation itself failed. */
  | { kind: 'stepStart'; command: Command }
  | { kind: 'stepEnd'; result: CommandResult }
  /** `file.commands` are raw (uninterpolated). */
  | { kind: 'include'; file: FlowFile };

/** Must not throw: it runs inside the engine. */
export type ProgressListener = (event: ProgressEvent) => void;
