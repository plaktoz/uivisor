import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_COMPARISON } from '../src/config.js';
import { runComparison } from '../src/compare.js';
import { writeAssets } from '../src/reporters/assets.js';
import { renderConsole } from '../src/reporters/console.js';
import { buildHtml, writeHtml } from '../src/reporters/html.js';
import { buildJson, writeJson } from '../src/reporters/json.js';
import type { RunOutput, UiDiffConfig } from '../src/types.js';
import { fixturePair } from './helpers.js';

let root: string;
let output: RunOutput;
let config: UiDiffConfig;

async function put(dir: string, rel: string, from: string): Promise<void> {
  const dest = join(dir, rel);
  await mkdir(join(dest, '..'), { recursive: true });
  await sharp(from).toFile(dest);
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'uidiff-rep-'));
  const good = fixturePair('identical').baseline.abs;
  const moved = fixturePair('alignment-shift').current.abs;
  const base = join(root, 'baseline');
  const cur = join(root, 'current');
  await put(base, 'desktop/ok.png', good);
  await put(cur, 'desktop/ok.png', good);
  await put(base, 'desktop/moved.png', good);
  await put(cur, 'desktop/moved.png', moved);
  await put(base, 'gone.png', good);
  await put(cur, 'fresh.png', good);
  await put(base, 'a<b>&"c.png', good);
  await put(cur, 'a<b>&"c.png', good);

  config = {
    baseline: base,
    current: cur,
    output: join(root, 'out'),
    comparison: DEFAULT_COMPARISON,
    reporters: ['console', 'html', 'json'],
    failOnMissing: true,
    allowEmpty: false,
    concurrency: 2,
  };
  output = await runComparison(config, (o) => writeAssets(config.output, o, config.comparison));
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('assets', () => {
  it('writes baseline, current, edge and diff images mirroring the nested path (AC7, AC10)', async () => {
    const moved = output.outcomes.find((o) => o.result.name === 'desktop/moved.png')!.result;
    expect(moved.assets).toEqual({
      baseline: 'assets/baseline/desktop/moved.png',
      current: 'assets/current/desktop/moved.png',
      edgeMap: 'assets/edge/desktop/moved.png',
      diff: 'assets/diff/desktop/moved.png',
    });
    for (const rel of Object.values(moved.assets!)) {
      expect((await stat(join(config.output, rel))).size).toBeGreaterThan(0);
      expect((await sharp(join(config.output, rel)).metadata()).format).toBe('png');
    }
  });

  it('colours baseline-only edges red, current-only blue and shared grey in the diff overlay', async () => {
    const moved = output.outcomes.find((o) => o.result.name === 'desktop/moved.png')!.result;
    const { data, info } = await sharp(join(config.output, moved.assets!.diff!)).raw().toBuffer({ resolveWithObject: true });
    // Failing blocks are tinted red, so classify edge pixels by their dominant channel.
    let baselineOnly = 0;
    let currentOnly = 0;
    for (let i = 0; i < info.width * info.height; i++) {
      const [r, g, b] = [data[i * info.channels], data[i * info.channels + 1], data[i * info.channels + 2]];
      if (r > 200 && r < 250 && g < 80 && b < 80) baselineOnly++; // red edge (drift boxes are pure 255,0,0)
      else if (b > 150 && b - r > 60 && b - g > 60) currentOnly++; // blue
    }
    expect(baselineOnly).toBeGreaterThan(0);
    expect(currentOnly).toBeGreaterThan(0);
  });

  it('only writes the images that exist for missing and new entries', async () => {
    const gone = output.outcomes.find((o) => o.result.name === 'gone.png')!.result;
    expect(Object.keys(gone.assets!)).toEqual(['baseline']);
    const fresh = output.outcomes.find((o) => o.result.name === 'fresh.png')!.result;
    expect(Object.keys(fresh.assets!)).toEqual(['current']);
  });

  it('converts non-png inputs to png', async () => {
    const dir = join(root, 'jpg-case');
    const jpg = join(dir, 'x.jpg');
    await mkdir(dir, { recursive: true });
    await sharp(fixturePair('identical').baseline.abs).jpeg().toFile(jpg);
    const outcome = { result: { name: 'x.jpg', status: 'PASS' as const, reasons: [], warnings: [] }, baselineFile: jpg };
    await writeAssets(join(root, 'out2'), outcome, DEFAULT_COMPARISON);
    expect(outcome.result).toMatchObject({ assets: { baseline: 'assets/baseline/x.png' } });
    expect((await sharp(join(root, 'out2', 'assets/baseline/x.png')).metadata()).format).toBe('png');
  });
});

describe('console reporter', () => {
  it('renders a table, summary, warnings and the final result', () => {
    const text = renderConsole(output);
    expect(text).toContain('Image');
    expect(text).toContain('desktop/moved.png');
    expect(text).toContain('ALIGNMENT_DRIFT (horizontal)');
    expect(text).toContain('MISSING_IN_CURRENT');
    expect(text).toContain('Total: 5  Passed: 2  Failed: 2  New: 1');
    expect(text).toContain('Warnings:');
    expect(text).toContain('fresh.png: NEW_IN_CURRENT');
    expect(text.trimEnd().endsWith('RESULT: FAIL')).toBe(true);
  });

  it('shows PASS and handles an empty run with the run warning', () => {
    const empty: RunOutput = {
      outcomes: [],
      summary: { total: 0, passed: 0, failed: 0, new: 0, missing: 0, errored: 0 },
      runWarnings: ['EMPTY_INPUT: no images found to compare'],
      exitCode: 0,
    };
    const text = renderConsole(empty);
    expect(text).toContain('EMPTY_INPUT');
    expect(text).not.toContain('Image  ');
    expect(text.trimEnd().endsWith('RESULT: PASS')).toBe(true);
  });

  it('prints invalid-image detail and the invalid count', () => {
    const out: RunOutput = {
      outcomes: [{ result: { name: 'bad.png', status: 'FAIL', reasons: ['INVALID_IMAGE'], warnings: [], error: 'Input file contains unsupported image format' } }],
      summary: { total: 1, passed: 0, failed: 1, new: 0, missing: 0, errored: 1 },
      runWarnings: [],
      exitCode: 1,
    };
    const text = renderConsole(out);
    expect(text).toContain('Invalid: 1');
    expect(text).toContain('bad.png: Input file contains unsupported image format');
  });
});

describe('json reporter (AC8)', () => {
  it('produces the documented schema', () => {
    const json = buildJson(output, DEFAULT_COMPARISON, new Date('2025-01-01T12:00:00.000Z')) as Record<string, any>;
    expect(json.version).toBe(1);
    expect(json.timestamp).toBe('2025-01-01T12:00:00.000Z');
    expect(json.config).toEqual({ varianceThreshold: 0.05, maxDriftPixels: 8, percentile: 95 });
    expect(json.summary).toEqual({ total: 5, passed: 2, failed: 2, new: 1, missing: 0, errored: 0 });
    const moved = json.images.find((i: any) => i.name === 'desktop/moved.png');
    expect(moved).toMatchObject({ status: 'FAIL', driftAxis: 'horizontal' });
    expect(moved.reasons).toContain('ALIGNMENT_DRIFT');
    expect(typeof moved.variance).toBe('number');
    expect(typeof moved.drift).toBe('number');
    expect(moved.assets.diff).toBe('assets/diff/desktop/moved.png');
  });

  it('writes diff-results.json that parses back', async () => {
    const file = await writeJson(config.output, output, DEFAULT_COMPARISON);
    expect(file.endsWith('diff-results.json')).toBe(true);
    const parsed = JSON.parse(await readFile(file, 'utf8'));
    expect(parsed.images).toHaveLength(5);
  });
});

describe('html reporter (AC7)', () => {
  it('lists failed images first, includes every asset and escapes names', () => {
    const html = buildHtml(output);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('ui-diff report');
    expect(html.indexOf('desktop/moved.png')).toBeLessThan(html.indexOf('desktop/ok.png'));
    expect(html).toContain('assets/diff/desktop/moved.png');
    expect(html).toContain('assets/edge/desktop/moved.png');
    expect(html).toContain('data-slider');
    expect(html).toContain('a&lt;b&gt;&amp;&quot;c.png');
    expect(html).not.toContain('a<b>&"c.png');
  });

  it('every image link in the report resolves to a written file', async () => {
    const file = await writeHtml(config.output, output);
    const html = await readFile(file, 'utf8');
    const links = [...html.matchAll(/<img src="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
    expect(links.length).toBeGreaterThan(0);
    for (const rel of new Set(links)) await expect(stat(join(config.output, rel))).resolves.toBeTruthy();
  });

  it('shows run warnings and errors, and PASS in the title', () => {
    const out: RunOutput = {
      outcomes: [
        { result: { name: 'bad.png', status: 'FAIL', reasons: ['INVALID_IMAGE'], warnings: [{ code: 'DIMENSION_WARNING', message: 'Size differs' }], error: 'broken <file>' } },
      ],
      summary: { total: 1, passed: 0, failed: 1, new: 0, missing: 0, errored: 1 },
      runWarnings: ['EMPTY_INPUT: x'],
      exitCode: 0,
    };
    const html = buildHtml(out);
    expect(html).toContain('EMPTY_INPUT: x');
    expect(html).toContain('Size differs');
    expect(html).toContain('broken &lt;file&gt;');
    expect(html).toContain('<title>ui-diff report — PASS</title>');
  });
});
