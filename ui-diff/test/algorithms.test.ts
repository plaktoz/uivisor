import { describe, expect, it } from 'vitest';
import { blockDissimilarity, percentileScore } from '../src/dissimilarity.js';
import { dilateEdgeMap, matchWithinTolerance, sobelEdges } from '../src/edgeMap.js';
import { measureDrift, worstBand } from '../src/drift.js';
import type { GrayImage } from '../src/normalize.js';

/** Build a W x H binary map with filled rectangles. */
function map(w: number, h: number, rects: [number, number, number, number][]): Uint8Array {
  const m = new Uint8Array(w * h);
  for (const [x, y, rw, rh] of rects) {
    for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) m[j * w + i] = 1;
  }
  return m;
}

describe('sobelEdges', () => {
  it('finds a vertical step edge and leaves flat areas empty', () => {
    const w = 10;
    const h = 10;
    const data = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 5; x < w; x++) data[y * w + x] = 255;
    const img: GrayImage = { width: w, height: h, data };
    const edges = sobelEdges(img, 0.5);
    expect(edges[5 * w + 4]).toBe(1);
    expect(edges[5 * w + 5]).toBe(1);
    expect(edges[5 * w + 1]).toBe(0);
    expect(edges[5 * w + 8]).toBe(0);
  });

  it('never marks the image border', () => {
    const img: GrayImage = { width: 4, height: 4, data: new Uint8Array(16).map((_, i) => (i % 2 ? 255 : 0)) };
    const edges = sobelEdges(img, 0.01);
    for (let i = 0; i < 4; i++) {
      expect(edges[i]).toBe(0);
      expect(edges[12 + i]).toBe(0);
      expect(edges[i * 4]).toBe(0);
      expect(edges[i * 4 + 3]).toBe(0);
    }
  });
});

describe('dilateEdgeMap', () => {
  it('is a no-op for radius 0', () => {
    const m = map(5, 5, [[2, 2, 1, 1]]);
    expect(dilateEdgeMap(m, 5, 5, 0)).toBe(m);
  });

  it('grows a single pixel into a disk and clips at the border', () => {
    const w = 7;
    const m = map(w, w, [[0, 0, 1, 1]]);
    const out = dilateEdgeMap(m, w, w, 2);
    expect(out[0]).toBe(1);
    expect(out[2]).toBe(1);
    expect(out[2 * w]).toBe(1);
    expect(out[2 * w + 2]).toBe(0); // outside the disk (distance sqrt(8) > 2)
    expect(out[w * w - 1]).toBe(0);
  });
});

describe('matchWithinTolerance', () => {
  const w = 40;
  const h = 40;

  it('returns the inputs untouched for tolerance 0', () => {
    const a = map(w, h, [[5, 5, 1, 10]]);
    const b = map(w, h, [[7, 5, 1, 10]]);
    const [ma, mb] = matchWithinTolerance(a, b, w, h, 0);
    expect(ma).toBe(a);
    expect(mb).toBe(b);
  });

  it('makes a line displaced within tolerance identical in both maps', () => {
    const a = map(w, h, [[10, 5, 1, 20]]);
    const b = map(w, h, [[14, 5, 1, 20]]);
    const [ma, mb] = matchWithinTolerance(a, b, w, h, 6);
    expect(Array.from(mb)).toEqual(Array.from(ma));
  });

  it('keeps a line displaced beyond tolerance different', () => {
    const a = map(w, h, [[5, 5, 1, 20]]);
    const b = map(w, h, [[30, 5, 1, 20]]);
    const [ma, mb] = matchWithinTolerance(a, b, w, h, 6);
    expect(Array.from(mb)).not.toEqual(Array.from(ma));
    expect(mb[10 * w + 30]).toBe(1); // unmatched current edge is preserved
    expect(mb[10 * w + 5]).toBe(0); // baseline edge has no counterpart
  });

  it('keeps an edge that exists only in the current image', () => {
    const a = map(w, h, []);
    const b = map(w, h, [[20, 20, 4, 4]]);
    const [, mb] = matchWithinTolerance(a, b, w, h, 6);
    expect(Array.from(mb)).toEqual(Array.from(b));
  });
});

describe('blockDissimilarity / percentileScore', () => {
  const w = 32;
  const h = 32;

  it('scores identical maps as 0 and skips empty blocks', () => {
    const a = map(w, h, [[2, 2, 1, 12]]);
    const blocks = blockDissimilarity(a, a, w, h, 16);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].dissimilarity).toBe(0);
  });

  it('scores disjoint structure as fully dissimilar', () => {
    const a = map(w, h, [[2, 2, 1, 12]]);
    const b = map(w, h, [[10, 2, 1, 12]]);
    const [block] = blockDissimilarity(a, b, w, h, 16);
    expect(block.dissimilarity).toBeGreaterThan(0.9);
  });

  it('handles images that are not a multiple of the grid size', () => {
    const a = map(20, 18, [[18, 16, 2, 2]]);
    const blocks = blockDissimilarity(a, a, 20, 18, 16);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ x: 16, y: 16, w: 4, h: 2 });
  });

  it('returns 0 for no blocks', () => {
    expect(percentileScore([], 95)).toBe(0);
  });

  it('uses nearest-rank percentiles and tolerates a few outliers at P95', () => {
    const blocks = Array.from({ length: 100 }, (_, i) => ({ x: 0, y: 0, w: 1, h: 1, dissimilarity: i < 95 ? 0 : 1 }));
    expect(percentileScore(blocks, 95)).toBe(0);
    expect(percentileScore(blocks, 96)).toBe(1);
    expect(percentileScore(blocks, 100)).toBe(1);
    expect(percentileScore(blocks, 1)).toBe(0);
  });
});

describe('measureDrift', () => {
  const w = 128;
  const h = 64;

  it('reports zero drift for identical maps', () => {
    const a = map(w, h, [[100, 10, 20, 20]]);
    expect(worstBand(measureDrift(a, a, w, h, 16))?.drift).toBe(0);
  });

  it('measures a rigid horizontal shift on the horizontal axis', () => {
    const a = map(w, h, [[100, 8, 20, 20]]);
    const b = map(w, h, [[104, 8, 20, 20]]);
    const worst = worstBand(measureDrift(a, b, w, h, 16, 8))!;
    expect(worst.drift).toBe(4);
    expect(worst.axis).toBe('horizontal');
  });

  it('measures a rigid vertical shift on the vertical axis', () => {
    const a = map(w, h, [[8, 8, 20, 20]]);
    const b = map(w, h, [[8, 13, 20, 20]]);
    const bands = measureDrift(a, b, w, h, 16, 8);
    const vertical = bands.filter((x) => x.axis === 'vertical');
    expect(Math.max(...vertical.map((x) => x.drift))).toBe(5);
  });

  it('takes the largest of centroid, first-extent and last-extent shifts', () => {
    // Right-aligned element that grows 20px wider to the left: the right edge (last extent) is
    // fixed, the centroid moves 10px and the first extent moves 20px. The band reports 20.
    const a = map(w, h, [[100, 8, 20, 8]]);
    const b = map(w, h, [[80, 8, 40, 8]]);
    const row = measureDrift(a, b, w, h, 16, 8).find((x) => x.axis === 'horizontal' && x.y === 0)!;
    expect(row.drift).toBe(20);
  });

  it('detects a right-anchored element moving to the left margin via its extents', () => {
    const a = map(w, h, [[100, 8, 20, 8]]);
    const b = map(w, h, [[8, 8, 20, 8]]);
    const row = measureDrift(a, b, w, h, 16, 8).find((x) => x.axis === 'horizontal' && x.y === 0)!;
    expect(row.drift).toBe(92);
  });

  it('attributes a one-sided band to the perpendicular axis at full length', () => {
    const a = map(w, h, [[100, 8, 20, 8]]);
    const b = map(w, h, []);
    const bands = measureDrift(a, b, w, h, 16, 8);
    expect(bands.every((x) => x.oneSided)).toBe(true);
    const rowBand = bands.find((x) => x.y === 0 && x.w === w)!; // a row band is one-sided => vertical
    expect(rowBand.axis).toBe('vertical');
    expect(rowBand.drift).toBe(h);
    const colBand = bands.find((x) => x.x === 96)!;
    expect(colBand.axis).toBe('horizontal');
    expect(colBand.drift).toBe(w);
  });

  it('ignores bands with fewer edge pixels than the minimum mass (noise)', () => {
    const a = map(w, h, [[50, 20, 1, 3]]);
    expect(measureDrift(a, a, w, h, 16)).toHaveLength(0);
    expect(worstBand([])).toBeUndefined();
  });

  it('clips the last band thickness at the image edge', () => {
    const a = map(w, 40, [[10, 32, 30, 8]]);
    const bands = measureDrift(a, a, w, 40, 16, 8);
    const last = bands.find((x) => x.axis === 'horizontal' && x.y === 32)!;
    expect(last.h).toBe(8);
  });
});
