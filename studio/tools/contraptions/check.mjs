/*
 * Contraption Playground verifier.
 *
 * Reuses the eval.mjs pattern (a tiny node:http static server + a headless
 * Playwright Chromium driven through ANGLE/SwiftShader so WebGL works without a
 * GPU). It serves THIS directory, loads index.html, waits for the scene to init
 * (window.__ready, set in app.js create()), asserts ZERO page errors, cycles the
 * tester through ALL contraption types (rebuilding the live scene each time and
 * stepping a few animation frames so the contraption actually MOVES), and writes
 * out/playground.png. Exits non-zero on any error.
 *
 * playwright resolves from studio/node_modules (../../node_modules).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out');
fs.mkdirSync(OUT, { recursive: true });

// playwright lives in studio/node_modules, two levels up from tools/contraptions
const require = createRequire(path.join(ROOT, '../../package.json'));
const { chromium } = require('playwright');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
});

const errors = [];
let result = { ok: false };
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 440 } });
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, { timeout: 20000 });

  // the registry types the playground exposes
  const types = await page.evaluate(() => window.Studio.Contraptions.types.slice());

  // cycle through EVERY contraption type: select it, rebuild the live scene, run
  // the scene long enough that the scripted tester walks onto the machine and
  // EXERCISES it (seesaw carry / launcher fire / crumble collapse), and capture
  // its meta + the live fun delta + the resulting contraption state.
  const perType = [];
  for (const t of types) {
    await page.evaluate((type) => {
      // mirror what the dropdown does: set type + its param defaults, rebuild.
      const PARAMS = {
        seesaw:   [0.16, 2.2], launcher: [920, 1.4], crumble: [26, 120]
      };
      const d = PARAMS[type] || [null, null];
      window.__pg.setSelection({ type, p1: d[0], p2: d[1] });
    }, t);
    // run the live scene ~2.5s so the tester reaches + triggers the contraption
    await page.waitForTimeout(2500);
    const info = await page.evaluate(() => ({
      sel: window.__pg.select(),
      meta: window.__pg.meta(),
      feel: window.__pg.feel(),
      state: window.__pg.contraptionState()
    }));
    perType.push({ type: t, meta: info.meta, funDelta: info.feel.delta, state: info.state });
  }

  // screenshot the live playground on the seesaw (its tilting plank is the most
  // visibly dynamic), after letting it settle a moment.
  await page.evaluate(() => window.__pg.setSelection({ type: 'seesaw', p1: 0.16, p2: 2.2 }));
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, 'playground.png') });

  // verify the canvas actually rendered something (not a black frame)
  const readback = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const off = document.createElement('canvas'); off.width = c.width; off.height = c.height;
    const ctx = off.getContext('2d');
    try {
      ctx.drawImage(c, 0, 0);
      const d = ctx.getImageData(0, 0, off.width, off.height).data; let nb = 0; const tot = d.length / 4;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 8 || d[i + 1] > 8 || d[i + 2] > 8) nb++;
      return { nonblackRatio: +(nb / tot).toFixed(4) };
    } catch (e) { return { err: String(e) }; }
  });

  await page.close();
  result = { ok: errors.length === 0, types, perType, readback };
} catch (e) {
  result = { ok: false, fatal: String(e) };
}

await browser.close();
server.close();

const pass = result.ok && errors.length === 0 && result.readback && result.readback.nonblackRatio > 0.02;
console.log(JSON.stringify({ pass, errors, result }, null, 2));
process.exit(pass ? 0 : 1);
