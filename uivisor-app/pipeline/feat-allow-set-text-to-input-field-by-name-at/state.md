# Pipeline State: feat-allow-set-text-to-input-field-by-name-at

**Task:** allow set text to input field by name attribute. allow tapOn button by text
**Started:** 2026-08-18
**Status:** in_progress

---

## Gate 0: Execution Plan

**Classification:** feature

**Roles Activated:** Analyst, Architect, Tester, Coder, Deployer

**Designer Activated:** no

**Execution Sequence:**

1. Analyst → skill: to-spec
   Output: spec + acceptance criteria → state.md#gate-1
   [GATE 1: human approval required]
2. Architect → skill: to-tickets + codebase-design
   Reads: Gate 1 spec
   Output: feature/task breakdown table → state.md#feature-task-breakdown
3. Tester Phase 1 → skill: tdd
   Reads: spec + acceptance criteria
   Output: unit tests + integration tests → state.md#tests
4. Coder → skill: implement
   Reads: spec + tests from state.md
   Output: source files → state.md#code-artifacts
   Parallel execution: true
5. Tester Phase 2 → skill: tdd + code-review
   Reads: state.md#tests + all source files
   Output: test results → state.md#test-results
   Max retries: 3
   [GATE 3: human approval required before deploying]
6. Deployer → skill: proj-deploy

**Gate 0 Status:** awaiting approval

---

## Background: Codebase Context

### Selector type union (src/types.ts)
Currently supports: `string | {text} | {role,name} | {label} | {placeholder} | {testId}`

### Selector resolution (src/matcher/index.ts)
- `string` → `page.getByText()`
- `{text}` → `page.getByText()`
- `{role, name}` → `page.getByRole(role, {name})`
- `{label}` → `page.getByLabel()`
- `{placeholder}` → `page.getByPlaceholder()`
- `{testId}` → `page.getByTestId()`

### Selector parsing (src/parser/selectorParser.ts)
Checks for known keys in object: `text`, `role+name`, `label`, `placeholder`, `testId`. Unknown key → throws.

### Files to change
| File | Change |
|---|---|
| `src/types.ts` | Add `\| { name: string }` and `\| { button: string }` to Selector union |
| `src/parser/selectorParser.ts` | Handle `'name' in obj` → `{ name }` and `'button' in obj` → `{ button }` |
| `src/matcher/index.ts` | Resolve `{name}` via `page.locator('[name="…"]')` and `{button}` via `page.getByRole('button', {name})` |
| `tests/unit/matcher.test.ts` | New test cases for both selector types |
| `tests/unit/parser.test.ts` | New parse test cases for both selector types |
| `tests/integration/commands.test.ts` | Integration tests for inputText with `{name}` and tapOn with `{button}` |
| `tests/fixtures/test-page.html` | Add `name="…"` attributes to inputs and a plain `<button>` element |
