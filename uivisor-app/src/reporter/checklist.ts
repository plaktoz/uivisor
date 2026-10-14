import * as path from 'path';
import type { Command, CommandResult, FlowFile, FlowResult, ProgressEvent, SessionedCommand } from '@uivisor/core';
import { commandLabel } from './label.js';
import { failureLines, flowSummary } from './console.js';
import { width, truncate, visible } from './cells.js';

export type StepState =
  | { readonly phase: 'pending' }
  | { readonly phase: 'running'; readonly startedAt: number; readonly command: Command }
  | { readonly phase: 'done'; readonly result: CommandResult };

type WithinCommand = Extract<Command, { type: 'within' }>;
type RunFlowCommand = Extract<Command, { type: 'runFlow' }>;

export type Step =
  | { readonly kind: 'leaf'; readonly planned: Command; readonly state: StepState }
  | { readonly kind: 'within'; readonly planned: WithinCommand; readonly state: StepState; readonly children: readonly Step[] }
  | { readonly kind: 'runFlow'; readonly planned: RunFlowCommand; readonly state: StepState; readonly children: readonly Step[] | null };

export type ChecklistEnd =
  | { readonly kind: 'finished'; readonly result: FlowResult }
  | { readonly kind: 'aborted'; readonly at: number };

export interface Checklist {
  readonly filePath: string;
  readonly startedAt: number;
  readonly steps: readonly Step[];
  readonly end: ChecklistEnd | null;
}

export type EndedChecklist = Checklist & { readonly end: ChecklistEnd };

export class ChecklistProtocolError extends Error {}

const PENDING: StepState = { phase: 'pending' };

export function planChecklist(file: FlowFile, now: number): Checklist {
  return { filePath: file.filePath, startedAt: now, steps: planSteps(file.commands), end: null };
}

function planSteps(commands: readonly SessionedCommand[]): Step[] {
  return commands.map(({ command }): Step => {
    switch (command.type) {
      case 'within': return { kind: 'within', planned: command, state: PENDING, children: planSteps(command.do) };
      case 'runFlow': return { kind: 'runFlow', planned: command, state: PENDING, children: null };
      default: return { kind: 'leaf', planned: command, state: PENDING };
    }
  });
}

function childrenOf(step: Step): readonly Step[] {
  return step.kind === 'leaf' ? [] : step.children ?? [];
}

function runningPath(steps: readonly Step[]): number[] {
  const i = steps.findIndex((s) => s.state.phase === 'running');
  return i < 0 ? [] : [i, ...runningPath(childrenOf(steps[i]))];
}

function stepAt(steps: readonly Step[], at: readonly number[]): Step {
  const step = steps[at[0]];
  return at.length === 1 ? step : stepAt(childrenOf(step), at.slice(1));
}

function updateAt(steps: readonly Step[], at: readonly number[], fn: (s: Step) => Step): Step[] {
  return steps.map((s, i) => {
    if (i !== at[0]) return s;
    if (at.length === 1) return fn(s);
    if (s.kind === 'leaf' || s.children === null) throw new ChecklistProtocolError('path runs through a step with no children');
    return { ...s, children: updateAt(s.children, at.slice(1), fn) };
  });
}

export function applyEvent(list: Checklist, event: ProgressEvent, now: number): Checklist {
  if (list.end !== null) throw new ChecklistProtocolError(`${event.kind} after the flow ended`);
  const open = runningPath(list.steps);
  const openStep = open.length > 0 ? stepAt(list.steps, open) : null;

  switch (event.kind) {
    case 'stepStart': {
      if (openStep?.kind === 'leaf') throw new ChecklistProtocolError(`stepStart inside leaf ${openStep.planned.type}`);
      if (openStep?.kind === 'runFlow' && openStep.children === null) throw new ChecklistProtocolError('stepStart inside runFlow before include');
      const siblings = openStep ? childrenOf(openStep) : list.steps;
      const i = siblings.findIndex((s) => s.state.phase === 'pending');
      if (i < 0) throw new ChecklistProtocolError(`stepStart ${event.command.type} with no pending step`);
      if (siblings[i].planned.type !== event.command.type) {
        throw new ChecklistProtocolError(`stepStart ${event.command.type} where ${siblings[i].planned.type} was planned`);
      }
      const state: StepState = { phase: 'running', startedAt: now, command: event.command };
      return { ...list, steps: updateAt(list.steps, [...open, i], (s) => ({ ...s, state })) };
    }
    case 'stepEnd': {
      if (!openStep) throw new ChecklistProtocolError('stepEnd with no running step');
      if (openStep.planned.type !== event.result.command.type) {
        throw new ChecklistProtocolError(`stepEnd ${event.result.command.type} while ${openStep.planned.type} is running`);
      }
      const state: StepState = { phase: 'done', result: event.result };
      return { ...list, steps: updateAt(list.steps, open, (s) => ({ ...s, state })) };
    }
    case 'include': {
      if (openStep?.kind !== 'runFlow' || openStep.children !== null) {
        throw new ChecklistProtocolError('include outside a runFlow awaiting its file');
      }
      const children = planSteps(event.file.commands);
      return { ...list, steps: updateAt(list.steps, open, (s) => ({ ...s, children })) };
    }
    // Not part of the step tree — the live reporter intercepts and prints it before
    // reaching here (see live.ts); applyEvent leaves the checklist untouched.
    case 'notice':
      return list;
  }
}

export function finishChecklist(list: Checklist, result: FlowResult): EndedChecklist {
  return { ...list, end: { kind: 'finished', result } };
}

export function abortChecklist(list: Checklist, now: number): EndedChecklist {
  return list.end !== null ? { ...list, end: list.end } : { ...list, end: { kind: 'aborted', at: now } };
}

export type Mark = 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'interrupted';

export interface Row {
  readonly depth: number;
  readonly mark: Mark;
  readonly label: string;
  readonly ms: number | null;
  readonly details: readonly string[];
}

function markOf(step: Step, closed: boolean, aborted: boolean): Mark {
  switch (step.state.phase) {
    case 'pending': return closed ? 'skipped' : 'pending';
    case 'running': return aborted ? 'interrupted' : 'running';
    case 'done': return step.state.result.passed ? 'passed' : 'failed';
  }
}

function labelOf(step: Step): string {
  switch (step.state.phase) {
    case 'pending': return visible(commandLabel(step.planned));
    case 'running': return visible(commandLabel(step.state.command));
    case 'done': return visible(commandLabel(step.state.result.command));
  }
}

function failureDetails(r: CommandResult): string[] {
  return failureLines(r).flatMap((l) => l.split('\n').map(visible));
}

export function toRows(list: Checklist, now: number): Row[] {
  const ended = list.end !== null;
  const aborted = list.end?.kind === 'aborted';
  const elapsedUntil = list.end?.kind === 'aborted' ? list.end.at : now;
  const rows: Row[] = [];

  const visit = (steps: readonly Step[], depth: number, closed: boolean): void => {
    for (const step of steps) {
      const mark = markOf(step, closed, aborted);
      const index = rows.length;
      rows.push({ depth, mark, label: labelOf(step), ms: msOf(step, elapsedUntil), details: [] });
      const childrenStart = rows.length;
      visit(childrenOf(step), depth + 1, ended || mark === 'skipped' || step.state.phase === 'done');
      const failedChild = rows.slice(childrenStart).some((r) => r.mark === 'failed');
      if (mark === 'failed' && !failedChild && step.state.phase === 'done') {
        rows[index] = { ...rows[index], details: failureDetails(step.state.result) };
      }
    }
  };
  visit(list.steps, 1, ended);
  return rows;
}

function msOf(step: Step, now: number): number | null {
  switch (step.state.phase) {
    case 'pending': return null;
    case 'running': return Math.max(0, now - step.state.startedAt);
    case 'done': return step.state.result.durationMs;
  }
}

export interface Viewport {
  readonly columns: number;
  readonly rows: number;
}

/**
 * Lines that can be repainted in place: no line wraps and the block never scrolls, so moving
 * the cursor up by the line count lands on the first line.
 */
export type LiveFrame = readonly string[] & { readonly __liveFrame: unique symbol };

export const FRAME_MS = 100;
export const SPINNER = ['◐', '◓', '◑', '◒'] as const;

const ICON: Record<Exclude<Mark, 'running'>, string> = {
  pending: '○',
  passed: '✓',
  failed: '✗',
  skipped: '–',
  interrupted: '✗',
};

export function formatDuration(ms: number): string {
  if (ms < 60_000) return `${(Math.floor(ms / 100) / 10).toFixed(1)}s`;
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
}

export function formatClock(ms: number): string {
  const s = Math.floor(Math.max(0, ms) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function rightColumn(row: Row): string {
  if (row.ms === null) return '';
  if (row.mark === 'running') return `${formatDuration(row.ms)}…`;
  if (row.mark === 'interrupted') return `${formatDuration(row.ms)} interrupted`;
  return formatDuration(row.ms);
}

function stepLeft(row: Row, now: number): string {
  const icon = row.mark === 'running' ? SPINNER[Math.floor(now / FRAME_MS) % SPINNER.length] : ICON[row.mark];
  return `${'  '.repeat(row.depth)}${icon} ${row.label}`;
}

function detailLines(row: Row): string[] {
  return row.details.map((d) => `${'  '.repeat(row.depth + 1)}${d}`);
}

function fitLine(left: string, right: string, cols: number): string {
  if (right === '') return truncate(left, cols);
  const room = cols - width(right) - 1;
  if (room < 1) return truncate(right, cols);
  const l = truncate(left, room);
  return l + ' '.repeat(cols - width(l) - width(right)) + right;
}

function padLine(left: string, right: string, cols: number): string {
  if (right === '') return left;
  const gap = cols - width(left) - width(right);
  return left + ' '.repeat(Math.max(1, gap)) + right;
}

const title = (list: Checklist): string => `▶ ${path.basename(list.filePath)}`;

export function renderLive(list: Checklist, now: number, view: Viewport): LiveFrame {
  const cols = Math.max(1, view.columns - 1);
  const maxLines = Math.max(1, view.rows - 1);
  const rows = toRows(list, now);

  const n = list.steps.length;
  const done = list.steps.filter((s) => s.state.phase === 'done').length;
  const header = fitLine(title(list), `(step ${Math.min(n, done + 1)} of ${n} · ${formatClock(now - list.startedAt)})`, cols);

  const body: string[] = [];
  let focusStart = 0;
  let focusEnd = 0;
  let focusIsRunning = false;
  for (const row of rows) {
    const start = body.length;
    body.push(fitLine(stepLeft(row, now), rightColumn(row), cols));
    for (const d of detailLines(row)) body.push(truncate(d, cols));
    if (row.mark === 'running') {
      [focusStart, focusEnd, focusIsRunning] = [start, body.length, true];
    } else if (!focusIsRunning && (row.mark === 'passed' || row.mark === 'failed')) {
      [focusStart, focusEnd] = [start, body.length];
    }
  }

  return [header, ...windowLines(body, focusStart, focusEnd, maxLines - 1, cols)] as unknown as LiveFrame;
}

const LOOKAHEAD_FRACTION_DIVISOR = 3;

function windowLines(lines: readonly string[], focusStart: number, focusEnd: number, budget: number, cols: number): string[] {
  if (lines.length <= budget) return [...lines];
  if (budget < 3) return lines.slice(focusStart, focusStart + budget);
  const after = Math.floor((budget - 1) / LOOKAHEAD_FRACTION_DIVISOR);
  let start = Math.min(Math.max(0, focusEnd + after - budget), lines.length - budget);
  start = Math.min(start, Math.max(0, focusStart - 1));
  const end = start + budget;
  const bodyStart = start > 0 ? start + 1 : start;
  const bodyEnd = end < lines.length ? end - 1 : end;
  const marker = (count: number): string => truncate(`  … ${count} more`, cols);
  return [
    ...(bodyStart > 0 ? [marker(bodyStart)] : []),
    ...lines.slice(bodyStart, bodyEnd),
    ...(bodyEnd < lines.length ? [marker(lines.length - bodyEnd)] : []),
  ];
}

export function renderFinal(list: EndedChecklist, columns: number): string[] {
  const cols = Math.max(1, columns - 1);
  const endAt = list.end.kind === 'aborted' ? list.end.at : list.startedAt + list.end.result.durationMs;
  const lines = [padLine(title(list), `(${formatClock(endAt - list.startedAt)})`, cols)];
  for (const row of toRows(list, endAt)) {
    lines.push(padLine(stepLeft(row, endAt), rightColumn(row), cols));
    lines.push(...detailLines(row));
  }
  if (list.end.kind === 'finished') lines.push(flowSummary(list.end.result));
  return lines;
}
