# Signoff Package — feat-in-browser-overlay

## Feature Summary

`recorder-app/src/overlay.ts` is a self-contained browser script that the recorder CLI injects into the recording page via `page.addInitScript()`. It renders a fixed HUD in the bottom-right corner listing three keyboard shortcuts: `Shift+A` opens an assertion picker with 8 assertion types (assertVisible, assertText, assertValue, assertUrl, assertEnabled, assertDisabled, assertChecked, assertUnchecked); `Shift+W` prompts for a millisecond value and emits a wait command; `PrintScreen` or `Shift+S` emits a screenshot command with an auto-incrementing filename (`screenshots/step-N.png`). All commands are forwarded to Node.js via `window.__uivisorOverlay(commandObj)`, which the CLI pre-registers using `page.exposeFunction('__uivisorOverlay', handler)`. The script contains no Node.js imports and is safe to inject as a pure browser IIFE.

## Files Delivered

| File | Status | Description |
|---|---|---|
| `recorder-app/package.json` | NEW | `@uivisor/recorder` package skeleton; devDeps: vitest 3, jsdom 25, typescript 5, @types/node 22 |
| `recorder-app/tsconfig.json` | NEW | Target ES2022, module ESNext, bundler resolution, lib DOM+ES2022, strict mode |
| `recorder-app/vitest.config.ts` | NEW | Vitest config with jsdom environment |
| `recorder-app/src/overlay.ts` | NEW | Pure browser script: HUD injection, Shift+A picker (8 types), Shift+W wait, PrintScreen/Shift+S screenshot, Escape dismiss, emit() guard |
| `recorder-app/src/overlay.test.ts` | NEW | 31 passing tests + 1 todo (spec-deciding: Shift+A in INPUT) |
| `package.json` (root) | MODIFIED | Added `recorder-app` to the `workspaces` array |

## Test Results

```
 RUN  v3.2.7 recorder-app/

 ✓ src/overlay.test.ts (32 tests | 1 skipped) 38ms

 Test Files  1 passed (1)
      Tests  31 passed | 1 todo (32)
   Duration  734ms
```

`tsc --noEmit` — 0 errors.

**Quality Gate: PASS** — 31/31 tests pass, tsc clean, all 12 ACs satisfied.

## How to Inject the Overlay (Playwright)

```typescript
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { join } from 'path';

const overlayScript = readFileSync(
  join(__dirname, '../recorder-app/src/overlay.ts'),
  'utf8'
);

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

// Register the host function BEFORE injecting the script
await page.exposeFunction('__uivisorOverlay', (command: unknown) => {
  console.log('Overlay command:', JSON.stringify(command));
  // Forward to YAML serialiser (F4) or handle directly
});

// Inject the overlay into every new page/navigation
await page.addInitScript({ content: overlayScript });

await page.goto('http://localhost:5173');
// Tester can now use Shift+A, Shift+W, and Shift+S / PrintScreen
```
