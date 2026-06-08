/*
 * Characterize the magnitude & growth of Matter's run-to-run float divergence.
 * 3 fresh trials per renderer at {300, 600, 1000} steps, FULL precision.
 * Reports max pairwise raw delta (overall) + the single worst body, AND the worst
 * delta restricted to the CONSTRAINT contraption bodies (plank/weight/bob) vs the
 * free-stacked boxes — to show where the chaos lives.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(ROOT, '..', 'package.json'));
const { chromium } = require('playwright');
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': u.endsWith('.js') ? 'text/javascript' : 'text/html' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function runRaw(r, n) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.goto(`${BASE}/?r=${r}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, { timeout: 20000 });
  const s = await page.evaluate((steps) => { window.__rec.begin(); window.__rec.step(steps); return window.__stateRaw(); }, n);
  await page.close();
  return s;
}
const STACK = new Set(['box0', 'box1', 'box2', 'box3', 'flyer']);
const CONSTR = new Set(['plank', 'weight', 'bob']);
function worstAcross(states) {
  // max abs delta of any trial vs trial0, split by body class
  let all = 0, stack = 0, constr = 0, wAll = null;
  const base = states[0];
  for (let t = 1; t < states.length; t++) for (let i = 0; i < base.length; i++) for (const k of ['x', 'y', 'angle']) {
    const d = Math.abs(base[i][k] - states[t][k]); const lab = base[i].label;
    if (d > all) { all = d; wAll = `${lab}.${k}`; }
    if (STACK.has(lab) && d > stack) stack = d;
    if (CONSTR.has(lab) && d > constr) constr = d;
  }
  const ident = states.every(s => JSON.stringify(s) === JSON.stringify(base));
  return { ident, all, wAll, stack, constr };
}
const TR = 3;
const rows = [];
for (const r of ['webgl', 'canvas']) for (const n of [300, 600, 1000]) {
  const states = [];
  for (let i = 0; i < TR; i++) states.push(await runRaw(r, n));
  const w = worstAcross(states);
  rows.push({ r, n, ...w });
}
await browser.close(); server.close();
console.log('=== RAW divergence across ' + TR + ' fresh trials ===');
for (const x of rows) console.log(
  `${x.r} @${x.n}: ${x.ident ? 'BIT-IDENTICAL' : 'diverged'}  maxΔ=${x.all.toExponential(2)} (${x.wAll})  stackΔ=${x.stack.toExponential(2)}  constraintΔ=${x.constr.toExponential(2)}`
);
