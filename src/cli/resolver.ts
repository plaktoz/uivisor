import * as fs from 'fs';
import * as path from 'path';

export function resolveTarget(target: string): string[] {
  if (!fs.existsSync(target)) {
    throw new Error(`File not found: ${target}`);
  }

  const stat = fs.statSync(target);

  if (stat.isDirectory()) {
    const entries = fs.readdirSync(target) as unknown as string[];
    const yamlFiles = entries
      .filter((f) => typeof f === 'string' && f.endsWith('.yaml'))
      .map((f) => path.join(target, f));

    if (yamlFiles.length === 0) {
      throw new Error(`No flow files found in: ${target}`);
    }

    return yamlFiles;
  }

  return [target];
}
