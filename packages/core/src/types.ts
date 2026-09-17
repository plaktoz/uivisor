import type { Locator } from 'playwright';

export interface PlaywrightContext {
  lastTappedLocator: Locator | null;
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

/** Global key-value variable map for runtime variable management. */
export interface VarMap {
  get(name: string): string | undefined;   // undefined if absent — does NOT throw
  set(name: string, value: string): void;
  unset(name: string): void;               // always no-op if absent
  toRecord(): Record<string, string>;      // runtime entries override base
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
  | { type: 'runFlow';            path: string }
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

export type SessionDef = { id: string; label?: string };

export type SessionedCommand = { session?: string; command: Command };

export interface FlowFile {
  baseUrl: string;
  filePath: string;
  commands: SessionedCommand[];
  sessions: SessionDef[];
  tags: string[];
  vars?: Record<string, string>;
  flowConfig?: FlowConfig;
}

export interface RunOptions {
  headed: boolean;
  slowMo: number;
  reporter: 'html' | 'md' | null;
  runDir: string;
  tags: string[];
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
}
