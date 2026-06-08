/*
 * Sprite Studio AI-assist generator.
 *
 *   node gen.mjs "<character description>" [refImagePath]
 *
 * Uses Gemini (../art/gemini.js generateImage — nano-banana-pro class) to produce
 * three HORIZONTAL sprite STRIPS for one character on a flat MAGENTA (#ff00ff) key
 * field — a ~6-frame RUN cycle + a 4-frame IDLE + a 3-frame JUMP — then KEYS the
 * magenta out + SLICES each strip into uniform cells (reusing the magenta chroma
 * recipe from ../art/key.mjs, via headless Chromium so there are no native image
 * deps), and PACKS everything into ONE uniform spritesheet PNG. It prints the cell
 * dims + the per-anim frame INDICES (a SpriteCore.SAMPLE_SHEET-shaped descriptor)
 * so the result drops straight into the studio / a Phaser load.spritesheet call.
 *
 * If a `refImagePath` is given (a model sheet / locked character art) it is passed
 * as a generation REF so every strip stays on-model (consistent silhouette/palette).
 *
 * Auth is GEMINI_SA_JSON (or GOOGLE_APPLICATION_CREDENTIALS / GEMINI_API_KEY). With
 * NO creds we DO NOT crash: we print a clear "needs GEMINI creds" message + how to
 * use the bundled sample sheet instead.
 *
 * Output: out/<slug>-sheet.png + out/<slug>-sheet.json (the descriptor).
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { generateImage, geminiConfigured } from '../art/gemini.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out');
mkdirSync(OUT, { recursive: true });

const require = createRequire(path.join(ROOT, '../../package.json'));
const { chromium } = require('playwright');

// target uniform cell size for the packed sheet
const CELL = 96;

// the anim strips we ask for (name -> frame count + a motion brief)
const STRIPS = [
  { name: 'idle', frames: 4, brief: 'a calm IDLE breathing cycle (subtle bob, tiny anticipation), looping' },
  { name: 'run',  frames: 6, brief: 'a full RUN cycle: alternating leg strides, arm swing, body lean forward, vertical bob' },
  { name: 'jump', frames: 3, brief: 'a JUMP arc: 1) crouch/anticipation, 2) launch (legs extended, arms up), 3) tuck at apex' }
];

function slug(s) {
  return (s || 'character').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'character';
}

function buildPrompt(desc, strip) {
  return [
    'Generate a 2D game character SPRITE STRIP (sprite-sheet row) for animation.',
    `Character: ${desc}.`,
    `Show EXACTLY ${strip.frames} frames of ${strip.brief}, laid out LEFT-TO-RIGHT in a single horizontal row, EVENLY SPACED, each frame the same size, the character the same scale and vertically centered in every frame.`,
    'The character faces RIGHT. Bold, clean, readable cartoon outline; one consistent silhouette, palette and proportions across all frames (strictly ON-MODEL).',
    'FLAT SOLID MAGENTA (#ff00ff) background ONLY — fill the entire image edge to edge with pure magenta behind the character.',
    'No shadow on the ground, no grid lines, no frame borders, no numbers, no text, no UI. Just the character frames on magenta.'
  ].join(' ');
}

function refFrom(p) {
  if (!p) return [];
  const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
  if (!existsSync(abs)) { console.log('  (ref not found, ignoring): ' + p); return []; }
  const buf = readFileSync(abs);
  return [{ base64: buf.toString('base64'), mimeType: abs.endsWith('.png') ? 'image/png' : 'image/jpeg' }];
}

// In one headless page: for each generated strip, key magenta out (the key.mjs
// recipe), find the content bounding box, slice it into `frames` EQUAL columns,
// trim+center each cell, and draw it into the packed sheet at uniform CELL size.
// Returns { sheetPngBase64, frameCount, anims } (anims = {name:{start,end,...}}).
async function keyAndPack(strips) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const result = await page.evaluate(async ({ strips, CELL }) => {
    // ---- magenta key + trim (same recipe as tools/art/key.mjs) ----
    function decodeToCanvas(dataUrl) {
      return new Promise(function (resolve) {
        const img = new Image();
        img.onload = function () {
          const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
          c.getContext('2d').drawImage(img, 0, 0); resolve(c);
        };
        img.src = dataUrl;
      });
    }
    function keyMagenta(c) {                              // -> {canvas, box} ; transparent where magenta
      const ctx = c.getContext('2d'); const id = ctx.getImageData(0, 0, c.width, c.height), d = id.data;
      let minX = c.width, minY = c.height, maxX = 0, maxY = 0, kept = 0;
      for (let p = 0; p < d.length; p += 4) {
        const r = d[p], g = d[p + 1], b = d[p + 2];
        // strict magenta (key.mjs recipe) OR a softer pink/purple halo (anti-aliased
        // edge against the magenta field) — both are background, drop them so a clean
        // sheet has NO leftover magenta for validate() to flag.
        const strict = r > 120 && b > 100 && g < Math.min(r, b) - 22;
        const halo = r > 90 && b > 90 && g < Math.min(r, b) - 12 && Math.abs(r - b) < 90;
        if (strict || halo) { d[p + 3] = 0; }
        else { const px = (p / 4) % c.width, py = (p / 4 / c.width) | 0; if (px < minX) minX = px; if (px > maxX) maxX = px; if (py < minY) minY = py; if (py > maxY) maxY = py; kept++; }
      }
      ctx.putImageData(id, 0, 0);
      return { canvas: c, box: { minX, minY, maxX, maxY }, kept };
    }
    // vertical bounding box of non-transparent pixels within an x-range (per-frame
    // top/bottom trim, so a short frame isn't padded by a tall neighbour).
    function vBox(ctx, x0, w, H) {
      const d = ctx.getImageData(x0, 0, w, H).data;
      let minX = w, minY = H, maxX = -1, maxY = -1;
      for (let p = 0; p < d.length; p += 4) {
        if (d[p + 3] > 16) { const px = (p / 4) % w, py = (p / 4 / w) | 0; if (px < minX) minX = px; if (px > maxX) maxX = px; if (py < minY) minY = py; if (py > maxY) maxY = py; }
      }
      if (maxX < 0) return null;
      return { x: x0 + minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    }

    // Segment a keyed strip into per-frame x-ranges. Gemini rarely spaces frames
    // EXACTLY uniformly, so we first try GAP DETECTION: scan each column's opaque
    // pixel count, treat near-empty columns as gaps, and group the remaining runs
    // into figures. If that yields the expected frame count we use it; otherwise we
    // fall back to equal-width columns over the content box. Robust to both
    // evenly-gridded strips and loosely-spaced ones.
    function segmentStrip(canvas, box, want) {
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const x0 = box.minX, x1 = box.maxX;
      const colCount = new Int32Array(W);
      const full = ctx.getImageData(0, 0, W, H).data;
      for (let p = 0; p < full.length; p += 4) if (full[p + 3] > 16) colCount[(p / 4) % W]++;
      const thresh = Math.max(1, Math.round(H * 0.01));        // a column with <1% content = gap
      const segs = [];
      let s = -1;
      for (let x = x0; x <= x1; x++) {
        const on = colCount[x] > thresh;
        if (on && s < 0) s = x;
        else if (!on && s >= 0) { if (x - s > 4) segs.push([s, x - 1]); s = -1; }
      }
      if (s >= 0 && x1 - s > 4) segs.push([s, x1]);
      // merge tiny slivers into the nearest neighbour (stray antenna dots etc.)
      const ranges = (segs.length === want) ? segs : null;
      if (ranges) return ranges.map(([a, b]) => ({ a, b }));
      // fallback: equal columns over the content box
      const colW = (x1 - x0 + 1) / want, out = [];
      for (let f = 0; f < want; f++) out.push({ a: Math.round(x0 + f * colW), b: Math.round(x0 + (f + 1) * colW) - 1 });
      return out;
    }

    const totalFrames = strips.reduce((n, s) => n + s.frames, 0);
    const sheet = document.createElement('canvas'); sheet.width = CELL * totalFrames; sheet.height = CELL;
    const sx = sheet.getContext('2d'); sx.imageSmoothingQuality = 'high';

    let col = 0; const anims = {};
    const debug = {};
    for (const s of strips) {
      const src = await decodeToCanvas(s.dataUrl);
      const { canvas, box } = keyMagenta(src);
      const start = col;
      const fr = { idle: 6, run: 17, jump: 12 }[s.name] || 10;
      const rp = s.name === 'jump' ? 0 : -1;
      const ranges = segmentStrip(canvas, box, s.frames);
      debug[s.name] = ranges.length;
      for (let f = 0; f < s.frames; f++) {
        const rg = ranges[f] || ranges[ranges.length - 1];
        const cw = rg.b - rg.a + 1;
        // tight per-frame box (trim top/bottom too, so short poses aren't shrunk)
        const cb = vBox(canvas.getContext('2d'), rg.a, cw, canvas.height) || { x: rg.a, y: box.minY, w: cw, h: box.maxY - box.minY + 1 };
        // fit the trimmed frame into a CELL box (contain), bottom-anchored + centered
        const pad = 6, avail = CELL - pad * 2;
        const scale = Math.min(avail / cb.w, avail / cb.h, 1.6);
        const dw = Math.round(cb.w * scale), dh = Math.round(cb.h * scale);
        const dx = col * CELL + Math.round((CELL - dw) / 2);
        const dy = Math.round(CELL - pad - dh);            // feet near the cell bottom
        sx.drawImage(canvas, cb.x, cb.y, cb.w, cb.h, dx, dy, dw, dh);
        col++;
      }
      anims[s.name] = { start, end: col - 1, frameRate: fr, repeat: rp };
    }
    return { sheetPngBase64: sheet.toDataURL('image/png').split(',')[1], frameCount: totalFrames, anims, segmented: debug };
  }, { strips, CELL });
  await browser.close();
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  // last arg may be a ref image path if it looks like a file; otherwise all of it is the desc
  let refPath = null, descParts = args.slice();
  if (descParts.length > 1 && /\.(png|jpe?g)$/i.test(descParts[descParts.length - 1])) {
    refPath = descParts.pop();
  }
  const description = descParts.join(' ').trim();

  if (!description) {
    console.error('usage: node gen.mjs "<character description>" [refImage.png]');
    process.exit(2);
  }

  console.log('Sprite Studio AI-assist');
  console.log('  character : "' + description + '"');
  if (refPath) console.log('  ref       : ' + refPath);
  console.log('  strips    : ' + STRIPS.map((s) => `${s.name}(${s.frames})`).join(', ') + `  @ ${CELL}px cells`);

  if (!geminiConfigured()) {
    console.log('\n[needs GEMINI creds] GEMINI_SA_JSON (or GOOGLE_APPLICATION_CREDENTIALS / GEMINI_API_KEY) is not set.');
    console.log('Cannot generate art offline. Use the bundled sample sheet instead:');
    console.log('  assets/sample-hero.png  (64x64 cells x 15 frames; idle 0-3, run 4-11, jump 12-14)');
    console.log('  regenerate it with: node make-sample.mjs');
    return;
  }

  const refs = refFrom(refPath);
  const strips = [];
  for (const s of STRIPS) {
    console.log(`\ngenerating ${s.name} strip (${s.frames} frames)...`);
    try {
      // gemini-3-pro-image reliably honours 16:9; extreme strip ratios (4:1/8:1)
      // are rejected by this model, so we ask for a 16:9 canvas (plenty of width
      // for a row of frames) and let the keyer slice the content into uniform cells.
      const { mimeType, base64 } = await generateImage(buildPrompt(description, s), {
        aspectRatio: '16:9',
        refs
      });
      strips.push({ name: s.name, frames: s.frames, dataUrl: `data:${mimeType};base64,${base64}` });
      // keep the raw strip for debugging
      writeFileSync(path.join(OUT, `${slug(description)}-${s.name}-raw.png`), Buffer.from(base64, 'base64'));
      console.log('  ok');
    } catch (e) {
      console.log('  [generation failed] ' + (e && e.message ? e.message : e));
    }
  }

  if (!strips.length) {
    console.log('\nNo strips were generated (all calls failed). Try again or check creds/quota.');
    return;
  }

  console.log('\nkeying magenta + slicing into a uniform sheet...');
  const packed = await keyAndPack(strips);
  const sl = slug(description);
  const sheetPath = path.join(OUT, `${sl}-sheet.png`);
  writeFileSync(sheetPath, Buffer.from(packed.sheetPngBase64, 'base64'));

  const descriptor = {
    url: `out/${sl}-sheet.png`,
    frameWidth: CELL, frameHeight: CELL,
    frameCount: packed.frameCount,
    anims: packed.anims
  };
  writeFileSync(path.join(OUT, `${sl}-sheet.json`), JSON.stringify(descriptor, null, 2));

  console.log('\nDONE');
  console.log('  sheet      : ' + path.relative(ROOT, sheetPath) + `  (${CELL}x${CELL} cells, ${packed.frameCount} frames)`);
  console.log('  descriptor : ' + path.relative(ROOT, path.join(OUT, `${sl}-sheet.json`)));
  console.log('  frame indices:');
  for (const [n, a] of Object.entries(packed.anims)) {
    const seg = packed.segmented && packed.segmented[n];
    const segNote = seg != null ? (seg === (a.end - a.start + 1) ? '' : '  [auto-sliced by gaps]') : '';
    console.log(`    ${n.padEnd(5)} : frames ${a.start}-${a.end}  (frameRate ${a.frameRate}, repeat ${a.repeat})${segNote}`);
  }
  console.log('\n  Phaser: this.load.spritesheet("' + sl + '", "' + descriptor.url + '", { frameWidth: ' + CELL + ', frameHeight: ' + CELL + ' });');
  console.log('  Studio: paste ' + sl + '-sheet.json into the Sprite Studio sheet inputs, or set window.__ss.setSheet(<descriptor>).');
  console.log('  (validate it: load it in index.html -> "Validate sheet", or run check.mjs against it.)');
}

main().catch((e) => { console.error('unexpected error:', e); process.exit(1); });
