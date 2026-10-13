import { readdir, realpath, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { UsageError } from './config.js';

export const SUPPORTED_EXTENSIONS: ReadonlySet<string> = new Set(['.png', '.jpg', '.jpeg', '.webp']);

export interface ImageEntry {
  /** Relative path with posix separators and extension, e.g. `desktop/calendar.png`. */
  rel: string;
  /** Absolute file path. */
  abs: string;
}

export interface PairResult {
  pairs: { baseline: ImageEntry; current: ImageEntry }[];
  /** In baseline only. */
  missing: ImageEntry[];
  /** In current only. */
  added: ImageEntry[];
}

/** Relative path without its extension: the pairing key (case-sensitive). */
export function pairKey(rel: string): string {
  const ext = extname(rel);
  return ext === '' ? rel : rel.slice(0, -ext.length);
}

/**
 * `ancestors` holds the real paths of the directories on the current descent. Only a directory
 * that is its own ancestor is a cycle; a directory reachable by two different paths is listed
 * under both.
 */
async function walk(
  dir: string,
  prefix: string,
  ancestors: Set<string>,
  out: ImageEntry[],
): Promise<void> {
  const real = await realpath(dir);
  if (ancestors.has(real)) return; // symlink loop
  ancestors.add(real);

  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    let isDir = entry.isDirectory();
    let isFile = entry.isFile();
    if (entry.isSymbolicLink()) {
      try {
        const s = await stat(abs); // follows the link
        isDir = s.isDirectory();
        isFile = s.isFile();
      } catch {
        continue; // dangling symlink
      }
    }
    if (isDir) await walk(abs, rel, ancestors, out);
    else if (isFile && SUPPORTED_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      out.push({ rel, abs });
    }
  }
  ancestors.delete(real);
}

/** Recursively list supported images under `root`, sorted by relative path. */
export async function listImages(root: string): Promise<ImageEntry[]> {
  const out: ImageEntry[] = [];
  await walk(root, '', new Set(), out);
  return out.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
}

function indexByKey(entries: ImageEntry[], label: string): Map<string, ImageEntry> {
  const map = new Map<string, ImageEntry>();
  for (const e of entries) {
    const key = pairKey(e.rel);
    const existing = map.get(key);
    if (existing) {
      throw new UsageError(
        `Ambiguous images in ${label} directory: "${existing.rel}" and "${e.rel}" share the same name`,
      );
    }
    map.set(key, e);
  }
  return map;
}

export async function pairImages(baselineDir: string, currentDir: string): Promise<PairResult> {
  const baselineMap = indexByKey(await listImages(baselineDir), 'baseline');
  const currentMap = indexByKey(await listImages(currentDir), 'current');

  const pairs: PairResult['pairs'] = [];
  const missing: ImageEntry[] = [];
  for (const [key, baseline] of baselineMap) {
    const current = currentMap.get(key);
    if (current) pairs.push({ baseline, current });
    else missing.push(baseline);
  }
  const added = [...currentMap.entries()].filter(([k]) => !baselineMap.has(k)).map(([, e]) => e);
  return { pairs, missing, added };
}
