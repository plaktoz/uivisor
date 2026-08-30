# Reporter exhaustiveness must be updated for every new Command type

**Role:** Coder
**Epic:** epic-add-more-ui-test-capability

## Lesson

Adding a new member to the `Command` union in `src/types.ts` requires updating **four** switch statements, not two. The reporters are easy to forget:

| File | Switch | What breaks if missed |
|---|---|---|
| `src/parser/commandParser.ts` | `switch (key)` | Command not parseable |
| `src/engine/dispatcher.ts` | `switch (cmd.type)` | Command silently no-ops |
| `src/reporter/console.ts` | `_cmdSummary switch` | TypeScript exhaustiveness error |
| `src/reporter/html.ts` | `cmdLabel switch` | TypeScript exhaustiveness error |
| `src/reporter/markdown.ts` | `cmdLabel switch` | TypeScript exhaustiveness error |

TypeScript will catch the reporter omissions at compile time (`tsc --noEmit`) because the switches are exhaustive over the `Command` union. But `dispatcher.ts` has no exhaustiveness check — a missing case there silently passes with `{ passed: true }` and no action taken.

## Checklist when adding a command

- [ ] `types.ts` — add union member
- [ ] `commandParser.ts` — add parser case
- [ ] `commands.ts` — add executor function
- [ ] `dispatcher.ts` — add dispatch case (no TS guard — easy to miss)
- [ ] `console.ts`, `html.ts`, `markdown.ts` — add label case (TS will catch omissions)
