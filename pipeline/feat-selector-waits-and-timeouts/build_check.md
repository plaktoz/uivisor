# Build Check: feat-selector-waits-and-timeouts

**Verdict:** PASS
**Timestamp:** 2026-10-14T05:30
**Run by:** Orchestrator (commands only; no code changes). HEAD `504af05`.

## Dependency check
Manifests: root `package.json` (workspaces), `packages/core/package.json`, `uivisor-app/package.json`, `recorder-app/package.json`, `test-app/package.json`. No manifest or lockfile changed in `edc5701..HEAD`.

New non-relative imports in the diff, all already declared or built in:

| Import | Count | Source |
|---|---|---|
| `@uivisor/core` | 17 | workspace dependency of uivisor-app |
| `playwright` | 2 | existing dependency |
| `vitest` | 7 | existing dev dependency |
| `react`, `react-router-dom` | 1 each | existing test-app dependencies |
| `fs`, `os`, `path`, `http` | 8 | Node built-ins |

MISSING: none.

## Install check
`npm install --dry-run --no-audit --no-fund`: completed; only `allow-scripts` warnings (pre-existing npm policy notice), no resolution errors.

## Smoke tests
| Entry | Check | Result |
|---|---|---|
| `packages/core/dist/index.js` | import; exports `COMMAND_TRAITS`, `createDeadline`, `DEFAULT_TIMEOUTS`, `resolveLocator` | PASS |
| `uivisor-app/dist/cli/index.js --help` | usage line includes `[--timeout <ms>] [--navigation-timeout <ms>]` | PASS |
| `uivisor-app/dist/cli/index.js test /dev/null --timeout abc` | prints `Error: --timeout must be a positive integer, got "abc"`, exit 1 | PASS |

## Lint
`deploy.pre_deploy_checks` includes `lint`. Type checks as the syntax/lint gate: `packages/core` `tsc --noEmit` clean; `uivisor-app` `tsc --noEmit` clean; `recorder-app` `tsc --noEmit` has only the pre-existing `src/cli.test.ts(141,7)` error (see Baseline Addendum). `test-app` `vite build` succeeded (T3 verification).

## Blocking findings
none
