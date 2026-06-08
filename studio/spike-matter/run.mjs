/*
 * SPIKE runner — Is Phaser-4 Matter deterministic under the Studio fixed-step stepper?
 *
 * Reuses the chromium + swiftshader/angle + tiny http-server pattern from
 * studio/games/ember/eval.mjs. Playwright resolves from studio/node_modules.
 *
 * For each of N in {600, 1000}:
 *   - open a FRESH page, step exactly N fixed steps, capture __state()
 *   - open a SECOND fresh page, do the same
 *   - DIFF the two final states: byte-identical? and max abs delta of x/y/angle.
 * Plus a headless WebGL non-black readback (drawImage -> nonblack ratio) like eval.mjs.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
// playwright lives in studio/node_modules (one level up from this spike dir)
const require = createRequire(path.join(ROOT, '..', 'package.json'));
const { chromium } = require('playwright');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
});

async function fresh(r) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${BASE}/?r=${r}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, { timeout: 20000 });
  page._errs = errors;
  return page;
}

// run N fixed steps on a fresh page, return the final __state()
async function runN(r, n) {
  const p = await fresh(r);
  const state = await p.evaluate((steps) => window.__runState(steps), n);
  const errs = p._errs.slice(0, 6);
  await p.close();
  return { state, errs };
}

// diff two state arrays -> { identical, maxDelta, worst }
function diffStates(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return { identical: false, maxDelta: Infinity, worst: 'length/shape mismatch' };
  }
  const identical = JSON.stringify(a) === JSON.stringify(b);   // BYTE-identical check
  let maxDelta = 0, worst = null;
  for (let i = 0; i < a.length; i++) {
    for (const k of ['x', 'y', 'angle']) {
      const d = Math.abs(a[i][k] - b[i][k]);
      if (d > maxDelta) { maxDelta = d; worst = `${a[i].label}.${k}: ${a[i][k]} vs ${b[i][k]} (Δ${d})`; }
    }
  }
  return { identical, maxDelta, worst };
}

async function determinismAt(r, n) {
  const r1 = await runN(r, n);
  const r2 = await runN(r, n);
  const d = diffStates(r1.state, r2.state);
  return {
    steps: n,
    identical: d.identical,
    maxDelta: d.maxDelta,
    worst: d.worst,
    sampleA: r1.state,
    sampleB: r2.state,
    errs: [...r1.errs, ...r2.errs].slice(0, 6)
  };
}

// headless WebGL non-black readback (same technique as ember/eval.mjs)
async function readback(r, n) {
  const p = await fresh(r);
  await p.evaluate((steps) => window.__runState(steps), n);
  const rb = await p.evaluate(() => {
    const c = document.querySelector('canvas');
    const off = document.createElement('canvas'); off.width = c.width; off.height = c.height;
    const ctx = off.getContext('2d');
    try {
      ctx.drawImage(c, 0, 0);
      const data = ctx.getImageData(0, 0, off.width, off.height).data;
      let nb = 0; const tot = data.length / 4;
      for (let i = 0; i < data.length; i += 4) if (data[i] > 8 || data[i + 1] > 8 || data[i + 2] > 8) nb++;
      return { w: c.width, h: c.height, nonblackRatio: +(nb / tot).toFixed(4) };
    } catch (e) { return { err: String(e) }; }
  });
  await p.screenshot({ path: path.join(ROOT, `shot-${r}.png`) });
  await p.close();
  return rb;
}

const out = { phaser: '4.1.0 (full dist, includes Matter)', config: 'matter customUpdate:true + autoUpdate:false, posIter12/velIter8/conIter4, sleeping off, fixed step 1000/60', renderers: {} };

for (const r of ['webgl', 'canvas']) {
  try {
    const det600 = await determinismAt(r, 600);
    const det1000 = await determinismAt(r, 1000);
    const rb = await readback(r, 200);
    out.renderers[r] = { det600, det1000, readback: rb };
  } catch (e) {
    out.renderers[r] = { fatal: String(e) };
  }
}

await browser.close();
server.close();

// trim the per-renderer state samples in the persisted file so it stays readable,
// but keep them inline in console for inspection.
fs.writeFileSync(path.join(ROOT, 'result.json'), JSON.stringify(out, null, 2));

// concise console summary
const sum = (r) => {
  const o = out.renderers[r]; if (!o || o.fatal) return `${r}: FATAL ${o && o.fatal}`;
  const f = (d) => `${d.steps}s: ${d.identical ? 'IDENTICAL' : 'DIVERGED'} (maxΔ=${d.maxDelta}${d.worst ? '; ' + d.worst : ''})`;
  return `${r}: ${f(o.det600)} | ${f(o.det1000)} | nonblack=${o.readback && o.readback.nonblackRatio}` +
    ((o.det600.errs && o.det600.errs.length) ? `\n   errs: ${o.det600.errs.join(' || ')}` : '');
};
console.log('=== MATTER DETERMINISM SPIKE ===');
console.log(out.config);
for (const r of ['webgl', 'canvas']) console.log(sum(r));
console.log('full result -> ' + path.join(ROOT, 'result.json'));
