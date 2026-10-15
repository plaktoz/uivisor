import * as path from 'path';
import { readYamlFile } from './reader.js';
import { flattenVars, interpolateValue } from '@uivisor/core';
import type { FlowConfig, TimeoutSettings, WorkingScheduleEntry } from '@uivisor/core';
import { validateTimeoutKeys } from './validator.js';

/** Keys in config.yml that are NOT simple variables but flow-config data. */
const FLOW_CONFIG_KEYS = new Set([
  'workingSchedule', 'holidays', 'functions',
  'defaultTimeout', 'navigationTimeout',
]);

export interface LoadConfigFileResult {
  vars: Record<string, string>;
  flowConfig: FlowConfig;
  timeouts: Partial<TimeoutSettings>;
}

/**
 * Load an external config YAML, strip flow-config keys (workingSchedule, holidays,
 * functions), flatten the remainder to vars, and resolve ${env.*} expressions in values.
 * The configPath must already be interpolated; it is resolved relative to the flow file's dir.
 */
export function loadConfigFile(
  configPath: string,
  flowFilePath: string,
): LoadConfigFileResult {
  const resolvedPath = path.resolve(
    path.dirname(path.resolve(flowFilePath)),
    configPath,
  );

  let raw: unknown;
  try {
    raw = readYamlFile(resolvedPath);
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Config file not found: ${configPath} (referenced in ${flowFilePath})`);
    }
    throw err;
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(
      `Config file must be a YAML map (object), got non-object root: ${configPath}`,
    );
  }

  const rawObj = raw as Record<string, unknown>;

  // Extract flow-config keys before flattening
  const flowConfig: FlowConfig = {};

  if ('workingSchedule' in rawObj && Array.isArray(rawObj['workingSchedule'])) {
    flowConfig.workingSchedule = rawObj['workingSchedule'] as WorkingScheduleEntry[];
  }
  if ('holidays' in rawObj && Array.isArray(rawObj['holidays'])) {
    flowConfig.holidays = rawObj['holidays'] as string[];
  }
  if ('functions' in rawObj) {
    const fnVal = rawObj['functions'];
    if (typeof fnVal === 'string') {
      flowConfig.functions = [fnVal];
    } else if (Array.isArray(fnVal)) {
      flowConfig.functions = fnVal as string[];
    }
  }

  // Extract and validate defaultTimeout/navigationTimeout (S10). String values go through
  // env-only interpolation first (${env.*} only — no runtime vars at this layer, AC57b).
  const timeoutsRaw: Record<string, unknown> = {};
  for (const key of ['defaultTimeout', 'navigationTimeout'] as const) {
    if (key in rawObj) {
      const v = rawObj[key];
      timeoutsRaw[key] = typeof v === 'string' ? interpolateValue(v, {}) : v;
    }
  }
  const timeouts = validateTimeoutKeys(timeoutsRaw, configPath);

  // Strip flow-config keys before passing to flattenVars
  const varsOnly: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawObj)) {
    if (!FLOW_CONFIG_KEYS.has(key)) {
      varsOnly[key] = value;
    }
  }

  const flat = flattenVars(varsOnly, configPath);

  // Resolve ${env.*} in config values (empty vars = env-only)
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(flat)) {
    vars[key] = interpolateValue(value, {});
  }

  return { vars, flowConfig, timeouts };
}
