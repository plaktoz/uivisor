# cli.ts

Entry point for the `uivisor-record` binary (`#!/usr/bin/env node`). No exports — runs as a top-level `main()` IIFE.

---

## Startup sequence

1. **`parseArgs`** — resolve the target URL and output YAML path from `process.argv`.
2. **`startSession`** — create the YAML file and write the header (`appId: <url>\ncommands:\n`).
3. **`chromium.launch({ headless: false })`** — open a headed Chromium browser.
4. **Register page functions:**
   - `page.exposeFunction('__uivisorCapture', appendCommand)` — called by the capture script when a DOM interaction is intercepted.
   - `page.exposeFunction('__uivisorOverlay', appendCommand)` — called by the overlay script when a keyboard shortcut triggers an assertion, wait, or screenshot.
5. **`page.addInitScript(CAPTURE_SCRIPT)`** — injects the core interaction capture script (from `@uivisor/core`) into every page/frame on navigation.
6. **`page.addInitScript(OVERLAY_SCRIPT)`** — injects the overlay HUD and keyboard shortcut listener.
7. **`page.goto(url)`** — navigate to the target URL.
8. **Shutdown on tab close** (`page.on('close')`) or `SIGINT` — closes the browser and exits.

---

## Data flow summary

```
User interaction in browser
        │
        ▼
CAPTURE_SCRIPT / OVERLAY_SCRIPT (injected via addInitScript)
        │
        ▼ (calls window.__uivisorCapture or window.__uivisorOverlay)
cli.ts exposeFunction handler
        │
        ▼
appendCommand(outputPath, cmd)
        │
        ▼
recorded.yaml (appended incrementally)
```

**Internal imports:** `./overlay` (`OVERLAY_SCRIPT`), `./yamlWriter` (`startSession`, `appendCommand`), `./args` (`parseArgs`)

**External imports:** `playwright` (`chromium`), `@uivisor/core` (`Command` type, `CAPTURE_SCRIPT`)
