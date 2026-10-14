import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { comparePair, runComparison, summarise } from '../src/compare.js';
import { DEFAULT_COMPARISON, resolveConfig } from '../src/config.js';
import type { UiDiffConfig } from '../src/types.js';
import { FIXTURES, fixturePair } from './helpers.js';

const cmp = (name: string, opts = DEFAULT_COMPARISON) => {
  const { baseline, current } = fixturePair(name);
  return comparePair(baseline, current, opts);
};

describe('calibration fixtures (AC16)', () => {
  it('identical -> PASS with zero scores', async () => {
    const { result } = await cmp('identical');
    expect(result.status).toBe('PASS');
    expect(result.variance).toBe(0);
    expect(result.drift).toBe(0);
    expect(result.reasons).toEqual([]);
  });

  it('text-change -> PASS (AC2)', async () => {
    const { result } = await cmp('text-change');
    expect(result.status).toBe('PASS');
    expect(result.variance).toBeLessThanOrEqual(0.05);
    expect(result.drift).toBeLessThanOrEqual(8);
  });

  it('alignment-shift -> FAIL with horizontal ALIGNMENT_DRIFT (AC3)', async () => {
    const { result } = await cmp('alignment-shift');
    expect(result.status).toBe('FAIL');
    expect(result.reasons).toContain('ALIGNMENT_DRIFT');
    expect(result.driftAxis).toBe('horizontal');
    expect(result.drift).toBeGreaterThan(8);
  });

  it('component-removed -> FAIL (AC4)', async () => {
    const { result } = await cmp('component-removed');
    expect(result.status).toBe('FAIL');
    expect(result.reasons).toContain('ALIGNMENT_DRIFT');
  });

  it('size-mismatch (15% taller) -> PASS with DIMENSION_WARNING (AC11)', async () => {
    const { result } = await cmp('size-mismatch');
    expect(result.status).toBe('PASS');
    expect(result.warnings.map((w) => w.code)).toContain('DIMENSION_WARNING');
  });

  it('reports every violated condition, not only the first', async () => {
    const { result } = await cmp('component-removed');
    expect(result.reasons).toEqual(expect.arrayContaining(['STRUCTURAL_VARIANCE', 'ALIGNMENT_DRIFT']));
  });

  it('keeps artifacts for reporters', async () => {
    const outcome = await cmp('alignment-shift');
    expect(outcome.artifacts?.width).toBe(320);
    expect(outcome.artifacts?.bands.length).toBeGreaterThan(0);
  });
});

describe('thresholds (AC5)', () => {
  it('a looser max drift lets a mid-size rigid shift pass', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'uidiff-th-'));
    try {
      const { baseline } = fixturePair('identical');
      const shifted = join(dir, 'shifted.png');
      const meta = await sharp(baseline.abs).metadata();
      // Rigid 12 px shift at the same canvas size (extend+extract would change the size).
      await sharp({
        create: { width: meta.width!, height: meta.height!, channels: 3, background: '#f5f5f5' },
      })
        .composite([{ input: baseline.abs, left: 12, top: 0 }])
        .png()
        .toFile(shifted);

      const at = (maxDriftPixels: number) =>
        comparePair(baseline, { rel: 'a.png', abs: shifted }, { ...DEFAULT_COMPARISON, maxDriftPixels });
      const strict = await at(4);
      const justBelow = await at(11);
      const loose = await at(20);
      expect(strict.result.status).toBe('FAIL');
      expect(strict.result.reasons).toContain('ALIGNMENT_DRIFT');
      expect(justBelow.result.status).toBe('FAIL');
      expect(loose.result.status).toBe('PASS');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('a tighter variance threshold can only make results stricter', async () => {
    const lenient = await cmp('component-removed', { ...DEFAULT_COMPARISON, varianceThreshold: 1, maxDriftPixels: 1000 });
    expect(lenient.result.status).toBe('PASS');
  });
});

describe('invalid and mismatched inputs', () => {
  it('corrupt image -> FAIL with INVALID_IMAGE and error detail (AC13)', async () => {
    const outcome = await comparePair(
      { rel: 'broken.png', abs: join(FIXTURES, 'corrupt', 'baseline', 'broken.png') },
      { rel: 'broken.png', abs: join(FIXTURES, 'corrupt', 'current', 'broken.png') },
      DEFAULT_COMPARISON,
    );
    expect(outcome.result.status).toBe('FAIL');
    expect(outcome.result.reasons).toEqual(['INVALID_IMAGE']);
    expect(outcome.result.error).toBeTruthy();
    expect(outcome.artifacts).toBeUndefined();
  });

  it('extension mismatch is a warning, not a failure', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'uidiff-ext-'));
    try {
      const { baseline } = fixturePair('identical');
      const jpg = join(dir, 'identical.jpg');
      await sharp(baseline.abs).jpeg({ quality: 100 }).toFile(jpg);
      const { result } = await comparePair(baseline, { rel: 'identical.jpg', abs: jpg }, DEFAULT_COMPARISON);
      expect(result.warnings.map((w) => w.code)).toContain('EXTENSION_MISMATCH');
      expect(result.status).toBe('PASS');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('composites transparency onto white', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'uidiff-alpha-'));
    try {
      const opaque = join(dir, 'opaque.png');
      const clear = join(dir, 'clear.png');
      await sharp({ create: { width: 64, height: 64, channels: 3, background: '#ffffff' } }).png().toFile(opaque);
      await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toFile(clear);
      const { result } = await comparePair({ rel: 'a.png', abs: opaque }, { rel: 'a.png', abs: clear }, DEFAULT_COMPARISON);
      expect(result.status).toBe('PASS');
      expect(result.variance).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('a fully blank pair is PASS with zero scores', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'uidiff-blank-'));
    try {
      const f = join(dir, 'blank.png');
      await sharp({ create: { width: 64, height: 48, channels: 3, background: '#ffffff' } }).png().toFile(f);
      const { result } = await comparePair({ rel: 'blank.png', abs: f }, { rel: 'blank.png', abs: f }, DEFAULT_COMPARISON);
      expect(result).toMatchObject({ status: 'PASS', variance: 0, drift: 0 });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('runComparison', () => {
  let root: string;
  const baselineDir = () => join(root, 'baseline');
  const currentDir = () => join(root, 'current');

  async function put(dir: string, rel: string, from: string): Promise<void> {
    const dest = join(dir, rel);
    await mkdir(join(dest, '..'), { recursive: true });
    await sharp(from).toFile(dest);
  }

  const cfg = (over: Partial<UiDiffConfig> = {}): UiDiffConfig => ({
    baseline: baselineDir(),
    current: currentDir(),
    output: join(root, 'out'),
    comparison: DEFAULT_COMPARISON,
    reporters: ['console'],
    failOnMissing: true,
    allowEmpty: false,
    concurrency: 2,
    ...over,
  });

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'uidiff-run-'));
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const good = fixturePair('identical').baseline.abs;
  const moved = fixturePair('alignment-shift').current.abs;

  it('pairs nested paths without collisions (AC10) and sorts results', async () => {
    await rm(baselineDir(), { recursive: true, force: true });
    await rm(currentDir(), { recursive: true, force: true });
    await put(baselineDir(), 'desktop/calendar.png', good);
    await put(baselineDir(), 'mobile/calendar.png', good);
    await put(currentDir(), 'desktop/calendar.png', good);
    await put(currentDir(), 'mobile/calendar.png', good);
    const out = await runComparison(cfg());
    expect(out.outcomes.map((o) => o.result.name)).toEqual(['desktop/calendar.png', 'mobile/calendar.png']);
    expect(out.summary).toMatchObject({ total: 2, passed: 2, failed: 0 });
    expect(out.exitCode).toBe(0);
  });

  it('missing in current fails the run (AC6) and can be downgraded to a warning', async () => {
    await rm(baselineDir(), { recursive: true, force: true });
    await rm(currentDir(), { recursive: true, force: true });
    await put(baselineDir(), 'booking-modal.png', good);
    await put(baselineDir(), 'kept.png', good);
    await put(currentDir(), 'kept.png', good);

    const strict = await runComparison(cfg());
    const missing = strict.outcomes.find((o) => o.result.name === 'booking-modal.png')!.result;
    expect(missing.status).toBe('FAIL');
    expect(missing.reasons).toEqual(['MISSING_IN_CURRENT']);
    expect(strict.exitCode).toBe(1);

    const lenient = await runComparison(cfg({ failOnMissing: false }));
    const warned = lenient.outcomes.find((o) => o.result.name === 'booking-modal.png')!.result;
    expect(warned.status).toBe('MISSING');
    expect(warned.warnings.map((w) => w.code)).toEqual(['MISSING_IN_CURRENT']);
    expect(lenient.summary.missing).toBe(1);
    expect(lenient.exitCode).toBe(0);
  });

  it('a new image in current is NEW and never fails the run (AC12)', async () => {
    await rm(baselineDir(), { recursive: true, force: true });
    await rm(currentDir(), { recursive: true, force: true });
    await put(baselineDir(), 'a.png', good);
    await put(currentDir(), 'a.png', good);
    await put(currentDir(), 'new-screen.png', good);
    const out = await runComparison(cfg());
    const added = out.outcomes.find((o) => o.result.name === 'new-screen.png')!.result;
    expect(added.status).toBe('NEW');
    expect(out.summary.new).toBe(1);
    expect(out.exitCode).toBe(0);
  });

  it('a failing pair makes the exit code 1 (AC9), others are still processed', async () => {
    await rm(baselineDir(), { recursive: true, force: true });
    await rm(currentDir(), { recursive: true, force: true });
    await put(baselineDir(), 'a.png', good);
    await put(currentDir(), 'a.png', moved);
    await put(baselineDir(), 'b.png', good);
    await put(currentDir(), 'b.png', good);
    await writeFile(join(currentDir(), 'c.png'), 'garbage');
    await put(baselineDir(), 'c.png', good);
    const out = await runComparison(cfg());
    expect(out.summary).toMatchObject({ total: 3, passed: 1, failed: 2, errored: 1 });
    expect(out.exitCode).toBe(1);
  });

  it('invokes onOutcome per outcome and releases artifacts afterwards', async () => {
    await rm(baselineDir(), { recursive: true, force: true });
    await rm(currentDir(), { recursive: true, force: true });
    await put(baselineDir(), 'a.png', good);
    await put(currentDir(), 'a.png', good);
    const seen: boolean[] = [];
    const out = await runComparison(cfg(), async (o) => {
      seen.push(o.artifacts !== undefined);
    });
    expect(seen).toEqual([true]);
    expect(out.outcomes[0].artifacts).toBeUndefined();
  });

  it('empty input fails unless allowEmpty (AC14)', async () => {
    await rm(baselineDir(), { recursive: true, force: true });
    await rm(currentDir(), { recursive: true, force: true });
    await mkdir(baselineDir(), { recursive: true });
    await mkdir(currentDir(), { recursive: true });
    await writeFile(join(baselineDir(), 'notes.txt'), 'ignored');
    const strict = await runComparison(cfg());
    expect(strict.runWarnings[0]).toContain('EMPTY_INPUT');
    expect(strict.exitCode).toBe(1);
    const allowed = await runComparison(cfg({ allowEmpty: true }));
    expect(allowed.runWarnings[0]).toContain('EMPTY_INPUT');
    expect(allowed.exitCode).toBe(0);
  });

  it('rejects a missing directory as a usage error naming the path', async () => {
    await expect(runComparison(cfg({ baseline: join(root, 'nope') }))).rejects.toThrow(/Baseline directory.*nope/);
    await expect(runComparison(cfg({ current: join(root, 'nope2') }))).rejects.toThrow(/Current directory.*nope2/);
  });

  it('summarise counts every status', () => {
    const mk = (status: 'PASS' | 'FAIL' | 'NEW' | 'MISSING', reasons: ('INVALID_IMAGE')[] = []) => ({
      result: { name: status, status, reasons, warnings: [] },
    });
    expect(summarise([mk('PASS'), mk('FAIL', ['INVALID_IMAGE']), mk('NEW'), mk('MISSING')])).toEqual({
      total: 4, passed: 1, failed: 1, new: 1, missing: 1, errored: 1,
    });
  });
});

describe('resolveConfig integration with runComparison inputs', () => {
  it('produces absolute paths', () => {
    const c = resolveConfig({ baseline: 'a', current: 'b' }, '/work');
    expect(c.baseline).toBe('/work/a');
    expect(c.current).toBe('/work/b');
  });
});
