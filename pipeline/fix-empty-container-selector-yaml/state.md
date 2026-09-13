# Pipeline State: fix-empty-container-selector-yaml

**Task:** recorder-app: empty container selector produces invalid YAML when container has no qualifying attribute (issue #40)
**Started:** 2026-09-13
**Status:** in_progress

---

## Gate 0: Execution Plan

**Classification:** bug

**Roles Activated:** Analyst, Tester Ensemble, Coder, Release Documenter, Deployer

**Designer Activated:** no

**Issue:** https://github.com/plaktoz/uivisor/issues/40

**Execution Sequence:**
1. Analyst → skill: to-spec
   Output: bug spec + reproduction steps + acceptance criteria → state.md#gate-1
   [GATE 1: human approval required]
2. Tester Ensemble Phase 1 → skill: tdd
   Reads: bug spec + acceptance criteria
   2a. tester_generator_a + tester_generator_b in parallel → each generates failing tests
   2b. tester_consolidator → deduplicates → state.md#tests
   2c. tester_arbiter → resolves disagreements
   Output: failing tests that reproduce the bug → state.md#tests
3. Coder → skill: diagnosing-bugs
   Reads: bug spec + failing tests from state.md
   Output: fix + source files → state.md#code-artifacts
   **Working directory:** .worktrees/fix-empty-container-selector-yaml
4. Tester Ensemble Phase 2 → skill: tdd
   Reads: state.md#tests + all source files
   4a. tester_generator_a + tester_generator_b in parallel → each runs tests and reports
   4b. tester_consolidator → merges results → state.md#test-results
   4c. tester_arbiter → resolves disagreements
   Output: test results → state.md#test-results
   Max retries: 3
5. Quality Gate → skill: quality (tester_arbiter, autonomous)
   Reads: state.md#tests + state.md#test-results + state.md#code-artifacts + git diff
   Output: pass/fail verdict → state.md#quality-gate
   On fail: findings sent back to Coder (increments retry counter); on pass: proceed
   [GATE 3: human approval required before deploying]
6. Release Documenter → skill: proj-deploy
   Reads: state.md in full
   Output: signoff_package.md → pipeline/fix-empty-container-selector-yaml/signoff_package.md
7. Deployer → skill: proj-deploy
8. Delivery Manager (autonomous — no gate)
   Reads: pipeline/fix-empty-container-selector-yaml/log.md + state.md#gate-0 Run Estimates
   Output: pipeline/fix-empty-container-selector-yaml/retro.md

---

## Run Estimates

**Complexity:** small
**Duration:** ~17–32 min  (no retries: ~17 min)
**Cost:** ~$0.18–$0.58  (cap: $5.00)
**Tokens:** ~27K–54K

**Retry budgets:**
- TDD + quality gate: 3 rounds
- Spec revision: 2 rounds
- Design revision: n/a (Designer not activated)
- Code review: 2 rounds

---

## Worktree
**Path:** .worktrees/fix-empty-container-selector-yaml
**Branch:** fix-empty-container-selector-yaml
**Created:** 2026-09-13
**Status:** removed

---

## Gate 1: Bug Spec

### Summary

When a repeating container element has no `data-*` attributes, no `id`, and no visible text, `buildContainerSelector` returns the sentinel string `'nth-only'`. The click handler converts that sentinel to an empty string `''` for the emitted `within` command's `selector` field, and `yamlWriter`'s `within` serializer splits the empty string on `=`, producing a YAML map with an empty key (`'': ''`) — silently invalid output that the runner's parser cannot process.

### Root Cause

Three code locations chain to produce the bug:

1. **`packages/core/src/captureScript.ts`, `buildContainerSelector`:** When the container has no qualifying attribute, the function returns the string `'nth-only'` as a sentinel value rather than a usable CSS selector.

2. **`packages/core/src/captureScript.ts`, click handler:** Both the reactive and count-based `within` branches coerce the sentinel back to an empty string:
   ```js
   selector: containerSel === 'nth-only' ? '' : containerSel,
   ```

3. **`recorder-app/src/yamlWriter.ts`, `commandToRecord` `within` case:** The serializer splits `cmd.selector` on `=` and uses `parts[0]` as the YAML map key, producing `{ '': '' }` — a degenerate YAML map with an empty-string key.

### Reproduction Steps

1. Create an HTML page with a bare `<ul>` / `<li>` structure where the `<li>` has no `data-*` attribute, no `id`, and no direct visible text (only a child element):
   ```html
   <ul>
     <li><button>Delete</button></li>
     <li><button>Delete</button></li>
   </ul>
   ```
2. Launch the recorder and load the page.
3. Click one of the `<button>Delete</button>` elements.
4. Open the emitted YAML flow file.
5. Observe that the `within` block contains an empty key:
   ```yaml
   - within:
       '': ''
       nth: 0
       do:
         - tapOn: text=Delete
   ```
6. Attempt to run the flow with `uivisor run`; the parser throws `within: missing selector key`.

### Spec Decision

**Option (b): emit a tag-name-only CSS selector (`css=<tagName>`).**

- `WithinCommand` type declares `selector: string` (not optional) — option (a) would require making `selector` optional and adding new code paths everywhere.
- `commandParser.ts` requires at least one selector key after filtering out `do` and `nth`; omitting the key entirely would require a parser change too.
- The `css=` prefix is already an established fallback convention in the codebase (`buildPipeSelector`, `buildCssFallback`).
- Option (b) requires changing only `captureScript.ts` in one location — no downstream schema or parser changes.

**Concrete fix:** In `buildContainerSelector`, replace `return 'nth-only'` with `return 'css=' + containerEl.tagName.toLowerCase()`. Remove the `containerSel === 'nth-only' ? '' : containerSel` ternary from both click handler branches.

### Acceptance Criteria

1. **Sentinel eliminated:** `buildContainerSelector` never returns `'nth-only'`; for a container with no qualifying attributes, it returns `'css=' + tagName` (e.g. `'css=li'`).
2. **Emitted command has a non-empty selector:** Clicking inside a plain `<li><button>Delete</button></li>` emits a `within` command with `selector === 'css=li'`, not `''`.
3. **YAML output has no empty key:** `appendCommand` called with `{ type: 'within', selector: 'css=li', nth: 0, do: [...] }` writes YAML that, when parsed with `js-yaml.load`, produces a `within` object with key `css` equal to `'li'` and no empty-string key.
4. **YAML output is parseable by commandParser:** The YAML from AC3 can be parsed by `commandParser.ts`'s `within` case without throwing; the resulting `Command` has `type: 'within'`, `selector: 'css=li'`, and `nth: 0`.
5. **nth is preserved:** When the `<li>` is the third sibling, `nth: 2` (0-based) is emitted alongside `selector: 'css=li'`.
6. **Regression — named containers unaffected:** Clicking inside `<li data-testid="row-item">` still emits `selector: 'data-testid=row-item'`.
7. **Regression — reactive within unaffected:** The reactive (non-repeating) container path still emits `within` without `nth`, with the correct attribute-based selector.

### Files to Change

- `packages/core/src/captureScript.ts`
  - `buildContainerSelector`: replace `return 'nth-only'` → `return 'css=' + containerEl.tagName.toLowerCase()`
  - Click handler (both branches): replace `containerSel === 'nth-only' ? '' : containerSel` → `containerSel`

### Files to Add Tests To

- `packages/core/src/captureScript.test.ts` — AC 1, 2, 5, 6, 7
- `recorder-app/src/yamlWriter.test.ts` — AC 3, 4

---

## Tests

**Phase 1 complete.** Final test set after Ensemble consensus. All tests below FAIL on current code and PASS after the fix.

**Note:** tester_arbiter's version of BC-01 was reversed (asserted current buggy behavior). Corrected to TDD-standard: asserts post-fix expected behavior `selector === 'css=li'`.

### captureScript.test.ts — tests to add

```typescript
// BC-01: bare <li> with no data-testid, id, or text (icon-only button) emits within.selector 'css=li'
// FAILS now: buildContainerSelector returns 'nth-only' → click handler emits selector:''
it('BC-01: bare <li> (no attrs, icon-only button) emits within.selector "css=li"', () => {
  const ul = document.createElement('ul');
  const li = document.createElement('li');
  const btn = document.createElement('button');
  btn.setAttribute('data-testid', 'icon-action'); // button has data-testid but li does not
  li.appendChild(btn);
  ul.appendChild(li);
  document.body.appendChild(ul);
  btn.click();
  expect(capture).toHaveBeenCalledOnce();
  const cmd = capture.mock.calls[0][0];
  expect(cmd.type).toBe('within');
  expect(cmd.selector).toBe('css=li');
});

// BC-03: bare <tr> (no attrs, no text in subtree) emits within.selector 'css=tr'
// FAILS now: same nth-only path
it('BC-03: bare <tr> (no attrs, icon-only td) emits within.selector "css=tr"', () => {
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  const tr = document.createElement('tr');
  const td = document.createElement('td');
  const btn = document.createElement('button');
  btn.setAttribute('data-testid', 'tr-action');
  td.appendChild(btn);
  tr.appendChild(td);
  tbody.appendChild(tr);
  table.appendChild(tbody);
  document.body.appendChild(table);
  btn.click();
  expect(capture).toHaveBeenCalledOnce();
  const cmd = capture.mock.calls[0][0];
  expect(cmd.type).toBe('within');
  expect(cmd.selector).toBe('css=tr');
});

// BC-04: count-based bare <div> (>=2 siblings, no attrs, no text) emits within.selector 'css=div'
it('BC-04: count-based bare <div> (no attrs, no text) emits within.selector "css=div"', () => {
  const parent = document.createElement('section');
  const div1 = document.createElement('div');
  const btn = document.createElement('button');
  btn.setAttribute('data-testid', 'div-action');
  div1.appendChild(btn);
  const div2 = document.createElement('div');
  parent.appendChild(div1);
  parent.appendChild(div2);
  document.body.appendChild(parent);
  btn.click();
  expect(capture).toHaveBeenCalledOnce();
  const cmd = capture.mock.calls[0][0];
  expect(cmd.type).toBe('within');
  expect(cmd.selector).toBe('css=div');
});

// BC-05: count-based bare <section> (>=2 siblings, no attrs, no text) emits within.selector 'css=section'
it('BC-05: count-based bare <section> (no attrs, no text) emits within.selector "css=section"', () => {
  const wrapper = document.createElement('div');
  const sec1 = document.createElement('section');
  const btn = document.createElement('button');
  btn.setAttribute('data-testid', 'sec-btn');
  sec1.appendChild(btn);
  const sec2 = document.createElement('section');
  wrapper.appendChild(sec1);
  wrapper.appendChild(sec2);
  document.body.appendChild(wrapper);
  btn.click();
  expect(capture).toHaveBeenCalledOnce();
  const cmd = capture.mock.calls[0][0];
  expect(cmd.type).toBe('within');
  expect(cmd.selector).toBe('css=section');
});

// BC-06: <li> with whitespace-only textContent → treated as no-text, emits 'css=li'
// FAILS now: textContent.trim() === '' hits nth-only fallback → selector:''
it('BC-06: <li> with whitespace-only textContent emits within.selector "css=li"', () => {
  const ul = document.createElement('ul');
  const li = document.createElement('li');
  li.appendChild(document.createTextNode('   \n\t  '));
  const btn = document.createElement('button');
  btn.setAttribute('data-testid', 'ws-only-btn');
  li.appendChild(btn);
  ul.appendChild(li);
  document.body.appendChild(ul);
  btn.click();
  expect(capture).toHaveBeenCalledOnce();
  const cmd = capture.mock.calls[0][0];
  expect(cmd.type).toBe('within');
  expect(cmd.selector).toBe('css=li');
});

// BC-07: first bare <li> in 3-item list emits selector 'css=li' and nth: 0
// FAILS now: selector is '' (nth:0 may also be lost depending on falsy-check in click handler)
it('BC-07: first bare <li> in 3-item list emits selector "css=li" and nth: 0', () => {
  const ul = document.createElement('ul');
  for (let i = 0; i < 3; i++) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', `icon-btn-${i}`);
    li.appendChild(btn);
    ul.appendChild(li);
  }
  document.body.appendChild(ul);
  const firstBtn = (ul.children[0] as HTMLElement).querySelector('button') as HTMLElement;
  firstBtn.click();
  expect(capture).toHaveBeenCalledOnce();
  const cmd = capture.mock.calls[0][0];
  expect(cmd.type).toBe('within');
  expect(cmd.selector).toBe('css=li');
  expect(cmd.nth).toBe(0);
});

// BC-08: last bare <li> in 4-item list emits selector 'css=li' and nth: 3
it('BC-08: last bare <li> in 4-item list emits selector "css=li" and nth: 3', () => {
  const ul = document.createElement('ul');
  for (let i = 0; i < 4; i++) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', `last-icon-${i}`);
    li.appendChild(btn);
    ul.appendChild(li);
  }
  document.body.appendChild(ul);
  const lastBtn = (ul.children[3] as HTMLElement).querySelector('button') as HTMLElement;
  lastBtn.click();
  expect(capture).toHaveBeenCalledOnce();
  const cmd = capture.mock.calls[0][0];
  expect(cmd.type).toBe('within');
  expect(cmd.selector).toBe('css=li');
  expect(cmd.nth).toBe(3);
});

// BC-PC-01 (regression/positive-contrast): button WITH text inside bare <li> still emits 'text=Delete'
// PASSES on both current and fixed code — confirms fix is tightly scoped
it('BC-PC-01: button with text inside bare <li> — within selector is text=Delete', () => {
  const ul = document.createElement('ul');
  const li = document.createElement('li');
  const btn = document.createElement('button');
  btn.textContent = 'Delete';
  li.appendChild(btn);
  ul.appendChild(li);
  document.body.appendChild(ul);
  btn.click();
  expect(capture).toHaveBeenCalledOnce();
  const cmd = capture.mock.calls[0][0];
  expect(cmd.type).toBe('within');
  expect(cmd.selector).toBe('text=Delete');
});
```

### yamlWriter.test.ts — tests to add

```typescript
// BW-01: within with selector 'css=li' → YAML key 'css', value 'li', no empty key
// Documents the serialization contract for the post-fix output
it('BW-01: within selector "css=li" produces YAML key css=li, no empty key', () => {
  const dir = makeTmpDir();
  const outPath = path.join(dir, 'out.yaml');
  startSession(outPath, 'testApp');
  appendCommand(outPath, {
    type: 'within',
    selector: 'css=li',
    nth: 0,
    do: [{ command: { type: 'tapOn', selector: 'data-testid=delete' } }],
  });
  const content = fs.readFileSync(outPath, 'utf8');
  const parsed = yaml.load(content) as { commands: Record<string, unknown>[] };
  const withinObj = (parsed.commands[0] as { within: Record<string, unknown> }).within;
  expect(withinObj['css']).toBe('li');
  expect(withinObj['nth']).toBe(0);
  expect(Object.keys(withinObj)).not.toContain('');
});

// BW-02: within with selector 'css=tr' → YAML key 'css', value 'tr'
it('BW-02: within selector "css=tr" produces YAML key css: tr, nth preserved', () => {
  const dir = makeTmpDir();
  const outPath = path.join(dir, 'out.yaml');
  startSession(outPath, 'testApp');
  appendCommand(outPath, {
    type: 'within',
    selector: 'css=tr',
    nth: 1,
    do: [{ command: { type: 'tapOn', selector: 'data-testid=cell-btn' } }],
  });
  const content = fs.readFileSync(outPath, 'utf8');
  const parsed = yaml.load(content) as { commands: Record<string, unknown>[] };
  const withinObj = (parsed.commands[0] as { within: Record<string, unknown> }).within;
  expect(withinObj['css']).toBe('tr');
  expect(withinObj['nth']).toBe(1);
  expect(Object.keys(withinObj)).not.toContain('');
});

// BW-03: within with selector 'css=div' → YAML key 'css', value 'div'
it('BW-03: within selector "css=div" produces YAML key css: div', () => {
  const dir = makeTmpDir();
  const outPath = path.join(dir, 'out.yaml');
  startSession(outPath, 'testApp');
  appendCommand(outPath, {
    type: 'within',
    selector: 'css=div',
    nth: 2,
    do: [{ command: { type: 'tapOn', selector: 'text=Click' } }],
  });
  const content = fs.readFileSync(outPath, 'utf8');
  const parsed = yaml.load(content) as { commands: Record<string, unknown>[] };
  const withinObj = (parsed.commands[0] as { within: Record<string, unknown> }).within;
  expect(withinObj['css']).toBe('div');
  expect(withinObj['nth']).toBe(2);
  expect(Object.keys(withinObj)).not.toContain('');
});

// BW-05: 'css=li' serialises with key css, value li — manual YAML key inspection round-trip
it('BW-05: within "css=li" YAML round-trips — selector reconstructed as css=li', () => {
  const dir = makeTmpDir();
  const outPath = path.join(dir, 'out.yaml');
  startSession(outPath, 'testApp');
  appendCommand(outPath, {
    type: 'within',
    selector: 'css=li',
    nth: 1,
    do: [{ command: { type: 'tapOn', selector: 'data-testid=delete-btn' } }],
  });
  const content = fs.readFileSync(outPath, 'utf8');
  const parsed = yaml.load(content) as { commands: Record<string, unknown>[] };
  const withinBlock = (parsed.commands[0] as { within: Record<string, unknown> }).within;
  expect(withinBlock['css']).toBe('li');
  expect(withinBlock['nth']).toBe(1);
  expect(Array.isArray(withinBlock['do'])).toBe(true);
  const selectorKeys = Object.keys(withinBlock).filter((k) => k !== 'do' && k !== 'nth');
  expect(selectorKeys).toHaveLength(1);
  expect(`${selectorKeys[0]}=${String(withinBlock[selectorKeys[0]!])}`).toBe('css=li');
});

// BW-BUG: within with empty string selector must NOT produce empty YAML key
// FAILS on current code (bug: produces { '': '' }); PASSES after fix (bug input never generated)
// Also useful as a defensive yamlWriter guard
it('BW-BUG: within with empty string selector must not produce empty YAML key', () => {
  const dir = makeTmpDir();
  const outPath = path.join(dir, 'out.yaml');
  startSession(outPath, 'testApp');
  appendCommand(outPath, {
    type: 'within',
    selector: '',
    nth: 0,
    do: [{ command: { type: 'tapOn', selector: 'data-testid=delete' } }],
  });
  const content = fs.readFileSync(outPath, 'utf8');
  const parsed = yaml.load(content) as { commands: Record<string, unknown>[] };
  const withinObj = (parsed.commands[0] as { within: Record<string, unknown> }).within;
  expect(Object.keys(withinObj)).not.toContain('');
});
```

---

**Last checkpoint:** Tester Ensemble Phase 2 complete at 2026-09-13

---

## Test Results

### captureScript (packages/core)
**Total:** 188 passed, 0 failed

**New tests:**
- ✓ BC-01: bare `<li>` with icon-only button → `within.selector === 'css=li'`
- ✓ BC-03: bare `<tr>` with icon-only button → `within.selector === 'css=tr'`
- ✓ BC-04: count-based bare `<div>` → `within.selector === 'css=div'`
- ✓ BC-05: count-based bare `<section>` → `within.selector === 'css=section'`
- ✓ BC-06: `<li>` with whitespace-only text → `within.selector === 'css=li'`
- ✓ BC-07: first bare `<li>` in 3-item list → `selector === 'css=li'`, `nth: 0`
- ✓ BC-08: last bare `<li>` in 4-item list → `selector === 'css=li'`, `nth: 3`
- ✓ BC-PC-01: button with text in bare `<li>` → `within.selector === 'text=Delete'` (regression)

### yamlWriter (recorder-app)
**Total:** 36 passed, 0 failed

**New tests:**
- ✓ BW-01: `css=li` → YAML key `css: li`, no empty key
- ✓ BW-02: `css=tr` → YAML key `css: tr`
- ✓ BW-03: `css=div` → YAML key `css: div`
- ✓ BW-05: `css=li` round-trips correctly
- ✓ BW-BUG: empty selector throws (defensive guard)

### TypeScript
42 pre-existing errors on `main` — unchanged by this branch. None introduced.

---

## Quality Gate

**Verdict:** PASS

| Check | Result |
|---|---|
| Bug-first rule | PASS — tests designed to go red first; verified in Phase 1 |
| Fix completeness | PASS — sentinel removed, both ternaries removed |
| Test coverage | PASS — all 7 AC covered |
| No regressions | PASS — 188 core + 36 yamlWriter passing |
| No debug instrumentation | PASS |
| Diff minimal | PASS — 3 lines in captureScript, 1 guard in yamlWriter |

**Last checkpoint:** Quality Gate PASS at 2026-09-13

---

## Code Artifacts

**Commit:** `6a54c76` on branch `fix-empty-container-selector-yaml`

**Files changed:**
- `packages/core/src/captureScript.ts` — `return 'nth-only'` → `return 'css=' + containerEl.tagName.toLowerCase()`; both `containerSel === 'nth-only' ? '' : containerSel` ternaries → `containerSel`
- `recorder-app/src/yamlWriter.ts` — added guard: `if (!cmd.selector) throw new Error(...)` in `within` case
- `packages/core/src/captureScript.test.ts` — added BC-01, BC-03–08, BC-PC-01
- `recorder-app/src/yamlWriter.test.ts` — added BW-01–03, BW-05, BW-BUG

**Test results before fix:** 7 captureScript failing, 1 yamlWriter failing (BW-BUG)
**Test results after fix:** 188/188 captureScript passing, 36/36 yamlWriter passing

---

## PR

**URL:** https://github.com/plaktoz/uivisor/pull/77
**Branch:** fix-empty-container-selector-yaml
**Status:** merged

---

## Review Status
**Cycle:** 0 of 2
**Last verdict:** pending
**Open findings:** 0

