export type Selector =
  | string
  | { text: string }
  | { role: string; name: string }
  | { label: string }
  | { placeholder: string }
  | { testId: string };

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
  | { type: 'scroll';             direction: 'up' | 'down' | 'left' | 'right' };

export interface FlowFile {
  baseUrl: string;
  filePath: string;
  commands: Command[];
}

export interface RunOptions {
  headed: boolean;
  slowMo: number;
  reporter: 'html' | 'md' | null;
  runDir: string;
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

export interface RunContext {
  lastTappedLocator: import('playwright').Locator | null;
  callStack: Set<string>;
  indentLevel: number;
  runDir: string;
}
