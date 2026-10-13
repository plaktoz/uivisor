export class UnresolvedVariableError extends Error {
  constructor(readonly variable: string) {
    super(`Variable "${variable}" is not defined`);
    this.name = 'UnresolvedVariableError';
  }
}

/**
 * Resolve one interpolation expression (the content between ${ and }).
 * Reads from process.env for env.* names, otherwise from vars.
 * Falls back to the default after the first ':' if the resolved value is undefined or "".
 *
 * When `strict` is true, throws if the variable is absent from the map and has no default.
 * Default (`strict = false`) maintains backward-compatible empty-string fallback.
 */
export function resolveRef(inner: string, vars: Record<string, string>, strict = false): string {
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
  let isAbsent = false;

  if (name.startsWith('env.')) {
    const envKey = name.slice(4); // strip 'env.'
    resolved = process.env[envKey];
    isAbsent = resolved === undefined;
  } else {
    isAbsent = !Object.prototype.hasOwnProperty.call(vars, name);
    resolved = vars[name];
  }

  // Variable is absent (not set at all)
  if (isAbsent || resolved === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    if (strict) throw new UnresolvedVariableError(name);
    return '';
  }

  // Variable is present but empty string
  if (resolved === '') {
    if (defaultValue !== undefined) return defaultValue;
    return '';
  }

  return resolved;
}

/**
 * Replace all ${...} expressions in a string.
 * Uses index-based forward scan to correctly handle multi-expression strings.
 * Throws on unclosed '${'.
 *
 * When `strict` is true, throws on any absent variable with no default.
 */
export function interpolateValue(value: string, vars: Record<string, string>, strict = false): string {
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
    result += resolveRef(inner, vars, strict);
    i = end + 1;
  }

  return result;
}

/**
 * Deep-walk any value; call interpolateValue on string leaves.
 * Returns a new object — never mutates the input.
 *
 * When `strict` is true, absent variables without defaults throw an error.
 */
export function interpolateObject(obj: unknown, vars: Record<string, string>, strict = false): unknown {
  if (typeof obj === 'string') {
    return interpolateValue(obj, vars, strict);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => interpolateObject(item, vars, strict));
  }
  if (typeof obj === 'object' && obj !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = interpolateObject(value, vars, strict);
    }
    return result;
  }
  // number, boolean, null — pass through unchanged
  return obj;
}
