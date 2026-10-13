type Range = readonly [number, number];

/** Code points that occupy no cell of their own (combining marks, joiners, variation selectors 1-15). */
const ZERO: readonly Range[] = [
  [0x0300, 0x036f], [0x1ab0, 0x1aff], [0x1dc0, 0x1dff], [0x200b, 0x200f], [0x2060, 0x2064],
  [0x20d0, 0x20ff], [0xfe00, 0xfe0e], [0xfe20, 0xfe2f], [0xe0100, 0xe01ef],
];

/** East Asian Wide / Fullwidth and emoji presentation: two cells. */
const WIDE: readonly Range[] = [
  [0x1100, 0x115f], [0x231a, 0x231b], [0x2329, 0x232a], [0x23e9, 0x23ec], [0x23f0, 0x23f0], [0x23f3, 0x23f3],
  [0x25fd, 0x25fe], [0x2614, 0x2615], [0x2648, 0x2653], [0x267f, 0x267f], [0x2693, 0x2693], [0x26a1, 0x26a1],
  [0x26aa, 0x26ab], [0x26bd, 0x26be], [0x26c4, 0x26c5], [0x26ce, 0x26ce], [0x26d4, 0x26d4], [0x26ea, 0x26ea],
  [0x26f2, 0x26f3], [0x26f5, 0x26f5], [0x26fa, 0x26fa], [0x26fd, 0x26fd], [0x2705, 0x2705], [0x270a, 0x270b],
  [0x2728, 0x2728], [0x274c, 0x274c], [0x274e, 0x274e], [0x2753, 0x2755], [0x2757, 0x2757], [0x2795, 0x2797],
  [0x27b0, 0x27b0], [0x27bf, 0x27bf], [0x2b1b, 0x2b1c], [0x2b50, 0x2b50], [0x2b55, 0x2b55],
  [0x2e80, 0x303e], [0x3041, 0x33ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xa000, 0xa4cf], [0xa960, 0xa97f],
  [0xac00, 0xd7a3], [0xf900, 0xfaff], [0xfe10, 0xfe19], [0xfe30, 0xfe6f], [0xff00, 0xff60], [0xffe0, 0xffe6],
  [0x16fe0, 0x16fe4], [0x17000, 0x18cff], [0x1b000, 0x1b2ff], [0x1f004, 0x1f004], [0x1f0cf, 0x1f0cf],
  [0x1f18e, 0x1f18e], [0x1f191, 0x1f19a], [0x1f200, 0x1f2ff], [0x1f300, 0x1f64f], [0x1f680, 0x1f6ff],
  [0x1f900, 0x1f9ff], [0x1fa00, 0x1faff], [0x20000, 0x3fffd],
];

const inRanges = (cp: number, ranges: readonly Range[]): boolean => ranges.some(([lo, hi]) => cp >= lo && cp <= hi);

export function cellWidth(cp: number): number {
  if (inRanges(cp, ZERO)) return 0;
  return inRanges(cp, WIDE) ? 2 : 1;
}

export function width(s: string): number {
  let w = 0;
  for (const ch of s) w += cellWidth(ch.codePointAt(0) as number);
  return w;
}

/** Longest prefix of `s` that fits in `max` cells, ending in `…` when anything was cut. */
export function truncate(s: string, max: number): string {
  if (width(s) <= max) return s;
  if (max <= 0) return '';
  let out = '';
  let used = 0;
  for (const ch of s) {
    const w = cellWidth(ch.codePointAt(0) as number);
    if (used + w > max - 1) break;
    out += ch;
    used += w;
  }
  return `${out}…`;
}

const NAMED_ESCAPES: Readonly<Record<string, string>> = { '\n': '\\n', '\r': '\\r', '\t': '\\t' };

/** Control characters would move the cursor or break the line, so show them as escapes instead. */
export function visible(s: string): string {
  return s.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, (c) => {
    return NAMED_ESCAPES[c] ?? `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`;
  });
}
