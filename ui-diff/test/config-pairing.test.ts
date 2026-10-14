import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_COMPARISON, UsageError, parseReporters, resolveConfig } from '../src/config.js';
import { listImages, pairImages, pairKey } from '../src/pairing.js';

describe('parseReporters', () => {
  it('parses, trims and de-duplicates', () => {
    expect(parseReporters('console, html,console')).toEqual(['console', 'html']);
    expect(parseReporters(['json'])).toEqual(['json']);
  });

  it('rejects unknown and empty entries', () => {
    expect(() => parseReporters('pdf')).toThrow(/unknown reporter "pdf"/);
    expect(() => parseReporters('console,')).toThrow(UsageError);
    expect(() => parseReporters([])).toThrow(UsageError);
  });
});

describe('resolveConfig', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'uidiff-cfg-'));
    await mkdir(join(dir, 'conf'), { recursive: true });
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const write = async (name: string, body: unknown): Promise<string> => {
    const file = join(dir, name);
    await writeFile(file, typeof body === 'string' ? body : JSON.stringify(body));
    return file;
  };

  it('applies defaults', () => {
    const c = resolveConfig({ baseline: 'a', current: 'b' }, dir);
    expect(c.comparison).toEqual(DEFAULT_COMPARISON);
    expect(c.output).toBe(join(dir, 'ui-diff-report'));
    expect(c.reporters).toEqual(['console', 'html']);
    expect(c).toMatchObject({ failOnMissing: true, allowEmpty: false, concurrency: 2 });
  });

  it('requires baseline and current', () => {
    expect(() => resolveConfig({ current: 'b' }, dir)).toThrow(/--baseline/);
    expect(() => resolveConfig({ baseline: 'a' }, dir)).toThrow(/--current/);
  });

  it('CLI overrides file, file overrides defaults (AC15)', async () => {
    const file = await write('c1.json', { baseline: 'x', current: 'y', comparison: { maxDriftPixels: 20, percentile: 90 } });
    const fromFile = resolveConfig({ config: file }, dir);
    expect(fromFile.comparison.maxDriftPixels).toBe(20);
    expect(fromFile.comparison.percentile).toBe(90);
    const overridden = resolveConfig({ config: file, maxDrift: 4 }, dir);
    expect(overridden.comparison.maxDriftPixels).toBe(4);
    expect(overridden.comparison.percentile).toBe(90);
  });

  it('resolves file paths against the config file directory', async () => {
    const file = await write('conf/c2.json', { baseline: './b', current: './c', output: './o' });
    const c = resolveConfig({ config: file }, '/elsewhere');
    expect(c.baseline).toBe(join(dir, 'conf', 'b'));
    expect(c.current).toBe(join(dir, 'conf', 'c'));
    expect(c.output).toBe(join(dir, 'conf', 'o'));
  });

  it('reads reporters and booleans from the file, CLI wins', async () => {
    const file = await write('c3.json', {
      baseline: 'x', current: 'y', reporters: ['json'], failOnMissing: false, allowEmpty: true, concurrency: 4,
    });
    const c = resolveConfig({ config: file }, dir);
    expect(c).toMatchObject({ reporters: ['json'], failOnMissing: false, allowEmpty: true, concurrency: 4 });
    const o = resolveConfig({ config: file, format: 'html', failOnMissing: true, allowEmpty: false, concurrency: 1 }, dir);
    expect(o).toMatchObject({ reporters: ['html'], failOnMissing: true, allowEmpty: false, concurrency: 1 });
  });

  it('picks up the default config file name from cwd', async () => {
    const sub = join(dir, 'auto');
    await mkdir(sub, { recursive: true });
    await writeFile(join(sub, 'ui-diff.config.json'), JSON.stringify({ baseline: 'p', current: 'q' }));
    expect(resolveConfig({}, sub).baseline).toBe(join(sub, 'p'));
  });

  it('errors for an explicit config that does not exist, malformed JSON, and non-objects', async () => {
    expect(() => resolveConfig({ baseline: 'a', current: 'b', config: join(dir, 'nope.json') }, dir)).toThrow(/Config file not found/);
    const bad = await write('bad.json', '{ not json');
    expect(() => resolveConfig({ baseline: 'a', current: 'b', config: bad }, dir)).toThrow(/Cannot read config file/);
    const arr = await write('arr.json', '[]');
    expect(() => resolveConfig({ baseline: 'a', current: 'b', config: arr }, dir)).toThrow(/expected a JSON object/);
  });

  it('rejects unknown keys at both levels and a non-object comparison', async () => {
    const top = await write('k1.json', { baseline: 'a', current: 'b', bogus: 1 });
    expect(() => resolveConfig({ config: top }, dir)).toThrow(/unknown key "bogus"/);
    const nested = await write('k2.json', { baseline: 'a', current: 'b', comparison: { nope: 1 } });
    expect(() => resolveConfig({ config: nested }, dir)).toThrow(/unknown key "comparison.nope"/);
    const notObj = await write('k3.json', { baseline: 'a', current: 'b', comparison: 5 });
    expect(() => resolveConfig({ config: notObj }, dir)).toThrow(/"comparison" must be an object/);
  });

  it('rejects wrongly typed file values', async () => {
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ baseline: '', current: 'b' }, /baseline/],
      [{ baseline: 'a', current: 'b', output: 3 }, /output/],
      [{ baseline: 'a', current: 'b', reporters: 'html' }, /reporters/],
      [{ baseline: 'a', current: 'b', failOnMissing: 'yes' }, /failOnMissing/],
      [{ baseline: 'a', current: 'b', allowEmpty: 1 }, /allowEmpty/],
    ];
    for (const [i, [body, re]] of cases.entries()) {
      const file = await write(`t${i}.json`, body);
      expect(() => resolveConfig({ config: file }, dir)).toThrow(re);
    }
  });

  it('validates numeric ranges and names the offending option (§7)', () => {
    const base = { baseline: 'a', current: 'b' };
    expect(() => resolveConfig({ ...base, variance: 2 }, dir)).toThrow(/--variance/);
    expect(() => resolveConfig({ ...base, variance: -0.1 }, dir)).toThrow(/--variance/);
    expect(() => resolveConfig({ ...base, maxDrift: -1 }, dir)).toThrow(/--max-drift/);
    expect(() => resolveConfig({ ...base, percentile: 0 }, dir)).toThrow(/--percentile/);
    expect(() => resolveConfig({ ...base, percentile: 101 }, dir)).toThrow(/--percentile/);
    expect(() => resolveConfig({ ...base, gridSize: 2 }, dir)).toThrow(/--grid-size/);
    expect(() => resolveConfig({ ...base, gridSize: 16.5 }, dir)).toThrow(/--grid-size/);
    expect(() => resolveConfig({ ...base, blurRadius: -1 }, dir)).toThrow(/--blur-radius/);
    expect(() => resolveConfig({ ...base, edgeThreshold: 0 }, dir)).toThrow(/--edge-threshold/);
    expect(() => resolveConfig({ ...base, edgeThreshold: 1.5 }, dir)).toThrow(/--edge-threshold/);
    expect(() => resolveConfig({ ...base, concurrency: 0 }, dir)).toThrow(/--concurrency/);
    expect(() => resolveConfig({ ...base, variance: Number.NaN }, dir)).toThrow(/--variance/);
    expect(() => resolveConfig({ ...base, format: 'xml' }, dir)).toThrow(/--format/);
  });

  it('accepts the boundary values', () => {
    const c = resolveConfig(
      { baseline: 'a', current: 'b', variance: 0, maxDrift: 0, percentile: 100, gridSize: 4, blurRadius: 0, edgeThreshold: 1 },
      dir,
    );
    expect(c.comparison).toEqual({
      varianceThreshold: 0, maxDriftPixels: 0, percentile: 100, gridSize: 4, blurRadius: 0, edgeThreshold: 1,
    });
  });
});

describe('pairing', () => {
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'uidiff-pair-'));
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const touch = async (rel: string): Promise<void> => {
    const f = join(root, rel);
    await mkdir(join(f, '..'), { recursive: true });
    await writeFile(f, 'x');
  };

  it('pairKey strips only the final extension', () => {
    expect(pairKey('a/b.png')).toBe('a/b');
    expect(pairKey('a/b.test.png')).toBe('a/b.test');
    expect(pairKey('noext')).toBe('noext');
  });

  it('lists only supported images recursively, sorted, ignoring other files', async () => {
    await touch('l/z.png');
    await touch('l/a.JPG');
    await touch('l/sub/m.webp');
    await touch('l/sub/n.jpeg');
    await touch('l/.DS_Store');
    await touch('l/notes.txt');
    const found = await listImages(join(root, 'l'));
    expect(found.map((e) => e.rel)).toEqual(['a.JPG', 'sub/m.webp', 'sub/n.jpeg', 'z.png']);
  });

  it('follows symlinks to files and directories, skips dangling ones and loops', async () => {
    await touch('s/real/pic.png');
    await touch('s/file-target.png');
    await symlink(join(root, 's/real'), join(root, 's/linkdir'));
    await symlink(join(root, 's/file-target.png'), join(root, 's/linkfile.png'));
    await symlink(join(root, 's/missing-target.png'), join(root, 's/dangling.png'));
    await symlink(join(root, 's'), join(root, 's/real/loop'));
    const rels = (await listImages(join(root, 's'))).map((e) => e.rel);
    expect(rels).toEqual(expect.arrayContaining(['real/pic.png', 'linkdir/pic.png', 'linkfile.png', 'file-target.png']));
    expect(rels).not.toContain('dangling.png');
    expect(rels.filter((r) => r.endsWith('pic.png'))).toHaveLength(2);
  });

  it('pairs ignoring extension, case-sensitively, and reports missing and added', async () => {
    await touch('p/baseline/same.png');
    await touch('p/current/same.jpg');
    await touch('p/baseline/only-base.png');
    await touch('p/current/only-current.png');
    await touch('p/baseline/Case.png');
    await touch('p/current/case.png');
    const r = await pairImages(join(root, 'p/baseline'), join(root, 'p/current'));
    expect(r.pairs.map((p) => [p.baseline.rel, p.current.rel])).toEqual([['same.png', 'same.jpg']]);
    expect(r.missing.map((e) => e.rel).sort()).toEqual(['Case.png', 'only-base.png']);
    expect(r.added.map((e) => e.rel).sort()).toEqual(['case.png', 'only-current.png']);
  });

  it('rejects ambiguous duplicate stems in one directory with a usage error', async () => {
    await touch('d/baseline/a.png');
    await touch('d/baseline/a.jpg');
    await mkdir(join(root, 'd/current'), { recursive: true });
    await expect(pairImages(join(root, 'd/baseline'), join(root, 'd/current'))).rejects.toThrow(UsageError);
    await expect(pairImages(join(root, 'd/baseline'), join(root, 'd/current'))).rejects.toThrow(/baseline directory/);
    await touch('d2/current/b.png');
    await touch('d2/current/b.webp');
    await mkdir(join(root, 'd2/baseline'), { recursive: true });
    await expect(pairImages(join(root, 'd2/baseline'), join(root, 'd2/current'))).rejects.toThrow(/current directory/);
  });
});
