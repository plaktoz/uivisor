import * as path from 'path';
import type { FlowFile } from '../types.js';
import { readYamlFile } from './reader.js';
import { validateHeader, validateCommandList, validateSessions } from './validator.js';
import { parseSessionedCommand } from './commandParser.js';

export function loadAndParse(filePath: string): FlowFile {
  const raw = readYamlFile(filePath);
  const baseUrl = validateHeader(raw, filePath);
  const obj = raw as Record<string, unknown>;
  const rawCommands = obj['commands'];
  validateCommandList(rawCommands);

  // Extract and validate sessions block (absent/null → legacy mode, empty array → error)
  const sessions = validateSessions(obj['sessions'] ?? null, filePath);
  const sessionIds = new Set(sessions.map((s) => s.id));

  const resolvedPath = path.resolve(filePath);
  const commands = (rawCommands as unknown[]).map((rawCmd) => {
    const sc = parseSessionedCommand(rawCmd);
    if (sc.session !== undefined) {
      if (sessions.length === 0) {
        throw new Error(`session: field used but no sessions declared in ${resolvedPath}`);
      }
      if (!sessionIds.has(sc.session)) {
        throw new Error(`Unknown session id "${sc.session}" in ${resolvedPath}`);
      }
    }
    return sc;
  });

  const tags = Array.isArray(obj['tags']) ? (obj['tags'] as string[]) : [];
  const shared = typeof obj['shared'] === 'boolean' ? obj['shared'] : false;
  return { baseUrl, filePath: resolvedPath, commands, sessions, tags, shared };
}
