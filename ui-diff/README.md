# @uivisor/ui-diff

CLI tool that compares a **baseline** image directory (the approved design) with a **current** directory (post-upgrade screenshots) and catches structural/layout breakage while tolerating content changes (different text, row counts, colour-only tweaks).

## Install

Inside the uivisor monorepo the package is linked automatically as a workspace member.
For standalone use, install from the registry once published:

```bash
npm install @uivisor/ui-diff
```

## Quick start

```bash
# Pass/fail comparison with default thresholds
ui-diff --baseline ./screenshots/baseline --current ./screenshots/current

# Custom thresholds and output directory
ui-diff -b ./baseline -c ./current --variance 0.05 --max-drift 8 --output ./diff-report

# JSON output only (no console table, no HTML)
ui-diff -b ./baseline -c ./current --format json
```

Exit codes: **0** = all pass · **1** = ≥1 failure or empty input · **2** = usage error.

## How it works

For each pair of images (matched by path stem, case-sensitive):

1. **Normalise** — decode to greyscale, resize current to baseline dimensions.
2. **Edge extraction** — Gaussian blur (`blurRadius`) to suppress text, then a Sobel filter thresholded at `edgeThreshold`. Only high-contrast structural elements (borders, outlines, dividers) survive.
3. **Shift tolerance** — edges within `maxDriftPixels` of a counterpart are snapped together so that minor sub-pixel shifts score zero dissimilarity.
4. **Structural dissimilarity D_s** — block SSIM on the matched edge maps; P95 over non-empty blocks.
5. **Alignment drift D_a** — largest band-centroid/extent shift across 16 px-thick horizontal and vertical bands.
6. **Decision** — PASS iff `D_s ≤ varianceThreshold` AND `D_a ≤ maxDriftPixels`.

## CLI options

| Flag | Short | Default | Description |
|---|---|---|---|
| `--baseline` | `-b` | *(required)* | Baseline directory |
| `--current` | `-c` | *(required)* | Current directory |
| `--output` | `-o` | `./ui-diff-report` | Output directory (overwritten per run) |
| `--variance` | | `0.05` | Max D_s (0–1) |
| `--max-drift` | `-d` | `8` | Max D_a in pixels |
| `--percentile` | | `95` | Percentile used for D_s |
| `--grid-size` | | `16` | Block/band size in px |
| `--blur-radius` | | `2` | Gaussian blur radius (px) |
| `--edge-threshold` | | `0.2` | Sobel magnitude threshold (0–1) |
| `--concurrency` | | `2` | Image pairs compared in parallel |
| `--format` | `-f` | `console,html` | Output formats: `console`, `json`, `html` (comma-separated) |
| `--config` | | | Path to `ui-diff.config.json` |
| `--no-fail-on-missing` | | off | Treat baseline-only images as a warning, not a failure |
| `--allow-empty` | | off | Exit 0 when no images are found |

## Config file

Options can be stored in `ui-diff.config.json`. CLI flags override the file; the file overrides defaults.

```json
{
  "baseline": "./screenshots/baseline",
  "current": "./screenshots/current",
  "output": "./diff-report",
  "comparison": {
    "varianceThreshold": 0.05,
    "maxDriftPixels": 8,
    "edgeThreshold": 0.2,
    "blurRadius": 2
  },
  "reporters": ["console", "html"],
  "failOnMissing": true,
  "allowEmpty": false,
  "concurrency": 2
}
```

## Tuning guide

**`edgeThreshold`** (default `0.2`) is the main knob. Lowering it catches more low-contrast borders but also lets text character edges into the map — text-only changes will then fail.

| Scenario | Suggestion |
|---|---|
| Pages with only thin borders and no bold headings | Try `0.05–0.1`, then check with a text-change pair. |
| Pages with bold headings (like a login/hero page) | Heading rewrites can fail at any setting tried (0.02–0.2, blur 2–8). |
| Very low-contrast UI (dark-on-dark) | Lower `edgeThreshold`; verify the result on your own pairs. |

**`maxDriftPixels`** (default `8`) controls the shift tolerance zone. Both D_s and D_a are measured on tolerance-matched maps, so a shift of exactly `maxDriftPixels` scores zero. Set it to a few pixels less than the largest tolerable real shift to leave headroom.

## Outputs

| File | Description |
|---|---|
| `diff-results.json` | Machine-readable run summary |
| `index.html` | Visual report with before/after slider and diff overlay |
| `assets/<kind>/<name>.png` | Per-pair image artefacts (baseline, current, edges, diff) |

## Status codes

| Status | Meaning |
|---|---|
| `PASS` | D_s and D_a within thresholds |
| `FAIL` | One or more failure reasons |
| `NEW` | Image exists in current only (warning) |
| `MISSING` | Image exists in baseline only and `--no-fail-on-missing` is set (warning) |

Failure reasons: `STRUCTURAL_VARIANCE`, `ALIGNMENT_DRIFT`, `MISSING_IN_CURRENT`, `INVALID_IMAGE`.

## Programmatic API

```ts
import { resolveConfig, runComparison } from '@uivisor/ui-diff';

// resolveConfig merges defaults, ui-diff.config.json and the overrides, and validates them.
const config = resolveConfig({ baseline: './baseline', current: './current', maxDrift: 8 }, process.cwd());
const { outcomes, summary, runWarnings, exitCode } = await runComparison(config);
```

`resolveConfig` throws `UsageError` for invalid input. `runComparison` does not write reports; the CLI does that.

## Known trade-offs

- **At `edgeThreshold` 0.2** the edge map on the uivisor test-app contains only bold headings and thick button outlines. Faint input borders and card outlines drop out, so sparse pages are barely checked (e.g. `integration-sessions` kept ~115 edge pixels, the task list ~1.6k). In the six-page trial, a spacing/padding regression failed on the login and profile pages, a 6 × 4 px nudge and colour-only changes passed, and a text rewrite failed on the login page. Pages with little high-contrast structure may pass regressions they should catch; calibrate on your own screenshots.
- **Text changes on pages with a bold heading can fail** because the glyph edges differ (known limitation; no threshold/blur setting tried fixed it). Treat a failure on such a page as "check manually".
- **Drift is measured on matched maps.** A shift exactly at the `maxDriftPixels` boundary scores zero on both D_s and D_a. Lower `maxDriftPixels` slightly below your true tolerable limit if the boundary matters.
- **Same viewport required.** Baseline and current must be captured at the same dimensions and device pixel ratio.
