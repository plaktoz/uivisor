# Knowledge Base Index

Entry point for all lessons and guardrail candidates. Every file in this KB must be linked from here.

---

## Distilled Lessons

- [Playwright goBack/goForward: null return is ambiguous](lessons/distilled/playwright-goback-null-handling.md) — use URL-before/after + `waitUntil: 'commit'`; don't rely on `response === null` alone
- [Reporter exhaustiveness required for new commands](lessons/distilled/reporter-exhaustiveness-required-for-new-commands.md) — 5 files need updating per new Command type; dispatcher has no TS guard
- [screenshot command sets screenshotPath on success](lessons/distilled/screenshot-command-screenshotpath-on-success.md) — unique exception; requires `capturedScreenshotPath` local before try block

### By role
<!-- role:analyst -->
<!-- role:architect -->
<!-- role:coder -->
<!-- role:tester_ensemble -->
<!-- role:tester_arbiter -->
<!-- role:release_documenter -->
<!-- role:deployer -->

### By failure type
<!-- failure_type:tdd-retry-limit -->
<!-- failure_type:quality-gate-fail -->
<!-- failure_type:coder-max-retries -->
<!-- failure_type:human-escalation -->

---

## Guardrail Candidates

- [guardrails_candidates.md](guardrails_candidates.md)

---

## Raw Events

*(append-only; one file per failure event in `lessons/raw/`)*
