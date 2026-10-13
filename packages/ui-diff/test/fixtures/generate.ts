/**
 * Generates PNG fixture images for the ui-diff test suite.
 * Usage: node --import tsx/esm generate.ts
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)));

type RGB = [number, number, number];

async function writePng(path: string, data: Uint8Array | Buffer, w: number, h: number): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await sharp(data, { raw: { width: w, height: h, channels: 3 } }).png().toFile(path);
}

function fill(w: number, h: number, color: RGB): Uint8Array {
  const buf = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    buf[i * 3] = color[0];
    buf[i * 3 + 1] = color[1];
    buf[i * 3 + 2] = color[2];
  }
  return buf;
}

/** Draw a filled rectangle (RGB). */
function rect(buf: Uint8Array, w: number, x: number, y: number, rw: number, rh: number, color: RGB): void {
  for (let ry = y; ry < y + rh; ry++) {
    for (let rx = x; rx < x + rw; rx++) {
      const i = (ry * w + rx) * 3;
      buf[i] = color[0]; buf[i + 1] = color[1]; buf[i + 2] = color[2];
    }
  }
}

/**
 * Simulate a line of text without a font renderer: 2px-wide "glyph" bars with 2px gaps and
 * varying heights. Like real text this is high-frequency and low-energy once blurred.
 * Different `len` / `seed` values give different strings.
 */
function textBlock(buf: Uint8Array, w: number, x: number, y: number, len: number, color: RGB, seed = 0): void {
  for (let gx = 0; gx < len; gx += 4) {
    const h = 6 + ((gx / 4 + seed) % 4) * 2;
    rect(buf, w, x + gx, y + (10 - h), 2, h, color);
  }
}

const W = 320;
const H = 240;
const BG: RGB = [245, 245, 245];
const BORDER: RGB = [80, 80, 80];
const BTN: RGB = [50, 100, 200];
const LABEL: RGB = [30, 30, 30];
const LABEL2: RGB = [100, 100, 100];

/**
 * A card with a header, body text, and a button. `seed` changes the simulated text content.
 * `sy` scales every vertical coordinate, giving the same layout rendered on a taller page.
 */
function layoutA(btnX: number, label1Len: number, label2Len: number, seed = 0, sy = 1): Uint8Array {
  const h = Math.round(H * sy);
  const v = (y: number): number => Math.round(y * sy);
  const buf = fill(W, h, BG);
  // Card border
  rect(buf, W, 20, v(20), 280, v(200), BORDER);
  rect(buf, W, 22, v(20) + 2, 276, v(200) - 4, BG);
  // Header band
  rect(buf, W, 22, v(20) + 2, 276, v(30), [200, 220, 255]);
  textBlock(buf, W, 30, v(29), label1Len, LABEL, seed);
  // Body text
  textBlock(buf, W, 30, v(70), label2Len, LABEL2, seed);
  textBlock(buf, W, 30, v(90), label2Len - 10, LABEL2, seed + 1);
  // Button
  rect(buf, W, btnX, v(170), 60, v(28), BTN);
  return buf;
}

/** Layout A with a missing sidebar (structural removal). */
function layoutMissingSidebar(): Uint8Array {
  const buf = fill(W, H, BG);
  // Card border only — sidebar removed
  rect(buf, W, 20, 20, 180, 200, BORDER);
  rect(buf, W, 22, 22, 178, 196, BG);
  rect(buf, W, 22, 22, 178, 30, [200, 220, 255]);
  textBlock(buf, W, 30, 29, 80, LABEL);
  textBlock(buf, W, 30, 70, 100, LABEL2);
  return buf;
}

type Fixture = { dir: string; label: string; fn: () => Uint8Array };

const fixtures: { baseline: Fixture; current: Fixture }[] = [
  {
    baseline: { dir: 'identical', label: 'identical', fn: () => layoutA(238, 100, 120) },
    current: { dir: 'identical', label: 'identical', fn: () => layoutA(238, 100, 120) },
  },
  {
    // Same layout, different text length — simulates dynamic content.
    baseline: { dir: 'text-change', label: 'text-change', fn: () => layoutA(238, 100, 120) },
    current: { dir: 'text-change', label: 'text-change', fn: () => layoutA(238, 80, 100, 3) },
  },
  {
    // Button moves to the left margin.
    baseline: { dir: 'alignment-shift', label: 'alignment-shift', fn: () => layoutA(238, 100, 120) },
    current: { dir: 'alignment-shift', label: 'alignment-shift', fn: () => layoutA(30, 100, 120) },
  },
  {
    // Candidate is missing a major structural element.
    baseline: { dir: 'component-removed', label: 'component-removed', fn: () => layoutA(238, 100, 120) },
    current: { dir: 'component-removed', label: 'component-removed', fn: layoutMissingSidebar },
  },
];

for (const { baseline, current } of fixtures) {
  await writePng(join(ROOT, baseline.dir, 'baseline', `${baseline.label}.png`), baseline.fn(), W, H);
  await writePng(join(ROOT, current.dir, 'current', `${current.label}.png`), current.fn(), W, H);
}

// Size-mismatch: the same layout drawn on a page that is 15% taller (proportionally scaled).
const curH = Math.round(H * 1.15);
await writePng(join(ROOT, 'size-mismatch', 'baseline', 'size-mismatch.png'), layoutA(238, 100, 120), W, H);
await writePng(join(ROOT, 'size-mismatch', 'current', 'size-mismatch.png'), layoutA(238, 100, 120, 0, 1.15), W, curH);

// Missing fixture: baseline has a file, current does not.
await writePng(join(ROOT, 'missing', 'baseline', 'booking-modal.png'), layoutA(238, 100, 120), W, H);
await mkdir(join(ROOT, 'missing', 'current'), { recursive: true });

// New fixture: current has a file, baseline does not.
await mkdir(join(ROOT, 'new', 'baseline'), { recursive: true });
await writePng(join(ROOT, 'new', 'current', 'new-screen.png'), layoutA(238, 100, 120), W, H);

// Corrupt fixture: write a valid PNG path to an obviously corrupt payload.
await mkdir(join(ROOT, 'corrupt', 'baseline'), { recursive: true });
await mkdir(join(ROOT, 'corrupt', 'current'), { recursive: true });
await writePng(join(ROOT, 'corrupt', 'baseline', 'broken.png'), layoutA(238, 100, 120), W, H);
import { writeFile } from 'node:fs/promises';
await writeFile(join(ROOT, 'corrupt', 'current', 'broken.png'), Buffer.from('this is not a png'));

console.log('Fixtures generated.');
