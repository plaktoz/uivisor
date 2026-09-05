import * as path from 'path';
import type { FlowFile } from '@uivisor/core';
import { readYamlFile } from './reader.js';
import { validateHeader, validateCommandList, validateSessions, validateVars } from './validator.js';
import { parseSessionedCommand } from './commandParser.js';
import { flattenVars, interpolateValue, interpolateObject, loadConfigFile } from './interpolate.js';

export function loadAndParse(filePath: string): FlowFile {
  const raw = readYamlFile(filePath);

  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`Invalid flow file header in ${filePath}`);
  }
  const obj = raw as Record<string, unknown>;

  // Pass 1: resolve config: path (env-only — no vars yet)
  let configVars: Record<string, string> = {};
  if ('config' in obj && obj['config'] !== undefined) {
    const rawConfigPath = obj['config'];
    if (typeof rawConfigPath !== 'string') {
      throw new Error(`Invalid config: must be a string in ${filePath}`);
    }
    const interpolatedConfigPath = interpolateValue(rawConfigPath, {});
    configVars = loadConfigFile(interpolatedConfigPath, filePath);
  }

  // Pass 2: flatten inline vars
  let inlineVars: Record<string, string> = {};
  if ('vars' in obj && obj['vars'] !== undefined) {
    validateVars(obj['vars'], filePath);
    inlineVars = flattenVars(obj['vars'] as Record<string, unknown>, filePath);
  }

  // Merge: { ...inlineVars, ...configVars }  (config wins)
  const vars: Record<string, string> = { ...inlineVars, ...configVars };

  // Pass 3: interpolate full document
  const doc = interpolateObject(obj, vars) as Record<string, unknown>;

  // Existing validation pipeline on interpolated doc
  const baseUrl = validateHeader(doc, filePath);
  const rawCommands = doc['commands'];
  validateCommandList(rawCommands);

  // Extract and validate sessions block (absent/null → legacy mode, empty array → error)
  const sessions = validateSessions(doc['sessions'] ?? null, filePath);
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

  const tags = Array.isArray(doc['tags']) ? (doc['tags'] as string[]) : [];
  const shared = typeof doc['shared'] === 'boolean' ? doc['shared'] : false;
  return { baseUrl, filePath: resolvedPath, commands, sessions, tags, shared, vars };
}
