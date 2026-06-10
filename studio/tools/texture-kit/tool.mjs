/*
 * texture-kit — the RUN step for capability "texturing".
 *
 * Closes the gap the art-cohesion judge keeps flagging: games had a painterly
 * AI backdrop but PLACEHOLDER foreground tiles (the #1 cohesion killer). This
 * brick generates a style-MATCHED kit from the game's own backdrop:
 *
 *   - material tiles  kit_stone / kit_mud / kit_ice / kit_lava — Gemini image
 *     with the backdrop as a style REF, then composited into a 2×2 MIRROR QUILT
 *     so the tile is seamless BY CONSTRUCTION (the validator's seam check has
 *     teeth, and this tool passes it mechanically, not hopefully);
 *   - themed sprites  kit_coin / kit_spring / kit_goal — generated on a solid
 *     magenta field, chroma-keyed + trimmed (same recipe as tools/art/key.mjs).
 *
 * Output goes INTO THE GAME at <game>/src/assets/kit/ (plus out/ previews +
 * out/contact.png). Deterministic: NO (generative). Gate: validate.mjs.
 *
 *   node tool.mjs --game games/<name> [--mats stone,mud,ice,lava] [--sprites coin,spring,goal]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { generateImage, geminiConfigured } from '../art/gemini.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(HERE, '..', '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const gameArg = opt('--game', null);
if (!gameArg) { console.error('usage: node tool.mjs --game games/<name>'); process.exit(2); }
const gameDir = path.isAbsolute(gameArg) ? gameArg : (fs.existsSync(path.resolve(gameArg)) ? path.resolve(gameArg) : path.join(STUDIO, gameArg));
const assets = path.join(gameDir, 'src', 'assets');
const kitDir = path.join(assets, 'kit');
const outDir = path.join(HERE, 'out');
fs.mkdirSync(kitDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

if (!geminiConfigured()) { console.error('texture-kit: Gemini creds missing (GEMINI_SA_JSON / GEMINI_API_KEY)'); process.exit(1); }
const backdropPath = ['backdrop.jpg', 'backdrop.png'].map((f) => path.join(assets, f)).find(fs.existsSync);
if (!backdropPath) { console.error('texture-kit: no backdrop.(jpg|png) in ' + assets + ' — the kit is style-anchored to the backdrop'); process.exit(1); }
const meta = JSON.parse(fs.readFileSync(path.join(gameDir, 'GAME_META.json'), 'utf8'));
const ref = { base64: fs.readFileSync(backdropPath).toString('base64'), mimeType: backdropPath.endsWith('png') ? 'image/png' : 'image/jpeg' };

const MAT_DESC = {
  stone: 'volcanic basalt cave rock, dark warm grey-brown with faint glowing orange cracks',
  mud: 'dark sticky volcanic mud, deep umber with wet glints and small embedded pebbles',
  ice: 'glassy pale blue-white cave ice with cracks, catching warm orange reflected light from lava',
  lava: 'molten lava, incandescent orange-yellow fissures over a dark cooling crust',
};
const SPRITE_DESC = {
  coin: 'a small round glowing ember-shard amulet pickup, warm orange gem with a bright molten core',
  spring: 'a compact stone geyser bounce-pad seen from the side, a squat basalt nozzle venting a soft orange glow upward',
  goal: 'an ancient glowing cave gate, a tall narrow stone archway filled with warm amber light',
};
const mats = (opt('--mats', 'stone,mud,ice,lava')).split(',').filter((m) => MAT_DESC[m]);
const sprites = (opt('--sprites', 'coin,spring,goal')).split(',').filter((s) => SPRITE_DESC[s]);

const matPrompt = (m) => `Seamless tileable game texture of ${MAT_DESC[m]}, for the FLOOR of a 2D platformer called "${meta.name}". Match EXACTLY the painterly hand-painted style, warm molten-cave palette and lighting of the reference image. Uniform flat lighting across the whole square: no vignette, no border, no frame, no text, no perspective — a flat top-lit surface filling the entire image. Detail scale: individual features about 1/8 of the image width so it still reads when tiled small.`;
const spritePrompt = (s) => `${SPRITE_DESC[s]}, a single game object centered on a SOLID UNIFORM MAGENTA (#FF00FF) background. Match the painterly hand-painted style and warm molten-cave palette of the reference image. The object fills ~70% of the frame. No shadow on the background, no text, no border.`;

console.log(`🎨 texture-kit for ${meta.name} — style ref: ${path.relative(gameDir, backdropPath)}`);
const raw = {}; // name -> { kind, base64, mimeType }
for (const m of mats) {
  process.stdout.write(`   gen tile ${m} ... `);
  raw['kit_' + m] = { kind: 'tile', ...(await generateImage(matPrompt(m), { refs: [ref], aspectRatio: '1:1' })) };
  console.log('ok');
}
for (const s of sprites) {
  process.stdout.write(`   gen sprite ${s} ... `);
  raw['kit_' + s] = { kind: 'sprite', ...(await generateImage(spritePrompt(s), { refs: [ref], aspectRatio: '1:1' })) };
  console.log('ok');
}

// ---- post-process in headless canvas (no native image deps — key.mjs precedent) ----
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const results = [];
for (const [name, img] of Object.entries(raw)) {
  const dataUrl = `data:${img.mimeType || 'image/png'};base64,${img.base64}`;
  const png = await page.evaluate(async ({ url, kind }) => {
    const im = new Image(); im.src = url; await im.decode();
    const c = document.createElement('canvas');
    if (kind === 'tile') {
      // 512 base -> 1024 2×2 mirror quilt: seamless by construction (every edge
      // meets its own mirror image, so wrap-around is continuous).
      const B = 512; c.width = B * 2; c.height = B * 2;
      const x = c.getContext('2d');
      const blit = (fx, fy, dx, dy) => { x.save(); x.translate(dx + (fx ? B : 0), dy + (fy ? B : 0)); x.scale(fx ? -1 : 1, fy ? -1 : 1); x.drawImage(im, 0, 0, B, B); x.restore(); };
      blit(0, 0, 0, 0); blit(1, 0, B, 0); blit(0, 1, 0, B); blit(1, 1, B, B);
      // tiles are opaque -> JPEG (~10x smaller than PNG; the mirror quilt keeps
      // opposite edges symmetric so JPEG block noise stays inside the seam gate).
      return c.toDataURL('image/jpeg', 0.85);
    }
    // sprite: chroma-key the magenta field (tolerant of JPEG pink drift), trim, pad.
    c.width = im.width; c.height = im.height;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const id = x.getImageData(0, 0, c.width, c.height), d = id.data;
    let minX = c.width, minY = c.height, maxX = 0, maxY = 0;
    for (let p = 0; p < d.length; p += 4) {
      const r = d[p], g = d[p + 1], b = d[p + 2];
      if (r > 120 && b > 100 && g < Math.min(r, b) - 22) d[p + 3] = 0;
      else { const px = (p / 4) % c.width, py = (p / 4 / c.width) | 0; if (px < minX) minX = px; if (px > maxX) maxX = px; if (py < minY) minY = py; if (py > maxY) maxY = py; }
    }
    x.putImageData(id, 0, 0);
    const pad = 6;
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
    maxX = Math.min(c.width - 1, maxX + pad); maxY = Math.min(c.height - 1, maxY + pad);
    const w = maxX - minX + 1, h = maxY - minY + 1;
    const scale = Math.min(1, 160 / Math.max(w, h));   // game-sized: <=160px
    const o = document.createElement('canvas'); o.width = Math.round(w * scale); o.height = Math.round(h * scale);
    o.getContext('2d').drawImage(c, minX, minY, w, h, 0, 0, o.width, o.height);
    return o.toDataURL('image/png');
  }, { url: dataUrl, kind: img.kind });
  const buf = Buffer.from(png.split(',')[1], 'base64');
  const ext = img.kind === 'tile' ? '.jpg' : '.png';
  fs.writeFileSync(path.join(kitDir, name + ext), buf);
  fs.writeFileSync(path.join(outDir, name + ext), buf);
  results.push({ name: name + ext, kind: img.kind, bytes: buf.length });
  console.log(`   ✔ ${name}${ext}  (${img.kind}, ${(buf.length / 1024).toFixed(0)}kB)`);
}

// contact sheet for a one-glance review
const contact = await page.evaluate(async (items) => {
  const cell = 220, c = document.createElement('canvas');
  c.width = cell * items.length; c.height = cell + 28;
  const x = c.getContext('2d'); x.fillStyle = '#181210'; x.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < items.length; i++) {
    const im = new Image(); im.src = items[i].url; await im.decode();
    const s = Math.min(cell / im.width, cell / im.height);
    x.drawImage(im, i * cell + (cell - im.width * s) / 2, (cell - im.height * s) / 2, im.width * s, im.height * s);
    x.fillStyle = '#ffd9a0'; x.font = '13px monospace'; x.textAlign = 'center';
    x.fillText(items[i].name, i * cell + cell / 2, cell + 18);
  }
  return c.toDataURL('image/png');
}, results.map((r) => ({ name: r.name, url: `data:image/${r.name.endsWith('.jpg') ? 'jpeg' : 'png'};base64,` + fs.readFileSync(path.join(kitDir, r.name)).toString('base64') })));
fs.writeFileSync(path.join(outDir, 'contact.png'), Buffer.from(contact.split(',')[1], 'base64'));
await browser.close();

fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify({ capability: 'texturing', name: 'texture-kit', game: path.basename(gameDir), kitDir: path.relative(STUDIO, kitDir), generated: results }, null, 2) + '\n');
console.log(`📦 kit -> ${path.relative(STUDIO, kitDir)}  ·  preview: tools/texture-kit/out/contact.png`);
console.log('   next: node validate.mjs --game ' + gameArg);
