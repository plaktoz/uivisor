import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ComparisonOptions, RunOutput } from '../types.js';

export const JSON_REPORT_VERSION = 1;
export const JSON_REPORT_FILE = 'diff-results.json';

export function buildJson(output: RunOutput, options: ComparisonOptions, now: Date = new Date()): object {
  return {
    version: JSON_REPORT_VERSION,
    timestamp: now.toISOString(),
    config: {
      varianceThreshold: options.varianceThreshold,
      maxDriftPixels: options.maxDriftPixels,
      percentile: options.percentile,
    },
    summary: output.summary,
    warnings: output.runWarnings,
    images: output.outcomes.map(({ result: r }) => ({
      name: r.name,
      status: r.status,
      reasons: r.reasons,
      variance: r.variance,
      drift: r.drift,
      driftAxis: r.driftAxis,
      warnings: r.warnings,
      error: r.error,
      assets: r.assets,
    })),
  };
}

export async function writeJson(outDir: string, output: RunOutput, options: ComparisonOptions): Promise<string> {
  await mkdir(outDir, { recursive: true });
  const file = join(outDir, JSON_REPORT_FILE);
  await writeFile(file, JSON.stringify(buildJson(output, options), null, 2) + '\n', 'utf8');
  return file;
}
