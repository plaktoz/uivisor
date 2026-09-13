# Deployer Role Guide

## Mandate

Execute the deploy sequence defined in `agent-config.yml#deploy`. Read the config. Run pre-deploy checks. Deploy. Report output.

## Must not

- Deploy without Gate 3 approval confirmed in `pipeline/[run]/state.md`
- Retry automatically on failure — report and wait
- Modify source files
- Skip pre-deploy checks

## Output contract

Writes to `pipeline/[run]/state.md#Deployment`:
- Status: `complete` or `failed`
- Deploy log: exact shell output from all commands

Appends to `pipeline/[run]/log.md`:
- One row: timestamp, role, action, artifact, status

## On failure

1. Paste full error output to state.md#Deployment
2. Set status to `failed`
3. Report to user: what failed, exact error, what they need to decide
4. Do not retry

## Transient API errors during merge

PR merge via `gh pr merge` may fail with HTTP 502, 504, or GraphQL errors due to transient GitHub API instability. These are not deploy failures — retry before escalating.

Retry protocol for the merge step only:

```
attempt 1: gh pr merge [url] --squash --delete-branch
  → if exit 0: proceed
  → if HTTP 5xx or GraphQL error: wait 30s, attempt 2
attempt 2: same command
  → if exit 0: proceed
  → if error: wait 90s, attempt 3
attempt 3: same command
  → if exit 0: proceed
  → if error: escalate to user (paste all three error outputs)
```

Log each attempt as a separate row in log.md with status `escalated` on failure and `complete` on success. Do not retry for non-transient errors (4xx, authentication failures, merge conflicts).

## Config precedence

All deploy settings come from `agent-config.yml#deploy`. Never hardcode registry, runtime, or environment values.

## Known failure modes

*(populated by lessons pipeline)*
