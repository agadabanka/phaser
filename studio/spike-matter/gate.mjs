/*
 * GATE-RELEVANT verdict: does a TOLERANCED snapshot stay stable across fresh runs?
 * Gameplay/collision cares about ~pixel scale, not 1e-3 px. Quantize positions to
 * INTEGER pixels and angles to 0.01 rad, then check if the quantized state is stable
 * across 12 fresh runs at 600 and 1000 steps, for both renderers.
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
const quant = (st) => st.map(b => `${b.label}:${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.angle * 100)}`).join('|');
const K = 12;
const out = {};
for (const r of ['webgl', 'canvas']) for (const n of [600, 1000]) {
  const seen = new Map();
  for (let i = 0; i < K; i++) { const q = quant(await runRaw(r, n)); seen.set(q, (seen.get(q) || 0) + 1); }
  out[`${r}@${n}`] = { distinctQuantizedStates: seen.size, distribution: [...seen.values()].sort((a, b) => b - a) };
}
await browser.close(); server.close();
console.log('=== TOLERANCED (1px / 0.01rad) STABILITY over ' + K + ' fresh runs ===');
for (const k of Object.keys(out)) console.log(`${k}: ${out[k].distinctQuantizedStates} distinct state(s); counts=${JSON.stringify(out[k].distribution)}  ${out[k].distinctQuantizedStates === 1 ? 'STABLE' : 'UNSTABLE at 1px'}`);
fs.writeFileSync(path.join(ROOT, 'gate.json'), JSON.stringify(out, null, 2));
