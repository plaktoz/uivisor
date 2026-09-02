/**
 * CAPTURE_SCRIPT — browser IIFE string for injection via page.addInitScript().
 *
 * Listens for DOM events (click, input/blur, change, keydown, popstate,
 * hashchange) and emits typed Command objects via window.__uivisorCapture().
 *
 * resolveSelector logic is inlined as plain JS — no imports, no TypeScript
 * annotations, safe for direct script injection.
 */
export declare const CAPTURE_SCRIPT: string;
//# sourceMappingURL=captureScript.d.ts.map