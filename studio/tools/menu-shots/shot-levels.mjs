// menu-shots — screenshot EVERY level of a game for the menu's zone-rail cards
// (the deepfin pattern: each card is a real mini-scene of its level, always in
// sync because it IS the level). Uses the additive __game.gotoLevel(i) hook.
//   node shot-levels.mjs --game games/nimbus
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(HERE, '..', '..');
const require = createRequire(path.join(STUDIO, 'package.json'));
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const gameDir = path.join(STUDIO, opt('--game', 'games/nimbus'));
const srcDir = path.join(gameDir, 'src');
const outDir = path.join(srcDir, 'assets', 'menu');
fs.mkdirSync(outDir, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
  const f = path.join(srcDir, u);
  if (!f.startsWith(srcDir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto(BASE + '/', { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => window.__ready === true, { timeout: 20000 });
const n = await page.evaluate(() => (window.LEVELS || []).length);
for (let i = 0; i < n; i++) {
  await page.evaluate((k) => { window.__game.gotoLevel(k); }, i);
  await page.waitForTimeout(700);                       // settle: camera, particles, toast fade-in
  const shot = await page.screenshot({ timeout: 90000 });
  // downscale to a 560x150-ish wide card crop (center band) via canvas in-page
  const b64 = await page.evaluate(async (raw) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + raw; await im.decode();
    const c = document.createElement('canvas'); c.width = 560; c.height = 150;
    const x = c.getContext('2d');
    x.drawImage(im, 0, 120, 960, 257, 0, 0, 560, 150);  // middle band of the frame
    return c.toDataURL('image/jpeg', 0.82).split(',')[1];
  }, shot.toString('base64'));
  fs.writeFileSync(path.join(outDir, 'level-' + i + '.jpg'), Buffer.from(b64, 'base64'));
  console.log('  ✔ assets/menu/level-' + i + '.jpg');
}
await browser.close(); server.close();
console.log('📇 zone cards →', path.relative(STUDIO, outDir));
