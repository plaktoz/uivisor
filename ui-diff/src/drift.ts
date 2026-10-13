import { dilateEdgeMap } from './edgeMap.js';
import type { DriftAxis, DriftBand } from './types.js';

interface BandStats {
  mass: number;
  /** Edge pixels with no counterpart within the tolerance in the other image. */
  unmatched: number;
  /** Sum of positions along the band axis (for the centroid). */
  sum: number;
  first: number;
  last: number;
}

function emptyStats(): BandStats {
  return { mass: 0, unmatched: 0, sum: 0, first: Infinity, last: -Infinity };
}

/**
 * @param nearOther the other image's edge map dilated by the tolerance: a pixel that is 0 there
 *                  has no counterpart within the tolerance.
 */
function collect(
  map: Uint8Array,
  nearOther: Uint8Array,
  width: number,
  height: number,
  gridSize: number,
  axis: DriftAxis,
): BandStats[] {
  const bandCount = Math.ceil((axis === 'horizontal' ? height : width) / gridSize);
  const stats = Array.from({ length: bandCount }, emptyStats);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (map[row + x] === 0) continue;
      // horizontal axis: bands are rows, position is x. vertical axis: bands are columns, position is y.
      const band = axis === 'horizontal' ? Math.floor(y / gridSize) : Math.floor(x / gridSize);
      const pos = axis === 'horizontal' ? x : y;
      const s = stats[band];
      s.mass++;
      if (nearOther[row + x] === 0) s.unmatched++;
      s.sum += pos;
      if (pos < s.first) s.first = pos;
      if (pos > s.last) s.last = pos;
    }
  }
  return stats;
}

/**
 * A band carries structure only if it holds at least this many edge pixels.
 * Isolated noise pixels must not create phantom anchors or one-sided bands.
 */
export function minBandMass(gridSize: number): number {
  return gridSize;
}

/**
 * Alignment drift on the structural edge maps, along both axes.
 * Each band is `gridSize` thick; when both images have structure in it, its drift is the largest
 * of the centroid shift and the first/last extent shifts.
 *
 * A band where only one image has structure means something appeared or disappeared there, i.e. it
 * moved across the *other* axis (a one-sided column band is a horizontal displacement). Such a
 * band is attributed to the perpendicular axis and drifts by that axis' full length. Structure only
 * counts as appeared or disappeared if it has no counterpart within `tolerance` pixels in the other
 * image; otherwise it merely crossed a band boundary and the displacement is measured by the bands
 * on the perpendicular axis instead.
 */
export function measureDrift(
  baseline: Uint8Array,
  current: Uint8Array,
  width: number,
  height: number,
  gridSize: number,
  tolerance: number,
): DriftBand[] {
  const minMass = minBandMass(gridSize);
  const nearBaseline = dilateEdgeMap(baseline, width, height, tolerance);
  const nearCurrent = dilateEdgeMap(current, width, height, tolerance);
  const bands: DriftBand[] = [];
  for (const axis of ['horizontal', 'vertical'] as const) {
    const a = collect(baseline, nearCurrent, width, height, gridSize, axis);
    const b = collect(current, nearBaseline, width, height, gridSize, axis);
    for (let i = 0; i < a.length; i++) {
      const sa = a[i];
      const sb = b[i];
      const hasA = sa.mass >= minMass;
      const hasB = sb.mass >= minMass;
      if (!hasA && !hasB) continue;

      const oneSided = hasA !== hasB;
      if (oneSided && (hasA ? sa.unmatched : sb.unmatched) < minMass) continue; // crossed a band boundary

      const start = i * gridSize;
      const thickness = Math.min(gridSize, (axis === 'horizontal' ? height : width) - start);
      let drift: number;
      let reportedAxis: DriftAxis = axis;
      if (oneSided) {
        reportedAxis = axis === 'horizontal' ? 'vertical' : 'horizontal';
        drift = reportedAxis === 'horizontal' ? width : height;
      } else {
        drift = Math.max(
          Math.abs(sa.sum / sa.mass - sb.sum / sb.mass),
          Math.abs(sa.first - sb.first),
          Math.abs(sa.last - sb.last),
        );
      }
      bands.push({
        axis: reportedAxis,
        x: axis === 'horizontal' ? 0 : start,
        y: axis === 'horizontal' ? start : 0,
        w: axis === 'horizontal' ? width : thickness,
        h: axis === 'horizontal' ? thickness : height,
        drift,
        oneSided,
      });
    }
  }
  return bands;
}

/** The band with the greatest drift, or undefined when there are no bands. */
export function worstBand(bands: DriftBand[]): DriftBand | undefined {
  let worst: DriftBand | undefined;
  for (const b of bands) if (!worst || b.drift > worst.drift) worst = b;
  return worst;
}
