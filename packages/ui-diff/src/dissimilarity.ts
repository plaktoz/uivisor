import type { BlockScore } from './types.js';

// SSIM stabilisers for a dynamic range of L = 1 (binary edge maps).
const C1 = 0.01 ** 2;
const C2 = 0.03 ** 2;

/**
 * Block-wise SSIM dissimilarity between two equally sized binary edge maps.
 * Blocks with no edges in either map are skipped so blank areas do not dilute the result.
 */
export function blockDissimilarity(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  width: number,
  height: number,
  gridSize: number,
): BlockScore[] {
  const blocks: BlockScore[] = [];
  for (let by = 0; by < height; by += gridSize) {
    const h = Math.min(gridSize, height - by);
    for (let bx = 0; bx < width; bx += gridSize) {
      const w = Math.min(gridSize, width - bx);
      const n = w * h;
      let sumA = 0;
      let sumB = 0;
      let sumAA = 0;
      let sumBB = 0;
      let sumAB = 0;
      for (let y = by; y < by + h; y++) {
        const row = y * width;
        for (let x = bx; x < bx + w; x++) {
          const va = a[row + x];
          const vb = b[row + x];
          sumA += va;
          sumB += vb;
          sumAA += va * va;
          sumBB += vb * vb;
          sumAB += va * vb;
        }
      }
      if (sumA === 0 && sumB === 0) continue;
      const muA = sumA / n;
      const muB = sumB / n;
      const varA = sumAA / n - muA * muA;
      const varB = sumBB / n - muB * muB;
      const cov = sumAB / n - muA * muB;
      const ssim =
        ((2 * muA * muB + C1) * (2 * cov + C2)) /
        ((muA * muA + muB * muB + C1) * (varA + varB + C2));
      blocks.push({ x: bx, y: by, w, h, dissimilarity: Math.min(1, Math.max(0, 1 - ssim)) });
    }
  }
  return blocks;
}

/** Nearest-rank percentile of block dissimilarity. Returns 0 when there are no blocks. */
export function percentileScore(blocks: BlockScore[], percentile: number): number {
  if (blocks.length === 0) return 0;
  const sorted = blocks.map((b) => b.dissimilarity).sort((x, y) => x - y);
  const rank = Math.ceil((percentile / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}
