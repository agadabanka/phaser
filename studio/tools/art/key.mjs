// Chroma-key the magenta field out of generated sprites + trim to content.
// Uses headless Chromium (already installed) — no native image deps.
// Recipe tolerates Gemini's pink<->magenta JPEG drift: bg if R>120 && B>100 && G < min(R,B)-22.
// usage: node key.mjs <in.jpg:out.png> [...]   (paths relative to games/ember/)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const EMBER = new URL('../../games/ember/', import.meta.url);
const jobs = process.argv.slice(2).map(s => { const [i, o] = s.split(':'); return { i, o }; });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();

for (const { i, o } of jobs) {
  const buf = readFileSync(new URL(i, EMBER));
  const mime = i.endsWith('png') ? 'image/png' : 'image/jpeg';
  const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
  const res = await page.evaluate(async (url) => {
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const id = ctx.getImageData(0, 0, c.width, c.height), d = id.data;
    let minX = c.width, minY = c.height, maxX = 0, maxY = 0, kept = 0;
    for (let p = 0; p < d.length; p += 4) {
      const r = d[p], g = d[p + 1], b = d[p + 2];
      if (r > 120 && b > 100 && g < Math.min(r, b) - 22) { d[p + 3] = 0; }
      else { const px = (p / 4) % c.width, py = (p / 4 / c.width) | 0; if (px < minX) minX = px; if (px > maxX) maxX = px; if (py < minY) minY = py; if (py > maxY) maxY = py; kept++; }
    }
    ctx.putImageData(id, 0, 0);
    const pad = 6;
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
    maxX = Math.min(c.width - 1, maxX + pad); maxY = Math.min(c.height - 1, maxY + pad);
    const w = maxX - minX + 1, h = maxY - minY + 1;
    const maxH = 256, s = Math.min(1, maxH / h), ow = Math.round(w * s), oh = Math.round(h * s);
    const out = document.createElement('canvas'); out.width = ow; out.height = oh;
    const octx = out.getContext('2d'); octx.imageSmoothingQuality = 'high'; octx.drawImage(c, minX, minY, w, h, 0, 0, ow, oh);
    return { dataUrl: out.toDataURL('image/png'), w: ow, h: oh, kept };
  }, dataUrl);
  mkdirSync(new URL(o.split('/').slice(0, -1).join('/') + '/', EMBER), { recursive: true });
  writeFileSync(new URL(o, EMBER), Buffer.from(res.dataUrl.split(',')[1], 'base64'));
  console.log(`keyed ${i} -> ${o}  (${res.w}x${res.h}, ${res.kept}px kept)`);
}
await browser.close();
