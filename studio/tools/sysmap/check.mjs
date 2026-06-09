/*
 * Studio Sysmap headless verifier.
 *
 * Reuses studio/games/ember/eval.mjs's pattern: a tiny node:http static server +
 * headless Playwright Chromium through ANGLE/SwiftShader. NO Phaser needed (the
 * visualizer is vanilla SVG). It serves studio/ as the web ROOT (so the page's
 * relative fetches to ../../diary/diary.json and ../../lego/registry.json resolve),
 * loads tools/sysmap/index.html, then:
 *   - asserts ZERO page/console errors,
 *   - waits for window.__ready and asserts the graph RENDERED (node count > 0 in
 *     the SVG DOM AND on the data model),
 *   - exercises the interactions (a layout toggle + a focus) so they're smoke-tested,
 *   - screenshots tools/sysmap/out/sysmap.png.
 * Exits non-zero on any error / empty graph.
 *
 * playwright resolves from studio/node_modules (../../package.json).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// tools/sysmap -> studio root is two levels up; serve studio/ so ../../ resolves
const STUDIO_ROOT = path.resolve(HERE, '..', '..');
const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });

const require = createRequire(path.join(STUDIO_ROOT, 'package.json'));
const { chromium } = require('playwright');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') u = '/tools/sysmap/index.html';
  const f = path.join(STUDIO_ROOT, u);
  // confine to studio/ and refuse directories
  if (!f.startsWith(STUDIO_ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url() + ' ' + (r.failure() && r.failure().errorText)));

  await page.goto(`${BASE}/tools/sysmap/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, { timeout: 20000 });

  // the data model + the rendered DOM must both have nodes
  const counts = await page.evaluate(() => ({
    ready: !!(window.__sysmap && window.__sysmap.ready),
    nodes: window.__sysmap ? window.__sysmap.nodeCount() : 0,
    edges: window.__sysmap ? window.__sysmap.edgeCount() : 0,
    rendered: window.__sysmap ? window.__sysmap.rendered() : 0
  }));

  // smoke-test the interactions: toggle to force layout, then back, then focus a node
  await page.evaluate(() => window.__sysmap.setLayout('force'));
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__sysmap.setLayout('tier'));
  await page.waitForTimeout(200);
  // click a phase on the timeline (highlights its systems)
  const phaseClicked = await page.evaluate(() => {
    const cell = document.querySelector('#timeline .ph'); if (!cell) return false; cell.click(); return true;
  });
  // hover a node to surface the tooltip, then focus it
  await page.evaluate(() => window.__sysmap.focus('sdk'));
  await page.waitForTimeout(150);
  const focusOk = await page.evaluate(() => document.querySelectorAll('g.node.focus').length > 0);
  // clear back to a clean full view for the screenshot
  await page.evaluate(() => { document.querySelector('#resetBtn').click(); });
  await page.waitForTimeout(500);

  await page.screenshot({ path: path.join(OUT, 'sysmap.png') });

  await page.close();
  result = { ok: errors.length === 0, counts, phaseClicked, focusOk };
} catch (e) {
  result = { ok: false, fatal: String(e) };
}

await browser.close();
server.close();

// ---- verdict ----
const c = result.counts || {};
const graphRendered = !!(c.nodes > 0 && c.rendered > 0);
const pass = !!(result.ok && errors.length === 0 && c.ready && graphRendered && result.phaseClicked && result.focusOk && !result.fatal);

const report = {
  pass,
  errors,
  counts: result.counts,
  phaseClicked: result.phaseClicked,
  focusOk: result.focusOk,
  fatal: result.fatal,
  out: [path.join('out', 'sysmap.png')]
};
fs.writeFileSync(path.join(OUT, 'check-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(pass ? 0 : 1);
