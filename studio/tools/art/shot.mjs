// Quick local screenshot of a Studio game (no full gate).
// usage: node shot.mjs <gameDir> <out.png> [steps] [renderer]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { chromium } from 'playwright';
const game = path.resolve(process.argv[2]); const out = path.resolve(process.argv[3]);
const steps = +(process.argv[4] || 160); const r = process.argv[5] || 'webgl';
const SRC = path.join(game, 'src');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
  const f = path.join(SRC, u); if (!f.startsWith(SRC) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto(`${BASE}/?r=${r}`, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ready === true, { timeout: 30000 });
await p.evaluate((n) => window.__run(n), steps);
await p.screenshot({ path: out, timeout: 90000 });
console.log('shot saved', out, '| pageerrors:', errs.slice(0, 3));
await b.close(); server.close();
