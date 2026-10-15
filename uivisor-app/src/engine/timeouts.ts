/**
 * src/engine/timeouts.ts
 *
 * Single source of truth for the timeout precedence order
 * "sibling > CLI > header > config > built-in".
 *
 * - The parser only validates the header/config layers.
 * - `resolveRunTimeouts` composes the CLI/header/config/built-in layers into
 *   one `TimeoutSettings` per top-level flow (called once per top-level flow
 *   by `runAll`).
 * - `stepTimeoutMs` adds the sibling ("own") layer on top, per step
 *   (called by `dispatch`).
 * - `timeoutNotice` reports when a child flow's own header/config timeout
 *   value is overridden by the top-level run's effective value.
 */
import * as path from 'path';
import type { Command, FlowFile, TimeoutKey, TimeoutSettings } from '@uivisor/core';
import { COMMAND_TRAITS, DEFAULT_TIMEOUTS } from '@uivisor/core';

const NOTICE_KEY_ORDER: TimeoutKey[] = ['defaultTimeout', 'navigationTimeout'];

function firstDefined(
  header: Partial<TimeoutSettings> | undefined,
  config: Partial<TimeoutSettings> | undefined,
  key: TimeoutKey,
): number | undefined {
  return header?.[key] ?? config?.[key];
}

/**
 * Per key: cli ?? file.timeouts.header ?? file.timeouts.config ?? DEFAULT_TIMEOUTS
 * (header beats config, AC54).
 */
export function resolveRunTimeouts(
  cli: Partial<TimeoutSettings>,
  file: Pick<FlowFile, 'timeouts'>,
): TimeoutSettings {
  const header = file.timeouts?.header;
  const config = file.timeouts?.config;

  const defaultTimeout = cli.defaultTimeout ?? firstDefined(header, config, 'defaultTimeout') ?? DEFAULT_TIMEOUTS.defaultTimeout;
  const navigationTimeout = cli.navigationTimeout ?? firstDefined(header, config, 'navigationTimeout') ?? DEFAULT_TIMEOUTS.navigationTimeout;

  return { defaultTimeout, navigationTimeout };
}

/**
 * COMMAND_TRAITS[type].timeout: 'none' → undefined; 'element' → own ?? run.defaultTimeout;
 * 'navigation' → own ?? run.navigationTimeout.
 */
export function stepTimeoutMs(
  type: Command['type'],
  own: number | undefined,
  run: TimeoutSettings,
): number | undefined {
  const trait = COMMAND_TRAITS[type].timeout;
  if (trait === 'none') return undefined;
  if (trait === 'navigation') return own ?? run.navigationTimeout;
  return own ?? run.defaultTimeout;
}

/**
 * Keys in [defaultTimeout, navigationTimeout] order where (header ?? config) is set
 * AND !== run[k] → `${basename(child.filePath)}: ${keys.join(', ')} ignored (inherited
 * from ${basename(topLevelPath)})`, else null.
 */
export function timeoutNotice(
  child: FlowFile,
  run: TimeoutSettings,
  topLevelPath: string,
): string | null {
  const header = child.timeouts?.header;
  const config = child.timeouts?.config;

  const keys = NOTICE_KEY_ORDER.filter((key) => {
    const own = firstDefined(header, config, key);
    return own !== undefined && own !== run[key];
  });

  if (keys.length === 0) return null;

  return `${path.basename(child.filePath)}: ${keys.join(', ')} ignored (inherited from ${path.basename(topLevelPath)})`;
}
