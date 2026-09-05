import * as path from 'path';
import { readYamlFile } from './reader.js';

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

/**
 * Resolve one interpolation expression (the content between ${ and }).
 * Reads from process.env for env.* names, otherwise from vars.
 * Falls back to the default after the first ':' if the resolved value is undefined or "".
 */
export function resolveRef(inner: string, vars: Record<string, string>): string {
  // Split on first ':' only
  const colonIdx = inner.indexOf(':');
  let name: string;
  let defaultValue: string | undefined;

  if (colonIdx === -1) {
    name = inner;
    defaultValue = undefined;
  } else {
    name = inner.slice(0, colonIdx);
    defaultValue = inner.slice(colonIdx + 1);
  }

  let resolved: string | undefined;

  if (name.startsWith('env.')) {
    const envKey = name.slice(4); // strip 'env.'
    resolved = process.env[envKey];
  } else {
    resolved = vars[name];
  }

  // Fall back to default if resolved is undefined or empty string
  if (resolved === undefined || resolved === '') {
    return defaultValue !== undefined ? defaultValue : '';
  }

  return resolved;
}

/**
 * Replace all ${...} expressions in a string.
 * Uses index-based forward scan to correctly handle multi-expression strings.
 * Throws on unclosed '${'.
 */
export function interpolateValue(value: string, vars: Record<string, string>): string {
  let result = '';
  let i = 0;

  while (i < value.length) {
    const start = value.indexOf('${', i);
    if (start === -1) {
      result += value.slice(i);
      break;
    }

    // Append text before the expression
    result += value.slice(i, start);

    const end = value.indexOf('}', start + 2);
    if (end === -1) {
      throw new Error(`Unclosed \${ expression in "${value}"`);
    }

    const inner = value.slice(start + 2, end);
    result += resolveRef(inner, vars);
    i = end + 1;
  }

  return result;
}

/**
 * Deep-walk any value; call interpolateValue on string leaves.
 * Returns a new object — never mutates the input.
 */
export function interpolateObject(obj: unknown, vars: Record<string, string>): unknown {
  if (typeof obj === 'string') {
    return interpolateValue(obj, vars);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => interpolateObject(item, vars));
  }
  if (typeof obj === 'object' && obj !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = interpolateObject(value, vars);
    }
    return result;
  }
  // number, boolean, null — pass through unchanged
  return obj;
}

/**
 * Load an external config YAML, flatten it, and resolve ${env.*} expressions in values.
 * The configPath must already be interpolated; it is resolved relative to the flow file's dir.
 */
export function loadConfigFile(
  configPath: string,
  flowFilePath: string,
): Record<string, string> {
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

  const flat = flattenVars(raw as Record<string, unknown>, configPath);

  // Resolve ${env.*} in config values (empty vars = env-only)
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(flat)) {
    result[key] = interpolateValue(value, {});
  }

  return result;
}
