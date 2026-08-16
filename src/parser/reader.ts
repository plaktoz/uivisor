import * as fs from 'fs';
import * as yaml from 'js-yaml';

export function readYamlFile(filePath: string): unknown {
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return yaml.load(raw);
  } catch (err: unknown) {
    if (err instanceof yaml.YAMLException) {
      const line = (err.mark?.line ?? 0) + 1;
      throw new Error(`Parse error in ${filePath}:${line}: ${err.message}`);
    }
    throw err;
  }
}
