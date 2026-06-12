/*
 * pixelize — the PIXEL-ART POST-PROCESSOR (an engine art tool). Phaser's Pixel
 * Studio is an interactive web app (no headless API), so this is our own: it
 * turns any render (Gemini output, keyed PNG) into genuine chunky pixel art —
 * downscale to a coarse pixel grid (nearest), quantize to a limited palette
 * (posterize), snap alpha hard, then upscale nearest-neighbour. The result is
 * cohesive 16-bit-style art regardless of how faithfully the model "drew pixels".
 *
 *   node pixelize.mjs <file.png|jpg> [...more]            # in place (PNG out)
 *   PIX_H=96 PIX_LEVELS=6 PIX_SCALE=4 node pixelize.mjs … # tune grid/palette
 *
 * PIX_H      target pixel-grid height (default 96 — character scale)
 * PIX_LEVELS posterize levels per channel (default 6 ≈ a 216-colour ceiling;
 *            real palettes land far smaller because forest art clusters)
 * PIX_SCALE  nearest-neighbour upscale factor for crisp display (default 4)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: node pixelize.mjs <img> [...]'); process.exit(2); }
const H = +(process.env.PIX_H || 96), LEVELS = +(process.env.PIX_LEVELS || 6), SCALE = +(process.env.PIX_SCALE || 4);

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
for (const f of files) {
  const abs = path.resolve(f);
  const b64 = readFileSync(abs).toString('base64');
  const mime = /\.jpe?g$/i.test(abs) ? 'image/jpeg' : 'image/png';
  const out = await page.evaluate(async ({ b64, mime, H, LEVELS, SCALE }) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = `data:${mime};base64,${b64}`; });
    const w = Math.max(8, Math.round(img.width * (H / img.height))), h = H;
    const small = document.createElement('canvas'); small.width = w; small.height = h;
    const sg = small.getContext('2d', { willReadFrequently: true });
    sg.imageSmoothingEnabled = true;                       // average down INTO the coarse grid
    sg.drawImage(img, 0, 0, w, h);
    const d = sg.getImageData(0, 0, w, h), q = 255 / (LEVELS - 1);
    for (let i = 0; i < d.data.length; i += 4) {
      d.data[i] = Math.round(d.data[i] / q) * q;           // posterize r,g,b
      d.data[i + 1] = Math.round(d.data[i + 1] / q) * q;
      d.data[i + 2] = Math.round(d.data[i + 2] / q) * q;
      d.data[i + 3] = d.data[i + 3] < 128 ? 0 : 255;       // hard pixel alpha
    }
    sg.putImageData(d, 0, 0);
    const big = document.createElement('canvas'); big.width = w * SCALE; big.height = h * SCALE;
    const bg = big.getContext('2d');
    bg.imageSmoothingEnabled = false;                      // crisp nearest-neighbour up
    bg.drawImage(small, 0, 0, big.width, big.height);
    return big.toDataURL('image/png').split(',')[1];
  }, { b64, mime, H, LEVELS, SCALE });
  const dst = abs.replace(/\.(png|jpe?g)$/i, '.png');
  writeFileSync(dst, Buffer.from(out, 'base64'));
  console.log(`  ✔ pixelized ${path.basename(dst)} (grid h=${H}, ${LEVELS} levels, ×${SCALE})`);
}
await browser.close();
