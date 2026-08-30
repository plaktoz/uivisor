#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from './args.js';
import { resolveTarget } from './resolver.js';
import { runAll } from './runner.js';
import { loadAndParse } from '../parser/index.js';
import { filterFlows, isSingleSharedFlowTarget } from './filter.js';
import { generateHtmlReport } from '../reporter/html.js';
import { generateMarkdownReport } from '../reporter/markdown.js';

function makeRunDir(outputDir?: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    String(now.getFullYear()) +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    '-' +
    pad(now.getHours()) +
    pad(now.getMinutes());
  const base = path.resolve(outputDir ?? 'target');
  const dir = path.join(base, stamp);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv);
  const { target, headed, slowMo, reporter, tags, outputDir } = parsed;
  const runDir = makeRunDir(outputDir);
  const options = { headed, slowMo, reporter, runDir, tags };

  let rawTargets: string[];
  try {
    rawTargets = resolveTarget(target);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stdout.write(`Error: ${msg}\n`);
    process.exit(1);
  }

  // Load flow metadata for filtering (tags + shared); parse errors exit here
  const flows = rawTargets.map((p) => {
    try {
      return loadAndParse(p);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write(`Error: ${msg}\n`);
      process.exit(1);
    }
  });

  // Guard: single shared flow passed directly as target
  if (rawTargets.length === 1 && isSingleSharedFlowTarget(flows[0]!)) {
    process.stdout.write(`Cannot run shared flow directly: ${target}\n`);
    process.exit(1);
  }

  const { included } = filterFlows(flows, tags);

  if (included.length === 0) {
    if (tags.length > 0) {
      process.stdout.write(`No flows matched tag(s): ${tags.join(', ')}\n`);
    } else {
      process.stdout.write(`No runnable flows found in: ${target}\n`);
    }
    process.exit(1);
  }

  const result = await runAll(included, options);

  if (reporter === 'html') {
    const html = generateHtmlReport(result);
    fs.writeFileSync(path.join(runDir, 'uivisor-report.html'), html, 'utf8');
    process.stdout.write(`Report: ${path.join(runDir, 'uivisor-report.html')}\n`);
  } else if (reporter === 'md') {
    const md = generateMarkdownReport(result);
    fs.writeFileSync(path.join(runDir, 'uivisor-report.md'), md, 'utf8');
    process.stdout.write(`Report: ${path.join(runDir, 'uivisor-report.md')}\n`);
  }

  process.exit(result.failedFlows > 0 ? 1 : 0);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Fatal error: ${msg}\n`);
  process.exit(1);
});
