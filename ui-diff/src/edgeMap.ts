import sharp from 'sharp';
import type { GrayImage } from './normalize.js';

/**
 * Sobel response of a full-contrast axis-aligned step edge on 8-bit input (4 * 255).
 * Normalising by this, rather than the unreachable diagonal maximum, keeps `edgeThreshold`
 * proportional to real edge contrast.
 */
const SOBEL_MAX = 4 * 255;

/** sharp rejects sigma below 0.3. */
const MIN_SIGMA = 0.3;

const FAR = 1e20;

/** 1-D squared Euclidean distance transform (Felzenszwalb & Huttenlocher), in place into `d`. */
function distanceTransform1D(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array): void {
  let k = 0;
  v[0] = 0;
  z[0] = -FAR;
  z[1] = FAR;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = FAR;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const dq = q - v[k];
    d[q] = dq * dq + f[v[k]];
  }
}

/**
 * Circular dilation of a binary edge map: every pixel within Euclidean distance `radius` of an
 * edge pixel becomes 1. Uses an exact distance transform, so the cost is independent of `radius`.
 * `radius <= 0` is a no-op and returns the input unchanged.
 */
export function dilateEdgeMap(edges: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius <= 0) return edges;
  const size = Math.max(width, height);
  const grid = new Float64Array(width * height);
  for (let i = 0; i < grid.length; i++) grid[i] = edges[i] === 1 ? 0 : FAR;

  const f = new Float64Array(size);
  const d = new Float64Array(size);
  const v = new Int32Array(size);
  const z = new Float64Array(size + 1);

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) f[y] = grid[y * width + x];
    distanceTransform1D(f, height, d, v, z);
    for (let y = 0; y < height; y++) grid[y * width + x] = d[y];
  }
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) f[x] = grid[row + x];
    distanceTransform1D(f, width, d, v, z);
    for (let x = 0; x < width; x++) grid[row + x] = d[x];
  }

  const limit = radius * radius;
  const out = new Uint8Array(edges.length);
  for (let i = 0; i < out.length; i++) if (grid[i] <= limit) out[i] = 1;
  return out;
}

/**
 * Shift-tolerant matching of two edge maps.
 * Returns the baseline map unchanged and a copy of the current map in which every edge that has a
 * counterpart within `tolerance` pixels in the other map is replaced by that counterpart's exact
 * position. Matched edges are therefore identical in both maps; only edges that are added, removed
 * or displaced by more than `tolerance` remain different.
 */
export function matchWithinTolerance(
  baseline: Uint8Array,
  current: Uint8Array,
  width: number,
  height: number,
  tolerance: number,
): [Uint8Array, Uint8Array] {
  if (tolerance <= 0) return [baseline, current];
  const nearBaseline = dilateEdgeMap(baseline, width, height, tolerance);
  const nearCurrent = dilateEdgeMap(current, width, height, tolerance);
  const matched = new Uint8Array(current.length);
  for (let i = 0; i < current.length; i++) {
    // Baseline edges with a current edge nearby are treated as present in current;
    // current edges with no baseline edge nearby stay as they are.
    if ((baseline[i] === 1 && nearCurrent[i] === 1) || (current[i] === 1 && nearBaseline[i] === 0)) matched[i] = 1;
  }
  return [baseline, matched];
}

export async function blurGray(img: GrayImage, radius: number): Promise<GrayImage> {
  if (radius <= 0) return img;
  // toColourspace('b-w') keeps the output single-channel; sharp otherwise expands to 3 channels.
  const data = await sharp(img.data, { raw: { width: img.width, height: img.height, channels: 1 } })
    .blur(Math.max(radius, MIN_SIGMA))
    .toColourspace('b-w')
    .raw()
    .toBuffer();
  if (data.length !== img.width * img.height) {
    throw new Error(`Unexpected blur output size: ${data.length} bytes for ${img.width}x${img.height}`);
  }
  return { width: img.width, height: img.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
}

/**
 * Sobel gradient magnitude, normalised to [0, 1] and thresholded.
 * Returns a binary map (1 = edge). Border pixels are 0.
 */
export function sobelEdges(img: GrayImage, threshold: number): Uint8Array {
  const { width: w, height: h, data: g } = img;
  const out = new Uint8Array(w * h);
  const cut = threshold * SOBEL_MAX;
  for (let y = 1; y < h - 1; y++) {
    const r0 = (y - 1) * w;
    const r1 = y * w;
    const r2 = (y + 1) * w;
    for (let x = 1; x < w - 1; x++) {
      const gx =
        -g[r0 + x - 1] + g[r0 + x + 1] -
        2 * g[r1 + x - 1] + 2 * g[r1 + x + 1] -
        g[r2 + x - 1] + g[r2 + x + 1];
      const gy =
        -g[r0 + x - 1] - 2 * g[r0 + x] - g[r0 + x + 1] +
        g[r2 + x - 1] + 2 * g[r2 + x] + g[r2 + x + 1];
      if (Math.hypot(gx, gy) >= cut) out[r1 + x] = 1;
    }
  }
  return out;
}

/** Blur then Sobel: the structural edge map. */
export async function structuralEdgeMap(img: GrayImage, blurRadius: number, edgeThreshold: number): Promise<Uint8Array> {
  return sobelEdges(await blurGray(img, blurRadius), edgeThreshold);
}
