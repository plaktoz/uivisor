import type { ImageResult, RunOutput } from '../types.js';

function pct(v: number | undefined): string {
  return v === undefined ? '-' : `${(v * 100).toFixed(1)}%`;
}

function px(v: number | undefined): string {
  return v === undefined ? '-' : `${Math.round(v)}px`;
}

function detail(r: ImageResult): string {
  if (r.reasons.length > 0) {
    const axis = r.reasons.includes('ALIGNMENT_DRIFT') && r.driftAxis ? ` (${r.driftAxis})` : '';
    return r.reasons.join(', ') + axis;
  }
  return r.warnings.map((w) => w.code).join(', ');
}

/** Plain-text table, summary line and warnings. */
export function renderConsole(output: RunOutput): string {
  const header = ['Image', 'Status', 'Variance', 'Drift', 'Detail'];
  const rows = output.outcomes.map(({ result: r }) => [r.name, r.status, pct(r.variance), px(r.drift), detail(r)]);
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i].length)));
  const line = (cells: string[]): string => cells.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd();

  const out: string[] = [];
  if (rows.length > 0) {
    out.push(line(header));
    out.push(widths.map((w) => '-'.repeat(w)).join('  '));
    for (const row of rows) out.push(line(row));
    out.push('');
  }

  const s = output.summary;
  out.push(
    `Total: ${s.total}  Passed: ${s.passed}  Failed: ${s.failed}  New: ${s.new}  Missing (warning): ${s.missing}` +
      (s.errored > 0 ? `  Invalid: ${s.errored}` : ''),
  );

  const warnings = [
    ...output.runWarnings,
    ...output.outcomes.flatMap(({ result: r }) => r.warnings.map((w) => `${r.name}: ${w.code} - ${w.message}`)),
  ];
  if (warnings.length > 0) {
    out.push('', 'Warnings:');
    for (const w of warnings) out.push(`  ${w}`);
  }
  for (const { result: r } of output.outcomes) {
    if (r.error && r.reasons.includes('INVALID_IMAGE')) out.push(`  ${r.name}: ${r.error}`);
  }
  out.push('', output.exitCode === 0 ? 'RESULT: PASS' : 'RESULT: FAIL');
  return out.join('\n');
}
