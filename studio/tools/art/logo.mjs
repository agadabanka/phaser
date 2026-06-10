// logo.mjs — generate a game WORDMARK (the deepfin-style title lockup) with
// Gemini, chroma-key it, and land it at <game>/src/assets/menu/logo.png.
// The menu uses it when TH.menu.logo is declared; text-fallback otherwise.
//   node logo.mjs --game games/nimbus --style "chunky rounded cloud-white letters with a warm gold rim, soft sky-blue outline"
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { generateImage } from './gemini.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(HERE, '..', '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const gameDir = path.join(STUDIO, opt('--game', 'games/nimbus'));
const meta = JSON.parse(readFileSync(path.join(gameDir, 'GAME_META.json'), 'utf8'));
const style = opt('--style', 'bold chunky friendly game-logo letters');
const outDir = path.join(gameDir, 'src', 'assets', 'menu');
mkdirSync(outDir, { recursive: true });

const refs = [];
for (const r of ['src/assets/backdrop.jpg', 'src/assets/hero.png']) {
  const p = path.join(gameDir, r);
  if (existsSync(p)) refs.push({ base64: readFileSync(p).toString('base64'), mimeType: r.endsWith('png') ? 'image/png' : 'image/jpeg' });
}
const img = await generateImage(
  `A 2D game TITLE WORDMARK (logo lockup) that reads EXACTLY "${meta.name.toUpperCase()}" — ${style}. ` +
  `Match the palette and painterly mood of the reference images. Single line of large display lettering, ` +
  `highly readable, slight playful arc or bounce to the baseline is fine. ` +
  `FLAT SOLID MAGENTA (#ff00ff) background ONLY — every non-letter pixel pure magenta. No extra art, no characters, no border, no tagline.`,
  { refs, aspectRatio: '16:9' });

// chroma-key + trim (key.mjs recipe) and cap width at 900px
const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const p = await b.newPage();
const png = await p.evaluate(async (url) => {
  const im = new Image(); im.src = url; await im.decode();
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const id = x.getImageData(0, 0, c.width, c.height), d = id.data;
  let minX = c.width, minY = c.height, maxX = 0, maxY = 0;
  for (let q = 0; q < d.length; q += 4) {
    const r = d[q], g = d[q + 1], bl = d[q + 2];
    if (r > 120 && bl > 100 && g < Math.min(r, bl) - 22) d[q + 3] = 0;
    else { const px = (q / 4) % c.width, py = (q / 4 / c.width) | 0; if (px < minX) minX = px; if (px > maxX) maxX = px; if (py < minY) minY = py; if (py > maxY) maxY = py; }
  }
  x.putImageData(id, 0, 0);
  const pad = 8, w = Math.min(c.width - 1, maxX + pad) - Math.max(0, minX - pad) + 1, h = Math.min(c.height - 1, maxY + pad) - Math.max(0, minY - pad) + 1;
  const sc = Math.min(1, 900 / w);
  const o = document.createElement('canvas'); o.width = Math.round(w * sc); o.height = Math.round(h * sc);
  o.getContext('2d').drawImage(c, Math.max(0, minX - pad), Math.max(0, minY - pad), w, h, 0, 0, o.width, o.height);
  return o.toDataURL('image/png');
}, `data:${img.mimeType || 'image/png'};base64,${img.base64}`);
await b.close();
writeFileSync(path.join(outDir, 'logo.png'), Buffer.from(png.split(',')[1], 'base64'));
console.log('🪧', path.relative(STUDIO, path.join(outDir, 'logo.png')));
