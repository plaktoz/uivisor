export type Selector = string | {
    text: string;
} | {
    role: string;
    name: string;
} | {
    label: string;
} | {
    placeholder: string;
} | {
    testId: string;
} | {
    css: string;
};
export type Command = {
    type: 'goto';
    url: string;
} | {
    type: 'tapOn';
    selector: Selector;
} | {
    type: 'inputText';
    text: string;
} | {
    type: 'inputTextTargeted';
    element: Selector;
    text: string;
} | {
    type: 'assertVisible';
    selector: Selector;
} | {
    type: 'assertNotVisible';
    selector: Selector;
} | {
    type: 'wait';
    ms: number;
} | {
    type: 'assertUrl';
    path: string;
} | {
    type: 'runFlow';
    path: string;
} | {
    type: 'scroll';
    direction: 'up' | 'down' | 'left' | 'right';
} | {
    type: 'assertText';
    selector: Selector;
    expected: string;
} | {
    type: 'assertValue';
    selector: Selector;
    expected: string;
} | {
    type: 'assertCount';
    css: string;
    expected: number;
} | {
    type: 'assertEnabled';
    selector: Selector;
} | {
    type: 'assertDisabled';
    selector: Selector;
} | {
    type: 'assertChecked';
    selector: Selector;
} | {
    type: 'assertUnchecked';
    selector: Selector;
} | {
    type: 'pressKey';
    key: string;
} | {
    type: 'selectOption';
    selector: Selector;
    value: string;
} | {
    type: 'check';
    selector: Selector;
} | {
    type: 'uncheck';
    selector: Selector;
} | {
    type: 'hover';
    selector: Selector;
} | {
    type: 'doubleClick';
    selector: Selector;
} | {
    type: 'clearText';
    selector: Selector;
} | {
    type: 'reload';
} | {
    type: 'goBack';
} | {
    type: 'goForward';
} | {
    type: 'setViewport';
    width: number;
    height: number;
} | {
    type: 'screenshot';
    path: string;
} | {
    type: 'waitFor';
    ms: number;
} | {
    type: 'within';
    selector: string;
    nth?: number;
    do: SessionedCommand[];
};
export type SessionDef = {
    id: string;
    label?: string;
};
export type SessionedCommand = {
    session?: string;
    command: Command;
};
export interface FlowFile {
    baseUrl: string;
    filePath: string;
    commands: SessionedCommand[];
    sessions: SessionDef[];
    tags: string[];
    shared: boolean;
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
export interface RunContext {
    lastTappedLocator: import('playwright').Locator | null;
    callStack: Set<string>;
    indentLevel: number;
    runDir: string;
    sessions: Map<string, import('playwright').Page>;
    defaultSessionId: string;
}
//# sourceMappingURL=types.d.ts.map