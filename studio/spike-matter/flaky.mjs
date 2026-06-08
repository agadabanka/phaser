/*
 * Is the divergence INTERMITTENT? Take K fresh runs per renderer @1000 steps,
 * pick run[0] as reference, count how many of the other (K-1) are bit-identical
 * to it, and record the max raw delta among the divergent ones.
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
const K = 10, N = 1000;
const out = {};
for (const r of ['webgl', 'canvas']) {
  const ref = await runRaw(r, N);
  const refStr = JSON.stringify(ref);
  let identical = 0, diverged = 0, maxD = 0, worst = null;
  for (let i = 1; i < K; i++) {
    const s = await runRaw(r, N);
    if (JSON.stringify(s) === refStr) { identical++; continue; }
    diverged++;
    for (let j = 0; j < ref.length; j++) for (const k of ['x', 'y', 'angle']) {
      const d = Math.abs(ref[j][k] - s[j][k]);
      if (d > maxD) { maxD = d; worst = `${ref[j].label}.${k}`; }
    }
  }
  out[r] = { trials: K, matchedRef: identical + 1, diverged, maxRawDelta: maxD, worst };
}
await browser.close(); server.close();
console.log('=== INTERMITTENCY: ' + K + ' fresh runs @' + N + ' steps, vs run[0] ===');
for (const r of ['webgl', 'canvas']) {
  const o = out[r];
  console.log(`${r}: ${o.matchedRef}/${o.trials} bit-identical to run[0]; ${o.diverged} diverged (maxΔ=${o.maxRawDelta.toExponential(3)}${o.worst ? ' @' + o.worst : ''})`);
}
fs.writeFileSync(path.join(ROOT, 'flaky.json'), JSON.stringify(out, null, 2));
