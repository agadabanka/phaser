/*
 * (1) Does divergence stay BOUNDED at a long horizon? 8 fresh webgl runs @3000 steps.
 * (2) Is a SINGLE page internally deterministic? Reload-free repeat: re-init the world
 *     in the SAME page twice and compare (isolates cross-context JIT effects).
 *     We can't reset Matter cheaply, so instead we run the SAME page's stepper twice
 *     by reloading via a fresh Game in one context is not trivial — so we test the
 *     practical thing: are two SEPARATE processes' worth of fresh runs ever > 0.05px?
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
  const p = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await p.goto(`${BASE}/?r=${r}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__ready === true, { timeout: 20000 });
  const s = await p.evaluate((steps) => { window.__rec.begin(); window.__rec.step(steps); return window.__stateRaw(); }, n);
  await p.close();
  return s;
}
// in-page determinism: step 1000, snapshot; then in a SECOND page step 1000 — already
// covered. Here: within ONE page, step 500 then 500 more and a fresh page stepping 1000
// should match IF the stepper itself is path-deterministic. Compare split vs whole.
async function splitVsWhole(r) {
  const p1 = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await p1.goto(`${BASE}/?r=${r}`, { waitUntil: 'load' }); await p1.waitForFunction(() => window.__ready === true);
  const whole = await p1.evaluate(() => { window.__rec.begin(); window.__rec.step(1000); return window.__stateRaw(); }); await p1.close();
  const p2 = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await p2.goto(`${BASE}/?r=${r}`, { waitUntil: 'load' }); await p2.waitForFunction(() => window.__ready === true);
  const split = await p2.evaluate(() => { window.__rec.begin(); window.__rec.step(500); window.__rec.step(500); return window.__stateRaw(); }); await p2.close();
  let mx = 0; for (let i = 0; i < whole.length; i++) for (const k of ['x', 'y', 'angle']) mx = Math.max(mx, Math.abs(whole[i][k] - split[i][k]));
  return mx;
}

const K = 8, N = 3000;
const ref = await runRaw('webgl', N); const refStr = JSON.stringify(ref);
let ident = 0, maxD = 0, worst = null;
for (let i = 1; i < K; i++) {
  const s = await runRaw('webgl', N);
  if (JSON.stringify(s) === refStr) { ident++; continue; }
  for (let j = 0; j < ref.length; j++) for (const k of ['x', 'y', 'angle']) { const d = Math.abs(ref[j][k] - s[j][k]); if (d > maxD) { maxD = d; worst = `${ref[j].label}.${k}`; } }
}
const svw = await splitVsWhole('webgl');
await browser.close(); server.close();
console.log('=== LONG HORIZON @' + N + ' (webgl, ' + K + ' fresh runs) ===');
console.log(`bit-identical-to-ref: ${ident + 1}/${K}; max raw Δ across divergent = ${maxD.toExponential(3)}${worst ? ' @' + worst : ''}`);
console.log('split(500+500) vs whole(1000), same stepper: maxΔ=' + svw.toExponential(3) + (svw === 0 ? '  (stepper is path-additive/exact)' : ''));
