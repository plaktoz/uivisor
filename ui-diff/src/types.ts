export type ReporterName = 'console' | 'html' | 'json';

export interface ComparisonOptions {
  /** Maximum acceptable D_s (0..1). */
  varianceThreshold: number;
  /** Maximum acceptable D_a in pixels. */
  maxDriftPixels: number;
  /** Percentile (1..100) of block dissimilarity used for D_s. */
  percentile: number;
  /** Block / band size in px. */
  gridSize: number;
  /** Gaussian blur radius (sigma, px) applied before edge extraction. 0 disables. */
  blurRadius: number;
  /** Normalised gradient magnitude threshold (0..1]. */
  edgeThreshold: number;
}

export interface UiDiffConfig {
  baseline: string;
  current: string;
  output: string;
  comparison: ComparisonOptions;
  reporters: ReporterName[];
  failOnMissing: boolean;
  allowEmpty: boolean;
  concurrency: number;
}

export type ImageStatus = 'PASS' | 'FAIL' | 'NEW' | 'MISSING';

export type FailureReason =
  | 'STRUCTURAL_VARIANCE'
  | 'ALIGNMENT_DRIFT'
  | 'MISSING_IN_CURRENT'
  | 'INVALID_IMAGE';

export type WarningCode =
  | 'DIMENSION_WARNING'
  | 'EXTENSION_MISMATCH'
  | 'MISSING_IN_CURRENT'
  | 'NEW_IN_CURRENT';

export interface Warning {
  code: WarningCode;
  message: string;
}

export type DriftAxis = 'horizontal' | 'vertical';

export interface ImageAssets {
  baseline?: string;
  current?: string;
  edgeMap?: string;
  diff?: string;
}

export interface ImageResult {
  /** Relative path of the image (with extension) */
  name: string;
  status: ImageStatus;
  reasons: FailureReason[];
  variance?: number;
  drift?: number;
  driftAxis?: DriftAxis;
  warnings: Warning[];
  /** Error detail, only for INVALID_IMAGE */
  error?: string;
  assets?: ImageAssets;
}

export interface BlockScore {
  x: number;
  y: number;
  w: number;
  h: number;
  dissimilarity: number;
}

export interface DriftBand {
  axis: DriftAxis;
  x: number;
  y: number;
  w: number;
  h: number;
  drift: number;
  /** True when the band has edge mass in only one of the two images. */
  oneSided: boolean;
}

export interface ComparisonArtifacts {
  width: number;
  height: number;
  baselineEdges: Uint8Array;
  currentEdges: Uint8Array;
  blocks: BlockScore[];
  bands: DriftBand[];
}

/** An ImageResult plus the internal data reporters need to write assets. */
export interface PairOutcome {
  result: ImageResult;
  /** Absolute path of the baseline file, when it exists. */
  baselineFile?: string;
  /** Absolute path of the current file, when it exists. */
  currentFile?: string;
  artifacts?: ComparisonArtifacts;
}

export interface RunSummary {
  total: number;
  passed: number;
  failed: number;
  new: number;
  missing: number;
  errored: number;
}

export interface RunOutput {
  outcomes: PairOutcome[];
  summary: RunSummary;
  /** Run-level warnings, e.g. EMPTY_INPUT. */
  runWarnings: string[];
  exitCode: 0 | 1;
}
