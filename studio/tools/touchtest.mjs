// Functional check: does the on-screen joystick actually drive the hero?
// Manual mode (no autopilot); dispatch real pointer events on the stick + JUMP button.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { chromium } from 'playwright';
const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'games', 'ember', 'src');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((q, r) => { let u = q.url.split('?')[0]; if (u === '/') u = '/index.html'; const f = path.join(SRC, u); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
await new Promise(r => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
await p.goto(`${BASE}/?r=webgl`, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ready === true, { timeout: 20000 });

// ---- joystick drag RIGHT ----
await p.evaluate(() => { window.__game.reset(); window.__rec.begin(); }); // manual mode (auto=false)
const x0 = await p.evaluate(() => window.__game.snapshot().x);
await p.mouse.move(120, 454); await p.mouse.down(); await p.mouse.move(192, 454, { steps: 4 }); // stick center -> right
await p.evaluate(() => window.__rec.step(40));
const x1 = await p.evaluate(() => window.__game.snapshot().x);
await p.mouse.up();

// ---- JUMP button (land first; jump needs onGround) ----
await p.evaluate(() => { window.__game.reset(); window.__rec.begin(); window.__rec.step(40); }); // fall + land
const groundedY = await p.evaluate(() => window.__game.snapshot().y);
await p.mouse.move(864, 456); await p.mouse.down();
await p.evaluate(() => window.__rec.step(8));
const vy = await p.evaluate(() => window.__game.snapshot().vy);
await p.mouse.up();

console.log(JSON.stringify({
  joystick_right: { x_from: x0, x_to: x1, moved_right: x1 > x0 + 20 },
  jump_button: { vy: vy, jumped: vy < -100 }
}, null, 2));
await b.close(); server.close();
