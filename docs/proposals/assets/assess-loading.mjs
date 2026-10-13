// Loading assessment browser v2 (throwaway, not part of uivisor).
// Walk the app manually; press F2 the moment a page LOOKS ready. Close the window to get the summary.
//
// v2 compares several "is the app ready?" rules side by side for every action, and scores
// each rule against your F2 marks, to pick the rule that closes the micro-app boot gap
// (code chunk finished → 70–470ms of start-up → loader / API calls begin).
//
// Signals (all event-based):
//   loader   in-page MutationObserver: data-testid=overlay-loader present, or "Loading..." visible
//   api      XHR/fetch requests (minus --ignore)
//   chunk    JS downloads (resourceType script), i.e. micro-app code
//   longtask main-thread tasks >50ms (PerformanceObserver 'longtask'), i.e. JS start-up / rendering
//   dom      any DOM mutation in the page (excluding our own toast)
//
// Usage: node docs/assets/assess-loading.mjs [startUrl] [--ignore notification,activegate]

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const ignoreIdx = argv.indexOf('--ignore');
const IGNORE = (ignoreIdx >= 0 ? argv.splice(ignoreIdx, 2)[1] : 'notification,activegate')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const START_URL = argv[0] ?? 'https://employees-nshub-qa2.digitalfactory.gov.sg/nshub';
const isIgnored = (url) => IGNORE.some((s) => url.toLowerCase().includes(s));

const SLA_MS = 3000;
const APPEAR_WINDOW_MS = 300;
const GIVE_UP_MS = 30000;
const BLINK_MS = 50;

// Candidate rules: signal → quiet period (ms) required after that signal's last activity.
const RULES = [
  { name: 'R1 loader+api',            quiet: { loader: 200, api: 200 } },
  { name: 'R2 +chunk',                quiet: { loader: 200, api: 200, chunk: 200 } },
  { name: 'R3 +chunk(1000)',          quiet: { loader: 200, api: 200, chunk: 1000 } },
  { name: 'R4 +chunk+longtask(300)',  quiet: { loader: 200, api: 200, chunk: 200, longtask: 300 } },
  { name: 'R5 +chunk+dom(300)',       quiet: { loader: 200, api: 200, chunk: 200, dom: 300 } },
];

// Logs contain user names from the test environment, so they go to the gitignored target/ dir.
const outDir = path.resolve('target/assess');
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const logPath = path.join(outDir, `loading-v2-${stamp}.log`);
const jsonPath = path.join(outDir, `loading-v2-${stamp}.json`);
const logStream = fs.createWriteStream(logPath);

const T0 = Date.now();
const now = () => Date.now();
const rel = (t) => `+${((t - T0) / 1000).toFixed(3)}s`.padEnd(11);
const fmtDelta = (d) => `${d >= 0 ? '+' : ''}${d}ms`;
const events = [];

function log(kind, msg, data = {}) {
  const line = `${rel(now())} [${kind}]`.padEnd(22) + msg;
  console.log(line);
  logStream.write(line + '\n');
  events.push({ t: now() - T0, kind, msg, ...data });
}

// ─── In-page observer ─────────────────────────────────────────────────────────

const INIT_SCRIPT = `(() => {
  if (window.__uivisorAssess) return;
  window.__uivisorAssess = true;
  const isMain = window.top === window;
  const report = (ev) => { try { window.__uivisorReport({ ...ev, main: isMain, href: location.href }); } catch {} };
  const isVisible = (el) => {
    if (!el.isConnected) return false;
    if (el.checkVisibility) return el.checkVisibility({ visibilityProperty: true });
    return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  };
  const indicators = [
    { name: 'data-testid=overlay-loader', test: () => !!document.querySelector('[data-testid="overlay-loader"]') },
    { name: 'text=Loading... (visible)', test: () => {
        const r = document.evaluate("//*[contains(text(),'Loading...')]", document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for (let i = 0; i < r.snapshotLength; i++) if (isVisible(r.snapshotItem(i))) return true;
        return false;
      } },
  ];
  const state = indicators.map(() => false);
  const since = indicators.map(() => 0);
  let scans = 0, scanCost = 0, scanMax = 0;
  let lastMutation = 0, mutationsSinceFlush = 0;
  const isOurs = (n) => n && n.nodeType === 1 && n.hasAttribute && n.hasAttribute('data-uivisor-assess');
  const check = (records) => {
    if (records && records.every((r) => isOurs(r.target) || [...r.addedNodes, ...r.removedNodes].some(isOurs))) return;
    if (records) { lastMutation = performance.now(); mutationsSinceFlush += records.length; }
    const t0 = performance.now();
    indicators.forEach((ind, i) => {
      const busy = ind.test();
      if (busy !== state[i]) {
        const t = performance.now();
        report({ type: busy ? 'appear' : 'disappear', indicator: ind.name, durMs: busy ? undefined : Math.round(t - since[i]) });
        state[i] = busy; since[i] = t;
      }
    });
    const c = performance.now() - t0;
    scans++; scanCost += c; if (c > scanMax) scanMax = c;
  };
  new MutationObserver(check).observe(document, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ['class', 'style', 'hidden'],
  });
  check(null);
  report({ type: 'init', states: indicators.map((ind, i) => ({ indicator: ind.name, busy: state[i] })) });

  // DOM activity: flush at most every 100ms, with how long ago the last mutation was
  setInterval(() => {
    if (!mutationsSinceFlush) return;
    report({ type: 'dom', n: mutationsSinceFlush, agoMs: Math.round(performance.now() - lastMutation) });
    mutationsSinceFlush = 0;
  }, 100);

  // Long tasks (Chromium)
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        report({ type: 'longtask', durMs: Math.round(e.duration), endAgoMs: Math.round(performance.now() - (e.startTime + e.duration)) });
      }
    }).observe({ type: 'longtask', buffered: false });
  } catch {}

  const describe = (el) => {
    if (!(el instanceof Element)) return '?';
    const tid = el.closest('[data-testid]')?.getAttribute('data-testid');
    const txt = ((el.innerText || el.textContent || '') + '').trim().replace(/\\s+/g, ' ').slice(0, 50);
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (tid ? ' [testid=' + tid + ']' : '') + (txt ? ' "' + txt + '"' : '');
  };
  document.addEventListener('click', (e) => report({ type: 'action', action: 'click', target: describe(e.target) }), true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') report({ type: 'action', action: 'Enter', target: describe(e.target) });
    if (e.key === 'F2') {
      e.preventDefault();
      report({ type: 'mark' });
      const toast = document.createElement('div');
      toast.setAttribute('data-uivisor-assess', '');
      toast.textContent = '✓ marked ready';
      toast.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#1a7f37;color:#fff;padding:6px 14px;border-radius:6px;font:14px sans-serif;pointer-events:none';
      document.documentElement.appendChild(toast);
      setTimeout(() => toast.remove(), 1200);
    }
  }, true);
  setInterval(() => {
    if (scans) report({ type: 'scanStats', scans, avgMs: +(scanCost / scans).toFixed(3), maxMs: +scanMax.toFixed(2) });
    scans = 0; scanCost = 0; scanMax = 0;
  }, 10000);
})();`;

// ─── Signal state ─────────────────────────────────────────────────────────────

const pageIds = new Map();
const busyLoaders = new Map();      // `${pageId}|${indicator}` -> since
const inflight = new Map();         // Request -> { start, key, type, ignored }
const last = { loader: 0, api: 0, chunk: 0, longtask: 0, dom: 0 };   // last activity END time per signal

const inflightCount = (type) => [...inflight.values()].filter((r) => !r.ignored && r.type === type).length;
function isBusy(signal) {
  if (signal === 'loader') return busyLoaders.size > 0;
  if (signal === 'api') return inflightCount('api') > 0;
  if (signal === 'chunk') return inflightCount('chunk') > 0;
  return false;
}

// ─── Action timing per rule ───────────────────────────────────────────────────

let pending = null;
const responses = [];
const indicatorStats = new Map();
const routeLoader = new Map();
const endpoints = new Map();
let scanStatsMax = { avgMs: 0, maxMs: 0 };
let lastActionAt = 0;

const route = (href) => {
  try { const u = new URL(href); return u.pathname + (u.hash ? u.hash.split('?')[0] : ''); } catch { return href; }
};
const epKey = (method, url) => {
  try {
    const u = new URL(url);
    const p = u.pathname
      .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}(?=\/|$)/gi, '/:uuid')
      .replace(/\/\d+(?=\/|$)/g, '/:id');
    return `${method} ${u.host}${p}`;
  } catch { return `${method} ${url}`; }
};

function startAction(action, target, href) {
  if (pending) finalize('interrupted');
  lastActionAt = now();
  pending = {
    t: lastActionAt, action, target, route: route(href),
    loaderSeen: new Set(), apiCalls: 0, chunks: 0, longtasks: 0,
    rules: Object.fromEntries(RULES.map((r) => [r.name, null])),   // rule -> readyMs | null
  };
  log('action', `${action} ${target}  @ ${pending.route}`);
}

function evaluateRules() {
  if (!pending) return;
  const t = now();
  if (t - pending.t < APPEAR_WINDOW_MS) return;
  for (const rule of RULES) {
    if (pending.rules[rule.name] !== null) continue;
    const signals = Object.keys(rule.quiet);
    const ready = signals.every((s) => !isBusy(s) && t - last[s] >= rule.quiet[s]);
    if (ready) {
      // ready moment = last activity of any signal in this rule (not the moment we noticed)
      const end = Math.max(pending.t, ...signals.map((s) => last[s]));
      pending.rules[rule.name] = end - pending.t;
    }
  }
  if (Object.values(pending.rules).every((v) => v !== null)) finalize('ready');
  else if (t - pending.t > GIVE_UP_MS) finalize('gave up');
}
setInterval(evaluateRules, 25);

const ruleSummary = (p) => RULES.map((r) => {
  const v = p.rules[r.name];
  return `${r.name.split(' ')[0]} ${v === null ? '—' : v + 'ms'}`;
}).join(' | ');

function finalize(outcome) {
  const p = pending;
  pending = null;
  const markInfo = p.markMs !== undefined ? ` | YOU ${p.markMs}ms` : '';
  const parts = [
    p.loaderSeen.size ? `loader: ${[...p.loaderSeen].join(', ')}` : 'no loader',
    `${p.apiCalls} api`, `${p.chunks} chunk`, `${p.longtasks} longtask`,
  ];
  log('resp', `${p.action} ${p.target} → ${outcome}: ${ruleSummary(p)}${markInfo}  [${parts.join(', ')}]`);
  responses.push({ ...p, loaderSeen: [...p.loaderSeen], t: p.t - T0, outcome });
}

// ─── Page reports ─────────────────────────────────────────────────────────────

function onReport(page, ev) {
  if (!ev.main) return;
  const pid = pageIds.get(page);
  const r = route(ev.href);
  switch (ev.type) {
    case 'init':
      for (const k of [...busyLoaders.keys()]) if (k.startsWith(`${pid}|`)) busyLoaders.delete(k);
      for (const s of ev.states) {
        if (s.busy) { busyLoaders.set(`${pid}|${s.indicator}`, now()); log('loader', `present at document start: ${s.indicator}  @ ${r}`); }
      }
      break;
    case 'appear':
      busyLoaders.set(`${pid}|${ev.indicator}`, now());
      if (!routeLoader.has(r)) routeLoader.set(r, new Set());
      routeLoader.get(r).add(ev.indicator);
      if (pending) pending.loaderSeen.add(ev.indicator);
      log('loader', `appear    ${ev.indicator}  @ ${r}`);
      break;
    case 'disappear': {
      busyLoaders.delete(`${pid}|${ev.indicator}`);
      last.loader = now();
      const st = indicatorStats.get(ev.indicator) ?? { count: 0, blinks: 0, durations: [], routes: new Set() };
      st.count++; st.durations.push(ev.durMs); st.routes.add(r);
      if (ev.durMs < BLINK_MS) st.blinks++;
      indicatorStats.set(ev.indicator, st);
      log('loader', `disappear ${ev.indicator} after ${ev.durMs}ms${ev.durMs < BLINK_MS ? '  (BLINK)' : ''}  @ ${r}`);
      break;
    }
    case 'dom':
      last.dom = Math.max(last.dom, now() - ev.agoMs);
      break;
    case 'longtask':
      last.longtask = Math.max(last.longtask, now() - ev.endAgoMs);
      if (pending) pending.longtasks++;
      log('longtask', `${ev.durMs}ms`);
      break;
    case 'action':
      startAction(ev.action, ev.target, ev.href);
      break;
    case 'mark': {
      const a = pending ?? responses.at(-1);
      if (!a) { log('mark', 'F2 pressed, but no action recorded yet'); break; }
      a.markMs = now() - (pending ? pending.t : a.t + T0);
      log('mark', `YOU marked ready ${a.markMs}ms after ${a.action} ${a.target}${pending ? '' : ' — ' + ruleSummary(a)}`);
      break;
    }
    case 'scanStats':
      if (ev.maxMs > scanStatsMax.maxMs) scanStatsMax = { avgMs: ev.avgMs, maxMs: ev.maxMs };
      break;
  }
}

function attachPage(page) {
  pageIds.set(page, pageIds.size + 1);
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) log('nav', route(f.url())); });
  page.on('close', () => { if (context.pages().length === 0) finish('browser window closed'); });
}

// ─── Launch ───────────────────────────────────────────────────────────────────

const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
const context = await browser.newContext({ viewport: null });
await context.exposeBinding('__uivisorReport', (source, ev) => onReport(source.page, ev));
await context.addInitScript(INIT_SCRIPT);
context.on('page', attachPage);

context.on('request', (req) => {
  const rt = req.resourceType();
  const type = rt === 'xhr' || rt === 'fetch' ? 'api' : rt === 'script' ? 'chunk' : null;
  if (!type) return;
  const ignored = isIgnored(req.url());
  inflight.set(req, { start: now(), key: epKey(req.method(), req.url()), type, ignored });
  if (pending && !ignored) type === 'api' ? pending.apiCalls++ : pending.chunks++;
});
const onReqEnd = async (req, failed) => {
  const info = inflight.get(req);
  if (!info) return;
  inflight.delete(req);
  const t = now();
  if (!info.ignored) last[info.type] = t;
  const dur = t - info.start;
  const status = failed ? 'FAILED' : ((await req.response().catch(() => null))?.status() ?? '?');
  const ep = endpoints.get(info.key) ?? { count: 0, durations: [], statuses: new Set(), background: 0, ignored: info.ignored, type: info.type };
  ep.count++; ep.durations.push(dur); ep.statuses.add(String(status));
  if (!pending && info.start - lastActionAt > 1000) ep.background++;
  endpoints.set(info.key, ep);
  if (!info.ignored) log(info.type, `${info.key} ${status} ${dur}ms`);   // ignored traffic: summary only
};
context.on('requestfinished', (r) => onReqEnd(r, false));
context.on('requestfailed', (r) => onReqEnd(r, true));

const page = await context.newPage();
log('info', `assessment v2 started — log: ${logPath}`);
log('info', `rules: ${RULES.map((r) => r.name).join(' · ')}`);
await page.goto(START_URL).catch((e) => log('info', `goto failed: ${e.message}`));

// ─── Summary ──────────────────────────────────────────────────────────────────

let finished = false;
function stats(arr) {
  if (!arr.length) return { n: 0 };
  const s = [...arr].sort((a, b) => a - b);
  return { n: s.length, min: s[0], avg: Math.round(s.reduce((a, b) => a + b, 0) / s.length), p95: s[Math.floor(s.length * 0.95)], max: s.at(-1) };
}
function finish(reason) {
  if (finished) return;
  finished = true;
  if (pending) finalize('session ended');
  const L = [];
  L.push('', '═'.repeat(78), `SUMMARY (${reason})`, '═'.repeat(78));

  // Rule scoring against F2 marks. Human reaction time is ~300–500ms, so "you" is expected
  // to be a bit LATER than a correct rule. A rule is EARLY (missed loading) if it says ready
  // >700ms before you, and LATE (over-waits) if it says ready >1500ms after you.
  const marked = responses.filter((r) => r.markMs !== undefined);
  L.push('', `Rule scoring against your ${marked.length} F2 marks (early = ready >700ms before you → missed loading; late = >1500ms after you → over-waits):`);
  L.push('  ' + 'rule'.padEnd(26) + 'early'.padStart(6) + 'late'.padStart(6) + '  median(you − rule)' + '   avg responseMs (all actions)');
  for (const rule of RULES) {
    const diffs = marked.filter((r) => r.rules[rule.name] !== null).map((r) => r.markMs - r.rules[rule.name]);
    const early = diffs.filter((d) => d > 700).length;
    const late = diffs.filter((d) => d < -1500).length;
    const med = diffs.length ? [...diffs].sort((a, b) => a - b)[Math.floor(diffs.length / 2)] : NaN;
    const all = responses.map((r) => r.rules[rule.name]).filter((v) => v !== null);
    const never = responses.filter((r) => r.rules[rule.name] === null && r.outcome !== 'interrupted').length;
    L.push('  ' + rule.name.padEnd(26) + String(early).padStart(6) + String(late).padStart(6) + `  ${String(med).padStart(8)}ms` + `           ${stats(all).avg}ms${never ? `  (never settled: ${never})` : ''}`);
  }

  L.push('', 'Marked actions in detail:');
  for (const r of marked) {
    L.push(`  YOU ${String(r.markMs).padStart(5)}ms | ${ruleSummary(r)}  ${r.action} ${r.target}  @ ${r.route}`);
  }

  L.push('', 'Loader indicators:');
  for (const [ind, st] of indicatorStats) {
    const s = stats(st.durations);
    L.push(`  ${ind}: ${st.count}x, blinks(<${BLINK_MS}ms) ${st.blinks}, ms min/avg/p95/max ${s.min}/${s.avg}/${s.p95}/${s.max}`);
  }

  L.push('', 'API endpoints, slowest first (IGN = ignored):');
  const eps = [...endpoints.entries()].filter(([, e]) => e.type === 'api').sort((a, b) => stats(b[1].durations).max - stats(a[1].durations).max);
  for (const [k, ep] of eps.slice(0, 25)) {
    const s = stats(ep.durations);
    L.push(`  ${ep.ignored ? 'IGN' : '   '} ${String(ep.count).padStart(4)}x  avg ${String(s.avg).padStart(5)}ms  max ${String(s.max).padStart(5)}ms  [${[...ep.statuses].join(',')}]  ${k}`);
  }

  L.push('', `In-page scan cost (worst 10s window): avg ${scanStatsMax.avgMs}ms, max ${scanStatsMax.maxMs}ms per mutation batch`);
  const text = L.join('\n');
  console.log(text);
  logStream.write(text + '\n');
  fs.writeFileSync(jsonPath, JSON.stringify({
    startUrl: START_URL, rules: RULES, events, responses,
    endpoints: Object.fromEntries([...endpoints].map(([k, v]) => [k, { ...v, statuses: [...v.statuses], stats: stats(v.durations) }])),
  }, null, 2));
  logStream.end(() => browser.close().catch(() => {}).finally(() => process.exit(0)));
}
process.on('SIGINT', () => finish('Ctrl+C'));
browser.on('disconnected', () => finish('browser disconnected'));
