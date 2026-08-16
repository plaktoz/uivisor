#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from './args.js';
import { resolveTarget } from './resolver.js';
import { runAll } from './runner.js';
import { generateHtmlReport } from '../reporter/html.js';
import { generateMarkdownReport } from '../reporter/markdown.js';

function makeRunDir(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    String(now.getFullYear()) +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    '-' +
    pad(now.getHours()) +
    pad(now.getMinutes());
  const dir = path.join('target', stamp);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv);
  const { target, headed, slowMo, reporter } = parsed;
  const runDir = makeRunDir();
  const options = { headed, slowMo, reporter, runDir };

  let targets: string[];
  try {
    targets = resolveTarget(target);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stdout.write(`Error: ${msg}\n`);
    process.exit(1);
  }

  const result = await runAll(targets, options);

  if (reporter === 'html') {
    const html = generateHtmlReport(result);
    fs.writeFileSync(path.join(runDir, 'webt-report.html'), html, 'utf8');
    process.stdout.write(`Report: ${path.join(runDir, 'webt-report.html')}\n`);
  } else if (reporter === 'md') {
    const md = generateMarkdownReport(result);
    fs.writeFileSync(path.join(runDir, 'webt-report.md'), md, 'utf8');
    process.stdout.write(`Report: ${path.join(runDir, 'webt-report.md')}\n`);
  }

  process.exit(result.failedFlows > 0 ? 1 : 0);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Fatal error: ${msg}\n`);
  process.exit(1);
});
