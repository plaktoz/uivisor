import * as path from 'path';
import type { FlowFile } from '../types.js';
import { readYamlFile } from './reader.js';
import { validateHeader, validateCommandList } from './validator.js';
import { parseCommand } from './commandParser.js';

export function loadAndParse(filePath: string): FlowFile {
  const raw = readYamlFile(filePath);
  const baseUrl = validateHeader(raw, filePath);
  const obj = raw as Record<string, unknown>;
  const rawCommands = obj['commands'];
  validateCommandList(rawCommands);
  const commands = (rawCommands as unknown[]).map(parseCommand);
  const tags = Array.isArray(obj['tags']) ? (obj['tags'] as string[]) : [];
  const shared = typeof obj['shared'] === 'boolean' ? obj['shared'] : false;
  return { baseUrl, filePath: path.resolve(filePath), commands, tags, shared };
}
