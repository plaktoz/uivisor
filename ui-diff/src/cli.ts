#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command, CommanderError } from 'commander';
import { UsageError, resolveConfig, type CliOverrides } from './config.js';
import { runComparison } from './compare.js';
import { writeAssets } from './reporters/assets.js';
import { renderConsole } from './reporters/console.js';
import { writeHtml } from './reporters/html.js';
import { writeJson } from './reporters/json.js';

function getVersion(): string {
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '../package.json');
    return (JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string }).version;
  } catch {
    return '0.0.0';
  }
}

function num(name: string, value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (value.trim() === '' || !Number.isFinite(n)) {
    throw new UsageError(`Invalid value for ${name}: expected a number, got "${value}"`);
  }
  return n;
}

interface RawOptions {
  baseline?: string;
  current?: string;
  output?: string;
  variance?: string;
  maxDrift?: string;
  percentile?: string;
  gridSize?: string;
  blurRadius?: string;
  edgeThreshold?: string;
  config?: string;
  format?: string;
  /** Set to false by commander when --no-fail-on-missing is passed. */
  failOnMissing?: boolean;
  allowEmpty?: boolean;
  concurrency?: string;
}

function buildProgram(): Command {
  return new Command()
    .name('ui-diff')
    .description('Structural image directory comparison for post-upgrade UI verification')
    .version(getVersion())
    .option('-b, --baseline <dir>', 'Baseline (approved) images directory')
    .option('-c, --current <dir>', 'Current (post-change) images directory')
    .option('-o, --output <dir>', 'Output directory for reports (default: ./ui-diff-report)')
    .option('--variance <number>', 'Maximum acceptable structural dissimilarity D_s, 0..1 (default: 0.05)')
    .option('-d, --max-drift <number>', 'Maximum acceptable alignment drift in pixels (default: 8)')
    .option('--percentile <number>', 'Percentile (1-100) of block dissimilarity used for D_s (default: 95)')
    .option('--grid-size <number>', 'Block/band size in px (default: 16)')
    .option('--blur-radius <number>', 'Gaussian blur radius in px applied before edge extraction (default: 2)')
    .option('--edge-threshold <number>', 'Normalised gradient magnitude threshold, 0..1 (default: 0.2)')
    .option('--config <file>', 'Optional JSON configuration file (default: ui-diff.config.json)')
    .option('-f, --format <reporters>', 'Comma-separated reporters: console, html, json (default: console,html)')
    .option('--no-fail-on-missing', 'Downgrade MISSING_IN_CURRENT from failure to warning')
    .option('--allow-empty', 'Do not fail when no images are found to compare')
    .option('--concurrency <number>', 'Number of image pairs compared in parallel (default: 2)')
    .exitOverride();
}

async function main(argv: string[]): Promise<number> {
  const program = buildProgram();
  try {
    program.parse(argv);
  } catch (err) {
    if (err instanceof CommanderError) {
      // --help and --version are not errors.
      if (err.code === 'commander.helpDisplayed' || err.code === 'commander.version') return 0;
      // commander has already printed its message to stderr.
      return 2;
    }
    throw err;
  }
  const o = program.opts<RawOptions>();

  const overrides: CliOverrides = {
    baseline: o.baseline,
    current: o.current,
    output: o.output,
    variance: num('--variance', o.variance),
    maxDrift: num('--max-drift', o.maxDrift),
    percentile: num('--percentile', o.percentile),
    gridSize: num('--grid-size', o.gridSize),
    blurRadius: num('--blur-radius', o.blurRadius),
    edgeThreshold: num('--edge-threshold', o.edgeThreshold),
    config: o.config,
    format: o.format,
    failOnMissing: o.failOnMissing === false ? false : undefined,
    allowEmpty: o.allowEmpty === true ? true : undefined,
    concurrency: num('--concurrency', o.concurrency),
  };

  const config = resolveConfig(overrides, process.cwd());
  const wantHtml = config.reporters.includes('html');

  // Assets are written as each pair completes; the heavy artifacts are released right after.
  const output = await runComparison(config, async (outcome) => {
    if (wantHtml) await writeAssets(config.output, outcome, config.comparison);
  });

  if (config.reporters.includes('console')) process.stdout.write(renderConsole(output) + '\n');
  if (config.reporters.includes('json')) await writeJson(config.output, output, config.comparison);
  if (wantHtml) await writeHtml(config.output, output);

  return output.exitCode;
}

main(process.argv).then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    if (err instanceof UsageError) {
      process.stderr.write(`Error: ${err.message}\n\nRun \`ui-diff --help\` for usage.\n`);
      process.exitCode = 2;
      return;
    }
    process.stderr.write('Error: unexpected failure\n');
    if (process.env['DEBUG']) process.stderr.write(`${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
    process.exitCode = 1;
  },
);
