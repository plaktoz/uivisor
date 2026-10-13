import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import type { ComparisonArtifacts, ComparisonOptions, ImageAssets, PairOutcome } from '../types.js';

/** Convert an image's relative path to an asset path, swapping the extension for `.png`. */
function assetRel(kind: 'baseline' | 'current' | 'edge' | 'diff', name: string): string {
  const dot = name.lastIndexOf('.');
  const stem = dot > name.lastIndexOf('/') ? name.slice(0, dot) : name;
  return `assets/${kind}/${stem}.png`;
}

async function writePng(outDir: string, rel: string, buf: Buffer): Promise<void> {
  const file = join(outDir, rel);
  await mkdir(dirname(file), { recursive: true });
  await sharp(buf).toFile(file);
}

async function writeRaw(outDir: string, rel: string, rgba: Uint8Array, width: number, height: number): Promise<void> {
  const file = join(outDir, rel);
  await mkdir(dirname(file), { recursive: true });
  await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toFile(file);
}

async function copyAsPng(outDir: string, rel: string, src: string): Promise<void> {
  const file = join(outDir, rel);
  await mkdir(dirname(file), { recursive: true });
  if (src.toLowerCase().endsWith('.png')) await copyFile(src, file);
  else await sharp(src).rotate().png().toFile(file);
}

/** Edge map rendered as dark lines on white. */
function edgeMapRgba(edges: Uint8Array): Uint8Array {
  const rgba = new Uint8Array(edges.length * 4);
  for (let i = 0; i < edges.length; i++) {
    const v = edges[i] ? 30 : 255;
    rgba[i * 4] = v;
    rgba[i * 4 + 1] = v;
    rgba[i * 4 + 2] = v;
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

function setPixel(rgba: Uint8Array, width: number, x: number, y: number, r: number, g: number, b: number, a: number): void {
  const i = (y * width + x) * 4;
  const inv = 1 - a;
  rgba[i] = Math.round(rgba[i] * inv + r * a);
  rgba[i + 1] = Math.round(rgba[i + 1] * inv + g * a);
  rgba[i + 2] = Math.round(rgba[i + 2] * inv + b * a);
}

/**
 * Overlay on the current edge map: baseline-only edges in red, current-only edges in blue,
 * shared edges in grey; failing blocks tinted red, drift bands over the limit boxed in red.
 */
export function diffOverlayRgba(a: ComparisonArtifacts, options: ComparisonOptions): Uint8Array {
  const { width, height, baselineEdges, currentEdges } = a;
  const rgba = new Uint8Array(width * height * 4).fill(255);
  for (let i = 0; i < width * height; i++) {
    const inBase = baselineEdges[i] === 1;
    const inCur = currentEdges[i] === 1;
    const p = i * 4;
    if (inBase && inCur) {
      rgba[p] = rgba[p + 1] = rgba[p + 2] = 150;
    } else if (inBase) {
      rgba[p] = 220; rgba[p + 1] = 40; rgba[p + 2] = 40;
    } else if (inCur) {
      rgba[p] = 40; rgba[p + 1] = 90; rgba[p + 2] = 220;
    }
  }

  for (const b of a.blocks) {
    if (b.dissimilarity <= options.varianceThreshold) continue;
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let x = b.x; x < b.x + b.w; x++) setPixel(rgba, width, x, y, 255, 0, 0, 0.18);
    }
  }

  for (const band of a.bands) {
    if (band.drift <= options.maxDriftPixels) continue;
    const x1 = band.x + band.w - 1;
    const y1 = band.y + band.h - 1;
    for (let x = band.x; x <= x1; x++) {
      setPixel(rgba, width, x, band.y, 255, 0, 0, 1);
      setPixel(rgba, width, x, y1, 255, 0, 0, 1);
    }
    for (let y = band.y; y <= y1; y++) {
      setPixel(rgba, width, band.x, y, 255, 0, 0, 1);
      setPixel(rgba, width, x1, y, 255, 0, 0, 1);
    }
  }
  return rgba;
}

/** Write the baseline, current, edge-map and diff images for one outcome and record their paths. */
export async function writeAssets(outDir: string, outcome: PairOutcome, options: ComparisonOptions): Promise<void> {
  const { result } = outcome;
  const assets: ImageAssets = {};

  if (outcome.baselineFile) {
    assets.baseline = assetRel('baseline', result.name);
    await copyAsPng(outDir, assets.baseline, outcome.baselineFile);
  }
  if (outcome.currentFile) {
    assets.current = assetRel('current', result.name);
    await copyAsPng(outDir, assets.current, outcome.currentFile);
  }
  if (outcome.artifacts) {
    const a = outcome.artifacts;
    assets.edgeMap = assetRel('edge', result.name);
    await writeRaw(outDir, assets.edgeMap, edgeMapRgba(a.currentEdges), a.width, a.height);
    assets.diff = assetRel('diff', result.name);
    await writeRaw(outDir, assets.diff, diffOverlayRgba(a, options), a.width, a.height);
  }
  result.assets = assets;
}
