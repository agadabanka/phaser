// Silhouette pass: add a dark 2px outline around the opaque content of keyed
// sprites/sheets so characters READ against the painterly backdrop (the
// art-cohesion judge's "indistinct silhouette" fix). Headless canvas — no
// native deps (key.mjs precedent). Originals are backed up to out/orig/.
// usage: node outline.mjs <img.png> [...]   (paths relative to studio root)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(HERE, '..', '..');
const ORIG = path.join(HERE, 'out', 'orig');
fs.mkdirSync(ORIG, { recursive: true });

const files = process.argv.slice(2).map((f) => (path.isAbsolute(f) ? f : path.join(STUDIO, f)));
if (!files.length) { console.error('usage: node outline.mjs <img.png> [...]'); process.exit(2); }

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
for (const f of files) {
  const backup = path.join(ORIG, path.basename(f));
  if (!fs.existsSync(backup)) fs.copyFileSync(f, backup);   // idempotent: outline the ORIGINAL
  const url = 'data:image/png;base64,' + fs.readFileSync(backup).toString('base64');
  const png = await page.evaluate(async (u) => {
    const im = new Image(); im.src = u; await im.decode();
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const id = x.getImageData(0, 0, c.width, c.height), d = id.data, W = c.width, H = c.height;
    const a = (xx, yy) => (xx < 0 || yy < 0 || xx >= W || yy >= H) ? 0 : d[(yy * W + xx) * 4 + 3];
    const R = 2, edges = [];
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
      if (a(xx, y) > 40) continue;                       // only paint over transparency
      let near = false;
      for (let dy = -R; dy <= R && !near; dy++) for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy > R * R) continue;
        if (a(xx + dx, y + dy) > 120) { near = true; break; }
      }
      if (near) edges.push((y * W + xx) * 4);
    }
    for (const p of edges) { d[p] = 26; d[p + 1] = 10; d[p + 2] = 6; d[p + 3] = 235; }  // warm near-black
    x.putImageData(id, 0, 0);
    return c.toDataURL('image/png');
  }, url);
  fs.writeFileSync(f, Buffer.from(png.split(',')[1], 'base64'));
  console.log('✔ outlined', path.relative(STUDIO, f), '(original kept in tools/art/out/orig/)');
}
await browser.close();
