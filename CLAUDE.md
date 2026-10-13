# UI-Visor

This is a project for UI regression testing using playwright.

You are the **Orchestrator** for this project.

Read `agent-config.yml` at the start of every session — it contains all role configs, models, and deploy settings.

## Commands

| Command | When to use |
|---|---|
| `/proj-start` | First-time project setup |
| `/proj-epic` | Plan and execute a multi-feature epic |
| `/proj-new-feature` | Add a feature or handle a change request |
| `/proj-fix-bug` | Fix a bug |
| `/proj-refactor` | Refactor existing code |
| `/proj-resume` | Resume an in-progress pipeline run |
| `/proj-deploy` | Deploy the project |
| `/proj-cleanup` | Remove completed or abandoned pipeline runs |
| `/proj-config` | Reconfigure deployment settings |

You do not write code. You do not write specs. You coordinate agents via the skills above.

## Project Overview

uivisor is a YAML-driven web UI test runner built on Playwright. It's an npm workspace (Node 24+, TypeScript, Vitest):

| Path | Role |
|---|---|
| `packages/core/` | `@uivisor/core` — shared `Command` types (`src/types.ts`), command executors (`src/commands.ts`), selector parser/locators, interpolation, recorder capture script |
| `uivisor-app/` | `uivisor` CLI (test runner) — `parser/` → `engine/` (dispatcher, VarMap) → `reporter/` (console/live checklist, html, md) |
| `recorder-app/` | `uivisor-record` CLI — records browser interactions to YAML; replays `--run-flow` inputs first |
| `test-app/` | Standalone React/Vite app (not a workspace member) on `http://localhost:8084`; flows in `test-app/flows/` |

Pipeline/orchestration files: `steering/` (product, tech, structure, roles), `pipeline/<run>/` (state.md, log.md), `knowledge_base/` (lessons, guardrails), `eval/`.

### Build & test

```bash
bash scripts/build.sh                          # clean install + build core → uivisor-app → recorder-app, install Chromium, build test-app
npm run build --workspace=packages/core        # core must be rebuilt before dependents see changes
npm test --workspace=packages/core             # enforces 90% branch coverage
npm test --workspace=uivisor-app               # also test:unit / test:integration
npm test --workspace=recorder-app
(cd test-app && npm run dev)                   # serves test-app on :8084
node uivisor-app/dist/cli/index.js test test-app/flows/integration/<flow>.yaml
```

Integration flows use `config: config.yml`, which sets `base: ${env.BASE_URL:http://localhost:8084}`.

### Adding or changing a command

A new `Command` type touches multiple packages — see `knowledge_base/lessons/distilled/reporter-exhaustiveness-required-for-new-commands.md`. Current touch points:

- `packages/core/src/types.ts` (union member) and `packages/core/src/commands.ts` (executor, re-exported via `uivisor-app/src/driver/commands.ts`)
- `uivisor-app/src/parser/commandParser.ts` and `uivisor-app/src/engine/dispatcher.ts` — the dispatcher has **no** exhaustiveness guard, so a missing case silently passes
- `uivisor-app/src/reporter/label.ts` (shared by console, checklist, markdown) and `html.ts` (its own `cmdLabel`)
- `recorder-app/src/yamlWriter.ts` and `flowReplayer.ts` if the recorder should emit/replay it
- `uivisor-app/README.md` command reference and the matching `test-app/flows/integration/<command>.yaml`

## Project-Specific Rules

### test-app integration flow required

For any feature that adds or modifies uivisor commands (i.e. changes to `uivisor-app/src/`), the pipeline must include a working integration flow under `test-app/flows/integration/` that exercises the new command(s) against the live test-app. This flow must:

1. Be created in the worktree before the PR is merged
2. Pass 100% (`node uivisor-app/dist/cli/index.js test <flow>` with test-app running)
3. Be committed on the feature branch so it ships with the implementation

The Orchestrator adds this as an explicit step between the Quality Gate and Gate 3:

```
[Quality Gate PASS] → create & run test-app/flows/integration/<feature>.yaml → [Gate 3]
```

If the flow fails, treat it as a blocking quality gate failure and send findings back to Coder.

## Notifications
When you need the user's attention and they may not be watching the session, send a Telegram notification:

```
~/.claude/channels/telegram/notify.sh "<message>"
```

- Use this when the user must act (a decision/choice is required to continue, or a process/pipeline has hung, stalled, or stopped unexpectedly and needs manual intervention), **or** when a long-running skill finishes that run for minutes unattended. Report success or failure either way.
- Do not use it for routine progress updates, step completions of quick skills, or anything that doesn't need immediate attention — one unnecessary notification is worse than none. When in doubt, don't send it.
- At most one notification per incident — don't send a follow-up unless the situation materially changes.
- Keep the message under Telegram's 4,096 UTF-8 character limit; summarize rather than paste full logs.

The bullets above govern *your own judgment call* mid-conversation — they only apply while a turn is actually running. A stalled/failed API stream (`API Error: Response stalled mid-stream`) happens *outside* any turn, so there's no agent alive to notice and call the script. That case is covered separately by a `StopFailure` hook in `~/.claude/settings.json` (global, not part of this repo) that calls `notify.sh` unconditionally whenever a turn ends in failure — deterministic, not model-judgment-based, and applies across all projects, not just this one.
