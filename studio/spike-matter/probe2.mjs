/* Pin down EXACTLY what differs between trials when rawΔ=0 but JSON differs. */
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
  const state = await page.evaluate((steps) => { window.__rec.begin(); window.__rec.step(steps); return window.__stateRaw(); }, n);
  await page.close();
  return state;
}
const a = await runRaw('canvas', 1000);
const b = await runRaw('canvas', 1000);
await browser.close(); server.close();
for (let i = 0; i < a.length; i++) {
  for (const k of ['x', 'y', 'angle']) {
    if (a[i][k] !== b[i][k] || Object.is(a[i][k], -0) !== Object.is(b[i][k], -0)) {
      console.log(`${a[i].label}.${k}: A=${a[i][k]} (is-0:${Object.is(a[i][k], -0)})  B=${b[i][k]} (is-0:${Object.is(b[i][k], -0)})  bitsA=${doubleBits(a[i][k])} bitsB=${doubleBits(b[i][k])}`);
    }
  }
}
console.log('jsonEqual:', JSON.stringify(a) === JSON.stringify(b));
function doubleBits(x){ const buf=Buffer.alloc(8); buf.writeDoubleLE(x); return buf.toString('hex'); }
