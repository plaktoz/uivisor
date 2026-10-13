import { stat } from 'node:fs/promises';
import { UsageError } from './config.js';
import { blockDissimilarity, percentileScore } from './dissimilarity.js';
import { measureDrift, worstBand } from './drift.js';
import { matchWithinTolerance, structuralEdgeMap } from './edgeMap.js';
import { exceedsDimensionTolerance, loadGray, resizeGray } from './normalize.js';
import { extname } from 'node:path';
import { pairImages, type ImageEntry } from './pairing.js';
import type {
  ComparisonOptions,
  FailureReason,
  PairOutcome,
  RunOutput,
  RunSummary,
  UiDiffConfig,
  Warning,
} from './types.js';

/** Compare one baseline/current pair. Never throws: unreadable images become INVALID_IMAGE. */
export async function comparePair(
  baseline: ImageEntry,
  current: ImageEntry,
  options: ComparisonOptions,
): Promise<PairOutcome> {
  const warnings: Warning[] = [];
  if (extname(baseline.rel).toLowerCase() !== extname(current.rel).toLowerCase()) {
    warnings.push({
      code: 'EXTENSION_MISMATCH',
      message: `Extensions differ: baseline "${baseline.rel}" vs current "${current.rel}"`,
    });
  }

  try {
    const baseGray = await loadGray(baseline.abs);
    let curGray = await loadGray(current.abs);

    if (exceedsDimensionTolerance(baseGray, curGray)) {
      warnings.push({
        code: 'DIMENSION_WARNING',
        message: `Size differs by more than 10%: baseline ${baseGray.width}x${baseGray.height}, current ${curGray.width}x${curGray.height}`,
      });
    }
    curGray = await resizeGray(curGray, baseGray.width, baseGray.height);

    const [baselineEdges, currentEdges] = await Promise.all([
      structuralEdgeMap(baseGray, options.blurRadius, options.edgeThreshold),
      structuralEdgeMap(curGray, options.blurRadius, options.edgeThreshold),
    ]);

    const { width, height } = baseGray;
    // Edges displaced by no more than maxDriftPixels count as matched. Both D_s and drift use the
    // matched maps: otherwise a shift within tolerance would still register as drift, because
    // band centroids and extents move when edges merely cross a band boundary.
    const [matchedBase, matchedCurrent] = matchWithinTolerance(
      baselineEdges,
      currentEdges,
      width,
      height,
      options.maxDriftPixels,
    );
    const blocks = blockDissimilarity(matchedBase, matchedCurrent, width, height, options.gridSize);
    const variance = percentileScore(blocks, options.percentile);
    const bands = measureDrift(matchedBase, matchedCurrent, width, height, options.gridSize, options.maxDriftPixels);
    const worst = worstBand(bands);
    const drift = worst?.drift ?? 0;

    const reasons: FailureReason[] = [];
    if (variance > options.varianceThreshold) reasons.push('STRUCTURAL_VARIANCE');
    if (drift > options.maxDriftPixels) reasons.push('ALIGNMENT_DRIFT');

    return {
      result: {
        name: baseline.rel,
        status: reasons.length === 0 ? 'PASS' : 'FAIL',
        reasons,
        variance,
        drift,
        driftAxis: worst?.axis,
        warnings,
      },
      baselineFile: baseline.abs,
      currentFile: current.abs,
      artifacts: { width, height, baselineEdges, currentEdges, blocks, bands },
    };
  } catch (err) {
    return {
      result: {
        name: baseline.rel,
        status: 'FAIL',
        reasons: ['INVALID_IMAGE'],
        warnings,
        error: err instanceof Error ? err.message : String(err),
      },
      baselineFile: baseline.abs,
      currentFile: current.abs,
    };
  }
}

export function summarise(outcomes: PairOutcome[]): RunSummary {
  const summary: RunSummary = { total: outcomes.length, passed: 0, failed: 0, new: 0, missing: 0, errored: 0 };
  for (const { result } of outcomes) {
    if (result.status === 'PASS') summary.passed++;
    else if (result.status === 'FAIL') summary.failed++;
    else if (result.status === 'NEW') summary.new++;
    else summary.missing++;
    if (result.reasons.includes('INVALID_IMAGE')) summary.errored++;
  }
  return summary;
}

async function requireDirectory(path: string, label: string): Promise<void> {
  try {
    if ((await stat(path)).isDirectory()) return;
  } catch {
    /* fall through */
  }
  throw new UsageError(`${label} directory does not exist or is not a directory: ${path}`);
}

/** Run `task` over `items` with bounded parallelism, preserving input order in the result. */
async function mapPool<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++;
      results[i] = await task(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Run the whole comparison.
 * `onOutcome` is invoked as each pair completes (used to write report assets);
 * the heavy per-pair artifacts are released afterwards to bound memory.
 */
export async function runComparison(
  config: UiDiffConfig,
  onOutcome?: (outcome: PairOutcome) => Promise<void>,
): Promise<RunOutput> {
  await requireDirectory(config.baseline, 'Baseline');
  await requireDirectory(config.current, 'Current');

  const { pairs, missing, added } = await pairImages(config.baseline, config.current);

  const finish = async (outcome: PairOutcome): Promise<PairOutcome> => {
    if (onOutcome) await onOutcome(outcome);
    outcome.artifacts = undefined;
    return outcome;
  };

  const compared = await mapPool(pairs, config.concurrency, async (p) =>
    finish(await comparePair(p.baseline, p.current, config.comparison)),
  );

  const missingOutcomes: PairOutcome[] = [];
  for (const m of missing) {
    const message = `"${m.rel}" exists in baseline but not in current`;
    missingOutcomes.push(
      await finish(
        config.failOnMissing
          ? { result: { name: m.rel, status: 'FAIL', reasons: ['MISSING_IN_CURRENT'], warnings: [], error: message }, baselineFile: m.abs }
          : { result: { name: m.rel, status: 'MISSING', reasons: [], warnings: [{ code: 'MISSING_IN_CURRENT', message }] }, baselineFile: m.abs },
      ),
    );
  }

  const newOutcomes: PairOutcome[] = [];
  for (const a of added) {
    newOutcomes.push(
      await finish({
        result: {
          name: a.rel,
          status: 'NEW',
          reasons: [],
          warnings: [{ code: 'NEW_IN_CURRENT', message: `"${a.rel}" exists in current but not in baseline` }],
        },
        currentFile: a.abs,
      }),
    );
  }

  const outcomes = [...compared, ...missingOutcomes, ...newOutcomes].sort((x, y) =>
    x.result.name < y.result.name ? -1 : x.result.name > y.result.name ? 1 : 0,
  );

  const runWarnings: string[] = [];
  if (outcomes.length === 0) runWarnings.push('EMPTY_INPUT: no images found to compare');

  const summary = summarise(outcomes);
  const failed = summary.failed > 0 || (outcomes.length === 0 && !config.allowEmpty);
  return { outcomes, summary, runWarnings, exitCode: failed ? 1 : 0 };
}
