/*
 * Phase 0 eval harness — proves the Phaser 4 spike is AI-evaluable headless.
 * Checks, per renderer (webgl + canvas):
 *   - determinism : two independent 600-step runs land byte-identical
 *   - 0-death gate: the autopilot completes the level with deaths === 0
 *   - readback    : the canvas is NOT black (drawImage->getImageData ratio + screenshot)
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const SPIKE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(SPIKE, 'out');
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') u = '/index.html';
  const f = path.join(SPIKE, u);
  if (!f.startsWith(SPIKE) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
});

async function evalRenderer(r) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${BASE}/?r=${r}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, { timeout: 20000 });

  const s1 = await page.evaluate(() => window.__run(600));
  const s2 = await page.evaluate(() => window.__run(600));
  const detKeys = ['x', 'y', 'vx', 'vy', 'frame', 'deaths', 'won'];
  const deterministic = detKeys.every(k => s1[k] === s2[k]);

  const gate = await page.evaluate(() => window.__gate(2400));

  await page.evaluate(() => window.__run(150)); // mid-level frame for the shot
  const readback = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const off = document.createElement('canvas'); off.width = c.width; off.height = c.height;
    const ctx = off.getContext('2d');
    try {
      ctx.drawImage(c, 0, 0);
      const d = ctx.getImageData(0, 0, off.width, off.height).data;
      let nonblack = 0; const total = d.length / 4;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 8 || d[i + 1] > 8 || d[i + 2] > 8) nonblack++;
      return { nonblackRatio: +(nonblack / total).toFixed(4), dataUrlLen: c.toDataURL().length, w: c.width, h: c.height };
    } catch (e) { return { err: String(e) }; }
  });
  await page.screenshot({ path: path.join(OUT, `shot-${r}.png`) });
  await page.close();
  return { renderer: r, deterministic, det: { s1, s2 }, gate, readback, errors: errors.slice(0, 6) };
}

const results = {};
for (const r of ['webgl', 'canvas']) {
  try { results[r] = await evalRenderer(r); }
  catch (e) { results[r] = { renderer: r, fatal: String(e) }; }
}
await browser.close();
server.close();

const ok = x => !!(x && x.deterministic && x.gate && x.gate.won && x.gate.deaths === 0 && x.readback && x.readback.nonblackRatio > 0.02);
const verdict = { webgl: ok(results.webgl), canvas: ok(results.canvas) };
const report = { verdict, results };
fs.writeFileSync(path.join(OUT, 'scorecard.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit((verdict.webgl || verdict.canvas) ? 0 : 1);
