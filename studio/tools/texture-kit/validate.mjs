/*
 * texture-kit — the VALIDATOR for capability "texturing".  THE GATE.
 *
 * Judges the kit a game actually ships (<game>/src/assets/kit/), with
 * MEASUREMENTS, not vibes — and fully deterministic (no network, no Gemini):
 *
 *   tiles  kit_stone / kit_mud / kit_ice / kit_lava
 *     - size       >= 512px square
 *     - seamless   mean |edge - opposite edge| < 8/255 on both axes (the mirror
 *                  quilt makes this ~0; a non-tileable texture fails hard)
 *     - energy     luminance stddev >= 8 (a flat placeholder fill fails)
 *     - affinity   hue-histogram cosine similarity vs the game's own BACKDROP;
 *                  gated on the KIT MEAN (>= 0.35) so one intentionally cool
 *                  accent (ice) can't sink the kit, but a palette that ignores
 *                  the backdrop fails
 *   sprites  kit_coin / kit_spring / kit_goal
 *     - alpha coverage in 8–90% (keyed + trimmed, not empty / not un-keyed)
 *     - content bbox >= 24px
 *
 * A game with NO kit dir passes with a note: the gate judges this brick's
 * OUTPUT where it exists; procedural-art games simply don't carry one.
 *
 *   node validate.mjs --game games/<name>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(HERE, '..', '..');
const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };

function emit(verdict, code) {
  fs.writeFileSync(path.join(OUT, 'verdict.json'), JSON.stringify(verdict, null, 2) + '\n');
  console.log(JSON.stringify(verdict, null, 2));
  process.exit(code);
}

const gameArg = opt('--game', null);
if (!gameArg) emit({ pass: false, score: 0, capability: 'texturing', notes: ['usage: node validate.mjs --game games/<name>'] }, 2);
const gameDir = path.isAbsolute(gameArg) ? gameArg : (fs.existsSync(path.resolve(gameArg)) ? path.resolve(gameArg) : path.join(STUDIO, gameArg));
const assets = path.join(gameDir, 'src', 'assets');
const kitDir = path.join(assets, 'kit');
if (!fs.existsSync(gameDir)) emit({ pass: false, score: 0, capability: 'texturing', notes: [`no such game dir: ${gameDir}`] }, 1);
if (!fs.existsSync(kitDir)) {
  emit({ pass: true, score: 1, capability: 'texturing', game: path.basename(gameDir), notes: ['no kit declared (src/assets/kit/ absent) — procedural art, nothing to gate'] }, 0);
}

const TILES = ['stone', 'mud', 'ice', 'lava'].flatMap((m) => ['kit_' + m + '.jpg', 'kit_' + m + '.png']).filter((f) => fs.existsSync(path.join(kitDir, f)));
const SPRITES = ['coin', 'spring', 'goal'].map((s) => 'kit_' + s + '.png').filter((f) => fs.existsSync(path.join(kitDir, f)));
const notes = [];
if (!TILES.length) emit({ pass: false, score: 0, capability: 'texturing', game: path.basename(gameDir), notes: ['kit dir exists but contains no material tiles (kit_<mat>.png)'] }, 1);

const backdropPath = ['backdrop.jpg', 'backdrop.png'].map((f) => path.join(assets, f)).find(fs.existsSync);
const b64 = (p) => `data:image/${p.endsWith('png') ? 'png' : 'jpeg'};base64,` + fs.readFileSync(p).toString('base64');

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();

// one shared in-page analyzer: decode -> { w, h, seamX, seamY, lumaStd, hueHist, alphaCoverage, bbox }
const analyze = (url, sampleHue) => page.evaluate(async ({ url, sampleHue }) => {
  const im = new Image(); im.src = url; await im.decode();
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height;
  const px = (xx, yy) => { const p = (yy * W + xx) * 4; return [d[p], d[p + 1], d[p + 2], d[p + 3]]; };
  // seam: mean abs RGB diff, left column vs right column / top row vs bottom row
  let sx = 0, sy = 0;
  for (let y = 0; y < H; y++) { const a = px(0, y), b = px(W - 1, y); sx += (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3; }
  for (let xx = 0; xx < W; xx++) { const a = px(xx, 0), b = px(xx, H - 1); sy += (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3; }
  sx /= H; sy /= W;
  // luminance stddev + saturation-weighted 12-bucket hue histogram + alpha stats (sampled grid)
  let n = 0, sum = 0, sum2 = 0, opaque = 0, total = 0;
  let minX = W, minY = H, maxX = 0, maxY = 0;
  const hist = new Array(12).fill(0);
  const step = Math.max(1, Math.floor(Math.max(W, H) / 256));
  for (let y = 0; y < H; y += step) for (let xx = 0; xx < W; xx += step) {
    const [r, g, b, a] = px(xx, y); total++;
    if (a > 16) { opaque++; if (xx < minX) minX = xx; if (xx > maxX) maxX = xx; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    if (a <= 16) continue;
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b; n++; sum += L; sum2 += L * L;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0;
    if (sat > 0.08 && sampleHue) {
      let h2; const df = mx - mn || 1;
      if (mx === r) h2 = ((g - b) / df) % 6; else if (mx === g) h2 = (b - r) / df + 2; else h2 = (r - g) / df + 4;
      h2 = (h2 * 60 + 360) % 360;
      hist[Math.floor(h2 / 30)] += sat;
    }
  }
  const meanL = n ? sum / n : 0, lumaStd = n ? Math.sqrt(Math.max(0, sum2 / n - meanL * meanL)) : 0;
  return { w: W, h: H, seamX: sx, seamY: sy, lumaStd, hueHist: hist, alphaCoverage: total ? opaque / total : 0, bboxW: Math.max(0, maxX - minX), bboxH: Math.max(0, maxY - minY) };
}, { url, sampleHue });

const cosine = (a, b) => {
  let nu = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { nu += a[i] * b[i]; da += a[i] * a[i]; db += b[i] * b[i]; }
  return da && db ? nu / Math.sqrt(da * db) : 0;
};

let checks = 0, ok = 0, failed = false;
const check = (cond, okMsg, failMsg) => { checks++; if (cond) { ok++; notes.push('ok ' + okMsg); } else { failed = true; notes.push('FAIL ' + failMsg); } };

const backdropHist = backdropPath ? (await analyze(b64(backdropPath), true)).hueHist : null;
const affinities = [];
for (const f of TILES) {
  const a = await analyze(b64(path.join(kitDir, f)), true);
  check(a.w >= 512 && a.h >= 512, `${f}: ${a.w}×${a.h}`, `${f}: too small (${a.w}×${a.h} < 512)`);
  check(a.seamX < 8 && a.seamY < 8, `${f}: seamless (edge diff x=${a.seamX.toFixed(2)} y=${a.seamY.toFixed(2)})`, `${f}: NOT tileable (edge diff x=${a.seamX.toFixed(1)} y=${a.seamY.toFixed(1)} >= 8)`);
  check(a.lumaStd >= 8, `${f}: textured (luma σ=${a.lumaStd.toFixed(1)})`, `${f}: flat placeholder fill (luma σ=${a.lumaStd.toFixed(1)} < 8)`);
  if (backdropHist) affinities.push({ f, sim: cosine(a.hueHist, backdropHist) });
}
if (backdropHist && affinities.length) {
  const meanSim = affinities.reduce((s, a) => s + a.sim, 0) / affinities.length;
  check(meanSim >= 0.35, `kit↔backdrop palette affinity ${meanSim.toFixed(2)} (per tile: ${affinities.map((a) => a.f.replace('kit_', '').replace('.png', '') + '=' + a.sim.toFixed(2)).join(' ')})`, `kit ignores the backdrop palette (mean hue affinity ${meanSim.toFixed(2)} < 0.35)`);
} else notes.push('note: no backdrop found — palette affinity not judged');
for (const f of SPRITES) {
  const a = await analyze(b64(path.join(kitDir, f)), false);
  check(a.alphaCoverage >= 0.08 && a.alphaCoverage <= 0.9, `${f}: keyed (alpha coverage ${(a.alphaCoverage * 100).toFixed(0)}%)`, `${f}: bad key (alpha coverage ${(a.alphaCoverage * 100).toFixed(0)}% outside 8–90%)`);
  check(Math.max(a.bboxW, a.bboxH) >= 24, `${f}: content ${a.bboxW}×${a.bboxH}`, `${f}: content too small (${a.bboxW}×${a.bboxH})`);
}
await browser.close();

const pass = !failed;
const score = +(100 * (checks ? ok / checks : 0)).toFixed(1);
notes.unshift(`kit: ${TILES.length} tile(s) + ${SPRITES.length} sprite(s) · ${ok}/${checks} checks`);
emit({ pass, score, threshold: 100, capability: 'texturing', game: path.basename(gameDir), deterministic: true, notes }, pass ? 0 : 1);
