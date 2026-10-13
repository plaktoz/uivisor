/**
 * Compile-time test for AC71 — completeness of COMMAND_TRAITS is checked at compile
 * time, not at runtime. This file has no vitest assertions; it is type-checked by
 * `tsc` as part of `npm run build -w packages/core` (core's tsconfig includes
 * `src/**\/*`, like the co-located `*.test.ts` files).
 */
import { COMMAND_TRAITS } from './commandTraits.js';
import type { Command } from './types.js';

// AC71: COMMAND_TRAITS covers every Command['type']. Removing an entry from
// COMMAND_TRAITS makes this assignment (and the annotation in commandTraits.ts) fail.
const asRecord: Record<Command['type'], unknown> = COMMAND_TRAITS;
void asRecord;

// An object missing one key is a real error. If it stopped being one, this
// directive would itself fail as unused.
const { goto: _goto, ...missingGoto } = COMMAND_TRAITS;
void _goto;
// @ts-expect-error -- missing 'goto' key must fail to satisfy typeof COMMAND_TRAITS
const missingKey: typeof COMMAND_TRAITS = missingGoto;
void missingKey;

// A literal with one excess key is also an error.
const excessKey: typeof COMMAND_TRAITS = {
  ...COMMAND_TRAITS,
  // @ts-expect-error -- 'notACommand' is not a Command['type']
  notACommand: { timeout: 'none' },
};
void excessKey;
