# Playwright goBack/goForward: null return is ambiguous

**Role:** Coder
**Epic:** epic-add-more-ui-test-capability
**Feature:** feat-page-control-and-utilities

## Lesson

`page.goBack()` and `page.goForward()` return `null` in **two distinct situations**, not one:

1. No navigable history (e.g. fresh page where the only prior entry is `about:blank`)
2. Same-document navigation succeeded (hash fragment change — no HTTP response, no `load` event)

Using `if (response === null) throw` treats case 2 as a failure, breaking tests that navigate via hash (e.g. `page.goto(baseUrl + '#section2')` then `goBack`).

## Working pattern

```typescript
const urlBefore = page.url();
await page.goBack({ waitUntil: 'commit' });   // 'commit' works for hash navigations; 'load' does not
const urlAfter = page.url();
if (urlAfter === urlBefore || urlAfter.startsWith('about:')) {
  throw new Error('No previous page in history.');
}
```

- `waitUntil: 'load'` — breaks for hash navigations (no load event fires → times out or returns null)
- `waitUntil: 'commit'` — fires as soon as the URL is committed, works for all navigation types
- URL unchanged → truly no history
- URL changed to `about:*` → navigated to internal page, treat as "no real history"
- URL changed to real URL → success

Same pattern applies to `executeGoForward`.
