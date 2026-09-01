import type { SessionDef } from '../types.js';

const VALID_HEADER_KEYS = new Set(['appId', 'url', 'commands', 'tags', 'shared', 'sessions']);

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

  // Validate tags if present
  if ('tags' in obj) {
    const tags = obj['tags'];
    if (!Array.isArray(tags)) {
      throw new Error(`Invalid tags: must be an array${filePath ? ' in ' + filePath : ''}`);
    }
    for (const tag of tags) {
      if (typeof tag !== 'string') {
        throw new Error(`Invalid tag: each tag must be a string${filePath ? ' in ' + filePath : ''}`);
      }
      if (tag.trim() === '') {
        throw new Error(`Invalid tag: tags must not be empty or whitespace-only${filePath ? ' in ' + filePath : ''}`);
      }
    }
  }

  // Validate shared if present
  if ('shared' in obj && typeof obj['shared'] !== 'boolean') {
    throw new Error(`Invalid shared: must be a boolean${filePath ? ' in ' + filePath : ''}`);
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

const SESSION_ID_RE = /^[a-zA-Z0-9_-]+$/;

export function validateSessions(raw: unknown, filePath?: string): SessionDef[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new Error(`Invalid sessions: must be an array${filePath ? ' in ' + filePath : ''}`);
  }
  if (raw.length === 0) {
    throw new Error(`Invalid sessions: must not be empty${filePath ? ' in ' + filePath : ''}`);
  }
  const seenIds = new Set<string>();
  const sessions: SessionDef[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`Invalid session entry: must be an object${filePath ? ' in ' + filePath : ''}`);
    }
    const s = item as Record<string, unknown>;
    if (typeof s['id'] !== 'string' || (s['id'] as string).trim() === '') {
      throw new Error(`Invalid session id: must be a non-empty string${filePath ? ' in ' + filePath : ''}`);
    }
    const id = s['id'] as string;
    if (!SESSION_ID_RE.test(id)) {
      throw new Error(`Invalid session id "${id}": must match ^[a-zA-Z0-9_-]+$${filePath ? ' in ' + filePath : ''}`);
    }
    if (id.length > 64) {
      throw new Error(`Invalid session id "${id}": must not exceed 64 characters${filePath ? ' in ' + filePath : ''}`);
    }
    if (id === '__default__') {
      throw new Error(`Invalid session id "__default__": this id is reserved${filePath ? ' in ' + filePath : ''}`);
    }
    if (seenIds.has(id)) {
      throw new Error(`Duplicate session id "${id}"${filePath ? ' in ' + filePath : ''}`);
    }
    seenIds.add(id);
    const entry: SessionDef = { id };
    if (typeof s['label'] === 'string') entry.label = s['label'];
    sessions.push(entry);
  }
  return sessions;
}
