import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ImageResult, RunOutput, RunSummary } from '../types.js';

export const HTML_REPORT_FILE = 'index.html';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function pct(v: number | undefined): string {
  return v === undefined ? '-' : `${(v * 100).toFixed(2)}%`;
}

function px(v: number | undefined): string {
  return v === undefined ? '-' : `${Math.round(v)}px`;
}

function statusClass(s: ImageResult['status']): string {
  return s === 'PASS' ? 'pass' : s === 'FAIL' ? 'fail' : 'warn';
}

function imageCard(r: ImageResult): string {
  const cls = statusClass(r.status);
  const reasons = r.reasons.join(', ');
  const warnings = r.warnings.map((w) => `<li>${esc(w.message)}</li>`).join('');
  const asset = (label: string, path: string | undefined): string =>
    path
      ? `<figure>
          <figcaption>${esc(label)}</figcaption>
          <img src="${esc(path)}" alt="${esc(label)}" loading="lazy">
        </figure>`
      : '';

  const hasAssets = r.assets && Object.keys(r.assets).some((k) => (r.assets as Record<string, string>)[k]);

  return `
<details class="card ${cls}" ${r.status === 'FAIL' ? 'open' : ''}>
  <summary>
    <span class="badge ${cls}">${esc(r.status)}</span>
    <span class="name">${esc(r.name)}</span>
    <span class="meta">Variance: ${pct(r.variance)} &nbsp; Drift: ${px(r.drift)}${r.driftAxis ? ` (${esc(r.driftAxis)})` : ''}</span>
    ${reasons ? `<span class="reasons">${esc(reasons)}</span>` : ''}
  </summary>
  <div class="body">
    ${hasAssets ? `
    <div class="slider-wrap">
      <div class="slider" data-slider>
        ${r.assets?.baseline ? `<div class="slider-before"><img src="${esc(r.assets.baseline)}" alt="baseline" loading="lazy"></div>` : ''}
        ${r.assets?.current ? `<div class="slider-after"><img src="${esc(r.assets.current)}" alt="current" loading="lazy"></div>` : ''}
        <div class="divider"></div>
      </div>
      <small>◀ drag to compare ▶</small>
    </div>
    <div class="images">
      ${asset('Structural Edge Map (current)', r.assets?.edgeMap)}
      ${asset('Diff Overlay', r.assets?.diff)}
    </div>` : ''}
    ${warnings ? `<ul class="warnings">${warnings}</ul>` : ''}
    ${r.error ? `<p class="error">${esc(r.error)}</p>` : ''}
  </div>
</details>`;
}

function summaryTable(s: RunSummary): string {
  return `
<table class="summary">
  <tr><th>Total</th><th>Passed</th><th>Failed</th><th>New</th><th>Missing</th><th>Invalid</th></tr>
  <tr>
    <td>${s.total}</td>
    <td class="pass">${s.passed}</td>
    <td class="${s.failed ? 'fail' : ''}">${s.failed}</td>
    <td>${s.new}</td>
    <td>${s.missing}</td>
    <td>${s.errored}</td>
  </tr>
</table>`;
}

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,"Segoe UI",system-ui,sans-serif;font-size:14px;line-height:1.6;background:#f7f8fa;color:#1f2328;padding:1.5rem}
h1{font-size:1.2rem;margin-bottom:1rem;color:#1f2328}
.summary{border-collapse:collapse;margin-bottom:1.5rem;background:#fff;border:1px solid #e5e7eb;border-radius:4px;overflow:hidden}
.summary th,.summary td{padding:.5rem .9rem;border:1px solid #e5e7eb;text-align:right}
.summary th{background:#f7f8fa;font-weight:600;text-align:center}
.pass{color:#1a7f37}.fail{color:#cf222e;font-weight:600}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:.75rem;overflow:hidden}
.card.fail>summary{background:#fff1f0}.card.pass>summary{background:#f0fdf4}
summary{list-style:none;cursor:pointer;padding:.65rem 1rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
summary::-webkit-details-marker{display:none}
.badge{display:inline-block;font-size:11px;font-weight:700;padding:1px 6px;border-radius:3px;text-transform:uppercase;letter-spacing:.04em}
.badge.pass{background:#d1fae5;color:#065f46}.badge.fail{background:#fee2e2;color:#991b1b}.badge.warn{background:#fef3c7;color:#92400e}
.name{font-weight:600;flex:1 1 auto}.meta{font-size:12px;color:#57606a}.reasons{font-size:12px;color:#cf222e}
.body{padding:1rem;border-top:1px solid #e5e7eb}
.images{display:flex;flex-wrap:wrap;gap:1rem;margin-top:1rem}
figure{flex:1 1 calc(50% - .5rem);min-width:200px}
figcaption{font-size:11px;font-weight:600;margin-bottom:.25rem;text-transform:uppercase;color:#57606a;letter-spacing:.04em}
figure img{max-width:100%;border:1px solid #e5e7eb;border-radius:3px;display:block}
.warnings{list-style:disc;padding-left:1.2rem;font-size:12px;color:#92400e;margin-top:.5rem}
.error{font-size:12px;color:#cf222e;margin-top:.5rem;font-family:monospace;word-break:break-all}
.slider-wrap{margin-bottom:1rem}
.slider-wrap small{display:block;font-size:11px;color:#57606a;margin-top:.25rem;text-align:center}
.slider{position:relative;overflow:hidden;border:1px solid #e5e7eb;border-radius:3px;max-width:100%;user-select:none}
.slider img{display:block;max-width:100%;pointer-events:none}
.slider-before,.slider-after{position:absolute;top:0;left:0;width:100%;height:100%;overflow:hidden}
.slider-before{z-index:2;width:50%}.slider-after{z-index:1}
.slider-after img,.slider-before img{max-width:none;width:100%}
.divider{position:absolute;top:0;left:50%;width:2px;height:100%;background:#3b82d4;z-index:3;cursor:ew-resize;transform:translateX(-50%)}
.divider::after{content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:16px;height:16px;background:#3b82d4;border-radius:50%;border:2px solid #fff}
`;

const JS = `
(function(){
  document.querySelectorAll('[data-slider]').forEach(function(slider){
    var before=slider.querySelector('.slider-before');
    var divider=slider.querySelector('.divider');
    var dragging=false;
    function move(x){
      var rect=slider.getBoundingClientRect();
      var pct=Math.max(0,Math.min(1,(x-rect.left)/rect.width));
      before.style.width=(pct*100)+'%';
      divider.style.left=(pct*100)+'%';
    }
    divider.addEventListener('mousedown',function(e){dragging=true;e.preventDefault();});
    window.addEventListener('mousemove',function(e){if(dragging)move(e.clientX);});
    window.addEventListener('mouseup',function(){dragging=false;});
    divider.addEventListener('touchstart',function(e){dragging=true;e.preventDefault();},{passive:false});
    window.addEventListener('touchmove',function(e){if(dragging)move(e.touches[0].clientX);},{passive:true});
    window.addEventListener('touchend',function(){dragging=false;});
  });
})();
`;

export function buildHtml(output: RunOutput): string {
  const result = output.exitCode === 0 ? 'PASS' : 'FAIL';
  const failedFirst = [...output.outcomes].sort((a, b) => {
    const af = a.result.status === 'FAIL' ? 0 : 1;
    const bf = b.result.status === 'FAIL' ? 0 : 1;
    return af - bf;
  });
  const cards = failedFirst.map(({ result: r }) => imageCard(r)).join('');
  const runWarnings = output.runWarnings.length > 0
    ? `<ul class="warnings" style="margin-bottom:1rem">${output.runWarnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ui-diff report — ${esc(result)}</title>
<style>${CSS}</style>
</head>
<body>
<h1>ui-diff report &mdash; <span class="${result === 'PASS' ? 'pass' : 'fail'}">${esc(result)}</span></h1>
${summaryTable(output.summary)}
${runWarnings}
${cards}
<script>${JS}</script>
</body>
</html>`;
}

export async function writeHtml(outDir: string, output: RunOutput): Promise<string> {
  await mkdir(outDir, { recursive: true });
  const file = join(outDir, HTML_REPORT_FILE);
  await writeFile(file, buildHtml(output), 'utf8');
  return file;
}
