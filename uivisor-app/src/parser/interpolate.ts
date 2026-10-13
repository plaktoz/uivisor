import * as path from 'path';
import { readYamlFile } from './reader.js';
import { interpolateValue } from '@uivisor/core';
import type { FlowConfig, WorkingScheduleEntry } from '@uivisor/core';

const VAR_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_.]*$/;

/**
 * Recursively flatten a nested YAML object to dotted keys.
 * Validates assembled key names; coerces number/boolean/null leaves to string.
 * Rejects array/object leaves, empty/invalid names, reserved names, and duplicates.
 */
export function flattenVars(
  raw: Record<string, unknown>,
  filePath?: string,
): Record<string, string> {
  const result: Record<string, string> = {};

  function walk(obj: Record<string, unknown>, prefix: string): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      // Validate the assembled key name
      if (!VAR_NAME_RE.test(fullKey)) {
        throw new Error(
          `Invalid variable name: "${fullKey}"${filePath ? ' in ' + filePath : ''}`,
        );
      }

      // Reject reserved names (env and env.*)
      if (fullKey === 'env' || fullKey.startsWith('env.')) {
        throw new Error(
          `Reserved variable name: "${fullKey}"${filePath ? ' in ' + filePath : ''}`,
        );
      }

      if (Array.isArray(value)) {
        throw new Error(
          `Invalid variable value: arrays are not allowed (at "${fullKey}")${filePath ? ' in ' + filePath : ''}`,
        );
      } else if (
        value !== null &&
        typeof value === 'object'
      ) {
        // Nested object — recurse
        walk(value as Record<string, unknown>, fullKey);
      } else {
        // Leaf: string, number, boolean, or null
        if (fullKey in result) {
          throw new Error(
            `Duplicate variable key: "${fullKey}"${filePath ? ' in ' + filePath : ''}`,
          );
        }
        result[fullKey] = String(value);
      }
    }
  }

  walk(raw, '');
  return result;
}

/** Keys in config.yml that are NOT simple variables but flow-config data. */
const FLOW_CONFIG_KEYS = new Set(['workingSchedule', 'holidays', 'functions']);

export interface LoadConfigFileResult {
  vars: Record<string, string>;
  flowConfig: FlowConfig;
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

  return { vars, flowConfig };
}
