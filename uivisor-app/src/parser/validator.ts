const VALID_HEADER_KEYS = new Set(['appId', 'url', 'commands']);

export function validateHeader(raw: unknown, filePath?: string): string {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`Invalid flow file header${filePath ? ' in ' + filePath : ''}`);
  }
  const obj = raw as Record<string, unknown>;

  // Check for unknown keys (excluding 'commands' which is the body)
  for (const key of Object.keys(obj)) {
    if (!VALID_HEADER_KEYS.has(key)) {
      throw new Error(`Unknown header key: ${key}${filePath ? ' in ' + filePath : ''}`);
    }
  }

  if ('appId' in obj) {
    return obj['appId'] as string;
  }
  if ('url' in obj) {
    return obj['url'] as string;
  }

  throw new Error(`Missing required header key (appId or url)${filePath ? ' in ' + filePath : ''}`);
}

export function validateCommandList(rawCommands: unknown): void {
  if (!Array.isArray(rawCommands) || rawCommands.length === 0) {
    throw new Error('No commands found in flow.');
  }
}
