import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { ComparisonOptions, ReporterName, UiDiffConfig } from './types.js';

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

export const DEFAULT_CONFIG_FILE = 'ui-diff.config.json';

export const DEFAULT_COMPARISON: ComparisonOptions = {
  varianceThreshold: 0.05,
  maxDriftPixels: 8,
  percentile: 95,
  gridSize: 16,
  blurRadius: 2,
  edgeThreshold: 0.2,
};

const DEFAULTS = {
  output: './ui-diff-report',
  reporters: ['console', 'html'] as ReporterName[],
  failOnMissing: true,
  allowEmpty: false,
  concurrency: 2,
};

const REPORTERS: readonly ReporterName[] = ['console', 'html', 'json'];

/** Values given on the command line. `undefined` means "not provided". */
export interface CliOverrides {
  baseline?: string;
  current?: string;
  output?: string;
  variance?: number;
  maxDrift?: number;
  percentile?: number;
  gridSize?: number;
  blurRadius?: number;
  edgeThreshold?: number;
  config?: string;
  format?: string;
  failOnMissing?: boolean;
  allowEmpty?: boolean;
  concurrency?: number;
}

interface FileConfig {
  baseline?: string;
  current?: string;
  output?: string;
  comparison?: Partial<ComparisonOptions>;
  reporters?: ReporterName[];
  failOnMissing?: boolean;
  allowEmpty?: boolean;
  concurrency?: number;
}

const TOP_LEVEL_KEYS = [
  'baseline',
  'current',
  'output',
  'comparison',
  'reporters',
  'failOnMissing',
  'allowEmpty',
  'concurrency',
];
const COMPARISON_KEYS = Object.keys(DEFAULT_COMPARISON);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireNumber(
  name: string,
  value: unknown,
  check: (n: number) => boolean,
  expected: string,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || !check(value)) {
    throw new UsageError(`Invalid value for ${name}: expected ${expected}`);
  }
  return value;
}

function requireString(name: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new UsageError(`Invalid value for ${name}: expected a non-empty string`);
  }
  return value;
}

function requireBoolean(name: string, value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new UsageError(`Invalid value for ${name}: expected true or false`);
  }
  return value;
}

export function parseReporters(raw: string | string[]): ReporterName[] {
  const tokens = Array.isArray(raw) ? raw : raw.split(',').map((t) => t.trim());
  if (tokens.length === 0 || tokens.some((t) => t === '')) {
    throw new UsageError('Invalid value for --format: expected a comma-separated list of console, html, json');
  }
  const out: ReporterName[] = [];
  for (const t of tokens) {
    if (!REPORTERS.includes(t as ReporterName)) {
      throw new UsageError(`Invalid value for --format: unknown reporter "${t}" (expected console, html, json)`);
    }
    if (!out.includes(t as ReporterName)) out.push(t as ReporterName);
  }
  return out;
}

function loadFileConfig(path: string): FileConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new UsageError(`Cannot read config file as JSON: ${path}`);
  }
  if (!isRecord(parsed)) {
    throw new UsageError(`Invalid config file ${path}: expected a JSON object`);
  }
  for (const key of Object.keys(parsed)) {
    if (!TOP_LEVEL_KEYS.includes(key)) {
      throw new UsageError(`Invalid config file ${path}: unknown key "${key}"`);
    }
  }
  if (parsed.comparison !== undefined) {
    if (!isRecord(parsed.comparison)) {
      throw new UsageError(`Invalid config file ${path}: "comparison" must be an object`);
    }
    for (const key of Object.keys(parsed.comparison)) {
      if (!COMPARISON_KEYS.includes(key)) {
        throw new UsageError(`Invalid config file ${path}: unknown key "comparison.${key}"`);
      }
    }
  }
  return parsed as FileConfig;
}

function validateComparison(c: ComparisonOptions): ComparisonOptions {
  return {
    varianceThreshold: requireNumber('--variance', c.varianceThreshold, (n) => n >= 0 && n <= 1, 'a number between 0 and 1'),
    maxDriftPixels: requireNumber('--max-drift', c.maxDriftPixels, (n) => n >= 0, 'a number >= 0'),
    percentile: requireNumber('--percentile', c.percentile, (n) => n >= 1 && n <= 100, 'a number between 1 and 100'),
    gridSize: requireNumber('--grid-size', c.gridSize, (n) => Number.isInteger(n) && n >= 4, 'an integer >= 4'),
    blurRadius: requireNumber('--blur-radius', c.blurRadius, (n) => n >= 0, 'a number >= 0'),
    edgeThreshold: requireNumber('--edge-threshold', c.edgeThreshold, (n) => n > 0 && n <= 1, 'a number greater than 0 and at most 1'),
  };
}

/**
 * Merge defaults, config file and CLI flags (CLI > file > defaults) and validate.
 * Paths from the CLI resolve against `cwd`; paths from the config file resolve
 * against the config file's directory.
 */
export function resolveConfig(cli: CliOverrides, cwd: string): UiDiffConfig {
  const explicitConfig = cli.config !== undefined;
  const configPath = resolve(cwd, cli.config ?? DEFAULT_CONFIG_FILE);

  let file: FileConfig = {};
  let fileDir = cwd;
  if (existsSync(configPath)) {
    file = loadFileConfig(configPath);
    fileDir = dirname(configPath);
  } else if (explicitConfig) {
    throw new UsageError(`Config file not found: ${configPath}`);
  }

  const pick = <T>(cliValue: T | undefined, fileValue: T | undefined, fallback: T): T =>
    cliValue ?? fileValue ?? fallback;

  const baselineRaw = cli.baseline !== undefined ? resolve(cwd, cli.baseline)
    : file.baseline !== undefined ? resolve(fileDir, requireString('baseline', file.baseline))
    : undefined;
  const currentRaw = cli.current !== undefined ? resolve(cwd, cli.current)
    : file.current !== undefined ? resolve(fileDir, requireString('current', file.current))
    : undefined;
  if (baselineRaw === undefined) throw new UsageError('Missing required option: --baseline <dir>');
  if (currentRaw === undefined) throw new UsageError('Missing required option: --current <dir>');

  const output = cli.output !== undefined ? resolve(cwd, cli.output)
    : file.output !== undefined ? resolve(fileDir, requireString('output', file.output))
    : resolve(cwd, DEFAULTS.output);

  const fc = file.comparison ?? {};
  const comparison = validateComparison({
    varianceThreshold: pick(cli.variance, fc.varianceThreshold, DEFAULT_COMPARISON.varianceThreshold),
    maxDriftPixels: pick(cli.maxDrift, fc.maxDriftPixels, DEFAULT_COMPARISON.maxDriftPixels),
    percentile: pick(cli.percentile, fc.percentile, DEFAULT_COMPARISON.percentile),
    gridSize: pick(cli.gridSize, fc.gridSize, DEFAULT_COMPARISON.gridSize),
    blurRadius: pick(cli.blurRadius, fc.blurRadius, DEFAULT_COMPARISON.blurRadius),
    edgeThreshold: pick(cli.edgeThreshold, fc.edgeThreshold, DEFAULT_COMPARISON.edgeThreshold),
  });

  let reporters: ReporterName[];
  if (cli.format !== undefined) reporters = parseReporters(cli.format);
  else if (file.reporters !== undefined) {
    if (!Array.isArray(file.reporters)) throw new UsageError('Invalid value for reporters: expected an array');
    reporters = parseReporters(file.reporters);
  } else reporters = DEFAULTS.reporters;

  const failOnMissing = cli.failOnMissing ?? (file.failOnMissing !== undefined ? requireBoolean('failOnMissing', file.failOnMissing) : DEFAULTS.failOnMissing);
  const allowEmpty = cli.allowEmpty ?? (file.allowEmpty !== undefined ? requireBoolean('allowEmpty', file.allowEmpty) : DEFAULTS.allowEmpty);
  const concurrency = requireNumber(
    '--concurrency',
    pick(cli.concurrency, file.concurrency, DEFAULTS.concurrency),
    (n) => Number.isInteger(n) && n >= 1,
    'an integer >= 1',
  );

  return { baseline: baselineRaw, current: currentRaw, output, comparison, reporters, failOnMissing, allowEmpty, concurrency };
}
