import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute path to the fixtures directory. */
export const FIXTURES = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures');

/** Entries for a fixture set `name` (file `<name>.png` in `baseline/` and `current/`). */
export function fixturePair(name: string): { baseline: { rel: string; abs: string }; current: { rel: string; abs: string } } {
  const file = `${name}.png`;
  return {
    baseline: { rel: file, abs: join(FIXTURES, name, 'baseline', file) },
    current: { rel: file, abs: join(FIXTURES, name, 'current', file) },
  };
}
